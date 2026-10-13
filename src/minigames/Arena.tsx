import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { KEY_LABELS } from './input';
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

/** かたがわ（1人ぶん）の わく。 */
export function Half({ player, name, cpu, children, style }: { player: Player; name: string; cpu?: boolean; children: ReactNode; style?: CSSProperties }) {
  return (
    <div
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
        ...style,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: '0.8rem', color: P_COLOR[player], justifySelf: player === 0 ? 'start' : 'end' }}>
        {player === 0 ? 'P1' : cpu ? 'CPU' : 'P2'}：{name}
      </div>
      {children}
    </div>
  );
}

/** 大きな押しボタン（タッチ）。キーボードでは A/S/D・J/K/L のどれでも押せる。 */
export function BigButton({ player, label, onPress, disabled, cpu }: { player: Player; label: ReactNode; onPress: () => void; disabled?: boolean; cpu?: boolean }) {
  return (
    <motion.button
      className="crayon-btn"
      disabled={disabled || cpu}
      whileTap={{ scale: 0.93 }}
      onPointerDown={(e) => {
        e.preventDefault();
        if (!disabled && !cpu) onPress();
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
              if (!disabled && !cpu) onPick(i);
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
