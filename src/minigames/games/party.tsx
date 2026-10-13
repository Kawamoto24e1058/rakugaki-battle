import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { mulberry32 } from '../../engine/rng';
import { CharacterSprite } from '../../components/bits';
import { Arena, BigButton, ChoiceButtons, Half, P_COLOR } from '../Arena';
import { usePlayerKeys } from '../input';
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

// ================================================================ じゃんけん
type Hand = 0 | 1 | 2; // グー チョキ パー
const HAND_JP = ['グー', 'チョキ', 'パー'];
const beats = (a: Hand, b: Hand) => (a === 0 && b === 1) || (a === 1 && b === 2) || (a === 2 && b === 0);

/** グー・チョキ・パーの 手の絵。 */
export function HandIcon({ hand, size = 40, color = '#ffd9b8' }: { hand: Hand; size?: number; color?: string }) {
  const s = { fill: color, stroke: '#33302b', strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  return (
    <svg viewBox="-25 -25 50 50" width={size} height={size} style={{ display: 'block' }}>
      {hand === 0 && (
        <g>
          <rect x={-15} y={-12} width={30} height={26} rx={10} {...s} />
          <path d="M-7,-12 L-7,-4 M1,-12 L1,-4 M9,-12 L9,-4" {...s} fill="none" />
        </g>
      )}
      {hand === 1 && (
        <g>
          <rect x={-6} y={-22} width={8} height={24} rx={4} transform="rotate(-14)" {...s} />
          <rect x={4} y={-22} width={8} height={24} rx={4} transform="rotate(14)" {...s} />
          <rect x={-13} y={-2} width={26} height={18} rx={8} {...s} />
        </g>
      )}
      {hand === 2 && (
        <g>
          {[-14, -6, 2, 10].map((x, i) => (
            <rect key={i} x={x - 1} y={-22 + Math.abs(i - 1.5) * 2} width={7} height={22} rx={3.5} {...s} />
          ))}
          <rect x={-16} y={-4} width={28} height={20} rx={9} {...s} />
          <rect x={10} y={-2} width={14} height={7} rx={3.5} transform="rotate(-30 10 0)" {...s} />
        </g>
      )}
    </svg>
  );
}

const JANKEN_PICK_MS = 2600;

export function Janken({ seed, cpu, cpuSkill, names, onFinish }: GameProps) {
  const rng = useMemo(() => mulberry32(seed ^ 0x6a6b), [seed]);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<'pick' | 'show'>('pick');
  const picks = useRef<[Hand | null, Hand | null]>([null, null]);
  const [view, setView] = useState<[Hand | null, Hand | null]>([null, null]);
  const [left, setLeft] = useState(JANKEN_PICK_MS);
  const over = useRef(false);
  void cpuSkill;

  const pick = (p: Player, h: number) => {
    if (over.current || phase !== 'pick' || picks.current[p] != null) return;
    picks.current = p === 0 ? [h as Hand, picks.current[1]] : [picks.current[0], h as Hand];
    setView([...picks.current]);
  };
  usePlayerKeys((p, i) => {
    if (p === 1 && cpu) return;
    pick(p, i);
  });

  // ラウンドの ながれ：えらぶ（2.6びょう）→ ポン！（みせる）→ あいこなら もういちど（3かいまで）
  useEffect(() => {
    if (phase !== 'pick') return;
    const start = now();
    const id = window.setInterval(() => {
      const el = now() - start;
      setLeft(Math.max(0, JANKEN_PICK_MS - el));
      if (el >= JANKEN_PICK_MS) {
        window.clearInterval(id);
        sfx.go();
        setPhase('show');
      }
    }, 60);
    // CPU
    let cpuT = 0;
    if (cpu) cpuT = window.setTimeout(() => pick(1, Math.floor(rng() * 3)), 600 + rng() * 1500);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(cpuT);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round]);

  useEffect(() => {
    if (phase !== 'show') return;
    const [a, b] = picks.current;
    let result: [number, number] | null = null;
    if (a == null && b == null) result = round >= 2 ? [50, 50] : null;
    // うんの ゲームなので パーフェクト（クリティカル）には しない
    else if (a == null) result = [25, 75];
    else if (b == null) result = [75, 25];
    else if (beats(a, b)) result = [75, 25];
    else if (beats(b, a)) result = [25, 75];
    else if (round >= 2) result = [50, 50];
    const t = window.setTimeout(() => {
      if (result) {
        if (!over.current) {
          over.current = true;
          onFinish(result);
        }
      } else {
        picks.current = [null, null];
        setView([null, null]);
        setRound((r) => r + 1);
        setPhase('pick');
      }
    }, 1400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const showRes = (p: Player): 'good' | 'bad' | null => {
    if (phase !== 'show') return null;
    const me = view[p];
    const op = view[p === 0 ? 1 : 0];
    if (me == null) return op == null ? null : 'bad';
    if (op == null) return 'good';
    return beats(me, op) ? 'good' : beats(op, me) ? 'bad' : null;
  };

  const side = (p: Player) => (
    <Half key={p} player={p} name={names[p]} cpu={p === 1 && cpu} mood={showRes(p)}>
      <div style={{ height: '4.4rem', display: 'grid', placeItems: 'center' }}>
        {phase === 'show' ? (
          <motion.div initial={{ scale: 0.3, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }}>
            {view[p] == null ? <div style={{ fontWeight: 900 }}>だしてない！</div> : <HandIcon hand={view[p]!} size={70} />}
          </motion.div>
        ) : (
          <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{view[p] == null ? 'えらんでね' : 'きめた！（ないしょ）'}</div>
        )}
      </div>
      <ChoiceButtons
        player={p}
        options={([0, 1, 2] as Hand[]).map((h) => (
          <div key={h} style={{ display: 'grid', justifyItems: 'center' }}>
            <HandIcon hand={h} size={34} />
            <span style={{ fontSize: '0.75rem' }}>{HAND_JP[h]}</span>
          </div>
        ))}
        onPick={(i) => pick(p, i)}
        disabled={phase !== 'pick' || view[p] != null}
        picked={phase === 'pick' ? null : view[p]}
        correct={null}
        cpu={p === 1 && cpu}
      />
    </Half>
  );
  return (
    <Arena
      top={
        <div style={{ display: 'grid', gap: 4 }}>
          <TimeBar ms={phase === 'pick' ? left : 0} total={JANKEN_PICK_MS} label="" />
          <motion.div key={`${phase}-${round}`} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: phase === 'show' ? '2.4rem' : '1.6rem' }}>
            {phase === 'show' ? 'ポン！' : round === 0 ? 'じゃん けん…' : `あいこで…（${round + 1}かいめ）`}
          </motion.div>
        </div>
      }
    >
      {side(0)}
      {side(1)}
    </Arena>
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
                  if (!(p === 1 && cpu)) whack(p, h);
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
                <div style={{ position: 'absolute', bottom: 2, left: 0, right: 0, fontSize: '0.6rem', opacity: 0.6 }}>{p === 1 && cpu ? '' : ['A', 'S', 'D'].map((k, i) => (p === 0 ? k : ['J', 'K', 'L'][i]))[h]}</div>
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

// ================================================================ ハイ＆ロー
const HL_ROUNDS = 3;
const HL_PICK_MS = 2800;

export function HighLow({ seed, cpu, cpuSkill, names, onFinish }: GameProps) {
  const nums = useMemo(() => {
    const r = mulberry32(seed ^ 0x4849);
    const a = [1 + Math.floor(r() * 9)];
    for (let i = 0; i < HL_ROUNDS; i++) {
      let n = 1 + Math.floor(r() * 9);
      if (n === a[i] && r() < 0.75) n = n >= 5 ? n - 1 - Math.floor(r() * 3) : n + 1 + Math.floor(r() * 3);
      a.push(Math.max(1, Math.min(9, n)));
    }
    return a;
  }, [seed]);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<'pick' | 'show'>('pick');
  const picks = useRef<[number | null, number | null]>([null, null]);
  const [view, setView] = useState<[number | null, number | null]>([null, null]);
  const points = useRef<[number, number]>([0, 0]);
  const [left, setLeft] = useState(HL_PICK_MS);
  const over = useRef(false);

  const answerOf = (r: number) => (nums[r + 1] > nums[r] ? 0 : nums[r + 1] === nums[r] ? 1 : 2);
  const pick = (p: Player, i: number) => {
    if (over.current || phase !== 'pick' || picks.current[p] != null) return;
    picks.current = p === 0 ? [i, picks.current[1]] : [picks.current[0], i];
    setView([...picks.current]);
    if (picks.current[0] != null && picks.current[1] != null) setPhase('show');
  };
  usePlayerKeys((p, i) => {
    if (p === 1 && cpu) return;
    pick(p, i);
  });
  useEffect(() => {
    if (phase !== 'pick') return;
    const start = now();
    const id = window.setInterval(() => {
      const el = now() - start;
      setLeft(Math.max(0, HL_PICK_MS - el));
      if (el >= HL_PICK_MS) {
        window.clearInterval(id);
        setPhase('show');
      }
    }, 60);
    let cpuT = 0;
    if (cpu) {
      const r = mulberry32(seed ^ (round * 977));
      const n = nums[round];
      const smart = n <= 4 ? 0 : n >= 6 ? 2 : r() < 0.5 ? 0 : 2;
      const choice = r() < 0.55 + cpuSkill * 0.4 ? smart : Math.floor(r() * 3);
      cpuT = window.setTimeout(() => pick(1, choice), 700 + r() * 1300);
    }
    return () => {
      window.clearInterval(id);
      window.clearTimeout(cpuT);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round]);
  useEffect(() => {
    if (phase !== 'show') return;
    sfx.flip();
    const ans = answerOf(round);
    for (const p of [0, 1] as Player[]) if (picks.current[p] === ans) points.current[p] += ans === 1 ? 2 : 1;
    const t = window.setTimeout(() => {
      if (round + 1 >= HL_ROUNDS) {
        if (!over.current) {
          over.current = true;
          onFinish([clamp((points.current[0] / HL_ROUNDS) * 100), clamp((points.current[1] / HL_ROUNDS) * 100)]);
        }
      } else {
        picks.current = [null, null];
        setView([null, null]);
        setRound((r) => r + 1);
        setPhase('pick');
      }
    }, 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const ans = answerOf(round);
  const card = (n: number | null, hidden = false) => (
    <motion.div
      key={`${n}-${hidden}`}
      initial={{ rotateY: 90 }}
      animate={{ rotateY: 0 }}
      style={{ width: '3.6rem', height: '5rem', borderRadius: 10, border: '4px solid var(--ink)', background: hidden ? 'repeating-linear-gradient(45deg,#f6d36a 0 8px,#f2b705 8px 16px)' : '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontSize: '2.4rem' }}
    >
      {hidden ? '?' : n}
    </motion.div>
  );
  const side = (p: Player) => (
    <Half key={p} player={p} name={names[p]} cpu={p === 1 && cpu} mood={phase === 'show' && view[p] != null ? (view[p] === ans ? 'good' : 'bad') : null}>
      <div style={{ fontWeight: 900 }}>{points.current[p]} てん</div>
      <ChoiceButtons
        player={p}
        options={['たかい', 'おなじ', 'ひくい']}
        onPick={(i) => pick(p, i)}
        disabled={phase !== 'pick' || view[p] != null}
        picked={view[p]}
        correct={phase === 'show' ? ans : null}
        cpu={p === 1 && cpu}
      />
    </Half>
  );
  return (
    <Arena
      top={
        <div style={{ display: 'grid', gap: 6, justifyItems: 'stretch' }}>
          <TimeBar ms={phase === 'pick' ? left : 0} total={HL_PICK_MS} label={`${round + 1} / ${HL_ROUNDS}かいめ：つぎの かずは？`} />
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center', perspective: 600 }}>
            {card(nums[round])}
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem' }}>→</span>
            {card(phase === 'show' ? nums[round + 1] : null, phase !== 'show')}
          </div>
        </div>
      }
    >
      {side(0)}
      {side(1)}
    </Arena>
  );
}

// ================================================================ ぴったり 5びょう
const SW_TARGET = 5000;
const SW_HIDE = 2000;
const SW_MAX = 8500;

export function Stopwatch({ seed, cpu, cpuSkill, names, onFinish }: GameProps) {
  const start = useRef(now());
  const [t, setT] = useState(0);
  const res = useRef<[number | null, number | null]>([null, null]);
  const [view, setView] = useState<[number | null, number | null]>([null, null]);
  const over = useRef(false);
  const score = (v: number | null) => (v == null ? 0 : clamp(100 - Math.abs(v - SW_TARGET) / 12));
  const end = () => {
    if (over.current) return;
    over.current = true;
    onFinish([score(res.current[0]), score(res.current[1])]);
  };
  const press = (p: Player) => {
    if (over.current || res.current[p] != null) return;
    res.current = p === 0 ? [now() - start.current, res.current[1]] : [res.current[0], now() - start.current];
    setView([...res.current]);
    if (res.current[0] != null && res.current[1] != null) window.setTimeout(end, 1200);
  };
  usePlayerKeys((p) => {
    if (p === 1 && cpu) return;
    press(p);
  });
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = now() - start.current;
      setT(el);
      if (el >= SW_MAX) end();
      else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!cpu) return;
    const r = mulberry32(seed ^ 0x5357);
    const err = (r() + r() + r() - 1.5) * (1 - cpuSkill) * 1100;
    const id = window.setTimeout(() => press(1), SW_TARGET + err);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpu, cpuSkill, seed]);

  const fmt = (ms: number) => (ms / 1000).toFixed(2);
  const both = view[0] != null && view[1] != null;
  const side = (p: Player) => {
    const v = view[p];
    const diff = v == null ? null : v - SW_TARGET;
    return (
      <Half key={p} player={p} name={names[p]} cpu={p === 1 && cpu} mood={v == null || !both ? null : Math.abs(diff!) < 300 ? 'good' : Math.abs(diff!) > 900 ? 'bad' : null}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', minHeight: '2.4rem' }}>{v == null ? '' : both ? `${fmt(v)}びょう` : 'おした！'}</div>
        <div style={{ fontWeight: 800, minHeight: '1.3em' }}>{diff == null || !both ? '' : Math.abs(diff) < 100 ? 'ぴったり！' : diff > 0 ? `${fmt(diff)}びょう おそい` : `${fmt(-diff)}びょう はやい`}</div>
        <BigButton player={p} label="いま！" onPress={() => press(p)} disabled={v != null} cpu={p === 1 && cpu} />
      </Half>
    );
  };
  const hidden = t > SW_HIDE && !both;
  return (
    <Arena
      top={
        <div style={{ display: 'grid', justifyItems: 'center', gap: 2 }}>
          <div style={{ fontWeight: 900 }}>5びょう ぴったりで おそう（とちゅうから みえなくなるよ）</div>
          <motion.div
            animate={{ opacity: hidden ? 0.15 : 1, filter: hidden ? 'blur(6px)' : 'blur(0px)' }}
            style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontVariantNumeric: 'tabular-nums', minWidth: '6ch', textAlign: 'center', border: '4px solid var(--ink)', borderRadius: 14, background: '#fff', padding: '0 0.5em' }}
          >
            {hidden ? '?.??' : fmt(Math.min(t, SW_MAX))}
          </motion.div>
        </div>
      }
    >
      {side(0)}
      {side(1)}
    </Arena>
  );
}

// ================================================================ つなひき
const TUG_MS = 4500;
const TUG_WIN = 12; // この差で ひっぱりきり
const TUG_GAP = 70;

export function Tug({ seed, cpu, cpuSkill, names, fighters, onFinish }: GameProps) {
  const taps = useRef<[number, number]>([0, 0]);
  const last = useRef<[number, number]>([0, 0]);
  const [, setTick] = useState(0);
  const start = useRef(now());
  const [left, setLeft] = useState(TUG_MS);
  const over = useRef(false);
  const diff = () => taps.current[0] - taps.current[1];
  const end = () => {
    if (over.current) return;
    over.current = true;
    const d = Math.max(-TUG_WIN, Math.min(TUG_WIN, diff()));
    onFinish([clamp(50 + (d / TUG_WIN) * 50), clamp(50 - (d / TUG_WIN) * 50)]);
  };
  const pull = (p: Player) => {
    if (over.current) return;
    const t = now();
    if (t - last.current[p] < TUG_GAP) return;
    last.current[p] = t;
    taps.current[p] += 1;
    setTick((x) => x + 1);
    if (Math.abs(diff()) >= TUG_WIN) window.setTimeout(end, 300);
  };
  usePlayerKeys((p) => {
    if (p === 1 && cpu) return;
    pull(p);
  });
  useEffect(() => {
    const id = window.setInterval(() => {
      const el = now() - start.current;
      setLeft(Math.max(0, TUG_MS - el));
      if (el >= TUG_MS) {
        window.clearInterval(id);
        end();
      }
    }, 50);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!cpu) return;
    const r = mulberry32(seed ^ 0x7467);
    const rate = 5 + cpuSkill * 4.2;
    let timer = 0;
    const loop = () => {
      pull(1);
      timer = window.setTimeout(loop, (1000 / rate) * (0.7 + r() * 0.6));
    };
    timer = window.setTimeout(loop, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpu, cpuSkill, seed]);

  const d = Math.max(-TUG_WIN, Math.min(TUG_WIN, diff()));
  const shift = (-d / TUG_WIN) * 30; // ％：P1が かつと 左へ
  return (
    <Arena
      top={
        <div style={{ display: 'grid', gap: 4 }}>
          <TimeBar ms={left} total={TUG_MS} label="れんだで つなを ひっぱれ！" />
          <div style={{ position: 'relative', height: '6rem', border: '4px solid var(--ink)', borderRadius: 14, background: '#fff8e6', overflow: 'hidden' }}>
            {/* まんなかの線 */}
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 4, background: 'var(--ink)', opacity: 0.25 }} />
            <div style={{ position: 'absolute', left: '20%', top: 0, bottom: 0, width: 3, background: P_COLOR[0], opacity: 0.5 }} />
            <div style={{ position: 'absolute', left: '80%', top: 0, bottom: 0, width: 3, background: P_COLOR[1], opacity: 0.5 }} />
            <div style={{ position: 'absolute', inset: 0, transform: `translateX(${shift}%)`, transition: 'transform .18s cubic-bezier(.3,1.6,.5,1)' }}>
              <div style={{ position: 'absolute', left: '18%', right: '18%', top: '52%', height: 8, background: '#b07a3c', border: '2px solid var(--ink)', borderRadius: 4 }} />
              <div style={{ position: 'absolute', left: 'calc(50% - 8px)', top: '40%', width: 16, height: 26, background: 'var(--crayon-yellow)', border: '2px solid var(--ink)', borderRadius: 4 }} />
              {([0, 1] as Player[]).map((p) => (
                <motion.div
                  key={p}
                  animate={{ rotate: p === 0 ? -10 : 10, y: [0, -3, 0] }}
                  transition={{ y: { repeat: Infinity, duration: 0.3 } }}
                  style={{ position: 'absolute', [p === 0 ? 'left' : 'right']: '6%', top: '8%', width: '5rem', height: '5rem' }}
                >
                  <Avatar f={fighters[p]} size="100%" flip={p === 1} />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      }
    >
      {([0, 1] as Player[]).map((p) => (
        <Half key={p} player={p} name={names[p]} cpu={p === 1 && cpu}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem' }}>{taps.current[p]}</div>
          <BigButton player={p} label="ひけ！" onPress={() => pull(p)} cpu={p === 1 && cpu} />
        </Half>
      )) as [ReactNode, ReactNode]}
    </Arena>
  );
}
