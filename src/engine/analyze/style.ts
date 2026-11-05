import type { BattleStyle } from '../types';

/**
 * キャラの「タイプ」（たたかいかた）。絵から 1つに きまり、ステータスの 形と 得意な 技が はっきり かわる。
 * つよさの 合計は みんな おなじ（配分が かわるだけ）。
 */
export const STYLE_META: Record<BattleStyle, { jp: string; color: string; desc: string; mult: { atk: number; def: number; spd: number; hp: number; luck: number; heart: number } }> = {
  power: { jp: 'パワータイプ', color: '#e8503a', desc: 'こうげきが とくい。大わざで いっきに けずる', mult: { atk: 1.5, def: 0.9, spd: 0.78, hp: 1.1, luck: 1, heart: 1.1 } },
  guard: { jp: 'かたいタイプ', color: '#6b6f7a', desc: 'ぼうぎょと HPが とくい。まもって はねかえす', mult: { atk: 0.9, def: 1.35, spd: 0.82, hp: 1.15, luck: 0.95, heart: 1.1 } },
  speed: { jp: 'すばやいタイプ', color: '#e0a90c', desc: 'すばやさが とくい。先に うごいて なんども こうげき', mult: { atk: 1.15, def: 0.78, spd: 1.6, hp: 0.8, luck: 1.25, heart: 0.85 } },
  magic: { jp: 'まほうタイプ', color: '#7b5cf0', desc: 'じょうたいいじょうが とくい。やけど・まひ・ねむり で じわじわ', mult: { atk: 0.95, def: 0.95, spd: 1.05, hp: 1.0, luck: 0.9, heart: 1.5 } },
  balance: { jp: 'バランスタイプ', color: '#1f9d63', desc: 'なんでも できる。こまったら これ', mult: { atk: 1, def: 1, spd: 1, hp: 1, luck: 1, heart: 1 } },
};

export const BATTLE_STYLES = Object.keys(STYLE_META) as BattleStyle[];

const MAGIC_TAGS = new Set(['magic', 'ghost']);

/**
 * タイプを きめる。
 *  1. AI が 決めた タイプが あれば それ
 *  2. 見た目の 印象（AI の look。なければ 絵の 形からの 点）で、こうげき・ぼうぎょ・すばやさ の どれかが とびぬけていれば その タイプ
 *  3. まほう・おばけ の 特徴が あれば まほう
 *  4. どれも とびぬけて いなければ バランス
 */
export function decideStyle(input: {
  aiStyle?: BattleStyle;
  /** 0..1 の 見た目の 印象（power/tough/speed）。 */
  look: { power: number; tough: number; speed: number };
  motifTags?: string[];
}): { style: BattleStyle; why: string } {
  if (input.aiStyle && STYLE_META[input.aiStyle]) return { style: input.aiStyle, why: 'AI が 絵を 見て きめた' };
  const tags = input.motifTags ?? [];
  const { power, tough, speed } = input.look;
  const entries: [BattleStyle, number, string][] = [
    ['power', power, 'つよそうな ところが 目立つ'],
    ['guard', tough, 'かたそうな ところが 目立つ'],
    ['speed', speed, 'すばやそうな ところが 目立つ'],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  const [top, second] = entries;
  if (tags.some((t) => MAGIC_TAGS.has(t)) && top[1] - second[1] < 0.25) return { style: 'magic', why: 'まほう・ふしぎな ふんいき' };
  if (top[1] - second[1] >= 0.12) return { style: top[0], why: top[2] };
  return { style: 'balance', why: 'どれも おなじくらい' };
}
