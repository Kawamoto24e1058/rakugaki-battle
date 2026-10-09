import type { Point } from './warp';
import { boxBlur2D } from './illum';

export interface CornerMarkers {
  tl: Point;
  tr: Point;
  bl: Point;
  br: Point;
}

interface Blob {
  count: number;
  cx: number;
  cy: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * 用紙に印刷した4隅の黒いマーカー（■）を写真から検出する。
 *
 * ダウンサンプル → 局所しきい値で二値化 → 連結成分 → 「四角くて・ほどよい大きさ」の
 * 候補を集め、**4つが正方形っぽく並ぶ組み合わせ**を探して採用する。
 * （以前は「画像の角に一番近い塊」を採用していたため、用紙が画面いっぱいでない写真や
 *  暗い机・説明文の「■」の文字・ブラウザ印刷の黒い文字を誤検出していた。）
 * 最後に元画像の解像度で中心を補正する。見つからなければ null。
 */
export function detectCornerMarkers(img: ImageData): CornerMarkers | null {
  // 条件を変えて順に試す（1回目で見つかればそれを採用）。
  const attempts: { maxDim: number; ratio: number }[] = [
    { maxDim: 320, ratio: 0.62 },
    { maxDim: 480, ratio: 0.72 },
    { maxDim: 220, ratio: 0.55 },
  ];
  for (const a of attempts) {
    const r = detectOnce(img, a.maxDim, a.ratio);
    if (r) return r;
  }
  return null;
}

function detectOnce(img: ImageData, maxDim: number, ratio: number): CornerMarkers | null {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const dw = Math.max(1, Math.round(img.width * scale));
  const dh = Math.max(1, Math.round(img.height * scale));

  const gray = new Float32Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(img.height - 1, Math.floor(y / scale));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(img.width - 1, Math.floor(x / scale));
      const i = (sy * img.width + sx) * 4;
      gray[y * dw + x] = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
    }
  }

  // 写真全体の平均ではなく「その場所の周り」と比べて暗いかどうかで判定する。
  const localMean = boxBlur2D(gray, dw, dh, Math.max(4, Math.round(Math.min(dw, dh) * 0.15)));
  const dark = new Uint8Array(dw * dh);
  for (let i = 0; i < dark.length; i++) {
    const threshold = Math.min(150, Math.max(30, localMean[i] * ratio));
    dark[i] = gray[i] < threshold ? 1 : 0;
  }

  const blobs = labelBlobs(dark, dw, dh);
  const totalArea = dw * dh;
  const candidates = blobs.filter((b) => {
    if (b.count < totalArea * 0.00025 || b.count > totalArea * 0.03) return false;
    const bw = b.maxX - b.minX + 1;
    const bh = b.maxY - b.minY + 1;
    const aspect = bw / bh;
    if (aspect < 0.55 || aspect > 1.8) return false;
    // 写真の端で見切れた塊は中心がずれるので、マーカー候補にしない
    if (b.minX <= 0 || b.minY <= 0 || b.maxX >= dw - 1 || b.maxY >= dh - 1) return false;
    return b.count / (bw * bh) >= 0.5;
  });
  if (candidates.length < 4) return null;

  const quad = selectQuad(candidates, totalArea);
  if (!quad) return null;

  const ordered = orderCorners(quad);
  const [tl, tr, bl, br] = ordered.map((b) =>
    refineCenter(img, { x: b.cx / scale, y: b.cy / scale }, b, scale),
  );
  return { tl, tr, bl, br };
}

function labelBlobs(dark: Uint8Array, dw: number, dh: number): Blob[] {
  const visited = new Uint8Array(dw * dh);
  const blobs: Blob[] = [];
  const qx = new Int32Array(dw * dh);
  const qy = new Int32Array(dw * dh);
  for (let sy = 0; sy < dh; sy++) {
    for (let sx = 0; sx < dw; sx++) {
      const start = sy * dw + sx;
      if (!dark[start] || visited[start]) continue;
      let head = 0;
      let tail = 0;
      qx[tail] = sx;
      qy[tail] = sy;
      tail++;
      visited[start] = 1;
      let count = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = sx;
      let maxX = sx;
      let minY = sy;
      let maxY = sy;
      while (head < tail) {
        const x = qx[head];
        const y = qy[head];
        head++;
        count++;
        sumX += x;
        sumY += y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        const tryPush = (nx: number, ny: number) => {
          if (nx < 0 || ny < 0 || nx >= dw || ny >= dh) return;
          const ni = ny * dw + nx;
          if (!dark[ni] || visited[ni]) return;
          visited[ni] = 1;
          qx[tail] = nx;
          qy[tail] = ny;
          tail++;
        };
        tryPush(x - 1, y);
        tryPush(x + 1, y);
        tryPush(x, y - 1);
        tryPush(x, y + 1);
      }
      blobs.push({ count, cx: sumX / count, cy: sumY / count, minX, maxX, minY, maxY });
    }
  }
  return blobs;
}

/** 候補のうち「正方形っぽく並ぶ4つ」を探す。大きくて整った四角形ほど高得点。 */
function selectQuad(cands: Blob[], totalArea: number): Blob[] | null {
  // 大きく四角い順に上位だけで組み合わせを試す（組み合わせ爆発の防止）。
  const scored = cands
    .map((b) => {
      const bw = b.maxX - b.minX + 1;
      const bh = b.maxY - b.minY + 1;
      const fill = b.count / (bw * bh);
      const aspect = Math.min(bw / bh, bh / bw);
      // 大きくて四角いものを優先（回転すると fill が下がるので、面積も順位に入れる）
      return { b, s: fill * aspect * Math.sqrt(b.count) };
    })
    .sort((a, c) => c.s - a.s)
    .slice(0, 16)
    .map((x) => x.b);

  let best: Blob[] | null = null;
  let bestScore = 0;
  const n = scored.length;
  for (let a = 0; a < n - 3; a++) {
    for (let b = a + 1; b < n - 2; b++) {
      for (let c = b + 1; c < n - 1; c++) {
        for (let d = c + 1; d < n; d++) {
          const score = quadScore([scored[a], scored[b], scored[c], scored[d]], totalArea);
          if (score > bestScore) {
            bestScore = score;
            best = [scored[a], scored[b], scored[c], scored[d]];
          }
        }
      }
    }
  }
  return best;
}

function quadScore(q: Blob[], totalArea: number): number {
  // マーカーは全部同じ大きさのはず（遠近でも数倍は違わない）
  const areas = q.map((b) => b.count);
  const minA = Math.min(...areas);
  const maxA = Math.max(...areas);
  if (maxA / minA > 2.6) return 0;

  // 重心まわりの角度順に並べて凸四角形かどうか確認
  const gx = q.reduce((s, b) => s + b.cx, 0) / 4;
  const gy = q.reduce((s, b) => s + b.cy, 0) / 4;
  const pts = q
    .map((b) => ({ x: b.cx, y: b.cy, a: Math.atan2(b.cy - gy, b.cx - gx) }))
    .sort((p, r) => p.a - r.a);
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % 4];
    const p2 = pts[(i + 2) % 4];
    const cross = (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
    if (cross === 0) return 0;
    const sg = cross > 0 ? 1 : -1;
    if (sign === 0) sign = sg;
    else if (sg !== sign) return 0;
  }

  const edges: number[] = [];
  for (let i = 0; i < 4; i++) {
    const p = pts[i];
    const r = pts[(i + 1) % 4];
    edges.push(Math.hypot(r.x - p.x, r.y - p.y));
  }
  const minE = Math.min(...edges);
  const maxE = Math.max(...edges);
  if (minE / maxE < 0.35) return 0; // 箱は正方形なので極端に細長い四角形ではない

  // 各頂点の内角が極端でないこと
  for (let i = 0; i < 4; i++) {
    const p0 = pts[(i + 3) % 4];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % 4];
    const v1x = p0.x - p1.x;
    const v1y = p0.y - p1.y;
    const v2x = p2.x - p1.x;
    const v2y = p2.y - p1.y;
    const cos = (v1x * v2x + v1y * v2y) / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y));
    const deg = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
    if (deg < 45 || deg > 135) return 0;
  }

  // 面積（靴ひも公式）
  let area2 = 0;
  for (let i = 0; i < 4; i++) {
    const p = pts[i];
    const r = pts[(i + 1) % 4];
    area2 += p.x * r.y - r.x * p.y;
  }
  const quadArea = Math.abs(area2) / 2;
  if (quadArea < totalArea * 0.02) return 0;

  // マーカーは文字や■の文字より大きい塊なので、塊が大きい組み合わせほど高得点にする。
  const meanA = areas.reduce((a, b) => a + b, 0) / 4;
  return quadArea * (minE / maxE) * Math.sqrt(minA / maxA) * Math.sqrt(meanA);
}

/** TL, TR, BL, BR の順に並べる（回転が45°未満の撮影を想定）。 */
function orderCorners(q: Blob[]): [Blob, Blob, Blob, Blob] {
  const by = (f: (b: Blob) => number, dir: 1 | -1) => [...q].sort((a, b) => dir * (f(a) - f(b)))[0];
  const tl = by((b) => b.cx + b.cy, 1);
  const br = by((b) => b.cx + b.cy, -1);
  const tr = by((b) => b.cx - b.cy, -1);
  const bl = by((b) => b.cx - b.cy, 1);
  return [tl, tr, bl, br];
}

/**
 * 粗い（ダウンサンプルした）位置の周りで、元画像の解像度のまま黒い塊の重心を取り直す。
 * 粗い検出は数px単位のずれがあり、台形補正の精度を下げるため。
 */
function refineCenter(img: ImageData, coarse: Point, blob: Blob, scale: number): Point {
  const { width: w, height: h, data } = img;
  const half = Math.max(8, Math.round(Math.max(blob.maxX - blob.minX + 1, blob.maxY - blob.minY + 1) / scale));
  const x0 = Math.max(0, Math.round(coarse.x) - half);
  const x1 = Math.min(w - 1, Math.round(coarse.x) + half);
  const y0 = Math.max(0, Math.round(coarse.y) - half);
  const y1 = Math.min(h - 1, Math.round(coarse.y) + half);
  const ww = x1 - x0 + 1;
  const hh = y1 - y0 + 1;
  if (ww < 6 || hh < 6) return coarse;

  const g = new Float32Array(ww * hh);
  const hist = new Uint32Array(256);
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < ww; x++) {
      const i = ((y + y0) * w + (x + x0)) * 4;
      const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      g[y * ww + x] = v;
      hist[Math.max(0, Math.min(255, Math.round(v)))]++;
    }
  }
  const pct = (p: number) => {
    const target = ww * hh * p;
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= target) return v;
    }
    return 255;
  };
  const lo = pct(0.05);
  const hi = pct(0.75);
  if (hi - lo < 40) return coarse; // コントラストが無い（想定外）
  const thr = (lo + hi) / 2;

  // 中心に一番近い暗い画素から塗りつぶして、その塊の重心を求める
  const cxL = Math.round(coarse.x) - x0;
  const cyL = Math.round(coarse.y) - y0;
  let seed = -1;
  let bestD = Infinity;
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < ww; x++) {
      if (g[y * ww + x] >= thr) continue;
      const d = (x - cxL) ** 2 + (y - cyL) ** 2;
      if (d < bestD) {
        bestD = d;
        seed = y * ww + x;
      }
    }
  }
  if (seed < 0) return coarse;
  const visited = new Uint8Array(ww * hh);
  const stack: number[] = [seed];
  visited[seed] = 1;
  let n = 0;
  let sx = 0;
  let sy = 0;
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % ww;
    const y = (p - x) / ww;
    n++;
    sx += x;
    sy += y;
    if (x > 0 && !visited[p - 1] && g[p - 1] < thr) {
      visited[p - 1] = 1;
      stack.push(p - 1);
    }
    if (x < ww - 1 && !visited[p + 1] && g[p + 1] < thr) {
      visited[p + 1] = 1;
      stack.push(p + 1);
    }
    if (y > 0 && !visited[p - ww] && g[p - ww] < thr) {
      visited[p - ww] = 1;
      stack.push(p - ww);
    }
    if (y < hh - 1 && !visited[p + ww] && g[p + ww] < thr) {
      visited[p + ww] = 1;
      stack.push(p + ww);
    }
  }
  const expected = blob.count / (scale * scale);
  if (n < expected * 0.35 || n > expected * 2.8) return coarse; // 別のものを拾った疑い
  return { x: x0 + sx / n, y: y0 + sy / n };
}
