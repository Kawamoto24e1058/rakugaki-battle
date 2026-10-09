import { describe, expect, it } from 'vitest';
import { analyzeImageData } from '../src/engine/analyze';
import { createClashState, playClashToEnd } from '../src/engine/battle/clash';
import { mulberry32 } from '../src/engine/rng';
import { makeImage } from './helpers';

function randomChar(rng: () => number) {
  const w = 40 + Math.floor(rng() * 120);
  const h = 40 + Math.floor(rng() * 120);
  const color: [number, number, number] = [Math.floor(rng() * 255), Math.floor(rng() * 255), Math.floor(rng() * 255)];
  const img = makeImage(240, 240, (x, y) => {
    const x0 = (240 - w) / 2;
    const y0 = (240 - h) / 2;
    return x >= x0 && x < x0 + w && y >= y0 && y < y0 + h ? [...color, 255] : null;
  });
  return analyzeImageData(img).character;
}

describe('バトルバランス（CPU同士・ランダムキャラ）', () => {
  it('テンポ：多くの試合が 時間切れ前に決着し、先攻/後攻に偏らない', () => {
    const rng = mulberry32(2026);
    const turns: number[] = [];
    let seat0 = 0;
    let decided = 0;
    for (let g = 0; g < 400; g++) {
      const r = playClashToEnd(createClashState(randomChar(rng), randomChar(rng), 9000 + g));
      turns.push(r.turn);
      if (r.winner === 0 || r.winner === 1) {
        decided++;
        if (r.winner === 0) seat0++;
      }
    }
    turns.sort((a, b) => a - b);
    const median = turns[turns.length >> 1];
    const before14 = turns.filter((t) => t < 14).length / turns.length;
    expect(median).toBeGreaterThanOrEqual(5);
    expect(median).toBeLessThanOrEqual(12);
    expect(before14).toBeGreaterThan(0.65);
    expect(seat0 / decided).toBeGreaterThan(0.4);
    expect(seat0 / decided).toBeLessThan(0.6);
  });
});
