import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { Character, Stats } from '../engine/types';
import { ATTRIBUTE_META } from '../engine/attributes';

export function AttributeBadge({ attribute, size = 1 }: { attribute: Character['attribute']; size?: number }) {
  const meta = ATTRIBUTE_META[attribute];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35em',
        fontFamily: 'var(--font-display)',
        fontSize: `${size}rem`,
        padding: '0.15em 0.7em',
        borderRadius: 999,
        border: '2.5px solid var(--border)',
        background: meta.color,
        color: '#fff',
        whiteSpace: 'nowrap',
      }}
    >
      {meta.jp}
    </span>
  );
}

const STAT_LABEL: Record<keyof Stats, string> = {
  hp: 'HP',
  atk: 'こうげき',
  def: 'ぼうぎょ',
  spd: 'すばやさ',
  luck: 'きゅうしょ',
  heart: 'こんじょう',
};
export const STAT_MAX: Record<keyof Stats, number> = { hp: 130, atk: 62, def: 62, spd: 62, luck: 40, heart: 40 };
export const STAT_LABEL_JP = STAT_LABEL;

/** 1本のゲージ。animate で 0 → 値 まで「ギュン」と伸びる。 */
export function AnimatedStatBar({
  label,
  value,
  max,
  color = 'var(--crayon-yellow)',
  animate = true,
  big = false,
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
  animate?: boolean;
  big?: boolean;
}) {
  const pct = Math.max(2, Math.min(100, (value / max) * 100));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: big ? '5rem 1fr 2.6rem' : '4.2rem 1fr 2.3rem', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: big ? '0.95rem' : '0.82rem' }}>{label}</span>
      <span
        style={{
          height: big ? 18 : 13,
          borderRadius: 8,
          border: '2px solid var(--border)',
          background: '#fff',
          overflow: 'hidden',
        }}
      >
        <motion.span
          initial={animate ? { width: 0 } : { width: `${pct}%` }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 130, damping: 11, delay: 0.05 }}
          style={{ display: 'block', height: '100%', background: color }}
        />
      </span>
      <motion.span
        initial={animate ? { opacity: 0 } : { opacity: 1 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        style={{ fontSize: big ? '1rem' : '0.88rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}
      >
        {value}
      </motion.span>
    </div>
  );
}

export function StatBars({ stats, animate = false }: { stats: Stats; animate?: boolean }) {
  return (
    <div style={{ display: 'grid', gap: '0.35rem', width: '100%' }}>
      {(Object.keys(STAT_LABEL) as (keyof Stats)[]).map((k) => (
        <AnimatedStatBar key={k} label={STAT_LABEL[k]} value={stats[k]} max={STAT_MAX[k]} animate={animate} />
      ))}
    </div>
  );
}

/** 手描きの絵。CPUなど画像が無い場合は属性色のプレースホルダ。 */
export function CharacterSprite({
  imageUrl,
  attribute,
  name,
  style,
  flip,
}: {
  imageUrl: string | null;
  attribute: Character['attribute'];
  name: string;
  style?: CSSProperties;
  flip?: boolean;
}) {
  const meta = ATTRIBUTE_META[attribute];
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          transform: flip ? 'scaleX(-1)' : undefined,
          filter: 'drop-shadow(3px 4px 0 rgba(51,48,43,0.22))',
          ...style,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        borderRadius: '30% 70% 62% 38% / 45% 40% 60% 55%',
        border: '3px solid var(--border)',
        background: meta.color,
        color: '#fff',
        fontFamily: 'var(--font-display)',
        fontSize: '1.1rem',
        textAlign: 'center',
        padding: '0.5rem',
        ...style,
      }}
    >
      {name}
    </div>
  );
}
