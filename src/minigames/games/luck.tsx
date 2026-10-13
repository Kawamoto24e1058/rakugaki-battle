import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { mulberry32 } from '../../engine/rng';
import { Arena, BigButton, ChoiceButtons, Half, P_COLOR } from '../Arena';
import { usePlayerKeys } from '../input';
import type { GameProps, Player } from '../types';

const now = () => performance.now();

// ---------------------------------------------------------------- ルーレット
const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8];
const SPIN_MAX = 4000;

export function Roulette({ seed, cpu, names, onFinish }: GameProps) {
  const start = useRef(now());
  const [t, setT] = useState(0);
  const stopAt = useRef<[number | null, number | null]>([null, null]);
  const [stops, setStops] = useState<[number | null, number | null]>([null, null]);
  const over = useRef(false);
  const speed = [0.0062, 0.0071]; // 1msあたりの マス
  const offset = useMemo(() => {
    const r = mulberry32(seed ^ 0x1f);
    return [r() * 8, r() * 8];
  }, [seed]);
  const cell = (p: Player, ms: number) => SLOTS[Math.floor(offset[p] + ms * speed[p]) % SLOTS.length];
  const end = () => {
    if (over.current) return;
    over.current = true;
    const v = (p: Player) => (stopAt.current[p] == null ? cell(p, SPIN_MAX) : cell(p, stopAt.current[p]!));
    onFinish([(v(0) / 8) * 100, (v(1) / 8) * 100]);
  };
  const stop = (p: Player) => {
    if (over.current || stopAt.current[p] != null) return;
    const ms = now() - start.current;
    stopAt.current = p === 0 ? [ms, stopAt.current[1]] : [stopAt.current[0], ms];
    setStops([...stopAt.current]);
    if (stopAt.current[0] != null && stopAt.current[1] != null) window.setTimeout(end, 700);
  };
  usePlayerKeys((p) => {
    if (p === 1 && cpu) return;
    stop(p);
  });
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = now() - start.current;
      setT(el);
      if (el >= SPIN_MAX) end();
      else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!cpu) return;
    const r = mulberry32(seed ^ 0x2f);
    const id = window.setTimeout(() => stop(1), 900 + r() * 2200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpu, seed]);

  const side = (p: Player) => {
    const v = stops[p] != null ? cell(p, stops[p]!) : cell(p, t);
    return (
      <Half key={p} player={p} name={names[p]} cpu={p === 1 && cpu}>
        <motion.div
          key={stops[p] != null ? 'stop' : 'spin'}
          animate={stops[p] != null ? { scale: [1, 1.25, 1] } : {}}
          style={{ width: '5.2rem', height: '5.2rem', borderRadius: 16, border: '4px solid var(--ink)', background: stops[p] != null ? '#fff4c9' : '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontSize: '2.6rem', color: P_COLOR[p] }}
        >
          {v}
        </motion.div>
        <BigButton player={p} label="ストップ！" onPress={() => stop(p)} disabled={stops[p] != null} cpu={p === 1 && cpu} />
      </Half>
    );
  };
  return (
    <Arena top={<div style={{ textAlign: 'center', fontWeight: 800 }}>大きい かずで とめたら かち！（1〜8）</div>}>
      {side(0)}
      {side(1)}
    </Arena>
  );
}

// ---------------------------------------------------------------- くじびき
export function Lottery({ seed, cpu, names, onFinish }: GameProps) {
  const prizes = useMemo(() => {
    const r = mulberry32(seed ^ 0x6d);
    const mk = () => [1, 2, 3, 4, 5].sort(() => r() - 0.5).slice(0, 3);
    return [mk(), mk()];
  }, [seed]);
  const picked = useRef<[number | null, number | null]>([null, null]);
  const [view, setView] = useState<[number | null, number | null]>([null, null]);
  const over = useRef(false);
  const end = () => {
    if (over.current) return;
    over.current = true;
    const v = (p: Player) => (picked.current[p] == null ? 0 : prizes[p][picked.current[p]!]);
    window.setTimeout(() => onFinish([v(0) * 20, v(1) * 20]), 900);
  };
  const pick = (p: Player, i: number) => {
    if (over.current || picked.current[p] != null) return;
    picked.current = p === 0 ? [i, picked.current[1]] : [picked.current[0], i];
    setView([...picked.current]);
    if (picked.current[0] != null && picked.current[1] != null) end();
  };
  usePlayerKeys((p, i) => {
    if (p === 1 && cpu) return;
    pick(p, i);
  });
  useEffect(() => {
    const id = window.setTimeout(end, 5000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!cpu) return;
    const r = mulberry32(seed ^ 0x7e);
    const id = window.setTimeout(() => pick(1, Math.floor(r() * 3)), 1000 + r() * 1500);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpu, seed]);
  const side = (p: Player) => (
    <Half key={p} player={p} name={names[p]} cpu={p === 1 && cpu}>
      <div style={{ fontWeight: 800, minHeight: '1.3em' }}>{view[p] == null ? 'はこを ひとつ えらぼう' : `${prizes[p][view[p]!]}こ あたり！`}</div>
      <ChoiceButtons
        player={p}
        options={[0, 1, 2].map((i) => (view[p] === i ? <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem' }}>{'★'.repeat(prizes[p][i])}</span> : <span style={{ fontFamily: 'var(--font-display)' }}>?</span>))}
        onPick={(i) => pick(p, i)}
        disabled={view[p] != null}
        picked={view[p]}
        correct={null}
        cpu={p === 1 && cpu}
      />
    </Half>
  );
  return (
    <Arena top={<div style={{ textAlign: 'center', fontWeight: 800 }}>ほしが おおい はこを ひいたら かち！</div>}>
      {side(0)}
      {side(1)}
    </Arena>
  );
}
