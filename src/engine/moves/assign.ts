import type { Attribute, Weapon } from '../types';
import type { FeatureVector } from '../analyze/features';
import { mulberry32, type Rng } from '../rng';
import { attrMove, movesByTag, type MoveId, type UnlockTag } from './data';

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

/** 技セットの下限・上限（キャラごとに数が変わる）。 */
export const MOVESET_MIN = 5;
export const MOVESET_MAX = 8;

/**
 * キャラの技セット（5〜8）を決める。数は「絵の描き込み具合」で変わる。
 * 核（たいあたり・属性技・ガード・治療）＋ 属性の特殊 ＋ 特徴タグごとに1つ。
 */
export function assignMoves(input: AssignInput, seed: number): MoveId[] {
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
  // 技数：核5 ＋ 特徴の多さと乱数で 0〜3 追加 → 5〜8（描き込みが多いほど技も多い）
  const extra = Math.min(
    MOVESET_MAX - MOVESET_MIN,
    Math.max(0, Math.round((tags.length - 5) * 0.6 + rng() * 1.3)),
  );
  const targetCount = MOVESET_MIN + extra;

  // 1) 核：たいあたり・ガード・属性ライン
  take('c_tackle');
  take('c_guard');
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

  // 5) targetCount に満たなければ、特徴タグ→共通の順で埋める
  for (const tag of tags) {
    if (chosen.length >= targetCount) break;
    takeFromTag(tag, 1);
  }
  const fillers: MoveId[] = ['c_bite', 'c_scratch', 'c_focus', 'c_gamble'];
  for (const id of fillers) {
    if (chosen.length >= Math.max(MOVESET_MIN, targetCount)) break;
    take(id);
  }

  return chosen;
}

function hasCureEffect(id: MoveId): boolean {
  return ['ca_breath', 'ca_song', 'water_wash', 'fire_dry', 'u_detox', 'u_endure', 'ca_heal'].includes(id);
}
