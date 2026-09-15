/**
 * 照明ムラ（影）に強くするための共通ユーティリティ。
 * 大きめの半径の箱ぼかし＝「その場所はどれくらい明るいか」の推定に使う。
 *
 * 重要：これでピクセル値そのものを書き換えると、キャラが写り込む範囲が
 * 半径よりあまり大きくない場合に「ぼかしにキャラ自身の色が混ざる」→
 * 「キャラの色を紙の明るさで割り戻して白っぽく飛ばしてしまう」という
 * 事故が起きる（実写で確認済み）。なので判定の「ものさし」としてだけ使い、
 * 出力される実際の色（data）は一切変更しない。
 */

/** 1次元の箱ぼかし（累積和ベース、端は縮む窓で自然にクランプ）。 */
export function boxBlur1D(src: Float32Array, length: number, radius: number): Float32Array {
  const prefix = new Float64Array(length + 1);
  for (let i = 0; i < length; i++) prefix[i + 1] = prefix[i] + src[i];
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const lo = Math.max(0, i - radius);
    const hi = Math.min(length - 1, i + radius);
    out[i] = (prefix[hi + 1] - prefix[lo]) / (hi - lo + 1);
  }
  return out;
}

export function boxBlur2D(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const row = new Float32Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) row[x] = src[y * w + x];
    const blurred = boxBlur1D(row, w, radius);
    for (let x = 0; x < w; x++) tmp[y * w + x] = blurred[x];
  }
  const out = new Float32Array(w * h);
  const col = new Float32Array(h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) col[y] = tmp[y * w + x];
    const blurred = boxBlur1D(col, h, radius);
    for (let y = 0; y < h; y++) out[y * w + x] = blurred[y];
  }
  return out;
}

/** 画素ごとの明度（0..255）。 */
export function luminanceField(img: ImageData): Float32Array {
  const { width: w, height: h, data } = img;
  const out = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    out[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return out;
}

/**
 * 「その場所はだいたいどれくらい明るいか」を大きめの箱ぼかしで推定する。
 * 絵の影響で局所的に歪むのは承知の上で、あくまで大局的な照明ムラ（影）を
 * 捉えるためのもの＝半径は十分大きく取る。
 */
export function estimateIlluminationField(img: ImageData, radiusFrac = 0.16): { field: Float32Array; mean: number } {
  const { width: w, height: h } = img;
  const radius = Math.max(6, Math.round(Math.min(w, h) * radiusFrac));
  const field = boxBlur2D(luminanceField(img), w, h, radius);
  let sum = 0;
  for (let i = 0; i < field.length; i++) sum += field[i];
  return { field, mean: sum / field.length };
}
