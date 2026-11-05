import { useEffect, useRef, useState } from 'react';
import { mulberry32 } from '../../engine/rng';
import type { Attribute } from '../../engine/types';
import { ATTRIBUTE_META } from '../../engine/attributes';
import { Arena, Half, P_COLOR } from '../Arena';
import { usePads } from '../pads';
import { sfx } from '../../audio/sfx';
import type { GameProps, Player } from '../types';
import { cpuSteer, dodgeScore, DURATION, H, HIT_R, liveAt, LIVES, makeBullets, newSoul, stepSoul, W, type LiveBullet, type Soul } from './dodgeSim';

/**
 * よけろ！（アンダーテール風）：くろい はこの 中で 自分の キャラを うごかして、相手の わざの たまを よける。
 *  ・たまの とび方は ふたりとも おなじ（公平）。見た目だけ 相手の 属性（火の玉・しずく・はっぱ・かみなり・やみの たま）
 *  ・3回 あたると アウト。たまの すぐ そばを かすめると 加点（ひきわけ だらけに ならない）
 *  ・あたり判定は キャラの 絵より 小さい（アンダーテールの ハートと おなじ 考え方。ぎりぎりで よけられる）
 *  ・やじるし（2人は WASD／やじるし）で うごく（マウスは つかわない：マウスと キーで 有利・不利が でないように）
 */
const DRAW_R = 13;

function drawBullet(g: CanvasRenderingContext2D, attr: Attribute, b: { x: number; y: number; vx: number; vy: number; r: number }, t: number) {
  const c = ATTRIBUTE_META[attr].color;
  g.save();
  g.translate(b.x, b.y);
  if (attr === 'fire') {
    const a = Math.atan2(b.vy, b.vx);
    g.rotate(a);
    g.fillStyle = '#ffb347';
    g.beginPath();
    g.moveTo(-b.r * 2.4, 0);
    g.quadraticCurveTo(-b.r, -b.r, 0, -b.r);
    g.arc(0, 0, b.r, -Math.PI / 2, Math.PI / 2);
    g.quadraticCurveTo(-b.r, b.r, -b.r * 2.4, 0);
    g.fill();
    g.fillStyle = c;
    g.beginPath();
    g.arc(0, 0, b.r * 0.75, 0, Math.PI * 2);
    g.fill();
  } else if (attr === 'water') {
    g.rotate(Math.atan2(b.vy, b.vx) - Math.PI / 2);
    g.fillStyle = '#7cc0ff';
    g.beginPath();
    g.moveTo(0, -b.r * 1.8);
    g.quadraticCurveTo(b.r * 1.1, 0, 0, b.r);
    g.quadraticCurveTo(-b.r * 1.1, 0, 0, -b.r * 1.8);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(-b.r * 0.3, -b.r * 0.1, b.r * 0.25, 0, Math.PI * 2);
    g.fill();
  } else if (attr === 'wood') {
    g.rotate(t * 6 + b.x);
    g.fillStyle = '#4cc985';
    g.beginPath();
    g.ellipse(0, 0, b.r * 1.4, b.r * 0.7, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#167a48';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-b.r * 1.3, 0);
    g.lineTo(b.r * 1.3, 0);
    g.stroke();
  } else if (attr === 'bolt') {
    g.rotate(Math.atan2(b.vy, b.vx) - Math.PI / 2);
    g.fillStyle = '#ffe14d';
    g.strokeStyle = '#b07d00';
    g.lineWidth = 1;
    const r = b.r;
    g.beginPath();
    g.moveTo(-r * 0.3, -r * 1.6);
    g.lineTo(r * 0.7, -r * 0.2);
    g.lineTo(0, -r * 0.1);
    g.lineTo(r * 0.4, r * 1.6);
    g.lineTo(-r * 0.7, r * 0.1);
    g.lineTo(0, 0);
    g.closePath();
    g.fill();
    g.stroke();
  } else {
    const glow = g.createRadialGradient(0, 0, 0, 0, 0, b.r * 1.8);
    glow.addColorStop(0, '#e6dcff');
    glow.addColorStop(0.45, c);
    glow.addColorStop(1, 'rgba(123,92,240,0)');
    g.fillStyle = glow;
    g.beginPath();
    g.arc(0, 0, b.r * 1.8, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

export function Dodge({ seed, cpu, cpuSkill, names, fighters, onFinish }: GameProps) {
  const twoPlayer = !cpu;
  const pads = usePads(twoPlayer);
  const canvases = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)];
  const souls = useRef<[Soul, Soul]>([newSoul(), newSoul()]);
  const sparks = useRef<{ p: Player; x: number; y: number; t: number }[]>([]);
  const [hud, setHud] = useState<{ hits: [number, number]; grazes: [number, number] }>({ hits: [0, 0], grazes: [0, 0] });
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const finished = useRef(false);

  useEffect(() => {
    const bullets = makeBullets(seed);
    const imgs = fighters.map((f) => {
      if (!f.image) return null;
      const im = new Image();
      im.src = f.image;
      return im;
    });
    const rng = mulberry32((seed * 7 + 3) >>> 0);
    const start = performance.now();
    let last = start;
    let raf = 0;
    let lastSec = DURATION;
    const sync = () =>
      setHud({
        hits: [souls.current[0].hits, souls.current[1].hits],
        grazes: [souls.current[0].grazed.size - souls.current[0].hits, souls.current[1].grazed.size - souls.current[1].hits],
      });

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;
      const live = liveAt(bullets, t);

      for (const p of [0, 1] as Player[]) {
        const s = souls.current[p];
        if (t < DURATION) {
          let mx = 0;
          let my = 0;
          if (p === 1 && cpu) {
            [mx, my] = cpuSteer(s, bullets, t, cpuSkill, rng);
          } else {
            const h = pads.held[p];
            mx = (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0);
            my = (h.has('down') ? 1 : 0) - (h.has('up') ? 1 : 0);
            const m = Math.hypot(mx, my);
            if (m > 1) {
              mx /= m;
              my /= m;
            }
          }
          const ev = stepSoul(s, mx, my, dt, live);
          if (ev === 'hit') {
            sfx.hit(0.3);
            sync();
          } else if (ev === 'graze') {
            sfx.tick(1.6);
            sparks.current.push({ p, x: s.x, y: s.y, t });
            sync();
          }
        }
        draw(p, t, live);
      }
      sparks.current = sparks.current.filter((sp) => t - sp.t < 0.4);

      const sec = Math.max(0, Math.ceil(DURATION - t));
      if (sec !== lastSec) {
        lastSec = sec;
        setTimeLeft(sec);
        if (sec > 0 && sec <= 3) sfx.tick(1 + (3 - sec) * 0.15);
      }
      const bothOut = souls.current.every((s) => s.hits >= LIVES);
      if ((t >= DURATION || bothOut) && !finished.current) {
        finished.current = true;
        onFinish([dodgeScore(souls.current[0]), dodgeScore(souls.current[1])]);
      }
      if (t < DURATION + 2.5) raf = requestAnimationFrame(step);
    };

    const draw = (p: Player, t: number, live: LiveBullet[]) => {
      const cv = canvases[p].current;
      if (!cv) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = cv.clientWidth;
      if (cv.width !== Math.round(cw * dpr)) {
        cv.width = Math.round(cw * dpr);
        cv.height = Math.round(((cw * H) / W) * dpr);
      }
      const g = cv.getContext('2d');
      if (!g) return;
      const k = cv.width / W;
      const s = souls.current[p];
      const out = s.hits >= LIVES;
      // あたった しゅんかん：はこが ゆれて 赤く 光る
      const hitNow = s.inv > 0.7 && !out;
      const shake = hitNow ? (s.inv - 0.7) * 18 : 0;
      g.setTransform(k, 0, 0, k, (Math.random() - 0.5) * shake * k, (Math.random() - 0.5) * shake * k);
      g.fillStyle = '#16131d';
      g.fillRect(-10, -10, W + 20, H + 20);
      const foe = fighters[p === 0 ? 1 : 0].attribute;
      for (const b of live) drawBullet(g, foe, b, t);
      // かすめた しるし（きらっ）
      for (const sp of sparks.current) {
        if (sp.p !== p) continue;
        const a = 1 - (t - sp.t) / 0.4;
        g.strokeStyle = `rgba(255,236,120,${a})`;
        g.lineWidth = 2;
        const r = 10 + (1 - a) * 10;
        g.beginPath();
        for (let i = 0; i < 4; i++) {
          const ang = (Math.PI / 2) * i + Math.PI / 4;
          g.moveTo(sp.x + Math.cos(ang) * r * 0.5, sp.y + Math.sin(ang) * r * 0.5);
          g.lineTo(sp.x + Math.cos(ang) * r, sp.y + Math.sin(ang) * r);
        }
        g.stroke();
      }
      const blink = s.inv > 0 && !out && Math.floor(t * 14) % 2 === 0;
      if (!blink) {
        g.save();
        g.translate(s.x, s.y);
        if (out) g.globalAlpha = 0.35;
        const im = imgs[p];
        if (im && im.complete && im.naturalWidth > 0) {
          g.drawImage(im, -DRAW_R, -DRAW_R, DRAW_R * 2, DRAW_R * 2);
        } else {
          g.fillStyle = ATTRIBUTE_META[fighters[p].attribute].color;
          g.beginPath();
          g.arc(0, 0, DRAW_R * 0.8, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#fff';
          g.beginPath();
          g.arc(-3.5, -2, 2.2, 0, Math.PI * 2);
          g.arc(3.5, -2, 2.2, 0, Math.PI * 2);
          g.fill();
        }
        g.strokeStyle = P_COLOR[p];
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(0, 0, HIT_R, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
      if (hitNow) {
        g.fillStyle = `rgba(232,80,58,${((s.inv - 0.7) / 0.2) * 0.45})`;
        g.fillRect(-10, -10, W + 20, H + 20);
      }
      if (out) {
        g.fillStyle = 'rgba(255,255,255,.9)';
        g.font = 'bold 22px sans-serif';
        g.textAlign = 'center';
        g.fillText('アウト…', W / 2, H / 2);
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
          style={{ width: '100%', aspectRatio: `${W} / ${H}`, display: 'block', borderRadius: 6, border: '4px solid #fff', outline: '3px solid var(--ink)', touchAction: 'none', }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 900 }}>
          <span style={{ display: 'flex', gap: 2 }}>
            {Array.from({ length: LIVES }, (_, i) => (
              <svg key={i} viewBox="-12 -11 24 22" width="1.3em" height="1.2em" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                <path d="M0,9 Q-12,1 -8,-5 Q-4,-10 0,-4 Q4,-10 8,-5 Q12,1 0,9Z" fill={i < LIVES - hud.hits[p] ? P_COLOR[p] : '#cfc9bd'} stroke="var(--ink)" strokeWidth={1.6} />
              </svg>
            ))}
          </span>
          <span style={{ fontSize: '0.85rem', color: '#b07d00' }}>かすった {hud.grazes[p]}</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>のこり {timeLeft}びょう</span>
        </div>
      </div>
    </Half>
  );

  return <Arena>{[half(0), half(1)]}</Arena>;
}
