import type { Character, Stats } from './types';
import { mulberry32, randInt } from './rng';
import { getMove, attrMove, movesByTag, activeTags, type MoveId } from './moves';

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

  // 3) 新わざ習得（勝った時・枠に空きがあれば）
  if (won && character.moveIds.length < 8) {
    const known = new Set(character.moveIds);
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
  };
  switch (option.kind) {
    case 'stat':
      next.baseStats[option.stat] += option.amount;
      break;
    case 'evolve': {
      const oldMove = attrMove(character.attribute, character.skillLevel);
      next.skillLevel = Math.min(3, character.skillLevel + 1);
      const newMove = attrMove(character.attribute, next.skillLevel);
      const idx = next.moveIds.indexOf(oldMove);
      if (idx >= 0) next.moveIds[idx] = newMove;
      else if (!next.moveIds.includes(newMove)) next.moveIds.push(newMove);
      break;
    }
    case 'learn':
      if (!next.moveIds.includes(option.moveId) && next.moveIds.length < 8) {
        next.moveIds.push(option.moveId);
      }
      break;
  }
  return next;
}
