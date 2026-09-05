import { describe, expect, it } from 'vitest';
import { affinityMultiplier, AFFINITY_STRONG, AFFINITY_WEAK } from '../src/engine/attributes';

describe('属性相性', () => {
  it('火 → 木 は こうかばつぐん', () => {
    expect(affinityMultiplier('fire', 'wood')).toBe(AFFINITY_STRONG);
  });
  it('木 → 火 は いまひとつ', () => {
    expect(affinityMultiplier('wood', 'fire')).toBe(AFFINITY_WEAK);
  });
  it('三すくみは 火→木→水→火 で閉じる', () => {
    expect(affinityMultiplier('wood', 'water')).toBe(AFFINITY_STRONG);
    expect(affinityMultiplier('water', 'fire')).toBe(AFFINITY_STRONG);
  });
  it('雷・闇 は相性補正なし', () => {
    expect(affinityMultiplier('bolt', 'water')).toBe(1);
    expect(affinityMultiplier('dark', 'fire')).toBe(1);
    expect(affinityMultiplier('fire', 'bolt')).toBe(1);
    expect(affinityMultiplier('bolt', 'dark')).toBe(1);
  });
  it('同属性は等倍', () => {
    expect(affinityMultiplier('fire', 'fire')).toBe(1);
  });
});
