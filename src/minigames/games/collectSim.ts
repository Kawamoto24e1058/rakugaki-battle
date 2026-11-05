import { mulberry32 } from '../../engine/rng';

/**
 * 「あつめろ！」の 中身：はこの 中の ほしを じゅんばんに とる。はねまわる トゲに あたると すこし うごけない。
 * ほしの 出る 場所と トゲの うごきは ふたり おなじ。
 * 点数：とった 数 ＋ つぎの ほしへの ちかさ（ひきわけ だらけに ならない）
 */
export const W = 200;
export const H = 150;
export const DURATION = 6;
export const SPEED = 120;
export const R = 8; // あたり判定
export const STAR_R = 8;
export const SPIKE_R = 7;

export interface Spike {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface CollectWorld {
  stars: { x: number; y: number }[];
  spikes0: Spike[];
}

export function makeWorld(seed: number): CollectWorld {
  const rng = mulberry32((seed ^ 0x3c6ef372) >>> 0);
  const stars: { x: number; y: number }[] = [];
  let px = W / 2;
  let py = H / 2;
  for (let i = 0; i < 30; i++) {
    // まえの ほしから ほどよく はなれた 場所
    let x = 0;
    let y = 0;
    for (let k = 0; k < 20; k++) {
      x = 16 + rng() * (W - 32);
      y = 16 + rng() * (H - 32);
      const d = Math.hypot(x - px, y - py);
      if (d > 55 && d < 120) break;
    }
    stars.push({ x, y });
    px = x;
    py = y;
  }
  const spikes0: Spike[] = Array.from({ length: 3 }, (_, i) => {
    const a = rng() * Math.PI * 2;
    const sp = 45 + rng() * 25;
    return { x: 30 + ((i * 70) % (W - 60)), y: 25 + rng() * (H - 50), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp };
  });
  return { stars, spikes0 };
}

/** 時間 t の トゲの いち（かべで はねかえる。計算で きまるので ふたり おなじ）。 */
export function spikesAt(w: CollectWorld, t: number): { x: number; y: number }[] {
  const bounce = (p0: number, v: number, lo: number, hi: number) => {
    const span = hi - lo;
    let p = (p0 - lo + v * t) % (2 * span);
    if (p < 0) p += 2 * span;
    return lo + (p <= span ? p : 2 * span - p);
  };
  return w.spikes0.map((s) => ({ x: bounce(s.x, s.vx, SPIKE_R, W - SPIKE_R), y: bounce(s.y, s.vy, SPIKE_R, H - SPIKE_R) }));
}

export interface Collector {
  x: number;
  y: number;
  got: number;
  stunUntil: number;
  inv: number;
  lastGotAt: number;
}
export const newCollector = (): Collector => ({ x: W / 2, y: H / 2, got: 0, stunUntil: 0, inv: 0, lastGotAt: 0 });

export function stepCollector(c: Collector, w: CollectWorld, t: number, dt: number, mx: number, my: number, maxSpeed = SPEED): 'got' | 'ouch' | null {
  c.inv = Math.max(0, c.inv - dt);
  if (t >= c.stunUntil) {
    const m = Math.hypot(mx, my);
    const sp = m > 1 ? maxSpeed / m : maxSpeed;
    c.x = Math.max(R, Math.min(W - R, c.x + mx * sp * dt));
    c.y = Math.max(R, Math.min(H - R, c.y + my * sp * dt));
  }
  const star = w.stars[c.got % w.stars.length];
  if (Math.hypot(star.x - c.x, star.y - c.y) < R + STAR_R) {
    c.got++;
    c.lastGotAt = t;
    return 'got';
  }
  if (c.inv === 0) {
    for (const s of spikesAt(w, t)) {
      if (Math.hypot(s.x - c.x, s.y - c.y) < R + SPIKE_R - 2) {
        c.stunUntil = t + 0.5;
        c.inv = 1.1;
        return 'ouch';
      }
    }
  }
  return null;
}

export function collectScore(c: Collector, w: CollectWorld): number {
  const star = w.stars[c.got % w.stars.length];
  const near = 1 - Math.min(1, Math.hypot(star.x - c.x, star.y - c.y) / 150);
  return Math.min(100, c.got * 11 + near * 9);
}

/** CPU：ほしが 出てから すこし おくれて 気づき、まっすぐ むかう。ちかい トゲは よける。 */
export function cpuMove(c: Collector, w: CollectWorld, t: number, skill: number): [number, number] {
  const lag = 0.42 - 0.25 * skill;
  if (t - c.lastGotAt < lag) return [0, 0];
  const star = w.stars[c.got % w.stars.length];
  let fx = star.x - c.x;
  let fy = star.y - c.y;
  const d = Math.hypot(fx, fy) || 1;
  fx /= d;
  fy /= d;
  for (const s of spikesAt(w, t)) {
    const dx = c.x - s.x;
    const dy = c.y - s.y;
    const ds = Math.hypot(dx, dy);
    const sense = 12 + 22 * skill;
    if (ds < sense && ds > 0.01) {
      const k = ((sense - ds) / sense) * 2.2 * skill;
      fx += (dx / ds) * k;
      fy += (dy / ds) * k;
    }
  }
  const m = Math.hypot(fx, fy) || 1;
  const sp = 0.62 + 0.3 * skill;
  return [(fx / m) * sp, (fy / m) * sp];
}

export function simulateCpuCollect(seed: number, skill: number): Collector {
  const w = makeWorld(seed);
  const c = newCollector();
  const dt = 1 / 60;
  for (let t = 0; t < DURATION; t += dt) {
    const [mx, my] = cpuMove(c, w, t, skill);
    stepCollector(c, w, t, dt, mx, my);
  }
  return c;
}

/** うごかない 人が まっすぐ ほしへ むかう（キーボードで ふつうに 遊ぶ 人の めやす）。 */
export function simulateDirect(seed: number): Collector {
  const w = makeWorld(seed);
  const c = newCollector();
  const dt = 1 / 60;
  for (let t = 0; t < DURATION; t += dt) {
    const star = w.stars[c.got % w.stars.length];
    const dx = star.x - c.x;
    const dy = star.y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    stepCollector(c, w, t, dt, dx / d, dy / d);
  }
  return c;
}
