import { AnimatePresence, motion } from 'framer-motion';
import { CardBack, GameCard } from './GameCard';
import type { CardData } from './moveText';
import type { OrderReason, Side } from '../engine';

export interface TableState {
  cards: [CardData | null, CardData | null];
  /** 表になっているか。 */
  revealed: [boolean, boolean];
  /** うごけなかった（こおり・ねむり等）。 */
  blocked: [boolean, boolean];
  /** いま動いている側。 */
  actor: Side | null;
  /** 先に動く側（行動順が決まった後）。 */
  first: Side | null;
  /** すばやさ比べ（行動順の場面だけ）。 */
  race: { reason: OrderReason; spd: [number, number]; first: Side } | null;
}

export const EMPTY_TABLE: TableState = {
  cards: [null, null],
  revealed: [false, false],
  blocked: [false, false],
  actor: null,
  first: null,
  race: null,
};

const SLOT = 'min(17vw, 5.4rem)';

const REASON_TEXT: Record<OrderReason, string> = {
  kosei: 'こせいわざは かならず 先に うごく！',
  priority: '先に うごく わざで 先手！',
  passive: 'こせいの ちからで 先に うごく！',
  speed: 'すばやさが 高い ほうが 先！',
  coin: 'すばやさが おなじ！ うんで きまった',
};

/** 場：2人が伏せたカードが並び、すばやさ比べの後、先に動く側から順にめくれる。 */
export function PlayArea({ table, names, colors }: { table: TableState; names: [string, string]; colors: [string, string] }) {
  const slot = (side: Side) => {
    const card = table.cards[side];
    const up = table.revealed[side] && !!card;
    const acting = table.actor === side;
    const dir = side === 0 ? -1 : 1;
    return (
      <div style={{ position: 'relative', display: 'grid', justifyItems: 'center', gap: 4 }}>
        <motion.div
          initial={{ x: dir * 120, opacity: 0, rotate: dir * 18, scale: 0.7 }}
          animate={{ x: 0, opacity: 1, rotate: 0, scale: acting ? 1.08 : 1, y: acting ? -4 : 0 }}
          transition={{ type: 'spring', stiffness: 230, damping: 16 }}
          style={{ position: 'relative', perspective: 800 }}
        >
          <motion.div
            animate={{ rotateY: up ? 0 : 180 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{ transformStyle: 'preserve-3d', position: 'relative' }}
          >
            <div style={{ backfaceVisibility: 'hidden', opacity: table.blocked[side] ? 0.45 : 1 }}>
              {card ? <GameCard card={card} size={SLOT} /> : <CardBack size={SLOT} />}
            </div>
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
              <CardBack size={SLOT} />
            </div>
          </motion.div>
          {acting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.9, 0.2, 0.9] }}
              transition={{ repeat: Infinity, duration: 0.9 }}
              style={{ position: 'absolute', inset: -6, borderRadius: 16, boxShadow: `0 0 0 4px ${colors[side]}`, pointerEvents: 'none' }}
            />
          )}
          {table.blocked[side] && up && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--bad)', WebkitTextStroke: '2px #fff', paintOrder: 'stroke' }}>
              うごけない！
            </div>
          )}
        </motion.div>
        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: colors[side], display: 'flex', gap: 4, alignItems: 'center', minHeight: '1.2em' }}>
          {names[side]}
          {table.first === side && (
            <motion.span
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              style={{ background: 'var(--crayon-yellow)', border: '2px solid var(--ink)', borderRadius: 99, padding: '0 0.45em', color: 'var(--ink)', fontSize: '0.7rem' }}
            >
              先
            </motion.span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ width: '100%', maxWidth: '40rem', display: 'grid', gap: '0.5rem', justifyItems: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', width: 'min(100%, 28rem)' }}>
        {slot(0)}
        {slot(1)}
      </div>
      <AnimatePresence>
        {table.race && (
          <motion.div
            key="race"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            style={{ width: 'min(100%, 28rem)', display: 'grid', gap: 4 }}
          >
            {(table.race.reason === 'speed' || table.race.reason === 'coin' ? ([0, 1] as Side[]) : []).map((s) => {
              const v = table.race!.spd[s];
              const win = table.race!.first === s;
              return (
                <div key={s} style={{ display: 'grid', gridTemplateColumns: '5.2rem 1fr 2rem', alignItems: 'center', gap: 6, fontSize: '0.74rem', fontWeight: 800 }}>
                  <span style={{ color: colors[s], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{names[s]}</span>
                  <div style={{ position: 'relative', height: 14, background: '#0001', border: '2px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (v / 70) * 100)}%` }}
                      transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
                      style={{ height: '100%', background: colors[s], opacity: win ? 1 : 0.6 }}
                    />
                    {win && (
                      <div style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.7), transparent)', animation: 'speed-streak 0.9s ease-out 0.7s 2' }} />
                    )}
                  </div>
                  <span style={{ textAlign: 'right' }}>{Math.round(v)}</span>
                </div>
              );
            })}
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.7, type: 'spring', stiffness: 260, damping: 14 }}
              style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '0.95rem' }}
            >
              {REASON_TEXT[table.race.reason]}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
