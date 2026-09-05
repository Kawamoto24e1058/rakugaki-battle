import type { Attribute } from '../types';
import { mulberry32 } from '../rng';
import { KOSEI_LIST, type KoseiActive, type KoseiId } from './data';

/** こせいアクティブの種類 → だいたいの「型」。 */
const ACTIVE_ARCHE: Record<KoseiActive['kind'], string> = {
  smash: 'こうげき型',
  stormStatus: 'こうげき型',
  leech: 'こうげき型',
  vengeance: 'こうげき型',
  barrage: 'スピード型',
  mend: 'がんじょう型',
  fortress: 'がんじょう型',
  warcry: 'バランス型',
  hex: 'バランス型',
  wildcard: 'バランス型',
};

/**
 * 絵の特徴タグ（activeTags の出力）＋属性＋「型」から、いちばん合う「こせい」を1つ選ぶ。
 * オフラインで動く決定論的なルール判定（同じ絵 → 同じこせい）。
 */
export function assignKosei(
  attribute: Attribute,
  tags: string[],
  seed: number,
  archetype?: string,
): KoseiId {
  const tagSet = new Set(tags);
  const pool = KOSEI_LIST.filter((k) => k.tags.includes(`attr:${attribute}`));
  const rng = mulberry32((seed ^ 0x9e3d71c9) >>> 0);

  let best: { id: KoseiId; score: number }[] = [];
  let bestScore = -1;
  for (const k of pool) {
    let score = 0;
    for (const t of k.tags) {
      if (t.startsWith('attr:')) continue;
      if (tagSet.has(t)) score += 2;
    }
    if (archetype && ACTIVE_ARCHE[k.active.kind] === archetype) score += 1.6;
    // タグが全く合わなくても、乱数で最低限ばらける
    score += rng() * 0.9;
    if (score > bestScore + 1e-9) {
      bestScore = score;
      best = [{ id: k.id, score }];
    } else if (Math.abs(score - bestScore) < 1e-9) {
      best.push({ id: k.id, score });
    }
  }
  if (best.length === 0) return pool[0]?.id ?? KOSEI_LIST[0].id;
  return best[Math.floor(rng() * best.length)].id;
}
