import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CardBack, GameCard } from './GameCard';
import { koseiCard, moveCard, type CardData } from './moveText';
import { getMove } from '../engine/moves';
import { getKosei } from '../engine';
import { sfx } from '../audio/sfx';
import type { ClashChoice } from '../engine';

/** カードの大きさ：横幅と「画面の高さ」の両方で上限を決める（低い画面でも1画面に収める）。 */
const sizeFor = (n: number, wide: boolean) =>
  wide ? (n >= 4 ? 'min(12.5vw, 8.2rem, 27vh)' : n === 2 ? 'min(18vw, 10.4rem, 30vh)' : 'min(16vw, 10.4rem, 30vh)') : n >= 4 ? 'min(22vw, 8.6rem)' : n === 2 ? 'min(32vw, 10.4rem)' : 'min(28vw, 9.6rem)';

function cardOf(id: ClashChoice, koseiId: string): CardData | null {
  if (id === 'kosei') return koseiCard(getKosei(koseiId));
  try {
    return moveCard(getMove(id));
  } catch {
    return null;
  }
}

type Stage = 'dealing' | 'choosing' | 'committing';

function useWide(): boolean {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 760);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 760);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return wide;
}

/**
 * 手札フェーズ：山札から3枚が飛んできて、めくれる → 1枚タップで持ち上がる →
 * 横の説明パネルの「これで いく！」（またはもう一度タップ）で決定。
 * 広い画面ではカードの右に説明と決定ボタンを置き、画面を スクロールしなくても押せる。
 */
export function HandTable({
  hand,
  koseiId,
  turn,
  accent,
  note,
  onPick,
}: {
  hand: ClashChoice[];
  koseiId: string;
  turn: number;
  accent: string;
  /** 技の効果で手札が変わったときのお知らせ。 */
  note?: string | null;
  onPick: (c: ClashChoice) => void;
}) {
  const cards = useMemo(() => hand.map((id) => ({ id, data: cardOf(id, koseiId) })), [hand, koseiId]);
  const [selected, setSelected] = useState<number | null>(null);
  const [stage, setStage] = useState<Stage>('dealing');
  const wide = useWide();

  // 配り終わったらえらべる
  useEffect(() => {
    setSelected(null);
    setStage('dealing');
    const t = window.setTimeout(() => setStage('choosing'), 250 + hand.length * 220 + 450);
    hand.forEach((_, i) => sfx.deal(i));
    return () => window.clearTimeout(t);
  }, [hand, turn]);

  const sel = selected != null ? cards[selected] : null;
  const n = cards.length;
  const CARD_SIZE = sizeFor(n, wide);

  function commit() {
    if (selected == null || stage !== 'choosing') return;
    setStage('committing');
    sfx.confirm();
    const id = cards[selected].id;
    window.setTimeout(() => onPick(id), 650);
  }

  const panel = (
    <div
      style={{
        width: wide ? '14rem' : '100%',
        maxWidth: wide ? '14rem' : '26rem',
        flex: wide ? '0 0 14rem' : undefined,
        display: 'grid',
        gap: '0.45rem',
        alignContent: 'center',
        justifyItems: 'stretch',
        minHeight: wide ? undefined : '5.4rem',
      }}
    >
      <div style={{ background: '#fff', border: '2.5px solid var(--ink)', borderRadius: 10, padding: '0.4rem 0.7rem', fontSize: '0.8rem', textAlign: 'left', boxShadow: '3px 4px 0 rgba(0,0,0,.14)', minHeight: wide ? '5.6rem' : undefined }}>
        {stage === 'dealing' ? (
          <span style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>カードが くばられるよ…</span>
        ) : stage === 'committing' ? (
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: accent }}>カードを ふせた！</span>
        ) : sel?.data ? (
          <>
            <strong style={{ fontFamily: 'var(--font-display)', color: sel.data.color, fontSize: '0.95rem' }}>「{sel.data.name}」</strong>
            {sel.data.lines.map((l, k) => (
              <div key={k}>・{l}</div>
            ))}
          </>
        ) : (
          <span style={{ fontWeight: 800 }}>1まい えらんで タップ！</span>
        )}
      </div>
      <motion.button
        className="crayon-btn primary"
        disabled={!(stage === 'choosing' && sel)}
        whileTap={{ scale: 0.95 }}
        onClick={commit}
        style={{ fontSize: '1.25rem', padding: '0.55em 1em', opacity: stage === 'choosing' && sel ? 1 : 0.45 }}
      >
        これで いく！
      </motion.button>
    </div>
  );

  return (
    <div style={{ width: '100%', maxWidth: '52rem', display: 'grid', gap: '0.4rem', justifyItems: 'center' }}>
      {note && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          style={{ background: '#fff4c9', border: '2.5px solid #d9a400', borderRadius: 99, padding: '0.1rem 0.9rem', fontSize: '0.8rem', fontWeight: 800, color: '#7a5a00' }}
        >
          {note}
        </motion.div>
      )}
      <div style={{ width: '100%', display: 'flex', flexDirection: wide ? 'row' : 'column', gap: wide ? '1rem' : '0.4rem', alignItems: wide ? 'center' : 'center', justifyContent: 'center' }}>
        {/* 山札 */}
        <div
          style={wide ? { flex: `0 0 calc(${CARD_SIZE} * 0.6)`, alignSelf: 'flex-end', position: 'relative', width: `calc(${CARD_SIZE} * 0.6)`, aspectRatio: '5 / 7', marginBottom: '0.2rem' } : { position: 'absolute', left: 0, bottom: '0.2rem', width: `calc(${CARD_SIZE} * 0.6)`, aspectRatio: '5 / 7', zIndex: 0 }}
        >
          {[2, 1, 0].map((k) => (
            <div
              key={k}
              style={{ position: 'absolute', inset: 0, transform: `translate(${k * 3}px, ${-k * 3}px)`, ['--r' as string]: `${(k - 1) * 3}deg`, animation: stage === 'dealing' ? 'deck-bob 0.5s ease-in-out infinite' : undefined }}
            >
              <CardBack size={`calc(${CARD_SIZE} * 0.6)`} />
            </div>
          ))}
        </div>

        {/* 手札（一直線） */}
        <div style={{ position: 'relative', flex: wide ? 1 : undefined, minWidth: 0, width: wide ? undefined : '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', minHeight: `calc(${CARD_SIZE} * 1.4 + 1.8rem)`, perspective: 900 }}>
          <div style={{ display: 'flex', gap: 'min(1.2vw, 0.5rem)', justifyContent: 'center', alignItems: 'flex-end', zIndex: 1 }}>
            {cards.map((c, i) => {
              if (!c.data) return null;
              const isSel = selected === i;
              const dimmed = selected != null && !isSel;
              const committing = stage === 'committing';
              const leave = committing && !isSel;
              return (
                <motion.div
                  key={`${turn}-${c.id}`}
                  onClick={() => {
                    if (stage !== 'choosing') return;
                    if (isSel) {
                      commit();
                      return;
                    }
                    setSelected(i);
                    sfx.select();
                  }}
                  initial={{ x: `${-(i * 112) - 70}%`, y: 70, rotate: -20, scale: 0.55, opacity: 0, rotateY: 180 }}
                  animate={
                    leave
                      ? { x: 0, y: 120, rotate: 0, scale: 0.7, opacity: 0, rotateY: 0 }
                      : committing && isSel
                        ? { x: 0, y: -30, rotate: 0, scale: 1.12, opacity: 1, rotateY: 180 }
                        : { x: 0, y: isSel ? -14 : 0, rotate: 0, scale: isSel ? 1.06 : dimmed ? 0.95 : 1, opacity: dimmed ? 0.62 : 1, rotateY: 0 }
                  }
                  transition={{
                    type: 'spring',
                    stiffness: committing ? 180 : 230,
                    damping: committing ? 22 : 17,
                    delay: stage === 'dealing' ? 0.25 + i * 0.22 : 0,
                    rotateY: { type: 'tween', duration: committing ? 0.45 : 0.5, delay: stage === 'dealing' ? 0.45 + i * 0.22 : 0, ease: 'easeOut' },
                  }}
                  whileHover={stage === 'choosing' && !isSel ? { y: -8, scale: 1.04 } : undefined}
                  whileTap={stage === 'choosing' ? { scale: 0.97 } : undefined}
                  style={{ position: 'relative', cursor: stage === 'choosing' ? 'pointer' : 'default', transformStyle: 'preserve-3d', zIndex: isSel ? 5 : 1 }}
                >
                  <div style={{ backfaceVisibility: 'hidden' }}>
                    <GameCard card={c.data} size={CARD_SIZE} selected={isSel && stage === 'choosing'} />
                  </div>
                  <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                    <CardBack size={CARD_SIZE} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
        {panel}
      </div>
    </div>
  );
}
