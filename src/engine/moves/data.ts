import type { Attribute, StatusKind, Stats } from '../types';

export type MoveId = string;

/**
 * 手札バトルで配られる技。
 * 毎ターン全ワザから3枚が配られるので、「どの手札でも1枚ごとに意味がある」ように
 * 技ごとに はっきりした役割（先制・連続攻撃・状態異常・まもり・かいふく …）を持たせる。
 */
export interface MoveDef {
  id: MoveId;
  name: string;
  category: 'attack' | 'support';
  attribute: Attribute | null;
  /** attack: 基礎威力（連続攻撃は1発ぶん）。support: 0。 */
  power: number;
  target: 'enemy' | 'self';
  /** 命中時に付与する状態異常。 */
  status?: { kind: StatusKind; chance: number; toSelf?: boolean };
  /** 状態異常を治す（自分）。 */
  cures?: 'one' | 'all';
  /** 自分にバフ。 */
  buff?: { stat: keyof Stats; turns: number };
  /** 必ず先に動く。 */
  first?: boolean;
  /** まもり：受けるダメージを半分にする状態（ガード）をつける。 */
  guardPct?: number;
  /** カウンター：攻撃してきた相手にダメージの一部を返す状態をつける。 */
  reflect?: number;
  /** ぼうぎょ無視。 */
  pierce?: boolean;
  /** 与ダメージのぶん回復（%）。 */
  drain?: number;
  /** 固定回復。 */
  heal?: number;
  /** ランダムな属性・状態異常になる。 */
  randomAttr?: boolean;
  /** 与ダメージのぶん自分に反動（%）。 */
  recoil?: number;
  /** 「かすり」になりやすくする（強い技のリスク）。負なら かすりにくい。 */
  riskShift?: number;
  /** 相手のステータスを下げる。 */
  debuff?: { stat: keyof Stats; turns: number };
  /** 連続攻撃の回数（1発ごとにダメージ・かすり・状態異常を判定）。 */
  hits?: number;
  /** きゅうしょ（クリティカル）の出やすさを足す（0.3 = +30%）。 */
  critBoost?: number;
  /** 相手のHPが4わり以下のとき、ダメージにかかる倍率。 */
  execute?: number;
  /** 相手が「こうげき」を選んでいたときだけ決まる（それ以外は失敗）。 */
  ambush?: boolean;
  desc: string;
}

/** 攻撃わざ。 */
function atk(id: string, name: string, power: number, desc: string, extra: Partial<MoveDef> = {}): MoveDef {
  return { attribute: null, target: 'enemy', ...extra, id, name, category: 'attack', power, desc };
}

/** 補助わざ。 */
function sup(id: string, name: string, desc: string, extra: Partial<MoveDef> = {}): MoveDef {
  return { attribute: null, ...extra, id, name, category: 'support', power: 0, target: extra.target ?? 'self', desc };
}

export const MOVES: Record<MoveId, MoveDef> = Object.fromEntries(
  (
    [
      // ===== こうげき：ふつう =====
      atk('c_scratch', 'ひっかき', 14, 'ちいさな ダメージ。かすりにくい。', { riskShift: -8 }),
      atk('c_tackle', 'たいあたり', 22, 'ふつうの たいあたり。'),
      atk('c_bite', 'かみつき', 30, 'つよい かみつき。'),

      // ===== こうげき：先に動く =====
      atk('sm_dart', 'スニークムーブ', 16, 'かならず 先に うごく。', { first: true }),
      atk('wg_dive', 'きゅうこうか', 24, 'かならず 先に うごく。', { first: true }),
      atk('fi_charge', 'とっしん', 30, '先に うごく。そのかわり 反動を うける。', { first: true, recoil: 20 }),
      atk('as_sucker', 'ふいうち', 32, 'あいてが こうげきを えらんだときだけ 先に きまる。ほかは しっぱい。', { first: true, ambush: true }),

      // ===== こうげき：くせのある技 =====
      atk('sw_rapid', 'れんぞくぎり', 9, '3かい つづけて きる。', { hits: 3 }),
      atk('ey_aim', 'ねらいうち', 24, 'きゅうしょに あたりやすい。', { critBoost: 0.35 }),
      atk('fi_finish', 'とどめのキバ', 26, 'あいての HPが 4わり いかだと 1.7ばいの ダメージ。', { execute: 1.7 }),
      atk('wd_bolt', 'まほうだん', 22, 'あいての ぼうぎょを むしする。', { pierce: true }),
      atk('wd_mega', 'メガチャージ', 35, 'ぼうぎょを むし。つよいが かすりやすい。', { pierce: true, riskShift: 6 }),
      atk('sw_great', 'だいせつだん', 37, 'とても つよいが かすりやすい。', { riskShift: 10 }),
      atk('fi_rampage', 'あばれる', 34, 'つよい。そのかわり 反動を うける。', { recoil: 15 }),

      // ===== こうげき：じょうたいいじょう =====
      atk('fire_a2', 'かえん', 24, '60% で やけど。', { attribute: 'fire', status: { kind: 'burn', chance: 0.6 } }),
      atk('water_a2', 'すいりゅう', 24, '40% で こおり。うごけなくする。', { attribute: 'water', status: { kind: 'freeze', chance: 0.4 } }),
      atk('wood_a2', 'いばらムチ', 24, '60% で どく。', { attribute: 'wood', status: { kind: 'poison', chance: 0.6 } }),
      atk('bolt_a2', 'いなずま', 24, '55% で まひ。', { attribute: 'bolt', status: { kind: 'paralysis', chance: 0.55 } }),
      atk('dark_a2', 'やみのやいば', 24, '55% で こんらん。', { attribute: 'dark', status: { kind: 'confuse', chance: 0.55 } }),
      atk('sp_horn', 'つのアタック', 30, '50% で ひるみ。つぎの こうげきが かすりに なる。', { status: { kind: 'flinch', chance: 0.5 } }),
      atk('as_trick', 'トリッキー', 20, '35% で ねむらせる。', { status: { kind: 'sleep', chance: 0.35 } }),
      atk('u_poison_needle', 'どくばり', 10, 'ほぼ かならず どく。', { status: { kind: 'poison', chance: 0.9 } }),
      atk('co_rainbow', 'にじいろだま', 24, 'ランダムな ぞくせいと じょうたいいじょう。', { randomAttr: true }),

      // ===== こうげき：大技（めったに配られない） =====
      atk('fire_sig', 'フレアバスター', 36, 'ぼうぎょ無視。かならず やけど。', { attribute: 'fire', pierce: true, riskShift: 6, status: { kind: 'burn', chance: 1 } }),
      atk('water_sig', 'アクアカノン', 36, 'ぼうぎょ無視。80% で こおり。', { attribute: 'water', pierce: true, status: { kind: 'freeze', chance: 0.8 } }),
      atk('wood_sig', 'ジャングルバインド', 34, 'かならず どく。', { attribute: 'wood', status: { kind: 'poison', chance: 1 } }),
      atk('bolt_sig', 'サンダーレイド', 32, '先に うごく。90% で まひ。', { attribute: 'bolt', first: true, status: { kind: 'paralysis', chance: 0.9 } }),
      atk('dark_sig', 'ドレインバイト', 32, 'ダメージの 半分を かいふく。50% で こんらん。', { attribute: 'dark', drain: 55, status: { kind: 'confuse', chance: 0.5 } }),
      atk('wi_slam', 'のしかかり', 34, '60% で ひるみ。', { status: { kind: 'flinch', chance: 0.6 } }),

      // ===== ほじょ：まもり（先に うごく） =====
      sup('c_guard', 'ガード', '先に うごく。2ターン、うけるダメージが 半分。', { guardPct: 50 }),
      sup('wood_root', 'ねをはる', '先に うごく。3ターン、うけるダメージ 40%へらす。少し かいふく。', { buff: { stat: 'def', turns: 3 }, heal: 10 }),
      sup('sh_counter', 'カウンター', '先に うごく。2ターン、こうげきしてきた あいてに ダメージの 半分を かえす。', { reflect: 35 }),

      // ===== ほじょ：かいふく =====
      sup('ca_heal', 'いやしのて', 'HPを おおきく かいふく。', { heal: 34 }),
      sup('ca_breath', 'ふかこきゅう', 'じょうたいいじょうを 1つ なおして かいふく。', { cures: 'one', heal: 15 }),
      sup('water_wash', 'みずであらう', 'じょうたいいじょうを ぜんぶ なおして かいふく。', { cures: 'all', heal: 16 }),
      sup('u_detox', 'デトックス', 'じょうたいいじょうを ぜんぶ なおす。', { cures: 'all' }),

      // ===== ほじょ：じぶんを つよくする =====
      sup('c_focus', 'きあいだめ', '3ターン、こうげきが 5わり あがる。', { buff: { stat: 'atk', turns: 3 } }),
      sup('wg_flap', 'はばたき', '3ターン、すばやさが 5わり あがる。かわしやすい。', { buff: { stat: 'spd', turns: 3 } }),
      sup('ey_read', 'よみのちから', '3ターン、きゅうしょに とても あたりやすい。', { buff: { stat: 'luck', turns: 3 } }),

      // ===== ほじょ：あいてを よわらせる =====
      sup('ey_glare', 'にらむ', 'あいての こうげきを 2ターン さげる。', { target: 'enemy', debuff: { stat: 'atk', turns: 2 } }),
      sup('ta_look', 'みおろす', 'あいての すばやさを 2ターン さげる。', { target: 'enemy', debuff: { stat: 'spd', turns: 2 } }),
      sup('bg_roar', 'ほえる', 'あいてが うけるダメージを 2ターン 3わり ふやす。', { target: 'enemy', debuff: { stat: 'def', turns: 2 } }),
    ] as MoveDef[]
  ).map((m) => [m.id, m]),
);

export function getMove(id: MoveId): MoveDef {
  const m = MOVES[id];
  if (!m) throw new Error(`未知のわざ: ${id}`);
  return m;
}

/** 大技か（めったに配られない）。 */
export function isRareMove(m: MoveDef): boolean {
  return m.category === 'attack' && m.power >= 34;
}

/** 「先に動く」技か（先制・まもり・カウンター・ぼうぎょアップ）。 */
export function hasPriority(m: MoveDef): boolean {
  return !!(m.first || m.guardPct || m.reflect || (m.buff && m.buff.stat === 'def'));
}
