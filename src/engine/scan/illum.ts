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

/** 最大値(mode=1)／最小値(mode=-1)フィルタ（半径 r の正方窓）。 */
function rankFilter2D(src: Float32Array, w: number, h: number, r: number, mode: 1 | -1): Float32Array {
  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = -Infinity * mode;
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      for (let xx = x0; xx <= x1; xx++) {
        const v = src[y * w + xx];
        if (mode === 1 ? v > m : v < m) m = v;
      }
      tmp[y * w + x] = m;
    }
  }
  const out = new Float32Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = -Infinity * mode;
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(h - 1, y + r);
      for (let yy = y0; yy <= y1; yy++) {
        const v = tmp[yy * w + x];
        if (mode === 1 ? v > m : v < m) m = v;
      }
      out[y * w + x] = m;
    }
  }
  return out;
}

/** 最大値フィルタ（半径 r の正方窓）。 */
export function maxFilter2D(src: Float32Array, w: number, h: number, r: number): Float32Array {
  return rankFilter2D(src, w, h, r, 1);
}

/**
 * クロージング（最大値 → 同じ窓で最小値）。窓より細い暗い線・小さい暗い塗りだけを
 * 消し、なだらかな明暗の傾き（影）はそのまま残す。
 */
export function closeFilter2D(src: Float32Array, w: number, h: number, r: number): Float32Array {
  return rankFilter2D(rankFilter2D(src, w, h, r, 1), w, h, r, -1);
}

/**
 * 「紙そのものの明るさ」の場を推定する（絵の線・塗りに引きずられにくい版）。
 * 平均ぼかしだと、濃い線が密集した所の周りで「紙の予測」が暗めに出てしまい、
 * 実際の紙との差が“絵”として残る（灰色のモヤ）。紙は局所的に一番明るいものなので、
 * ブロック平均 → クロージング（絵より大きい窓で 最大値→最小値。影の傾きは保たれ、
 * 絵の線・塗りだけが消える）→ なだらかにぼかす、で推定する。
 * （最大値だけだと、強い影の傾きで窓の明るい側を拾って予測が明るすぎになる）
 * 計算量を抑えるため 1/f に縮小した上で処理し、最後に双線形で戻す。
 */
export function estimatePaperField(img: ImageData, windowFrac = 0.09): Float32Array {
  const { width: w, height: h } = img;
  const lum = luminanceField(img);
  const f = Math.max(1, Math.round(Math.min(w, h) / 160));
  const sw = Math.ceil(w / f);
  const sh = Math.ceil(h / f);
  const small = new Float32Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      let sum = 0;
      let n = 0;
      for (let yy = y * f; yy < Math.min(h, (y + 1) * f); yy++) {
        for (let xx = x * f; xx < Math.min(w, (x + 1) * f); xx++) {
          sum += lum[yy * w + xx];
          n++;
        }
      }
      small[y * sw + x] = sum / n;
    }
  }
  const m = Math.min(sw, sh);
  const mx = closeFilter2D(small, sw, sh, Math.max(2, Math.round(m * windowFrac)));
  const sm = boxBlur2D(mx, sw, sh, Math.max(2, Math.round(m * 0.08)));
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(sh - 1, Math.max(0, (y + 0.5) / f - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(sw - 1, Math.max(0, (x + 0.5) / f - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(sw - 1, x0 + 1);
      const tx = fx - x0;
      out[y * w + x] =
        (sm[y0 * sw + x0] * (1 - tx) + sm[y0 * sw + x1] * tx) * (1 - ty) +
        (sm[y1 * sw + x0] * (1 - tx) + sm[y1 * sw + x1] * tx) * ty;
    }
  }
  return out;
}
