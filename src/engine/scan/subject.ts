/**
 * 背景を消したあとの 画像から「描いた絵」だけを のこす。
 *  ・近くの 線どうしを つなげて（ふくらませて）かたまりに分け、
 *  ・まんなかに近い いちばん大きな かたまり＝絵の本体 を えらび、
 *  ・本体の 近くに ある かたまり（目・かざり・はなれた パーツ）と、大きくて ふちに さわらない かたまりは のこす。
 *  ・ふちに さわる もの（紙の はし・つくえ・ペン）や、本体から はなれた 小さな もの（けしゴム・ゴミ）は 消す。
 * そのあと 絵が わくいっぱいに なるよう、絵の まわりで 切りぬいて 拡大する。
 */
export function isolateSubject(img: ImageData, opts: { fit?: boolean } = {}): ImageData {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const ink = new Uint8Array(n);
  let inkTotal = 0;
  for (let p = 0; p < n; p++) {
    if (data[p * 4 + 3] > 64) {
      ink[p] = 1;
      inkTotal++;
    }
  }
  if (inkTotal === 0) return img;

  // 近くの 線を つなげる（たて・よこに 最大値フィルター）
  const r = Math.max(3, Math.round(Math.min(w, h) * 0.025));
  const dil = dilate(ink, w, h, r);

  // かたまりに 分ける
  const label = new Int32Array(n).fill(-1);
  const comps: { ink: number; x0: number; y0: number; x1: number; y1: number; sx: number; sy: number; border: boolean }[] = [];
  const stack = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (!dil[s] || label[s] >= 0) continue;
    const id = comps.length;
    const c = { ink: 0, x0: w, y0: h, x1: 0, y1: 0, sx: 0, sy: 0, border: false };
    let sp = 0;
    stack[sp++] = s;
    label[s] = id;
    while (sp > 0) {
      const p = stack[--sp];
      const x = p % w;
      const y = (p - x) / w;
      if (ink[p]) {
        c.ink++;
        c.sx += x;
        c.sy += y;
        if (x < c.x0) c.x0 = x;
        if (x > c.x1) c.x1 = x;
        if (y < c.y0) c.y0 = y;
        if (y > c.y1) c.y1 = y;
        if (x <= 1 || y <= 1 || x >= w - 2 || y >= h - 2) c.border = true;
      }
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) {
        if (q >= 0 && dil[q] && label[q] < 0) {
          label[q] = id;
          stack[sp++] = q;
        }
      }
    }
    comps.push(c);
  }
  if (comps.length === 0) return img;

  // 本体：インクが 多く、まんなかに 近い かたまり
  const cx = w / 2;
  const cy = h / 2;
  const half = Math.hypot(w, h) / 2;
  let main = 0;
  let best = -1;
  comps.forEach((c, i) => {
    if (c.ink === 0) return;
    const d = Math.hypot(c.sx / c.ink - cx, c.sy / c.ink - cy) / half;
    const score = c.ink * (1 - 0.7 * d) * (c.border ? 0.35 : 1);
    if (score > best) {
      best = score;
      main = i;
    }
  });
  const m = comps[main];
  const padX = (m.x1 - m.x0) * 0.15 + w * 0.02;
  const padY = (m.y1 - m.y0) * 0.15 + h * 0.02;
  const keep = comps.map((c, i) => {
    if (i === main) return true;
    if (c.ink === 0) return false;
    const near = c.x1 >= m.x0 - padX && c.x0 <= m.x1 + padX && c.y1 >= m.y0 - padY && c.y0 <= m.y1 + padY;
    if (near && !c.border) return true;
    // 本体と おなじくらい 大きく、ふちに さわらない もの（2ひき 描いた とき など）
    return !c.border && c.ink >= m.ink * 0.25;
  });

  const out = new Uint8ClampedArray(data);
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let p = 0; p < n; p++) {
    const a = out[p * 4 + 3];
    if (a === 0) continue;
    const l = label[p];
    if (l < 0 || !keep[l]) {
      out[p * 4 + 3] = 0;
      continue;
    }
    const x = p % w;
    const y = (p - x) / w;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const cleaned = { data: out, width: w, height: h, colorSpace: 'srgb' } as ImageData;
  if (opts.fit === false || x1 < 0) return cleaned;
  return fitToFrame(cleaned, x0, y0, x1, y1);
}

/** 絵の まわり（よゆう 8%）で 正方形に 切りぬいて、もとの 大きさに 拡大する（最大 2.5ばい）。 */
function fitToFrame(img: ImageData, x0: number, y0: number, x1: number, y1: number): ImageData {
  const { width: w, height: h, data } = img;
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  let side = Math.max(bw, bh) * 1.16;
  side = Math.max(side, Math.min(w, h) / 2.5);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const sx0 = cx - side / 2;
  const sy0 = cy - side / 2;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.floor(sy0 + ((y + 0.5) * side) / h);
    if (sy < 0 || sy >= h) continue;
    for (let x = 0; x < w; x++) {
      const sx = Math.floor(sx0 + ((x + 0.5) * side) / w);
      if (sx < 0 || sx >= w) continue;
      const si = (sy * w + sx) * 4;
      const di = (y * w + x) * 4;
      out[di] = data[si];
      out[di + 1] = data[si + 1];
      out[di + 2] = data[si + 2];
      out[di + 3] = data[si + 3];
    }
  }
  return { data: out, width: w, height: h, colorSpace: 'srgb' } as ImageData;
}

/** 2値画像を 半径 r だけ ふくらませる（たて・よこ 別々に）。 */
function dilate(src: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let run = -1e9;
    for (let x = 0; x < w; x++) {
      if (src[y * w + x]) run = x;
      if (x - run <= r) tmp[y * w + x] = 1;
    }
    run = 1e9;
    for (let x = w - 1; x >= 0; x--) {
      if (src[y * w + x]) run = x;
      if (run - x <= r) tmp[y * w + x] = 1;
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let run = -1e9;
    for (let y = 0; y < h; y++) {
      if (tmp[y * w + x]) run = y;
      if (y - run <= r) out[y * w + x] = 1;
    }
    run = 1e9;
    for (let y = h - 1; y >= 0; y--) {
      if (tmp[y * w + x]) run = y;
      if (run - y <= r) out[y * w + x] = 1;
    }
  }
  return out;
}
