/**
 * 背景を消したあとの 画像から「描いた絵」だけを のこす（用紙の マーカーが ない 写真 むけ）。
 *  1. 写真の ふちから みじかく 生えている もの（紙の はし・影・つくえ）を けずる
 *  2. ほそい 線を いったん のぞいた「ふとい ところ」で、近い ものどうしを かたまりに分け、
 *     まんなかに近い いちばん大きな かたまり＝絵の本体 を えらぶ
 *     （ほそい 線ごと 分けると、絵を かこむ わく線 や 影が 絵と ひとつに つながって ぜんぶ のこってしまう）
 *  3. 本体の 近くに ある かたまり（目・かざり・はなれた パーツ）と、大きくて ふちに さわらない かたまりは のこす。
 *     ふちに さわる もの（ペン）や、本体から はなれた 小さな もの（けしゴム・ゴミ）は 消す
 *  4. のこした かたまりを ぐるっと かこむ 形（凸包）の すこし 外まで だけ、ほそい 線も のこす
 *     （つえ・うで などの ほそい 線は のこり、外がわの わく線は 消える）
 * そのあと 絵が わくいっぱいに なるよう、絵の まわりで 切りぬいて 拡大する。
 */
export function isolateSubject(img: ImageData, opts: { fit?: boolean } = {}): ImageData {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const size = Math.min(w, h);
  const ink = new Uint8Array(n);
  let inkTotal = 0;
  for (let p = 0; p < n; p++) {
    if (data[p * 4 + 3] > 64) {
      ink[p] = 1;
      inkTotal++;
    }
  }
  if (inkTotal === 0) return img;

  const peeled = peelEdges(ink, w, h);
  let inkLeft = 0;
  for (let p = 0; p < n; p++) inkLeft += ink[p];
  if (inkLeft === 0) return img;

  // ふとい ところ（ほそい 線を のぞく）。線画だけの 絵で ほとんど のこらない ときは そのまま 使う
  const thin = Math.max(1, Math.round(size * 0.003));
  let core = dilate(erode(ink, w, h, thin), w, h, thin);
  let coreInk = 0;
  for (let p = 0; p < n; p++) if ((core[p] &= ink[p])) coreInk++;
  const lineArt = coreInk < inkLeft * 0.25;
  if (lineArt) core = ink;

  // 近くの ものを つなげる（たて・よこに 最大値フィルター）
  const r = Math.max(3, Math.round(size * 0.025));
  const dil = dilate(core, w, h, r);

  // かたまりに 分ける
  const { label, comps } = labelComponents(dil, core, w, h);
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
  // 写真の はしっこの 帯（12%）の 中だけに ある もの＝紙の 影・つくえの のこり
  const inEdgeBand = (c: Comp) => c.x1 < w * 0.12 || c.x0 > w * 0.88 || c.y1 < h * 0.12 || c.y0 > h * 0.88;
  const keep = comps.map((c, i) => {
    if (i === main) return true;
    if (c.ink === 0) return false;
    if (inEdgeBand(c)) return false;
    const near = c.x1 >= m.x0 - padX && c.x0 <= m.x1 + padX && c.y1 >= m.y0 - padY && c.y0 <= m.y1 + padY;
    if (near && !c.border) return true;
    // 本体と おなじくらい 大きく、まんなか あたりに ある もの（2ひき 描いた とき など）。
    // すみっこの けしゴム・テープなどは のこさない
    const ccx = c.sx / c.ink / w;
    const ccy = c.sy / c.ink / h;
    const central = ccx > 0.15 && ccx < 0.85 && ccy > 0.15 && ccy < 0.85;
    return !c.border && central && c.ink >= m.ink * 0.5;
  });

  // のこす 範囲：線画なら かたまり そのもの、ふつうは のこした ふとい ところの 凸包 ＋ すこし
  let region: Uint8Array;
  if (lineArt) {
    region = new Uint8Array(n);
    for (let p = 0; p < n; p++) if (label[p] >= 0 && keep[label[p]]) region[p] = 1;
  } else {
    // 凸包は ある ていど 大きい かたまり だけで つくる（わく線の ふとい きれはし で 広がらないように）
    const { label: rawL, comps: raw } = labelComponents(dilate(core, w, h, 1), core, w, h);
    const keptInk = comps.reduce((s, c, i) => s + (keep[i] ? c.ink : 0), 0);
    const kept = new Uint8Array(n);
    for (let p = 0; p < n; p++) {
      if (!core[p] || label[p] < 0 || !keep[label[p]]) continue;
      const rc = raw[rawL[p]];
      if (rc.ink >= keptInk * 0.005 && !inEdgeBand(rc)) kept[p] = 1;
    }
    const hull = convexHullMask(kept, w, h);
    region = dilate(hull, w, h, Math.round(size * 0.015));
    // 凸包の 外に はみ出した 線のうち、本体の ふとい ところに つながって いない きれはし（わく線の のこり）は 消す。
    // 凸包の 中の 小さな もの（目・もよう）や、本体から のびる ほそい 線（つの・しっぽ）は のこる
    const inReg = new Uint8Array(n);
    for (let p = 0; p < n; p++) if (ink[p] && region[p]) inReg[p] = 1;
    const { label: fl, comps: fc } = labelComponents(dilate(inReg, w, h, 1), inReg, w, h);
    const hasKept = new Uint8Array(fc.length);
    const inHull = new Int32Array(fc.length);
    for (let p = 0; p < n; p++) {
      const l = fl[p];
      if (l < 0 || !inReg[p]) continue;
      if (kept[p]) hasKept[l] = 1;
      if (hull[p]) inHull[l]++;
    }
    for (let p = 0; p < n; p++) {
      const l = fl[p];
      if (!region[p]) continue;
      if (l < 0 || (!hasKept[l] && inHull[l] < fc[l].ink * 0.5)) region[p] = 0;
    }
    // 範囲の 外へ のびる ほそい 線は、のこす 部分に つながっていて みじかい（18%まで）なら のこす
    // （ぼうの 手足・つの・しっぽ）。ぐるっと 長く まわる わく線は のこさない
    const base = new Uint8Array(n);
    for (let p = 0; p < n; p++) if (ink[p] && region[p]) base[p] = 1;
    const touch = dilate(base, w, h, 2);
    const extra = new Uint8Array(n);
    for (let p = 0; p < n; p++) if (ink[p] && !region[p]) extra[p] = 1;
    const extraMask = dilate(extra, w, h, 1);
    const { label: el, comps: ec } = labelComponents(extraMask, extra, w, h);
    const linked = new Uint8Array(ec.length);
    for (let p = 0; p < n; p++) if (extra[p] && touch[p] && el[p] >= 0) linked[el[p]] = 1;
    const longest = size * 0.18;
    for (let p = 0; p < n; p++) {
      const l = el[p];
      if (l < 0 || !linked[l]) continue;
      const c = ec[l];
      if (Math.max(c.x1 - c.x0, c.y1 - c.y0) <= longest) region[p] = 1;
    }
  }

  const out = new Uint8ClampedArray(data);
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let p = 0; p < n; p++) {
    const a = out[p * 4 + 3];
    if (a === 0) continue;
    if (!region[p] || (peeled[p] && !ink[p])) {
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

type Comp = { ink: number; x0: number; y0: number; x1: number; y1: number; sx: number; sy: number; border: boolean };

/** mask で つながる かたまりに 分ける（ink の 画素だけ 数える）。 */
function labelComponents(mask: Uint8Array, ink: Uint8Array, w: number, h: number): { label: Int32Array; comps: Comp[] } {
  const n = w * h;
  const label = new Int32Array(n).fill(-1);
  const comps: Comp[] = [];
  const stack = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (!mask[s] || label[s] >= 0) continue;
    const id = comps.length;
    const c: Comp = { ink: 0, x0: w, y0: h, x1: 0, y1: 0, sx: 0, sy: 0, border: false };
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
        if (q >= 0 && mask[q] && label[q] < 0) {
          label[q] = id;
          stack[sp++] = q;
        }
      }
    }
    comps.push(c);
  }
  return { label, comps };
}

/**
 * 写真の ふちから みじかく 生えている インク（紙の はし・影・つくえ・けしゴム）を けずる。
 * 各辺から 内がわへ 1行ずつ 見て、ふち近く（3%以内）から はじまる インクの つながりが
 * 15% より 手前で とぎれるなら それは ふちの ゴミとして 消す（長く のびる ペン などは のこして あとで 判定）。
 * ink は 書きかえる。消した 所（＋まわりの にじみ）の マスクを かえす。
 */
export function peelEdges(ink: Uint8Array, w: number, h: number): Uint8Array {
  const dropped = new Uint8Array(w * h);
  const scan = (len: number, at: (k: number) => number) => {
    const skip = Math.round(len * 0.03);
    const band = Math.round(len * 0.15);
    let k = 0;
    while (k <= skip && !ink[at(k)]) k++;
    if (k > skip) return;
    const start = k;
    let gap = 0;
    let end = k;
    for (; k < len; k++) {
      if (ink[at(k)]) {
        end = k;
        gap = 0;
      } else if (++gap > 1) break;
    }
    if (end >= band) return;
    for (let j = start; j <= end; j++) dropped[at(j)] = 1;
  };
  for (let y = 0; y < h; y++) {
    scan(w, (k) => y * w + k);
    scan(w, (k) => y * w + (w - 1 - k));
  }
  for (let x = 0; x < w; x++) {
    scan(h, (k) => k * w + x);
    scan(h, (k) => (h - 1 - k) * w + x);
  }
  let any = false;
  for (let p = 0; p < w * h; p++)
    if (dropped[p]) {
      ink[p] = 0;
      any = true;
    }
  if (!any) return dropped;
  // けずった 所に くっついていた 小さな のこり（影の きれはし など）も いっしょに 消す
  const fringe = dilate(dropped, w, h, 2);
  const { label, comps } = labelComponents(dilate(ink, w, h, 1), ink, w, h);
  const total = comps.reduce((s, c) => s + c.ink, 0);
  const touched = new Uint8Array(comps.length);
  for (let p = 0; p < w * h; p++) if (fringe[p] && ink[p] && label[p] >= 0) touched[label[p]] = 1;
  for (let p = 0; p < w * h; p++) {
    const l = label[p];
    if (ink[p] && l >= 0 && touched[l] && comps[l].ink < total * 0.05) {
      ink[p] = 0;
      fringe[p] = 1;
    }
  }
  return dilate(fringe, w, h, 1);
}

/** 2値画像を 半径 r だけ けずる（ふくらませるの 反対）。 */
function erode(src: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const inv = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) inv[p] = src[p] ? 0 : 1;
  const d = dilate(inv, w, h, r);
  for (let p = 0; p < w * h; p++) d[p] = d[p] ? 0 : 1;
  return d;
}

/** mask の 画素を ぜんぶ かこむ 凸包の 内がわを 1 に した マスク。 */
function convexHullMask(mask: Uint8Array, w: number, h: number): Uint8Array {
  // 各行の 左はし・右はし だけで 凸包は きまる
  const pts: [number, number][] = [];
  for (let y = 0; y < h; y++) {
    let a = -1;
    let b = -1;
    for (let x = 0; x < w; x++)
      if (mask[y * w + x]) {
        if (a < 0) a = x;
        b = x;
      }
    if (a >= 0) pts.push([a, y], [b, y]);
  }
  const out = new Uint8Array(w * h);
  if (pts.length === 0) return out;
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  // 行ごとに 凸包の 辺と まじわる x の 範囲を ぬる
  for (let y = 0; y < h; y++) {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < hull.length; i++) {
      const [ax, ay] = hull[i];
      const [bx, by] = hull[(i + 1) % hull.length];
      if ((y < ay && y < by) || (y > ay && y > by)) continue;
      const xs = ay === by ? [ax, bx] : [ax + ((y - ay) * (bx - ax)) / (by - ay)];
      for (const x of xs) {
        if (x < lo) lo = x;
        if (x > hi) hi = x;
      }
    }
    if (lo > hi) continue;
    for (let x = Math.max(0, Math.floor(lo)); x <= Math.min(w - 1, Math.ceil(hi)); x++) out[y * w + x] = 1;
  }
  return out;
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
export function dilate(src: Uint8Array, w: number, h: number, r: number): Uint8Array {
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

/** 2値画像を 半径 r の まるい 形で ふくらませる（チャンファー距離 3-4。四角く カクカク しない）。 */
export function dilateRound(src: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const INF = 1 << 20;
  const d = new Int32Array(w * h);
  for (let p = 0; p < w * h; p++) d[p] = src[p] ? 0 : INF;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      let v = d[p];
      if (v === 0) continue;
      if (x > 0) v = Math.min(v, d[p - 1] + 3);
      if (y > 0) {
        v = Math.min(v, d[p - w] + 3);
        if (x > 0) v = Math.min(v, d[p - w - 1] + 4);
        if (x < w - 1) v = Math.min(v, d[p - w + 1] + 4);
      }
      d[p] = v;
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const p = y * w + x;
      let v = d[p];
      if (v === 0) continue;
      if (x < w - 1) v = Math.min(v, d[p + 1] + 3);
      if (y < h - 1) {
        v = Math.min(v, d[p + w] + 3);
        if (x < w - 1) v = Math.min(v, d[p + w + 1] + 4);
        if (x > 0) v = Math.min(v, d[p + w - 1] + 4);
      }
      d[p] = v;
    }
  const out = new Uint8Array(w * h);
  const lim = r * 3;
  for (let p = 0; p < w * h; p++) if (d[p] <= lim) out[p] = 1;
  return out;
}

/**
 * 線で かこまれた 内がわ（白い からだ など）を 白で うめる。
 * 背景を 消すと 白い キャラが「線だけ」の すけた 絵に なるので、外から つながっていない すきまは からだの 中とみなす。
 *  1. 線を すこし ふくらませて 小さな すきまを とじる
 *  2. 画像の ふちから 透明な ところを たどれる 範囲＝そと
 *  3. そとを ふくらませた ぶん もどして（線の 外がわに 白い ふちが でないように）、のこりの 透明を 白で うめる
 */
export function fillEnclosed(img: ImageData, fill: [number, number, number] = [255, 253, 248]): ImageData {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const r = Math.max(2, Math.round(Math.min(w, h) * 0.015));
  const solid = new Uint8Array(n);
  // えんぴつの うすい 線でも かべに なるよう、うすめの 線も「線」として あつかう
  for (let p = 0; p < n; p++) if (data[p * 4 + 3] > 24) solid[p] = 1;
  const wall = dilateRound(solid, w, h, r);
  const outside = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const push = (p: number) => {
    if (!wall[p] && !outside[p]) {
      outside[p] = 1;
      stack[sp++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < n - w) push(p + w);
  }
  const out2 = dilateRound(outside, w, h, r + 1);
  const out = new Uint8ClampedArray(data);
  for (let p = 0; p < n; p++) {
    if (out2[p]) continue;
    const i = p * 4;
    const a = out[i + 3] / 255;
    if (a >= 0.999) continue;
    out[i] = Math.round(out[i] * a + fill[0] * (1 - a));
    out[i + 1] = Math.round(out[i + 1] * a + fill[1] * (1 - a));
    out[i + 2] = Math.round(out[i + 2] * a + fill[2] * (1 - a));
    out[i + 3] = 255;
  }
  return { data: out, width: w, height: h, colorSpace: 'srgb' } as ImageData;
}
