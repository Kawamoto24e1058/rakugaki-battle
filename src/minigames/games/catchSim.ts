import { mulberry32 } from '../../engine/rng';

/**
 * 「うけとめろ！」の 中身：上から おちてくる くだもの を キャラで うけとめる。ばくだんは よける。
 * おちてくる もの・場所・はやさは ふたり おなじ。
 * 点数：うけとめた くだもの の わりあい − ばくだん。ひきわけ だらけに ならないよう、うけとめた 数が そのまま 差に なる。
 */
export const W = 200;
export const H = 130;
export const FLOOR = 116;
export const DURATION = 5;
export const SPEED = 140;
export const MOUSE_SPEED = 320;
export const CATCH_HALF = 14; // うけとめられる はば（片がわ）
export const CHAR_R = 13;

export interface Drop {
  id: number;
  t: number;
  x: number;
  vy: number;
  bomb: boolean;
  kind: number; // くだもの の しゅるい
}

export function makeDrops(seed: number): Drop[] {
  const rng = mulberry32((seed ^ 0xa54ff53a) >>> 0);
  const out: Drop[] = [];
  let t = 0.3;
  let id = 0;
  let lastX = W / 2;
  while (t < DURATION - 1.4) {
    // まえの もの から はなれすぎない（間に合う）けど ちかすぎない
    let x = 0;
    for (let k = 0; k < 10; k++) {
      x = 14 + rng() * (W - 28);
      if (Math.abs(x - lastX) > 30 && Math.abs(x - lastX) < 120) break;
    }
    const bomb = id > 1 && rng() < 0.28;
    out.push({ id: id++, t, x, vy: 80 + rng() * 30, bomb, kind: Math.floor(rng() * 3) });
    if (!bomb) lastX = x;
    t += 0.3 + rng() * 0.22;
  }
  return out;
}

export const dropY = (d: Drop, t: number) => -8 + d.vy * (t - d.t);

export interface Catcher {
  x: number;
  caught: Set<number>;
  bombed: Set<number>;
  missed: Set<number>;
  stunUntil: number;
}
export const newCatcher = (): Catcher => ({ x: W / 2, caught: new Set(), bombed: new Set(), missed: new Set(), stunUntil: 0 });

export function stepCatcher(c: Catcher, drops: Drop[], t: number, dt: number, mx: number, maxSpeed = SPEED): 'catch' | 'bomb' | null {
  if (t >= c.stunUntil) c.x = Math.max(CHAR_R, Math.min(W - CHAR_R, c.x + Math.max(-1, Math.min(1, mx)) * maxSpeed * dt));
  let ev: 'catch' | 'bomb' | null = null;
  for (const d of drops) {
    if (t < d.t || c.caught.has(d.id) || c.bombed.has(d.id) || c.missed.has(d.id)) continue;
    const y = dropY(d, t);
    if (y >= FLOOR - CHAR_R - 4 && y <= FLOOR - CHAR_R + 6 && Math.abs(d.x - c.x) <= CATCH_HALF) {
      if (d.bomb) {
        c.bombed.add(d.id);
        c.stunUntil = t + 0.5;
        ev = 'bomb';
      } else {
        c.caught.add(d.id);
        ev = ev ?? 'catch';
      }
    } else if (y > FLOOR - CHAR_R + 6) {
      c.missed.add(d.id);
    }
  }
  return ev;
}

export function catchScore(c: Catcher, drops: Drop[]): number {
  const fruits = drops.filter((d) => !d.bomb).length || 1;
  return Math.max(0, Math.min(100, Math.round(((c.caught.size - c.bombed.size * 0.8) / fruits) * 100)));
}

/** CPU：いちばん はやく おちてくる くだもの へ むかう（気づくのが すこし おそい）。ちかくの ばくだんは よける。 */
export function cpuMoveCatch(c: Catcher, drops: Drop[], t: number, skill: number, rng: () => number): number {
  const lag = 0.32 - 0.2 * skill;
  const seen = drops.filter((d) => t - lag >= d.t && !c.caught.has(d.id) && !c.bombed.has(d.id) && !c.missed.has(d.id));
  const fruits = seen.filter((d) => !d.bomb && dropY(d, t) < FLOOR - CHAR_R).sort((a, b) => (FLOOR - dropY(a, t)) / a.vy - (FLOOR - dropY(b, t)) / b.vy);
  // まにあう ものの なかで いちばん はやい もの
  const reach = SPEED * (0.7 + 0.3 * skill);
  const target = fruits.find((d) => Math.abs(d.x - c.x) - CATCH_HALF <= reach * ((FLOOR - CHAR_R - dropY(d, t)) / d.vy)) ?? fruits[0];
  let mx = 0;
  if (target) mx = Math.sign(target.x - c.x) * Math.min(1, Math.abs(target.x - c.x) / 6);
  for (const b of seen.filter((d) => d.bomb)) {
    const y = dropY(b, t);
    if (y > FLOOR - 60 && y < FLOOR && Math.abs(b.x - c.x) < CATCH_HALF + 8 && rng() < 0.4 + 0.6 * skill) mx = b.x > c.x ? -1 : 1;
  }
  return mx * (0.7 + 0.3 * skill);
}

export function simulateCpuCatch(seed: number, skill: number): Catcher {
  const drops = makeDrops(seed);
  const c = newCatcher();
  const rng = mulberry32(seed * 3 + 1);
  for (let t = 0; t < DURATION; t += 1 / 60) stepCatcher(c, drops, t, 1 / 60, cpuMoveCatch(c, drops, t, skill, rng));
  return c;
}
