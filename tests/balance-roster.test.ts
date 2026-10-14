import { describe, expect, it } from 'vitest';
import { createClashState, playClashToEnd } from '../src/engine/battle/clash';
import { makeCpuRoster } from '../src/data/cpuRoster';

/**
 * 実際の 絵に ちかい キャラ（CPU ロスター）どうしの 総あたり。
 * ランダムな 四角の キャラより ステータスが 現実的なので、決着の はやさを ここでも 見る。
 * （1ターン＝技の決定＋ミニゲーム＋演出 なので、長すぎても 短すぎても つまらない）
 */
describe('バトルバランス（CPU ロスター 総あたり）', () => {
  it('決着まで 中央 4〜9ターン、4ぶんの3 が 12ターン いない', () => {
    const all = makeCpuRoster();
    const turns: number[] = [];
    for (let i = 0; i < all.length; i++)
      for (let j = 0; j < all.length; j++) {
        if (i === j) continue;
        for (let g = 0; g < 80; g++) turns.push(playClashToEnd(createClashState(all[i], all[j], 777 + g * 13 + i * 3 + j)).turn);
      }
    turns.sort((a, b) => a - b);
    const q = (f: number) => turns[Math.floor(turns.length * f)];
    expect(q(0.5)).toBeGreaterThanOrEqual(4);
    expect(q(0.5)).toBeLessThanOrEqual(9);
    expect(q(0.75)).toBeLessThanOrEqual(12);
  });
});
