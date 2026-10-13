import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GameCard } from '../../components/GameCard';
import { koseiCard, moveCard, type CardData } from '../../components/moveText';
import { getKosei, type ClashChoice, type Side } from '../../engine';
import { getMove } from '../../engine/moves';
import type { Character } from '../../engine/types';

const SIDE_COLOR: [string, string] = ['#e8503a', '#2f7dd1'];

function cardFor(choice: ClashChoice, c: Character): CardData | null {
  if (choice === 'kosei') return koseiCard(getKosei(c.koseiId));
  if (choice === 'release') return null;
  try {
    return moveCard(getMove(choice));
  } catch {
    return null;
  }
}

/**
 * ターンのはじめ：それぞれのキャラの4つの技が くるくる回って、このターンの技が きまる。
 */
export function MoveReveal({ chars, picks, charging }: { chars: [Character, Character]; picks: [ClashChoice, ClashChoice]; charging: [string | null, string | null] }) {
  const [spin, setSpin] = useState(0);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setSpin(n);
      if (n >= 9) {
        window.clearInterval(id);
        setSettled(true);
      }
    }, 110);
    return () => window.clearInterval(id);
  }, []);

  const side = (s: Side) => {
    const c = chars[s];
    const pick = picks[s];
    const names = c.moveIds.map((id) => {
      try {
        return getMove(id).name;
      } catch {
        return id;
      }
    });
    const pickIdx = pick === 'kosei' ? 4 : c.moveIds.indexOf(pick);
    const lit = settled ? pickIdx : spin % 5;
    const card = settled ? (pick === 'release' ? null : cardFor(pick, c)) : null;
    return (
      <div key={s} style={{ display: 'grid', gap: '0.35rem', justifyItems: 'center', minWidth: 0 }}>
        <div style={{ fontWeight: 900, fontSize: '0.8rem', color: SIDE_COLOR[s] }}>{c.name} の わざ</div>
        {pick === 'release' ? (
          <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: SIDE_COLOR[s], textAlign: 'center' }}>
            ためた ちからを はなつ！
            <div style={{ fontSize: '0.85rem' }}>「{charging[s] ? getMove(charging[s]!).name : ''}」</div>
          </motion.div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
              {[...names, 'こせい'].map((n, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    padding: '1px 8px',
                    borderRadius: 99,
                    border: `2px solid ${i === lit ? SIDE_COLOR[s] : 'rgba(51,48,43,.35)'}`,
                    background: i === lit ? (settled ? '#fff4c9' : '#fff') : 'transparent',
                    opacity: i === 4 && pick !== 'kosei' && settled ? 0.35 : 1,
                    transform: i === lit ? 'scale(1.08)' : undefined,
                    transition: 'all .08s',
                  }}
                >
                  {n}
                </span>
              ))}
            </div>
            <div style={{ minHeight: 'calc(min(26vw, 7.2rem) * 1.4)' }}>
              {card && (
                <motion.div initial={{ rotateY: 90, scale: 0.7 }} animate={{ rotateY: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
                  <GameCard card={card} size="min(26vw, 7.2rem)" />
                </motion.div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };
  return (
    <div style={{ width: '100%', maxWidth: '52rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
      {side(0)}
      {side(1)}
    </div>
  );
}
