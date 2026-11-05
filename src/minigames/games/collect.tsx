import { useEffect, useRef, useState } from 'react';
import { Arena, Half, P_COLOR } from '../Arena';
import { usePads } from '../pads';
import { sfx } from '../../audio/sfx';
import type { GameProps, Player } from '../types';
import { canvasStyle, drawFighter, drawStar, fitCanvas, loadFighterImages } from './canvasKit';
import { collectScore, cpuMove, DURATION, H, makeWorld, MOUSE_SPEED, newCollector, R, spikesAt, SPIKE_R, STAR_R, stepCollector, W, type Collector } from './collectSim';

/**
 * あつめろ！：はこの 中で ほしを じゅんばんに とる。はねまわる トゲに あたると すこし うごけない。
 * やじるし（2人は WASD／やじるし）で うごく。1人の ときは マウスの カーソルを おいかける（はやい）。
 */
export function Collect({ seed, cpu, cpuSkill, names, fighters, onFinish }: GameProps) {
  const twoPlayer = !cpu;
  const pads = usePads(twoPlayer);
  const canvases = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)];
  const cs = useRef<[Collector, Collector]>([newCollector(), newCollector()]);
  const mouse = useRef<{ x: number; y: number } | null>(null);
  const bursts = useRef<{ p: Player; x: number; y: number; t: number }[]>([]);
  const [hud, setHud] = useState<[number, number]>([0, 0]);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const finished = useRef(false);

  useEffect(() => {
    const world = makeWorld(seed);
    const imgs = loadFighterImages(fighters);
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
          let my = 0;
          let max: number | undefined;
          if (p === 1 && cpu) {
            [mx, my] = cpuMove(c, world, t, cpuSkill);
          } else {
            const h = pads.held[p];
            mx = (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0);
            my = (h.has('down') ? 1 : 0) - (h.has('up') ? 1 : 0);
            if (mx === 0 && my === 0 && p === 0 && mouse.current) {
              const dx = mouse.current.x - c.x;
              const dy = mouse.current.y - c.y;
              const d = Math.hypot(dx, dy);
              // カーソルに おいつく（ちかい ときは ぴったり とまる）
              if (d > 0.5) {
                const k = Math.min(1, d / (MOUSE_SPEED * dt));
                mx = (dx / d) * k;
                my = (dy / d) * k;
                max = MOUSE_SPEED;
              }
            }
          }
          const star = world.stars[c.got % world.stars.length];
          const ev = stepCollector(c, world, t, dt, mx, my, max);
          if (ev === 'got') {
            sfx.confirm();
            bursts.current.push({ p, x: star.x, y: star.y, t });
            setHud([cs.current[0].got, cs.current[1].got]);
          } else if (ev === 'ouch') sfx.hit(0.25);
        }
        draw(p, t, world, imgs[p]);
      }
      bursts.current = bursts.current.filter((b) => t - b.t < 0.45);
      const sec = Math.max(0, Math.ceil(DURATION - t));
      if (sec !== lastSec) {
        lastSec = sec;
        setTimeLeft(sec);
        if (sec > 0 && sec <= 3) sfx.tick(1 + (3 - sec) * 0.15);
      }
      if (t >= DURATION && !finished.current) {
        finished.current = true;
        onFinish([collectScore(cs.current[0], world), collectScore(cs.current[1], world)]);
      }
      if (t < DURATION + 2.5) raf = requestAnimationFrame(step);
    };

    const draw = (p: Player, t: number, world: ReturnType<typeof makeWorld>, im: HTMLImageElement | null) => {
      const cv = canvases[p].current;
      if (!cv) return;
      const g = fitCanvas(cv, W, H);
      if (!g) return;
      const c = cs.current[p];
      // よぞら
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#1d2b53');
      bg.addColorStop(1, '#3b2f6b');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,.5)';
      for (let i = 0; i < 24; i++) g.fillRect((i * 53) % W, (i * 37) % H, 1.2, 1.2);
      // つぎの ほし（ぴかぴか）
      const star = world.stars[c.got % world.stars.length];
      const pulse = 1 + Math.sin(t * 10) * 0.12;
      g.fillStyle = 'rgba(255,214,0,.4)';
      g.beginPath();
      g.arc(star.x, star.y, STAR_R * 2 * pulse, 0, Math.PI * 2);
      g.fill();
      drawStar(g, star.x, star.y, STAR_R * pulse, '#ffe14d', t * 1.5);
      // とった ときの きらきら
      for (const b of bursts.current) {
        if (b.p !== p) continue;
        const k = (t - b.t) / 0.45;
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI * 2 * i) / 6;
          drawStar(g, b.x + Math.cos(a) * k * 22, b.y + Math.sin(a) * k * 22, 3 * (1 - k), '#ffe14d');
        }
      }
      // トゲ
      for (const s of spikesAt(world, t)) {
        g.save();
        g.translate(s.x, s.y);
        g.rotate(t * 4);
        g.fillStyle = '#e8503a';
        g.beginPath();
        for (let i = 0; i < 16; i++) {
          const r = i % 2 === 0 ? SPIKE_R + 3 : SPIKE_R - 1;
          const a = (Math.PI * i) / 8;
          g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath();
        g.fill();
        g.strokeStyle = '#33302b';
        g.lineWidth = 1.2;
        g.stroke();
        g.restore();
      }
      // じぶん
      const stunned = t < c.stunUntil;
      const blink = c.inv > 0 && Math.floor(t * 14) % 2 === 0;
      drawFighter(g, im, fighters[p], c.x, c.y, R + 5, { alpha: blink ? 0.4 : 1, squash: stunned ? 0.8 : 1 + Math.sin(t * 9) * 0.04, flip: p === 1 });
      if (stunned) {
        g.fillStyle = '#fff';
        g.font = 'bold 11px sans-serif';
        g.textAlign = 'center';
        g.fillText('いたっ', c.x, c.y - 16);
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mouse.current = { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const half = (p: Player) => (
    <Half key={p} player={p} name={names[p]} cpu={p === 1 && cpu}>
      <div style={{ width: '100%', display: 'grid', gap: 4 }}>
        <canvas ref={canvases[p]} onPointerMove={p === 0 && !twoPlayer ? onMove : undefined} style={{ ...canvasStyle(`${W} / ${H}`, true), cursor: p === 0 && !twoPlayer ? 'crosshair' : 'default' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
          <span style={{ color: P_COLOR[p] }}>ほし {hud[p]}こ</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>のこり {timeLeft}びょう</span>
        </div>
      </div>
    </Half>
  );
  return <Arena>{[half(0), half(1)]}</Arena>;
}
