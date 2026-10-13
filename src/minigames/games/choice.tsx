import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { mulberry32 } from '../../engine/rng';
import { Arena, ChoiceButtons, COLORS, Half, Shape, SHAPE_JP, type ShapeKind } from '../Arena';
import { usePlayerKeys } from '../input';
import type { GameProps, Player } from '../types';
import { TimeBar } from './body';

const now = () => performance.now();
const LIMIT = 6500;
type Rng = () => number;

/** 3択の問題。prompt は 上に大きく、options は それぞれの ボタンに。 */
export interface Question {
  prompt: ReactNode;
  options: ReactNode[];
  answer: number;
  /** おぼえるゲーム：はじめに見せる時間(ms)。そのあいだは 答えられない。 */
  study?: { node: ReactNode; ms: number };
}

const shuffle = <T,>(a: T[], rng: Rng): T[] => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
const pickN = <T,>(a: T[], n: number, rng: Rng) => shuffle(a, rng).slice(0, n);

// ---------------------------------------------------------------- 問題づくり
const QUIZ: [string, string, string, string][] = [
  ['りんごの いろは？', 'あか', 'あお', 'くろ'],
  ['そらを とぶのは？', 'とり', 'さかな', 'かめ'],
  ['うみに すむのは？', 'くじら', 'らいおん', 'うさぎ'],
  ['つめたいのは？', 'こおり', 'ひ', 'たいよう'],
  ['よるに ひかるのは？', 'つき', 'にんじん', 'くつ'],
  ['あしが 8ぽん あるのは？', 'たこ', 'いぬ', 'にわとり'],
  ['ながい はなの どうぶつは？', 'ぞう', 'ねこ', 'ぶた'],
  ['あめのひに さすのは？', 'かさ', 'ぼうし', 'てぶくろ'],
  ['バナナの いろは？', 'きいろ', 'みどり', 'むらさき'],
  ['ゆきだるまが とけるのは？', 'あつい とき', 'さむい とき', 'よる'],
  ['いちばん おおきいのは？', 'くじら', 'ねずみ', 'あり'],
  ['はねが あるのは？', 'ちょうちょ', 'へび', 'かえる'],
  ['ぴょんぴょん はねるのは？', 'うさぎ', 'かたつむり', 'さかな'],
  ['にじの いろの かずは？', '7', '3', '10'],
  ['1しゅうかんは なんにち？', '7にち', '5にち', '10にち'],
  ['かえるの こどもは？', 'おたまじゃくし', 'ひよこ', 'こいぬ'],
  ['あさ さいしょに いうのは？', 'おはよう', 'おやすみ', 'いただきます'],
  ['はっぱの いろは？', 'みどり', 'あか', 'しろ'],
  ['はなで においを かぐのは？', 'はな', 'みみ', 'て'],
  ['なつに なくむしは？', 'せみ', 'ペンギン', 'くま'],
];

export function makeQuiz(rng: Rng): Question {
  const q = QUIZ[Math.floor(rng() * QUIZ.length)];
  const opts = shuffle([q[1], q[2], q[3]], rng);
  return { prompt: q[0], options: opts, answer: opts.indexOf(q[1]) };
}

export function makeMath(rng: Rng): Question {
  const plus = rng() < 0.7;
  const a = 1 + Math.floor(rng() * (plus ? 6 : 9));
  const b = 1 + Math.floor(rng() * (plus ? 5 : a));
  const ans = plus ? a + b : a - Math.min(a, b);
  const bb = plus ? b : Math.min(a, b);
  const set = new Set<number>([ans]);
  while (set.size < 3) set.add(Math.max(0, ans + Math.floor(rng() * 5) - 2));
  const opts = shuffle([...set], rng);
  return { prompt: `${a} ${plus ? '＋' : 'ー'} ${bb} ＝ ？`, options: opts.map(String), answer: opts.indexOf(ans) };
}

export function makeColor(rng: Rng): Question {
  const cs = pickN(COLORS, 3, rng);
  const ans = Math.floor(rng() * 3);
  return {
    prompt: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        この いろは？ <span style={{ display: 'inline-block', width: '2.6rem', height: '2.6rem', borderRadius: 10, background: cs[ans].hex, border: '3px solid var(--ink)' }} />
      </span>
    ),
    options: cs.map((c) => c.jp),
    answer: ans,
  };
}

const SHAPES: ShapeKind[] = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond'];

export function makeMemory(rng: Rng): Question {
  const ks = pickN(SHAPES, 3, rng);
  const cs = pickN(COLORS, 3, rng);
  const ans = Math.floor(rng() * 3);
  return {
    study: {
      ms: 1800,
      node: (
        <span style={{ display: 'inline-flex', gap: 14 }}>
          {ks.map((k, i) => (
            <Shape key={i} kind={k} color={cs[i].hex} size={46} />
          ))}
        </span>
      ),
    },
    prompt: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Shape kind={ks[ans]} color={cs[ans].hex} size={40} /> は どこに あった？
      </span>
    ),
    options: ['ひだり', 'まんなか', 'みぎ'],
    answer: ans,
  };
}

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

export function makeCount(rng: Rng): Question {
  const n = 3 + Math.floor(rng() * 6);
  const k = SHAPES[Math.floor(rng() * SHAPES.length)];
  const c = COLORS[Math.floor(rng() * COLORS.length)];
  // 6×3 のマスから かさならないように えらぶ
  const cells = shuffle(Array.from({ length: 18 }, (_, i) => i), rng).slice(0, n);
  const pts = cells.map((c) => ({ x: 9 + (c % 6) * 16 + (rng() - 0.5) * 6, y: 6 + Math.floor(c / 6) * 30 + (rng() - 0.5) * 8, r: Math.floor(rng() * 40) - 20 }));
  const set = new Set<number>([n]);
  while (set.size < 3) set.add(Math.max(1, n + (rng() < 0.5 ? -1 : 1) * (1 + Math.floor(rng() * 2))));
  const opts = shuffle([...set], rng);
  return {
    prompt: (
      <div style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
        <span>{SHAPE_JP[k]}は いくつ？</span>
        <div style={{ position: 'relative', width: 'min(86vw, 22rem)', height: '6.2rem', border: '3px solid var(--ink)', borderRadius: 12, background: '#fff' }}>
          {pts.map((p, i) => (
            <div key={i} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, translate: '-50% -10%' }}>
              <Shape kind={k} color={c.hex} size={26} rotate={p.r} />
            </div>
          ))}
        </div>
      </div>
    ),
    options: opts.map(String),
    answer: opts.indexOf(n),
  };
}

export function makeSilhouette(rng: Rng): Question {
  const ks = pickN(SHAPES, 3, rng);
  const ans = Math.floor(rng() * 3);
  const cs = pickN(COLORS, 3, rng);
  return {
    prompt: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        この かげは どれ？ <Shape kind={ks[ans]} color="#33302b" size={46} />
      </span>
    ),
    options: ks.map((k, i) => <Shape key={i} kind={k} color={cs[i].hex} size={38} />),
    answer: ans,
  };
}

// ---------------------------------------------------------------- 3択ゲーム本体
/**
 * はやおし3択：おなじ問題を ふたりが同時に とく。さきに 正解した方が 勝ち。
 * まちがえると その問題は もう答えられない。
 */
export function makeChoiceGame(make: (rng: Rng) => Question) {
  return function ChoiceGame({ seed, cpu, cpuSkill, names, onFinish }: GameProps) {
    const q = useMemo(() => make(mulberry32(seed ^ 0x2a)), [seed]);
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
      <Half key={p} player={p} name={names[p]} cpu={p === 1 && cpu} style={{ minHeight: '8rem' }}>
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
