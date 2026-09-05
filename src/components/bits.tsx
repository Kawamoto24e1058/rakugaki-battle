import type { CSSProperties } from 'react';
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
const STAT_MAX: Record<keyof Stats, number> = { hp: 200, atk: 62, def: 62, spd: 62, luck: 40, heart: 40 };

export function StatBars({ stats }: { stats: Stats }) {
  return (
    <div style={{ display: 'grid', gap: '0.35rem', width: '100%' }}>
      {(Object.keys(STAT_LABEL) as (keyof Stats)[]).map((k) => (
        <div key={k} style={{ display: 'grid', gridTemplateColumns: '4.2rem 1fr 2.3rem', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem' }}>{STAT_LABEL[k]}</span>
          <span
            style={{
              height: 13,
              borderRadius: 8,
              border: '2px solid var(--border)',
              background: '#fff',
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                display: 'block',
                height: '100%',
                width: `${Math.min(100, (stats[k] / STAT_MAX[k]) * 100)}%`,
                background: 'var(--crayon-yellow)',
              }}
            />
          </span>
          <span style={{ fontSize: '0.88rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{stats[k]}</span>
        </div>
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
