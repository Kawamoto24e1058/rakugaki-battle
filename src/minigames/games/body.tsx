import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { mulberry32 } from '../../engine/rng';
import { Arena, BigButton, Half, P_COLOR } from '../Arena';
import { usePlayerKeys } from '../input';
import type { GameProps, Player } from '../types';

const now = () => performance.now();

// ---------------------------------------------------------------- れんだ
const MASH_MS = 3000;
const MASH_GAP = 70; // これより はやい連打は 数えない（機器にやさしく・公平に）
const MASH_FULL = 28;

export function Mash({ seed, cpu, cpuSkill, names, onFinish }: GameProps) {
  const [taps, setTaps] = useState<[number, number]>([0, 0]);
  const last = useRef<[number, number]>([0, 0]);
  const start = useRef(now());
  const over = useRef(false);
  const tapsRef = useRef<[number, number]>([0, 0]);

  const tap = (p: Player) => {
    if (over.current) return;
    const t = now();
    if (t - last.current[p] < MASH_GAP) return;
    last.current[p] = t;
    tapsRef.current = p === 0 ? [tapsRef.current[0] + 1, tapsRef.current[1]] : [tapsRef.current[0], tapsRef.current[1] + 1];
    setTaps(tapsRef.current);
  };
  usePlayerKeys((p) => {
    if (p === 1 && cpu) return;
    tap(p);
  }, true, 'button');

  useEffect(() => {
    const id = window.setInterval(() => {
      const el = now() - start.current;
      if (el >= MASH_MS && !over.current) {
        over.current = true;
        window.clearInterval(id);
        const s = tapsRef.current.map((n) => Math.min(100, (n / MASH_FULL) * 100)) as [number, number];
        onFinish(s);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [onFinish]);

  // CPU
  useEffect(() => {
    if (!cpu) return;
    const rng = mulberry32(seed ^ 0x51);
    const rate = 3.8 + cpuSkill * 4; // 1びょうに 4.8〜6.2かい（子どもの れんだ くらい）
    let timer = 0;
    const loop = () => {
      tap(1);
      timer = window.setTimeout(loop, (1000 / rate) * (0.7 + rng() * 0.6));
    };
    timer = window.setTimeout(loop, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpu, cpuSkill, seed]);

  const side = (p: Player) => {
    const pct = Math.min(1, taps[p] / MASH_FULL);
    return (
      <Half key={p} player={p} name={names[p]} cpu={p === 1 && cpu}>
        <motion.div animate={{ scale: 0.6 + pct * 0.6 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }} style={{ width: '5.4rem', height: '5.4rem', borderRadius: '50% 50% 48% 52%', background: P_COLOR[p], border: '3px solid var(--ink)', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'var(--font-display)', fontSize: '1.8rem' }}>
          {taps[p]}
        </motion.div>
        <BigButton player={p} label="おす！" cpu={p === 1 && cpu} />
      </Half>
    );
  };
  return (
    <Arena top={<TimeBar startAt={start.current} total={MASH_MS} label="れんだ！ ふうせんを ふくらませよう" />}>
      {side(0)}
      {side(1)}
    </Arena>
  );
}

/**
 * のこり時間の バー。startAt（performance.now() の 時刻）を わたすと じぶんで へっていく
 * （ゲーム全体を 毎フレーム 描きなおさない＝操作が おもく ならない）。ms を わたすと その 長さで とまる。
 */
export function TimeBar({ ms, startAt, total, label }: { ms?: number; startAt?: number; total: number; label: string }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (startAt == null) return;
    let raf = 0;
    const loop = () => {
      const left = Math.max(0, Math.min(total, total - (now() - startAt)));
      if (bar.current) bar.current.style.width = `${(left / total) * 100}%`;
      if (left > 0) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [startAt, total]);
  return (
    <div style={{ display: 'grid', gap: 2, justifyItems: 'center' }}>
      <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{label}</div>
      <div style={{ width: '100%', height: 10, borderRadius: 6, border: '2px solid var(--ink)', background: '#0001', overflow: 'hidden' }}>
        <div ref={bar} style={{ width: `${((ms ?? total) / total) * 100}%`, height: '100%', background: 'var(--crayon-yellow)' }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- タイミング
const TIMING_MAX = 4200;
const TIMING_PERIOD = 1500;

export function Timing({ seed, cpu, cpuSkill, names, onFinish }: GameProps) {
  const start = useRef(now());
  const stopped = useRef<[number | null, number | null]>([null, null]);
  const [stops, setStops] = useState<[number | null, number | null]>([null, null]);
  const over = useRef(false);
  const pos = (ms: number) => {
    const ph = (ms % TIMING_PERIOD) / TIMING_PERIOD;
    return ph < 0.5 ? ph * 2 : 2 - ph * 2;
  };
  const score = (x: number | null) => (x == null ? 0 : Math.max(0, Math.min(100, 100 - Math.abs(x - 0.5) * 260)));
  const end = () => {
    if (over.current) return;
    over.current = true;
    onFinish([score(stopped.current[0]), score(stopped.current[1])]);
  };
  const stop = (p: Player) => {
    if (over.current || stopped.current[p] != null) return;
    stopped.current = p === 0 ? [pos(now() - start.current), stopped.current[1]] : [stopped.current[0], pos(now() - start.current)];
    setStops([...stopped.current]);
    if (stopped.current[0] != null && stopped.current[1] != null) window.setTimeout(end, 500);
  };
  usePlayerKeys((p) => {
    if (p === 1 && cpu) return;
    stop(p);
  }, true, 'button');
  useEffect(() => {
    const id = window.setTimeout(end, TIMING_MAX);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!cpu) return;
    const rng = mulberry32(seed ^ 0x77);
    // まんなかを ねらって、うまさに応じて ずれる
    const err = (rng() - 0.5) * (1 - cpuSkill) * 0.55;
    const targetPh = 0.25 + err / 2; // 0.25 = まんなか（いき）
    const cycles = 1 + Math.floor(rng() * 2);
    const ms = (cycles + targetPh) * TIMING_PERIOD;
    const id = window.setTimeout(() => stop(1), ms);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpu, cpuSkill, seed]);

  const side = (p: Player) => {
    return (
      <Half key={p} player={p} name={names[p]} cpu={p === 1 && cpu} mood={stops[p] == null ? null : score(stops[p]) >= 70 ? 'good' : score(stops[p]) < 35 ? 'bad' : null}>
        <div style={{ position: 'relative', width: '100%', height: '2.6rem', border: '3px solid var(--ink)', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: '42%', width: '16%', top: 0, bottom: 0, background: '#cdeedb' }} />
          <div style={{ position: 'absolute', left: '48%', width: '4%', top: 0, bottom: 0, background: '#2fa862' }} />
          <TimingMarker color={P_COLOR[p]} stopped={stops[p]} start={start.current} pos={pos} />
        </div>
        <div style={{ fontWeight: 800, minHeight: '1.3em' }}>{stops[p] != null ? `${Math.round(score(stops[p]))}てん` : 'みどりで とめる！'}</div>
        <BigButton player={p} label="ストップ！" disabled={stops[p] != null} cpu={p === 1 && cpu} />
      </Half>
    );
  };
  return (
    <Arena top={<div style={{ textAlign: 'center', fontWeight: 800 }}>まんなかの みどりで ぴたっと とめよう</div>}>
      {side(0)}
      {side(1)}
    </Arena>
  );
}

/** とめろの 目じるし（じぶんで うごく。ゲーム全体は 描きなおさない）。 */
function TimingMarker({ color, stopped, start, pos }: { color: string; stopped: number | null; start: number; pos: (ms: number) => number }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (stopped != null) return;
    let raf = 0;
    const loop = () => {
      if (el.current) el.current.style.left = `calc(${pos(now() - start) * 100}% - 4px)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [stopped, start, pos]);
  return <div ref={el} style={{ position: 'absolute', left: `calc(${(stopped ?? 0) * 100}% - 4px)`, width: 8, top: -2, bottom: -2, background: color, border: '2px solid var(--ink)', borderRadius: 4 }} />;
}

// ---------------------------------------------------------------- よーいドン
export function Reaction({ seed, cpu, cpuSkill, names, onFinish }: GameProps) {
  const rng = useRef(mulberry32(seed ^ 0x99));
  const delay = useRef(1400 + rng.current() * 1800);
  const start = useRef(now());
  const [go, setGo] = useState(false);
  const goAt = useRef<number | null>(null);
  const res = useRef<[number | null, number | null]>([null, null]); // ms（-1＝フライング）
  const [view, setView] = useState<[number | null, number | null]>([null, null]);
  const over = useRef(false);
  const score = (r: number | null) => (r == null || r < 0 ? 0 : Math.max(0, Math.min(100, 100 - (r - 180) / 5)));
  const end = () => {
    if (over.current) return;
    over.current = true;
    onFinish([score(res.current[0]), score(res.current[1])]);
  };
  const press = (p: Player) => {
    if (over.current || res.current[p] != null) return;
    const v = goAt.current == null ? -1 : now() - goAt.current;
    res.current = p === 0 ? [v, res.current[1]] : [res.current[0], v];
    setView([...res.current]);
    if (res.current[0] != null && res.current[1] != null) window.setTimeout(end, 600);
  };
  usePlayerKeys((p) => {
    if (p === 1 && cpu) return;
    press(p);
  }, true, 'button');
  useEffect(() => {
    const a = window.setTimeout(() => {
      goAt.current = now();
      setGo(true);
    }, delay.current);
    const b = window.setTimeout(end, delay.current + 2200);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!cpu) return;
    const rt = 230 + (1 - cpuSkill) * 330 + (rng.current() - 0.5) * 140;
    const id = window.setTimeout(() => press(1), delay.current + rt);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpu, cpuSkill]);
  void start;

  const side = (p: Player) => (
    <Half key={p} player={p} name={names[p]} cpu={p === 1 && cpu} mood={view[p] == null ? null : view[p]! < 0 ? 'bad' : view[p]! < 380 ? 'good' : null}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', minHeight: '2.2rem', color: view[p] === -1 ? 'var(--crayon-red)' : 'var(--ink)' }}>
        {view[p] == null ? '' : view[p]! < 0 ? 'フライング！' : `${Math.round(view[p]!)}ミリびょう`}
      </div>
      <BigButton player={p} label="おす！" disabled={view[p] != null} cpu={p === 1 && cpu} />
    </Half>
  );
  return (
    <Arena
      top={
        <motion.div
          key={go ? 'go' : 'ready'}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: go ? '2.6rem' : '1.6rem', color: go ? 'var(--crayon-red)' : 'var(--ink-soft)' }}
        >
          {go ? 'ドン！' : 'よーい…（まだ おさない！）'}
        </motion.div>
      }
    >
      {side(0)}
      {side(1)}
    </Arena>
  );
}

// ---------------------------------------------------------------- リズム
const BEAT = 650;
const NOTES = 4;
const LEAD = 1300;

export function Rhythm({ seed, cpu, cpuSkill, names, onFinish }: GameProps) {
  const start = useRef(now());
  const hits = useRef<[number[], number[]]>([[], []]); // それぞれの音符への ずれ(ms)
  const [marks, setMarks] = useState<[string[], string[]]>([[], []]);
  const over = useRef(false);
  const noteTimes = Array.from({ length: NOTES }, (_, i) => LEAD + i * BEAT);
  const endAt = LEAD + NOTES * BEAT + 300;
  const press = (p: Player) => {
    if (over.current) return;
    const el = now() - start.current;
    const idx = noteTimes.findIndex((nt, i) => Math.abs(el - nt) < BEAT / 2 && hits.current[p][i] == null);
    if (idx < 0) return;
    const dt = el - noteTimes[idx];
    const arr = [...hits.current[p]];
    arr[idx] = dt;
    hits.current[p] = arr;
    const word = Math.abs(dt) < 70 ? 'ぴったり' : Math.abs(dt) < 150 ? 'いいね' : 'おしい';
    setMarks((m) => {
      const n: [string[], string[]] = [[...m[0]], [...m[1]]];
      n[p][idx] = word;
      return n;
    });
  };
  usePlayerKeys((p) => {
    if (p === 1 && cpu) return;
    press(p);
  }, true, 'button');
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (over.current) return;
      over.current = true;
      const sc = (arr: number[]) => (noteTimes.reduce((s, _, i) => s + (arr[i] == null ? 0 : Math.max(0, 1 - Math.abs(arr[i]) / 260)), 0) / NOTES) * 100;
      onFinish([sc(hits.current[0]), sc(hits.current[1])]);
    }, endAt);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!cpu) return;
    const rng = mulberry32(seed ^ 0x3c);
    const ids = noteTimes.map((nt) => window.setTimeout(() => press(1), nt + (rng() - 0.5) * (1 - cpuSkill) * 360));
    return () => ids.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpu, cpuSkill, seed]);

  const side = (p: Player) => (
    <Half key={p} player={p} name={names[p]} cpu={p === 1 && cpu}>
      <div style={{ position: 'relative', width: '100%', height: '3rem', border: '3px solid var(--ink)', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: '12%', top: '50%', translate: '-50% -50%', width: '2.4rem', height: '2.4rem', borderRadius: '50%', border: `3px dashed ${P_COLOR[p]}` }} />
        <RhythmNotes color={P_COLOR[p]} noteTimes={noteTimes} start={start.current} hit={(i) => hits.current[p][i] != null} />
      </div>
      <div style={{ display: 'flex', gap: 4, minHeight: '1.3em', fontSize: '0.78rem', fontWeight: 800 }}>
        {marks[p].map((w, i) => (w ? <span key={i}>{w}</span> : null))}
      </div>
      <BigButton player={p} label="ポン！" cpu={p === 1 && cpu} />
    </Half>
  );
  return (
    <Arena top={<div style={{ textAlign: 'center', fontWeight: 800 }}>まるが わに かさなったら おそう（4かい）</div>}>
      {side(0)}
      {side(1)}
    </Arena>
  );
}

/** あわせろの 音符（じぶんで うごく。ゲーム全体は 描きなおさない）。 */
function RhythmNotes({ color, noteTimes, start, hit }: { color: string; noteTimes: number[]; start: number; hit: (i: number) => boolean }) {
  const els = useRef<(HTMLDivElement | null)[]>([]);
  const hitRef = useRef(hit);
  hitRef.current = hit;
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const t = now() - start;
      noteTimes.forEach((nt, i) => {
        const d = els.current[i];
        if (!d) return;
        const x = 12 + ((nt - t) / (BEAT * 3)) * 88;
        const show = x >= -10 && x <= 110 && !hitRef.current(i);
        d.style.display = show ? 'block' : 'none';
        if (show) d.style.left = `${x}%`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [noteTimes, start]);
  return (
    <>
      {noteTimes.map((_, i) => (
        <div key={i} ref={(d) => { els.current[i] = d; }} style={{ display: 'none', position: 'absolute', left: '110%', top: '50%', translate: '-50% -50%', width: '1.8rem', height: '1.8rem', borderRadius: '50%', background: color, border: '2.5px solid var(--ink)' }} />
      ))}
    </>
  );
}
