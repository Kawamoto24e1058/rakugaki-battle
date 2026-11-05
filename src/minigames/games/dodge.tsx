import { useEffect, useRef, useState } from 'react';
import { mulberry32 } from '../../engine/rng';
import type { Attribute } from '../../engine/types';
import { ATTRIBUTE_META } from '../../engine/attributes';
import { Arena, Half, P_COLOR } from '../Arena';
import { usePads, type Pads } from '../pads';
import { sfx } from '../../audio/sfx';
import type { GameProps, Player } from '../types';

/**
 * よけろ！（アンダーテール風）：くろい はこの 中で 自分の キャラを うごかして、相手の わざの たまを よける。
 *  ・たまの とび方は ふたりとも おなじ（公平）。見た目だけ 相手の 属性（火の玉・しずく・はっぱ・かみなり・やみの たま）
 *  ・3回 あたると アウト。あたらずに 5びょう にげきれば 100てん
 *  ・あたり判定は キャラの 絵より 小さい（アンダーテールの ハートと おなじ 考え方。ぎりぎりで よけられる）
 */
const W = 200;
const H = 150;
const DURATION = 5;
const LIVES = 3;
const SPEED = 105;
const HIT_R = 6;
const DRAW_R = 13;

type Pattern = 'rain' | 'sides' | 'fan' | 'wall';
interface Bullet {
  t: number; // 出てくる 時間
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

/** たまの 予定表（seed から きまる。ふたり おなじ）。 */
function makeBullets(seed: number): { bullets: Bullet[]; patterns: Pattern[] } {
  const rng = mulberry32(seed >>> 0);
  const all: Pattern[] = ['rain', 'sides', 'fan', 'wall'];
  // 前半と 後半で ちがう もようを 1つずつ
  const a = all[Math.floor(rng() * all.length)];
  const rest = all.filter((p) => p !== a);
  const b = rest[Math.floor(rng() * rest.length)];
  const bullets: Bullet[] = [];
  const add = (p: Pattern, t0: number, t1: number) => {
    if (p === 'rain') {
      for (let t = t0; t < t1; t += 0.16 + rng() * 0.08) bullets.push({ t, x: 8 + rng() * (W - 16), y: -6, vx: (rng() - 0.5) * 12, vy: 70 + rng() * 40, r: 5 });
    } else if (p === 'sides') {
      for (let t = t0; t < t1; t += 0.32) {
        const left = rng() < 0.5;
        const y = 10 + rng() * (H - 20);
        bullets.push({ t, x: left ? -6 : W + 6, y, vx: (left ? 1 : -1) * (85 + rng() * 25), vy: 0, r: 6 });
        bullets.push({ t: t + 0.1, x: left ? W + 6 : -6, y: 10 + rng() * (H - 20), vx: (left ? -1 : 1) * (85 + rng() * 25), vy: 0, r: 6 });
      }
    } else if (p === 'fan') {
      for (let t = t0; t < t1; t += 0.75) {
        const cx = 20 + rng() * (W - 40);
        const n = 6;
        const off = rng() * 0.3;
        for (let i = 0; i < n; i++) {
          const ang = Math.PI * (0.18 + (0.64 * (i + off)) / (n - 1 + 0.3));
          bullets.push({ t, x: cx, y: -4, vx: Math.cos(ang) * 75, vy: Math.sin(ang) * 75, r: 5 });
        }
      }
    } else {
      // よこ一列の かべに すきま 1つ（すきまを くぐる）
      for (let t = t0; t < t1; t += 0.95) {
        const gap = 25 + rng() * (W - 50);
        for (let x = 6; x < W; x += 14) if (Math.abs(x - gap) > 22) bullets.push({ t, x, y: -6, vx: 0, vy: 62, r: 6 });
      }
    }
  };
  // さいしょの 0.5びょうは たまなし（いちを たしかめる 時間）
  add(a, 0.5, 2.7);
  add(b, 2.7, DURATION - 0.5);
  return { bullets, patterns: [a, b] };
}

interface Soul {
  x: number;
  y: number;
  hits: number;
  inv: number; // むてき のこり
  target: { x: number; y: number } | null; // マウスで ねらう 場所
}

/** CPU の うごき：ちかい たまから にげる＋まんなかへ もどる。うまさで 気づく きょりと 速さが かわる。 */
function cpuSteer(s: Soul, live: { x: number; y: number; vx: number; vy: number }[], skill: number, rng: () => number): [number, number] {
  const sense = 18 + 30 * skill;
  let fx = (W / 2 - s.x) * 0.012;
  let fy = (H * 0.65 - s.y) * 0.012;
  for (const b of live) {
    // すこし 先の いちで かんがえる
    const px = b.x + b.vx * 0.12 * skill;
    const py = b.y + b.vy * 0.12 * skill;
    const dx = s.x - px;
    const dy = s.y - py;
    const d = Math.hypot(dx, dy);
    if (d > sense || d < 0.01) continue;
    const k = ((sense - d) / sense) ** 2 * 3;
    fx += (dx / d) * k;
    fy += (dy / d) * k;
  }
  fx += (rng() - 0.5) * (1 - skill) * 1.2;
  fy += (rng() - 0.5) * (1 - skill) * 1.2;
  const m = Math.hypot(fx, fy);
  if (m < 0.05) return [0, 0];
  const sp = 0.55 + 0.45 * skill;
  return [(fx / m) * sp, (fy / m) * sp];
}

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
  const pads: Pads = usePads(twoPlayer);
  const canvases = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)];
  const souls = useRef<[Soul, Soul]>([
    { x: W / 2, y: H * 0.7, hits: 0, inv: 0, target: null },
    { x: W / 2, y: H * 0.7, hits: 0, inv: 0, target: null },
  ]);
  const [hud, setHud] = useState<[number, number]>([0, 0]);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const finished = useRef(false);

  useEffect(() => {
    const { bullets } = makeBullets(seed);
    // 絵を 読みこむ
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
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;
      const live = bullets
        .filter((b) => t >= b.t)
        .map((b) => ({ x: b.x + b.vx * (t - b.t), y: b.y + b.vy * (t - b.t), vx: b.vx, vy: b.vy, r: b.r }))
        .filter((b) => b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20);

      for (const p of [0, 1] as Player[]) {
        const s = souls.current[p];
        const out = s.hits >= LIVES;
        if (!out && t < DURATION) {
          let mx = 0;
          let my = 0;
          if (p === 1 && cpu) {
            [mx, my] = cpuSteer(s, live, cpuSkill, rng);
          } else {
            const h = pads.held[p];
            mx = (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0);
            my = (h.has('down') ? 1 : 0) - (h.has('up') ? 1 : 0);
            if (mx === 0 && my === 0 && s.target) {
              const dx = s.target.x - s.x;
              const dy = s.target.y - s.y;
              const d = Math.hypot(dx, dy);
              if (d > 1.5) {
                mx = dx / d;
                my = dy / d;
              }
            }
            const m = Math.hypot(mx, my);
            if (m > 1) {
              mx /= m;
              my /= m;
            }
          }
          s.x = Math.max(HIT_R + 2, Math.min(W - HIT_R - 2, s.x + mx * SPEED * dt));
          s.y = Math.max(HIT_R + 2, Math.min(H - HIT_R - 2, s.y + my * SPEED * dt));
          s.inv = Math.max(0, s.inv - dt);
          if (s.inv === 0) {
            for (const b of live) {
              if (Math.hypot(b.x - s.x, b.y - s.y) < b.r * 0.8 + HIT_R) {
                s.hits++;
                s.inv = 0.9;
                sfx.hit(0.3);
                setHud([souls.current[0].hits, souls.current[1].hits]);
                break;
              }
            }
          }
        }
        draw(p, t, live, out);
      }

      const sec = Math.max(0, Math.ceil(DURATION - t));
      if (sec !== lastSec) {
        lastSec = sec;
        setTimeLeft(sec);
        if (sec > 0 && sec <= 3) sfx.tick(1 + (3 - sec) * 0.15);
      }
      const bothOut = souls.current.every((s) => s.hits >= LIVES);
      if ((t >= DURATION || bothOut) && !finished.current) {
        finished.current = true;
        const score = (s: Soul) => Math.max(0, 100 - s.hits * 35);
        onFinish([score(souls.current[0]), score(souls.current[1])]);
      }
      if (t < DURATION + 2.5) raf = requestAnimationFrame(step);
    };

    const draw = (p: Player, t: number, live: { x: number; y: number; vx: number; vy: number; r: number }[], out: boolean) => {
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
      // あたった しゅんかん：はこが ゆれて 赤く 光る
      const hitNow = s.inv > 0.7 && !out;
      const shake = hitNow ? (s.inv - 0.7) * 18 : 0;
      g.setTransform(k, 0, 0, k, (Math.random() - 0.5) * shake * k, (Math.random() - 0.5) * shake * k);
      g.fillStyle = '#16131d';
      g.fillRect(-10, -10, W + 20, H + 20);
      // たまは 相手の 属性の 見た目
      const foe = fighters[p === 0 ? 1 : 0].attribute;
      for (const b of live) drawBullet(g, foe, b, t);
      // じぶん
      const blink = s.inv > 0 && Math.floor(t * 14) % 2 === 0;
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
        // あたり判定（小さい まる）を うすく 見せる
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

  // マウス：はこの 中で うごかすと そこへ むかう（1人の ときの P1 だけ）
  const onMove = (p: Player) => (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (p === 1 && cpu) return;
    if (twoPlayer) return;
    const r = e.currentTarget.getBoundingClientRect();
    souls.current[p].target = { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const half = (p: Player) => (
    <Half key={p} player={p} name={names[p]} cpu={p === 1 && cpu}>
      <div style={{ width: '100%', display: 'grid', gap: 4 }}>
        <canvas
          ref={canvases[p]}
          onPointerMove={onMove(p)}
          style={{ width: '100%', aspectRatio: `${W} / ${H}`, display: 'block', borderRadius: 6, border: '4px solid #fff', outline: '3px solid var(--ink)', touchAction: 'none', cursor: 'none' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 900 }}>
          <span style={{ display: 'flex', gap: 2 }}>
            {Array.from({ length: LIVES }, (_, i) => (
              <svg key={i} viewBox="-12 -11 24 22" width="1.3em" height="1.2em" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                <path d="M0,9 Q-12,1 -8,-5 Q-4,-10 0,-4 Q4,-10 8,-5 Q12,1 0,9Z" fill={i < LIVES - hud[p] ? P_COLOR[p] : '#cfc9bd'} stroke="var(--ink)" strokeWidth={1.6} />
              </svg>
            ))}
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>のこり {timeLeft}びょう</span>
        </div>
      </div>
    </Half>
  );

  return <Arena>{[half(0), half(1)]}</Arena>;
}
