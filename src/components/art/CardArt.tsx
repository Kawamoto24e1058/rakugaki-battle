import { useId } from 'react';
import { MOTIFS } from './motifs';
import type { ArtSpec } from './artSpec';

/** 全カード共通のクレヨン風フィルター。画面のどこかに1回だけ置く。 */
export function CrayonDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <filter id="crayon" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" />
        </filter>
        <filter id="grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="8" />
          <feColorMatrix values="0 0 0 0 0.2  0 0 0 0 0.19  0 0 0 0 0.17  0 0 0 0.09 0" />
        </filter>
      </defs>
    </svg>
  );
}

function parse(token: string, i: number, n: number): { name: string; x: number; y: number; s: number; r: number } {
  const [name, rest] = token.split(':');
  if (rest) {
    const [x, y, s, r] = rest.split(',').map(Number);
    return { name, x, y, s, r };
  }
  // 位置の指定がないとき：1つ目は中央。2つ目以降は右上・左下に小さく。
  if (i === 0) return { name, x: 80, y: 52, s: n === 1 ? 1.15 : 1, r: 0 };
  return { name, x: i === 1 ? 128 : 34, y: i === 1 ? 28 : 72, s: 0.5, r: 0 };
}

/** カードのイラスト。viewBox は 160×100 固定で、親の幅いっぱいに広がる。 */
export function CardArt({ art }: { art: ArtSpec }) {
  const id = useId().replace(/:/g, '');
  const { pal } = art;
  return (
    <svg viewBox="0 0 160 100" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`bg${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pal.bg1} />
          <stop offset="1" stopColor={pal.bg2} />
        </linearGradient>
      </defs>
      <rect width="160" height="100" fill={`url(#bg${id})`} />
      <g filter="url(#crayon)">
        {art.motifs.map((tok, i) => {
          const m = parse(tok, i, art.motifs.length);
          const Draw = MOTIFS[m.name];
          if (!Draw) return null;
          return (
            <g key={i} transform={`translate(${m.x} ${m.y}) rotate(${m.r}) scale(${m.s})`}>
              {Draw(pal)}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
