import type { Attribute, StatusKind, Stats } from '../types';

export type MoveId = string;

/** 条件で効果が変わる技の「条件」。 */
export type StatusLike = StatusKind | 'debuff' | 'buff';
export type Cond =
  | { t: 'foeHas'; kind: StatusLike }
  | { t: 'selfHas'; kind: StatusLike }
  | { t: 'foeHp'; below: number }
  | { t: 'selfHp'; below: number }
  | { t: 'first' }
  | { t: 'second' }
  | { t: 'foePick'; cat: 'attack' | 'support' }
  | { t: 'prev'; tag: string }
  | { t: 'foeCharging' };

/** 手札いじり。次のターンの手札に影響する。 */
export type HandPred = 'attack' | 'support' | 'guard' | 'heal' | 'first' | 'rare' | 'status';
export type HandEffect =
  | { kind: 'guarantee'; pred: HandPred; n: number }
  | { kind: 'extra'; n: number }
  | { kind: 'foeLess'; n: number }
  | { kind: 'luck' }
  /** あいての つぎの手札から、この種類のカードを出なくする。 */
  | { kind: 'ban'; pred: HandPred }
  /** あいての つぎの手札を、この種類のカードだけにする。 */
  | { kind: 'only'; pred: HandPred };

/** 場の効果（天気）。数ターン、属性わざが強く／弱くなる。 */
export type FieldKind = 'rain' | 'sun' | 'thunder' | 'night';

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
  /** 技の系統タグ（コンボ判定用。属性は自動で入る）。例: 'blow' 'slash' 'wind' 'trick'。 */
  tags?: string[];
  /** ため技：選んだターンは ちからを ためて（そのターンは むぼうび）、次のターンに 自動で はなつ。 */
  charge?: boolean;
  /** この条件を満たすと、効果（ダメージ・かいふく量）が whenMult 倍になる。 */
  when?: Cond;
  whenMult?: number;
  /** つかうと、次のターンの手札が変わる。 */
  hand?: HandEffect;
  /** 場の効果をはじめる（両者に効く）。 */
  field?: { kind: FieldKind; turns: number };
  /** バリア：最大HPの割合ぶん、ダメージを肩代わりする（こわれるか数ターンで消える）。 */
  barrier?: number;
  /** HPをはらって つかう（最大HPの割合。HPは1までしか へらない）。 */
  cost?: { hpPct: number };
  /** 数ターンあとに 発動：あいてに ダメージ／じぶんが かいふく（どちらも最大HPの割合）。 */
  delay?: { turns: number; damage?: number; heal?: number };
  /** あいてに わなをしかける：あいてが次にこうげきすると ダメージ（あいての最大HPの割合）＋状態異常。 */
  trap?: { damage: number; status?: { kind: StatusKind; chance: number } };
  /** みちづれ：このターンにやられたら、あいてにも大ダメージ。 */
  bond?: boolean;
  /** ふんばり：このターンは やられても HP1で のこる。 */
  endure?: boolean;
  /** あいてが えらんだ技を そのまま つかう。 */
  copy?: boolean;
  /** HPの割合を入れ替え／じぶんの状態異常をあいてにうつす／あいての強化をうばう。 */
  swap?: 'hp' | 'debuffs' | 'steal';
  /** さいころ：威力が ランダム（min〜max を6段階）。 */
  dice?: [number, number];
  /** コイン：おもてなら こうげき、うらなら じぶんがダメージ（最大HPの割合）。 */
  coin?: { selfPct: number };
  /** いちかばちか：この確率で成功（失敗はなにも起きない）。 */
  allOrNothing?: number;
  /** みきり：あいてが こうげきを選んでいたら、それをふせいで はんげき（威力）。 */
  read?: { power: number };
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

/** 条件の かんたんな書き方。 */
const FOE_HAS = (kind: StatusLike): Cond => ({ t: 'foeHas', kind });
const PREV = (tag: string): Cond => ({ t: 'prev', tag });

export const MOVES: Record<MoveId, MoveDef> = Object.fromEntries(
  (
    [
      // ============================================================
      //  ふつうのわざ（だれでも・基本）
      // ============================================================
      atk('c_scratch', 'ひっかき', 14, 'ちいさな ダメージ。かすりにくい。', { riskShift: -8, tags: ['claw'] }),
      atk('c_tackle', 'たいあたり', 22, 'ふつうの たいあたり。', { tags: ['blow'] }),
      atk('c_bite', 'かみつき', 30, 'つよい かみつき。', { tags: ['bite'] }),
      atk('c_headbutt', 'ずつき', 26, '25% で ひるみ。', { tags: ['blow'], status: { kind: 'flinch', chance: 0.25 } }),
      atk('c_twin', 'ふたごのツメ', 14, '2かい つづけて ひっかく。', { hits: 2, tags: ['claw'] }),
      atk('c_rush', 'ラッシュ', 6, '5かい つづけて たたく。', { hits: 5, tags: ['blow'] }),
      atk('c_onetwo', 'ワンツーパンチ', 20, 'まえのターンに「たたく」わざを つかうと 1.8ばい。', { tags: ['blow'], when: PREV('blow'), whenMult: 1.8 }),
      atk('c_counterpunch', 'カウンターパンチ', 22, 'まえのターンに まもっていたら 2ばい。', { tags: ['blow'], when: PREV('guard'), whenMult: 2 }),
      atk('c_desperate', 'ひっしのいちげき', 24, '自分の HPが はんぶん いかだと 1.8ばい。', { when: { t: 'selfHp', below: 0.5 }, whenMult: 1.8 }),
      atk('c_foresight', 'よみうち', 22, 'あいてが ほじょわざを えらんでいたら 1.8ばい。', { when: { t: 'foePick', cat: 'support' }, whenMult: 1.8 }),
      atk('c_late', 'うしろだち', 24, '先に うごけなかったときだけ 1.5ばい。', { when: { t: 'second' }, whenMult: 1.5 }),
      atk('c_lead', 'せんてひっしょう', 22, '先に うごけたとき 1.5ばい。', { when: { t: 'first' }, whenMult: 1.5 }),
      atk('c_breakcharge', 'ためつぶし', 22, 'ためている あいてに 2ばい。', { when: { t: 'foeCharging' }, whenMult: 2, tags: ['blow'] }),

      // 先に うごく
      atk('sm_dart', 'スニークムーブ', 16, 'かならず 先に うごく。', { first: true, tags: ['quick'] }),
      atk('wg_dive', 'きゅうこうか', 24, 'かならず 先に うごく。', { first: true, tags: ['wind'] }),
      atk('fi_charge', 'とっしん', 30, '先に うごく。そのかわり 反動を うける。', { first: true, recoil: 20, tags: ['blow'] }),
      atk('as_sucker', 'ふいうち', 32, 'あいてが こうげきを えらんだときだけ 先に きまる。ほかは しっぱい。', { first: true, ambush: true, tags: ['trick'] }),
      atk('c_quickdraw', 'はやうち', 18, '先に うごく。つぎの手札に こうげきが 1まい 来る。', { first: true, hand: { kind: 'guarantee', pred: 'attack', n: 1 } }),

      // くせのある技
      atk('sw_rapid', 'れんぞくぎり', 9, '3かい つづけて きる。', { hits: 3, tags: ['slash'] }),
      atk('sw_cut', 'きりつける', 28, 'するどく きる。', { tags: ['slash'] }),
      atk('sw_x', 'クロスカッター', 12, '2かい。まえのターンに きる技なら 1.7ばい。', { hits: 2, tags: ['slash'], when: PREV('slash'), whenMult: 1.7 }),
      atk('sw_great', 'だいせつだん', 37, 'とても つよいが かすりやすい。', { riskShift: 10, tags: ['slash'] }),
      atk('ey_aim', 'ねらいうち', 24, 'きゅうしょに あたりやすい。', { critBoost: 0.35 }),
      atk('ey_snipe', 'スナイプ', 26, 'あいての ぼうぎょを むし。きゅうしょに あたりやすい。', { pierce: true, critBoost: 0.2 }),
      atk('fi_finish', 'とどめのキバ', 26, 'あいての HPが 4わり いかだと 1.7ばいの ダメージ。', { execute: 1.7, tags: ['bite'] }),
      atk('wd_bolt', 'まほうだん', 22, 'あいての ぼうぎょを むしする。', { pierce: true }),
      atk('wd_mega', 'メガチャージ', 35, 'ぼうぎょを むし。つよいが かすりやすい。', { pierce: true, riskShift: 6 }),
      atk('fi_rampage', 'あばれる', 34, 'つよい。そのかわり 反動を うける。', { recoil: 15, tags: ['blow'] }),
      atk('wi_slam', 'のしかかり', 34, '60% で ひるみ。', { status: { kind: 'flinch', chance: 0.6 }, tags: ['blow'] }),
      atk('sp_horn', 'つのアタック', 30, '50% で ひるみ。つぎの こうげきが かすりに なる。', { status: { kind: 'flinch', chance: 0.5 } }),
      atk('as_trick', 'トリッキー', 20, '35% で ねむらせる。', { status: { kind: 'sleep', chance: 0.35 }, tags: ['trick'] }),
      atk('u_poison_needle', 'どくばり', 10, 'ほぼ かならず どく。', { status: { kind: 'poison', chance: 0.9 }, tags: ['trick'] }),
      atk('co_rainbow', 'にじいろだま', 24, 'ランダムな ぞくせいと じょうたいいじょう。', { randomAttr: true }),
      atk('c_vampire', 'ちゅうちゅう', 20, 'ダメージの 半分を かいふく。', { drain: 50, tags: ['bite'] }),
      atk('c_scorch', 'つけこむ', 18, 'あいてが なにか じょうたいいじょうなら 2ばい。', { when: FOE_HAS('debuff'), whenMult: 2, tags: ['trick'] }),
      atk('c_bully', 'いじわる', 20, 'あいてが バフ中なら 1.8ばい。', { when: FOE_HAS('buff'), whenMult: 1.8, tags: ['trick'] }),

      // ため技（つぎのターンに どかん）
      atk('ch_megapunch', 'メガトンパンチ', 62, 'ためて つぎのターンに どかん！ ためている間は むぼうび。', { charge: true, tags: ['blow'] }),
      atk('ch_rollout', 'ころがりアタック', 60, 'ためて つぎのターンに 60% で ひるみ。', { charge: true, status: { kind: 'flinch', chance: 0.6 }, tags: ['blow'] }),
      atk('ch_skyfall', 'そらからダイブ', 58, 'ためて つぎのターンに ぼうぎょ無視。', { charge: true, pierce: true, tags: ['wind'] }),
      atk('ch_bigslash', 'おおぶりきり', 64, 'ためて つぎのターンに 大きく きる。かすりやすい。', { charge: true, riskShift: 4, tags: ['slash'] }),
      sup('ch_pray', 'ねんじゅういのり', 'ためて つぎのターンに HPを おおきく かいふく＋じょうたいを ぜんぶ なおす。', { charge: true, heal: 60, cures: 'all' }),

      // ============================================================
      //  ほのお（やけど・もえひろがる）
      // ============================================================
      atk('f_spark', 'ひのこ', 14, '45% で やけど。', { attribute: 'fire', status: { kind: 'burn', chance: 0.45 } }),
      atk('fire_a2', 'かえん', 24, '60% で やけど。', { attribute: 'fire', status: { kind: 'burn', chance: 0.6 } }),
      atk('f_whirl', 'ほのおのうず', 10, '2かい。1かいごとに 30% で やけど。', { attribute: 'fire', hits: 2, status: { kind: 'burn', chance: 0.3 } }),
      atk('f_spread', 'もえひろがる', 20, 'あいてが やけどなら 1.8ばい。', { attribute: 'fire', when: FOE_HAS('burn'), whenMult: 1.8 }),
      atk('f_blaze', 'もえさかる', 26, 'まえのターンに ほのお技を つかうと 1.5ばい。', { attribute: 'fire', when: PREV('fire'), whenMult: 1.5 }),
      atk('f_burnout', 'やきつくす', 24, 'あいての HPが 4わり いかだと 1.5ばい。50% で やけど。', { attribute: 'fire', execute: 1.5, status: { kind: 'burn', chance: 0.5 } }),
      atk('ch_inferno', 'ごうかのたま', 56, 'ためて つぎのターンに 90% で やけど。', { attribute: 'fire', charge: true, status: { kind: 'burn', chance: 0.9 } }),
      atk('fire_sig', 'フレアバスター', 36, 'ぼうぎょ無視。かならず やけど。', { attribute: 'fire', pierce: true, riskShift: 6, status: { kind: 'burn', chance: 1 } }),
      sup('f_stoke', 'ひをおこす', '3ターン、こうげきが 5わり あがる。つぎの手札に こうげきが 1まい 来る。', { attribute: 'fire', buff: { stat: 'atk', turns: 3 }, hand: { kind: 'guarantee', pred: 'attack', n: 1 } }),
      sup('fire_dry', 'ねっぷう', 'こおりや どくを ふきとばして かいふく。', { attribute: 'fire', cures: 'one', heal: 14 }),

      // ============================================================
      //  みず（こおり・かいふく・ながれ）
      // ============================================================
      atk('w_gun', 'みずでっぽう', 14, 'かならず 先に うごく。', { attribute: 'water', first: true }),
      atk('water_a2', 'すいりゅう', 24, '40% で こおり。うごけなくする。', { attribute: 'water', status: { kind: 'freeze', chance: 0.4 } }),
      atk('w_wave', 'なみうち', 22, '60% で すばやさを さげる。', { attribute: 'water', status: { kind: 'spdDown', chance: 0.6 } }),
      atk('w_icicle', 'つららおとし', 24, '30% で こおり。あいての すばやさが さがっていたら 1.9ばい。', { attribute: 'water', status: { kind: 'freeze', chance: 0.3 }, when: FOE_HAS('spdDown'), whenMult: 1.9 }),
      atk('w_steam', 'じょうきばくはつ', 20, 'まえのターンに みず技を つかうと 1.9ばい。', { attribute: 'fire', when: PREV('water'), whenMult: 1.9 }),
      atk('ch_whirlpool', 'しおのうず', 54, 'ためて つぎのターンに 50% で こおり。', { attribute: 'water', charge: true, status: { kind: 'freeze', chance: 0.5 } }),
      atk('water_sig', 'アクアカノン', 36, 'ぼうぎょ無視。80% で こおり。', { attribute: 'water', pierce: true, status: { kind: 'freeze', chance: 0.8 } }),
      sup('water_wash', 'みずであらう', 'じょうたいいじょうを ぜんぶ なおして かいふく。', { attribute: 'water', cures: 'all', heal: 16 }),
      sup('w_spring', 'わきみず', '自分が じょうたいいじょうなら かいふくが 1.6ばい。', { attribute: 'water', heal: 22, when: { t: 'selfHas', kind: 'debuff' }, whenMult: 1.6 }),
      sup('w_wall', 'うしおのかべ', '先に うごく。2ターン ダメージ半分。じょうたいいじょうを 1つ なおす。', { attribute: 'water', guardPct: 50, cures: 'one' }),
      sup('w_bubble', 'あわのたて', 'あいての こうげきを さげて 少し かいふく。', { attribute: 'water', heal: 10, target: 'enemy', debuff: { stat: 'atk', turns: 2 } }),

      // ============================================================
      //  き（どく・まもり・じわじわ）
      // ============================================================
      atk('k_sprout', 'めばえ', 14, '45% で どく。', { attribute: 'wood', status: { kind: 'poison', chance: 0.45 } }),
      atk('wood_a2', 'いばらムチ', 24, '60% で どく。', { attribute: 'wood', status: { kind: 'poison', chance: 0.6 } }),
      atk('k_seed', 'たねマシンガン', 6, '4かい。1かいごとに 20% で どく。', { attribute: 'wood', hits: 4, status: { kind: 'poison', chance: 0.2 } }),
      atk('k_vine', 'くいこむつる', 20, 'あいてが どくなら 1.8ばい。', { attribute: 'wood', when: FOE_HAS('poison'), whenMult: 1.8 }),
      atk('k_burn', 'もえうつる', 22, 'まえのターンに ほのお技を つかうと 1.8ばい。', { attribute: 'wood', when: PREV('fire'), whenMult: 1.8 }),
      atk('ch_wrath', 'もりのいかり', 56, 'ためて つぎのターンに 70% で どく。', { attribute: 'wood', charge: true, status: { kind: 'poison', chance: 0.7 } }),
      atk('wood_sig', 'ジャングルバインド', 34, 'かならず どく。', { attribute: 'wood', status: { kind: 'poison', chance: 1 } }),
      sup('wood_root', 'ねをはる', '先に うごく。3ターン、うけるダメージ 40%へらす。少し かいふく。', { attribute: 'wood', buff: { stat: 'def', turns: 3 }, heal: 10 }),
      sup('k_komorebi', 'こもれび', 'HPが はんぶん いかなら かいふくが 1.7ばい。', { attribute: 'wood', heal: 20, when: { t: 'selfHp', below: 0.5 }, whenMult: 1.7 }),
      sup('k_thorns', 'いばらのよろい', '先に うごく。2ターン、ダメージ半分＋攻撃してきた あいてに 半分を かえす。', { attribute: 'wood', guardPct: 50, reflect: 50 }),
      sup('k_powder', 'どくのこな', '90% で あいてを どくに する。', { attribute: 'wood', target: 'enemy', status: { kind: 'poison', chance: 0.9 } }),

      // ============================================================
      //  かみなり（せんせい・まひ・きゅうしょ）
      // ============================================================
      atk('b_zap', 'ぴりぴり', 12, 'かならず 先に うごく。25% で まひ。', { attribute: 'bolt', first: true, status: { kind: 'paralysis', chance: 0.25 } }),
      atk('bolt_a2', 'いなずま', 24, '55% で まひ。', { attribute: 'bolt', status: { kind: 'paralysis', chance: 0.55 } }),
      atk('b_flash', 'でんこうれんだ', 9, '先に うごく。2かい。', { attribute: 'bolt', first: true, hits: 2 }),
      atk('b_spear', 'いかずちのやり', 20, 'まえのターンに みず技を つかうと 1.9ばい（ぬれて でんきが とおる）。', { attribute: 'bolt', when: PREV('water'), whenMult: 1.9 }),
      atk('b_shock', 'ちょくげき', 22, 'あいてが まひなら 1.8ばい。', { attribute: 'bolt', when: FOE_HAS('paralysis'), whenMult: 1.8 }),
      atk('b_spark2', 'おくれてスパーク', 24, '先に うごけなかったとき 1.5ばい。', { attribute: 'bolt', when: { t: 'second' }, whenMult: 1.5 }),
      atk('b_rising', 'ライジングショット', 26, 'きゅうしょに とても あたりやすい。', { attribute: 'bolt', critBoost: 0.4 }),
      atk('ch_thunder', 'らいめい', 58, 'ためて つぎのターンに 80% で まひ。', { attribute: 'bolt', charge: true, status: { kind: 'paralysis', chance: 0.8 } }),
      atk('bolt_sig', 'サンダーレイド', 32, '先に うごく。90% で まひ。', { attribute: 'bolt', first: true, status: { kind: 'paralysis', chance: 0.9 } }),
      sup('b_static', 'せいでんき', '3ターン、すばやさ 5わり あがる。つぎの手札に 先に うごく技が 1まい 来る。', { attribute: 'bolt', buff: { stat: 'spd', turns: 3 }, hand: { kind: 'guarantee', pred: 'first', n: 1 } }),
      sup('b_flashidea', 'ひらめき', '3ターン、きゅうしょに とても あたりやすい。つぎの手札が 1まい ふえる。', { attribute: 'bolt', buff: { stat: 'luck', turns: 3 }, hand: { kind: 'extra', n: 1 } }),

      // ============================================================
      //  やみ（こんらん・ねむり・すいとり・てふだくずし）
      // ============================================================
      atk('d_shadow', 'かげぬい', 14, '40% で こんらん。', { attribute: 'dark', status: { kind: 'confuse', chance: 0.4 } }),
      atk('dark_a2', 'やみのやいば', 24, '55% で こんらん。', { attribute: 'dark', status: { kind: 'confuse', chance: 0.55 }, tags: ['slash'] }),
      atk('d_sneak', 'かげのしのび', 18, '先に うごく。60% で すばやさを さげる。', { attribute: 'dark', first: true, status: { kind: 'spdDown', chance: 0.6 } }),
      atk('d_eatdream', 'ゆめくい', 20, 'あいてが じょうたいいじょうなら 1.7ばい。ダメージの 半分を かいふく。', { attribute: 'dark', drain: 50, when: FOE_HAS('debuff'), whenMult: 1.7 }),
      atk('d_curse', 'のろいのつめ', 22, 'まえのターンに やみ技を つかうと 1.8ばい。', { attribute: 'dark', when: PREV('dark'), whenMult: 1.8, tags: ['claw'] }),
      atk('ch_blackhole', 'ブラックホール', 54, 'ためて つぎのターンに すいとり＋50% で こんらん。', { attribute: 'dark', charge: true, drain: 40, status: { kind: 'confuse', chance: 0.5 } }),
      atk('dark_sig', 'ドレインバイト', 32, 'ダメージの 半分を かいふく。50% で こんらん。', { attribute: 'dark', drain: 55, status: { kind: 'confuse', chance: 0.5 }, tags: ['bite'] }),
      sup('d_lullaby', 'ねむりのうた', '55% で あいてを ねむらせる。', { attribute: 'dark', target: 'enemy', status: { kind: 'sleep', chance: 0.55 } }),
      sup('d_scramble', 'てふだくずし', 'あいての つぎの手札を 1まい へらす。', { attribute: 'dark', target: 'enemy', hand: { kind: 'foeLess', n: 1 } }),
      sup('d_moonpray', 'よるのいのり', 'あいてが じょうたいいじょうなら かいふくが 1.7ばい。', { attribute: 'dark', heal: 22, when: FOE_HAS('debuff'), whenMult: 1.7 }),
      sup('d_hex', 'おまじない', 'あいての ぼうぎょを 2ターン さげる。つぎの手札に 大技が 来やすい。', { attribute: 'dark', target: 'enemy', debuff: { stat: 'def', turns: 2 }, hand: { kind: 'luck' } }),

      // ============================================================
      //  ほじょ：まもり（先に うごく）
      // ============================================================
      sup('c_guard', 'ガード', '先に うごく。2ターン、うけるダメージが 半分。', { guardPct: 50 }),
      sup('sh_counter', 'カウンター', '先に うごく。2ターン、こうげきしてきた あいてに ダメージの 半分を かえす。', { reflect: 35 }),
      sup('c_roll', 'まるまる', '先に うごく。2ターン、ダメージ半分。少し かいふく。', { guardPct: 50, heal: 8 }),
      sup('c_dodge', 'みがまえ', '先に うごく。3ターン ダメージ 40%へらす。つぎの手札に まもりが 1まい 来る。', { buff: { stat: 'def', turns: 3 }, hand: { kind: 'guarantee', pred: 'guard', n: 1 } }),

      // ============================================================
      //  ほじょ：かいふく
      // ============================================================
      sup('ca_heal', 'いやしのて', 'HPを おおきく かいふく。', { heal: 34 }),
      sup('ca_breath', 'ふかこきゅう', 'じょうたいいじょうを 1つ なおして かいふく。', { cures: 'one', heal: 15 }),
      sup('u_detox', 'デトックス', 'じょうたいいじょうを ぜんぶ なおす。', { cures: 'all' }),
      sup('c_onigiri', 'おにぎり', 'HPを ふつうに かいふく。つぎの手札が 1まい ふえる。', { heal: 20, hand: { kind: 'extra', n: 1 } }),
      sup('c_rest', 'ひとやすみ', '自分の HPが 3わり いかなら かいふくが 2ばい。', { heal: 20, when: { t: 'selfHp', below: 0.3 }, whenMult: 2 }),
      sup('c_lunch', 'あとのおたのしみ', 'まえのターンに まもっていたら かいふくが 1.8ばい。', { heal: 22, when: PREV('guard'), whenMult: 1.8 }),

      // ============================================================
      //  ほじょ：じぶんを つよくする
      // ============================================================
      sup('c_focus', 'きあいだめ', '3ターン、こうげきが 5わり あがる。', { buff: { stat: 'atk', turns: 3 } }),
      sup('wg_flap', 'はばたき', '3ターン、すばやさが 5わり あがる。かわしやすい。', { buff: { stat: 'spd', turns: 3 } }),
      sup('ey_read', 'よみのちから', '3ターン、きゅうしょに とても あたりやすい。', { buff: { stat: 'luck', turns: 3 } }),
      sup('c_wish', 'ねがいごと', 'つぎの手札に 大技・ため技が 来やすい。', { hand: { kind: 'luck' } }),
      sup('c_gather', 'みちびき', 'つぎの手札に こうげきが 2まい 来る。', { hand: { kind: 'guarantee', pred: 'attack', n: 2 } }),
      sup('c_ward', 'おまもり', 'つぎの手札に かいふくが 1まい 来る。', { hand: { kind: 'guarantee', pred: 'heal', n: 1 } }),

      // ============================================================
      //  ほじょ：あいてを よわらせる
      // ============================================================
      sup('ey_glare', 'にらむ', 'あいての こうげきを 2ターン さげる。', { target: 'enemy', debuff: { stat: 'atk', turns: 2 } }),
      sup('ta_look', 'みおろす', 'あいての すばやさを 2ターン さげる。', { target: 'enemy', debuff: { stat: 'spd', turns: 2 } }),
      sup('bg_roar', 'ほえる', 'あいてが うけるダメージを 2ターン 3わり ふやす。', { target: 'enemy', debuff: { stat: 'def', turns: 2 } }),
      sup('c_disturb', 'じゃまをする', 'あいての つぎの手札を 1まい へらす。', { target: 'enemy', hand: { kind: 'foeLess', n: 1 } }),

      // ============================================================
      //  とくしゅ：場の効果（天気）
      // ============================================================
      sup('f_rain', 'あまごい', '4ターン あめ：みず技が 強く、ほのお技が 弱くなる（りょうほうに こうか）。', { attribute: 'water', field: { kind: 'rain', turns: 4 } }),
      sup('f_sun', 'ひでり', '4ターン はれ：ほのお技が 強く、みず技が 弱くなる（りょうほうに こうか）。', { attribute: 'fire', field: { kind: 'sun', turns: 4 } }),
      sup('f_thunder', 'かみなりぐも', '4ターン らいうん：かみなり技が 強く、き技が 弱くなる（りょうほうに こうか）。', { attribute: 'bolt', field: { kind: 'thunder', turns: 4 } }),
      sup('f_night', 'よぞらのまじない', '4ターン よる：やみ技が 強く、かみなり技が 弱くなる（りょうほうに こうか）。', { attribute: 'dark', field: { kind: 'night', turns: 4 } }),

      // ============================================================
      //  とくしゅ：バリア・みがわり
      // ============================================================
      sup('br_sub', 'みがわり', 'HPを 12% はらって、大きな バリアを はる。', { barrier: 0.42, cost: { hpPct: 0.12 } }),
      sup('br_magic', 'マジックバリア', '先に うごく。バリアを はる。', { barrier: 0.3, first: true }),
      sup('br_ice', 'こおりのかべ', 'バリアを はって、じょうたいいじょうを 1つ なおす。', { attribute: 'water', barrier: 0.34, cures: 'one' }),

      // ============================================================
      //  とくしゅ：時限・わな
      // ============================================================
      sup('tm_bomb', 'じげんばくだん', '2ターンあと、あいてに 大ダメージ（さいだいHPの 3.6わり）。', { delay: { turns: 2, damage: 0.36 } }),
      sup('tm_trap', 'まきびし', 'あいてが つぎに こうげきすると ダメージ＋すばやさダウン。', { trap: { damage: 0.14, status: { kind: 'spdDown', chance: 1 } } }),
      sup('tm_gift', 'おくりもの', '2ターンあと、HPが 大きく かいふくする。', { delay: { turns: 2, heal: 0.45 } }),

      // ============================================================
      //  とくしゅ：いのちがけ
      // ============================================================
      atk('sc_life', 'いのちがけアタック', 52, 'HPを 28% はらって、とても強く うつ。', { cost: { hpPct: 0.28 }, tags: ['blow'] }),
      sup('sc_bond', 'みちづれ', '先に うごく。このターンに やられたら、あいても 大ダメージ。', { bond: true }),
      sup('sc_endure', 'ふんばり', '先に うごく。このターンは やられても HP1で のこる。', { endure: true }),

      // ============================================================
      //  とくしゅ：まねる・ふうじる
      // ============================================================
      sup('cp_copy', 'まねっこ', 'あいてが えらんだ技を そのまま つかう。', { copy: true }),
      sup('cp_nobig', 'だいわざふうじ', 'あいての つぎの手札に 大技・ため技が 出なくなる。', { target: 'enemy', hand: { kind: 'ban', pred: 'rare' } }),
      sup('cp_noguard', 'まもりふうじ', 'あいての つぎの手札に まもりが 出なくなる。', { target: 'enemy', hand: { kind: 'ban', pred: 'guard' } }),

      // ============================================================
      //  とくしゅ：いれかえ
      // ============================================================
      sup('sw_heart', 'ハートスワップ', 'じぶんと あいての HPの わりあいを いれかえる。', { swap: 'hp' }),
      sup('sw_dump', 'やっかいばらい', 'じぶんの じょうたいいじょうを ぜんぶ あいてに うつす。', { swap: 'debuffs' }),
      sup('sw_steal', 'ものぬすみ', 'あいての 強化（バフ）を うばって じぶんのものにする。', { swap: 'steal' }),

      // ============================================================
      //  とくしゅ：ギャンブル
      // ============================================================
      atk('gm_dice', 'さいころアタック', 10, 'さいころの目で 威力が かわる（弱い〜とても強い）。', { dice: [6, 44] }),
      atk('gm_coin', 'コイントス', 50, 'おもてなら 大ダメージ。うらなら じぶんが 15% ダメージ。', { coin: { selfPct: 0.15 } }),
      atk('gm_all', 'いちかばちか', 64, '45% で 大成功。はずれたら なにも おきない。', { allOrNothing: 0.45 }),

      // ============================================================
      //  とくしゅ：きょうせい・よみ
      // ============================================================
      sup('fc_taunt', 'ちょうはつ', 'あいての つぎの手札が こうげきだけに なる。', { target: 'enemy', hand: { kind: 'only', pred: 'attack' } }),
      sup('fc_read', 'みきり', '先に うごく。あいてが こうげきなら ふせいで 30の はんげき。', { read: { power: 30 } }),
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
  return m.charge === true || (m.category === 'attack' && m.power >= 34);
}

/** 技のコンボ用タグ（属性・系統・まもり/かいふく/ため を自動で含む）。 */
export function moveTags(m: MoveDef): string[] {
  const t = new Set<string>(m.tags ?? []);
  if (m.attribute) t.add(m.attribute);
  if (m.guardPct || m.reflect || (m.buff && m.buff.stat === 'def')) t.add('guard');
  if (m.heal || m.cures) t.add('heal');
  if (m.charge) t.add('charge');
  if (m.first) t.add('quick');
  return [...t];
}

/** 手札いじりの「このタイプのカードを保証」の判定。 */
export function matchesPred(m: MoveDef, pred: HandPred): boolean {
  switch (pred) {
    case 'attack': return m.category === 'attack';
    case 'support': return m.category === 'support';
    case 'guard': return !!(m.guardPct || m.reflect || m.barrier || (m.buff && m.buff.stat === 'def'));
    case 'heal': return !!(m.heal || m.cures);
    case 'first': return hasPriority(m);
    case 'rare': return isRareMove(m) || !!m.charge;
    case 'status': return !!m.status && !m.status.toSelf;
  }
}

export function hasPriority(m: MoveDef): boolean {
  return !!(m.first || m.guardPct || m.reflect || m.bond || m.endure || m.read || (m.buff && m.buff.stat === 'def'));
}
