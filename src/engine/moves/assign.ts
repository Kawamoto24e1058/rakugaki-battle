import type { Attribute, Character } from '../types';
import { mulberry32 } from '../rng';
import { MOVES, isRareMove, type MoveDef, type MoveId } from './data';

/** キャラ1体がもつ技の数。 */
export const MOVES_PER_CHARACTER = 4;

function pickWeighted(list: { m: MoveDef; w: number }[], rng: () => number): MoveDef | null {
  const total = list.reduce((s, x) => s + x.w, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const x of list) {
    r -= x.w;
    if (r < 0) return x.m;
  }
  return list[list.length - 1]?.m ?? null;
}

/**
 * 絵から決まった属性・性格をもとに、キャラに技を4つ割り振る（同じ絵→同じ技）。
 *  1つめ：じぶんの属性の こうげき
 *  2つめ：ふつうの こうげき
 *  3つめ：ほじょ（おだやかなら 2つになることも）
 *  4つめ：なんでも（大技・とくしゅわざも出る）
 */
export function assignMoves(seed: number, attribute: Attribute, personality: Character['personality']): MoveId[] {
  const rng = mulberry32((seed ^ 0x4d4f5645) >>> 0);
  const all = Object.values(MOVES);
  const picked: MoveDef[] = [];
  const take = (cands: MoveDef[], weight: (m: MoveDef) => number = () => 1) => {
    const list = cands.filter((m) => !picked.includes(m)).map((m) => ({ m, w: weight(m) }));
    const m = pickWeighted(list, rng);
    if (m) picked.push(m);
  };
  const rareW = (m: MoveDef) => (isRareMove(m) ? 0.35 : 1);

  take(all.filter((m) => m.category === 'attack' && m.attribute === attribute), rareW);
  take(all.filter((m) => m.category === 'attack' && !m.attribute), rareW);
  take(all.filter((m) => m.category === 'support' && (!m.attribute || m.attribute === attribute)));
  const wildSupport = personality === 'calm' ? 0.6 : 0.3;
  if (rng() < wildSupport) take(all.filter((m) => m.category === 'support'));
  else take(all, rareW);
  return picked.map((m) => m.id);
}
