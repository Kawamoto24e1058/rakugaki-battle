/**
 * 技の 強さの 値を つくって src/engine/moves/values.ts に 書き出す。技を 追加・調整 したら：
 *   npx vitest run -c scripts/vitest.config.ts
 *
 * はかりかた：いろいろな キャラ（タイプ・ステータス・ほかの 技が ばらばら）の 技の 1つを その技に
 * いれかえて たたかわせた 勝率の 平均。決まった 1しゅるいの キャラで はかると、組みあわせの 相性が
 * はいらず、えらんだ 組みあわせで 強さが ずれる（実際に 平均 15% ずれた）ため。
 */
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { featuresToCharacter } from '../src/engine/analyze/toCharacter';
import { BATTLE_STYLES } from '../src/engine/analyze/style';
import { createClashState, playClashToEnd } from '../src/engine/battle/clash';
import { MOVES } from '../src/engine/moves/data';
import { mulberry32 } from '../src/engine/rng';
import type { Attribute, Character } from '../src/engine/types';

const ATTRS: Attribute[] = ['fire', 'water', 'wood', 'bolt', 'dark'];
const TAGS = ['claws', 'fangs', 'horns', 'wings', 'tail', 'shell', 'armor', 'weapon', 'cute', 'scary', 'magic', 'dragon', 'robot', 'bird', 'ghost', 'fast', 'hard'];

function randomChar(rng: () => number, i: number, attribute?: Attribute): Character {
  const fv = {
    inkCount: 4000, coverage: 0.08 + rng() * 0.25, bbox: { x: 10, y: 10, w: 80, h: 80 }, aspect: 0.5 + rng() * 1.2, dominantHue: rng() * 360,
    saturation: rng(), value: rng(), colorCount: 1 + Math.floor(rng() * 5), symmetry: rng(), spikiness: rng(), fillDensity: rng(), eyeSpots: Math.floor(rng() * 3),
  };
  return featuresToCharacter(fv, 90000 + i, {
    attribute: attribute ?? ATTRS[Math.floor(rng() * 5)],
    statLook: { power: rng(), tough: rng(), speed: rng(), hp: rng() },
    style: BATTLE_STYLES[Math.floor(rng() * BATTLE_STYLES.length)],
    motifTags: TAGS.filter(() => rng() < 0.2).slice(0, 4),
  });
}

it('move values', () => {
  const rng = mulberry32(20261105);
  const foes = Array.from({ length: 24 }, (_, i) => randomChar(rng, i));
  const CONTEXTS = 40;
  const GAMES = 60;
  const out: Record<string, number> = {};
  for (const m of Object.values(MOVES)) {
    const ctxRng = mulberry32(12345);
    let wins = 0;
    let games = 0;
    for (let k = 0; k < CONTEXTS; k++) {
      // 属性わざは おなじ 属性の キャラに
      const base = randomChar(ctxRng, 1000 + k, m.attribute ?? undefined);
      const slot = k % 4;
      const moveIds = base.moveIds.map((id, i) => (i === slot ? m.id : id === m.id ? 'c_tackle' : id));
      const me: Character = { ...base, moveIds };
      for (let g = 0; g < GAMES; g++) {
        const foe = foes[(k * 7 + g) % foes.length];
        const left = g % 2 === 0;
        const r = playClashToEnd(createClashState(left ? me : foe, left ? foe : me, 50000 + k * 1000 + g * 7));
        if (r.winner === 'draw') wins += 0.5;
        else if ((r.winner === 0) === left) wins += 1;
        games++;
      }
    }
    out[m.id] = Math.round((wins / games) * 1000) / 1000;
  }
  const lines = Object.entries(out)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `  ${k}: ${v},`)
    .join('\n');
  writeFileSync(
    new URL('../src/engine/moves/values.ts', import.meta.url),
    `// 自動生成（scripts/genMoveValues.test.ts）。手で 書きかえない。\n/** 技の 強さの 値：いろいろな キャラの 技の 1つを その技に かえて たたかわせた 勝率の 平均（0〜1）。えらべる 技の 候補を おなじ 強さに そろえるのに つかう。 */\nexport const MOVE_VALUE: Record<string, number> = {\n${lines}\n};\n`,
  );
}, 900000);
