import { describe, expect, it } from 'vitest';
import { isolateSubject } from '../src/engine/scan/subject';

/** とうめいな 画像に 図形を 描く。 */
function canvas(w: number, h: number, shapes: ((x: number, y: number) => boolean)[]): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (shapes.some((f) => f(x, y))) {
        const i = (y * w + x) * 4;
        data[i] = 60;
        data[i + 1] = 60;
        data[i + 2] = 60;
        data[i + 3] = 255;
      }
  return { data, width: w, height: h, colorSpace: 'srgb' } as ImageData;
}
const alphaAt = (img: ImageData, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3];
const circle = (cx: number, cy: number, r: number) => (x: number, y: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const rect = (x0: number, y0: number, x1: number, y1: number) => (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

describe('切り抜き：絵の本体だけ のこす', () => {
  it('ふちに さわる もの（ペン・紙の はし）と はなれた 小さな ゴミは 消し、本体と 目は のこす', () => {
    const img = canvas(200, 200, [
      circle(100, 100, 40), // からだ
      circle(100, 52, 4), // からだの すぐ上の かざり（はなれているが 近い）
      rect(0, 10, 60, 14), // ふちに さわる ペン
      rect(180, 176, 199, 199), // ふちの けしゴム
      rect(20, 160, 25, 165), // はなれた 小さな ゴミ
    ]);
    const out = isolateSubject(img, { fit: false });
    expect(alphaAt(out, 100, 100)).toBe(255);
    expect(alphaAt(out, 100, 52)).toBe(255);
    expect(alphaAt(out, 30, 12)).toBe(0);
    expect(alphaAt(out, 190, 190)).toBe(0);
    expect(alphaAt(out, 22, 162)).toBe(0);
  });

  it('同じくらい 大きい 2ひきは どちらも のこす', () => {
    const img = canvas(200, 200, [circle(60, 100, 28), circle(145, 100, 28)]);
    const out = isolateSubject(img, { fit: false });
    expect(alphaAt(out, 60, 100)).toBe(255);
    expect(alphaAt(out, 145, 100)).toBe(255);
  });

  it('小さく 描いた 絵は わくいっぱいに 拡大される', () => {
    const img = canvas(200, 200, [circle(100, 100, 20)]);
    const out = isolateSubject(img);
    // もとは 半径20 → 拡大後は まんなかから 40 はなれた 所も 絵の中
    expect(alphaAt(out, 140, 100)).toBe(255);
    expect(alphaAt(out, 100, 100)).toBe(255);
  });
});

import { fillEnclosed } from '../src/engine/scan/subject';

describe('切り抜き：線で かこまれた 内がわを 白で うめる', () => {
  const ring = (cx: number, cy: number, r: number, t: number) => (x: number, y: number) => {
    const d = Math.hypot(x - cx, y - cy);
    return d <= r && d >= r - t;
  };
  it('とじた りんかくの 中は 白で うまり、外がわには 白い ふちが でない', () => {
    const out = fillEnclosed(canvas(200, 200, [ring(100, 100, 50, 4)]));
    expect(alphaAt(out, 100, 100)).toBe(255);
    expect(out.data[(100 * 200 + 100) * 4]).toBeGreaterThan(240);
    expect(alphaAt(out, 100, 44)).toBe(0); // 線の すぐ外
    expect(alphaAt(out, 10, 10)).toBe(0);
  });
  it('ひらいた 形（大きな すきま）は うめない', () => {
    // C の字（右がわが 大きく ひらいている）
    const c = (x: number, y: number) => ring(100, 100, 50, 4)(x, y) && x < 130;
    const out = fillEnclosed(canvas(200, 200, [c]));
    expect(alphaAt(out, 100, 100)).toBe(0);
  });
});
