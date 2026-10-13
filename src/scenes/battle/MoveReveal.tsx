import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CardBack, GameCard } from '../../components/GameCard';
import { koseiCard, moveCard, type CardData } from '../../components/moveText';
import { getKosei, type ClashChoice, type Side } from '../../engine';
import { getMove } from '../../engine/moves';
import type { Character } from '../../engine/types';
import { sfx } from '../../audio/sfx';

const SIDE_COLOR: [string, string] = ['#e8503a', '#2f7dd1'];

/** 場面：ターン帯 → シャッフル → P1 の技 → P2 の技 → ふたり ならべて おわり。 */
type Step = 'turn' | 'shuffle' | 'p0' | 'p1' | 'both';
const STEPS: Step[] = ['turn', 'shuffle', 'p0', 'p1', 'both'];
const STEP_MS: Record<Step, number> = { turn: 1000, shuffle: 1200, p0: 2300, p1: 2300, both: 1300 };

function cardFor(choice: ClashChoice, c: Character, charging: string | null): CardData | null {
  try {
    if (choice === 'kosei') return koseiCard(getKosei(c.koseiId));
    if (choice === 'release') return charging ? moveCard(getMove(charging)) : null;
    return moveCard(getMove(choice));
  } catch {
    return null;
  }
}

function headline(name: string, choice: ClashChoice): string {
  if (choice === 'kosei') return `${name} の こせい はつどう！`;
  if (choice === 'release') return `${name} が ためた ちからを はなつ！`;
  return `${name} の わざは…`;
}

/**
 * ターンのはじめ：それぞれのキャラの技カードが シャッフルされ、
 * 1まいずつ 画面のまんなかで 大きく めくれて「このターンの技」が きまる。
 * 全部 自動で すすむ（画面タップで はやおくり）。
 */
export function MoveReveal({
  turn,
  chars,
  picks,
  charging,
  onDone,
}: {
  turn: number;
  chars: [Character, Character];
  picks: [ClashChoice, ClashChoice];
  charging: [string | null, string | null];
  onDone: () => void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [shuffleTick, setShuffleTick] = useState(0);
  const step = STEPS[stepIdx];
  const cards: [CardData | null, CardData | null] = [cardFor(picks[0], chars[0], charging[0]), cardFor(picks[1], chars[1], charging[1])];

  // 場面を じゅんばんに すすめる
  useEffect(() => {
    if (step === 'turn') sfx.whoosh();
    let ding = 0;
    if (step === 'p0' || step === 'p1') {
      sfx.flip();
      ding = window.setTimeout(() => sfx.reveal(), 380);
    }
    const t = window.setTimeout(() => {
      if (stepIdx >= STEPS.length - 1) onDone();
      else setStepIdx((i) => i + 1);
    }, STEP_MS[step]);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(ding);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  // シャッフル中は カードが いれかわる
  useEffect(() => {
    if (step !== 'shuffle') return;
    const id = window.setInterval(() => {
      setShuffleTick((n) => n + 1);
      sfx.tick(0.8 + Math.random() * 0.4);
    }, 150);
    return () => window.clearInterval(id);
  }, [step]);

  const shown = (s: Side) => stepIdx >= STEPS.indexOf(s === 0 ? 'p0' : 'p1');
  const center: Side | null = step === 'p0' ? 0 : step === 'p1' ? 1 : null;

  const skip = () => {
    if (stepIdx >= STEPS.length - 1) onDone();
    else setStepIdx((i) => i + 1);
  };

  const column = (s: Side) => {
    const c = chars[s];
    const n = picks[s] === 'release' ? 1 : c.moveIds.length;
    // シャッフル：カードの ならびを ずらす
    const order = Array.from({ length: n }, (_, i) => (i + shuffleTick * (s === 0 ? 1 : 3)) % n);
    return (
      <div style={{ display: 'grid', justifyItems: 'center', gap: '0.5rem', minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem, 3.4vw, 1.35rem)', color: SIDE_COLOR[s] }}>{c.name}</div>
        <div style={{ minHeight: 'calc(min(24vw, 8.4rem) * 1.4)', display: 'grid', placeItems: 'center' }}>
          {shown(s) && center !== s && cards[s] ? (
            <motion.div
              initial={{ scale: 1.5, y: -30, opacity: 0.4 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 20 }}
            >
              <GameCard card={cards[s]!} size="min(24vw, 8.4rem)" />
            </motion.div>
          ) : !shown(s) ? (
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {order.map((k, i) => (
                <motion.div
                  key={k}
                  layout="position"
                  initial={{ y: 30, opacity: 0 }}
                  animate={{
                    y: step === 'shuffle' ? [0, -10, 0] : 0,
                    opacity: 1,
                    rotate: step === 'shuffle' ? (i % 2 ? 6 : -6) : (i - (n - 1) / 2) * 4,
                  }}
                  transition={{ delay: step === 'turn' ? i * 0.1 : 0, duration: 0.25 }}
                >
                  <CardBack size="min(10vw, 4.6rem)" style={{ borderColor: SIDE_COLOR[s] }} />
                </motion.div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const cc = center != null ? cards[center] : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={skip}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: 'rgba(250, 246, 236, 0.92)',
        display: 'grid',
        alignContent: 'center',
        justifyItems: 'center',
        gap: '1rem',
        padding: '1rem',
        cursor: 'pointer',
      }}
    >
        {/* ターン帯 */}
        <motion.div
          initial={{ x: '-110vw', rotate: -2 }}
          animate={{ x: 0, rotate: -2 }}
          transition={{ type: 'spring', stiffness: 160, damping: 20 }}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.6rem, 6vw, 2.6rem)',
            color: '#fff',
            background: 'var(--ink)',
            padding: '0.1em 1.2em',
            boxShadow: '4px 5px 0 rgba(0,0,0,.18)',
          }}
        >
          ターン {turn}
        </motion.div>
        <div style={{ fontWeight: 800, fontSize: 'clamp(.95rem, 2.8vw, 1.15rem)' }}>
          {step === 'turn' || step === 'shuffle' ? 'どの わざが でるかな？' : step === 'both' ? 'この わざで たたかう！' : ' '}
        </div>

        <div style={{ width: '100%', maxWidth: '46rem', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '0.6rem' }}>
          {column(0)}
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', opacity: step === 'both' ? 1 : 0.25 }}>VS</div>
          {column(1)}
        </div>

        {/* まんなかで 大きく めくれる */}
        <AnimatePresence>
          {center != null && cc && (
            <motion.div
              key={`center-${center}`}
              style={{
                position: 'fixed',
                inset: 0,
                display: 'grid',
                justifyItems: 'center',
                alignContent: 'center',
                gap: '1.1rem',
                background: 'rgba(40, 34, 28, 0.55)',
                zIndex: 41,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ y: -12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.2rem, 4.6vw, 1.8rem)',
                  color: '#fff',
                  WebkitTextStroke: `5px ${SIDE_COLOR[center]}`,
                  paintOrder: 'stroke',
                  textAlign: 'center',
                }}
              >
                {headline(chars[center].name, picks[center])}
              </motion.div>
              <div style={{ perspective: 800 }}>
                <motion.div
                  initial={{ rotateY: 180, scale: 0.5 }}
                  animate={{ rotateY: 0, scale: 1 }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                  style={{ position: 'relative' }}
                >
                  <GameCard card={cc} size="min(46vw, 13rem)" style={{ boxShadow: `0 0 0 0.25em #fff, 0 0 2.4em ${cc.color}` }} />
                </motion.div>
              </div>
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: [0.4, 1.15, 1], opacity: 1 }}
                transition={{ delay: 0.45, duration: 0.4 }}
                style={{ display: 'grid', justifyItems: 'center', gap: 4 }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(1.8rem, 7vw, 2.8rem)',
                    color: '#fff',
                    WebkitTextStroke: '6px var(--ink)',
                    paintOrder: 'stroke',
                    whiteSpace: 'nowrap',
                  }}
                >
                  「{cc.name}」
                </div>
                <div
                  style={{
                    background: '#fff',
                    border: '3px solid var(--ink)',
                    borderRadius: 10,
                    padding: '0.15em 0.8em',
                    fontWeight: 800,
                    fontSize: 'clamp(.9rem, 3vw, 1.1rem)',
                    maxWidth: '90vw',
                    textAlign: 'center',
                  }}
                >
                  {cc.gist}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      <div style={{ position: 'fixed', bottom: '0.8rem', left: 0, right: 0, textAlign: 'center', fontSize: '0.75rem', color: 'var(--ink-soft)', zIndex: 42 }}>
        タップで はやおくり
      </div>
    </motion.div>
  );
}
