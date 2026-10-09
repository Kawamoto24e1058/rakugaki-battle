/**
 * 実写っぽい「したがき用紙の撮影写真」を合成するシミュレーター。
 * 実物の写真が無くても、検出・切り抜きの精度を数字で測れるようにするためのもの。
 *  - 用紙（A4比）に 角マーカー＋L字目印＋文字ブロック（■の文字も含む）＋子どもの絵 を描く
 *  - 斜め・回転・遠近で撮影し、暗い机・影・ぼけ・ノイズを乗せる
 */
import { mulberry32 } from '../src/engine/rng';
import { computeHomography, applyHomography, type Point } from '../src/engine/scan/warp';

export const TPL = {
  W: 630,
  H: 891,
  box: { l: 45, t: 120, r: 525, b: 600 },
  mk: 36,
};

type RGB = [number, number, number];
interface Shape {
  bbox: [number, number, number, number];
  cov: (x: number, y: number) => number;
  color: RGB;
  isChar: boolean;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function rect(x0: number, y0: number, x1: number, y1: number, color: RGB, isChar = false): Shape {
  return {
    bbox: [x0 - 1, y0 - 1, x1 + 1, y1 + 1],
    color,
    isChar,
    cov: (x, y) => clamp01(Math.min(x - x0 + 0.5, x1 - x + 0.5, y - y0 + 0.5, y1 - y + 0.5)),
  };
}

function seg(ax: number, ay: number, bx: number, by: number, w: number, color: RGB, isChar = true): Shape {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  return {
    bbox: [Math.min(ax, bx) - w, Math.min(ay, by) - w, Math.max(ax, bx) + w, Math.max(ay, by) + w],
    color,
    isChar,
    cov: (x, y) => {
      const t = clamp01(((x - ax) * dx + (y - ay) * dy) / len2);
      const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
      return clamp01(w / 2 + 0.5 - d);
    },
  };
}

function ring(cx: number, cy: number, rx: number, ry: number, w: number, color: RGB, rot = 0): Shape {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const R = Math.max(rx, ry) + w;
  return {
    bbox: [cx - R, cy - R, cx + R, cy + R],
    color,
    isChar: true,
    cov: (x, y) => {
      const px = x - cx;
      const py = y - cy;
      const u = (px * c + py * s) / rx;
      const v = (-px * s + py * c) / ry;
      const rr = Math.hypot(u, v);
      const d = Math.abs(rr - 1) * Math.min(rx, ry);
      return clamp01(w / 2 + 0.5 - d);
    },
  };
}

function disc(cx: number, cy: number, rx: number, ry: number, color: RGB): Shape {
  return {
    bbox: [cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1],
    color,
    isChar: true,
    cov: (x, y) => {
      const u = (x - cx) / rx;
      const v = (y - cy) / ry;
      const d = (Math.hypot(u, v) - 1) * Math.min(rx, ry);
      return clamp01(0.5 - d);
    },
  };
}

export interface Template {
  rgb: Uint8ClampedArray; // W*H*3
  charCov: Float32Array; // 子どもの絵だけのカバレッジ
  markers: [Point, Point, Point, Point]; // TL,TR,BL,BR 中心
}

const PALETTE: RGB[] = [
  [63, 143, 111],
  [200, 50, 50],
  [232, 196, 20],
  [250, 190, 200], // 淡いピンク
  [170, 210, 250], // 淡い水色
  [235, 130, 30],
  [120, 60, 160],
  [30, 30, 30],
  [140, 140, 140], // えんぴつ
];

export function renderTemplate(seed: number, bigFill = false): Template {
  const rng = mulberry32(seed);
  const { W, H, box, mk } = TPL;
  const shapes: Shape[] = [];
  const RED: RGB = [192, 57, 43];
  const BLACK: RGB = [10, 10, 10];
  const ORANGE: RGB = [232, 179, 42];

  // 見出し（赤文字ブロック）
  for (let i = 0; i < 14; i++) shapes.push(rect(150 + i * 25, 28, 150 + i * 25 + 18 + rng() * 4, 52, RED));
  // 説明文（黒文字ブロック。■の文字を含む）
  for (let i = 0; i < 12; i++) shapes.push(rect(140 + i * 30, 68, 140 + i * 30 + 20, 80, [40, 40, 40]));
  for (let i = 0; i < 10; i++) shapes.push(rect(180 + i * 28, 88, 180 + i * 28 + 18, 100, [40, 40, 40]));
  shapes.push(rect(272, 86, 284, 100, BLACK)); // 「■」の文字（マーカーに紛らわしい）
  // フッター文字
  for (let i = 0; i < 7; i++) shapes.push(rect(250 + i * 18, 628, 250 + i * 18 + 12, 640, [150, 150, 150]));
  // ブラウザの印刷ヘッダー/フッター（細長い暗い文字）
  shapes.push(rect(20, 8, 120, 17, [30, 30, 30]));
  shapes.push(rect(500, 870, 600, 880, [30, 30, 30]));

  // 角のL字目印（オレンジ）
  const arm = 36;
  const th = 4.3;
  const corners: [number, number, number, number][] = [
    [box.l, box.t, 1, 1],
    [box.r, box.t, -1, 1],
    [box.l, box.b, 1, -1],
    [box.r, box.b, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    shapes.push(rect(Math.min(cx, cx + dx * arm), cy - th / 2, Math.max(cx, cx + dx * arm), cy + th / 2, ORANGE));
    shapes.push(rect(cx - th / 2, Math.min(cy, cy + dy * arm), cx + th / 2, Math.max(cy, cy + dy * arm), ORANGE));
  }
  // 黒マーカー
  for (const [cx, cy] of corners) shapes.push(rect(cx - mk / 2, cy - mk / 2, cx + mk / 2, cy + mk / 2, BLACK));

  // 子どもの絵
  const pick = () => PALETTE[Math.floor(rng() * PALETTE.length)];
  const bw = box.r - box.l;
  const bh = box.b - box.t;
  const cx0 = box.l + bw * (0.4 + rng() * 0.2);
  const cy0 = box.t + bh * (0.5 + rng() * 0.15);
  const faceC = pick();
  shapes.push(ring(cx0, cy0, 110 + rng() * 30, 110 + rng() * 30, 3 + rng() * 4, faceC.every((v) => v > 200) ? [90, 90, 90] : faceC));
  const hairC = pick();
  const nHair = 10 + Math.floor(rng() * 14);
  for (let i = 0; i < nHair; i++) {
    const x = cx0 - 120 + (240 * i) / nHair + rng() * 6;
    shapes.push(seg(x, cy0 - 150 - rng() * 20, x + (rng() - 0.5) * 20, cy0 - 20 + rng() * 40, 3 + rng() * 3, hairC));
  }
  // 目・口・ほっぺ
  shapes.push(seg(cx0 - 45, cy0 - 20, cx0 - 45, cy0 + 5, 4, [20, 20, 20]));
  shapes.push(seg(cx0 + 45, cy0 - 20, cx0 + 45, cy0 + 5, 4, [20, 20, 20]));
  shapes.push(seg(cx0 - 20, cy0 + 40, cx0 + 20, cy0 + 40, 4, [20, 20, 20]));
  shapes.push(seg(cx0 - 80, cy0 + 20, cx0 - 55, cy0 + 22, 5, pick()));
  // 輪っか（箱ぎりぎり・閉じた輪）を高確率で
  if (rng() < 0.8) {
    const hc = pick();
    const hx = box.l + 60 + rng() * 100;
    const hy = box.t + 25 + rng() * 40;
    shapes.push(ring(hx, hy, 50 + rng() * 15, 22 + rng() * 8, 5 + rng() * 4, hc, -0.3));
  }
  // 箱の際（辺の途中）に描く飾り
  if (rng() < 0.6) {
    const ec = pick();
    const ex = box.l + 160 + rng() * 150;
    shapes.push(seg(ex, box.t + 6, ex + 80, box.t + 6 + rng() * 6, 6, ec));
  }
  // 大きな塗りつぶし（体・髪のかたまり。窓より大きい塗りは「紙」と誤認されやすい）
  if (bigFill) {
    const fillSet: RGB[] = [[30, 30, 30], [250, 190, 200], [120, 120, 120], [200, 50, 50]];
    const fc = fillSet[Math.floor(rng() * fillSet.length)];
    shapes.push(disc(box.l + bw * 0.5, box.t + bh * 0.72, 95 + rng() * 25, 75 + rng() * 25, fc));
  }
  // うすい落書き（薄い色の線）
  if (rng() < 0.7) {
    const pc: RGB = [250, 205, 120];
    shapes.push(seg(cx0 + 90, cy0 + 100, cx0 + 180, cy0 + 150, 7, pc));
  }

  // ラスタライズ
  const rgb = new Uint8ClampedArray(W * H * 3).fill(255);
  const charCov = new Float32Array(W * H);
  for (const s of shapes) {
    const x0 = Math.max(0, Math.floor(s.bbox[0]));
    const y0 = Math.max(0, Math.floor(s.bbox[1]));
    const x1 = Math.min(W - 1, Math.ceil(s.bbox[2]));
    const y1 = Math.min(H - 1, Math.ceil(s.bbox[3]));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const a = s.cov(x, y);
        if (a <= 0) continue;
        const i = (y * W + x) * 3;
        rgb[i] = rgb[i] * (1 - a) + s.color[0] * a;
        rgb[i + 1] = rgb[i + 1] * (1 - a) + s.color[1] * a;
        rgb[i + 2] = rgb[i + 2] * (1 - a) + s.color[2] * a;
        if (s.isChar) charCov[y * W + x] = Math.max(charCov[y * W + x], a);
      }
    }
  }
  const markers: [Point, Point, Point, Point] = [
    { x: box.l, y: box.t },
    { x: box.r, y: box.t },
    { x: box.l, y: box.b },
    { x: box.r, y: box.b },
  ];
  return { rgb, charCov, markers };
}

export interface SimPhoto {
  photo: ImageData;
  /** 写真上の マーカー中心の正解（TL,TR,BL,BR） */
  truthMarkers: [Point, Point, Point, Point];
  /** 写真座標 → テンプレ座標 */
  toTemplate: (p: Point) => Point;
  tpl: Template;
}

export interface SimOpts {
  W?: number;
  H?: number;
  /** 用紙が写真幅に占める割合の目安 */
  paperFrac?: number;
  maxRotDeg?: number;
  tilt?: number; // 遠近の強さ（辺の位置ずれ割合）
  shadow?: number; // 0..1
  blur?: number; // 箱ぼかし半径(px)
  noise?: number;
  darkBg?: boolean;
  /** 中央を正方形に切り出す（カメラのガイド枠撮影の再現） */
  squareCrop?: boolean;
  /** 箱の中心が写真の中心に来るように用紙をずらす（ガイド枠に合わせて撮る想定） */
  centerBox?: boolean;
  /** 大きな塗りつぶしを含める */
  bigFill?: boolean;
}

function gauss(rng: () => number) {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function simulatePhoto(seed: number, o: SimOpts = {}): SimPhoto {
  const rng = mulberry32(seed * 7919 + 13);
  const tpl = renderTemplate(seed, o.bigFill ?? false);
  const W = o.W ?? 900;
  const H = o.H ?? 1200;
  const paperFrac = o.paperFrac ?? 0.82;
  const maxRot = ((o.maxRotDeg ?? 12) * Math.PI) / 180;
  const tilt = o.tilt ?? 0.04;

  // テンプレの四隅 → 写真上の四角形
  const pw = W * paperFrac;
  const ph = pw * (TPL.H / TPL.W);
  const rot = (rng() * 2 - 1) * maxRot;
  let cxp = W / 2 + (rng() - 0.5) * W * 0.06;
  let cyp = H / 2 + (rng() - 0.5) * H * 0.06;
  if (o.centerBox) {
    const sc = pw / TPL.W;
    const vx = ((TPL.box.l + TPL.box.r) / 2 - TPL.W / 2) * sc;
    const vy = ((TPL.box.t + TPL.box.b) / 2 - TPL.H / 2) * sc;
    cxp -= vx * Math.cos(rot) - vy * Math.sin(rot);
    cyp -= vx * Math.sin(rot) + vy * Math.cos(rot);
  }
  const corners: Point[] = [
    { x: -pw / 2, y: -ph / 2 },
    { x: pw / 2, y: -ph / 2 },
    { x: -pw / 2, y: ph / 2 },
    { x: pw / 2, y: ph / 2 },
  ].map((c) => {
    const jx = (rng() - 0.5) * 2 * tilt * pw;
    const jy = (rng() - 0.5) * 2 * tilt * ph;
    const x = c.x + jx;
    const y = c.y + jy;
    return { x: cxp + x * Math.cos(rot) - y * Math.sin(rot), y: cyp + x * Math.sin(rot) + y * Math.cos(rot) };
  });
  const tplCorners: [Point, Point, Point, Point] = [
    { x: 0, y: 0 },
    { x: TPL.W, y: 0 },
    { x: 0, y: TPL.H },
    { x: TPL.W, y: TPL.H },
  ];
  const photoQuad = corners as [Point, Point, Point, Point];
  const G = computeHomography(photoQuad, tplCorners); // 写真→テンプレ
  const F = computeHomography(tplCorners, photoQuad); // テンプレ→写真

  const data = new Uint8ClampedArray(W * H * 4);
  const shadowDir = rng() * Math.PI * 2;
  const blobX = rng() * W;
  const blobY = rng() * H;
  const shadowAmt = o.shadow ?? 0.35;
  const dark = o.darkBg ?? true;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = applyHomography(G, x, y);
      let r: number;
      let g: number;
      let b: number;
      const inside = t.x >= 0 && t.y >= 0 && t.x < TPL.W - 1 && t.y < TPL.H - 1;
      if (inside) {
        const x0 = Math.floor(t.x);
        const y0 = Math.floor(t.y);
        const fx = t.x - x0;
        const fy = t.y - y0;
        const idx = (yy: number, xx: number, c: number) => tpl.rgb[(yy * TPL.W + xx) * 3 + c];
        const samp = (c: number) =>
          (idx(y0, x0, c) * (1 - fx) + idx(y0, x0 + 1, c) * fx) * (1 - fy) +
          (idx(y0 + 1, x0, c) * (1 - fx) + idx(y0 + 1, x0 + 1, c) * fx) * fy;
        r = samp(0);
        g = samp(1);
        b = samp(2);
        // 紙は少し黄ばませる
        r *= 0.97;
        g *= 0.97;
        b *= 0.92;
      } else {
        const n = (Math.sin(x * 0.07 + y * 0.013) + Math.sin(y * 0.11)) * 6;
        if (dark) {
          r = 70 + n;
          g = 52 + n;
          b = 38 + n;
          if (x < W * 0.08) {
            r = g = b = 14; // 黒いカバン
          }
          if (x > W * 0.86 && y < H * 0.4) {
            r = 200;
            g = 215;
            b = 235; // 雑誌
          }
        } else {
          r = g = b = 235;
        }
      }
      // 影（なだらかな方向性のかげ＋手の影のようなぼんやり丸）
      const dirv = ((x / W - 0.5) * Math.cos(shadowDir) + (y / H - 0.5) * Math.sin(shadowDir)) * 2;
      let sh = 1 - shadowAmt * clamp01(0.5 + dirv * 0.5) * 0.9;
      const bd = Math.hypot(x - blobX, y - blobY) / (W * 0.22);
      sh *= 1 - shadowAmt * 0.8 * Math.exp(-bd * bd);
      r *= sh;
      g *= sh;
      b *= sh;
      const nz = (o.noise ?? 5) * gauss(rng);
      const i = (y * W + x) * 4;
      data[i] = r + nz;
      data[i + 1] = g + nz;
      data[i + 2] = b + nz;
      data[i + 3] = 255;
    }
  }
  // ぼかし（箱ぼかし×2）
  const blurR = o.blur ?? 1;
  let imgData = { data, width: W, height: H, colorSpace: 'srgb' } as ImageData;
  if (blurR > 0) imgData = boxBlurRGBA(imgData, blurR);

  const truthMarkers = tpl.markers.map((m) => applyHomography(F, m.x, m.y)) as [Point, Point, Point, Point];
  let toTemplate = (p: Point) => applyHomography(G, p.x, p.y);

  if (o.squareCrop) {
    const side = Math.floor(Math.min(W, H) * 0.9);
    const ox = Math.floor((W - side) / 2);
    const oy = Math.floor((H - side) / 2);
    const out = new Uint8ClampedArray(side * side * 4);
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        const si = ((y + oy) * W + (x + ox)) * 4;
        const di = (y * side + x) * 4;
        out[di] = imgData.data[si];
        out[di + 1] = imgData.data[si + 1];
        out[di + 2] = imgData.data[si + 2];
        out[di + 3] = 255;
      }
    }
    imgData = { data: out, width: side, height: side, colorSpace: 'srgb' } as ImageData;
    for (const m of truthMarkers) {
      m.x -= ox;
      m.y -= oy;
    }
    const baseTo = toTemplate;
    toTemplate = (p) => baseTo({ x: p.x + ox, y: p.y + oy });
  }
  return { photo: imgData, truthMarkers, toTemplate, tpl };
}

function boxBlurRGBA(img: ImageData, r: number): ImageData {
  const { width: w, height: h, data } = img;
  const tmp = new Float32Array(w * h * 3);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) {
      let acc = 0;
      let n = 0;
      for (let x = -r; x <= r; x++) {
        const xx = Math.min(w - 1, Math.max(0, x));
        acc += data[(y * w + xx) * 4 + c];
        n++;
      }
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 3 + c] = acc / n;
        const add = Math.min(w - 1, x + r + 1);
        const sub = Math.max(0, x - r);
        acc += data[(y * w + add) * 4 + c] - data[(y * w + sub) * 4 + c];
      }
    }
  }
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let acc = 0;
      let n = 0;
      for (let y = -r; y <= r; y++) {
        const yy = Math.min(h - 1, Math.max(0, y));
        acc += tmp[(yy * w + x) * 3 + c];
        n++;
      }
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * 4 + c] = acc / n;
        const add = Math.min(h - 1, y + r + 1);
        const sub = Math.max(0, y - r);
        acc += tmp[(add * w + x) * 3 + c] - tmp[(sub * w + x) * 3 + c];
      }
    }
  }
  for (let i = 3; i < out.length; i += 4) out[i] = 255;
  return { data: out, width: w, height: h, colorSpace: 'srgb' } as ImageData;
}

/** デバッグ用：RGBA を PNG に書き出す（目視確認用）。 */
export async function savePng(img: ImageData, path: string): Promise<void> {
  const { deflateSync } = await import('node:zlib');
  const { writeFileSync } = await import('node:fs');
  const { width: w, height: h, data } = img;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, body: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const td = Buffer.concat([Buffer.from(type), body]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}
