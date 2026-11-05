import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { mulberry32 } from '../../engine/rng';
import { Arena, ChoiceButtons, COLORS, Half, Shape, type ShapeKind } from '../Arena';
import { usePlayerKeys } from '../input';
import type { GameProps, Player } from '../types';
import type { MgFighter } from '../context';
import { TimeBar } from './body';

const now = () => performance.now();
const LIMIT = 6500;
export type Rng = () => number;

/** 3択の問題。prompt は 上に大きく、options は それぞれの ボタンに。 */
export interface Question {
  prompt: ReactNode;
  options: ReactNode[];
  answer: number;
  /** おぼえるゲーム：はじめに見せる時間(ms)。そのあいだは 答えられない。 */
  study?: { node: ReactNode; ms: number };
}

export const shuffle = <T,>(a: T[], rng: Rng): T[] => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
export const pickN = <T,>(a: T[], n: number, rng: Rng) => shuffle(a, rng).slice(0, n);

// ---------------------------------------------------------------- 問題づくり
const SHAPES: ShapeKind[] = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond'];

export function makeOdd(rng: Rng): Question {
  const k = SHAPES[Math.floor(rng() * SHAPES.length)];
  const c = COLORS[Math.floor(rng() * COLORS.length)];
  const ans = Math.floor(rng() * 3);
  const mode = rng();
  const other = mode < 0.5 ? { k: SHAPES.filter((x) => x !== k)[Math.floor(rng() * 5)], c } : { k, c: COLORS.filter((x) => x !== c)[Math.floor(rng() * 5)] };
  return {
    prompt: 'ひとつだけ ちがうのは どれ？',
    options: [0, 1, 2].map((i) => (i === ans ? <Shape kind={other.k} color={other.c.hex} size={38} /> : <Shape kind={k} color={c.hex} size={38} />)),
    answer: ans,
  };
}

// ---------------------------------------------------------------- 3択ゲーム本体
/**
 * はやおし3択：おなじ問題を ふたりが同時に とく。さきに 正解した方が 勝ち。
 * まちがえると その問題は もう答えられない。
 */
export function makeChoiceGame(make: (rng: Rng, fighters: [MgFighter, MgFighter]) => Question) {
  return function ChoiceGame({ seed, cpu, cpuSkill, names, fighters, onFinish }: GameProps) {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const q = useMemo(() => make(mulberry32(seed ^ 0x2a), fighters), [seed]);
    const studyMs = q.study?.ms ?? 0;
    const start = useRef(now());
    const [studying, setStudying] = useState(studyMs > 0);
    const [left, setLeft] = useState(LIMIT);
    const picks = useRef<[{ i: number; t: number } | null, { i: number; t: number } | null]>([null, null]);
    const [view, setView] = useState<[number | null, number | null]>([null, null]);
    const [reveal, setReveal] = useState(false);
    const over = useRef(false);

    const score = (p: { i: number; t: number } | null) => (p && p.i === q.answer ? 60 + 40 * Math.max(0, 1 - p.t / LIMIT) : 0);
    const end = () => {
      if (over.current) return;
      over.current = true;
      setReveal(true);
      // 先に正解した方を 確実に上に
      let s: [number, number] = [score(picks.current[0]), score(picks.current[1])];
      const c0 = picks.current[0]?.i === q.answer;
      const c1 = picks.current[1]?.i === q.answer;
      if (c0 && c1) s = picks.current[0]!.t <= picks.current[1]!.t ? [Math.max(s[0], s[1] + 5), s[1]] : [s[0], Math.max(s[1], s[0] + 5)];
      window.setTimeout(() => onFinish(s), 700);
    };
    const pick = (p: Player, i: number) => {
      if (over.current || studying || picks.current[p]) return;
      const t = now() - start.current - studyMs;
      picks.current = p === 0 ? [{ i, t }, picks.current[1]] : [picks.current[0], { i, t }];
      setView([picks.current[0]?.i ?? null, picks.current[1]?.i ?? null]);
      if (i === q.answer) window.setTimeout(end, 350); // さきに正解 → すぐ おわり（もう片方も ほぼ同時なら 時間で勝負）
      else if (picks.current[0] && picks.current[1]) end();
    };
    usePlayerKeys((p, i) => {
      if (p === 1 && cpu) return;
      pick(p, i);
    });
    useEffect(() => {
      const st = studyMs > 0 ? window.setTimeout(() => setStudying(false), studyMs) : 0;
      const id = window.setInterval(() => {
        const el = now() - start.current - studyMs;
        setLeft(Math.max(0, LIMIT - Math.max(0, el)));
        if (el >= LIMIT) {
          window.clearInterval(id);
          end();
        }
      }, 80);
      return () => {
        window.clearInterval(id);
        window.clearTimeout(st);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
      if (!cpu) return;
      const rng = mulberry32(seed ^ 0x5e);
      const right = rng() < 0.55 + cpuSkill * 0.35;
      const t = studyMs + 1100 + (1 - cpuSkill) * 2200 + rng() * 900;
      const ans = right ? q.answer : (q.answer + 1 + Math.floor(rng() * 2)) % 3;
      const id = window.setTimeout(() => pick(1, ans), t);
      return () => window.clearTimeout(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cpu, cpuSkill, seed]);

    const side = (p: Player) => (
      <Half
        key={p}
        player={p}
        name={names[p]}
        cpu={p === 1 && cpu}
        style={{ minHeight: '8rem' }}
        mood={view[p] == null ? null : view[p] === q.answer ? 'good' : reveal ? 'bad' : null}
      >
        <div style={{ fontWeight: 800, minHeight: '1.3em' }}>
          {view[p] == null ? (studying ? 'よく みて！' : 'えらんでね') : reveal || view[p] === q.answer ? (view[p] === q.answer ? 'せいかい！' : 'ざんねん') : 'こたえた'}
        </div>
        <ChoiceButtons player={p} options={q.options} onPick={(i) => pick(p, i)} disabled={studying || view[p] != null} picked={view[p]} correct={reveal ? q.answer : null} cpu={p === 1 && cpu} />
      </Half>
    );
    return (
      <Arena
        top={
          <div style={{ display: 'grid', gap: 4 }}>
            <TimeBar ms={left} total={LIMIT} label="" />
            <motion.div key={studying ? 's' : 'q'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '1.35rem', minHeight: '3rem', display: 'grid', placeItems: 'center' }}>
              {studying ? q.study!.node : q.prompt}
            </motion.div>
          </div>
        }
      >
        {side(0)}
        {side(1)}
      </Arena>
    );
  };
}
