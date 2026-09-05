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
  | 'burn'
  | 'shock'
  | 'wet'
  | 'bind'
  | 'curse'
  | 'poison'
  | 'confuse'
  | 'atkUp'
  | 'defUp'
  | 'spdUp'
  | 'luckUp'
  | 'atkDown'
  | 'defDown'
  | 'spdDown'
  | 'flinch';

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
  /** 覚えている技のID（5〜8個）。属性技は skillLevel でどの段階が入るか決まる。 */
  moveIds: string[];
  /** こせい（パッシブ＋専用アクティブ）のID。絵の特徴で決まる。 */
  koseiId: string;
  /** 属性技の段階 1〜3（進化で上がる）。 */
  skillLevel: number;
  analysis: AnalysisReason[];
  seed: number;
  wins: number;
  losses: number;
  isCpu?: boolean;
}
