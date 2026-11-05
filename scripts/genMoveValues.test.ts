/**
 * 技の 強さの 値（標準キャラの 4つめに 入れて CPU どうしで たたかわせた 勝率）を つくって
 * src/engine/moves/values.ts に 書き出す。技を 追加・調整 したら：
 *   npx vitest run -c scripts/vitest.config.ts
 */
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { featuresToCharacter } from '../src/engine/analyze/toCharacter';
import { createClashState, playClashToEnd } from '../src/engine/battle/clash';
import { MOVES } from '../src/engine/moves/data';
import type { Attribute, Character } from '../src/engine/types';

const ATTRS: Attribute[] = ['fire', 'water', 'wood', 'bolt', 'dark'];
const fv = { inkCount: 4000, coverage: 0.16, bbox: { x: 10, y: 10, w: 80, h: 80 }, aspect: 1, dominantHue: 0, saturation: 0.6, value: 0.6, colorCount: 2, symmetry: 0.7, spikiness: 0.4, fillDensity: 0.6, eyeSpots: 2 };
const base = featuresToCharacter(fv, 777);
const make = (attribute: Attribute, moveIds: string[], id: string): Character => ({
  ...base,
  id,
  attribute,
  baseStats: { hp: 80, atk: 30, def: 30, spd: 30, luck: 20, heart: 20 },
  moveIds,
});
const BASELINE = ['c_tackle', 'c_headbutt', 'c_scratch'];
const ALT = ['c_bite', 'c_onetwo', 'c_twin'];
const FOES = [
  ['c_tackle', 'c_bite', 'c_guard', 'c_onigiri'],
  ['c_scratch', 'c_headbutt', 'c_focus', 'c_twin'],
  ['c_bite', 'c_rush', 'ey_glare', 'c_tackle'],
  ['c_onetwo', 'c_tackle', 'sh_counter', 'c_quickdraw'],
];

it('move values', () => {
  const N = 1500;
  const out: Record<string, number> = {};
  for (const m of Object.values(MOVES)) {
    const set = [...(BASELINE.includes(m.id) ? ALT : BASELINE), m.id];
    let wins = 0;
    let games = 0;
    for (let g = 0; g < N; g++) {
      const myAttr = m.attribute ?? ATTRS[g % 5];
      const foeAttr = ATTRS[(g * 3 + 1) % 5];
      const me = make(myAttr, set, 'me');
      const foe = make(foeAttr, FOES[g % FOES.length], 'foe');
      const left = g % 2 === 0;
      const r = playClashToEnd(createClashState(left ? me : foe, left ? foe : me, 50000 + g * 7));
      if (r.winner === 'draw') wins += 0.5;
      else if ((r.winner === 0) === left) wins += 1;
      games++;
    }
    out[m.id] = Math.round((wins / games) * 1000) / 1000;
  }
  const lines = Object.entries(out)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `  ${k}: ${v},`)
    .join('\n');
  writeFileSync(
    new URL('../src/engine/moves/values.ts', import.meta.url),
    `// 自動生成（scripts/genMoveValues.test.ts）。手で 書きかえない。\n/** 技の 強さの 値：標準キャラの 4つめに 入れて たたかわせた 勝率（0〜1）。えらべる 技の 候補を おなじ 強さに そろえるのに つかう。 */\nexport const MOVE_VALUE: Record<string, number> = {\n${lines}\n};\n`,
  );
}, 600000);
