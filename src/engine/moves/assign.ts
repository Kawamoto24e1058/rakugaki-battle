import type { Attribute, Weapon } from '../types';
import type { FeatureVector } from '../analyze/features';
import { mulberry32, type Rng } from '../rng';
import {
  attrMove,
  getMove,
  moveCategory,
  moveCost,
  movesByTag,
  LOADOUT_BUDGET,
  MOVES,
  type MoveCategory3,
  type MoveId,
  type UnlockTag,
} from './data';

export interface AssignInput {
  features: FeatureVector;
  attribute: Attribute;
  weapon: Weapon;
  personality: 'aggressive' | 'calm';
  skillLevel: number;
}

/** 絵の特徴 → 発動する unlock タグ（強い順）。 */
export function activeTags(input: AssignInput): UnlockTag[] {
  const f = input.features;
  const tags: [UnlockTag, number][] = [];
  const add = (tag: UnlockTag, score: number) => tags.push([tag, score]);

  // 形
  if (f.spikiness > 0.5) add('shape:spiky', f.spikiness);
  if (f.spikiness < 0.3 && f.fillDensity > 0.55) add('shape:round', 1 - f.spikiness);
  if (f.aspect < 0.8) add('shape:tall', 0.8 - f.aspect);
  if (f.aspect > 1.25) add('shape:wide', f.aspect - 1.25);
  if (f.coverage > 0.2) add('shape:big', f.coverage);
  if (f.coverage < 0.09) add('shape:small', 0.1 - f.coverage);
  if (f.symmetry > 0.8) add('shape:symmetric', f.symmetry);
  if (f.symmetry < 0.55) add('shape:asymmetric', 0.6 - f.symmetry);

  // 部位
  if (f.eyeSpots >= 2) add('part:eyes', f.eyeSpots / 3);
  if (input.weapon === 'wing' || (f.aspect < 0.75 && f.fillDensity < 0.4)) add('part:wings', 0.7);

  // 雰囲気
  add(input.personality === 'aggressive' ? 'mood:fierce' : 'mood:calm', 0.6);

  // 装飾
  if (f.colorCount >= 4) add('deco:colorful', f.colorCount / 6);
  if (f.colorCount <= 1) add('deco:plain', 0.5);

  // 持ち物
  add(`weapon:${input.weapon}` as UnlockTag, 0.5);

  tags.sort((a, b) => b[1] - a[1]);
  return tags.map((t) => t[0]);
}

/** 技候補プールの下限・上限。プレイヤーはこの中から★予算ぶん選ぶ。 */
export const MOVESET_MIN = 7;
export const MOVESET_MAX = 13;

/**
 * キャラの「技の候補プール」（7〜13）を決める。数は「絵の描き込み具合」で変わる。
 * 核（たいあたり・属性技・ガード・治療）＋ 属性の特殊 ＋ 特徴タグごとに1つ。
 * この中からプレイヤーが★予算内で使う技を選ぶ（autoLoadout が初期値）。
 */
export function assignMovePool(input: AssignInput, seed: number): MoveId[] {
  const rng: Rng = mulberry32((seed ^ 0x51ed270b) >>> 0);
  const chosen: MoveId[] = [];
  const take = (id: MoveId) => {
    if (id && !chosen.includes(id) && chosen.length < MOVESET_MAX) chosen.push(id);
  };
  const takeFromTag = (tag: UnlockTag, count = 1) => {
    const pool = movesByTag(tag).filter(
      (m) =>
        !chosen.includes(m.id) &&
        !m.unlock.some((t) => t.startsWith('attr:') && t !== `attr:${input.attribute}`),
    );
    for (let i = 0; i < count && pool.length > 0; i++) {
      const idx = Math.floor(rng() * pool.length);
      take(pool[idx].id);
      pool.splice(idx, 1);
    }
  };

  const tags = activeTags(input);
  // 候補数：核7 ＋ 特徴の多さと乱数で 0〜6 追加 → 7〜13（描き込みが多いほど候補も多い）
  const extra = Math.min(
    MOVESET_MAX - MOVESET_MIN,
    Math.max(0, Math.round((tags.length - 4) * 0.9 + rng() * 2.2)),
  );
  const targetCount = MOVESET_MIN + extra;

  // 1) 核：属性ライン（絵の属性を象徴する技だけは必ず候補に）
  take(attrMove(input.attribute, input.skillLevel));
  // 2) 属性の特殊/補助を1つ
  takeFromTag(`attr:${input.attribute}`, 1);

  // 3) 特徴タグごとに1つ（強い順・targetCount まで。ただし治療枠は必ず残す）
  for (const tag of tags) {
    if (chosen.length >= targetCount - 1) break;
    takeFromTag(tag, 1);
  }

  // 4) 治療系を必ず1つ
  if (!chosen.some((id) => hasCureEffect(id))) {
    if (input.personality === 'calm') take('ca_breath');
    else if (input.attribute === 'water') take('water_wash');
    else take('u_detox');
  }

  // 4.5) 力／技／速さ を最低2つずつは候補に持たせる（特定のカテゴリだけ偏らないように、
  // 足りない分はランダムに補充＝毎回同じ技で埋まらない）
  ensureCategorySpread(chosen, input, take, rng, 2);

  // 5) targetCount に満たなければ、特徴タグ→共通の順で埋める
  for (const tag of tags) {
    if (chosen.length >= targetCount) break;
    takeFromTag(tag, 1);
  }
  const fillers: MoveId[] = ['c_bite', 'c_scratch', 'c_focus', 'c_gamble', 'c_tackle', 'c_guard'];
  for (let i = fillers.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [fillers[i], fillers[j]] = [fillers[j], fillers[i]];
  }
  for (const id of fillers) {
    if (chosen.length >= Math.max(MOVESET_MIN, targetCount)) break;
    take(id);
  }
  // 6) 安い技（★1）が最低2つは候補にあるように（予算内で組めるよう）
  const cheap = chosen.filter((id) => safeCost(id) === 1).length;
  for (const id of ['c_scratch', 'sm_jab', 'ta_stretch', 'c_tackle'] as MoveId[]) {
    if (cheap + chosen.filter((c) => safeCost(c) === 1).length >= 2) break;
    if (chosen.length < MOVESET_MAX) take(id);
  }

  return chosen;
}

/** 後方互換：候補プールの別名。 */
export const assignMoves = assignMovePool;

function safeCost(id: MoveId): number {
  try {
    return moveCost(getMove(id));
  } catch {
    return 2;
  }
}
function safeCat(id: MoveId): MoveCategory3 | null {
  try {
    return moveCategory(getMove(id));
  } catch {
    return null;
  }
}

/** 編成できる技の数（三すくみ＝3カテゴリなので3つまで）。 */
export const LOADOUT_MAX_MOVES = 3;

/**
 * 候補プールから「初期おまかせ編成」を作る（★予算内・最大3つ・力技速を1つずつ）。
 * プレイヤーが編成画面で自由に組み替える。CPU もこれを使う。
 */
export function autoLoadout(
  pool: MoveId[],
  seed: number,
  budget = LOADOUT_BUDGET,
  maxMoves = LOADOUT_MAX_MOVES,
): MoveId[] {
  const rng = mulberry32((seed ^ 0x9e3d71b1) >>> 0);
  const picked: MoveId[] = [];
  let spent = 0;
  const canAdd = (id: MoveId) =>
    !!id && !picked.includes(id) && picked.length < maxMoves && spent + safeCost(id) <= budget;
  const add = (id: MoveId) => {
    if (!canAdd(id)) return false;
    picked.push(id);
    spent += safeCost(id);
    return true;
  };

  // 1) 力・技・速さ を1つずつ（各カテゴリの中くらいのコストを優先）＝三すくみを回せる基本形
  for (const cat of ['power', 'speed', 'tech'] as MoveCategory3[]) {
    if (picked.length >= maxMoves) break;
    if (picked.some((id) => safeCat(id) === cat)) continue;
    const cands = pool
      .filter((id) => !picked.includes(id) && safeCat(id) === cat)
      .sort((a, b) => safeCost(a) - safeCost(b)); // 3枠しかないので安めから（治療を1枠残す）
    // 治療技があればそのカテゴリでは治療を優先
    const cure = cands.find((id) => hasCureEffect(id));
    for (const id of cure ? [cure, ...cands] : cands) if (add(id)) break;
  }

  // 2) 余った予算・枠を、強い技優先＋少し乱数でうめる
  const rest = pool
    .filter((id) => !picked.includes(id))
    .sort((a, b) => safeCost(b) - safeCost(a) + (rng() - 0.5));
  for (const id of rest) {
    if (picked.length >= maxMoves || spent >= budget) break;
    add(id);
  }

  // 3) 最低1つ
  if (picked.length === 0 && pool[0]) picked.push(pool[0]);
  return picked;
}

function hasCureEffect(id: MoveId): boolean {
  return ['ca_breath', 'ca_song', 'water_wash', 'fire_dry', 'u_detox', 'u_endure', 'ca_heal'].includes(id);
}

/**
 * 力／技／速さ を最低 minPerCategory ずつ持たせる。足りない分は、そのカテゴリの
 * 全技（自分の属性で使えるもの）からランダムに補う＝毎回同じ技で埋まらない。
 */
function ensureCategorySpread(
  chosen: MoveId[],
  input: AssignInput,
  take: (id: MoveId) => void,
  rng: Rng,
  minPerCategory: number,
): void {
  const counts = () => {
    const c: Record<MoveCategory3, number> = { power: 0, tech: 0, speed: 0 };
    for (const id of chosen) {
      try {
        c[moveCategory(getMove(id))] += 1;
      } catch {
        /* ignore */
      }
    }
    return c;
  };
  const byCategory: Record<MoveCategory3, MoveId[]> = { power: [], tech: [], speed: [] };
  for (const m of Object.values(MOVES)) {
    if (m.unlock.some((t) => t.startsWith('attr:') && t !== `attr:${input.attribute}`)) continue;
    byCategory[moveCategory(m)].push(m.id);
  }
  for (let pass = 0; pass < minPerCategory; pass++) {
    const c = counts();
    for (const cat of ['speed', 'tech', 'power'] as MoveCategory3[]) {
      if (c[cat] >= minPerCategory) continue;
      const cands = byCategory[cat].filter((id) => !chosen.includes(id));
      if (cands.length === 0) continue;
      take(cands[Math.floor(rng() * cands.length)]);
    }
  }
}
