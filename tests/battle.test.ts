import { describe, expect, it } from 'vitest';
import { getKosei, KOSEI_LIST } from '../src/engine';
import { getMove, hasPriority, MOVES } from '../src/engine/moves';
import { analyzeImageData } from '../src/engine/analyze';
import { rectImage } from './helpers';

// バトル本体（手札方式）のテストは tests/clash.test.ts。
// ここは「技データ・こせい」の保証だけ。

function drawn(color: [number, number, number], w = 80, h = 90) {
  return analyzeImageData(rectImage(220, 220, w, h, color)).character;
}

describe('技データ・こせい', () => {
  it('どの技も 名前・説明があり、攻撃は威力あり／補助は何かしらの効果を持つ', () => {
    const ids = Object.keys(MOVES);
    expect(ids.length).toBeGreaterThanOrEqual(35);
    for (const m of Object.values(MOVES)) {
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.desc.length).toBeGreaterThan(0);
      if (m.category === 'attack') {
        expect(m.power).toBeGreaterThan(0);
      } else {
        const hasEffect = !!(m.buff || m.debuff || m.heal || m.cures || m.guardPct || m.reflect);
        expect(hasEffect).toBe(true);
      }
    }
  });

  it('名前の重複がない（手札に同じ名前が並ばない）', () => {
    const names = Object.values(MOVES).map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('手札の顔ぶれ：こうげき・まもり・かいふく・バフ・デバフ・先制・状態異常が すべてそろう', () => {
    const all = Object.values(MOVES);
    expect(all.some((m) => m.category === 'attack' && m.first)).toBe(true);
    expect(all.some((m) => m.guardPct)).toBe(true);
    expect(all.some((m) => m.reflect)).toBe(true);
    expect(all.some((m) => m.heal)).toBe(true);
    expect(all.some((m) => m.cures)).toBe(true);
    expect(all.some((m) => m.buff)).toBe(true);
    expect(all.some((m) => m.debuff)).toBe(true);
    expect(all.some((m) => m.status)).toBe(true);
    expect(all.some((m) => m.hits && m.hits > 1)).toBe(true);
    const supportShare = all.filter((m) => m.category === 'support').length / all.length;
    expect(supportShare).toBeGreaterThan(0.25);
    expect(supportShare).toBeLessThan(0.5);
  });

  it('先に動く技の判定（先制・ガード・カウンター・ぼうぎょアップ）', () => {
    expect(hasPriority(getMove('c_guard'))).toBe(true);
    expect(hasPriority(getMove('sm_dart'))).toBe(true);
    expect(hasPriority(getMove('sh_counter'))).toBe(true);
    expect(hasPriority(getMove('wood_root'))).toBe(true);
    expect(hasPriority(getMove('c_tackle'))).toBe(false);
    expect(hasPriority(getMove('ca_heal'))).toBe(false);
  });

  it('こせい：120種（24テンプレ×5属性）で全て 属性＋形タグを持つ・生成キャラは有効なこせい', () => {
    expect(KOSEI_LIST.length).toBe(120);
    for (const a of ['fire', 'water', 'wood', 'bolt', 'dark']) {
      expect(KOSEI_LIST.filter((k) => k.tags.includes(`attr:${a}`)).length).toBe(24);
    }
    for (const k of KOSEI_LIST) {
      expect(k.tags.some((t) => t.startsWith('shape:'))).toBe(true);
    }
    for (let s = 0; s < 30; s++) {
      const c = drawn([(s * 53) % 256, (s * 97) % 256, (s * 29) % 256], 50 + (s % 50), 60 + (s % 60));
      expect(() => getKosei(c.koseiId)).not.toThrow();
    }
  });
});
