/**
 * ゲーム全体で共有する型。UIには依存しない。
 */

/** 5属性。企画書どおり火・水・木・雷・闇で確定。 */
export type Attribute = 'fire' | 'water' | 'wood' | 'bolt' | 'dark';

export const ATTRIBUTES: readonly Attribute[] = ['fire', 'water', 'wood', 'bolt', 'dark'];

/**
 * ステータス6軸（＋属性）。
 * - hp    体力
 * - atk   ちから：火力＋きめルーレットを強い枠へ寄せる
 * - def   まもり：被ダメージ軽減
 * - spd   すばやさ：行動順・先制・回避
 * - luck  こううん：クリティカル／ひっさつ枠の出やすさ・状態異常耐性
 * - heart こころ：与える状態異常の強さ・回復量・瀕死での火力アップ・ひっさつ成功率
 */
export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  luck: number;
  heart: number;
}

/** 状態異常の種類。 */
export type StatusKind =
  // ポケモン定番6つ
  | 'burn' // やけど
  | 'paralysis' // まひ
  | 'freeze' // こおり
  | 'sleep' // ねむり
  | 'poison' // どく
  | 'confuse' // こんらん
  // バフ・デバフ・構え
  | 'atkUp'
  | 'defUp'
  | 'spdUp'
  | 'luckUp'
  | 'atkDown'
  | 'defDown'
  | 'spdDown'
  | 'flinch'
  | 'guard'
  | 'thorns'
  | 'charging'
  | 'bond'
  | 'endure';

/** 持ち物（用紙のチェック欄／解析）。 */
export type Weapon = 'sword' | 'wand' | 'shield' | 'wing';

/** 解析の根拠。リビール画面でそのまま表示する。 */
export interface AnalysisReason {
  key: string;
  label: string;
  detected: string;
  effect: string;
}

/** 生成されたキャラ1体。 */
export interface Character {
  id: string;
  name: string;
  createdAt: number;
  imageRef?: string;
  sourceImageRef?: string;
  attribute: Attribute;
  weapon: Weapon;
  personality: 'aggressive' | 'calm';
  baseStats: Stats;
  /** このキャラの技（4つ。毎ターン このなかから1つがランダムに出る）。 */
  moveIds: string[];
  /** それぞれの技が「なぜ この技なのか」（moveIds と同じ順。古いセーブには ない）。 */
  moveReasons?: string[];
  /** 何の絵か（AI が 見た もの。「うさぎ」など）。 */
  motif?: string;
  /** 技えらび（4回。1回ずつ おなじ 強さで 役わりが ちがう 3枚から 1枚）。えらんだら moveIds[回] を かえる。 */
  moveRounds?: { title: string; options: { id: string; reason: string }[] }[];
  /** タイプ（たたかいかた）。ステータスの 形と 得意な 技が きまる。古い セーブには ない。 */
  style?: BattleStyle;
  /** とくせい（とくべつな 得意・苦手。つよさの 合計は かわらない）。ない キャラも いる。 */
  quirk?: { id: string; name: string; plus: string; minus: string; why: string };
  /** こせい（パッシブ＋専用アクティブ）のID。絵の特徴で決まる。 */
  koseiId: string;
  /** こせい名の前につく二つ名（例「あばれん坊の」）。表示上の個性を増やす。 */
  koseiTitle?: string;
  analysis: AnalysisReason[];
  seed: number;
  wins: number;
  losses: number;
  isCpu?: boolean;
}

/** キャラの タイプ（たたかいかた）：パワー・かたい・すばやい・まほう・バランス。 */
export type BattleStyle = 'power' | 'guard' | 'speed' | 'magic' | 'balance';
