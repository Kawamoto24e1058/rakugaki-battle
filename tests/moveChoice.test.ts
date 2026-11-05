import { describe, expect, it } from 'vitest';
import { featuresToCharacter } from '../src/engine/analyze/toCharacter';
import { BATTLE_STYLES } from '../src/engine/analyze/style';
import { createClashState, playClashToEnd } from '../src/engine/battle/clash';
import { mulberry32 } from '../src/engine/rng';
import type { Attribute, Character } from '../src/engine/types';

const ATTRS: Attribute[] = ['fire', 'water', 'wood', 'bolt', 'dark'];
const TAGS = ['claws', 'fangs', 'horns', 'wings', 'tail', 'shell', 'armor', 'weapon', 'cute', 'scary', 'magic', 'dragon', 'robot', 'bird', 'ghost', 'fast', 'hard'];

/** いろいろな 絵（AI の 判定つき）の キャラ。 */
function randomChar(rng: () => number, i: number): Character {
  const fv = {
    inkCount: 4000, coverage: 0.08 + rng() * 0.25, bbox: { x: 10, y: 10, w: 80, h: 80 }, aspect: 0.5 + rng() * 1.2, dominantHue: rng() * 360,
    saturation: rng(), value: rng(), colorCount: 1 + Math.floor(rng() * 5), symmetry: rng(), spikiness: rng(), fillDensity: rng(), eyeSpots: Math.floor(rng() * 3),
  };
  const tags = TAGS.filter(() => rng() < 0.2).slice(0, 4);
  return featuresToCharacter(fv, 1000 + i, {
    attribute: ATTRS[Math.floor(rng() * 5)],
    statLook: { power: rng(), tough: rng(), speed: rng(), hp: rng() },
    style: BATTLE_STYLES[Math.floor(rng() * BATTLE_STYLES.length)],
    motifTags: tags,
  });
}

describe('技の えらびかた', () => {
  it('技えらびは 4回、どの回も 3まいで ちがう 技。どれを えらんでも 勝ちやすさが ほぼ おなじ', () => {
    const rng = mulberry32(7);
    const foes = Array.from({ length: 12 }, (_, i) => randomChar(rng, 500 + i));
    const winRate = (me: Character) => {
      let w = 0;
      const N = 800;
      for (let g = 0; g < N; g++) {
        const foe = foes[g % foes.length];
        const left = g % 2 === 0;
        const r = playClashToEnd(createClashState(left ? me : foe, left ? foe : me, 7000 + g * 13));
        if (r.winner === 'draw') w += 0.5;
        else if ((r.winner === 0) === left) w += 1;
      }
      return w / N;
    };
    let checked = 0;
    let spreadSum = 0;
    let worst = 0;
    for (let i = 0; i < 16; i++) {
      const c = randomChar(rng, i);
      const rounds = c.moveRounds ?? [];
      expect(rounds.length).toBe(4);
      const ids = rounds.flatMap((r) => r.options.map((o) => o.id));
      expect(new Set(ids).size).toBe(12); // 1つの 技は 1回にしか 出ない
      // 子どもが ばらばらに えらんだ 4とおりの 組みあわせ
      const rates = [0, 1, 2, 3].map((k) => winRate({ ...c, moveIds: rounds.map((r, ri) => r.options[(k + ri) % 3].id) }));
      const spread = Math.max(...rates) - Math.min(...rates);
      spreadSum += spread;
      worst = Math.max(worst, spread);
      checked++;
    }
    console.log("spread", (spreadSum / checked).toFixed(3), "worst", worst.toFixed(3));
    expect(spreadSum / checked).toBeLessThan(0.1);
    expect(worst).toBeLessThan(0.2);
  }, 180000);

  it('タイプで ステータスの 形が はっきり ちがう', () => {
    const rng = mulberry32(11);
    const avg: Record<string, { atk: number; def: number; spd: number; n: number }> = {};
    for (let i = 0; i < 200; i++) {
      const c = randomChar(rng, 3000 + i);
      const a = (avg[c.style!] ??= { atk: 0, def: 0, spd: 0, n: 0 });
      a.atk += c.baseStats.atk;
      a.def += c.baseStats.def;
      a.spd += c.baseStats.spd;
      a.n++;
    }
    const m = (s: string, k: 'atk' | 'def' | 'spd') => avg[s][k] / avg[s].n;
    expect(m('power', 'atk')).toBeGreaterThan(m('balance', 'atk') + 5);
    expect(m('guard', 'def')).toBeGreaterThan(m('balance', 'def') + 3);
    expect(m('speed', 'spd')).toBeGreaterThan(m('balance', 'spd') + 5);
  });
});
