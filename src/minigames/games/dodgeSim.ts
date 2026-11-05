import { mulberry32 } from '../../engine/rng';

/**
 * 「よけろ！」の 中身（画面なしで うごく。CPU の つよさの テストにも つかう）。
 *  ・たまの とび方は seed で きまり、ふたり おなじ
 *  ・点数：あたらない ほど 高く、たまの すぐ そばを かすめる（グレイズ）と 加点。3回 あたると アウト（ねばった 時間で すこしだけ）
 *    （ふたりとも 0回 だと ひきわけに なりやすいので、かすめた 数で 差が つく）
 */
export const W = 200;
export const H = 150;
export const DURATION = 5;
export const LIVES = 3;
export const SPEED = 105;
export const HIT_R = 6;
export const GRAZE = 9;

export type Pattern = 'rain' | 'sides' | 'fan' | 'wall';
export interface Bullet {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}
export interface LiveBullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export function makeBullets(seed: number): Bullet[] {
  const rng = mulberry32(seed >>> 0);
  const all: Pattern[] = ['rain', 'sides', 'fan', 'wall'];
  const a = all[Math.floor(rng() * all.length)];
  const rest = all.filter((p) => p !== a);
  const b = rest[Math.floor(rng() * rest.length)];
  const bullets: Bullet[] = [];
  const add = (p: Pattern, t0: number, t1: number) => {
    if (p === 'rain') {
      for (let t = t0; t < t1; t += 0.13 + rng() * 0.07) bullets.push({ t, x: 8 + rng() * (W - 16), y: -6, vx: (rng() - 0.5) * 16, vy: 75 + rng() * 45, r: 5 });
    } else if (p === 'sides') {
      for (let t = t0; t < t1; t += 0.28) {
        const left = rng() < 0.5;
        bullets.push({ t, x: left ? -6 : W + 6, y: 10 + rng() * (H - 20), vx: (left ? 1 : -1) * (90 + rng() * 30), vy: 0, r: 6 });
        bullets.push({ t: t + 0.1, x: left ? W + 6 : -6, y: 10 + rng() * (H - 20), vx: (left ? -1 : 1) * (90 + rng() * 30), vy: 0, r: 6 });
      }
    } else if (p === 'fan') {
      for (let t = t0; t < t1; t += 0.65) {
        const cx = 20 + rng() * (W - 40);
        const n = 7;
        const off = rng() * 0.3;
        for (let i = 0; i < n; i++) {
          const ang = Math.PI * (0.15 + (0.7 * (i + off)) / (n - 1 + 0.3));
          bullets.push({ t, x: cx, y: -4, vx: Math.cos(ang) * 80, vy: Math.sin(ang) * 80, r: 5 });
        }
      }
    } else {
      for (let t = t0; t < t1; t += 0.85) {
        const gap = 25 + rng() * (W - 50);
        for (let x = 6; x < W; x += 13) if (Math.abs(x - gap) > 20) bullets.push({ t, x, y: -6, vx: 0, vy: 68, r: 6 });
      }
    }
  };
  // さいしょの 0.5びょうは たまなし（いちを たしかめる 時間）
  add(a, 0.5, 2.7);
  add(b, 2.7, DURATION - 0.5);
  return bullets;
}

/** 時間 t に 画面に いる たま。 */
export function liveAt(bullets: Bullet[], t: number): LiveBullet[] {
  const out: LiveBullet[] = [];
  bullets.forEach((b, id) => {
    if (t < b.t) return;
    const x = b.x + b.vx * (t - b.t);
    const y = b.y + b.vy * (t - b.t);
    if (x > -20 && x < W + 20 && y > -20 && y < H + 20) out.push({ id, x, y, vx: b.vx, vy: b.vy, r: b.r });
  });
  return out;
}

export interface Soul {
  x: number;
  y: number;
  hits: number;
  inv: number;
  grazed: Set<number>;
  /** アウトに なった 時間（なっていなければ null）。 */
  outAt: number | null;
  t: number;
}

export const newSoul = (): Soul => ({ x: W / 2, y: H * 0.7, hits: 0, inv: 0, grazed: new Set(), outAt: null, t: 0 });

/** うごかして、あたり／かすめ を しらべる。あたったら 'hit'、かすめたら 'graze'。 */
export function stepSoul(s: Soul, mx: number, my: number, dt: number, live: LiveBullet[], teleport?: { x: number; y: number }): 'hit' | 'graze' | null {
  if (s.hits >= LIVES) return null;
  s.t += dt;
  if (teleport) {
    s.x = teleport.x;
    s.y = teleport.y;
  } else {
    s.x += mx * SPEED * dt;
    s.y += my * SPEED * dt;
  }
  s.x = Math.max(HIT_R + 2, Math.min(W - HIT_R - 2, s.x));
  s.y = Math.max(HIT_R + 2, Math.min(H - HIT_R - 2, s.y));
  s.inv = Math.max(0, s.inv - dt);
  let ev: 'hit' | 'graze' | null = null;
  for (const b of live) {
    const d = Math.hypot(b.x - s.x, b.y - s.y);
    if (s.inv === 0 && d < b.r * 0.8 + HIT_R) {
      s.hits++;
      s.inv = 0.9;
      s.grazed.add(b.id);
      if (s.hits >= LIVES) s.outAt = s.t;
      return 'hit';
    }
    if (d < b.r + HIT_R + GRAZE && !s.grazed.has(b.id) && s.inv === 0) {
      s.grazed.add(b.id);
      ev = 'graze';
    }
  }
  return ev;
}

/** 点数（0〜100）。 */
export function dodgeScore(s: Soul): number {
  // アウト：どれだけ ねばったかで 0〜15
  if (s.hits >= LIVES) return Math.round(((s.outAt ?? 0) / DURATION) * 15);
  const grazes = s.grazed.size - s.hits;
  return Math.max(0, Math.min(100, 50 - s.hits * 15 + Math.min(50, grazes * 5)));
}

/**
 * CPU の うごき：見えている たまから にげる＋まんなかへ もどる。
 * うまさ（0〜1）で「気づく おそさ」「気づく きょり」「うごく 速さ」が かわる。
 */
export function cpuSteer(s: Soul, bullets: Bullet[], t: number, skill: number, rng: () => number): [number, number] {
  // 気づくのが すこし おそい（skill 0.45 で 0.19びょう、0.85 で 0.11びょう まえの たまを 見ている）
  const lag = 0.2 - 0.14 * skill;
  const seen = liveAt(bullets, Math.max(0, t - lag));
  const sense = 16 + 20 * skill;
  let fx = (W / 2 - s.x) * 0.012;
  let fy = (H * 0.65 - s.y) * 0.012;
  for (const b of seen) {
    const dx = s.x - b.x;
    const dy = s.y - b.y;
    const d = Math.hypot(dx, dy);
    if (d > sense || d < 0.01) continue;
    const k = ((sense - d) / sense) ** 2 * 3;
    fx += (dx / d) * k;
    fy += (dy / d) * k;
  }
  fx += (rng() - 0.5) * (1 - skill) * 0.8;
  fy += (rng() - 0.5) * (1 - skill) * 0.8;
  const m = Math.hypot(fx, fy);
  if (m < 0.05) return [0, 0];
  const sp = 0.55 + 0.4 * skill;
  return [(fx / m) * sp, (fy / m) * sp];
}

/** CPU だけで 1回 遊ぶ（テスト用）。 */
export function simulateCpu(seed: number, skill: number): Soul {
  const bullets = makeBullets(seed);
  const rng = mulberry32((seed * 7 + 3) >>> 0);
  const s = newSoul();
  const dt = 1 / 60;
  for (let t = 0; t < DURATION; t += dt) {
    const [mx, my] = cpuSteer(s, bullets, t, skill, rng);
    stepSoul(s, mx, my, dt, liveAt(bullets, t));
  }
  return s;
}
