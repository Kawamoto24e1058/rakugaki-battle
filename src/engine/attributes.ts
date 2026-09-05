import type { Attribute } from './types';

export interface AttributeMeta {
  id: Attribute;
  jp: string;
  color: string; // UIアクセント
  /** メインカラー判定用の代表色相（HSVのH, 0-360）。 */
  hue: number;
}

export const ATTRIBUTE_META: Record<Attribute, AttributeMeta> = {
  // hue は「最近傍の色相アンカー」。赤〜橙=火、黄=雷、緑=木、青〜水色=水、紫〜赤紫=闇。
  fire: { id: 'fire', jp: '火', color: '#e8503a', hue: 12 },
  water: { id: 'water', jp: '水', color: '#3b82f6', hue: 210 },
  wood: { id: 'wood', jp: '木', color: '#1f9d63', hue: 130 },
  bolt: { id: 'bolt', jp: '雷', color: '#e0a90c', hue: 52 },
  dark: { id: 'dark', jp: '闇', color: '#7b5cf0', hue: 300 },
};

/**
 * 相性。三すくみは火→木→水→火 のみ。
 * key が value に対して有利（ダメージ増）。
 */
const STRONG_AGAINST: Partial<Record<Attribute, Attribute>> = {
  fire: 'wood',
  wood: 'water',
  water: 'fire',
};

export const AFFINITY_STRONG = 1.4;
export const AFFINITY_WEAK = 0.8;
export const AFFINITY_NEUTRAL = 1;

/** attacker属性 が defender属性 に与えるダメージ倍率。 */
export function affinityMultiplier(attacker: Attribute, defender: Attribute): number {
  if (STRONG_AGAINST[attacker] === defender) return AFFINITY_STRONG;
  if (STRONG_AGAINST[defender] === attacker) return AFFINITY_WEAK;
  return AFFINITY_NEUTRAL;
}

/** 相性関係を人が読める文字列に（リビール・バトルログ用）。 */
export function affinityLabel(mult: number): 'こうかばつぐん' | 'いまひとつ' | 'ふつう' {
  if (mult >= AFFINITY_STRONG) return 'こうかばつぐん';
  if (mult <= AFFINITY_WEAK) return 'いまひとつ';
  return 'ふつう';
}
