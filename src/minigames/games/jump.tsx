import { useEffect, useRef, useState } from 'react';
import { Arena, Half, P_COLOR } from '../Arena';
import { usePads } from '../pads';
import { sfx } from '../../audio/sfx';
import type { GameProps, Player } from '../types';
import { canvasStyle, drawFighter, fitCanvas, loadFighterImages } from './canvasKit';
import {
  AIR_TIME,
  CHAR_R,
  CHAR_X,
  charY,
  cpuWantsJump,
  DURATION,
  GROUND,
  H,
  inAir,
  jumpScore,
  makeCpuPlan,
  makeObstacles,
  newRunner,
  obstacleX,
  stepRunner,
  tryJump,
  W,
  type Obstacle,
  type Runner,
} from './jumpSim';

/**
 * とべ！：はしってくる しょうがいぶつを スペースで とびこえる（クリックでも とべる）。
 * ぎりぎりで とぶほど ボーナス。ぶつかると ゴツン（すこし とべなくなる）。
 */
export function Jump({ seed, cpu, cpuSkill, names, fighters, onFinish }: GameProps) {
  const twoPlayer = !cpu;
  const canvases = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)];
  const runners = useRef<[Runner, Runner]>([newRunner(), newRunner()]);
  const obs = useRef<Obstacle[]>(makeObstacles(seed));
  const tNow = useRef(0);
  const pops = useRef<{ p: Player; text: string; color: string; t: number }[]>([]);
  const [hud, setHud] = useState<[number, number]>([0, 0]);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const finished = useRef(false);

  const jump = (p: Player) => {
    if (p === 1 && cpu) return;
    if (tryJump(runners.current[p], obs.current, tNow.current)) sfx.select();
  };
  usePads(twoPlayer, (p, key) => {
    if (key === 'action' || key === 'up') jump(p);
  });

  useEffect(() => {
    const imgs = loadFighterImages(fighters);
    const plan = makeCpuPlan(obs.current, cpuSkill, seed);
    const start = performance.now();
    let raf = 0;
    let lastSec = DURATION;
    const step = (now: number) => {
      const t = (now - start) / 1000;
      tNow.current = t;
      for (const p of [0, 1] as Player[]) {
        const r = runners.current[p];
        if (t < DURATION) {
          if (p === 1 && cpu && cpuWantsJump(r, obs.current, plan, t)) tryJump(r, obs.current, t);
          const before = new Map(r.cleared);
          const ev = stepRunner(r, obs.current, t);
          if (ev === 'hit') {
            sfx.hit(0.35);
            pops.current.push({ p, text: 'ゴツン！', color: '#e8503a', t });
          } else if (ev === 'clear') {
            for (const [id, b] of r.cleared) {
              if (before.has(id)) continue;
              sfx.confirm();
              pops.current.push(b > 0.66 ? { p, text: 'ぎりぎり！', color: '#d99a00', t } : { p, text: 'ナイス', color: '#1f9d63', t });
            }
          }
          if (ev) setHud([runners.current[0].cleared.size, runners.current[1].cleared.size]);
        }
        draw(p, t, imgs[p]);
      }
      pops.current = pops.current.filter((x) => t - x.t < 0.7);
      const sec = Math.max(0, Math.ceil(DURATION - t));
      if (sec !== lastSec) {
        lastSec = sec;
        setTimeLeft(sec);
      }
      if (t >= DURATION && !finished.current) {
        finished.current = true;
        const n = obs.current.length;
        onFinish([jumpScore(runners.current[0], n), jumpScore(runners.current[1], n)]);
      }
      if (t < DURATION + 2.5) raf = requestAnimationFrame(step);
    };

    const draw = (p: Player, t: number, im: HTMLImageElement | null) => {
      const cv = canvases[p].current;
      if (!cv) return;
      const g = fitCanvas(cv, W, H);
      if (!g) return;
      const r = runners.current[p];
      // そら
      const sky = g.createLinearGradient(0, 0, 0, GROUND);
      sky.addColorStop(0, '#cfe8ff');
      sky.addColorStop(1, '#fff7e0');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      // とおくの 山（ゆっくり ながれる）
      g.fillStyle = '#d9ead0';
      g.beginPath();
      g.moveTo(0, GROUND);
      for (let x = 0; x <= W + 40; x += 40) {
        const xx = x - ((t * 18) % 40);
        g.quadraticCurveTo(xx + 20, GROUND - 22, xx + 40, GROUND);
      }
      g.fill();
      // じめん
      g.fillStyle = '#e8d3a8';
      g.fillRect(0, GROUND, W, H - GROUND);
      g.strokeStyle = '#33302b';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, GROUND);
      g.lineTo(W, GROUND);
      g.stroke();
      g.strokeStyle = '#b89b66';
      g.lineWidth = 1.5;
      for (let x = -((t * 120) % 24); x < W; x += 24) {
        g.beginPath();
        g.moveTo(x, GROUND + 7);
        g.lineTo(x + 8, GROUND + 7);
        g.stroke();
      }
      // しょうがいぶつ（いわ／トゲの くさ）
      for (const o of obs.current) {
        const ox = obstacleX(o, t);
        if (ox > W + 2 || ox + o.w < -4) continue;
        const hitIt = r.hit.has(o.id);
        if (o.id % 2 === 0) {
          g.fillStyle = hitIt ? '#c9a49c' : '#9b948a';
          g.beginPath();
          g.moveTo(ox, GROUND);
          g.quadraticCurveTo(ox - 1, GROUND - o.h, ox + o.w * 0.45, GROUND - o.h);
          g.quadraticCurveTo(ox + o.w + 1, GROUND - o.h + 1, ox + o.w, GROUND);
          g.closePath();
          g.fill();
          g.strokeStyle = '#33302b';
          g.lineWidth = 1.5;
          g.stroke();
        } else {
          g.fillStyle = hitIt ? '#c9a49c' : '#4cb06f';
          g.beginPath();
          g.moveTo(ox, GROUND);
          const n = 3;
          for (let i = 0; i < n; i++) {
            g.lineTo(ox + (o.w * (i + 0.5)) / n, GROUND - o.h);
            g.lineTo(ox + (o.w * (i + 1)) / n, GROUND - o.h * 0.35);
          }
          g.lineTo(ox + o.w, GROUND);
          g.closePath();
          g.fill();
          g.strokeStyle = '#33302b';
          g.lineWidth = 1.5;
          g.stroke();
        }
      }
      // かげ
      const cy = charY(r, t);
      const air = GROUND - CHAR_R + 2 - cy;
      g.fillStyle = 'rgba(0,0,0,.15)';
      g.beginPath();
      g.ellipse(CHAR_X, GROUND + 1, CHAR_R * (1 - air / 60), 2.5, 0, 0, Math.PI * 2);
      g.fill();
      // キャラ：はしる（ぴょこぴょこ）／とぶ（のびる）／ゴツン（つぶれて 赤く）
      const stunned = t < r.stunUntil;
      const flying = inAir(r, t);
      const s = flying && r.jumpAt != null ? (t - r.jumpAt < AIR_TIME / 2 ? 1.12 : 0.95) : stunned ? 0.8 : 1 + Math.sin(t * 24) * 0.05;
      const bob = flying ? 0 : Math.abs(Math.sin(t * 12)) * -1.5;
      drawFighter(g, im, fighters[p], CHAR_X, cy + bob, CHAR_R, { squash: s, alpha: stunned && Math.floor(t * 16) % 2 === 0 ? 0.5 : 1 });
      // ひとこと
      for (const x of pops.current) {
        if (x.p !== p) continue;
        const k = (t - x.t) / 0.7;
        g.save();
        g.globalAlpha = 1 - k;
        g.font = 'bold 13px sans-serif';
        g.textAlign = 'center';
        g.lineWidth = 3;
        g.strokeStyle = '#fff';
        g.strokeText(x.text, CHAR_X + 18, cy - 18 - k * 14);
        g.fillStyle = x.color;
        g.fillText(x.text, CHAR_X + 18, cy - 18 - k * 14);
        g.restore();
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const half = (p: Player) => (
    <Half key={p} player={p} name={names[p]} cpu={p === 1 && cpu}>
      <div style={{ width: '100%', display: 'grid', gap: 4 }}>
        <canvas
          ref={canvases[p]}
          onPointerDown={p === 0 && !twoPlayer ? () => jump(0) : undefined}
          style={{ ...canvasStyle(`${W} / ${H}`), cursor: p === 0 && !twoPlayer ? 'pointer' : 'default' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
          <span style={{ color: P_COLOR[p] }}>
            とびこえた {hud[p]} / {obs.current.length}
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>のこり {timeLeft}びょう</span>
        </div>
      </div>
    </Half>
  );
  return <Arena>{[half(0), half(1)]}</Arena>;
}
