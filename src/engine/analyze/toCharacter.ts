import type { Attribute, AnalysisReason, Character, Stats, Weapon } from '../types';
import { ATTRIBUTE_META } from '../attributes';
import { assignMovePool, autoLoadout, activeTags } from '../moves';
import { assignKosei, getKosei } from '../personalities';
import { mulberry32, randInt, type Rng } from '../rng';
import { clamp01, type FeatureVector } from './features';

/** 用紙のチェック欄などから来る手動指定（あれば解析より優先）。 */
export interface AnalysisOverrides {
  attribute?: Attribute;
  weapon?: Weapon;
  name?: string;
  flavor?: { name?: string; bio?: string };
  /**
   * AI が「絵を見て」付けたステータス印象（各 0..1）。
   * あれば、形から計算したスコアとブレンドして反映する（AI 寄り）。
   */
  statLook?: { power: number; tough: number; speed: number; hp: number };
  /** AI が付けた各ステータスの理由（絵の具体物つき・リビール表示用）。 */
  statReasons?: { power?: string; tough?: string; speed?: string; hp?: string };
}

const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t;
// AI が具体物を見て決めた印象は強めに信じる（形からの計算 25%）。
const LOOK_WEIGHT = 0.75;

// メイン3ステータス（こうげき・ぼうぎょ・すばやさ）の合計は「種族値」で 79〜101 に振れる。
const MAIN_BASE = 90;
const MAIN_MIN = 13;
const MAIN_MAX = 52;
const HP_MIN = 50;
const HP_MAX = 118;
const SUB_MIN = 5;
const SUB_MAX = 34;

/** 平均(30)からの差を強調して、絵の個性をハッキリ出す。合計は total に正規化。 */
function sharpenTriple(a: number, b: number, c: number, total: number): [number, number, number] {
  const push = (v: number) => 30 + (v - 30) * 1.55;
  return normalizeMain(push(a), push(b), push(c), total);
}
/** 0..1 のサブステータス値を、真ん中(0.5)から遠ざけてメリハリを出す。 */
function sharpen01(v: number): number {
  return clamp01((v - 0.5) * 1.5 + 0.5);
}

/**
 * 属性判定：色相だけでなく「明るさ・鮮やかさ」も見る。
 * - くらい絵（墨・黒） → 闇
 * - 色がほとんど無い（えんぴつ・グレー） → 闇
 * - それ以外は色相アンカーで最も近い属性
 */
function pickAttribute(f: FeatureVector): Attribute {
  if (f.value < 0.32) return 'dark';
  if (f.saturation < 0.16) return 'dark';
  let best: Attribute = 'fire';
  let bestDist = Infinity;
  for (const meta of Object.values(ATTRIBUTE_META)) {
    let d = Math.abs(f.dominantHue - meta.hue);
    if (d > 180) d = 360 - d;
    if (d < bestDist) {
      bestDist = d;
      best = meta.id;
    }
  }
  return best;
}

/** 判定理由の短い説明（リビール用）。 */
function attributeReason(f: FeatureVector, attr: Attribute): string {
  if (f.value < 0.32) return 'くろ・こい色でかいてある';
  if (f.saturation < 0.16) return 'えんぴつ・グレーの線';
  const jp = ATTRIBUTE_META[attr].jp;
  const byAttr: Record<Attribute, string> = {
    fire: 'あかい色が多い',
    water: 'あおい色が多い',
    wood: 'みどりが多い',
    bolt: 'きいろ・オレンジが多い',
    dark: 'むらさき・くらい色',
  };
  return byAttr[attr] ?? `${jp}っぽい色`;
}

function normalizeMain(a: number, b: number, c: number, total: number): [number, number, number] {
  let x = Math.max(1, a);
  let y = Math.max(1, b);
  let z = Math.max(1, c);
  const scale = total / (x + y + z);
  x = Math.round(x * scale);
  y = Math.round(y * scale);
  z = total - x - y;
  const clamp = (n: number) => Math.max(MAIN_MIN, Math.min(MAIN_MAX, n));
  x = clamp(x);
  y = clamp(y);
  z = clamp(z);
  let diff = total - (x + y + z);
  let guard = 0;
  while (diff !== 0 && guard++ < 40) {
    const step = diff > 0 ? 1 : -1;
    if (x + step >= MAIN_MIN && x + step <= MAIN_MAX) { x += step; diff -= step; continue; }
    if (y + step >= MAIN_MIN && y + step <= MAIN_MAX) { y += step; diff -= step; continue; }
    if (z + step >= MAIN_MIN && z + step <= MAIN_MAX) { z += step; diff -= step; continue; }
    break;
  }
  return [x, y, z];
}

const scaleTo = (v01: number, min: number, max: number) => Math.round(min + clamp01(v01) * (max - min));

/**
 * 「どれだけ描き込んであるか」を 0..1 で。塗り量・すきま・色数・ディテール・目。
 * これに乱数を混ぜて種族値スケールを作る（描けば描くほど強い、を露骨にしない）。
 */
function detailLevel(f: FeatureVector): number {
  const ink = clamp01(f.coverage / 0.32);
  const filled = f.fillDensity;
  const colors = clamp01((f.colorCount - 1) / 4);
  const detail = clamp01(f.spikiness * 0.7 + (f.eyeSpots >= 2 ? 0.3 : 0));
  return clamp01(ink * 0.34 + filled * 0.24 + colors * 0.22 + detail * 0.2);
}

/** キャラの「型」ラベル（リビール表示用）。1位が平均からどれだけ抜けているかで判定。 */
export function archetypeLabel(s: Stats): string {
  const { atk, def, spd } = s;
  const avg = (atk + def + spd) / 3;
  const top = Math.max(atk, def, spd);
  if (top - avg < 6) return 'バランス型';
  if (top === atk) return 'こうげき型';
  if (top === spd) return 'スピード型';
  return 'がんじょう型';
}

const NAME_PREFIX: Record<Attribute, string[]> = {
  fire: ['メラ', 'ボウ', 'アカ', 'ヒノ'],
  water: ['アオ', 'ミズ', 'シブ', 'ナミ'],
  wood: ['モリ', 'ハノ', 'ミド', 'ツタ'],
  bolt: ['ビリ', 'ゴロ', 'キイ', 'イナ'],
  dark: ['ヨル', 'カゲ', 'ムラ', 'クロ'],
};
const NAME_CORE = ['ちゃん', 'ゴン', 'ラー', 'まる', 'ぞう', 'ぴー', 'すけ', 'たん'];
const makeName = (rng: Rng, a: Attribute) =>
  NAME_PREFIX[a][randInt(rng, 0, 3)] + NAME_CORE[randInt(rng, 0, NAME_CORE.length - 1)];

export function featuresToCharacter(
  features: FeatureVector,
  seed: number,
  overrides: AnalysisOverrides = {},
): Character {
  const rng = mulberry32(seed >>> 0);
  const f = features;

  const attribute = overrides.attribute ?? pickAttribute(f);
  const weapon: Weapon =
    overrides.weapon ??
    (f.aspect < 0.72 ? 'wing' : f.aspect > 1.3 ? 'shield' : f.spikiness > 0.5 ? 'sword' : 'wand');
  const personality: Character['personality'] =
    f.saturation * 0.6 + f.value * 0.4 > 0.62 ? 'aggressive' : 'calm';

  // 種族値スケール：描き込み量 55% ＋ 乱数 45% → 0.88〜1.12（理不尽にならない範囲で個性を出す）
  const bst01 = clamp01(detailLevel(f) * 0.55 + rng() * 0.45);
  const bstScale = 0.88 + bst01 * 0.24;

  // こうげき・ぼうぎょ・すばやさ（絵の特徴を強めに反映）
  const look = overrides.statLook;
  let atkScore = 12 + f.spikiness * 46 + (weapon === 'sword' ? 6 : 0);
  let defScore = 12 + f.symmetry * 28 + f.fillDensity * 20 + (weapon === 'shield' ? 6 : 0);
  let spdScore = 10 + clamp01(1 - f.aspect) * 36 + (1 - f.coverage) * 18 + (weapon === 'wing' ? 10 : 0);
  if (look) {
    // AI が「見た印象」を 6割、形からの計算を 4割
    atkScore = mix(atkScore, 12 + clamp01(look.power) * 48, LOOK_WEIGHT);
    defScore = mix(defScore, 12 + clamp01(look.tough) * 48, LOOK_WEIGHT);
    spdScore = mix(spdScore, 10 + clamp01(look.speed) * 44, LOOK_WEIGHT);
  }
  const mainTotal = Math.round(MAIN_BASE * bstScale);
  const [atk, def, spd] = sharpenTriple(atkScore, defScore, spdScore, mainTotal);

  const hpBias = look
    ? mix(sharpen01(f.coverage / 0.35), clamp01(look.hp), LOOK_WEIGHT)
    : sharpen01(f.coverage / 0.35);
  const hpRaw = 52 + hpBias * 58;
  const hp = Math.max(HP_MIN, Math.min(HP_MAX, Math.round(hpRaw * bstScale)));

  const luck = scaleTo(
    sharpen01(clamp01((f.colorCount - 1) / 4) * 0.6 + f.saturation * 0.4) * bstScale,
    SUB_MIN,
    SUB_MAX,
  );
  const heart = scaleTo(
    sharpen01(
      Math.min(1, f.eyeSpots / 2) * 0.55 + (personality === 'calm' ? 0.32 : 0.03) + f.symmetry * 0.15,
    ) * bstScale,
    SUB_MIN,
    SUB_MAX,
  );

  const baseStats: Stats = { hp, atk, def, spd, luck, heart };
  const skillLevel = 1;
  const movePool = assignMovePool({ features: f, attribute, weapon, personality, skillLevel }, seed);
  const moveIds = autoLoadout(movePool, seed);
  const tags = activeTags({ features: f, attribute, weapon, personality, skillLevel });
  const koseiId = assignKosei(attribute, tags, seed, archetypeLabel(baseStats));
  const kosei = getKosei(koseiId);

  const analysis = buildReasons(f, attribute, weapon, personality, baseStats, bst01, tags, kosei, overrides.statReasons);
  const name = overrides.name ?? overrides.flavor?.name ?? makeName(rng, attribute);

  return {
    id: `c_${(seed >>> 0).toString(36)}_${Date.now().toString(36)}`,
    name,
    createdAt: Date.now(),
    attribute,
    weapon,
    personality,
    baseStats,
    moveIds,
    movePool,
    koseiId,
    skillLevel,
    analysis,
    seed: seed >>> 0,
    wins: 0,
    losses: 0,
  };
}

const WEAPON_JP: Record<Weapon, string> = {
  sword: 'ツメ・キバ・剣っぽい形',
  wand: 'まるい体・杖っぽい線',
  shield: '横に大きい・盾っぽい形',
  wing: '細長い・翼っぽいシルエット',
};
const TAG_JP: Record<string, string> = {
  'shape:spiky': 'トゲトゲ', 'shape:round': 'まる', 'shape:tall': 'たて長', 'shape:wide': 'よこ広',
  'shape:big': '大きい', 'shape:small': '小さい', 'shape:symmetric': '左右対称', 'shape:asymmetric': '個性的な形',
  'part:eyes': 'はっきりした目', 'part:wings': '翼っぽい',
  'mood:fierce': '元気・好戦的', 'mood:calm': 'おだやか',
  'deco:colorful': 'カラフル', 'deco:plain': 'シンプル',
};

function buildReasons(
  f: FeatureVector,
  attr: Attribute,
  weapon: Weapon,
  personality: Character['personality'],
  stats: Stats,
  bst01: number,
  tags: string[],
  kosei: { name: string; tagline: string; passiveJp: string; activeName: string },
  statReasons?: { power?: string; tough?: string; speed?: string; hp?: string },
): AnalysisReason[] {
  const r: AnalysisReason[] = [];
  const arche = archetypeLabel(stats);
  const sr = statReasons ?? {};

  r.push({
    key: 'color',
    label: 'メインカラー',
    detected: attributeReason(f, attr),
    effect: `${ATTRIBUTE_META[attr].jp} 属性`,
  });
  r.push({
    key: 'kosei',
    label: 'この絵の こせい',
    detected: kosei.name,
    effect: `${kosei.tagline}／パッシブ：${kosei.passiveJp}／こせい技：${kosei.activeName}`,
  });
  r.push({
    key: 'power',
    label: 'ぜんたいの つよさ（種族値）',
    detected: bst01 > 0.66 ? 'しっかり描き込んである' : bst01 > 0.34 ? 'ふつうの描き込み' : 'あっさりした線',
    effect: bst01 > 0.66 ? '種族値 高め（強い）' : bst01 > 0.34 ? '種族値 ふつう' : '種族値 ひかえめ',
  });
  r.push({
    key: 'arche',
    label: 'ステータスの かたより',
    detected:
      arche === 'こうげき型' ? 'こうげき が とびぬけている'
      : arche === 'がんじょう型' ? 'ぼうぎょ・HP が高い'
      : arche === 'スピード型' ? 'すばやさ が とびぬけている'
      : 'まんべんなく高い',
    effect: `${arche}（こうげき${stats.atk}／ぼうぎょ${stats.def}／すばやさ${stats.spd}）`,
  });
  const strong = (v: number) => (v >= 44 ? '高い' : v >= 30 ? 'ふつう' : 'ひかえめ');
  r.push({
    key: 'edge',
    label: 'こうげき',
    detected: sr.power || (f.spikiness > 0.5 ? 'トゲトゲしている' : f.spikiness > 0.25 ? 'ゴツゴツしている' : 'なめらかな形'),
    effect: `こうげき ${strong(stats.atk)}（${stats.atk}）`,
  });
  r.push({
    key: 'sym',
    label: 'ぼうぎょ',
    detected: sr.tough || (f.symmetry > 0.75 && f.fillDensity > 0.5 ? 'どっしり詰まっている' : '軽めのつくり'),
    effect: `ぼうぎょ ${strong(stats.def)}（${stats.def}）`,
  });
  r.push({
    key: 'slim',
    label: 'すばやさ',
    detected: sr.speed || (f.fillDensity < 0.45 || f.aspect < 0.8 ? '細身・身軽そう' : 'どっしりしている'),
    effect: `すばやさ ${strong(stats.spd)}（${stats.spd}）`,
  });
  r.push({
    key: 'hpwhy',
    label: 'たいりょく（HP）',
    detected: sr.hp || (f.coverage > 0.22 ? '大きく描いてある' : '小さめに描いてある'),
    effect: `HP ${stats.hp}`,
  });
  {
    const high = stats.heart >= 22;
    const src = f.eyeSpots >= 2 ? 'はっきりした目' : personality === 'calm' ? 'おだやかな顔つき' : '目が よく分からない';
    r.push({
      key: 'eyes',
      label: 'こんじょう',
      detected: `${src} → ${high ? 'ピンチで ねばる・かいふくと 状態異常が つよい' : 'ピンチねばり・かいふくは ふつう'}`,
      effect: `こんじょう ${stats.heart}`,
    });
  }
  {
    const high = stats.luck >= 22;
    const src = f.colorCount >= 4 ? 'カラフル' : f.colorCount >= 2 ? '数色' : '一色';
    r.push({
      key: 'colors',
      label: 'きゅうしょ',
      detected: `${src} → ${high ? 'クリティカルが 出やすい・状態異常を はねかえす' : 'クリティカルは ときどき'}`,
      effect: `きゅうしょ ${stats.luck}`,
    });
  }
  r.push({ key: 'weapon', label: '体つき・持ち物', detected: WEAPON_JP[weapon], effect: 'それに合ったわざを習得' });
  const shownTags = tags.filter((t) => TAG_JP[t]).slice(0, 3);
  if (shownTags.length > 0) {
    r.push({
      key: 'moves',
      label: 'おぼえるわざ',
      detected: shownTags.map((t) => TAG_JP[t]).join('・'),
      effect: 'その特徴のわざが技セットに入る',
    });
  }
  return r;
}
