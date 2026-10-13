import type { ReactElement } from 'react';

/** カードの 左上の 属性マーク（まるい メダルの 中の 絵）。viewBox -12..12。 */
export type EmblemKind = 'fire' | 'water' | 'wood' | 'bolt' | 'dark' | 'atk' | 'sup' | 'kosei' | 'special';

const INK = '#33302b';
const W = '#fffdf5';
const s = { stroke: INK, strokeWidth: 1.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

const ICON: Record<EmblemKind, ReactElement> = {
  fire: (
    <g>
      <path d="M0,-9 C3,-4 8,-2 7,3 C6,7 3,9 0,9 C-4,9 -7,7 -7,3 C-7,-1 -3,-3 -2,-7 C-1,-5 -1,-4 0,-9Z" fill="#ffb347" {...s} />
      <path d="M0,-1 C2,1 4,3 3,5 C3,7 1,8 0,8 C-2,8 -3,7 -3,5 C-3,3 -1,2 0,-1Z" fill={W} />
    </g>
  ),
  water: (
    <g>
      <path d="M0,-9 C3,-4 7,-1 7,3 A7,7 0 1 1 -7,3 C-7,-1 -3,-4 0,-9Z" fill="#a5d4ff" {...s} />
      <ellipse cx={-2.5} cy={3} rx={1.4} ry={2.4} fill={W} />
    </g>
  ),
  wood: (
    <g>
      <path d="M-7,7 C-8,-3 0,-9 8,-8 C8,1 2,8 -7,7Z" fill="#b4e69a" {...s} />
      <path d="M-6,6 L4,-4" {...s} fill="none" />
    </g>
  ),
  bolt: <path d="M2,-10 L-6,1 L-1,1 L-3,10 L6,-2 L1,-2Z" fill="#fff07a" {...s} />,
  dark: (
    <g>
      <path d="M3,-8 A8,8 0 1 0 6,6 A6,6 0 1 1 3,-8Z" fill="#c8baff" {...s} />
      <circle cx={6} cy={-5} r={1.2} fill={W} />
    </g>
  ),
  atk: (
    <g>
      <rect x={-7} y={-6} width={11} height={12} rx={3.5} fill="#ffb7a2" {...s} />
      {[-4, 0, 4].map((y) => (
        <rect key={y} x={2} y={y - 2} width={6} height={4} rx={2} fill="#ffb7a2" {...s} />
      ))}
    </g>
  ),
  sup: <path d="M-3,-8 L3,-8 L3,-3 L8,-3 L8,3 L3,3 L3,8 L-3,8 L-3,3 L-8,3 L-8,-3 L-3,-3Z" fill="#aeeccd" {...s} />,
  kosei: <path d="M0,-9 L2.6,-3 L9,-2.8 L4,1.4 L5.6,8 L0,4.4 L-5.6,8 L-4,1.4 L-9,-2.8 L-2.6,-3Z" fill="#ffe08a" {...s} />,
  special: (
    <g>
      {['#ff8a8a', '#ffd36e', '#9be59b', '#8ac6ff'].map((c, i) => (
        <path key={c} d={`M${-8 + i * 1.6},5 A${8 - i * 1.6},${8 - i * 1.6} 0 0 1 ${8 - i * 1.6},5`} fill="none" stroke={c} strokeWidth={2} />
      ))}
      <path d="M-8,5 A8,8 0 0 1 8,5" fill="none" {...s} />
    </g>
  ),
};

export function Emblem({ kind }: { kind: EmblemKind }) {
  return (
    <svg viewBox="-12 -12 24 24" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
      {ICON[kind]}
    </svg>
  );
}
