/**
 * 紙の背景を透明にする。各画素を「その場所に紙があったら何色に見えるはずか」の
 * 予測値と比べ、近ければ背景として透明にする。
 * 以前は外周からのfloodfillで「紙とつながっている領域だけ」を背景にしていたが、
 * それだと わっか（輪っか・ドーナツ状の線）のように閉じた形の内側にある地の紙が
 * 外周と繋がらず、背景として抜けずに残ってしまう不具合があった（実写で確認済み）。
 * 目のハイライトのような小さな囲まれた白も同様に消えるようにはなるが、
 * 「閉じた形の中に紙が残る」方が実害が大きいと判断し、連結性は見ずに
 * 画素ごと独立に判定する。
 */
import { estimatePaperField, luminanceField } from './illum';

export interface RGB {
  r: number;
  g: number;
  b: number;
  /** どこからサンプルしたか（そこでの照明の明るさを基準点にするため）。 */
  x?: number;
  y?: number;
}

/**
 * 4辺のまん中の小さいパッチをサンプリングして紙の色を推定する。
 * 角は台形補正でマーカーの残りがにじむことがあるので避け、4パッチのうち
 * 一番明るい（＝絵の具が乗っていなさそうな）ものを採用する。
 */
export function estimatePaperColor(img: ImageData): RGB {
  const { width: w, height: h, data } = img;
  const half = Math.max(1, Math.round(Math.min(w, h) * 0.025));
  const centers: [number, number][] = [
    [Math.floor(w / 2), half], // 上辺まん中
    [Math.floor(w / 2), h - 1 - half], // 下辺まん中
    [half, Math.floor(h / 2)], // 左辺まん中
    [w - 1 - half, Math.floor(h / 2)], // 右辺まん中
  ];
  let best: RGB = { r: 255, g: 255, b: 255, x: Math.floor(w / 2), y: half };
  let bestLum = -1;
  for (const [cx, cy] of centers) {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let dy = -half; dy <= half; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= h) continue;
      for (let dx = -half; dx <= half; dx++) {
        const x = cx + dx;
        if (x < 0 || x >= w) continue;
        const i = (y * w + x) * 4;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
    }
    if (n === 0) continue;
    const avg = { r: r / n, g: g / n, b: b / n, x: cx, y: cy };
    const lum = 0.299 * avg.r + 0.587 * avg.g + 0.114 * avg.b;
    if (lum > bestLum) {
      bestLum = lum;
      best = avg;
    }
  }
  return best;
}

function dist3(dr: number, dg: number, db: number): number {
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export interface BgRemoveOptions {
  /**
   * 「ちゃんとした絵の線・色」とみなす最低限の紙色との差（0..441）。
   * これ未満の差しか周りに無い場所は、紙のムラ・ノイズとして透明にする。
   */
  threshold?: number;
}

/** 最大値フィルタ（半径 r の正方窓）。分離可能なので高速。 */
function maxFilter(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      for (let xx = x0; xx <= x1; xx++) if (src[y * w + xx] > m) m = src[y * w + xx];
      tmp[y * w + x] = m;
    }
  }
  const out = new Float32Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = 0;
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(h - 1, y + r);
      for (let yy = y0; yy <= y1; yy++) if (tmp[yy * w + x] > m) m = tmp[yy * w + x];
      out[y * w + x] = m;
    }
  }
  return out;
}

/**
 * 紙の背景を透明にし、絵（線・色）だけを残す。
 *
 * 1. 各画素について「その場所に紙があったら何色に見えるはずか」を大きな箱ぼかしで予測し
 *    （影があってもなだらかに追従）、実際の画素との色の差 d を出す。
 * 2. 差 d を「その近く（5x5）で一番はっきりしたインクの差」で割って 0〜1 の不透明度にする。
 *    → 線の縁は“どれだけ線にかかっているか”に比例した半透明になり、細い線が太らず、
 *      薄い色の絵でも（その絵の中で相対的に）ちゃんと残る。
 *    近くに「はっきりした差」が無い場所（紙のムラ・ノイズ）は 0（透明）。
 * 3. 縁は紙色が混ざっているので、混ざった紙色を引き算して本来のインクの色に戻す
 *    （透明な背景に置いたときの白いふちどりを無くす）。
 * 4. 孤立した小さなゴミ（ノイズの点）を消す。
 *
 * 連結性は見ない（わっか等、閉じた形の内側の紙もちゃんと透明になる）。
 */
export function removeBackground(img: ImageData, paper: RGB, opts: BgRemoveOptions = {}): ImageData {
  const { width: w, height: h, data } = img;
  const tCore = opts.threshold ?? 30;
  const tLow = Math.max(6, tCore * 0.4);
  const n = w * h;

  // 紙の明るさの場（影に追従、絵の線・塗りには引きずられない）
  const illum = estimatePaperField(img);

  // 紙の「色味」は、画面全体の“紙っぽい画素”（その場所の紙の明るさとほぼ同じ明るさの画素）の
  // 色／明るさ の中央値から取る。辺の中央のサンプルだけに頼ると、そこに絵の線がかかった
  // 時に紙色が汚れ、広い範囲が「ずれた紙色」に対して半透明で残ってしまう。
  const chroma = estimatePaperChroma(data, illum, n) ?? {
    r: paper.r / Math.max(24, 0.299 * paper.r + 0.587 * paper.g + 0.114 * paper.b),
    g: paper.g / Math.max(24, 0.299 * paper.r + 0.587 * paper.g + 0.114 * paper.b),
    b: paper.b / Math.max(24, 0.299 * paper.r + 0.587 * paper.g + 0.114 * paper.b),
  };

  const pred = new Float32Array(n * 3);
  const d = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const f = Math.max(24, illum[p]);
    const pr = Math.min(255, f * chroma.r);
    const pg = Math.min(255, f * chroma.g);
    const pb = Math.min(255, f * chroma.b);
    pred[p * 3] = pr;
    pred[p * 3 + 1] = pg;
    pred[p * 3 + 2] = pb;
    const i = p * 4;
    d[p] = dist3(data[i] - pr, data[i + 1] - pg, data[i + 2] - pb);
  }

  // 近く（5x5）で一番はっきりしたインクの差
  const dMax = maxFilter(d, w, h, 2);
  const alpha = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    if (dMax[p] < tCore) continue; // 近くにはっきりした絵が無い＝紙のムラ・ノイズ
    alpha[p] = Math.max(0, Math.min(1, (d[p] - tLow) / (dMax[p] - tLow)));
  }

  removeSpecks(alpha, w, h, Math.max(12, Math.round(n * 0.00005)));
  // 窓より大きい塗りつぶしは中心が「紙」と誤認されて穴になるので、広い範囲の紙の明るさと
  // 比べて明らかに暗い“囲まれた穴”は塗りつぶしの中身として不透明に戻す。
  fillInkHoles(alpha, luminanceField(img), estimatePaperField(img, 0.3), w, h);

  const out = new Uint8ClampedArray(n * 4);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const a = alpha[p];
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    if (a > 0.15 && a < 0.98) {
      // C = a*I + (1-a)*P  →  I = (C - (1-a)*P) / a
      r = (r - (1 - a) * pred[p * 3]) / a;
      g = (g - (1 - a) * pred[p * 3 + 1]) / a;
      b = (b - (1 - a) * pred[p * 3 + 2]) / a;
    }
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = Math.round(a * 255);
  }
  return { data: out, width: w, height: h, colorSpace: 'srgb' } as ImageData;
}

/** 4近傍でつながった「ほぼ不透明でない」かたまりのうち、小さいものを消す。 */
function removeSpecks(alpha: Float32Array, w: number, h: number, minSize: number): void {
  const n = w * h;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  const members = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (seen[s] || alpha[s] < 0.08) continue;
    let sp = 0;
    let m = 0;
    stack[sp++] = s;
    seen[s] = 1;
    while (sp > 0) {
      const p = stack[--sp];
      members[m++] = p;
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0 && !seen[p - 1] && alpha[p - 1] >= 0.08) {
        seen[p - 1] = 1;
        stack[sp++] = p - 1;
      }
      if (x < w - 1 && !seen[p + 1] && alpha[p + 1] >= 0.08) {
        seen[p + 1] = 1;
        stack[sp++] = p + 1;
      }
      if (y > 0 && !seen[p - w] && alpha[p - w] >= 0.08) {
        seen[p - w] = 1;
        stack[sp++] = p - w;
      }
      if (y < h - 1 && !seen[p + w] && alpha[p + w] >= 0.08) {
        seen[p + w] = 1;
        stack[sp++] = p + w;
      }
    }
    if (m < minSize) for (let k = 0; k < m; k++) alpha[members[k]] = 0;
  }
}

/** 紙っぽい画素（明るさが紙の場の93%以上）の「色／明るさ」の比の、チャンネルごとの中央値。 */
function estimatePaperChroma(
  data: Uint8ClampedArray,
  illum: Float32Array,
  n: number,
): { r: number; g: number; b: number } | null {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const step = Math.max(1, Math.floor(n / 20000));
  for (let p = 0; p < n; p += step) {
    const i = p * 4;
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const f = illum[p];
    if (f < 40 || lum < f * 0.93) continue;
    rs.push(data[i] / lum);
    gs.push(data[i + 1] / lum);
    bs.push(data[i + 2] / lum);
  }
  if (rs.length < 50) return null;
  const med = (a: number[]) => a.sort((x, y) => x - y)[a.length >> 1];
  return { r: med(rs), g: med(gs), b: med(bs) };
}

/**
 * 外周に触れていない透明なかたまり（穴）のうち、広域の紙の明るさ big に対して
 * 平均の明るさが7割未満のものを不透明に戻す（大きな塗りつぶしの中心）。
 * わっかの内側の紙は紙の明るさなので影響しない。
 */
function fillInkHoles(alpha: Float32Array, lum: Float32Array, big: Float32Array, w: number, h: number): void {
  const n = w * h;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  const members = new Int32Array(n);
  const minSize = Math.max(40, Math.round(n * 0.0008));
  for (let s = 0; s < n; s++) {
    if (seen[s] || alpha[s] >= 0.1) continue;
    let sp = 0;
    let m = 0;
    let touchesBorder = false;
    let ratioSum = 0;
    stack[sp++] = s;
    seen[s] = 1;
    while (sp > 0) {
      const p = stack[--sp];
      members[m++] = p;
      ratioSum += lum[p] / Math.max(24, big[p]);
      const x = p % w;
      const y = (p - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBorder = true;
      if (x > 0 && !seen[p - 1] && alpha[p - 1] < 0.1) {
        seen[p - 1] = 1;
        stack[sp++] = p - 1;
      }
      if (x < w - 1 && !seen[p + 1] && alpha[p + 1] < 0.1) {
        seen[p + 1] = 1;
        stack[sp++] = p + 1;
      }
      if (y > 0 && !seen[p - w] && alpha[p - w] < 0.1) {
        seen[p - w] = 1;
        stack[sp++] = p - w;
      }
      if (y < h - 1 && !seen[p + w] && alpha[p + w] < 0.1) {
        seen[p + w] = 1;
        stack[sp++] = p + w;
      }
    }
    if (touchesBorder || m < minSize) continue;
    if (ratioSum / m < 0.7) for (let k = 0; k < m; k++) alpha[members[k]] = 1;
  }
}
