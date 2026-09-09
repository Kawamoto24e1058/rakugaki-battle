import type { Attribute, StatusKind, Stats } from './types';

export interface StatusMeta {
  id: StatusKind;
  jp: string;
  kind: 'debuff' | 'buff';
  /** 毎ターン終了時のダメージ（最大HP割合）。 */
  dotPercent: number;
  /** ちから倍率（やけど）。 */
  atkMult: number;
  /** すばやさ倍率（まひ）。 */
  spdMult: number;
  /** 被ダメージ倍率（ぼうぎょ↑↓など）。 */
  incomingMult: number;
  /** 行動不能の確率（まひ）。 */
  skipChance: number;
  /** 完全に行動不能（こおり・ねむり）。 */
  fullSkip?: boolean;
  /** 毎ターン、自然に治る確率（こおり）。 */
  wakeChance?: number;
  /** ダメージを受けたとき治る確率（ねむり）。 */
  wakeOnHit?: number;
  /** 自分を攻撃する確率（こんらん）。 */
  selfHitChance: number;
  /** バフ：対象ステータスと倍率。 */
  buffStat?: keyof Stats;
  buffMult?: number;
  /** トゲ：攻撃してきた相手に、与ダメの pct% を返す。 */
  reflectPct?: number;
  duration: number;
  description: string;
}

function meta(p: Partial<StatusMeta> & Pick<StatusMeta, 'id' | 'jp' | 'kind' | 'duration' | 'description'>): StatusMeta {
  return {
    dotPercent: 0,
    atkMult: 1,
    spdMult: 1,
    incomingMult: 1,
    skipChance: 0,
    selfHitChance: 0,
    ...p,
  };
}

export const STATUS_META: Record<StatusKind, StatusMeta> = {
  // ── ポケモン定番6つ ──
  burn: meta({ id: 'burn', jp: 'やけど', kind: 'debuff', dotPercent: 1 / 16, atkMult: 0.7, duration: 4, description: '毎ターン ダメージ。こうげきが 3わり さがる。' }),
  paralysis: meta({ id: 'paralysis', jp: 'まひ', kind: 'debuff', skipChance: 0.3, spdMult: 0.5, duration: 4, description: '30% で 動けない。すばやさが 半分に なる。' }),
  freeze: meta({ id: 'freeze', jp: 'こおり', kind: 'debuff', fullSkip: true, wakeChance: 0.28, duration: 3, description: '動けない。毎ターン とけることがある。ほのお技で すぐ とける。' }),
  sleep: meta({ id: 'sleep', jp: 'ねむり', kind: 'debuff', fullSkip: true, wakeOnHit: 0.55, duration: 2, description: '2ターンくらい 動けない。攻撃されると 目をさますことがある。' }),
  poison: meta({ id: 'poison', jp: 'どく', kind: 'debuff', dotPercent: 1 / 12, duration: 5, description: '毎ターン 最大HPの 8分の1くらい ダメージ。' }),
  confuse: meta({ id: 'confuse', jp: 'こんらん', kind: 'debuff', selfHitChance: 0.33, duration: 3, description: 'ときどき 自分を 攻撃してしまう。' }),
  atkUp: meta({ id: 'atkUp', jp: 'こうげき↑', kind: 'buff', buffStat: 'atk', buffMult: 1.3, duration: 2, description: 'こうげきが 3わり上がる。' }),
  // ぼうぎょ↑↓ は「受けるダメージの倍率」で分かりやすく（stat には触らない）。
  defUp: meta({ id: 'defUp', jp: 'ぼうぎょ↑', kind: 'buff', incomingMult: 0.75, duration: 3, description: '受けるダメージが 25% へる（3ターン）。' }),
  spdUp: meta({ id: 'spdUp', jp: 'すばやさ↑', kind: 'buff', buffStat: 'spd', buffMult: 1.4, duration: 2, description: 'すばやさが 4わり上がる。' }),
  luckUp: meta({ id: 'luckUp', jp: 'きゅうしょ↑', kind: 'buff', buffStat: 'luck', buffMult: 1.5, duration: 3, description: 'きゅうしょに 当たりやすい。' }),
  atkDown: meta({ id: 'atkDown', jp: 'こうげき↓', kind: 'debuff', buffStat: 'atk', buffMult: 0.75, duration: 2, description: 'こうげきが 25% 下がる。' }),
  defDown: meta({ id: 'defDown', jp: 'ぼうぎょ↓', kind: 'debuff', incomingMult: 1.3, duration: 2, description: '受けるダメージが 30% ふえる（2ターン）。' }),
  spdDown: meta({ id: 'spdDown', jp: 'すばやさ↓', kind: 'debuff', buffStat: 'spd', buffMult: 0.65, duration: 2, description: 'すばやさが 35% 下がる。' }),
  flinch: meta({ id: 'flinch', jp: 'ひるみ', kind: 'debuff', duration: 1, description: 'つぎの攻撃が「かすり」になる。' }),
  guard: meta({ id: 'guard', jp: 'ガード', kind: 'buff', incomingMult: 0.5, duration: 2, description: '受けるダメージが 半分に なる（2ターン）。' }),
  thorns: meta({ id: 'thorns', jp: 'トゲ', kind: 'buff', reflectPct: 0.33, duration: 2, description: '攻撃してきた相手に ダメージの 3わり を返す（2ターン）。' }),
};

export interface ActiveStatus {
  kind: StatusKind;
  turnsLeft: number;
  /** poison の経過ターン（ダメージが増える）。 */
  age: number;
}

/** 属性 → その属性の攻撃わざが与える状態異常。 */
export const ATTRIBUTE_STATUS: Record<Attribute, StatusKind> = {
  fire: 'burn',
  bolt: 'paralysis',
  water: 'freeze',
  wood: 'poison',
  dark: 'confuse',
};

export const DEBUFFS: StatusKind[] = [
  'burn', 'paralysis', 'freeze', 'sleep', 'poison', 'confuse',
  'atkDown', 'defDown', 'spdDown', 'flinch',
];

/** support の buff.stat → 付与するバフ状態。 */
export const BUFF_FOR_STAT: Record<'atk' | 'def' | 'spd' | 'luck', StatusKind> = {
  atk: 'atkUp',
  def: 'defUp',
  spd: 'spdUp',
  luck: 'luckUp',
};
export const DEBUFF_FOR_STAT: Record<'atk' | 'def' | 'spd', StatusKind> = {
  atk: 'atkDown',
  def: 'defDown',
  spd: 'spdDown',
};
