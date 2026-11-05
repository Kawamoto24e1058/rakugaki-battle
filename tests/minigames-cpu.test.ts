import { describe, expect, it } from 'vitest';
import { simulateCpuJump } from '../src/minigames/games/jumpSim';
import { simulateCpuCollect, simulateDirect } from '../src/minigames/games/collectSim';
import { catchScore, makeDrops, simulateCpuCatch } from '../src/minigames/games/catchSim';

/** CPU の つよさ：つよすぎず（人が かてる）、うまさの じゅんに よくなる。 */
describe('ミニゲームの CPU', () => {
  it('とべ！：いちばん つよくても ときどき ぶつかる', () => {
    const avg = (sk: number) => {
      let sc = 0;
      let hits = 0;
      let tot = 0;
      for (let s = 1; s <= 120; s++) {
        const r = simulateCpuJump(s * 7, sk);
        sc += r.score;
        hits += r.hits;
        tot += r.total;
      }
      return { score: sc / 120, hitRate: hits / tot };
    };
    const weak = avg(0.25);
    const strong = avg(0.6);
    expect(strong.hitRate).toBeGreaterThan(0.05);
    expect(strong.score).toBeLessThan(90);
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it('あつめろ！：まっすぐ むかう 人より すくない', () => {
    let direct = 0;
    let weak = 0;
    let strong = 0;
    for (let s = 1; s <= 80; s++) {
      direct += simulateDirect(s).got;
      weak += simulateCpuCollect(s, 0.25).got;
      strong += simulateCpuCollect(s, 0.6).got;
    }
    expect(strong).toBeLessThan(direct * 0.8);
    expect(strong).toBeGreaterThan(weak);
  });

  it('うけとめろ！：ぜんぶは とれない', () => {
    let weak = 0;
    let strong = 0;
    for (let s = 1; s <= 80; s++) {
      weak += catchScore(simulateCpuCatch(s, 0.25), makeDrops(s));
      strong += catchScore(simulateCpuCatch(s, 0.6), makeDrops(s));
    }
    expect(strong / 80).toBeLessThan(90);
    expect(strong).toBeGreaterThan(weak);
  });
});
