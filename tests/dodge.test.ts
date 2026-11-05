import { describe, expect, it } from 'vitest';
import { dodgeScore, liveAt, makeBullets, newSoul, simulateCpu, stepSoul, DURATION } from '../src/minigames/games/dodgeSim';
import { judge } from '../src/minigames/Shell';

describe('ミニゲーム「よけろ！」', () => {
  const avgHits = (skill: number) => {
    let h = 0;
    for (let s = 1; s <= 120; s++) h += simulateCpu(s * 13, skill).hits;
    return h / 120;
  };
  it('CPU は つよすぎない（いちばん つよくても ときどき あたる）、でも うごかない 人よりは うまい', () => {
    let idle = 0;
    for (let s = 1; s <= 120; s++) {
      const b = makeBullets(s * 13);
      const so = newSoul();
      for (let t = 0; t < DURATION; t += 1 / 60) stepSoul(so, 0, 0, 1 / 60, liveAt(b, t));
      idle += so.hits;
    }
    idle /= 120;
    const weak = avgHits(0.25);
    const strong = avgHits(0.6);
    expect(strong).toBeGreaterThan(0.5);
    expect(weak).toBeLessThan(idle);
    expect(strong).toBeLessThan(weak);
  });

  it('ふたりとも あたらなくても、かすめた 数が 1つ ちがえば 勝ち負けが つく（ひきわけ だらけに ならない）', () => {
    const soul = (hits: number, grazes: number) => {
      const s = newSoul();
      s.hits = hits;
      for (let i = 0; i < hits + grazes; i++) s.grazed.add(i);
      return s;
    };
    expect(judge([dodgeScore(soul(0, 2)), dodgeScore(soul(0, 3))]).winner).toBe(1);
    expect(judge([dodgeScore(soul(1, 4)), dodgeScore(soul(0, 4))]).winner).toBe(1);
    // アウト どうしは ねばった 時間で
    const a = soul(3, 0);
    a.outAt = 1;
    const b = soul(3, 0);
    b.outAt = 4;
    expect(judge([dodgeScore(a), dodgeScore(b)]).winner).toBe(1);
  });
});
