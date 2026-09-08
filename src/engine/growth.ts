import type { Character, Stats } from './types';
import { mulberry32, randInt } from './rng';
import { getMove, attrMove, movesByTag, activeTags, moveCost, LOADOUT_BUDGET, type MoveId } from './moves';

const cost = (id: MoveId) => {
  try {
    return moveCost(getMove(id));
  } catch {
    return 2;
  }
};
const loadoutCost = (ids: MoveId[]) => ids.reduce((s, id) => s + cost(id), 0);
const isCure = (id: MoveId) => {
  try {
    const m = getMove(id);
    return !!m.cures || !!m.heal;
  } catch {
    return false;
  }
};
/** newId を予算内に収まるよう loadout に足す（あふれたら 最安の非治療技を1つ外す）。 */
function fitInto(ids: MoveId[], newId: MoveId): MoveId[] {
  if (ids.includes(newId)) return ids;
  let out = [...ids, newId];
  while (loadoutCost(out) > LOADOUT_BUDGET && out.length > 1) {
    const removable = out
      .filter((id) => id !== newId && !isCure(id))
      .sort((a, b) => cost(a) - cost(b));
    const drop = removable[0] ?? out.find((id) => id !== newId);
    if (!drop) break;
    out = out.filter((id) => id !== drop);
  }
  return out;
}

export type RewardOption =
  | { kind: 'stat'; stat: keyof Stats; amount: number; label: string; description: string }
  | { kind: 'evolve'; label: string; description: string }
  | { kind: 'learn'; moveId: MoveId; label: string; description: string };

const STAT_LABEL: Record<keyof Stats, string> = {
  hp: 'HP',
  atk: 'こうげき',
  def: 'ぼうぎょ',
  spd: 'すばやさ',
  luck: 'きゅうしょ',
  heart: 'こんじょう',
};

export function rewardOptions(character: Character, won: boolean): RewardOption[] {
  const rng = mulberry32((character.seed + character.wins * 131 + character.losses * 977) >>> 0);
  const options: RewardOption[] = [];

  // 1) ステータス強化（負け側は増加量アップ）
  const stats: (keyof Stats)[] = ['hp', 'atk', 'def', 'spd', 'luck', 'heart'];
  const stat = stats[randInt(rng, 0, stats.length - 1)];
  const big = won ? 1 : 1.5;
  const amount = Math.round((stat === 'hp' ? 16 : stat === 'luck' || stat === 'heart' ? 3 : 5) * big);
  options.push({
    kind: 'stat',
    stat,
    amount,
    label: `${STAT_LABEL[stat]} ＋${amount}`,
    description: 'すぐに強くなる。',
  });

  // 2) 属性技の進化
  if (character.skillLevel < 3) {
    const cur = getMove(attrMove(character.attribute, character.skillLevel)).name;
    const nxt = getMove(attrMove(character.attribute, character.skillLevel + 1)).name;
    options.push({
      kind: 'evolve',
      label: `ぞくせいわざ 進化：${cur} → ${nxt}`,
      description: 'いつも使える属性わざが強くなる。',
    });
  }

  // 3) 新わざ習得（勝った時）
  if (won && character.movePool.length < 16) {
    const known = new Set([...character.movePool, ...character.moveIds]);
    const tags = activeTags({
      features: {} as never,
      attribute: character.attribute,
      weapon: character.weapon,
      personality: character.personality,
      skillLevel: character.skillLevel,
    });
    const pool: MoveId[] = [];
    for (const tag of [...tags, 'common', 'utility']) {
      for (const m of movesByTag(tag)) {
        if (known.has(m.id)) continue;
        // 他属性の技は除外
        const otherAttr = m.unlock.some((t) => t.startsWith('attr:') && t !== `attr:${character.attribute}`);
        if (otherAttr) continue;
        pool.push(m.id);
      }
    }
    if (pool.length > 0) {
      const id = pool[randInt(rng, 0, pool.length - 1)];
      options.push({
        kind: 'learn',
        moveId: id,
        label: `新わざ：${getMove(id).name}`,
        description: getMove(id).desc,
      });
    }
  }

  const limit = won ? 4 : 3;
  return options.slice(0, Math.max(2, limit));
}

export function applyReward(character: Character, option: RewardOption): Character {
  const next: Character = {
    ...character,
    baseStats: { ...character.baseStats },
    moveIds: [...character.moveIds],
    movePool: [...character.movePool],
  };
  switch (option.kind) {
    case 'stat':
      next.baseStats[option.stat] += option.amount;
      break;
    case 'evolve': {
      const oldMove = attrMove(character.attribute, character.skillLevel);
      next.skillLevel = Math.min(3, character.skillLevel + 1);
      const newMove = attrMove(character.attribute, next.skillLevel);
      for (const arr of [next.movePool, next.moveIds]) {
        const idx = arr.indexOf(oldMove);
        if (idx >= 0) arr[idx] = newMove;
        else if (!arr.includes(newMove)) arr.push(newMove);
      }
      // 進化で★が増えて予算超過したら最安の非治療技を外す
      next.moveIds = fitInto(next.moveIds.filter((id) => id !== newMove), newMove);
      break;
    }
    case 'learn':
      if (!next.movePool.includes(option.moveId)) next.movePool.push(option.moveId);
      next.moveIds = fitInto(next.moveIds, option.moveId);
      break;
  }
  return next;
}
