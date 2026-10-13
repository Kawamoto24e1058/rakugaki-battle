import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { AnimatePresence, motion, usePresence } from 'framer-motion';
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
const STEP_MS: Record<Step, number> = { turn: 1000, shuffle: 1300, p0: 3000, p1: 3000, both: 1500 };

/** まんなかの 大きいカード。 */
const BIG = 'min(56vw, 36vh, 16rem)';
/** 両がわに ならぶ 確定カード。 */
const SMALL = 'min(24vw, 8.4rem)';

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
 * えらばれた1まいが 山札から まんなかへ スライドして 大きく めくれる → 自分の がわへ もどる。
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
  const deckRefs: [RefObject<HTMLDivElement | null>, RefObject<HTMLDivElement | null>] = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

  // 場面を じゅんばんに すすめる
  useEffect(() => {
    if (step === 'turn') sfx.whoosh();
    if (step === 'both') sfx.confirm();
    const t = window.setTimeout(() => {
      if (stepIdx >= STEPS.length - 1) onDone();
      else setStepIdx((i) => i + 1);
    }, STEP_MS[step]);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  // シャッフル中は カードが いれかわる
  useEffect(() => {
    if (step !== 'shuffle') return;
    const id = window.setInterval(() => {
      setShuffleTick((n) => n + 1);
      sfx.tick(0.8 + Math.random() * 0.4);
    }, 140);
    return () => window.clearInterval(id);
  }, [step]);

  const shown = (s: Side) => stepIdx > STEPS.indexOf(s === 0 ? 'p0' : 'p1');
  const center: Side | null = step === 'p0' ? 0 : step === 'p1' ? 1 : null;

  const skip = () => {
    if (stepIdx >= STEPS.length - 1) onDone();
    else setStepIdx((i) => i + 1);
  };

  const column = (s: Side) => {
    const c = chars[s];
    const total = picks[s] === 'release' ? 1 : c.moveIds.length;
    // まんなかに 出ているあいだは 山札が 1まい へる
    const n = center === s ? Math.max(0, total - 1) : total;
    const order = Array.from({ length: n }, (_, i) => (i + shuffleTick * (s === 0 ? 1 : 3)) % Math.max(1, n));
    const done = shown(s);
    return (
      <div style={{ display: 'grid', justifyItems: 'center', gap: '0.5rem', minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem, 3.4vw, 1.35rem)', color: SIDE_COLOR[s] }}>{c.name}</div>
        <div ref={deckRefs[s]} style={{ minHeight: `calc(${SMALL} * 1.4)`, display: 'grid', placeItems: 'center' }}>
          {done && cards[s] ? (
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.35, type: 'spring', stiffness: 260, damping: 18 }}>
              <GameCard card={cards[s]!} size={SMALL} />
            </motion.div>
          ) : (
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {order.map((k, i) => (
                <motion.div
                  key={k}
                  layout="position"
                  initial={{ y: 30, opacity: 0 }}
                  animate={{
                    y: step === 'shuffle' ? [0, -12, 0] : 0,
                    opacity: 1,
                    rotate: step === 'shuffle' ? (i % 2 ? 7 : -7) : (i - (n - 1) / 2) * 4,
                  }}
                  transition={{ delay: step === 'turn' ? i * 0.1 : 0, duration: 0.25 }}
                >
                  <CardBack size="min(10vw, 4.6rem)" style={{ borderColor: SIDE_COLOR[s] }} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

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
        background: 'rgba(250, 246, 236, 0.94)',
        display: 'grid',
        alignContent: 'center',
        justifyItems: 'center',
        gap: '1rem',
        padding: '1rem',
        cursor: 'pointer',
        overflow: 'hidden',
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
      <div style={{ fontWeight: 900, fontSize: 'clamp(1rem, 3vw, 1.3rem)' }}>
        {step === 'turn' || step === 'shuffle' ? 'どの わざが でるかな？' : step === 'both' ? 'この わざで たたかう！' : ' '}
      </div>

      <div style={{ width: '100%', maxWidth: '46rem', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '0.6rem' }}>
        {column(0)}
        <motion.div
          animate={step === 'both' ? { scale: [1, 1.5, 1], opacity: 1 } : { opacity: 0.25 }}
          style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem' }}
        >
          VS
        </motion.div>
        {column(1)}
      </div>

      <AnimatePresence>
        {center != null && cards[center] && (
          <CenterReveal
            key={`center-${center}`}
            side={center}
            card={cards[center]!}
            title={headline(chars[center].name, picks[center])}
            deck={deckRefs[center]}
          />
        )}
      </AnimatePresence>

      <div style={{ position: 'fixed', bottom: '0.8rem', left: 0, right: 0, textAlign: 'center', fontSize: '0.75rem', color: 'var(--ink-soft)', zIndex: 42 }}>
        タップで はやおくり
      </div>
    </motion.div>
  );
}

/** 山札の位置 − カードの位置（スライドの きょり）。 */
function deltaTo(deck: HTMLElement | null, card: HTMLElement | null): { x: number; y: number } {
  if (!deck || !card) return { x: 0, y: 0 };
  const d = deck.getBoundingClientRect();
  const c = card.getBoundingClientRect();
  return { x: d.left + d.width / 2 - (c.left + c.width / 2), y: d.top + d.height / 2 - (c.top + c.height / 2) };
}

/**
 * えらばれた カード：山札から まんなかへ スライド → 大きくなって めくれる → 自分の がわへ もどる。
 */
function CenterReveal({ side, card, title, deck }: { side: Side; card: CardData; title: string; deck: RefObject<HTMLDivElement | null> }) {
  const [isPresent, safeToRemove] = usePresence();
  const box = useRef<HTMLDivElement>(null);
  /** measure＝位置を はかる / start＝山札の上 / slide＝まんなかへ / flip＝めくる / open＝めくれた / back＝もどる */
  const [phase, setPhase] = useState<'measure' | 'start' | 'slide' | 'flip' | 'open' | 'back'>('measure');
  const [from, setFrom] = useState({ x: 0, y: 0 });
  const flipped = phase === 'open';

  // 山札の位置を はかってから スタート
  useLayoutEffect(() => {
    setFrom(deltaTo(deck.current, box.current));
    setPhase('start');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 山札 → まんなか → めくる（1回だけ。とちゅうの phase 変化で タイマーを 消さない）
  const ready = phase !== 'measure';
  useEffect(() => {
    if (!ready) return;
    sfx.whoosh();
    const ts = [
      window.setTimeout(() => setPhase((p) => (p === 'back' ? p : 'slide')), 30),
      window.setTimeout(() => {
        setPhase((p) => (p === 'back' ? p : 'flip'));
        sfx.flip();
      }, 680),
      window.setTimeout(() => {
        setPhase((p) => (p === 'back' ? p : 'open'));
        sfx.reveal();
      }, 1150),
    ];
    return () => ts.forEach((t) => window.clearTimeout(t));
  }, [ready]);

  // 自分の がわへ もどる
  useEffect(() => {
    if (isPresent) return;
    setFrom(deltaTo(deck.current, box.current));
    setPhase('back');
    const t = window.setTimeout(() => safeToRemove?.(), 420);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent]);

  const tilt = side === 0 ? -20 : 20;
  const boxTarget =
    phase === 'measure'
      ? { opacity: 0, x: 0, y: 0, scale: 1, rotate: 0 }
      : phase === 'start'
        ? { opacity: 1, x: from.x, y: from.y, scale: 0.3, rotate: tilt }
        : phase === 'back'
          ? { opacity: 0.2, x: from.x, y: from.y, scale: 0.4, rotate: 0 }
          : { opacity: 1, x: 0, y: 0, scale: phase === 'open' ? [1, 1.12, 1] : 1, rotate: 0 };
  const boxTransition =
    phase === 'measure' || phase === 'start'
      ? { duration: 0 }
      : phase === 'back'
        ? { duration: 0.4, ease: 'easeIn' as const }
        : phase === 'open'
          ? { duration: 0.35 }
          : { duration: 0.6, ease: [0.2, 0.8, 0.3, 1] as [number, number, number, number] };
  // 山札から とんでくるあいだは 裏、まんなかに ついたら めくれる
  const showFront = phase === 'flip' || phase === 'open' || phase === 'back';
  const color = SIDE_COLOR[side];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 41, display: 'grid', justifyItems: 'center', alignContent: 'center', gap: '0.9rem', pointerEvents: 'none' }}>
      {/* うすぐらく */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isPresent ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        style={{ position: 'absolute', inset: 0, background: 'rgba(30, 26, 22, 0.62)' }}
      />
      {/* 見出し */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: isPresent ? 1 : 0 }}
        style={{
          position: 'relative',
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.3rem, 5vw, 2rem)',
          color: '#fff',
          WebkitTextStroke: `6px ${color}`,
          paintOrder: 'stroke',
          textAlign: 'center',
        }}
      >
        {title}
      </motion.div>

      <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
        {/* うしろで まわる ひかり */}
        {flipped && isPresent && (
          <motion.svg
            viewBox="-100 -100 200 200"
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, rotate: 360 }}
            transition={{ scale: { duration: 0.35 }, opacity: { duration: 0.35 }, rotate: { duration: 8, repeat: Infinity, ease: 'linear' } }}
            style={{ position: 'absolute', width: `calc(${BIG} * 2.4)`, height: `calc(${BIG} * 2.4)`, pointerEvents: 'none' }}
          >
            {Array.from({ length: 16 }, (_, i) => {
              const a = (i / 16) * Math.PI * 2;
              const b = a + Math.PI / 22;
              return (
                <polygon
                  key={i}
                  points={`0,0 ${Math.cos(a) * 100},${Math.sin(a) * 100} ${Math.cos(b) * 100},${Math.sin(b) * 100}`}
                  fill={i % 2 ? card.color : '#fff3b0'}
                  opacity={0.55}
                />
              );
            })}
          </motion.svg>
        )}
        <motion.div ref={box} initial={false} animate={boxTarget} transition={boxTransition} style={{ position: 'relative', perspective: 900, opacity: 0 }}>
          <motion.div
            className="flipper"
            initial={false}
            animate={{ rotateY: showFront ? 0 : 180 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            style={{ position: 'relative', transformStyle: 'preserve-3d' }}
          >
            <div style={{ backfaceVisibility: 'hidden' }}>
              <GameCard card={card} size={BIG} animated style={{ boxShadow: `0 0 0 0.25em #fff, 0 0 2.6em ${card.color}` }} />
            </div>
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
              <CardBack size={BIG} style={{ borderColor: color }} />
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* 技名と 効果 */}
      <motion.div
        initial={{ scale: 0.3, opacity: 0 }}
        animate={flipped && isPresent ? { scale: [0.3, 1.2, 1], opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4 }}
        style={{ position: 'relative', display: 'grid', justifyItems: 'center', gap: 6 }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.2rem, 9vw, 3.6rem)',
            color: '#fff',
            WebkitTextStroke: '7px var(--ink)',
            paintOrder: 'stroke',
            whiteSpace: 'nowrap',
            lineHeight: 1.1,
          }}
        >
          「{card.name}」
        </div>
        <div
          style={{
            background: '#fff',
            border: '3px solid var(--ink)',
            borderRadius: 12,
            padding: '0.2em 1em',
            fontWeight: 900,
            fontSize: 'clamp(1rem, 3.6vw, 1.35rem)',
            maxWidth: '90vw',
            textAlign: 'center',
            boxShadow: '3px 4px 0 rgba(0,0,0,.25)',
          }}
        >
          {card.gist}
        </div>
      </motion.div>
    </div>
  );
}
