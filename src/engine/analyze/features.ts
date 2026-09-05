/**
 * 切り抜き済み画像（ImageData）から特徴量を取り出す。
 * すべてブラウザ内・同期処理。Vitest では合成した ImageData で検証できる。
 */

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FeatureVector {
  /** インク（非白・非透明）画素数。 */
  inkCount: number;
  /** 画像全体に対するインクの占有率 0..1。 */
  coverage: number;
  bbox: BBox;
  /** バウンディングボックスの縦横比 w/h。>1で横長、<1で縦長。 */
  aspect: number;
  /** 主要色相 0..360。 */
  dominantHue: number;
  /** 平均彩度 0..1。 */
  saturation: number;
  /** 平均明度 0..1。 */
  value: number;
  /** 目立つ色の数 1..6。 */
  colorCount: number;
  /** 左右対称性 0..1（1で完全対称）。 */
  symmetry: number;
  /** 輪郭のとがり具合 0..1（1でトゲトゲ）。 */
  spikiness: number;
  /** バウンディングボックス内の充填率 0..1（低い＝細い・すきま多い）。 */
  fillDensity: number;
  /** 上半分にある小さな暗い塊の数（目の proxy）。0..6。 */
  eyeSpots: number;
}

const WHITE_CUTOFF = 236;
const ALPHA_CUTOFF = 24;
const HUE_BUCKETS = 24;

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

function isInk(r: number, g: number, b: number, a: number): boolean {
  if (a < ALPHA_CUTOFF) return false;
  return !(r >= WHITE_CUTOFF && g >= WHITE_CUTOFF && b >= WHITE_CUTOFF);
}

export function extractFeatures(img: ImageData): FeatureVector {
  const { data, width: w, height: h } = img;

  let inkCount = 0;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let sumS = 0;
  let sumV = 0;
  const hueWeight = new Float64Array(HUE_BUCKETS);
  // 低解像度のインクマスク（対称性・とがり具合用）
  const MASK = 48;
  const mask = new Uint8Array(MASK * MASK);
  const darkMask = new Uint8Array(MASK * MASK);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (!isInk(r, g, b, a)) continue;

      inkCount++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      const [hue, s, v] = rgbToHsv(r, g, b);
      sumS += s;
      sumV += v;
      // 彩度で強く重み付け（グレー・黒はほぼ票を持たない → 色相判定を歪めない）
      const bucket = Math.min(HUE_BUCKETS - 1, Math.floor((hue / 360) * HUE_BUCKETS));
      hueWeight[bucket] += s * s * s + 0.004;

      const mx = Math.min(MASK - 1, Math.floor((x / w) * MASK));
      const my = Math.min(MASK - 1, Math.floor((y / h) * MASK));
      mask[my * MASK + mx] = 1;
      if (v < 0.42 && s < 0.5) darkMask[my * MASK + mx] = 1;
    }
  }

  if (inkCount === 0) {
    // 空白画像でも破綻しないデフォルト
    return {
      inkCount: 0,
      coverage: 0,
      bbox: { x: 0, y: 0, w, h },
      aspect: 1,
      dominantHue: 0,
      saturation: 0,
      value: 0,
      colorCount: 1,
      symmetry: 1,
      spikiness: 0,
      fillDensity: 0,
      eyeSpots: 0,
    };
  }

  const bbox: BBox = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  const aspect = bbox.w / Math.max(1, bbox.h);
  const coverage = inkCount / (w * h);
  const saturation = sumS / inkCount;
  const value = sumV / inkCount;

  // 主要色相 = 重み最大バケットの中心
  let bestBucket = 0;
  let bestWeight = -1;
  let totalWeight = 0;
  for (let i = 0; i < HUE_BUCKETS; i++) {
    totalWeight += hueWeight[i];
    if (hueWeight[i] > bestWeight) {
      bestWeight = hueWeight[i];
      bestBucket = i;
    }
  }
  const dominantHue = ((bestBucket + 0.5) / HUE_BUCKETS) * 360;

  // 目立つ色の数 = 全体の12%以上の重みを持つバケット数
  let colorCount = 0;
  for (let i = 0; i < HUE_BUCKETS; i++) {
    if (totalWeight > 0 && hueWeight[i] / totalWeight >= 0.12) colorCount++;
  }
  colorCount = Math.min(6, Math.max(1, colorCount));

  // 対称性：左半分と、右半分を反転したものの一致率
  let symMatch = 0;
  let symTotal = 0;
  for (let my = 0; my < MASK; my++) {
    for (let mx = 0; mx < MASK / 2; mx++) {
      const left = mask[my * MASK + mx];
      const right = mask[my * MASK + (MASK - 1 - mx)];
      if (left || right) {
        symTotal++;
        if (left === right) symMatch++;
      }
    }
  }
  const symmetry = symTotal === 0 ? 1 : symMatch / symTotal;

  // とがり具合：周囲長^2 / 面積 の等周比。円で ~4π、ギザギザで増大。
  let perimeter = 0;
  let area = 0;
  for (let my = 0; my < MASK; my++) {
    for (let mx = 0; mx < MASK; mx++) {
      if (!mask[my * MASK + mx]) continue;
      area++;
      const up = my > 0 ? mask[(my - 1) * MASK + mx] : 0;
      const dn = my < MASK - 1 ? mask[(my + 1) * MASK + mx] : 0;
      const lf = mx > 0 ? mask[my * MASK + (mx - 1)] : 0;
      const rt = mx < MASK - 1 ? mask[my * MASK + (mx + 1)] : 0;
      if (!up || !dn || !lf || !rt) perimeter++;
    }
  }
  const iso = area > 0 ? (perimeter * perimeter) / area : 0;
  // iso: おおよそ 12(なめらか) 〜 60+(ギザギザ)。0..1 に正規化。
  const spikiness = clamp01((iso - 12) / 40);

  // 充填率：マスク上のインクセル数 / バウンディングボックスのセル数
  const bx0 = Math.floor((bbox.x / w) * MASK);
  const by0 = Math.floor((bbox.y / h) * MASK);
  const bx1 = Math.min(MASK, Math.ceil(((bbox.x + bbox.w) / w) * MASK));
  const by1 = Math.min(MASK, Math.ceil(((bbox.y + bbox.h) / h) * MASK));
  const bboxCells = Math.max(1, (bx1 - bx0) * (by1 - by0));
  const fillDensity = clamp01(area / bboxCells);

  // 目の proxy：上半分の暗い小さな塊を数える（連結成分、サイズ上限あり）
  const eyeSpots = countSmallBlobs(darkMask, MASK, 0, Math.floor(MASK * 0.6), 18);

  return {
    inkCount,
    coverage,
    bbox,
    aspect,
    dominantHue,
    saturation,
    value,
    colorCount,
    symmetry,
    spikiness,
    fillDensity,
    eyeSpots,
  };
}

/** 指定領域内の連結成分のうち、面積が maxSize 以下のものを数える。 */
function countSmallBlobs(m: Uint8Array, size: number, y0: number, y1: number, maxSize: number): number {
  const seen = new Uint8Array(size * size);
  let count = 0;
  const stack: number[] = [];
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < size; x++) {
      const start = y * size + x;
      if (!m[start] || seen[start]) continue;
      let area = 0;
      stack.length = 0;
      stack.push(start);
      seen[start] = 1;
      let touchedEdge = false;
      while (stack.length) {
        const p = stack.pop()!;
        area++;
        const px = p % size;
        const py = (p / size) | 0;
        if (py <= y0 || py >= y1 - 1) touchedEdge = true;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || nx >= size || ny < y0 || ny >= y1) continue;
          const np = ny * size + nx;
          if (m[np] && !seen[np]) {
            seen[np] = 1;
            stack.push(np);
          }
        }
      }
      if (area >= 1 && area <= maxSize && !touchedEdge) count++;
    }
  }
  return Math.min(6, count);
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
