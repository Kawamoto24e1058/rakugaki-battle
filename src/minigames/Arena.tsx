import { createContext, useContext, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { KEY_LABELS, usePlayerKeys } from './input';
import { useMinigameCtx } from './context';
import { CharacterSprite } from '../components/bits';
import type { Player } from './types';

export const P_COLOR: [string, string] = ['#e8503a', '#2f7dd1'];
export const P_SOFT: [string, string] = ['#fff1ec', '#eaf3ff'];

/** 左右に分かれた ミニゲームの場。 */
export function Arena({ children, top }: { children: [ReactNode, ReactNode]; top?: ReactNode }) {
  return (
    <div style={{ width: '100%', display: 'grid', gap: '0.4rem' }}>
      {top}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', width: '100%' }}>{children}</div>
    </div>
  );
}

/** ボタンが おされたことを わく（アバター）に つたえる。 */
const PulseCtx = createContext<() => void>(() => {});

type Mood = 'good' | 'bad' | null;

/**
 * かたがわ（1人ぶん）の わく。
 * 上に 描いた絵の アバター（おすと はねる）／せいかい・まちがいで ○×スタンプ／結果で「かち！」スタンプ。
 */
export function Half({
  player,
  name,
  cpu,
  children,
  style,
  mood = null,
}: {
  player: Player;
  name: string;
  cpu?: boolean;
  children: ReactNode;
  style?: CSSProperties;
  /** せいかい（good）／まちがい（bad）。かわった しゅんかんに スタンプが出る。 */
  mood?: Mood;
}) {
  const { fighters, outcome } = useMinigameCtx();
  const f = fighters?.[player] ?? null;
  const [pulse, setPulse] = useState(0);
  const bump = () => setPulse((n) => n + 1);
  usePlayerKeys((p) => {
    if (p === player && !cpu) bump();
  });
  const result = outcome ? (outcome.winner == null ? 'draw' : outcome.winner === player ? 'win' : 'lose') : null;

  return (
    <PulseCtx.Provider value={bump}>
      <motion.div
        key={mood ?? 'none'}
        animate={mood === 'bad' ? { x: [0, -10, 9, -6, 4, 0] } : mood === 'good' ? { scale: [1, 1.04, 1] } : {}}
        transition={{ duration: 0.4 }}
        style={{
          position: 'relative',
          border: `3px solid ${P_COLOR[player]}`,
          borderRadius: 14,
          background: P_SOFT[player],
          padding: '0.45rem',
          display: 'grid',
          gap: '0.35rem',
          justifyItems: 'center',
          alignContent: 'start',
          minWidth: 0,
          minHeight: '11rem',
          boxShadow: mood === 'good' ? `0 0 0 4px #2fa862, 0 0 18px #2fa86288` : result === 'win' ? `0 0 0 4px var(--crayon-yellow), 0 0 22px #f2b70599` : 'none',
          opacity: result === 'lose' ? 0.8 : 1,
          transition: 'box-shadow .2s, opacity .3s',
          ...style,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifySelf: player === 0 ? 'start' : 'end', flexDirection: player === 0 ? 'row' : 'row-reverse' }}>
          {f && (
            <div style={{ position: 'relative', width: '2.8rem', height: '2.8rem' }}>
              {/* おした しゅんかんの わっか */}
              <AnimatePresence>
                {pulse > 0 && (
                  <motion.div
                    key={pulse}
                    initial={{ scale: 0.6, opacity: 0.8 }}
                    animate={{ scale: 1.9, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${P_COLOR[player]}`, pointerEvents: 'none' }}
                  />
                )}
              </AnimatePresence>
              <motion.div
                key={`${pulse}-${result}`}
                animate={
                  result === 'win'
                    ? { y: [0, -12, 0], rotate: [0, -6, 6, 0], scaleY: 1 }
                    : result === 'lose'
                      ? { y: 4, rotate: player === 0 ? -14 : 14, scaleY: 0.9 }
                      : pulse > 0
                        ? { scaleY: [1, 0.78, 1.14, 1], scaleX: [1, 1.16, 0.92, 1], y: [0, 2, -6, 0] }
                        : { y: [0, -2, 0] }
                }
                transition={
                  result === 'win'
                    ? { repeat: Infinity, duration: 0.55 }
                    : result === 'lose'
                      ? { duration: 0.4 }
                      : pulse > 0
                        ? { duration: 0.28 }
                        : { repeat: Infinity, duration: 1.8, ease: 'easeInOut' }
                }
                style={{ width: '100%', height: '100%', transformOrigin: '50% 100%', filter: result === 'lose' ? 'grayscale(0.6)' : undefined }}
              >
                <CharacterSprite imageUrl={f.image} attribute={f.attribute} name={f.name} flip={player === 1} />
              </motion.div>
            </div>
          )}
          <div style={{ fontWeight: 900, fontSize: '0.85rem', color: P_COLOR[player] }}>
            {player === 0 ? 'P1' : cpu ? 'CPU' : 'P2'}：{name}
          </div>
        </div>
        {children}

        {/* ○×スタンプ */}
        <AnimatePresence>
          {mood && !result && (
            <motion.div
              key={mood}
              initial={{ scale: 2.4, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: [0, 1, 1, 0], rotate: 0 }}
              transition={{ duration: 1.1, times: [0, 0.15, 0.7, 1] }}
              style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', zIndex: 5 }}
            >
              <svg viewBox="-50 -50 100 100" width="58%" style={{ maxWidth: '9rem', overflow: 'visible' }}>
                {mood === 'good' ? (
                  <circle r={36} fill="none" stroke="#2fa862" strokeWidth={14} />
                ) : (
                  <g stroke="#e8503a" strokeWidth={14} strokeLinecap="round">
                    <line x1={-30} y1={-30} x2={30} y2={30} />
                    <line x1={30} y1={-30} x2={-30} y2={30} />
                  </g>
                )}
              </svg>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 結果スタンプ */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ scale: 3, opacity: 0, rotate: player === 0 ? -24 : 24 }}
              animate={{ scale: 1, opacity: 1, rotate: player === 0 ? -8 : 8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 16 }}
              style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', zIndex: 6 }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(2.2rem, 8vw, 3.6rem)',
                  color: result === 'win' ? '#fff' : result === 'draw' ? '#fff' : '#ddd8cc',
                  WebkitTextStroke: `7px ${result === 'win' ? P_COLOR[player] : result === 'draw' ? 'var(--ink)' : '#77716a'}`,
                  paintOrder: 'stroke',
                  border: `5px solid ${result === 'win' ? P_COLOR[player] : '#77716a'}`,
                  borderRadius: 16,
                  padding: '0 0.4em',
                  background: 'rgba(255,253,245,.85)',
                  whiteSpace: 'nowrap',
                }}
              >
                {result === 'win' ? 'かち！' : result === 'lose' ? 'まけ…' : 'ひきわけ'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </PulseCtx.Provider>
  );
}

/** 大きな押しボタン（タッチ）。キーボードでは A/S/D・J/K/L のどれでも押せる。 */
export function BigButton({ player, label, onPress, disabled, cpu }: { player: Player; label: ReactNode; onPress: () => void; disabled?: boolean; cpu?: boolean }) {
  const pulse = useContext(PulseCtx);
  return (
    <motion.button
      className="crayon-btn"
      disabled={disabled || cpu}
      whileTap={{ scale: 0.93 }}
      onPointerDown={(e) => {
        e.preventDefault();
        if (!disabled && !cpu) {
          onPress();
          pulse();
        }
      }}
      style={{
        width: '100%',
        minHeight: '4.4rem',
        fontSize: 'clamp(1.05rem, 4.6vw, 1.4rem)',
        whiteSpace: 'nowrap',
        padding: '0.4rem 0.5rem',
        background: P_COLOR[player],
        color: '#fff',
        opacity: disabled ? 0.5 : 1,
        touchAction: 'manipulation',
        userSelect: 'none',
      }}
    >
      {label}
      {!cpu && <div style={{ fontSize: '0.68rem', opacity: 0.85, marginTop: 2, whiteSpace: 'normal' }}>キー：{KEY_LABELS[player].join(' / ')}</div>}
    </motion.button>
  );
}

/** 3択ボタン。キーは P1＝A S D、P2＝J K L。 */
export function ChoiceButtons({
  player,
  options,
  onPick,
  disabled,
  picked,
  correct,
  cpu,
}: {
  player: Player;
  options: ReactNode[];
  onPick: (i: number) => void;
  disabled?: boolean;
  picked: number | null;
  correct: number | null;
  cpu?: boolean;
}) {
  const pulse = useContext(PulseCtx);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: '0.35rem', width: '100%' }}>
      {options.map((o, i) => {
        const isPicked = picked === i;
        const showRight = correct != null && i === correct;
        const bg = showRight ? '#cdeedb' : isPicked ? (correct != null && i !== correct ? '#ffd2c8' : '#fff4c9') : '#fffdf5';
        return (
          <motion.button
            key={i}
            className="crayon-btn"
            disabled={disabled || cpu}
            whileTap={{ scale: 0.94 }}
            onPointerDown={(e) => {
              e.preventDefault();
              if (!disabled && !cpu) {
                onPick(i);
                pulse();
              }
            }}
            style={{ minHeight: '4.2rem', padding: '0.2rem', background: bg, display: 'grid', placeItems: 'center', gap: 2, touchAction: 'manipulation', userSelect: 'none', borderColor: isPicked ? P_COLOR[player] : undefined }}
          >
            <div style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.1 }}>{o}</div>
            {!cpu && <div style={{ fontSize: '0.62rem', opacity: 0.6 }}>{KEY_LABELS[player][i]}</div>}
          </motion.button>
        );
      })}
    </div>
  );
}

export type ShapeKind = 'circle' | 'square' | 'triangle' | 'star' | 'heart' | 'diamond';
export const SHAPE_JP: Record<ShapeKind, string> = { circle: 'まる', square: 'しかく', triangle: 'さんかく', star: 'ほし', heart: 'ハート', diamond: 'ひしがた' };
export const COLORS: { id: string; jp: string; hex: string }[] = [
  { id: 'red', jp: 'あか', hex: '#e8503a' },
  { id: 'blue', jp: 'あお', hex: '#2f7dd1' },
  { id: 'yellow', jp: 'きいろ', hex: '#f2b705' },
  { id: 'green', jp: 'みどり', hex: '#2fa862' },
  { id: 'purple', jp: 'むらさき', hex: '#7b5cf0' },
  { id: 'pink', jp: 'ピンク', hex: '#ec6a9c' },
];

const starPts = (r1: number, r2: number, n: number) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 === 0 ? r1 : r2;
    const a = (Math.PI * i) / n - Math.PI / 2;
    return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
  }).join(' ');

/** かんたんな図形（クレヨン風の線）。 */
export function Shape({ kind, color, size = 48, rotate = 0 }: { kind: ShapeKind; color: string; size?: number; rotate?: number }) {
  const common = { fill: color, stroke: '#33302b', strokeWidth: 3, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="-24 -24 48 48" width={size} height={size} style={{ display: 'block', transform: `rotate(${rotate}deg)` }}>
      <g filter="url(#crayon)">
        {kind === 'circle' && <circle r={18} {...common} />}
        {kind === 'square' && <rect x={-17} y={-17} width={34} height={34} rx={3} {...common} />}
        {kind === 'triangle' && <polygon points="0,-19 19,15 -19,15" {...common} />}
        {kind === 'star' && <polygon points={starPts(20, 8.5, 5)} {...common} />}
        {kind === 'heart' && <path d="M0,17 Q-22,2 -15,-10 Q-8,-19 0,-9 Q8,-19 15,-10 Q22,2 0,17Z" {...common} />}
        {kind === 'diamond' && <polygon points="0,-20 15,0 0,20 -15,0" {...common} />}
      </g>
    </svg>
  );
}
