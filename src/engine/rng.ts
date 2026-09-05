/**
 * 決定論的な乱数まわり。
 * 「同じ絵なら必ず同じキャラになる」を保証するため、解析は必ずこのシード付きRNGを通す。
 */

export type Rng = () => number;

/** mulberry32 — 軽量・高速な32bit seeded PRNG。 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** [min, max] の整数を返す。 */
export function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** 配列からランダムに1つ。 */
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** rng() < p で true。 */
export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

/**
 * 画像データ（またはバイト列）から安定したシード値を作る。
 * FNV-1a 32bit。全画素を舐めると重いので最大 stride 間隔でサンプリング。
 */
export function hashBytes(bytes: ArrayLike<number>, stride = 97): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i += stride) {
    h ^= bytes[i] & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  // 長さも混ぜる
  h ^= bytes.length;
  h = Math.imul(h, 0x01000193);
  return h >>> 0;
}

/** 文字列 → 32bit シード（テスト・CPU生成用）。 */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
