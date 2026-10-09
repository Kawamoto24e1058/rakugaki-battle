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
        <radialGradient id={`vg${id}`} cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor={pal.dark} stopOpacity="0.28" />
        </radialGradient>
      </defs>
      <rect width="160" height="100" fill={`url(#bg${id})`} />
      {/* 背景の模様：こうげき＝放射状の光、ほじょ＝やわらかい丸 */}
      {art.attack ? (
        <g opacity={0.5}>
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} transform={`translate(80 54) rotate(${i * 30})`} d="M0,0 L-9,-90 L9,-90Z" fill={i % 2 ? pal.bg1 : pal.light} opacity={0.55} />
          ))}
        </g>
      ) : (
        <g opacity={0.55}>
          {[[18, 20, 14], [140, 80, 18], [128, 16, 8], [30, 84, 9], [84, 12, 6]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={pal.light} opacity={0.6} />
          ))}
        </g>
      )}
      {/* ため：まわりに リング */}
      {art.charge && (
        <g transform="translate(80 52)" opacity={0.9}>
          {[44, 34].map((r, i) => (
            <circle key={r} r={r} fill="none" stroke={pal.main} strokeWidth={2.4} strokeDasharray={`${5 + i * 3} 6`} opacity={0.5} />
          ))}
          {[0, 90, 180, 270].map((a) => (
            <path key={a} transform={`rotate(${a}) translate(0 -52)`} d="M-6,-6 L0,4 L6,-6Z" fill={pal.dark} opacity={0.7} />
          ))}
        </g>
      )}
      {/* 先に うごく：スピード線 */}
      {art.quick && (
        <g stroke={pal.dark} strokeWidth={2.4} strokeLinecap="round" opacity={0.4}>
          <path d="M4,26 L30,26 M2,50 L24,50 M8,74 L34,74" />
        </g>
      )}
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
      <rect width="160" height="100" fill={`url(#vg${id})`} />
      <rect width="160" height="100" filter="url(#grain)" opacity={0.9} />
      {/* 条件つき：右上のタグ */}
      {art.ribbon && (
        <g transform="translate(154 6)">
          <rect x={-(art.ribbon.length * 10 + 14)} y={0} width={art.ribbon.length * 10 + 14} height={17} rx={8} fill="#fffdf5" stroke={pal.ink} strokeWidth={1.6} />
          <text x={-(art.ribbon.length * 5 + 7)} y={12.5} textAnchor="middle" fontSize={10.5} fontWeight={900} fill={pal.dark} fontFamily="var(--font-display)">
            {art.ribbon}
          </text>
        </g>
      )}
      {/* 手札いじり：小さなカードのバッジ */}
      {art.hand && (
        <g transform="translate(6 80)">
          <rect x={0} y={0} width={40} height={16} rx={7} fill="#fffdf5" stroke={pal.ink} strokeWidth={1.6} />
          <g transform="translate(9 8) scale(0.17)">{MOTIFS.cards(pal)}</g>
          <text x={17} y={11.5} fontSize={8.5} fontWeight={900} fill={pal.dark} fontFamily="var(--font-display)">てふだ</text>
        </g>
      )}
    </svg>
  );
}
