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

/**
 * 属性はダメージ倍率を持たない（生成で有利不利が固定されないため）。
 * かわりに「属性が合っていると状態異常が入りやすい／逆だと入りにくい」で効かせる。
 */
export const ATTR_STATUS_STRONG = 1.6;
export const ATTR_STATUS_WEAK = 0.4;
export const ATTR_STATUS_EVEN = 1;

/** attacker の属性が defender に有利／不利／五分 か（バトル開始の相性表示用）。 */
export function attributeMatchup(attacker: Attribute, defender: Attribute): 'strong' | 'weak' | 'even' {
  if (STRONG_AGAINST[attacker] === defender) return 'strong';
  if (STRONG_AGAINST[defender] === attacker) return 'weak';
  return 'even';
}

/** 属性技の状態異常成功率にかかる倍率（moveAttr が defenderAttr に得意なら上がる）。 */
export function attributeStatusMult(moveAttr: Attribute, defenderAttr: Attribute): number {
  const m = attributeMatchup(moveAttr, defenderAttr);
  return m === 'strong' ? ATTR_STATUS_STRONG : m === 'weak' ? ATTR_STATUS_WEAK : ATTR_STATUS_EVEN;
}
