import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CardBack, GameCard } from './GameCard';
import { koseiCard, moveCard, type CardData } from './moveText';
import { getMove } from '../engine/moves';
import { getKosei } from '../engine';
import type { ClashChoice } from '../engine';

const sizeFor = (n: number) => (n >= 4 ? 'min(22vw, 8.6rem)' : n === 2 ? 'min(32vw, 10.4rem)' : 'min(28vw, 9.6rem)');
const fanRot = (i: number, n: number) => (i - (n - 1) / 2) * (n >= 4 ? 5 : 7);
const fanY = (i: number, n: number) => 8 - Math.max(0, 1 - Math.abs(i - (n - 1) / 2)) * 10;

function cardOf(id: ClashChoice, koseiId: string): CardData | null {
  if (id === 'kosei') return koseiCard(getKosei(koseiId));
  try {
    return moveCard(getMove(id));
  } catch {
    return null;
  }
}

type Stage = 'dealing' | 'choosing' | 'committing';

/**
 * 手札フェーズ：山札から3枚が飛んできて、めくれる → 1枚タップで持ち上がり説明が出る →
 * 「これで いく！」で他のカードが退場し、えらんだカードが伏せられて場へ。
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

  // 配り終わったらえらべる
  useEffect(() => {
    setSelected(null);
    setStage('dealing');
    const t = window.setTimeout(() => setStage('choosing'), 250 + hand.length * 220 + 450);
    return () => window.clearTimeout(t);
  }, [hand, turn]);

  const sel = selected != null ? cards[selected] : null;
  const n = cards.length;
  const CARD_SIZE = sizeFor(n);

  function commit() {
    if (selected == null || stage !== 'choosing') return;
    setStage('committing');
    const id = cards[selected].id;
    window.setTimeout(() => onPick(id), 650);
  }

  return (
    <div style={{ width: '100%', maxWidth: '40rem', display: 'grid', gap: '0.6rem', justifyItems: 'center' }}>
      {note && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          style={{ background: '#fff4c9', border: '2.5px solid #d9a400', borderRadius: 99, padding: '0.1rem 0.9rem', fontSize: '0.82rem', fontWeight: 800, color: '#7a5a00' }}
        >
          ✨ {note}
        </motion.div>
      )}
      {/* 山札＋手札 */}
      <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', minHeight: `calc(${CARD_SIZE} * 1.4 + 2.6rem)`, perspective: 900 }}>
        {/* 山札 */}
        <div style={{ position: 'absolute', left: '0.2rem', bottom: '0.2rem', width: `calc(${CARD_SIZE} * 0.62)`, aspectRatio: '5 / 7', zIndex: 0 }}>
          {[2, 1, 0].map((k) => (
            <div
              key={k}
              style={{ position: 'absolute', inset: 0, transform: `translate(${k * 3}px, ${-k * 3}px)`, ['--r' as string]: `${(k - 1) * 3}deg`, animation: stage === 'dealing' ? 'deck-bob 0.5s ease-in-out infinite' : undefined }}
            >
              <CardBack size={`calc(${CARD_SIZE} * 0.62)`} />
            </div>
          ))}
        </div>

        {/* 手札（扇） */}
        <div style={{ display: 'flex', gap: 'min(2vw, 0.6rem)', justifyContent: 'center', alignItems: 'flex-end', zIndex: 1 }}>
          {cards.map((c, i) => {
            if (!c.data) return null;
            const isSel = selected === i;
            const dimmed = selected != null && !isSel;
            const committing = stage === 'committing';
            const leave = committing && !isSel;
            return (
              <motion.div
                key={`${turn}-${c.id}`}
                onClick={() => stage === 'choosing' && setSelected(i)}
                initial={{ x: `${-(i * 112) - 70}%`, y: 70, rotate: -28, scale: 0.55, opacity: 0, rotateY: 180 }}
                animate={
                  leave
                    ? { x: 0, y: 120, rotate: fanRot(i, n) * 2, scale: 0.7, opacity: 0, rotateY: 0 }
                    : committing && isSel
                      ? { x: 0, y: -30, rotate: 0, scale: 1.12, opacity: 1, rotateY: 180 }
                      : {
                          x: 0,
                          y: isSel ? -26 : dimmed ? fanY(i, n) + 8 : fanY(i, n),
                          rotate: isSel ? 0 : fanRot(i, n),
                          scale: isSel ? 1.1 : dimmed ? 0.93 : 1,
                          opacity: dimmed ? 0.62 : 1,
                          rotateY: 0,
                        }
                }
                transition={{
                  type: 'spring',
                  stiffness: committing ? 180 : 230,
                  damping: committing ? 22 : 17,
                  delay: stage === 'dealing' ? 0.25 + i * 0.22 : 0,
                  rotateY: { type: 'tween', duration: committing ? 0.45 : 0.5, delay: stage === 'dealing' ? 0.45 + i * 0.22 : 0, ease: 'easeOut' },
                }}
                whileHover={stage === 'choosing' && !isSel ? { y: fanY(i, n) - 12, scale: 1.05 } : undefined}
                whileTap={stage === 'choosing' ? { scale: 0.97 } : undefined}
                style={{ position: 'relative', cursor: stage === 'choosing' ? 'pointer' : 'default', transformStyle: 'preserve-3d', zIndex: isSel ? 5 : 1 }}
              >
                {/* 表 */}
                <div style={{ backfaceVisibility: 'hidden' }}>
                  <GameCard card={c.data} size={CARD_SIZE} selected={isSel && stage === 'choosing'} />
                </div>
                {/* 裏（めくる前／えらんだあと） */}
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  <CardBack size={CARD_SIZE} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* せつめい＋決定 */}
      <div style={{ minHeight: '5.6rem', width: '100%', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: '0.45rem' }}>
        <AnimatePresence mode="wait">
          {stage === 'dealing' ? (
            <motion.div key="deal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', fontWeight: 700 }}>
              カードが くばられるよ…
            </motion.div>
          ) : stage === 'committing' ? (
            <motion.div key="commit" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: accent }}>
              カードを ふせた！
            </motion.div>
          ) : sel?.data ? (
            <motion.div
              key={`sel-${selected}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ display: 'grid', gap: '0.45rem', justifyItems: 'center', width: '100%' }}
            >
              <div style={{ background: '#fff', border: '2.5px solid var(--ink)', borderRadius: 10, padding: '0.35rem 0.8rem', fontSize: '0.82rem', textAlign: 'left', boxShadow: '3px 4px 0 rgba(0,0,0,.14)', maxWidth: '26rem' }}>
                <strong style={{ fontFamily: 'var(--font-display)', color: sel.data.color }}>「{sel.data.name}」</strong>
                {sel.data.lines.map((l, k) => (
                  <div key={k}>・{l}</div>
                ))}
              </div>
              <motion.button
                className="crayon-btn primary"
                whileTap={{ scale: 0.95 }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                onClick={commit}
                style={{ fontSize: '1.2rem' }}
              >
                これで いく！
              </motion.button>
            </motion.div>
          ) : (
            <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontSize: '0.95rem', fontWeight: 700 }}>
              1まい えらんで タップ！
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
