import { mulberry32 } from '../../engine/rng';

/**
 * 「とべ！」の 中身（画面なしで うごく）。
 *  よこから くる しょうがいぶつを スペースで とびこえる。ふたりとも おなじ じゅんばん・おなじ はやさ。
 *  点数：とびこえた 数 ＋ ぎりぎりで とんだ ほど ボーナス（ひきわけ だらけに ならない）
 */
export const W = 200;
export const H = 110;
export const GROUND = 92;
export const CHAR_X = 42;
export const CHAR_R = 13; // 絵の 大きさ
export const HIT_R = 9; // あたり判定
export const SPEED = 120;
export const V0 = 165;
export const GRAV = 560;
export const DURATION = 5;

export interface Obstacle {
  id: number;
  t: number; // 画面の 右はしに 出る 時間
  w: number;
  h: number;
}

export function makeObstacles(seed: number): Obstacle[] {
  const rng = mulberry32((seed ^ 0x6a09e667) >>> 0);
  const out: Obstacle[] = [];
  let t = 0.35 + rng() * 0.25;
  let id = 0;
  // 右はし（x=W+4）から キャラの うしろへ ぬけるまで 約1.4びょう。おわりまでに ぬけきる ものだけ
  while (t < DURATION - 1.55) {
    out.push({ id: id++, t, w: 10 + Math.floor(rng() * 7), h: 11 + Math.floor(rng() * 4) });
    t += 0.55 + rng() * 0.3;
  }
  return out;
}

/** しょうがいぶつの 左はしの x（時間 t）。 */
export const obstacleX = (o: Obstacle, t: number) => W + 4 - SPEED * (t - o.t);

/** ジャンプの 高さ（とんでから s びょう。地面に ついたら 0）。 */
export function jumpHeight(s: number): number {
  const h = V0 * s - (GRAV * s * s) / 2;
  return h > 0 ? h : 0;
}
export const AIR_TIME = (2 * V0) / GRAV;

function collides(cx: number, cy: number, ox: number, o: Obstacle): boolean {
  // まる（キャラ）と しかく（しょうがいぶつ）
  const nx = Math.max(ox, Math.min(cx, ox + o.w));
  const ny = Math.max(GROUND - o.h, Math.min(cy, GROUND));
  return Math.hypot(cx - nx, cy - ny) < HIT_R;
}

/**
 * とびこえられる「とぶ しゅんかんの きょり」（しょうがいぶつの 左はし − キャラの x）の はんい。
 * 大きいほど はやく とんでいる。小さい（ぎりぎり）ほど ボーナス。
 */
const windowCache = new Map<string, [number, number]>();
export function jumpWindow(o: Pick<Obstacle, 'w' | 'h'>): [number, number] {
  const key = `${o.w}x${o.h}`;
  const hit = windowCache.get(key);
  if (hit) return hit;
  // しょうがいぶつが まだ 前に ある（d > 0）ところで、とびこえられる ひとつづきの はんい
  let lo = Infinity;
  let hi = -Infinity;
  for (let d = 0; d <= 120; d += 0.5) {
    let ok = true;
    for (let s = 0; s <= AIR_TIME + 0.4; s += 1 / 240) {
      const ox = CHAR_X + d - SPEED * s;
      const cy = GROUND - CHAR_R + 2 - jumpHeight(s);
      if (collides(CHAR_X, cy, ox, { id: 0, t: 0, ...o })) {
        ok = false;
        break;
      }
      if (ox + o.w < CHAR_X - HIT_R - 1) break;
    }
    if (ok) {
      lo = Math.min(lo, d);
      hi = Math.max(hi, d);
    } else if (hi > -Infinity) break;
  }
  const r: [number, number] = [lo, hi];
  windowCache.set(key, r);
  return r;
}

export interface Runner {
  jumpAt: number | null; // とんだ 時間
  cleared: Map<number, number>; // とびこえた id → ボーナス（0〜1）
  hit: Set<number>;
  takeoff: Map<number, number>; // id → とんだ しゅんかんの きょり
  stunUntil: number;
}
export const newRunner = (): Runner => ({ jumpAt: null, cleared: new Map(), hit: new Set(), takeoff: new Map(), stunUntil: 0 });

export const charY = (r: Runner, t: number) => GROUND - CHAR_R + 2 - (r.jumpAt == null ? 0 : jumpHeight(t - r.jumpAt));
export const inAir = (r: Runner, t: number) => r.jumpAt != null && t - r.jumpAt < AIR_TIME;

/** とぶ（空中・ゴツンの 直後は とべない）。つぎの しょうがいぶつまでの きょりを おぼえておく。 */
export function tryJump(r: Runner, obs: Obstacle[], t: number): boolean {
  if (inAir(r, t) || t < r.stunUntil) return false;
  r.jumpAt = t;
  const next = obs.find((o) => !r.cleared.has(o.id) && !r.hit.has(o.id) && obstacleX(o, t) + o.w >= CHAR_X - HIT_R);
  if (next) r.takeoff.set(next.id, obstacleX(next, t) - CHAR_X);
  return true;
}

/** 時間を すすめて、あたり／とびこえ を しらべる。 */
export function stepRunner(r: Runner, obs: Obstacle[], t: number): 'hit' | 'clear' | null {
  const cy = charY(r, t);
  let ev: 'hit' | 'clear' | null = null;
  for (const o of obs) {
    if (r.cleared.has(o.id) || r.hit.has(o.id)) continue;
    const ox = obstacleX(o, t);
    if (ox > W + 10) continue;
    if (collides(CHAR_X, cy, ox, o)) {
      r.hit.add(o.id);
      r.stunUntil = t + 0.35;
      ev = 'hit';
    } else if (ox + o.w < CHAR_X - HIT_R - 1) {
      const [lo, hi] = jumpWindow(o);
      const d = r.takeoff.get(o.id);
      const bonus = d == null || hi <= lo ? 0 : Math.max(0, Math.min(1, (hi - d) / (hi - lo)));
      r.cleared.set(o.id, bonus);
      ev = ev ?? 'clear';
    }
  }
  return ev;
}

/** 点数（0〜100）：1こ とびこえる ごとに 75％＋ ぎりぎり ボーナス 25％ ぶん。 */
export function jumpScore(r: Runner, total: number): number {
  if (total === 0) return 0;
  let s = 0;
  for (const b of r.cleared.values()) s += 0.75 + 0.25 * b;
  return Math.round((s / total) * 100);
}

/**
 * CPU：つぎの しょうがいぶつの「とべる はんい」の まんなかを ねらって とぶ。うまさが ひくいほど ずれる。
 * ずれは しょうがいぶつ ごとに きめておく（毎フレーム かわらない）。
 */
export function makeCpuPlan(obs: Obstacle[], skill: number, seed: number): Map<number, number> {
  const rng = mulberry32((seed * 13 + 5) >>> 0);
  const plan = new Map<number, number>();
  for (const o of obs) {
    const [lo, hi] = jumpWindow(o);
    const mid = (lo + hi) / 2;
    // ふつうの ずれ（ガウスっぽく）＋ ときどき 大きく ミス
    const g = (rng() + rng() + rng() - 1.5) * 2;
    const spread = (hi - lo) * (1 - 0.55 * skill);
    const blunder = rng() < 0.26 - 0.16 * skill ? (rng() < 0.5 ? -1 : 1) * (hi - lo) * 0.9 : 0;
    plan.set(o.id, mid + g * spread * 0.5 + blunder);
  }
  return plan;
}

export function cpuWantsJump(r: Runner, obs: Obstacle[], plan: Map<number, number>, t: number): boolean {
  const next = obs.find((o) => !r.cleared.has(o.id) && !r.hit.has(o.id) && obstacleX(o, t) + o.w >= CHAR_X - HIT_R);
  if (!next) return false;
  const d = obstacleX(next, t) - CHAR_X;
  const want = plan.get(next.id) ?? 0;
  return d <= want && !r.takeoff.has(next.id);
}

/** CPU だけで 1回（テスト用）。 */
export function simulateCpuJump(seed: number, skill: number): { score: number; hits: number; total: number } {
  const obs = makeObstacles(seed);
  const plan = makeCpuPlan(obs, skill, seed);
  const r = newRunner();
  for (let t = 0; t < DURATION; t += 1 / 60) {
    if (cpuWantsJump(r, obs, plan, t)) tryJump(r, obs, t);
    stepRunner(r, obs, t);
  }
  return { score: jumpScore(r, obs.length), hits: r.hit.size, total: obs.length };
}
