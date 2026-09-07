import { describe, expect, it } from 'vitest';
import { getKosei, KOSEI_LIST } from '../src/engine';
import { analyzeImageData } from '../src/engine/analyze';
import { rectImage } from './helpers';

// バトル本体（力/技/速さ 三すくみ）のテストは tests/clash.test.ts。
// ここは「生成された技セット・こせい」の保証だけ。

function drawn(color: [number, number, number], w = 80, h = 90) {
  return analyzeImageData(rectImage(220, 220, w, h, color)).character;
}

describe('生成キャラの技セット・こせい', () => {
  it('キャラは5〜8個の技を持つ', () => {
    for (let seed = 0; seed < 30; seed++) {
      const c = drawn([(seed * 53) % 256, (seed * 97) % 256, (seed * 29) % 256], 40 + (seed % 60), 50 + (seed % 60));
      expect(c.moveIds.length).toBeGreaterThanOrEqual(5);
      expect(c.moveIds.length).toBeLessThanOrEqual(9); // カテゴリ保証で最大 +1
    }
  });

  it('技セットに治療系のわざが必ず入る', () => {
    const cures = ['ca_breath', 'ca_song', 'water_wash', 'fire_dry', 'u_detox', 'u_endure', 'ca_heal'];
    for (let seed = 0; seed < 40; seed++) {
      const c = drawn([(seed * 53) % 256, (seed * 97) % 256, (seed * 29) % 256], 50 + (seed % 50), 60 + (seed % 60));
      expect(c.moveIds.some((m) => cures.includes(m))).toBe(true);
    }
  });

  it('こせい：60種以上あり、生成キャラは必ず有効なこせいを持つ', () => {
    expect(KOSEI_LIST.length).toBeGreaterThanOrEqual(60);
    for (const a of ['fire', 'water', 'wood', 'bolt', 'dark']) {
      expect(KOSEI_LIST.some((k) => k.tags.includes(`attr:${a}`))).toBe(true);
    }
    for (let s = 0; s < 30; s++) {
      const c = drawn([(s * 53) % 256, (s * 97) % 256, (s * 29) % 256], 50 + (s % 50), 60 + (s % 60));
      expect(() => getKosei(c.koseiId)).not.toThrow();
    }
  });
});
