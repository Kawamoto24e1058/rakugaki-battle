import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { mulberry32 } from '../../engine/rng';
import { CharacterSprite } from '../../components/bits';
import { Arena, Half, P_COLOR } from '../Arena';
import { isTwoPlayer, keyLabels, usePlayerKeys } from '../input';
import type { GameProps, Player } from '../types';
import type { MgFighter } from '../context';
import { TimeBar } from './body';
import { sfx } from '../../audio/sfx';

const now = () => performance.now();
const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));

function Avatar({ f, size = '3rem', flip, style }: { f: MgFighter; size?: string; flip?: boolean; style?: CSSProperties }) {
  return (
    <div style={{ width: size, height: size, ...style }}>
      <CharacterSprite imageUrl={f.image} attribute={f.attribute} name={f.name} flip={flip} />
    </div>
  );
}

// ================================================================ もぐらたたき
const MOLES = 8;

export function Mole({ seed, cpu, cpuSkill, names, fighters, onFinish }: GameProps) {
  // 出る あなと 時間（ふたり 同じ）
  const plan = useMemo(() => {
    const r = mulberry32(seed ^ 0x6d6f);
    let t = 500;
    let prev = -1;
    return Array.from({ length: MOLES }, (_, i) => {
      let hole = Math.floor(r() * 3);
      if (hole === prev) hole = (hole + 1 + Math.floor(r() * 2)) % 3;
      prev = hole;
      const up = 950 - i * 45;
      const m = { hole, at: t, up };
      t += up + 220 + r() * 200;
      return m;
    });
  }, [seed]);
  const endAt = plan[plan.length - 1].at + plan[plan.length - 1].up + 300;
  const start = useRef(now());
  const [t, setT] = useState(0);
  const hits = useRef<[Set<number>, Set<number>]>([new Set(), new Set()]);
  const misses = useRef<[number, number]>([0, 0]);
  const [tick, setTick] = useState(0);
  const [mood, setMood] = useState<[{ m: 'good' | 'bad'; k: number } | null, { m: 'good' | 'bad'; k: number } | null]>([null, null]);
  const over = useRef(false);

  const current = (ms: number) => plan.findIndex((m) => ms >= m.at && ms < m.at + m.up);
  const whack = (p: Player, hole: number) => {
    if (over.current) return;
    const ms = now() - start.current;
    const i = current(ms);
    const ok = i >= 0 && plan[i].hole === hole && !hits.current[p].has(i);
    if (ok) {
      hits.current[p].add(i);
      sfx.hit(0.2);
    } else misses.current[p] += 1;
    setMood((m) => {
      const n: typeof m = [...m] as typeof m;
      n[p] = { m: ok ? 'good' : 'bad', k: (m[p]?.k ?? 0) + 1 };
      return n;
    });
    setTick((x) => x + 1);
  };
  usePlayerKeys((p, i) => {
    if (p === 1 && cpu) return;
    whack(p, i);
  });
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = now() - start.current;
      setT(el);
      if (el >= endAt) {
        if (!over.current) {
          over.current = true;
          const sc = (p: Player) => clamp((hits.current[p].size / MOLES) * 100 - misses.current[p] * 6);
          onFinish([sc(0), sc(1)]);
        }
      } else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!cpu) return;
    const r = mulberry32(seed ^ 0x77aa);
    const ids = plan.map((m) => {
      const hit = r() < 0.5 + cpuSkill * 0.45;
      const rt = 280 + (1 - cpuSkill) * 320 + r() * 160;
      return window.setTimeout(() => whack(1, hit ? m.hole : (m.hole + 1) % 3), m.at + Math.min(rt, m.up - 60));
    });
    return () => ids.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpu, cpuSkill, seed]);
  void tick;

  const cur = current(t);
  const side = (p: Player) => {
    const foe = fighters[p === 0 ? 1 : 0];
    return (
      <Half key={p} player={p} name={names[p]} cpu={p === 1 && cpu} mood={mood[p]?.m ?? null}>
        <div style={{ fontWeight: 900 }}>{hits.current[p].size} ひき</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', width: '100%' }}>
          {[0, 1, 2].map((h) => {
            const up = cur >= 0 && plan[cur].hole === h;
            const whacked = up && hits.current[p].has(cur);
            return (
              <button
                key={h}
                className="crayon-btn"
                disabled={p === 1 && cpu}
                onPointerDown={(e) => {
                  e.preventDefault();
                  // 1人の ときは クリックだけ、2人の ときは キーだけ
                  if (!(p === 1 && cpu) && !isTwoPlayer()) whack(p, h);
                }}
                style={{ position: 'relative', height: '5.6rem', padding: 0, overflow: 'hidden', background: '#bfe3a8', touchAction: 'manipulation' }}
              >
                <AnimatePresence>
                  {up && (
                    <motion.div
                      key={`${cur}-${h}`}
                      initial={{ y: '90%' }}
                      animate={whacked ? { y: '60%', scaleY: 0.5 } : { y: '8%' }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                      style={{ position: 'absolute', left: '12%', right: '12%', top: 0, bottom: '18%' }}
                    >
                      <Avatar f={foe} size="100%" flip={p === 0} />
                      {whacked && <div style={{ position: 'absolute', top: '-10%', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-display)', color: P_COLOR[p] }}>ポカ！</div>}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div style={{ position: 'absolute', left: '6%', right: '6%', bottom: '4%', height: '24%', borderRadius: '50%', background: '#5b3a1e', border: '3px solid var(--ink)' }} />
                <div style={{ position: 'absolute', bottom: 2, left: 0, right: 0, fontSize: '0.6rem', opacity: 0.6 }}>{p === 1 && cpu ? '' : keyLabels(p, 'choice')[h]}</div>
              </button>
            );
          })}
        </div>
      </Half>
    );
  };
  return (
    <Arena top={<TimeBar ms={Math.max(0, endAt - t)} total={endAt} label="でてきた あいてを たたけ！" />}>
      {side(0)}
      {side(1)}
    </Arena>
  );
}
