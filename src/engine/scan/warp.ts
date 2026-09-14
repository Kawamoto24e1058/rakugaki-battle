/**
 * 4点対応からの射影変換（ホモグラフィ）。用紙のマーカー4点 → まっすぐな正方形へ。
 * OpenCV等に頼らず自前実装（オフライン・依存ゼロを維持）。
 */

export interface Point {
  x: number;
  y: number;
}

/** n×n 連立方程式をガウス消去法（部分ピボット）で解く。 */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const pv = M[col][col];
    if (Math.abs(pv) < 1e-12) continue; // 特異に近い→そのまま進める（呼び出し側でフォールバック）
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / pv;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[n] / row[i]));
}

/**
 * dst の4点（出力側の正方形の四隅）→ src の4点（写真内で検出した四隅）へのホモグラフィ。
 * 戻り値 H=[a,b,c,d,e,f,g,h] で、src = ( (a*x+b*y+c)/(g*x+h*y+1), (d*x+e*y+f)/(g*x+h*y+1) )。
 */
export function computeHomography(dst: [Point, Point, Point, Point], src: [Point, Point, Point, Point]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = dst[i];
    const { x: xp, y: yp } = src[i];
    A.push([x, y, 1, 0, 0, 0, -x * xp, -y * xp]);
    b.push(xp);
    A.push([0, 0, 0, x, y, 1, -x * yp, -y * yp]);
    b.push(yp);
  }
  const [a, bb, c, d, e, f, g, h] = solveLinear(A, b);
  return [a, bb, c, d, e, f, g, h];
}

export function applyHomography(H: number[], x: number, y: number): Point {
  const [a, b, c, d, e, f, g, h] = H;
  const denom = g * x + h * y + 1;
  if (Math.abs(denom) < 1e-9) return { x: 0, y: 0 };
  return { x: (a * x + b * y + c) / denom, y: (d * x + e * y + f) / denom };
}

function sampleBilinear(img: ImageData, sx: number, sy: number): [number, number, number, number] {
  const w = img.width;
  const h = img.height;
  const cx = Math.min(Math.max(sx, 0), w - 1);
  const cy = Math.min(Math.max(sy, 0), h - 1);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const at = (px: number, py: number) => {
    const i = (py * w + px) * 4;
    return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
  };
  const p00 = at(x0, y0);
  const p10 = at(x1, y0);
  const p01 = at(x0, y1);
  const p11 = at(x1, y1);
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) {
    const top = p00[k] * (1 - fx) + p10[k] * fx;
    const bot = p01[k] * (1 - fx) + p11[k] * fx;
    out[k] = top * (1 - fy) + bot * fy;
  }
  return out;
}

/** dst空間（outW×outH）の各ピクセルを H で src へ逆写像し、双線形サンプリングして書き出す。 */
export function warpPerspective(src: ImageData, H: number[], outW: number, outH: number): ImageData {
  const data = new Uint8ClampedArray(outW * outH * 4);
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const { x: sx, y: sy } = applyHomography(H, x, y);
      const [r, g, b, a] = sampleBilinear(src, sx, sy);
      const i = (y * outW + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return { data, width: outW, height: outH, colorSpace: 'srgb' } as ImageData;
}
