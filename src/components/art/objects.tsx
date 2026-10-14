import type { ReactNode } from 'react';
import { PALETTES, type Pal } from './palette';
import { INK, gv, gr, keyOf, Radial } from './illust';

/**
 * カードの絵の 部品（キャラなし・技の「もの」）。すっきりした 線＋グラデーション＋ひかり。
 * どれも 原点 (0,0) を 中心に 大きさ 100 くらいで 描き、<At> で 置く。
 * 動かしたい 部分には ill-* の class（.gcard-anim の中だけ CSS で 動く）。
 */
export const PAPER = '#fffdf5';
export const ink = (w = 3) => ({ stroke: INK, strokeWidth: w, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const });
export const rb = (p: Pal) => `url(#rb-${keyOf(p)})`;
export const P = PALETTES;

/** 置く（位置・回転・大きさ）。 */
export const At = ({ x = 0, y = 0, r = 0, s = 1, sx, children, o }: { x?: number; y?: number; r?: number; s?: number; sx?: number; children: ReactNode; o?: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${r}) scale(${sx ?? s} ${s})`} opacity={o}>
    {children}
  </g>
);

/** 背景：まんなかが あかるい グラデ＋集中線。 */
export const Stage = ({ p, cx = 100, cy = 76, lines = true, dark = false }: { p: Pal; cx?: number; cy?: number; lines?: boolean; dark?: boolean }) => (
  <g>
    <rect width={200} height={160} fill={`url(#bgr-${keyOf(p)})`} />
    {(dark || keyOf(p) === 'bolt') && <rect width={200} height={160} fill={keyOf(p) === 'bolt' ? '#3a2c5a' : p.dark} opacity={keyOf(p) === 'bolt' ? 0.55 : 0.45} />}
    <circle cx={cx} cy={cy} r={70} fill={gr(p)} opacity={0.7} />
    {lines && <Radial cx={cx} cy={cy} n={30} r0={24} r1={220} color={PAPER} o={dark ? 0.25 : 0.42} w={0.05} />}
  </g>
);

/** ひかるもの（うしろに ぼかしの わ）。 */
export const Halo = ({ x = 0, y = 0, r = 40, color = PAPER, o = 0.6 }: { x?: number; y?: number; r?: number; color?: string; o?: number }) => <circle cx={x} cy={y} r={r} fill={color} opacity={o} filter="url(#soft)" />;

/** 4かどの キラキラ。 */
export const Twinkle = ({ x, y, r = 6, fill = PAPER, delay = 0 }: { x: number; y: number; r?: number; fill?: string; delay?: number }) => (
  <path
    className="ill-twinkle"
    style={{ animationDelay: `${delay}s`, transformOrigin: `${x}px ${y}px`, transformBox: 'view-box' }}
    d={`M${x},${y - r} Q${x + r * 0.16},${y - r * 0.16} ${x + r},${y} Q${x + r * 0.16},${y + r * 0.16} ${x},${y + r} Q${x - r * 0.16},${y + r * 0.16} ${x - r},${y} Q${x - r * 0.16},${y - r * 0.16} ${x},${y - r}Z`}
    fill={fill}
    {...ink(1.6)}
  />
);

/** キラキラを ちらす。 */
export const Sparkles = ({ pts, fill }: { pts: [number, number, number?][]; fill?: string }) => (
  <g>
    {pts.map(([x, y, r], i) => (
      <Twinkle key={i} x={x} y={y} r={r ?? 6} fill={fill ?? (i % 2 ? PAPER : '#fff2a8')} delay={i * 0.22} />
    ))}
  </g>
);

/** しょうげき（ギザギザ 3そう＋しろい しん＋ひかり）。 */
export function Impact({ p, r = 30, points = 12, pulse = true }: { p: Pal; r?: number; points?: number; pulse?: boolean }) {
  const pts = (R: number, ri: number, jit: number) =>
    Array.from({ length: points * 2 }, (_, i) => {
      const rr = i % 2 === 0 ? R * (0.82 + (((i * 37 + jit) % 11) / 11) * 0.3) : ri;
      const a = (Math.PI * i) / points;
      return `${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`;
    }).join(' ');
  return (
    <g className={pulse ? 'ill-pulse' : undefined} style={pulse ? { transformOrigin: '0px 0px', transformBox: 'view-box' } : undefined}>
      <circle r={r * 1.2} fill={gr(p)} />
      <polygon points={pts(r, r * 0.6, 3)} fill={p.main} {...ink(2.8)} />
      <polygon points={pts(r * 0.7, r * 0.42, 7)} fill={p.light} />
      <polygon points={pts(r * 0.42, r * 0.24, 5)} fill={PAPER} />
    </g>
  );
}

/** しょうげきの わ。 */
export const Rings = ({ r = 40, color = PAPER, tilt = -24, n = 2 }: { r?: number; color?: string; tilt?: number; n?: number }) => (
  <g transform={`rotate(${tilt})`}>
    {Array.from({ length: n }, (_, i) => (
      <ellipse key={i} className="ill-pulse" style={{ animationDelay: `${i * 0.25}s`, transformOrigin: '0px 0px', transformBox: 'view-box' }} rx={r * (1 - i * 0.28)} ry={r * 0.8 * (1 - i * 0.28)} fill="none" stroke={color} strokeWidth={i ? 5 : 3.4} opacity={0.9} />
    ))}
  </g>
);

/** スピード線（右むき。At で まわす）。 */
export const Streaks = ({ n = 5, len = 60, gap = 9, color = PAPER, w = 3.4 }: { n?: number; len?: number; gap?: number; color?: string; w?: number }) => (
  <g>
    {Array.from({ length: n }, (_, i) => {
      const y = (i - (n - 1) / 2) * gap;
      const l = len * (0.6 + ((i * 37) % 5) / 10);
      return <line key={i} x1={-l} y1={y} x2={0} y2={y} stroke={color} strokeWidth={w} strokeLinecap="round" opacity={0.85} />;
    })}
  </g>
);

// ------------------------------------------------------------------ こうげき（ふつう）

/** つやつやの たま。 */
export const Ball = ({ p, r = 30 }: { p: Pal; r?: number }) => (
  <g>
    <circle cx={4} cy={5} r={r} fill={INK} opacity={0.18} />
    <circle r={r} fill={rb(p)} {...ink(3)} />
    <path d={`M${-r * 0.72},${-r * 0.3} A${r * 0.8},${r * 0.8} 0 0 1 ${r * 0.12},${-r * 0.86}`} fill="none" stroke={PAPER} strokeWidth={r * 0.16} strokeLinecap="round" opacity={0.9} />
    <ellipse cx={-r * 0.38} cy={-r * 0.46} rx={r * 0.2} ry={r * 0.12} fill="#fff" transform={`rotate(-30 ${-r * 0.38} ${-r * 0.46})`} />
  </g>
);

/** ツメの あと（3本）：いろの ついた 太い きずあと＋ひかり。 */
export const Claws = ({ p, n = 3, len = 120, color }: { p: Pal; n?: number; len?: number; color?: string }) => (
  <g>
    {Array.from({ length: n }, (_, i) => {
      const x = (i - (n - 1) / 2) * 28;
      const d = `M${x - 18},${-len / 2} C${x + 14},${-len / 4} ${x + 16},${len / 4} ${x - 4},${len / 2} C${x + 4},${len / 4} ${x - 2},${-len / 4} ${x - 18},${-len / 2}Z`;
      return (
        <g key={i}>
          <path d={d} fill={color ?? p.light} opacity={0.7} filter="url(#glow)" />
          <path d={d} fill={gv(p)} {...ink(2.8)} />
          <path d={`M${x - 10},${-len / 3} C${x + 4},${-len / 8} ${x + 6},${len / 8} ${x - 1},${len / 3}`} fill="none" stroke={PAPER} strokeWidth={3.4} strokeLinecap="round" />
        </g>
      );
    })}
  </g>
);

/** きりつけの 弧（三日月の ひかり）：いろの グラデ＋しろい ふち＋ひかり。 */
export const SlashArc = ({ p, r = 60, w = 30, color }: { p: Pal; r?: number; w?: number; color?: string }) => {
  const d = `M${-r},${r * 0.2} A${r},${r} 0 0 1 ${r},${-r * 0.2} A${r - w * 0.4},${r - w} 0 0 0 ${-r},${r * 0.2}Z`;
  return (
    <g>
      <path d={d} fill={color ?? p.light} opacity={0.75} filter="url(#glow)" />
      <path d={d} fill={gv(p)} {...ink(2.8)} />
      <path d={`M${-r * 0.8},${0} A${r * 0.92},${r * 0.92} 0 0 1 ${r * 0.7},${-r * 0.38}`} fill="none" stroke={PAPER} strokeWidth={4} strokeLinecap="round" />
    </g>
  );
};

/** けん（右上むき）。 */
export const Sword = ({ len = 110, blade = 'url(#gv-steel)', hilt }: { len?: number; blade?: string; hilt?: string }) => (
  <g>
    <path d={`M-4,${-len * 0.25} L4,${-len * 0.25} L6,${len * 0.42} L0,${len * 0.5} L-6,${len * 0.42}Z`} transform="rotate(180)" fill={INK} opacity={0.15} />
    <path d={`M-7,0 L-6,${-len * 0.62} L0,${-len * 0.75} L6,${-len * 0.62} L7,0Z`} fill={blade} {...ink(2.6)} />
    <path d={`M0,-4 L0,${-len * 0.66}`} stroke="#fff" strokeWidth={2} opacity={0.8} />
    <rect x={-20} y={-4} width={40} height={8} rx={3} fill="url(#gv-gold)" {...ink(2.4)} />
    <rect x={-4} y={4} width={8} height={len * 0.2} rx={2} fill={hilt ?? '#7a4a2a'} {...ink(2.2)} />
    <circle cx={0} cy={len * 0.24 + 6} r={5} fill="url(#gv-gold)" {...ink(2)} />
  </g>
);

/** こぶし（右むき）。 */
export const Fist = ({ p, glove = true }: { p: Pal; glove?: boolean }) => {
  const fill = glove ? gv(p) : 'url(#gv-skin)';
  return (
    <g>
      <rect x={-64} y={-16} width={28} height={34} rx={7} fill={glove ? 'url(#gv-gold)' : 'url(#gv-skin)'} {...ink(2.8)} />
      {glove && <path d="M-56,-16 L-56,18 M-46,-16 L-46,18" {...ink(2)} />}
      <path d="M-38,-12 C-38,-26 -28,-30 -16,-30 L8,-30 C18,-30 22,-24 22,-16 L22,16 C22,24 16,28 8,28 L-24,28 C-34,28 -38,22 -38,12Z" fill={fill} {...ink(3.2)} />
      {[-21, -7, 7].map((y) => (
        <path key={y} d={`M12,${y - 7} L30,${y - 7} C36,${y - 7} 38,${y - 3} 38,${y} C38,${y + 4} 36,${y + 7} 30,${y + 7} L12,${y + 7}Z`} fill={fill} {...ink(2.6)} />
      ))}
      <path d="M-10,14 C-2,8 14,10 24,15 C28,19 24,26 18,26 L-6,26 C-12,26 -14,19 -10,14Z" fill={fill} {...ink(2.6)} />
      <path d="M-28,-20 C-18,-26 -4,-26 6,-24" fill="none" stroke={PAPER} strokeWidth={4.5} strokeLinecap="round" opacity={0.8} />
    </g>
  );
};

/** キバ（下むき）。 */
export const Fang = ({ h = 60, w = 26 }: { h?: number; w?: number }) => (
  <g>
    <path d={`M${-w / 2},0 Q${-w * 0.2},${h * 0.7} 0,${h} Q${w * 0.2},${h * 0.7} ${w / 2},0Z`} fill="#f4ede0" {...ink(2.6)} />
    <path d={`M${-w * 0.25},${h * 0.08} L${-w * 0.05},${h * 0.66}`} stroke="#fff" strokeWidth={3} strokeLinecap="round" />
  </g>
);

/** つの（右上に そる）。 */
export const Horn = ({ p }: { p: Pal }) => (
  <g>
    <path d="M-30,30 C-30,-6 0,-34 40,-44 C14,-22 4,4 10,32Z" fill="url(#gv-gold)" {...ink(3)} />
    {[0, 1, 2].map((i) => (
      <path key={i} d={`M${-24 + i * 9},${18 - i * 14} C${-14 + i * 10},${14 - i * 16} ${-4 + i * 11},${18 - i * 16} ${4 + i * 10},${22 - i * 18}`} fill="none" stroke="#b57c00" strokeWidth={2.4} />
    ))}
    <path d="M-20,20 C-18,0 0,-20 26,-34" fill="none" stroke={PAPER} strokeWidth={3} opacity={0.75} strokeLinecap="round" />
    <circle cx={40} cy={-44} r={4} fill={p.light} />
  </g>
);

/** まと（ねらい）。 */
export const Target = ({ p }: { p: Pal }) => (
  <g>
    {[44, 32, 20, 9].map((r, i) => (
      <circle key={r} r={r} fill={i % 2 ? PAPER : p.main} {...ink(2.8)} />
    ))}
    <path d="M-56,0 L-36,0 M36,0 L56,0 M0,-56 L0,-36 M0,36 L0,56" {...ink(3.4)} />
  </g>
);

/** や（右むき）。 */
export const Arrow = ({ len = 100, color = '#c9d3df', fletch }: { len?: number; color?: string; fletch?: string }) => (
  <g>
    <path d={`M${-len / 2},0 L${len / 2 - 14},0`} stroke={INK} strokeWidth={8} strokeLinecap="round" />
    <path d={`M${-len / 2},0 L${len / 2 - 14},0`} stroke="#a8754a" strokeWidth={4} strokeLinecap="round" />
    <path d={`M${len / 2},0 L${len / 2 - 18},-9 L${len / 2 - 14},0 L${len / 2 - 18},9Z`} fill={color} {...ink(2.4)} />
    <path d={`M${-len / 2},0 L${-len / 2 - 6},-10 L${-len / 2 + 14},-2Z M${-len / 2},0 L${-len / 2 - 6},10 L${-len / 2 + 14},2Z`} fill={fletch ?? '#e8503a'} {...ink(2)} />
  </g>
);

/** はり（右むき）＋どくの しずく。 */
export const Needle = ({ drop }: { drop?: string }) => (
  <g>
    <path d="M-60,-3 L40,-1 L58,0 L40,1 L-60,3Z" fill="url(#gv-steel)" {...ink(2.2)} />
    <ellipse cx={-62} cy={0} rx={6} ry={8} fill="url(#gv-steel)" {...ink(2)} />
    {drop && <path d="M58,4 C62,10 64,14 62,18 A5,5 0 1 1 54,16 C54,12 56,8 58,4Z" fill={drop} {...ink(1.8)} />}
  </g>
);

/** ニンジャの かくれ玉（ふいうち）。 */
export const ShadowMask = ({ p }: { p: Pal }) => (
  <g>
    <circle r={40} fill={rb(p)} {...ink(3)} />
    <path d="M-40,-6 C-20,-14 20,-14 40,-6 L40,10 C20,4 -20,4 -40,10Z" fill={INK} />
    <path d="M-22,-2 L-8,2 M8,2 L22,-2" stroke={PAPER} strokeWidth={4} strokeLinecap="round" />
    <path d="M38,-2 C52,-10 60,-4 66,-14 M38,4 C52,4 58,12 68,8" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
  </g>
);

/** すなどけい。 */
export const Hourglass = ({ sand = '#f2b705' }: { sand?: string }) => (
  <g>
    <rect x={-30} y={-48} width={60} height={9} rx={3} fill="url(#gv-gold)" {...ink(2.6)} />
    <rect x={-30} y={39} width={60} height={9} rx={3} fill="url(#gv-gold)" {...ink(2.6)} />
    <path d="M-24,-39 L24,-39 C24,-14 6,-6 6,0 C6,6 24,14 24,39 L-24,39 C-24,14 -6,6 -6,0 C-6,-6 -24,-14 -24,-39Z" fill="#e8f6ff" opacity={0.85} {...ink(2.6)} />
    <path d="M-16,-26 L16,-26 C14,-16 4,-10 0,-4 C-4,-10 -14,-16 -16,-26Z" fill={sand} />
    <path d="M-20,36 C-16,22 -6,18 0,16 C6,18 16,22 20,36Z" fill={sand} />
    <path d="M0,-4 L0,16" stroke={sand} strokeWidth={2.4} strokeDasharray="2 3" />
    <path d="M-18,-34 L-14,-20" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
  </g>
);

/** ばくだん（タイマーつき）。 */
export const Bomb = ({ p }: { p: Pal }) => (
  <g>
    <circle r={38} fill="url(#rb-dark)" {...ink(3)} />
    <rect x={-10} y={-48} width={20} height={14} rx={3} fill="url(#gv-steel)" {...ink(2.4)} />
    <path d="M0,-48 C6,-62 20,-62 26,-56" fill="none" {...ink(3)} />
    <g transform="translate(28 -58)">
      <Twinkle x={0} y={0} r={9} fill="#ffe27a" />
    </g>
    <circle cx={4} cy={6} r={20} fill={PAPER} {...ink(2.4)} />
    <path d="M4,6 L4,-6 M4,6 L13,10" {...ink(2.6)} />
    <path d="M-24,-20 C-18,-28 -8,-32 2,-32" fill="none" stroke={p.light} strokeWidth={4} strokeLinecap="round" opacity={0.8} />
  </g>
);

/** サイコロを まわす 矢じるし（いれかえ）。 */
export const Swap = ({ p, q }: { p: Pal; q: Pal }) => (
  <g>
    <path d="M-44,-14 C-30,-46 30,-46 44,-14" fill="none" stroke={INK} strokeWidth={14} strokeLinecap="round" />
    <path d="M-44,-14 C-30,-46 30,-46 44,-14" fill="none" stroke={p.main} strokeWidth={8} strokeLinecap="round" />
    <path d="M44,-14 L30,-18 L50,-30Z" fill={p.main} {...ink(2.4)} />
    <path d="M44,14 C30,46 -30,46 -44,14" fill="none" stroke={INK} strokeWidth={14} strokeLinecap="round" />
    <path d="M44,14 C30,46 -30,46 -44,14" fill="none" stroke={q.main} strokeWidth={8} strokeLinecap="round" />
    <path d="M-44,14 L-30,18 L-50,30Z" fill={q.main} {...ink(2.4)} />
  </g>
);

// ------------------------------------------------------------------ ほのお

/** 火のたま（右むきに とぶ）。 */
export const Fireball = ({ p, s = 1, delay = 0 }: { p: Pal; s?: number; delay?: number }) => (
  <g transform={`scale(${s})`}>
    <g className="ill-flicker" style={{ animationDelay: `${delay}s`, transformOrigin: '0px 0px', transformBox: 'view-box' }}>
      <circle r={28} fill="#fff2a8" opacity={0.45} filter="url(#soft)" />
      <path d="M8,-17 C-14,-22 -30,-10 -46,-16 C-38,-8 -52,-2 -64,0 C-52,4 -40,8 -46,16 C-30,10 -14,22 8,17Z" fill={p.dark} {...ink(2.4)} />
      <path d="M6,-12 C-10,-15 -22,-7 -34,-10 C-28,-4 -38,0 -46,1 C-36,4 -28,6 -32,11 C-20,7 -10,15 6,12Z" fill={p.main} />
      <path d="M4,-7 C-6,-8 -14,-4 -22,-5 C-18,-1 -24,1 -28,2 C-20,4 -14,5 -16,8 C-8,5 -4,9 4,7Z" fill={p.light} />
      <circle cx={6} r={17} fill="url(#fireCore)" {...ink(2.4)} />
      <ellipse cx={10} cy={-6} rx={5} ry={3.4} fill="#fff" />
    </g>
  </g>
);

/** たつ ほのお（上むき）。 */
export const Blaze = ({ p, s = 1, delay = 0 }: { p: Pal; s?: number; delay?: number }) => (
  <g transform={`scale(${s})`}>
    <g className="ill-flicker" style={{ animationDelay: `${delay}s`, transformOrigin: '0px 30px', transformBox: 'view-box' }}>
      <path d="M0,-50 C10,-30 34,-22 32,4 C30,26 16,34 0,34 C-18,34 -32,24 -32,6 C-32,-12 -18,-16 -14,-34 C-8,-24 -4,-20 0,-50Z" fill={p.dark} {...ink(2.8)} />
      <path d="M0,-34 C8,-18 24,-10 23,8 C22,22 12,28 0,28 C-13,28 -23,22 -23,10 C-23,-4 -12,-8 -8,-20 C-4,-14 -2,-12 0,-34Z" fill={p.main} />
      <path d="M0,-12 C6,-2 14,4 13,14 C12,22 6,25 0,25 C-7,25 -13,22 -13,15 C-13,7 -5,4 0,-12Z" fill={p.light} />
      <ellipse cx={0} cy={18} rx={6} ry={8} fill="#fff6d0" />
    </g>
  </g>
);

/** ほのおの うず。 */
export const FireSwirl = ({ p }: { p: Pal }) => (
  <g>
    <g className="ill-spin" style={{ transformOrigin: '0px 0px', transformBox: 'view-box' }}>
      {[0, 120, 240].map((a, i) => (
        <g key={a} transform={`rotate(${a})`}>
          <path d="M0,0 C20,-6 40,-24 44,-50 C30,-34 16,-22 0,-20Z" fill={i % 2 ? p.light : p.main} {...ink(2.6)} />
        </g>
      ))}
    </g>
    <circle r={16} fill="url(#fireCore)" {...ink(2.4)} />
  </g>
);

// ------------------------------------------------------------------ みず

/** 水の いきおい（右上むきの 太い ながれ）。 */
export const Jet = ({ p, len = 180, w = 40 }: { p: Pal; len?: number; w?: number }) => (
  <g>
    <g filter="url(#glow)">
      <path d={`M${-len / 2},${w / 2} C${-len / 4},${w / 2} ${len / 4},${w * 0.3} ${len / 2},${w * 0.25} L${len / 2},${-w * 0.25} C${len / 4},${-w * 0.3} ${-len / 4},${-w / 2} ${-len / 2},${-w / 2}Z`} fill={gv(p)} {...ink(3.2)} />
    </g>
    <path d={`M${-len / 2 + 6},${-w * 0.42} q8,-6 16,-3 q8,-6 16,-3 q8,-6 16,-3 q8,-6 16,-3 q8,-5 16,-3 q8,-5 16,-2 q8,-5 16,-2 q8,-4 16,-2 q8,-4 16,-2 q8,-4 16,-2`} fill="none" stroke={PAPER} strokeWidth={3} strokeLinecap="round" />
    <path d={`M${-len / 2 + 4},0 L${len / 2 - 4},0`} stroke={PAPER} strokeWidth={w * 0.22} strokeLinecap="round" opacity={0.8} />
    <path className="ill-flow" d={`M${-len / 2 + 4},${w * 0.24} L${len / 2 - 4},${w * 0.12}`} stroke={p.light} strokeWidth={4} strokeDasharray="16 12" strokeLinecap="round" />
  </g>
);

/** しぶきの おうかん（上むき）。 */
export const Splash = ({ p, s = 1 }: { p: Pal; s?: number }) => (
  <g transform={`scale(${s})`}>
    <path d="M-30,10 L-38,-18 L-20,0 L-16,-36 L-4,-4 L6,-40 L12,-2 L30,-24 L28,10Z" fill={p.light} {...ink(2.6)} />
    <path d="M-16,4 L-12,-20 M6,0 L8,-24" stroke={PAPER} strokeWidth={2.4} strokeLinecap="round" />
    <ellipse cx={-2} cy={10} rx={32} ry={9} fill={PAPER} {...ink(2.4)} />
  </g>
);

/** しずく。 */
export const Drip = ({ x, y, r = 6, p, delay = 0 }: { x: number; y: number; r?: number; p: Pal; delay?: number }) => (
  <g className="ill-float" style={{ animationDelay: `${delay}s` }}>
    <path d={`M${x},${y - r * 1.9} C${x + r * 0.5},${y - r * 0.9} ${x + r},${y - r * 0.3} ${x + r},${y + r * 0.2} A${r},${r} 0 1 1 ${x - r},${y + r * 0.2} C${x - r},${y - r * 0.3} ${x - r * 0.5},${y - r * 0.9} ${x},${y - r * 1.9}Z`} fill={p.light} {...ink(1.8)} />
    <ellipse cx={x - r * 0.35} cy={y} rx={r * 0.22} ry={r * 0.38} fill={PAPER} />
  </g>
);

/** 大なみ（右に くずれる）。 */
export const Wave = ({ p }: { p: Pal }) => (
  <g>
    <path d="M-90,40 C-70,20 -40,-30 10,-44 C50,-54 80,-30 74,-6 C68,14 44,14 40,0 C36,-12 50,-18 56,-10 C50,-34 10,-30 -10,-4 C-26,18 -40,32 -50,40Z" fill={gv(p)} {...ink(3)} />
    <path d="M-60,32 C-40,4 -10,-30 20,-38" fill="none" stroke={PAPER} strokeWidth={5} strokeLinecap="round" opacity={0.8} />
    <path d="M40,-46 q8,-8 14,-2 q6,-8 12,0" fill="none" stroke={PAPER} strokeWidth={3.4} strokeLinecap="round" />
    <path d="M-90,40 L60,40" {...ink(3)} />
  </g>
);

/** つらら（下むき）。 */
export const Icicle = ({ h = 70, w = 22 }: { h?: number; w?: number }) => (
  <g>
    <path d={`M${-w / 2},0 L${w / 2},0 L2,${h} L-2,${h}Z`} fill="url(#gv-water)" {...ink(2.4)} />
    <path d={`M${-w * 0.25},4 L-1,${h * 0.8}`} stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.9} />
  </g>
);

/** あわ。 */
export const Bubble = ({ x, y, r, delay = 0 }: { x: number; y: number; r: number; delay?: number }) => (
  <g className="ill-float" style={{ animationDelay: `${delay}s` }}>
    <circle cx={x} cy={y} r={r} fill="#e9f8ff" opacity={0.45} stroke={INK} strokeWidth={1.8} />
    <path d={`M${x - r * 0.5},${y - r * 0.2} A${r * 0.6},${r * 0.6} 0 0 1 ${x - r * 0.1},${y - r * 0.6}`} fill="none" stroke="#fff" strokeWidth={r * 0.2} strokeLinecap="round" />
  </g>
);

/** うず（らせん）。 */
export const Spiral = ({ color, w = 6, turns = 3, r = 50 }: { color: string; w?: number; turns?: number; r?: number }) => {
  const pts: string[] = [];
  for (let t = 0; t <= turns * Math.PI * 2; t += 0.2) {
    const rr = (t / (turns * Math.PI * 2)) * r;
    pts.push(`${(Math.cos(t) * rr).toFixed(1)},${(Math.sin(t) * rr * 0.75).toFixed(1)}`);
  }
  return (
    <g className="ill-spin" style={{ transformOrigin: '0px 0px', transformBox: 'view-box' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={INK} strokeWidth={w + 4} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
};

/** ゆげ・けむりの もくもく。 */
export const Puff = ({ color = PAPER, s = 1 }: { color?: string; s?: number }) => (
  <g transform={`scale(${s})`}>
    <path d="M-36,12 C-48,12 -50,-6 -36,-8 C-36,-26 -12,-28 -6,-16 C2,-34 30,-30 28,-10 C44,-12 46,12 30,12Z" fill={color} {...ink(2.6)} />
    <path d="M-30,6 C-12,12 12,12 26,6" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
  </g>
);

// ------------------------------------------------------------------ き

/** つる（うねうね・は・とげ）。points は 通り道。 */
export const Vine = ({ p, d, thorns = false, leaves = 3 }: { p: Pal; d: string; thorns?: boolean; leaves?: number }) => (
  <g>
    <path d={d} fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round" />
    <path d={d} fill="none" stroke={p.main} strokeWidth={8} strokeLinecap="round" />
    <path d={d} fill="none" stroke={p.light} strokeWidth={2.4} strokeLinecap="round" strokeDasharray="10 14" />
    {thorns && <path d={d} fill="none" stroke={INK} strokeWidth={16} strokeDasharray="0 18" strokeLinecap="square" opacity={0.85} />}
    {leaves > 0 && null}
  </g>
);

/** は。 */
export const Leaf = ({ p, s = 1 }: { p: Pal; s?: number }) => (
  <g transform={`scale(${s})`}>
    <path d="M0,-24 C18,-12 18,12 0,24 C-18,12 -18,-12 0,-24Z" fill={gv(p)} {...ink(2.4)} />
    <path d="M0,-20 L0,20 M0,-6 L8,-12 M0,4 L-8,-2 M0,12 L7,6" {...ink(1.8)} />
  </g>
);

/** たね。 */
export const Seed = ({ s = 1 }: { s?: number }) => (
  <g transform={`scale(${s})`}>
    <ellipse rx={10} ry={14} fill="url(#gv-gold)" {...ink(2.2)} />
    <path d="M-3,-8 C-5,-2 -5,4 -3,8" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
  </g>
);

/** め（ふたば）。 */
export const Sprout = ({ p }: { p: Pal }) => (
  <g>
    <path d="M0,30 C0,10 -2,0 0,-10" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
    <path d="M0,30 C0,10 -2,0 0,-10" fill="none" stroke={p.main} strokeWidth={5} strokeLinecap="round" />
    <path d="M0,-10 C-10,-30 -36,-30 -40,-16 C-30,-6 -10,-6 0,-10Z" fill={gv(p)} {...ink(2.4)} />
    <path d="M0,-10 C10,-34 38,-36 42,-20 C32,-8 10,-6 0,-10Z" fill={gv(p)} {...ink(2.4)} />
  </g>
);

/** どくの けむり（むらさきの もくもく）。 */
export const PoisonCloud = ({ s = 1 }: { s?: number }) => (
  <g transform={`scale(${s})`}>
    <Puff color="#c7a4ff" />
    {[
      [-14, -2],
      [6, -10],
      [18, 2],
    ].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r={3.4} fill="#7a3fc0" />
    ))}
  </g>
);

// ------------------------------------------------------------------ かみなり

/** いなずま（上から下）。 */
export const Bolt = ({ s = 1, glow = true }: { s?: number; glow?: boolean }) => (
  <g transform={`scale(${s})`}>
    {glow && <path d="M6,-62 L-24,-2 L0,-2 L-16,62 L30,-14 L6,-14 L28,-62Z" fill="#fff07a" opacity={0.75} filter="url(#glow)" />}
    <path d="M6,-62 L-24,-2 L0,-2 L-16,62 L30,-14 L6,-14 L28,-62Z" fill="url(#gv-bolt)" {...ink(3.4)} />
    <path d="M10,-54 L-12,-8" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" />
  </g>
);

/** でんきの たま（ビリビリ）。 */
export const SparkBall = ({ r = 24 }: { r?: number }) => (
  <g>
    <circle r={r * 1.6} fill="url(#gr-bolt)" />
    <circle r={r} fill="url(#rb-bolt)" {...ink(2.6)} />
    {Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2;
      const x1 = Math.cos(a) * r;
      const y1 = Math.sin(a) * r;
      return <path key={i} d={`M${x1},${y1} l${Math.cos(a) * 10 + 4},${Math.sin(a) * 10 - 4} l-6,2 l${Math.cos(a) * 10},${Math.sin(a) * 10}`} fill="none" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />;
    })}
  </g>
);

/** かみなりぐも。 */
export const StormCloud = ({ s = 1 }: { s?: number }) => (
  <g transform={`scale(${s})`}>
    <Puff color="#8e86a6" />
    <path d="M-30,6 C-12,12 12,12 26,6" fill="none" stroke="#5a5470" strokeWidth={3} strokeLinecap="round" />
  </g>
);

// ------------------------------------------------------------------ やみ

/** 三日月。 */
export const Crescent = ({ p, r = 40 }: { p: Pal; r?: number }) => (
  <g>
    <circle r={r * 1.3} fill={gr(p)} />
    <path d={`M${r * 0.2},${-r} A${r},${r} 0 1 0 ${r * 0.9},${r * 0.5} A${r * 0.78},${r * 0.78} 0 1 1 ${r * 0.2},${-r}Z`} fill="url(#gv-gold)" {...ink(2.8)} />
  </g>
);

/** かげの もや（ゆらゆら）。 */
export const Wisp = ({ p, s = 1 }: { p: Pal; s?: number }) => (
  <g transform={`scale(${s})`}>
    <g className="ill-float">
      <path d="M-30,30 C-40,0 -20,-20 -10,-40 C-6,-20 10,-26 14,-44 C22,-20 40,-6 30,30 C20,22 10,34 0,26 C-10,34 -20,22 -30,30Z" fill={gv(p)} {...ink(2.6)} />
      <ellipse cx={-6} cy={-2} rx={4} ry={6} fill="#fff" />
      <ellipse cx={10} cy={-2} rx={4} ry={6} fill="#fff" />
    </g>
  </g>
);

/** ブラックホール。 */
export const Vortex = ({ p }: { p: Pal }) => (
  <g>
    <circle r={58} fill={gr(p)} />
    <Spiral color={p.light} w={6} turns={3} r={54} />
    <circle r={14} fill="#120a24" {...ink(2.4)} />
  </g>
);

/** ぎょろっとした 目。 */
export const Eye = ({ p, angry = false }: { p: Pal; angry?: boolean }) => (
  <g>
    <path d="M-56,0 C-30,-34 30,-34 56,0 C30,34 -30,34 -56,0Z" fill={PAPER} {...ink(3)} />
    <circle r={22} fill={rb(p)} {...ink(2.4)} />
    <circle r={10} fill={INK} />
    <circle cx={-6} cy={-7} r={5} fill="#fff" />
    {angry && <path d="M-56,-30 L40,-46" stroke={INK} strokeWidth={8} strokeLinecap="round" />}
  </g>
);

/** おんぷ。 */
export const Note = ({ color }: { color: string }) => (
  <g>
    <ellipse cx={-8} cy={14} rx={11} ry={8} fill={color} transform="rotate(-20 -8 14)" {...ink(2.4)} />
    <path d="M2,12 L2,-26 C10,-22 18,-18 20,-8" fill="none" {...ink(3.4)} />
  </g>
);

// ------------------------------------------------------------------ ほじょ

/** たて。 */
export const Shield = ({ face }: { face: Pal }) => (
  <g>
    <path d="M-44,-58 L44,-58 L44,0 C44,34 22,54 0,68 C-22,54 -44,34 -44,0Z" fill={INK} opacity={0.18} transform="translate(5 6)" />
    <path d="M-44,-58 L44,-58 L44,0 C44,34 22,54 0,68 C-22,54 -44,34 -44,0Z" fill="url(#gv-gold)" {...ink(3.6)} />
    <path d="M-34,-48 L34,-48 L34,-2 C34,26 17,42 0,54 C-17,42 -34,26 -34,-2Z" fill={gv(face)} {...ink(2.6)} />
    <path d="M-28,-42 L-6,-42 L-28,10Z" fill="#fff" opacity={0.35} />
    <path d="M0,-30 L8,-12 L28,-12 L12,0 L18,20 L0,8 L-18,20 L-12,0 L-28,-12 L-8,-12Z" fill="url(#gv-gold)" {...ink(2.4)} />
  </g>
);

/** バリア（ろっかくの ドーム）。 */
export const Barrier = ({ p, r = 70 }: { p: Pal; r?: number }) => (
  <g className="ill-pulse" style={{ transformOrigin: '0px 0px', transformBox: 'view-box' }}>
    <circle r={r} fill={p.light} opacity={0.3} />
    {Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2;
      const x = Math.cos(a) * r * 0.62;
      const y = Math.sin(a) * r * 0.62;
      return <polygon key={i} points={Array.from({ length: 6 }, (_, k) => `${x + Math.cos((k / 6) * Math.PI * 2) * r * 0.22},${y + Math.sin((k / 6) * Math.PI * 2) * r * 0.22}`).join(' ')} fill="none" stroke={PAPER} strokeWidth={2.4} />;
    })}
    <circle r={r} fill="none" stroke={PAPER} strokeWidth={3.4} />
  </g>
);

/** ハート。 */
export const Heart = ({ s = 1, fill = '#ff6f8c', delay = 0 }: { s?: number; fill?: string; delay?: number }) => (
  <g transform={`scale(${s})`}>
    <g className="ill-float" style={{ animationDelay: `${delay}s` }}>
      <path d="M0,22 C-34,0 -27,-26 -12,-26 C-3,-26 0,-19 0,-15 C0,-19 3,-26 12,-26 C27,-26 34,0 0,22Z" fill={fill} {...ink(2.8)} />
      <path d="M-15,-15 C-10,-19 -5,-17 -3,-14" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" />
    </g>
  </g>
);

/** プラス。 */
export const Plus = ({ x, y, s = 1, color, delay = 0 }: { x: number; y: number; s?: number; color: string; delay?: number }) => (
  <g className="ill-float" style={{ animationDelay: `${delay}s` }} transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-10,0 L10,0 M0,-10 L0,10" stroke={INK} strokeWidth={9} strokeLinecap="round" />
    <path d="M-10,0 L10,0 M0,-10 L0,10" stroke={color} strokeWidth={5} strokeLinecap="round" />
  </g>
);

/** うえ／したの やじるし（つよく・よわく）。 */
export const BigArrow = ({ color, down = false }: { color: string; down?: boolean }) => (
  <g transform={down ? 'rotate(180)' : undefined}>
    <path d="M0,-56 L40,-10 L16,-10 L16,50 L-16,50 L-16,-10 L-40,-10Z" fill={color} {...ink(3.2)} />
    <path d="M0,-44 L28,-14" stroke="#fff" strokeWidth={4} strokeLinecap="round" opacity={0.7} />
  </g>
);

/** おにぎり。 */
export const Onigiri = () => (
  <g>
    <path d="M0,-44 C16,-44 46,4 46,22 C46,38 34,44 0,44 C-34,44 -46,38 -46,22 C-46,4 -16,-44 0,-44Z" fill="#fffdf8" {...ink(3)} />
    <rect x={-26} y={14} width={52} height={30} rx={4} fill="#2f4a3a" {...ink(2.6)} />
    <path d="M-18,-20 C-12,-30 -6,-34 0,-36" fill="none" stroke="#eee6d6" strokeWidth={4} strokeLinecap="round" />
    {[
      [-10, 0],
      [8, -10],
      [14, 6],
    ].map(([x, y], i) => (
      <ellipse key={i} cx={x} cy={y} rx={2.4} ry={1.4} fill="#e8e0cc" />
    ))}
  </g>
);

/** おちゃ（ひとやすみ）。 */
export const Tea = ({ p }: { p: Pal }) => (
  <g>
    <path d="M-34,-10 L34,-10 L28,34 C26,42 -26,42 -28,34Z" fill={gv(p)} {...ink(3)} />
    <ellipse cx={0} cy={-10} rx={34} ry={8} fill="#b9d98a" {...ink(2.6)} />
    <path d="M34,0 C50,0 50,22 30,22" fill="none" {...ink(3)} />
    {[-14, 0, 14].map((x, i) => (
      <path key={x} className="ill-float" style={{ animationDelay: `${i * 0.3}s` }} d={`M${x},-24 C${x - 6},-32 ${x + 6},-38 ${x},-48`} fill="none" stroke={PAPER} strokeWidth={4} strokeLinecap="round" />
    ))}
  </g>
);

/** おべんとう。 */
export const Bento = () => (
  <g>
    <rect x={-50} y={-30} width={100} height={64} rx={10} fill="#c0392b" {...ink(3)} />
    <rect x={-42} y={-22} width={84} height={48} rx={6} fill="#fffdf5" {...ink(2)} />
    <path d="M0,-22 L0,26" {...ink(2)} />
    <circle cx={-22} cy={2} r={12} fill="#fffdf8" {...ink(2)} />
    <circle cx={-22} cy={2} r={4} fill="#e8503a" />
    <ellipse cx={14} cy={-6} rx={10} ry={7} fill="#f2b705" {...ink(2)} />
    <path d="M10,10 C14,4 24,4 28,10 C24,18 14,18 10,10Z" fill="#2fa862" {...ink(2)} />
  </g>
);

/** つばさ。 */
export const Wing = ({ p }: { p: Pal }) => (
  <g>
    <path d="M-40,20 C-40,-20 0,-50 50,-40 C30,-30 40,-20 20,-14 C36,-10 30,0 12,2 C24,8 16,16 0,16 C6,24 -10,30 -40,20Z" fill={gv(p)} {...ink(3)} />
    <path d="M-30,10 C-20,-14 8,-30 36,-34" fill="none" stroke={PAPER} strokeWidth={3.4} strokeLinecap="round" opacity={0.8} />
  </g>
);

/** ほし（ねがい）。 */
export const Star = ({ fill = 'url(#gv-gold)', r = 40 }: { fill?: string; r?: number }) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    return `${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`;
  }).join(' ');
  return (
    <g>
      <polygon points={pts} fill={fill} {...ink(3)} />
      <path d={`M${-r * 0.22},${-r * 0.5} L${-r * 0.06},${-r * 0.8}`} stroke="#fff" strokeWidth={4} strokeLinecap="round" />
    </g>
  );
};

/** おまもり。 */
export const Charm = ({ p }: { p: Pal }) => (
  <g>
    <path d="M-30,-40 C-30,-50 30,-50 30,-40 L30,46 L-30,46Z" fill={gv(p)} {...ink(3)} />
    <path d="M-12,-54 C-12,-70 12,-70 12,-54" fill="none" {...ink(3.4)} />
    <rect x={-16} y={-24} width={32} height={46} rx={4} fill={PAPER} {...ink(2)} />
    <path d="M0,-14 L0,12 M-8,-4 L8,-4" {...ink(3)} />
    <path d="M-22,-36 L-22,30" stroke="#fff" strokeWidth={3} opacity={0.5} strokeLinecap="round" />
  </g>
);

/** くさり（ふうじ）。 */
export const Chain = () => (
  <g>
    {[-60, -30, 0, 30, 60].map((x, i) => (
      <ellipse key={x} cx={x} cy={0} rx={18} ry={9} fill="none" stroke={INK} strokeWidth={9} transform={`rotate(${i % 2 ? 0 : 0} ${x} 0)`} />
    ))}
    {[-60, -30, 0, 30, 60].map((x) => (
      <ellipse key={x} cx={x} cy={0} rx={18} ry={9} fill="none" stroke="url(#gv-steel)" strokeWidth={5} />
    ))}
  </g>
);

/** かぎ（じょう）。 */
export const Lock = () => (
  <g>
    <path d="M-18,-10 L-18,-28 C-18,-48 18,-48 18,-28 L18,-10" fill="none" stroke={INK} strokeWidth={11} />
    <path d="M-18,-10 L-18,-28 C-18,-48 18,-48 18,-28 L18,-10" fill="none" stroke="url(#gv-steel)" strokeWidth={6} />
    <rect x={-30} y={-12} width={60} height={46} rx={8} fill="url(#gv-gold)" {...ink(3)} />
    <circle cy={6} r={6} fill={INK} />
    <path d="M0,8 L0,22" stroke={INK} strokeWidth={5} strokeLinecap="round" />
  </g>
);

/** かがみ（まねっこ）。 */
export const Mirror = ({ p }: { p: Pal }) => (
  <g>
    <ellipse rx={38} ry={48} fill="url(#gv-gold)" {...ink(3)} />
    <ellipse rx={29} ry={39} fill={gv(p)} {...ink(2)} />
    <path d="M-16,-26 L-4,-34 M-20,-12 L4,-30" stroke="#fff" strokeWidth={4} strokeLinecap="round" opacity={0.8} />
    <rect x={-6} y={46} width={12} height={22} rx={3} fill="url(#gv-gold)" {...ink(2.4)} />
  </g>
);

/** コイン。 */
export const Coin = ({ face = '★' }: { face?: string }) => (
  <g>
    <ellipse rx={40} ry={40} fill="#b57c00" transform="translate(4 4)" {...ink(3)} />
    <circle r={40} fill="url(#gv-gold)" {...ink(3)} />
    <circle r={30} fill="none" stroke="#b57c00" strokeWidth={3} />
    <text y={12} textAnchor="middle" fontSize={34} fontWeight={900} fill="#b57c00" fontFamily="var(--font-display)">
      {face}
    </text>
    <path d="M-24,-22 A32,32 0 0 1 0,-32" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" />
  </g>
);

/** プレゼントの はこ。 */
export const Gift = ({ p }: { p: Pal }) => (
  <g>
    <rect x={-40} y={-16} width={80} height={56} rx={4} fill={gv(p)} {...ink(3)} />
    <rect x={-46} y={-30} width={92} height={18} rx={4} fill={gv(p)} {...ink(3)} />
    <rect x={-8} y={-30} width={16} height={70} fill="url(#gv-gold)" {...ink(2.4)} />
    <path d="M0,-30 C-20,-56 -40,-40 -20,-32Z M0,-30 C20,-56 40,-40 20,-32Z" fill="url(#gv-gold)" {...ink(2.4)} />
  </g>
);

/** まきびし。 */
export const Caltrop = ({ s = 1 }: { s?: number }) => (
  <g transform={`scale(${s})`}>
    <path d="M0,-18 L5,-2 L18,6 L2,4 L-4,18 L-4,2 L-18,-4 L-2,-4Z" fill="url(#gv-steel)" {...ink(2.2)} />
  </g>
);

/** てを あわせる（いのり）。 */
export const PrayHands = () => (
  <g>
    <path d="M-2,-50 C-14,-40 -26,-10 -28,20 L-34,40 L-2,40Z" fill="url(#gv-skin)" {...ink(3)} />
    <path d="M2,-50 C14,-40 26,-10 28,20 L34,40 L2,40Z" fill="url(#gv-skin)" {...ink(3)} />
    <path d="M-12,-20 L-12,10 M12,-20 L12,10" stroke={INK} strokeWidth={1.8} opacity={0.4} />
  </g>
);

/** でんきゅう（ひらめき）。 */
export const Bulb = () => (
  <g>
    <circle r={50} fill="url(#gr-bolt)" />
    <path d="M0,-40 C24,-40 36,-20 30,0 C26,12 14,16 14,28 L-14,28 C-14,16 -26,12 -30,0 C-36,-20 -24,-40 0,-40Z" fill="#fff6c2" {...ink(3)} />
    <rect x={-14} y={28} width={28} height={16} rx={3} fill="url(#gv-steel)" {...ink(2.4)} />
    <path d="M-8,18 L-4,-6 L4,4 L8,-6 L8,18" fill="none" stroke="#e0a90c" strokeWidth={2.6} />
    <path d="M-18,-22 C-14,-30 -6,-32 0,-32" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" />
  </g>
);

/** メガホン（ほえる・ちょうはつ）＋ おとの なみ。 */
export const Roar = ({ p }: { p: Pal }) => (
  <g>
    <path d="M-50,-12 L-10,-30 L-10,30 L-50,12Z" fill={gv(p)} {...ink(3)} />
    <rect x={-60} y={-12} width={12} height={24} rx={3} fill="url(#gv-steel)" {...ink(2.4)} />
    {[14, 30, 46].map((r, i) => (
      <path key={r} className="ill-pulse" style={{ animationDelay: `${i * 0.2}s`, transformOrigin: '-10px 0px', transformBox: 'view-box' }} d={`M${-10 + r * 0.3},${-r} A${r},${r} 0 0 1 ${-10 + r * 0.3},${r}`} fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
    ))}
  </g>
);

/** カード（てふだ）。 */
export const MiniCard = ({ p, mark }: { p: Pal; mark?: ReactNode }) => (
  <g>
    <rect x={-22} y={-30} width={44} height={60} rx={6} fill={gv(p)} {...ink(2.6)} />
    <rect x={-16} y={-24} width={32} height={48} rx={4} fill={PAPER} opacity={0.85} />
    {mark}
  </g>
);

/** ためる オーラ（もえあがる わ）。 */
export const Aura = ({ p, r = 56 }: { p: Pal; r?: number }) => (
  <g>
    <circle r={r} fill={gr(p)} />
    {Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return <path key={i} className="ill-flicker" style={{ animationDelay: `${i * 0.08}s`, transformOrigin: `${Math.cos(a) * r * 0.7}px ${Math.sin(a) * r * 0.7}px`, transformBox: 'view-box' }} d={`M${Math.cos(a) * r * 0.6},${Math.sin(a) * r * 0.6} L${Math.cos(a + 0.12) * r},${Math.sin(a + 0.12) * r} L${Math.cos(a - 0.12) * r},${Math.sin(a - 0.12) * r}Z`} fill={p.light} opacity={0.8} />;
    })}
  </g>
);

/** たいよう。 */
export const Sun = () => (
  <g>
    <circle r={60} fill="url(#gr-bolt)" />
    {Array.from({ length: 12 }, (_, i) => (
      <path key={i} transform={`rotate(${i * 30})`} d="M-6,-34 L0,-54 L6,-34Z" fill="#ffb347" {...ink(2.2)} />
    ))}
    <circle r={30} fill="url(#rb-bolt)" {...ink(3)} />
  </g>
);

/** あめ（ななめの しずく 線）。 */
export const Rain = ({ color = '#2f7dd1' }: { color?: string }) => (
  <g>
    {Array.from({ length: 14 }, (_, i) => {
      const x = -90 + ((i * 53) % 180);
      const y = -50 + ((i * 37) % 100);
      return (
        <g key={i} className="ill-float" style={{ animationDelay: `${(i % 5) * 0.2}s` }}>
          <line x1={x} y1={y} x2={x - 8} y2={y + 22} stroke={INK} strokeWidth={6} strokeLinecap="round" />
          <line x1={x} y1={y} x2={x - 8} y2={y + 22} stroke={color} strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    })}
  </g>
);

/** むすびめ（みちづれ）＝ 2つの わが つながる。 */
export const Bond = ({ p, q }: { p: Pal; q: Pal }) => (
  <g>
    <circle cx={-22} r={30} fill="none" stroke={INK} strokeWidth={13} />
    <circle cx={-22} r={30} fill="none" stroke={p.main} strokeWidth={8} />
    <circle cx={22} r={30} fill="none" stroke={INK} strokeWidth={13} />
    <circle cx={22} r={30} fill="none" stroke={q.main} strokeWidth={8} />
    <path d="M-22,-30 A30,30 0 0 1 8,0" fill="none" stroke={p.main} strokeWidth={8} />
  </g>
);

export const Fire = P.fire;
export const Water = P.water;
export const Wood = P.wood;
export const Elec = P.bolt;
export const Dark = P.dark;
export const Atk = P.atk;
export const Sup = P.sup;
