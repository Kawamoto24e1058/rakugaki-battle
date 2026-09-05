import type { Attribute, StatusKind } from '../types';

/** キャラの「こせい」＝ 常時パッシブ ＋ 専用アクティブ（こせいボタン）のパッケージ。 */
export type KoseiId = string;

/** 常時発動のパッシブ効果。 */
export type KoseiPassive =
  | { kind: 'atkUp'; mult: number }
  | { kind: 'defUp'; mult: number }
  | { kind: 'spdUp'; mult: number }
  | { kind: 'regen'; pct: number } // 毎ターン 最大HP×pct 回復
  | { kind: 'firstMove' } // 行動順のすばやさを ×1.4 とみなす
  | { kind: 'immune'; status: StatusKind } // その状態異常にならない
  | { kind: 'thorns'; pct: number } // 攻撃を受けるたび pct% を反射
  | { kind: 'critUp'; add: number } // クリティカル率 +add
  | { kind: 'lastStand'; mult: number } // HP40%未満で こうげき ×mult
  | { kind: 'lifesteal'; pct: number } // 与ダメの pct% を回復
  | { kind: 'ironWill' } // 常に被ダメ軽減（guardPct +12）／まもるが更に硬い
  | { kind: 'venom'; add: number }; // 攻撃の状態異常成功率 +add

/** こせいボタンで撃つアクティブ効果。 */
export type KoseiActive =
  | { kind: 'smash'; power: number; pierce?: boolean; status?: StatusKind }
  | { kind: 'stormStatus'; power: number; status: StatusKind }
  | { kind: 'mend'; pct: number } // HP最大×pct 回復＋状態異常すべて解除
  | { kind: 'fortress'; guardPct: number; reflect: number } // 2ターンの鉄壁＋反射
  | { kind: 'warcry' } // 自分の こうげき・すばやさ を大アップ（3ターン）
  | { kind: 'leech'; power: number; drainPct: number }
  | { kind: 'hex' } // 相手の こうげき・ぼうぎょ・すばやさ を下げる（3ターン）＋小ダメージ
  | { kind: 'vengeance'; base: number } // 威力 = base + 失ったHP割合×90
  | { kind: 'barrage'; hits: number; power: number }
  | { kind: 'wildcard' }; // ランダムで 大ダメージ / 全回復 / 全弱体

export type KoseiLimit = { kind: 'cooldown'; turns: number } | { kind: 'count'; n: number };

export interface Kosei {
  id: KoseiId;
  name: string;
  tagline: string;
  tags: string[];
  passive: KoseiPassive;
  passiveJp: string;
  active: KoseiActive;
  activeName: string;
  activeJp: string;
  limit: KoseiLimit;
}

const PASSIVE_JP: Record<KoseiPassive['kind'], string> = {
  atkUp: 'こうげきが すこし高い',
  defUp: 'ぼうぎょが すこし高い',
  spdUp: 'すばやさが すこし高い',
  regen: '毎ターン 少し回復する',
  firstMove: '先に動きやすい',
  immune: 'ある状態異常を うけない',
  thorns: '攻撃を受けると すこし返す',
  critUp: 'きゅうしょに 当たりやすい',
  lastStand: 'ピンチで こうげきが上がる',
  lifesteal: '攻撃するたび すこし回復する',
  ironWill: '常に すこし かたい',
  venom: '状態異常が 入りやすい',
};

function passiveText(p: KoseiPassive): string {
  if (p.kind === 'immune') return `${jpStatus(p.status)} を うけない`;
  return PASSIVE_JP[p.kind];
}
function jpStatus(s: StatusKind): string {
  const m: Partial<Record<StatusKind, string>> = {
    burn: 'やけど', shock: 'しびれ', wet: 'ぬれ', bind: 'からまり', curse: 'のろい',
    poison: 'どく', confuse: 'こんらん', flinch: 'ひるみ',
  };
  return m[s] ?? s;
}

/** 個性を1件つくる短縮ビルダー。 */
function K(
  id: string,
  name: string,
  tagline: string,
  tags: string[],
  passive: KoseiPassive,
  active: KoseiActive,
  activeName: string,
  activeJp: string,
  limit: KoseiLimit,
): Kosei {
  return { id, name, tagline, tags, passive, passiveJp: passiveText(passive), active, activeName, activeJp, limit };
}

const CD = (turns: number): KoseiLimit => ({ kind: 'cooldown', turns });
const N = (n: number): KoseiLimit => ({ kind: 'count', n });

// 属性ごとの状態異常（攻撃系こせいの既定）
const ATTR_ST: Record<Attribute, StatusKind> = {
  fire: 'burn', water: 'wet', wood: 'bind', bolt: 'shock', dark: 'curse',
};

/**
 * 属性 × テーマ でこせいを量産するテンプレ。
 * theme: attacker / bruiser / fortress / speed / trick / mystic / vampire / berserk
 */
function pack(attr: Attribute, prefixes: [string, string, string, string]): Kosei[] {
  const st = ATTR_ST[attr];
  const [p0, p1, p2, p3] = prefixes;
  const A = `attr:${attr}`;
  return [
    K(`${attr}_avatar`, `${p0}の化身`, `${p0}をあやつる強い子`, [A, 'mood:fierce', 'deco:colorful'],
      { kind: 'immune', status: st }, { kind: 'stormStatus', power: 40, status: st },
      `${p0}のいかり`, `威力大。ほぼ確実に ${jpStatus(st)}（長め）`, CD(3)),
    K(`${attr}_fist`, `${p0}のこぶし`, `パンチが とにかく重い`, [A, 'shape:spiky', 'weapon:sword', 'mood:fierce'],
      { kind: 'atkUp', mult: 1.14 }, { kind: 'smash', power: 50, pierce: true },
      `${p1}クラッシュ`, '威力特大。ぼうぎょ無視の一撃', CD(3)),
    K(`${attr}_wall`, `${p0}のとりで`, `とにかく かたい`, [A, 'shape:round', 'shape:wide', 'weapon:shield', 'shape:symmetric'],
      { kind: 'ironWill' }, { kind: 'fortress', guardPct: 88, reflect: 45 },
      `${p2}バリア`, '2ターン、ほぼ無敵＋受けたダメージを返す', N(2)),
    K(`${attr}_gale`, `${p0}のはやて`, `だれよりも 速い`, [A, 'shape:tall', 'part:wings', 'shape:small'],
      { kind: 'firstMove' }, { kind: 'barrage', hits: 3, power: 18 },
      `${p3}ラッシュ`, '3回れんぞく攻撃', CD(3)),
    K(`${attr}_trick`, `${p0}のまやかし`, `よめない うごき`, [A, 'shape:asymmetric', 'part:eyes'],
      { kind: 'venom', add: 0.25 }, { kind: 'hex' },
      `${p2}ジャマー`, '相手の こうげき・ぼうぎょ・すばやさ を下げる（3ターン）', CD(3)),
    K(`${attr}_priest`, `${p0}のめぐみ`, `やさしい いやし手`, [A, 'mood:calm', 'shape:round'],
      { kind: 'regen', pct: 0.045 }, { kind: 'mend', pct: 0.34 },
      `${p1}のいのり`, 'HPを大きく回復＋状態異常ぜんぶ回復', N(2)),
    K(`${attr}_vampire`, `${p0}のきば`, `うばって 生きる`, [A, 'shape:spiky', 'mood:fierce', 'part:eyes'],
      { kind: 'lifesteal', pct: 0.18 }, { kind: 'leech', power: 40, drainPct: 80 },
      `${p3}ドレイン`, '威力大。与えたダメージの多くを回復', CD(3)),
    K(`${attr}_berserk`, `${p2}のいかり`, `おいつめられるほど 強い`, [A, 'mood:fierce', 'shape:spiky', 'deco:plain'],
      { kind: 'lastStand', mult: 1.3 }, { kind: 'vengeance', base: 22 },
      `${p1}リベンジ`, '減ったHPが多いほど 威力アップ', CD(2)),
    K(`${attr}_sniper`, `${p0}のねらい`, `急所を つく`, [A, 'part:eyes', 'shape:tall'],
      { kind: 'critUp', add: 0.09 }, { kind: 'smash', power: 42, status: st },
      `${p3}スナイプ`, '威力大。急所に当たりやすい＋状態異常', CD(3)),
    K(`${attr}_champion`, `${p0}のたましい`, `気合で 押し切る`, [A, 'deco:plain', 'shape:big', 'mood:fierce'],
      { kind: 'atkUp', mult: 1.1 }, { kind: 'warcry' },
      `${p2}オーラ`, '3ターン、自分の こうげき・すばやさ 大アップ', N(2)),
    K(`${attr}_guardian`, `${p2}のまもり`, `みんなを まもる`, [A, 'shape:symmetric', 'shape:big', 'weapon:shield', 'mood:calm'],
      { kind: 'defUp', mult: 1.16 }, { kind: 'mend', pct: 0.24 },
      `${p1}ヒール`, 'HPを回復＋状態異常ぜんぶ回復', N(2)),
    K(`${attr}_chaos`, `${p3}のまつり`, `なにが 起きるか わからない`, [A, 'deco:colorful', 'shape:asymmetric'],
      { kind: 'spdUp', mult: 1.12 }, { kind: 'wildcard' },
      `${p1}ガチャ`, 'ランダムで 大ダメージ／全回復／相手を弱体', CD(2)),
  ];
}

export const KOSEI_LIST: Kosei[] = [
  ...pack('fire', ['ほのお', 'フレア', 'バーン', 'ヒート']),
  ...pack('water', ['みず', 'アクア', 'スプラッシュ', 'タイダル']),
  ...pack('wood', ['もり', 'リーフ', 'ブルーム', 'ルート']),
  ...pack('bolt', ['いかずち', 'ボルト', 'スパーク', 'サンダー']),
  ...pack('dark', ['やみ', 'シャドウ', 'ダーク', 'ヴォイド']),
];

const KOSEI_BY_ID = new Map(KOSEI_LIST.map((k) => [k.id, k]));

export function getKosei(id: KoseiId): Kosei {
  const k = KOSEI_BY_ID.get(id);
  if (!k) throw new Error(`未知のこせい: ${id}`);
  return k;
}

/** 未知ID・未設定でも落ちない版（古いセーブデータ用）。 */
export function koseiOrDefault(id: string | undefined, attribute: Attribute): Kosei {
  if (id) {
    const k = KOSEI_BY_ID.get(id);
    if (k) return k;
  }
  return KOSEI_LIST.find((k) => k.tags.includes(`attr:${attribute}`)) ?? KOSEI_LIST[0];
}

export function limitJp(l: KoseiLimit): string {
  return l.kind === 'cooldown' ? `クールダウン ${l.turns}` : `1バトル ${l.n}回`;
}
