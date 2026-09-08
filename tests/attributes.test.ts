import { describe, expect, it } from 'vitest';
import {
  attributeMatchup,
  attributeStatusMult,
  ATTR_STATUS_STRONG,
  ATTR_STATUS_WEAK,
} from '../src/engine/attributes';

describe('属性相性（状態異常の入りやすさ・ダメージ倍率なし）', () => {
  it('火 → 木 は 得意（状態異常が入りやすい）', () => {
    expect(attributeMatchup('fire', 'wood')).toBe('strong');
    expect(attributeStatusMult('fire', 'wood')).toBe(ATTR_STATUS_STRONG);
  });
  it('木 → 火 は 苦手（入りにくい）', () => {
    expect(attributeMatchup('wood', 'fire')).toBe('weak');
    expect(attributeStatusMult('wood', 'fire')).toBe(ATTR_STATUS_WEAK);
  });
  it('三すくみは 火→木→水→火 で閉じる', () => {
    expect(attributeMatchup('wood', 'water')).toBe('strong');
    expect(attributeMatchup('water', 'fire')).toBe('strong');
  });
  it('雷・闇 は相性なし（等倍）', () => {
    expect(attributeStatusMult('bolt', 'water')).toBe(1);
    expect(attributeStatusMult('dark', 'fire')).toBe(1);
    expect(attributeStatusMult('fire', 'bolt')).toBe(1);
    expect(attributeStatusMult('bolt', 'dark')).toBe(1);
  });
  it('同属性は等倍', () => {
    expect(attributeStatusMult('fire', 'fire')).toBe(1);
    expect(attributeMatchup('fire', 'fire')).toBe('even');
  });
});
