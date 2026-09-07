/**
 * AI Vision（Claude 画像解析）が返す「構造化した特徴」→ キャラ変換。
 *
 * AI は数値（ステータス）を返さない。**絵をどう見たか**を 0..1 のスコアと enum で報告し、
 * 既存の featuresToCharacter（ピクセル解析と同じ下流）がそれをキャラに変換する。
 * ＝ AI は「ピクセル特徴抽出」だけを賢く置き換える。ネット断のときはピクセル解析にフォールバック。
 */
import type { Attribute, Weapon } from '../types';
import { ATTRIBUTE_META } from '../attributes';
import type { Character } from '../types';
import type { FeatureVector } from './features';
import { featuresToCharacter } from './toCharacter';

export const AI_ATTRIBUTES: Attribute[] = ['fire', 'water', 'wood', 'bolt', 'dark'];
export const AI_WEAPONS: (Weapon | 'none')[] = ['sword', 'wand', 'shield', 'wing', 'none'];

/** AI が絵から読み取る特徴。数値は 0..1（明記あるものを除く）。 */
export interface AiFeatures {
  /** 属性（メインカラーと雰囲気から）。 */
  attribute: Attribute;
  attributeReason: string;
  /** 体つき・持ち物。none は素手。 */
  weapon: Weapon | 'none';
  /** 縦横比 w/h。0.3（とても縦長）〜2.0（とても横長）。1で正方形。 */
  aspectRatio: number;
  /** 画面に対する絵の大きさ・塗りの量。0（点）〜1（画面いっぱい）。 */
  coverage: number;
  /** 輪郭のとがり具合。0（まんまる）〜1（トゲトゲ）。 */
  spikiness: number;
  /** 左右対称性。0（バラバラ）〜1（きれいに左右対称）。 */
  symmetry: number;
  /** 塗りの詰まり具合。0（線だけ・すきま多い）〜1（ぎっしり）。 */
  fillDensity: number;
  /** 色の鮮やかさ。0（グレー）〜1（ビビッド）。 */
  saturation: number;
  /** 明るさ。0（真っ黒）〜1（真っ白/明るい）。 */
  brightness: number;
  /** 目立つ色の数。1〜6の整数。 */
  colorCount: number;
  /** はっきりした目の数。0〜6の整数。 */
  eyeCount: number;
  /** 性格。好戦的 or おだやか。 */
  temperament: 'aggressive' | 'calm';
  /** 名前（カタカナ中心・4〜7字くらい）。 */
  name: string;
  /** 図鑑の一文（子ども向け）。 */
  flavor: string;
  /** リビール用の「なぜそうなったか」（属性→ステータス→わざ→名前 の順で4〜6個）。 */
  revealNotes: { step: string; text: string }[];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : (lo + hi) / 2));
}
function clampInt(v: number, lo: number, hi: number): number {
  return Math.round(clamp(v, lo, hi));
}

/** AI の特徴 → 既存パイプラインが食う FeatureVector。 */
export function aiToFeatureVector(ai: AiFeatures): FeatureVector {
  const aspect = clamp(ai.aspectRatio, 0.3, 2);
  const coverage = clamp(ai.coverage, 0, 1) * 0.32; // ピクセル解析の coverage レンジに合わせる
  const nominal = 512;
  const w = aspect >= 1 ? nominal : Math.round(nominal * aspect);
  const h = aspect >= 1 ? Math.round(nominal / aspect) : nominal;
  return {
    inkCount: Math.round(coverage * nominal * nominal),
    coverage,
    bbox: { x: Math.round((nominal - w) / 2), y: Math.round((nominal - h) / 2), w, h },
    aspect,
    dominantHue: ATTRIBUTE_META[ai.attribute].hue,
    saturation: clamp(ai.saturation, 0, 1),
    value: clamp(ai.brightness, 0, 1),
    colorCount: clampInt(ai.colorCount, 1, 6),
    symmetry: clamp(ai.symmetry, 0, 1),
    spikiness: clamp(ai.spikiness, 0, 1),
    fillDensity: clamp(ai.fillDensity, 0, 1),
    eyeSpots: clampInt(ai.eyeCount, 0, 6),
  };
}

/** AI の特徴からキャラを生成（属性・持ち物・名前・図鑑文は AI の値を優先）。 */
export function aiFeaturesToCharacter(ai: AiFeatures, seed: number): Character {
  const fv = aiToFeatureVector(ai);
  const weapon = ai.weapon === 'none' ? undefined : ai.weapon;
  const character = featuresToCharacter(fv, seed, {
    attribute: ai.attribute,
    weapon,
    name: ai.name?.trim() || undefined,
    flavor: { name: ai.name?.trim() || undefined, bio: ai.flavor?.trim() || undefined },
  });
  return character;
}

/** 受け取った JSON が AiFeatures として妥当か（AI の出力チェック）。壊れていたら null。 */
export function coerceAiFeatures(raw: unknown): AiFeatures | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const attribute = AI_ATTRIBUTES.includes(o.attribute as Attribute) ? (o.attribute as Attribute) : null;
  if (!attribute) return null;
  const num = (k: string, d = 0.5) => (typeof o[k] === 'number' ? (o[k] as number) : d);
  const weapon = AI_WEAPONS.includes(o.weapon as Weapon) ? (o.weapon as Weapon | 'none') : 'none';
  const notes = Array.isArray(o.revealNotes)
    ? (o.revealNotes as unknown[])
        .filter((n): n is { step: string; text: string } => !!n && typeof (n as { text?: unknown }).text === 'string')
        .slice(0, 8)
    : [];
  return {
    attribute,
    attributeReason: typeof o.attributeReason === 'string' ? o.attributeReason : '',
    weapon,
    aspectRatio: clamp(num('aspectRatio', 1), 0.3, 2),
    coverage: clamp(num('coverage'), 0, 1),
    spikiness: clamp(num('spikiness'), 0, 1),
    symmetry: clamp(num('symmetry'), 0, 1),
    fillDensity: clamp(num('fillDensity'), 0, 1),
    saturation: clamp(num('saturation'), 0, 1),
    brightness: clamp(num('brightness'), 0, 1),
    colorCount: clampInt(num('colorCount', 2), 1, 6),
    eyeCount: clampInt(num('eyeCount', 2), 0, 6),
    temperament: o.temperament === 'aggressive' ? 'aggressive' : 'calm',
    name: typeof o.name === 'string' ? o.name.slice(0, 16) : '',
    flavor: typeof o.flavor === 'string' ? o.flavor.slice(0, 120) : '',
    revealNotes: notes,
  };
}

// tool スキーマ / システムプロンプトは server/aiContract.ts（サーバー専用）。
