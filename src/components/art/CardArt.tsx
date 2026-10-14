import { useId } from 'react';
import { MOTIFS } from './motifs';
import { PALETTES } from './palette';
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
        {/* クレヨンの ざらざら（絵ぜんたいに うすく かさねる） */}
        <filter id="crayon-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.4 0.55" numOctaves="2" seed="11" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1.6 1.05" />
        </filter>
        {/* ひかる（エネルギー・ほのお・みずの ふち） */}
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        {/* かげの ななめ線（クレヨンで ぬりつぶした かんじ） */}
        <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="#33302b" strokeWidth="1.4" opacity="0.32" />
        </pattern>
        <pattern id="hatch-w" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#fffdf5" strokeWidth="1.6" opacity="0.55" />
        </pattern>
        {/* パレットごとの 立体グラデーション（上＝あかるい → 下＝こい） */}
        {Object.entries(PALETTES).map(([k, p]) => (
          <linearGradient key={k} id={`gv-${k}`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor={p.light} />
            <stop offset="0.45" stopColor={p.main} />
            <stop offset="1" stopColor={p.dark} />
          </linearGradient>
        ))}
        {Object.entries(PALETTES).map(([k, p]) => (
          <radialGradient key={k} id={`gr-${k}`}>
            <stop offset="0" stopColor="#fffdf5" stopOpacity="0.95" />
            <stop offset="0.35" stopColor={p.light} stopOpacity="0.8" />
            <stop offset="1" stopColor={p.main} stopOpacity="0" />
          </radialGradient>
        ))}
        {/* たま（左上が ひかる 球） */}
        {Object.entries(PALETTES).map(([k, p]) => (
          <radialGradient key={k} id={`rb-${k}`} cx="0.36" cy="0.3" r="0.78">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.14" stopColor={p.light} />
            <stop offset="0.55" stopColor={p.main} />
            <stop offset="1" stopColor={p.dark} />
          </radialGradient>
        ))}
        {/* カードの 背景（まんなかが あかるく、ふちが こい） */}
        {Object.entries(PALETTES).map(([k, p]) => (
          <radialGradient key={k} id={`bgr-${k}`} cx="0.5" cy="0.45" r="0.85">
            <stop offset="0" stopColor="#fffdf5" />
            <stop offset="0.45" stopColor={p.bg2} />
            <stop offset="1" stopColor={p.dark} />
          </radialGradient>
        ))}
        <radialGradient id="fireCore">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.35" stopColor="#fff2a8" />
          <stop offset="0.75" stopColor="#ffb347" />
          <stop offset="1" stopColor="#ef5a2a" />
        </radialGradient>
        <radialGradient id="gr-white">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gv-gold" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#fff6c2" />
          <stop offset="0.4" stopColor="#f2b705" />
          <stop offset="0.7" stopColor="#b57c00" />
          <stop offset="1" stopColor="#ffe27a" />
        </linearGradient>
        <linearGradient id="gv-steel" x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#c9d3df" />
          <stop offset="1" stopColor="#7d8a99" />
        </linearGradient>
        <linearGradient id="gv-skin" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#ffe7d1" />
          <stop offset="1" stopColor="#f2b48c" />
        </linearGradient>
        <linearGradient id="gv-foe" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#d8d3e6" />
          <stop offset="1" stopColor="#8e86a6" />
        </linearGradient>
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
      <g>
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
