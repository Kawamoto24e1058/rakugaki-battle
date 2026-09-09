import type { Attribute, StatusKind, Stats } from '../types';

export type MoveId = string;
export type UnlockTag = string;

export interface MoveDef {
  id: MoveId;
  name: string;
  category: 'attack' | 'support';
  attribute: Attribute | null;
  /** attack: 基礎威力。support: 効果の大きさの目安。 */
  power: number;
  /** 使用後、このターン数だけ選べない。 */
  cooldown: number;
  target: 'enemy' | 'self';
  /** 命中時に付与する状態異常。 */
  status?: { kind: StatusKind; chance: number; toSelf?: boolean };
  /** 状態異常を治す（自分）。 */
  cures?: 'one' | 'all';
  /** 自分にバフ。 */
  buff?: { stat: keyof Stats; turns: number };
  /** 必ず先制。 */
  first?: boolean;
  /** このターン、被ダメージを軽減（%）。 */
  guardPct?: number;
  /** 受けたダメージの一部を返す構え（%、次の被弾まで）。 */
  reflect?: number;
  /** ぼうぎょ無視。 */
  pierce?: boolean;
  /** 与ダメージのぶん回復（%）。 */
  drain?: number;
  /** 固定回復。 */
  heal?: number;
  /** ランダム属性になる。 */
  randomAttr?: boolean;
  /** 与ダメージのぶん自分に反動（%）。 */
  recoil?: number;
  /** きめルーレットを「はずれ／かすり」寄りにする（強い技のリスク）。 */
  riskShift?: number;
  /** ひっさつゲージ増加。 */
  gauge?: number;
  /** 相手のステータスを下げる。 */
  debuff?: { stat: keyof Stats; turns: number };
  unlock: UnlockTag[];
  desc: string;
}

const DEFAULT: Omit<MoveDef, 'id' | 'name' | 'category' | 'power' | 'unlock' | 'desc'> = {
  attribute: null,
  cooldown: 0,
  target: 'enemy' };

/** 攻撃わざ。 */
function atk(
  id: string,
  name: string,
  power: number,
  unlock: UnlockTag[],
  desc: string,
  extra: Partial<MoveDef> = {},
): MoveDef {
  return { ...DEFAULT, id, name, category: 'attack', power, unlock, desc, ...extra };
}

/** 補助わざ。 */
function sup(
  id: string,
  name: string,
  power: number,
  unlock: UnlockTag[],
  desc: string,
  extra: Partial<MoveDef> = {},
): MoveDef {
  return { ...DEFAULT, id, name, category: 'support', power, target: 'self', unlock, desc, ...extra };
}

function attrLine(a: Attribute, names: [string, string, string], status: StatusKind): MoveDef[] {
  const st = STATUS_JP[status];
  return [
    atk(`${a}_a1`, names[0], 14, [`attr:${a}`, 'attr-tier:1'], `威力ひかえめ。ときどき${st}。`, { attribute: a, status: { kind: status, chance: 0.4 } }),
    atk(`${a}_a2`, names[1], 24, [`attr:${a}`, 'attr-tier:2'], `威力ふつう。高い確率で${st}。`, { attribute: a, status: { kind: status, chance: 0.6 } }),
    atk(`${a}_a3`, names[2], 38, [`attr:${a}`, 'attr-tier:3'], `威力大。ほぼ${st}。当てにくい。`, { attribute: a, riskShift: 8, status: { kind: status, chance: 0.9 } }),
  ];
}

const STATUS_JP: Record<string, string> = {
  burn: 'やけど', paralysis: 'まひ', freeze: 'こおり', sleep: 'ねむり',
  poison: 'どく', confuse: 'こんらん', flinch: 'ひるみ' };

export const MOVES: Record<MoveId, MoveDef> = Object.fromEntries(
  (
    [
      // ===== 共通（だれでも） =====
      atk('c_scratch', 'ひっかき', 13, ['common'], '威力ひかえめ。手数を稼ぐ小技。', {}),
      atk('c_tackle', 'たいあたり', 20, ['common'], '威力ふつう。クセのない体当たり。', {}),
      atk('c_bite', 'かみつき', 30, ['common'], '威力大。', { }),
      sup('c_guard', 'ガード', 0, ['common'], '2ターン、受けるダメージが 半分に なる。', { guardPct: 55 }),
      sup('c_focus', 'きあいだめ', 0, ['common'], '3ターン、こうげきが 3わり上がる。', { buff: { stat: 'atk', turns: 3 } }),
      atk('c_gamble', 'ギャンブルアタック', 35, ['common'], '威力特大。外れ・かすりが多い。', { riskShift: 16 }),

      // ===== 属性ライン（3段階・進化で上がる） =====
      ...attrLine('fire', ['ひのこ', 'かえん', 'ごうか'], 'burn'),
      ...attrLine('water', ['みずでっぽう', 'すいりゅう', 'だくりゅう'], 'freeze'),
      ...attrLine('wood', ['つるむち', 'いばらムチ', 'もりのいかり'], 'poison'),
      ...attrLine('bolt', ['でんげき', 'いなずま', 'かみなり'], 'paralysis'),
      ...attrLine('dark', ['かげぬい', 'やみのやいば', 'あんこく'], 'confuse'),

      // 属性シグネチャー（強力な切り札）＋ 属性の補助
      atk('fire_sig', 'フレアバスター', 36, ['attr:fire', 'mood:fierce'], '威力特大。ぼうぎょ無視。必ずやけど。', { attribute: 'fire', pierce: true, riskShift: 6, status: { kind: 'burn', chance: 1 } }),
      sup('fire_dry', 'ねっぷう', 0, ['attr:fire'], 'こおり などを 吹き飛ばして 少し回復。', { cures: 'one', heal: 12 }),
      atk('water_sig', 'アクアカノン', 36, ['attr:water', 'weapon:wand'], '威力特大。ぼうぎょ無視。必ず こおり。', { attribute: 'water', pierce: true, status: { kind: 'freeze', chance: 1 } }),
      sup('water_wash', 'みずであらう', 0, ['attr:water', 'mood:calm'], 'やけど・どくを洗い流して中回復。', { cures: 'all', heal: 16 }),
      atk('wood_sig', 'ジャングルバインド', 34, ['attr:wood', 'shape:big'], '威力大。必ず どく。', { attribute: 'wood', status: { kind: 'poison', chance: 1 } }),
      sup('wood_root', 'ねをはる', 0, ['attr:wood'], '3ターン、受けるダメージ 25%減＋少し回復。', { buff: { stat: 'def', turns: 3 }, heal: 10 }),
      atk('bolt_sig', 'サンダーレイド', 34, ['attr:bolt', 'part:wings'], '威力大。必ず先制。高い確率で まひ。', { attribute: 'bolt', first: true, status: { kind: 'paralysis', chance: 0.9 } }),
      atk('dark_sig', 'ドレインバイト', 32, ['attr:dark', 'mood:fierce'], '威力大。与ダメージの半分を回復。ときどき こんらん。', { attribute: 'dark', drain: 55, status: { kind: 'confuse', chance: 0.5 } }),
      sup('dark_veil', 'やみのベール', 0, ['attr:dark'], 'すばやさアップ（2ターン）＋回避が上がる。', { buff: { stat: 'spd', turns: 2 } }),

      // ===== 形：トゲトゲ =====
      atk('sp_claw', 'するどいツメ', 22, ['shape:spiky'], '威力ふつう。鋭い爪で切り裂く。', {}),
      atk('sp_horn', 'つのアタック', 30, ['shape:spiky'], '威力大。ときどきひるみ。', { status: { kind: 'flinch', chance: 0.5 } }),
      sup('sp_thorn', 'とげのよろい', 0, ['shape:spiky'], '2ターン、攻撃してきた相手に ダメージの 3わり を返す。', { reflect: 35 }),
      atk('sp_pierce', 'つらぬきトゲ', 16, ['shape:spiky'], '威力ひかえめ。ぼうぎょ無視。', { pierce: true }),

      // ===== 形：まる =====
      atk('ro_roll', 'ころがる', 26, ['shape:round'], '威力ふつう。まるまって転がり突撃。', { }),
      sup('ro_ball', 'まるまる', 0, ['shape:round'], '2ターン、受けるダメージが 半分に なる。', { guardPct: 65 }),
      sup('ro_puff', 'ふくらむ', 0, ['shape:round'], '3ターン、受けるダメージが 25% へる。', { buff: { stat: 'def', turns: 2 } }),

      // ===== 形：たて長 =====
      atk('ta_stretch', 'のびパンチ', 18, ['shape:tall'], '威力ひかえめ。必ず先制。', { first: true }),
      atk('ta_kick', 'ハイキック', 28, ['shape:tall'], '威力大。', { }),
      sup('ta_look', 'みおろす', 0, ['shape:tall'], 'すばやさアップ（2ターン）。', { buff: { stat: 'spd', turns: 2 } }),

      // ===== 形：よこ広 =====
      atk('wi_slam', 'のしかかり', 34, ['shape:wide', 'shape:big'], '威力特大。高確率でひるみ。', { status: { kind: 'flinch', chance: 0.6 } }),
      sup('wi_stance', 'どっしりかまえ', 0, ['shape:wide'], '2ターン、受けるダメージが 半分に なる。', { guardPct: 55 }),
      atk('wi_don', 'たいあたりドン', 30, ['shape:wide'], '威力大。全体重の体当たり。', { }),

      // ===== 形：大きい =====
      atk('bg_press', 'グランドプレス', 36, ['shape:big'], '威力特大。当てにくい。', { riskShift: 6 }),
      atk('bg_body', 'ボディブロー', 30, ['shape:big'], '威力大。ずしんと効く一発。', { }),
      sup('bg_weight', 'おもみ', 0, ['shape:big'], '3ターン、受けるダメージが 25% へる。', { buff: { stat: 'def', turns: 2 } }),

      // ===== 形：小さい =====
      atk('sm_jab', 'クイックジャブ', 16, ['shape:small'], '威力ひかえめ。小さく素早い一撃。', {}),
      atk('sm_dart', 'スニークムーブ', 17, ['shape:small'], '威力ひかえめ。必ず先制。', { first: true }),
      sup('sm_slip', 'すりぬけ', 0, ['shape:small'], 'すばやさアップ（回避も上がる）。', { buff: { stat: 'spd', turns: 2 } }),

      // ===== 形：左右対称 =====
      atk('sy_straight', 'せいけん', 26, ['shape:symmetric'], '威力ふつう。まっすぐ強い一撃。', {}),
      sup('sy_wall', 'てっぺき', 0, ['shape:symmetric'], '2ターン、受けるダメージが 半分に なる。', { guardPct: 80 }),
      atk('sy_balance', 'バランスアタック', 22, ['shape:symmetric'], '威力ふつう。くずれない構えから打つ。', {}),

      // ===== 形：非対称 =====
      atk('as_trick', 'トリッキー', 20, ['shape:asymmetric'], '威力ふつう。ときどき ねむらせる。', { status: { kind: 'sleep', chance: 0.35 } }),
      atk('as_swap', 'いれかわり', 18, ['shape:asymmetric'], '威力ひかえめ。不意をつく一撃。', {}),
      atk('as_weird', 'へんそくアタック', 24, ['shape:asymmetric'], '威力ふつう。クセのある一撃。', { }),

      // ===== 部位：目 =====
      atk('ey_see', 'みやぶり', 22, ['part:eyes'], '威力ふつう。ぼうぎょ無視。', { pierce: true }),
      sup('ey_glare', 'にらむ', 0, ['part:eyes'], '相手のこうげきを下げる（2ターン）。', { target: 'enemy', debuff: { stat: 'atk', turns: 2 } }),
      atk('ey_aim', 'ねらいうち', 26, ['part:eyes'], '威力ふつう。よく狙った一撃。', { }),
      sup('ey_read', 'よみのちから', 0, ['part:eyes'], 'きゅうしょアップ（3ターン）。', { buff: { stat: 'luck', turns: 3 } }),

      // ===== 部位：翼 =====
      atk('wg_dive', 'きゅうこうか', 26, ['part:wings'], '威力ふつう。必ず先制。', { first: true }),
      sup('wg_flap', 'はばたき', 0, ['part:wings'], 'すばやさを大きく上げる。', { buff: { stat: 'spd', turns: 2 } }),
      atk('wg_wind', 'かぜのやいば', 18, ['part:wings'], '威力ひかえめ。風の刃。', {}),
      sup('wg_soar', 'まいあがる', 0, ['part:wings'], 'すばやさアップ（回避も上がる）。', { buff: { stat: 'spd', turns: 2 } }),

      // ===== 雰囲気：好戦的 =====
      atk('fi_rampage', 'あばれる', 34, ['mood:fierce'], '威力特大。少し反動を受ける。', { recoil: 15 }),
      atk('fi_charge', 'とっしん', 26, ['mood:fierce'], '威力ふつう。必ず先制。', { first: true }),
      sup('fi_anger', 'いかり', 0, ['mood:fierce'], 'こうげきを大きく上げる（少し自分もやけど）。', { buff: { stat: 'atk', turns: 2 }, status: { kind: 'burn', chance: 0.3, toSelf: true } }),
      atk('fi_finish', 'とどめのキバ', 28, ['mood:fierce'], '威力大。弱った相手にとくに効く。', { }),

      // ===== 雰囲気：穏やか =====
      sup('ca_breath', 'ふかこきゅう', 0, ['mood:calm'], '状態異常を1つ治して少し回復。', { cures: 'one', heal: 15 }),
      sup('ca_heal', 'いやしのて', 0, ['mood:calm'], 'HPを大きく回復。', { heal: 34 }),
      sup('ca_watch', 'みまもる', 0, ['mood:calm'], '3ターン、受けるダメージが 25% へる。', { buff: { stat: 'def', turns: 2 } }),
      sup('ca_song', 'いやしのうた', 0, ['mood:calm'], '状態異常をすべて治す。', { cures: 'all' }),
      sup('ca_calm', 'こころをしずめる', 0, ['mood:calm'], '3ターン、受けるダメージが 25% へる。', { buff: { stat: 'def', turns: 2 } }),

      // ===== 装飾：カラフル =====
      atk('co_rainbow', 'にじいろだま', 24, ['deco:colorful'], '威力ふつう。ランダムな属性の弾。', { randomAttr: true }),
      sup('co_shine', 'きらめき', 0, ['deco:colorful'], 'きゅうしょアップ（3ターン）。', { buff: { stat: 'luck', turns: 3 } }),
      atk('co_prism', 'プリズム', 26, ['deco:colorful'], '威力ふつう。光の一撃。', { }),

      // ===== 装飾：シンプル =====
      atk('pl_simple', 'シンプルアタック', 28, ['deco:plain'], '威力大。まっすぐ強い一撃。', {}),
      sup('pl_focus', 'いっしんに', 0, ['deco:plain'], 'こうげきを大きく上げる（2ターン）。', { buff: { stat: 'atk', turns: 2 } }),
      atk('pl_true', 'まっすぐ', 22, ['deco:plain'], '威力ふつう。ぼうぎょ無視。', { pierce: true }),

      // ===== 持ち物：剣 =====
      atk('sw_cut', 'きりつける', 28, ['weapon:sword'], '威力大。鋭く斬る。', { }),
      atk('sw_rapid', 'れんぞくぎり', 14, ['weapon:sword'], '威力ひかえめ。素早く連続で斬る。', {}),
      atk('sw_great', 'だいせつだん', 37, ['weapon:sword'], '威力最大級。大振りで当てにくい。', { riskShift: 10 }),

      // ===== 持ち物：杖 =====
      atk('wd_bolt', 'まほうだん', 22, ['weapon:wand'], '威力ふつう。ぼうぎょ無視の魔法弾。', { pierce: true }),
      sup('wd_charge', 'チャージ', 0, ['weapon:wand'], '3ターン、こうげきが 3わり上がる。', { buff: { stat: 'atk', turns: 3 } }),
      atk('wd_mega', 'メガチャージ', 35, ['weapon:wand'], '威力特大。ぼうぎょ無視。当てにくい。', { pierce: true, riskShift: 6 }),

      // ===== 持ち物：盾 =====
      atk('sh_bash', 'シールドバッシュ', 18, ['weapon:shield'], '威力ひかえめ。殴りつつ 2ターン ダメージ半分。', { guardPct: 25 }),
      sup('sh_wall', 'ホーリーウォール', 0, ['weapon:shield'], '2ターン、受けるダメージが 半分に なる。', { guardPct: 85 }),
      sup('sh_counter', 'カウンター', 0, ['weapon:shield'], '2ターン、攻撃してきた相手に ダメージの 3わり を返す。', { reflect: 55 }),

      // ===== 汎用ユーティリティ（だれでも候補） =====
      sup('u_detox', 'デトックス', 0, ['utility'], '状態異常をすべて治す。', { cures: 'all' }),
      sup('u_endure', 'がまん', 0, ['utility'], '2ターン、受けるダメージ半分＋少し回復。', { guardPct: 40, heal: 10 }),
      atk('u_poison_needle', 'どくばり', 8, ['utility', 'shape:spiky'], '威力ひかえめ。高確率でどく。', { status: { kind: 'poison', chance: 0.9 } }),
    ] as MoveDef[]
  ).map((m) => [m.id, m]),
);

export function getMove(id: MoveId): MoveDef {
  const m = MOVES[id];
  if (!m) throw new Error(`未知のわざ: ${id}`);
  return m;
}

/**
 * わざの「強さ星」1〜3。リールで一目で強弱が分かるように。
 * 攻撃は威力で、補助は効果の大きさで判定する。
 */
export function moveStars(m: MoveDef): 1 | 2 | 3 {
  if (m.category === 'attack') {
    if (m.power >= 32) return 3;
    if (m.power >= 18) return 2;
    return 1;
  }
  const strong =
    (m.guardPct ?? 0) >= 70 ||
    (m.heal ?? 0) >= 28 ||
    m.cures === 'all' ||
    (m.reflect ?? 0) >= 50;
  if (strong) return 3;
  const mid =
    (m.guardPct ?? 0) >= 40 ||
    (m.heal ?? 0) >= 12 ||
    !!m.buff ||
    !!m.debuff ||
    m.cures === 'one' ||
    (m.reflect ?? 0) > 0;
  return mid ? 2 : 1;
}

/** 編成コスト＝強さ星（1〜3）。プレイヤーは合計 LOADOUT_BUDGET まで技を選べる。 */
export function moveCost(m: MoveDef): 1 | 2 | 3 {
  return moveStars(m);
}
/** 技セットの★予算（全員同じ固定）。 */
export const LOADOUT_BUDGET = 6;

/** 三すくみのカテゴリ。力＝重い一撃／技＝搦め手・補助／速さ＝軽い・先制。 */
export type MoveCategory3 = 'power' | 'tech' | 'speed';

/**
 * わざを 力／技／速さ に振り分ける（Phase 17 三すくみ）。
 * - 補助 → 技
 * - 先制わざ → 速さ
 * - 威力30以上 → 力
 * - 威力14以下 → 速さ（軽いジャブ。弱い属性技a1もここ）
 * - 状態異常／デバフ／ドレイン／貫通 → 技
 * - 威力18以下 → 速さ（軽い攻撃）
 * - それ以外 → 力
 */
export function moveCategory(m: MoveDef): MoveCategory3 {
  if (m.category === 'support') return 'tech';
  if (m.first) return 'speed';
  if (m.power >= 30) return 'power';
  if (m.power <= 14) return 'speed';
  if (m.status || m.debuff || m.drain || m.pierce) return 'tech';
  if (m.power <= 18) return 'speed';
  return 'power';
}

/** 補助わざを「何をする技か」の一言に。リール表示用。 */
export function supportKindWord(m: MoveDef): string {
  if (m.cures) return 'かいふく';
  if (m.heal) return 'かいふく';
  if (m.guardPct) return 'ぼうぎょ';
  if (m.reflect) return 'カウンター';
  if (m.debuff) return 'よわらせ';
  if (m.buff?.stat === 'atk') return 'こうげき↑';
  if (m.buff?.stat === 'def') return 'ぼうぎょ↑';
  if (m.buff?.stat === 'spd') return 'すばやさ↑';
  if (m.buff?.stat === 'luck') return 'きゅうしょ↑';
  return 'ほじょ';
}

export const ATTR_MOVE_TIERS: Record<Attribute, [MoveId, MoveId, MoveId]> = {
  fire: ['fire_a1', 'fire_a2', 'fire_a3'],
  water: ['water_a1', 'water_a2', 'water_a3'],
  wood: ['wood_a1', 'wood_a2', 'wood_a3'],
  bolt: ['bolt_a1', 'bolt_a2', 'bolt_a3'],
  dark: ['dark_a1', 'dark_a2', 'dark_a3'] };

export function attrMove(a: Attribute, skillLevel: number): MoveId {
  return ATTR_MOVE_TIERS[a][Math.max(0, Math.min(2, skillLevel - 1))];
}

/** ある unlock タグを持つ技（属性ライン tier は除く）。 */
export function movesByTag(tag: UnlockTag): MoveDef[] {
  return Object.values(MOVES).filter((m) => m.unlock.includes(tag) && !m.unlock.some((t) => t.startsWith('attr-tier:')));
}
