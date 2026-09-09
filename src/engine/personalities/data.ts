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
  | { kind: 'ironWill' } // 常に被ダメ軽減（guardPct 相当 +14、恒常）
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
    burn: 'やけど', paralysis: 'まひ', freeze: 'こおり', sleep: 'ねむり',
    poison: 'どく', confuse: 'こんらん', flinch: 'ひるみ',
  };
  return m[s] ?? s;
}

const CD = (turns: number): KoseiLimit => ({ kind: 'cooldown', turns });
const N = (n: number): KoseiLimit => ({ kind: 'count', n });

// 属性ごとの状態異常（攻撃系こせいの既定）
const ATTR_ST: Record<Attribute, StatusKind> = {
  fire: 'burn', water: 'freeze', wood: 'poison', bolt: 'paralysis', dark: 'confuse',
};
const ATTR_WORD: Record<Attribute, string> = {
  fire: 'ほのお', water: 'みず', wood: 'もり', bolt: 'いかずち', dark: 'やみ',
};

type ShapeKey = 'spiky' | 'round' | 'tall' | 'wide' | 'big' | 'small';

interface KTemplate {
  key: string;
  /** 名前の役割ことば（表示名は「${属性}の${role}」）。 */
  role: string;
  tagline: string;
  shape: ShapeKey;
  passive: KoseiPassive;
  active: (st: StatusKind) => KoseiActive;
  activeName: string;
  activeJp: (st: StatusKind) => string;
  limit: KoseiLimit;
}

/** 24 の「戦い方テンプレ」。形（shape）でマッチさせる。属性 × 24 = 120 こせい。 */
const TEMPLATES: KTemplate[] = [
  // トゲトゲ
  { key: 'berserk', role: 'あばれ者', tagline: 'おいつめられるほど 強い', shape: 'spiky',
    passive: { kind: 'lastStand', mult: 1.32 }, active: () => ({ kind: 'vengeance', base: 22 }),
    activeName: 'リベンジ', activeJp: () => '減ったHPが多いほど 威力アップ', limit: CD(2) },
  { key: 'thorn', role: 'トゲの王', tagline: 'さわると いたい', shape: 'spiky',
    passive: { kind: 'thorns', pct: 0.3 }, active: () => ({ kind: 'fortress', guardPct: 80, reflect: 55 }),
    activeName: 'トゲよろい', activeJp: () => '2ターン、鉄壁＋受けたダメージを大きく返す', limit: N(2) },
  { key: 'fang', role: 'キバの子', tagline: 'うばって 生きる', shape: 'spiky',
    passive: { kind: 'lifesteal', pct: 0.16 }, active: () => ({ kind: 'leech', power: 40, drainPct: 80 }),
    activeName: 'まるかじり', activeJp: () => '威力大。与えたダメージの多くを回復', limit: CD(3) },
  { key: 'edge', role: '刃のたましい', tagline: 'いちげき ひっさつ', shape: 'spiky',
    passive: { kind: 'critUp', add: 0.1 }, active: () => ({ kind: 'smash', power: 44, pierce: true }),
    activeName: 'いちげき', activeJp: () => '威力特大。ぼうぎょ無視＋急所に当たりやすい', limit: CD(3) },

  // まる
  { key: 'heal', role: 'いやし手', tagline: 'やさしい', shape: 'round',
    passive: { kind: 'regen', pct: 0.05 }, active: () => ({ kind: 'mend', pct: 0.36 }),
    activeName: 'いやしのひかり', activeJp: () => 'HPを大きく回復＋状態異常ぜんぶ回復', limit: N(2) },
  { key: 'shell', role: 'まる盾', tagline: 'とにかく かたい', shape: 'round',
    passive: { kind: 'ironWill' }, active: () => ({ kind: 'fortress', guardPct: 88, reflect: 35 }),
    activeName: 'まるまるガード', activeJp: () => '2ターン、ほぼ無敵＋反射', limit: N(2) },
  { key: 'bounce', role: 'はねっ子', tagline: 'ぴょんぴょん とぶ', shape: 'round',
    passive: { kind: 'spdUp', mult: 1.14 }, active: () => ({ kind: 'barrage', hits: 3, power: 16 }),
    activeName: 'ぽんぽん連打', activeJp: () => '3回れんぞく攻撃', limit: CD(3) },
  { key: 'lucky', role: 'ラッキー', tagline: 'なにが 起きるか わからない', shape: 'round',
    passive: { kind: 'critUp', add: 0.08 }, active: () => ({ kind: 'wildcard' }),
    activeName: 'なにが出るかな', activeJp: () => 'ランダムで 大ダメージ／全回復／相手を弱体', limit: CD(2) },

  // たて長
  { key: 'sniper', role: 'ねらい手', tagline: '急所を つく', shape: 'tall',
    passive: { kind: 'critUp', add: 0.11 }, active: (st) => ({ kind: 'smash', power: 42, status: st }),
    activeName: 'スナイプ', activeJp: (st) => `威力大。急所＋${jpStatus(st)}`, limit: CD(3) },
  { key: 'quick', role: 'いちばん速い子', tagline: 'だれよりも 速い', shape: 'tall',
    passive: { kind: 'firstMove' }, active: () => ({ kind: 'barrage', hits: 3, power: 18 }),
    activeName: 'だっしゅ連撃', activeJp: () => '3回れんぞく攻撃・先手', limit: CD(3) },
  { key: 'reach', role: 'のびる子', tagline: 'とおくまで とどく', shape: 'tall',
    passive: { kind: 'venom', add: 0.2 }, active: (st) => ({ kind: 'stormStatus', power: 34, status: st }),
    activeName: 'からめとり', activeJp: (st) => `威力大。ほぼ確実に ${jpStatus(st)}（長め）`, limit: CD(3) },
  { key: 'seer', role: '見とおす目', tagline: 'ぜんぶ おみとおし', shape: 'tall',
    passive: { kind: 'spdUp', mult: 1.1 }, active: () => ({ kind: 'hex' }),
    activeName: 'みやぶり', activeJp: () => '相手の こうげき・ぼうぎょ・すばやさ を下げる（3ターン）', limit: CD(3) },

  // よこ広
  { key: 'bruiser', role: 'パワータイプ', tagline: 'パンチが 重い', shape: 'wide',
    passive: { kind: 'atkUp', mult: 1.14 }, active: () => ({ kind: 'smash', power: 50, pierce: true }),
    activeName: 'パワークラッシュ', activeJp: () => '威力特大。ぼうぎょ無視', limit: CD(3) },
  { key: 'tank', role: 'どっしり型', tagline: 'びくとも しない', shape: 'wide',
    passive: { kind: 'defUp', mult: 1.18 }, active: () => ({ kind: 'fortress', guardPct: 85, reflect: 30 }),
    activeName: 'てっぺき', activeJp: () => '2ターン、鉄壁＋反射', limit: N(2) },
  { key: 'rock', role: '動かない子', tagline: 'ふんばりが つよい', shape: 'wide',
    passive: { kind: 'ironWill' }, active: () => ({ kind: 'warcry' }),
    activeName: 'ふんばりオーラ', activeJp: () => '3ターン、自分の こうげき・すばやさ 大アップ', limit: N(2) },
  { key: 'quake', role: 'じしんの子', tagline: 'ずしんと くる', shape: 'wide',
    passive: { kind: 'atkUp', mult: 1.1 }, active: () => ({ kind: 'vengeance', base: 26 }),
    activeName: 'ゆさぶり', activeJp: () => '減ったHPが多いほど 威力アップ', limit: CD(2) },

  // 大きい
  { key: 'champ', role: 'チャンピオン', tagline: '気合で 押し切る', shape: 'big',
    passive: { kind: 'atkUp', mult: 1.12 }, active: () => ({ kind: 'warcry' }),
    activeName: 'たたかいのうた', activeJp: () => '3ターン、こうげき・すばやさ 大アップ', limit: N(2) },
  { key: 'titan', role: 'きょじん', tagline: 'ピンチで めざめる', shape: 'big',
    passive: { kind: 'lastStand', mult: 1.3 }, active: () => ({ kind: 'smash', power: 48 }),
    activeName: 'だいちのいちげき', activeJp: () => '威力特大', limit: CD(3) },
  { key: 'king', role: 'おうさま', tagline: 'みんなを まもる', shape: 'big',
    passive: { kind: 'defUp', mult: 1.16 }, active: () => ({ kind: 'mend', pct: 0.26 }),
    activeName: 'おうのいのり', activeJp: () => 'HPを回復＋状態異常ぜんぶ回復', limit: N(2) },
  { key: 'glutton', role: 'たべる子', tagline: 'なんでも たべる', shape: 'big',
    passive: { kind: 'lifesteal', pct: 0.2 }, active: () => ({ kind: 'leech', power: 44, drainPct: 85 }),
    activeName: 'まるのみ', activeJp: () => '威力大。多く回復', limit: CD(3) },

  // 小さい
  { key: 'trick', role: 'いたずらっ子', tagline: 'よめない うごき', shape: 'small',
    passive: { kind: 'venom', add: 0.26 }, active: () => ({ kind: 'hex' }),
    activeName: 'まぜっかえし', activeJp: () => '相手を弱体（3ターン）＋小ダメージ', limit: CD(3) },
  { key: 'sprite', role: 'ようせい', tagline: 'ちいさな いやし手', shape: 'small',
    passive: { kind: 'regen', pct: 0.05 }, active: () => ({ kind: 'mend', pct: 0.3 }),
    activeName: 'ようせいのめぐみ', activeJp: () => 'HP回復＋状態異常ぜんぶ回復', limit: N(2) },
  { key: 'gremlin', role: 'こわっぱ', tagline: 'なにを するか わからない', shape: 'small',
    passive: { kind: 'spdUp', mult: 1.12 }, active: () => ({ kind: 'wildcard' }),
    activeName: 'いたずらガチャ', activeJp: () => 'ランダムで 大ダメージ／全回復／弱体', limit: CD(2) },
  { key: 'pest', role: 'しつこい子', tagline: 'まとわりつく', shape: 'small',
    passive: { kind: 'venom', add: 0.3 }, active: (st) => ({ kind: 'stormStatus', power: 30, status: st }),
    activeName: 'まとわりつき', activeJp: (st) => `ほぼ確実に ${jpStatus(st)}（長め）`, limit: CD(3) },
];

export const KOSEI_LIST: Kosei[] = (['fire', 'water', 'wood', 'bolt', 'dark'] as Attribute[]).flatMap((attr) => {
  const st = ATTR_ST[attr];
  const w = ATTR_WORD[attr];
  return TEMPLATES.map<Kosei>((t) => ({
    id: `${attr}_${t.key}`,
    name: `${w}の${t.role}`,
    tagline: t.tagline,
    tags: [`attr:${attr}`, `shape:${t.shape}`],
    passive: t.passive,
    passiveJp: passiveText(t.passive),
    active: t.active(st),
    activeName: t.activeName,
    activeJp: t.activeJp(st),
    limit: t.limit,
  }));
});

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
