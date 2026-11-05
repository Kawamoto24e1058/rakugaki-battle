import { useEffect, useRef, useState } from 'react';
import { mulberry32 } from '../../engine/rng';
import { Arena, Half, P_COLOR } from '../Arena';
import { usePads } from '../pads';
import { sfx } from '../../audio/sfx';
import type { GameProps, Player } from '../types';
import { canvasStyle, drawFighter, fitCanvas, loadFighterImages } from './canvasKit';
import { catchScore, CHAR_R, cpuMoveCatch, DURATION, dropY, FLOOR, H, makeDrops, MOUSE_SPEED, newCatcher, stepCatcher, W, type Catcher, type Drop } from './catchSim';

const FRUIT = ['#e8503a', '#f2b705', '#7b5cf0'];

function drawDrop(g: CanvasRenderingContext2D, d: Drop, y: number, t: number) {
  g.save();
  g.translate(d.x, y);
  if (d.bomb) {
    g.fillStyle = '#2b2733';
    g.beginPath();
    g.arc(0, 0, 7, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#8a7f6a';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(3, -6);
    g.quadraticCurveTo(6, -11, 9, -10);
    g.stroke();
    // ひばな
    g.fillStyle = Math.floor(t * 12) % 2 ? '#ffb347' : '#ffe14d';
    g.beginPath();
    g.arc(9, -10, 2.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)';
    g.beginPath();
    g.arc(-2.5, -2.5, 2, 0, Math.PI * 2);
    g.fill();
  } else {
    g.rotate(Math.sin(t * 5 + d.id) * 0.3);
    g.fillStyle = FRUIT[d.kind];
    g.strokeStyle = '#33302b';
    g.lineWidth = 1.3;
    g.beginPath();
    g.arc(0, 1, 7, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#4cb06f';
    g.beginPath();
    g.ellipse(3, -6, 3.5, 1.8, -0.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.beginPath();
    g.arc(-2.5, -1.5, 1.8, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/**
 * うけとめろ！：上から おちてくる くだもの を うけとめる。ばくだんは よける（あたると すこし うごけない）。
 * ← →（2人は A D／← →）で うごく。1人の ときは マウスの よこの いちを おいかける。
 */
export function CatchGame({ seed, cpu, cpuSkill, names, fighters, onFinish }: GameProps) {
  const twoPlayer = !cpu;
  const pads = usePads(twoPlayer);
  const canvases = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)];
  const cs = useRef<[Catcher, Catcher]>([newCatcher(), newCatcher()]);
  const mouseX = useRef<number | null>(null);
  const pops = useRef<{ p: Player; good: boolean; x: number; t: number }[]>([]);
  const [hud, setHud] = useState<[number, number]>([0, 0]);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const finished = useRef(false);

  useEffect(() => {
    const drops = makeDrops(seed);
    const imgs = loadFighterImages(fighters);
    const rng = mulberry32((seed * 5 + 9) >>> 0);
    const start = performance.now();
    let last = start;
    let raf = 0;
    let lastSec = DURATION;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;
      for (const p of [0, 1] as Player[]) {
        const c = cs.current[p];
        if (t < DURATION) {
          let mx = 0;
          let max: number | undefined;
          if (p === 1 && cpu) mx = cpuMoveCatch(c, drops, t, cpuSkill, rng);
          else {
            const h = pads.held[p];
            mx = (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0);
            if (mx === 0 && p === 0 && mouseX.current != null) {
              const dx = mouseX.current - c.x;
              if (Math.abs(dx) > 0.5) {
                mx = Math.sign(dx) * Math.min(1, Math.abs(dx) / (MOUSE_SPEED * dt));
                max = MOUSE_SPEED;
              }
            }
          }
          const ev = stepCatcher(c, drops, t, dt, mx, max);
          if (ev === 'catch') {
            sfx.confirm();
            pops.current.push({ p, good: true, x: c.x, t });
          } else if (ev === 'bomb') {
            sfx.hit(0.5);
            pops.current.push({ p, good: false, x: c.x, t });
          }
          if (ev) setHud([cs.current[0].caught.size, cs.current[1].caught.size]);
        }
        draw(p, t, drops, imgs[p]);
      }
      pops.current = pops.current.filter((x) => t - x.t < 0.6);
      const sec = Math.max(0, Math.ceil(DURATION - t));
      if (sec !== lastSec) {
        lastSec = sec;
        setTimeLeft(sec);
        if (sec > 0 && sec <= 3) sfx.tick(1 + (3 - sec) * 0.15);
      }
      if (t >= DURATION && !finished.current) {
        finished.current = true;
        onFinish([catchScore(cs.current[0], drops), catchScore(cs.current[1], drops)]);
      }
      if (t < DURATION + 2.5) raf = requestAnimationFrame(step);
    };

    const draw = (p: Player, t: number, drops: Drop[], im: HTMLImageElement | null) => {
      const cv = canvases[p].current;
      if (!cv) return;
      const g = fitCanvas(cv, W, H);
      if (!g) return;
      const c = cs.current[p];
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#fff3d6');
      sky.addColorStop(1, '#ffe2c4');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      // 木の えだ（上）
      g.fillStyle = '#7fc98f';
      for (let x = -10; x < W + 20; x += 26) {
        g.beginPath();
        g.ellipse(x, -2, 18, 10, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#d9c39a';
      g.fillRect(0, FLOOR, W, H - FLOOR);
      g.strokeStyle = '#33302b';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, FLOOR);
      g.lineTo(W, FLOOR);
      g.stroke();
      for (const d of drops) {
        if (t < d.t || c.caught.has(d.id) || c.bombed.has(d.id)) continue;
        const y = dropY(d, t);
        if (y > FLOOR + 4) continue;
        drawDrop(g, d, y, t);
      }
      const stunned = t < c.stunUntil;
      // カゴ（キャラの 頭の 上）
      const cy = FLOOR - CHAR_R + 1;
      drawFighter(g, im, fighters[p], c.x, cy, CHAR_R, { squash: stunned ? 0.75 : 1 + Math.sin(t * 10) * 0.03, alpha: stunned && Math.floor(t * 16) % 2 ? 0.5 : 1 });
      g.strokeStyle = '#8a5a2b';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(c.x - 13, cy - CHAR_R - 2);
      g.quadraticCurveTo(c.x, cy - CHAR_R + 6, c.x + 13, cy - CHAR_R - 2);
      g.stroke();
      for (const x of pops.current) {
        if (x.p !== p) continue;
        const k = (t - x.t) / 0.6;
        g.save();
        g.globalAlpha = 1 - k;
        g.font = 'bold 12px sans-serif';
        g.textAlign = 'center';
        g.lineWidth = 3;
        g.strokeStyle = '#fff';
        const label = x.good ? 'キャッチ！' : 'ドカン！';
        g.strokeText(label, x.x, cy - 26 - k * 12);
        g.fillStyle = x.good ? '#1f9d63' : '#e8503a';
        g.fillText(label, x.x, cy - 26 - k * 12);
        g.restore();
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mouseX.current = ((e.clientX - r.left) / r.width) * W;
  };

  const half = (p: Player) => (
    <Half key={p} player={p} name={names[p]} cpu={p === 1 && cpu}>
      <div style={{ width: '100%', display: 'grid', gap: 4 }}>
        <canvas ref={canvases[p]} onPointerMove={p === 0 && !twoPlayer ? onMove : undefined} style={{ ...canvasStyle(`${W} / ${H}`), cursor: p === 0 && !twoPlayer ? 'ew-resize' : 'default' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
          <span style={{ color: P_COLOR[p] }}>キャッチ {hud[p]}こ</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>のこり {timeLeft}びょう</span>
        </div>
      </div>
    </Half>
  );
  return <Arena>{[half(0), half(1)]}</Arena>;
}
