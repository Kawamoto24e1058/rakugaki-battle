import type { ReactElement } from 'react';
import type { Pal } from './palette';

/**
 * カードのイラスト用モチーフ。どれも原点(0,0)を中心に ±40 くらいの大きさで描く。
 * 太い黒の線＋ベタ塗り＋ハイライトの「クレヨン風」。揺らぎは CrayonDefs のフィルターが足す。
 */
type Draw = (p: Pal) => ReactElement;

const S = (p: Pal, w = 2.4) => ({ stroke: p.ink, strokeWidth: w, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const });
const WHITE = '#fffdf5';

const star = (r1: number, r2: number, n: number, rot = 0) => {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const a = (Math.PI * i) / n + rot;
    pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(' ');
};

export const MOTIFS: Record<string, Draw> = {
  // ---------- こうげき：動き ----------
  burst: (p) => (
    <g>
      <polygon points={star(42, 24, 10, 0.1)} fill={p.light} {...S(p)} />
      <polygon points={star(26, 14, 10, 0.3)} fill={WHITE} {...S(p, 1.6)} />
    </g>
  ),
  claw: (p) => (
    <g>
      <polygon points={star(40, 25, 9, 0.2)} fill={p.light} opacity={0.65} />
      {[-24, 0, 24].map((dx, i) => (
        <path key={i} transform={`translate(${dx} ${i === 1 ? -4 : 2})`} d="M-9,-40 Q16,-6 5,40 Q-3,2 -9,-40Z" fill={WHITE} {...S(p)} />
      ))}
    </g>
  ),
  bite: (p) => (
    <g>
      <path d="M-38,-2 Q0,-50 38,-2 Q20,-8 0,-6 Q-20,-8 -38,-2Z" fill={p.main} {...S(p)} />
      <path d="M-34,-3 L-26,10 L-18,-4 L-9,12 L0,-4 L9,12 L18,-4 L26,10 L34,-3Z" fill={WHITE} {...S(p, 2)} />
      <path d="M-38,6 Q0,52 38,6 Q20,12 0,10 Q-20,12 -38,6Z" fill={p.dark} {...S(p)} />
      <path d="M-30,6 L-22,-6 L-14,6 L-5,-8 L4,6 L13,-8 L22,6 L30,-6Z" fill={WHITE} {...S(p, 2)} opacity={0.95} />
    </g>
  ),
  fist: (p) => (
    <g>
      <polygon points={star(42, 26, 10, 0)} fill={p.light} opacity={0.8} {...S(p, 1.8)} />
      <path d="M-22,-6 Q-24,-28 -8,-26 Q4,-32 14,-24 Q28,-24 26,-4 Q28,18 10,24 L-10,24 Q-24,20 -22,-6Z" fill={p.main} {...S(p)} />
      <path d="M-8,-26 L-8,-6 M4,-27 L4,-6 M15,-24 L15,-6" fill="none" {...S(p, 2)} />
      <path d="M-22,-4 Q-34,2 -26,12 Q-18,10 -18,2" fill={p.main} {...S(p)} />
      <path d="M-14,-18 Q-10,-22 -6,-20" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" />
    </g>
  ),
  slash: (p) => (
    <g>
      <path d="M-40,34 Q-6,-44 42,-36 Q0,-12 -40,34Z" fill={WHITE} {...S(p)} />
      <path d="M-30,38 Q4,-6 38,-22" fill="none" stroke={p.light} strokeWidth={5} strokeLinecap="round" opacity={0.7} />
      <polygon points={star(8, 3, 4, 0.4)} transform="translate(34 -30)" fill={p.light} {...S(p, 1.4)} />
    </g>
  ),
  xslash: (p) => (
    <g>
      <path d="M-40,34 Q-6,-44 42,-36 Q0,-12 -40,34Z" fill={WHITE} {...S(p)} />
      <path d="M40,34 Q6,-44 -42,-36 Q0,-12 40,34Z" fill={p.light} {...S(p)} />
      <polygon points={star(9, 3.5, 4, 0.4)} fill={WHITE} {...S(p, 1.4)} />
    </g>
  ),
  rush: (p) => (
    <g>
      {[-26, -10, 8, 24].map((y, i) => (
        <path key={i} d={`M-42,${y} L${-8 - i * 4},${y}`} fill="none" stroke={p.dark} strokeWidth={4 - i * 0.3} strokeLinecap="round" opacity={0.6} />
      ))}
      <ellipse cx={14} cy={0} rx={26} ry={22} fill={p.main} {...S(p)} />
      <ellipse cx={8} cy={-8} rx={9} ry={5} fill={p.light} opacity={0.8} />
      <path d="M26,-10 Q34,-6 32,2" fill="none" {...S(p, 2)} />
    </g>
  ),
  dive: (p) => (
    <g>
      {[-18, 0, 18].map((x, i) => (
        <path key={i} d={`M${x},-42 L${x},${-14 + i * 4}`} stroke={p.light} strokeWidth={4} strokeLinecap="round" opacity={0.8} />
      ))}
      <path d="M0,38 L-24,0 L-8,0 L-8,-26 L8,-26 L8,0 L24,0Z" fill={p.main} {...S(p)} />
      <path d="M-4,-20 L-4,-2" stroke={p.light} strokeWidth={3} strokeLinecap="round" />
    </g>
  ),
  orb: (p) => (
    <g>
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M${-40 + i * 3},${-14 + i * 14} Q-18,${-10 + i * 12} -6,${-4 + i * 4}`} fill="none" stroke={p.light} strokeWidth={5 - i} strokeLinecap="round" opacity={0.75} />
      ))}
      <circle cx={14} cy={0} r={24} fill={p.main} {...S(p)} />
      <circle cx={14} cy={0} r={14} fill={p.light} opacity={0.8} />
      <circle cx={8} cy={-8} r={5} fill={WHITE} />
    </g>
  ),
  target: (p) => (
    <g>
      <circle r={34} fill={WHITE} {...S(p)} />
      <circle r={24} fill={p.main} {...S(p, 2)} />
      <circle r={14} fill={WHITE} {...S(p, 2)} />
      <circle r={6} fill={p.dark} {...S(p, 1.6)} />
      <path d="M-42,0 L-26,0 M26,0 L42,0 M0,-42 L0,-26 M0,26 L0,42" {...S(p, 3)} />
    </g>
  ),
  wing: (p) => (
    <g>
      <path d="M0,10 Q-14,-34 -42,-26 Q-36,-10 -44,0 Q-32,2 -34,14 Q-16,14 0,10Z" fill={WHITE} {...S(p)} />
      <path d="M0,10 Q14,-34 42,-26 Q36,-10 44,0 Q32,2 34,14 Q16,14 0,10Z" fill={p.light} {...S(p)} />
      <path d="M-30,-14 L-8,6 M-34,2 L-10,10 M30,-14 L8,6 M34,2 L10,10" fill="none" {...S(p, 1.6)} opacity={0.6} />
    </g>
  ),
  horn: (p) => (
    <g>
      <path d="M-22,34 Q-26,-6 6,-38 Q4,-6 22,34Z" fill={WHITE} {...S(p)} />
      <path d="M-14,26 Q-12,2 2,-22" fill="none" stroke={p.light} strokeWidth={4} strokeLinecap="round" />
      {[-36, -30].map((x, i) => (
        <path key={i} d={`M${x},${-6 + i * 12} L${x - 8},${-6 + i * 12}`} stroke={p.dark} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
      ))}
    </g>
  ),
  swirl: (p) => (
    <g>
      <path d="M0,0 Q10,-6 8,2 Q4,14 -10,12 Q-26,8 -24,-8 Q-20,-30 4,-32 Q34,-32 38,-4 Q40,26 10,34" fill="none" stroke={p.ink} strokeWidth={9} strokeLinecap="round" />
      <path d="M0,0 Q10,-6 8,2 Q4,14 -10,12 Q-26,8 -24,-8 Q-20,-30 4,-32 Q34,-32 38,-4 Q40,26 10,34" fill="none" stroke={p.main} strokeWidth={5.5} strokeLinecap="round" />
    </g>
  ),
  ninja: (p) => (
    <g>
      <circle cx={0} cy={-2} r={26} fill={p.dark} {...S(p)} />
      <path d="M-22,-8 L22,-8 L22,6 L-22,6Z" fill={WHITE} {...S(p, 2)} />
      <circle cx={-9} cy={-1} r={3.6} fill={p.ink} />
      <circle cx={9} cy={-1} r={3.6} fill={p.ink} />
      <path d="M22,-12 Q38,-20 40,-4 Q32,-10 24,-4Z" fill={p.main} {...S(p, 2)} />
    </g>
  ),
  crit: (p) => (
    <g>
      <polygon points={star(40, 12, 4, Math.PI / 4)} fill={p.light} {...S(p)} />
      <polygon points={star(22, 7, 4, 0)} fill={WHITE} {...S(p, 1.8)} />
      <circle r={4} fill={p.main} />
    </g>
  ),
  fang: (p) => (
    <g>
      <path d="M-26,-30 Q-4,-34 0,-6 Q2,22 -6,38 Q-26,16 -26,-30Z" fill={WHITE} {...S(p)} />
      <path d="M26,-30 Q4,-34 0,-6 Q-2,22 6,38 Q26,16 26,-30Z" fill={WHITE} {...S(p)} opacity={0.0} />
      <path d="M-14,-24 Q-8,-4 -10,18" fill="none" stroke={p.light} strokeWidth={4} strokeLinecap="round" />
      <path d="M12,-34 Q18,-14 12,6 M24,-26 Q30,-10 24,2" fill="none" stroke={p.main} strokeWidth={4} strokeLinecap="round" />
    </g>
  ),
  pierce: (p) => (
    <g>
      <path d="M-42,0 L22,0" stroke={p.ink} strokeWidth={9} strokeLinecap="round" />
      <path d="M-42,0 L22,0" stroke={p.light} strokeWidth={5} strokeLinecap="round" />
      <path d="M20,-12 L42,0 L20,12Z" fill={p.main} {...S(p)} />
      <circle r={16} cx={-4} fill="none" stroke={p.dark} strokeWidth={3} strokeDasharray="6 5" />
    </g>
  ),
  spear: (p) => (
    <g transform="rotate(-30)">
      <path d="M-42,0 L16,0" stroke={p.ink} strokeWidth={7} strokeLinecap="round" />
      <path d="M-42,0 L16,0" stroke={p.dark} strokeWidth={3.4} strokeLinecap="round" />
      <path d="M14,-12 L42,0 L14,12Z" fill={p.light} {...S(p)} />
    </g>
  ),
  recoil: (p) => (
    <g>
      <ellipse cx={-4} cy={0} rx={24} ry={20} fill={p.main} {...S(p)} />
      <polygon points={star(16, 8, 6, 0)} transform="translate(30 -4)" fill={p.light} {...S(p, 1.8)} />
      <path d="M-34,-14 L-44,-20 M-36,0 L-46,0 M-34,14 L-44,20" {...S(p, 2.6)} />
    </g>
  ),
  // ---------- ぞくせい ----------
  flame: (p) => (
    <g>
      <path d="M0,-44 C8,-26 28,-18 28,4 C28,24 14,36 0,36 C-14,36 -28,24 -28,4 C-28,-8 -22,-16 -15,-24 C-13,-10 -7,-6 -2,-9 C-5,-22 -3,-34 0,-44Z" fill={p.main} {...S(p)} />
      <path d="M0,-12 C6,-2 16,2 16,16 C16,28 8,34 0,34 C-8,34 -16,28 -16,16 C-16,6 -9,2 -4,-6 C-2,-2 0,-6 0,-12Z" fill={p.light} {...S(p, 1.8)} />
      <path d="M0,12 C4,18 8,20 8,26 C8,32 4,34 0,34 C-4,34 -8,32 -8,26 C-8,20 -2,18 0,12Z" fill="#fff7c8" />
    </g>
  ),
  ember: (p) => (
    <g>
      {[[-24, 10, 8], [-6, -10, 6], [14, 14, 9], [30, -8, 5], [0, 28, 5]].map(([x, y, r], i) => (
        <path key={i} d={`M${x},${y - r * 1.6} Q${x + r},${y - r * 0.2} ${x},${y + r} Q${x - r},${y - r * 0.2} ${x},${y - r * 1.6}Z`} fill={i % 2 ? p.light : p.main} {...S(p, 1.8)} />
      ))}
    </g>
  ),
  wave: (p) => (
    <g>
      <path d="M-42,22 Q-34,-26 0,-14 Q12,-30 -2,-40 Q34,-36 44,6 Q44,32 20,36 L-34,36Z" fill={p.main} {...S(p)} />
      <path d="M-30,14 Q-26,-12 0,-6 Q-6,-18 -4,-24" fill="none" stroke={p.light} strokeWidth={4} strokeLinecap="round" />
      <path d="M-42,26 Q-28,18 -14,26 Q0,18 14,26 Q28,18 44,26" fill="none" stroke={WHITE} strokeWidth={4} strokeLinecap="round" />
      <circle cx={30} cy={-24} r={3.4} fill={p.light} {...S(p, 1.4)} />
      <circle cx={38} cy={-14} r={2.4} fill={p.light} {...S(p, 1.2)} />
    </g>
  ),
  drops: (p) => (
    <g>
      {[[-22, 6, 1], [6, -10, 1.2], [26, 14, 0.8]].map(([x, y, s], i) => (
        <path key={i} transform={`translate(${x} ${y}) scale(${s})`} d="M0,-22 Q16,2 12,12 Q8,22 0,22 Q-8,22 -12,12 Q-16,2 0,-22Z" fill={i === 1 ? p.light : p.main} {...S(p, 2.2)} />
      ))}
    </g>
  ),
  snow: (p) => (
    <g {...S(p, 4.6)} fill="none">
      {[0, 60, 120].map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <path d="M0,-38 L0,38" stroke={p.ink} strokeWidth={8} />
          <path d="M0,-38 L0,38" stroke={WHITE} strokeWidth={4.4} />
          <path d="M-9,-26 L0,-17 L9,-26 M-9,26 L0,17 L9,26" stroke={p.ink} strokeWidth={7} />
          <path d="M-9,-26 L0,-17 L9,-26 M-9,26 L0,17 L9,26" stroke={p.light} strokeWidth={3.4} />
        </g>
      ))}
    </g>
  ),
  bubble: (p) => (
    <g>
      {[[-14, 8, 22], [20, -12, 14], [26, 20, 9]].map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} fill={p.light} opacity={0.75} {...S(p, 2)} />
          <path d={`M${x - r * 0.55},${y - r * 0.2} Q${x - r * 0.4},${y - r * 0.6} ${x},${y - r * 0.65}`} fill="none" stroke={WHITE} strokeWidth={2.6} strokeLinecap="round" />
        </g>
      ))}
    </g>
  ),
  leaf: (p) => (
    <g>
      <path d="M-34,26 Q-30,-30 30,-34 Q34,24 -34,26Z" fill={p.main} {...S(p)} />
      <path d="M-32,24 Q-4,-2 28,-32" fill="none" stroke={p.light} strokeWidth={3.6} strokeLinecap="round" />
      <path d="M-14,14 L-12,2 M-2,6 L2,-8 M10,-4 L18,-14" fill="none" stroke={p.light} strokeWidth={2.4} strokeLinecap="round" />
    </g>
  ),
  vine: (p) => (
    <g>
      <path d="M-42,26 Q-24,-34 0,-4 Q22,26 42,-30" fill="none" stroke={p.ink} strokeWidth={10} strokeLinecap="round" />
      <path d="M-42,26 Q-24,-34 0,-4 Q22,26 42,-30" fill="none" stroke={p.main} strokeWidth={6} strokeLinecap="round" />
      {[[-28, -14], [-8, -22], [10, 14], [26, 4]].map(([x, y], i) => (
        <path key={i} d={`M${x - 4},${y + 3} L${x},${y - 9} L${x + 4},${y + 3}Z`} fill={p.light} {...S(p, 1.6)} />
      ))}
    </g>
  ),
  seed: (p) => (
    <g>
      {[[-24, 8, -30], [0, -10, 20], [24, 12, -10], [4, 24, 40]].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <ellipse rx={9} ry={14} fill={i % 2 ? p.light : p.main} {...S(p, 2)} />
          <path d="M0,-10 L0,10" stroke={p.dark} strokeWidth={2} />
        </g>
      ))}
    </g>
  ),
  sprout: (p) => (
    <g>
      <path d="M0,38 Q-4,12 0,-6" fill="none" stroke={p.ink} strokeWidth={8} strokeLinecap="round" />
      <path d="M0,38 Q-4,12 0,-6" fill="none" stroke={p.dark} strokeWidth={4.4} strokeLinecap="round" />
      <path d="M0,-4 Q-34,-6 -38,-34 Q-8,-34 0,-4Z" fill={p.main} {...S(p)} />
      <path d="M0,-4 Q30,-8 36,-36 Q6,-38 0,-4Z" fill={p.light} {...S(p)} />
      <path d="M-36,40 Q0,30 36,40" fill="none" stroke={p.dark} strokeWidth={4} strokeLinecap="round" />
    </g>
  ),
  root: (p) => (
    <g fill="none" strokeLinecap="round">
      <path d="M0,-34 L0,10 M0,10 Q-10,22 -26,26 M0,10 Q10,22 26,26 M0,0 Q-14,6 -30,4 M0,-6 Q14,0 30,-4 M0,14 L0,38" stroke={p.ink} strokeWidth={9} />
      <path d="M0,-34 L0,10 M0,10 Q-10,22 -26,26 M0,10 Q10,22 26,26 M0,0 Q-14,6 -30,4 M0,-6 Q14,0 30,-4 M0,14 L0,38" stroke={p.main} strokeWidth={5} />
    </g>
  ),
  bolt: (p) => (
    <g>
      <path d="M8,-44 L-22,6 L-4,6 L-12,44 L24,-10 L4,-10Z" fill={p.main} {...S(p)} />
      <path d="M5,-34 L-14,2 L0,2" fill="none" stroke={p.light} strokeWidth={3.4} strokeLinecap="round" />
    </g>
  ),
  spark: (p) => (
    <g>
      <path d="M-4,-30 L-20,0 L-8,0 L-14,30 L14,-6 L2,-6Z" fill={p.main} {...S(p)} />
      <polygon points={star(9, 3.5, 4, 0)} transform="translate(26 -20)" fill={p.light} {...S(p, 1.4)} />
      <polygon points={star(7, 2.8, 4, 0)} transform="translate(-30 -22)" fill={p.light} {...S(p, 1.4)} />
      <polygon points={star(6, 2.4, 4, 0)} transform="translate(30 20)" fill={p.light} {...S(p, 1.4)} />
    </g>
  ),
  cloud: (p) => (
    <g>
      <path d="M-30,18 Q-42,18 -40,6 Q-38,-6 -26,-4 Q-24,-22 -4,-20 Q10,-34 24,-18 Q42,-16 40,2 Q42,18 28,18Z" fill={WHITE} {...S(p)} />
      <path d="M2,18 L-6,32 L4,30 L-2,44" fill="none" stroke={p.main} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  moon: (p) => (
    <g>
      <path d="M12,-38 Q-40,-30 -34,14 Q-26,42 14,38 Q-18,22 -10,-8 Q-6,-26 12,-38Z" fill={p.light} {...S(p)} />
      <polygon points={star(8, 3, 4, 0)} transform="translate(24 -14)" fill={WHITE} {...S(p, 1.4)} />
      <polygon points={star(6, 2.4, 4, 0)} transform="translate(32 14)" fill={WHITE} {...S(p, 1.2)} />
    </g>
  ),
  eye: (p) => (
    <g>
      <path d="M-40,0 Q0,-36 40,0 Q0,36 -40,0Z" fill={WHITE} {...S(p)} />
      <circle r={15} fill={p.main} {...S(p)} />
      <circle r={7} fill={p.ink} />
      <circle cx={-4} cy={-5} r={3} fill={WHITE} />
    </g>
  ),
  glare: (p) => (
    <g>
      <path d="M-40,4 Q0,-30 40,4 Q0,34 -40,4Z" fill={WHITE} {...S(p)} />
      <circle cy={5} r={14} fill={p.main} {...S(p)} />
      <circle cy={5} r={6} fill={p.ink} />
      <path d="M-42,-18 L-8,-6 M42,-18 L8,-6" {...S(p, 5)} />
    </g>
  ),
  venom: (p) => (
    <g>
      <path d="M0,-34 Q22,-2 20,12 Q18,30 0,30 Q-18,30 -20,12 Q-22,-2 0,-34Z" fill={p.main} {...S(p)} />
      <path d="M-8,0 Q-12,12 -6,20" fill="none" stroke={p.light} strokeWidth={4} strokeLinecap="round" />
      {[[-28, -14, 7], [30, -22, 5], [30, 22, 8]].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={p.light} {...S(p, 1.8)} />
      ))}
    </g>
  ),
  needle: (p) => (
    <g transform="rotate(-35)">
      <path d="M-42,0 L22,0" stroke={p.ink} strokeWidth={7} strokeLinecap="round" />
      <path d="M-42,0 L22,0" stroke={WHITE} strokeWidth={3.4} strokeLinecap="round" />
      <circle cx={30} cy={0} r={9} fill={p.main} {...S(p, 2)} />
      <path d="M36,12 Q42,22 36,26 Q30,22 36,12Z" fill={p.main} {...S(p, 1.6)} />
    </g>
  ),
  // ---------- じょうたい ----------
  zzz: (p) => (
    <g fontFamily="var(--font-display)" fontWeight={900}>
      <text x={-30} y={22} fontSize={34} fill={p.main} stroke={p.ink} strokeWidth={1.6} paintOrder="stroke">Z</text>
      <text x={-2} y={0} fontSize={26} fill={p.light} stroke={p.ink} strokeWidth={1.4} paintOrder="stroke">Z</text>
      <text x={20} y={-18} fontSize={18} fill={WHITE} stroke={p.ink} strokeWidth={1.2} paintOrder="stroke">Z</text>
    </g>
  ),
  dizzy: (p) => (
    <g>
      {[-18, 18].map((x, i) => (
        <g key={i} transform={`translate(${x} 0)`}>
          <circle r={16} fill={WHITE} {...S(p)} />
          <path d="M0,0 Q4,-2 4,2 Q2,8 -4,6 Q-10,2 -6,-6 Q0,-12 8,-8" fill="none" stroke={p.main} strokeWidth={2.6} strokeLinecap="round" />
        </g>
      ))}
      {[[-30, -28], [0, -34], [30, -28]].map(([x, y], i) => (
        <polygon key={i} points={star(7, 3, 5, 0)} transform={`translate(${x} ${y})`} fill={p.light} {...S(p, 1.4)} />
      ))}
    </g>
  ),
  iceblock: (p) => (
    <g>
      <path d="M-26,-22 L0,-38 L26,-22 L26,18 L0,36 L-26,18Z" fill={p.light} opacity={0.9} {...S(p)} />
      <path d="M-26,-22 L0,-6 L26,-22 M0,-6 L0,36" fill="none" {...S(p, 1.8)} />
      <path d="M-16,-14 L-12,4" stroke={WHITE} strokeWidth={3.4} strokeLinecap="round" />
    </g>
  ),
  // ---------- ほじょ ----------
  shield: (p) => (
    <g>
      <path d="M0,-40 L30,-28 Q32,10 0,40 Q-32,10 -30,-28Z" fill={p.main} {...S(p)} />
      <path d="M0,-30 L21,-21 Q22,6 0,30Z" fill={p.light} opacity={0.75} />
      <path d="M0,-30 L-21,-21 Q-22,6 0,30Z" fill={p.dark} opacity={0.35} />
      <path d="M0,-12 L0,14 M-10,0 L10,0" {...S(p, 3.4)} stroke={WHITE} />
    </g>
  ),
  roll: (p) => (
    <g>
      <circle r={30} fill={p.main} {...S(p)} />
      <path d="M-24,-10 Q-6,-26 14,-18" fill="none" stroke={p.light} strokeWidth={4} strokeLinecap="round" />
      <path d="M-14,16 Q4,26 22,10" fill="none" stroke={p.dark} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
      <path d="M-40,-20 Q-44,0 -40,20 M40,-20 Q44,0 40,20" fill="none" stroke={p.ink} strokeWidth={3.4} strokeLinecap="round" />
    </g>
  ),
  counter: (p) => (
    <g>
      <path d="M-28,4 A30,30 0 1 1 8,32" fill="none" stroke={p.ink} strokeWidth={11} strokeLinecap="round" />
      <path d="M-28,4 A30,30 0 1 1 8,32" fill="none" stroke={p.main} strokeWidth={6.6} strokeLinecap="round" />
      <path d="M-42,-4 L-28,12 L-14,-6Z" fill={p.main} {...S(p, 2.2)} />
    </g>
  ),
  heart: (p) => (
    <g>
      <path d="M0,34 Q-42,6 -30,-18 Q-18,-34 0,-14 Q18,-34 30,-18 Q42,6 0,34Z" fill={p.main} {...S(p)} />
      <path d="M-20,-14 Q-14,-22 -6,-16" fill="none" stroke={WHITE} strokeWidth={4} strokeLinecap="round" />
      <path d="M34,-34 L34,-22 M28,-28 L40,-28" {...S(p, 3)} stroke={p.dark} />
    </g>
  ),
  cure: (p) => (
    <g>
      <path d="M0,-38 Q22,-4 20,10 Q18,30 0,30 Q-18,30 -20,10 Q-22,-4 0,-38Z" fill={p.light} {...S(p)} />
      <path d="M0,-6 L0,20 M-12,7 L12,7" {...S(p, 4.6)} stroke={p.main} />
      {[[-32, -10, 4], [32, -20, 5], [34, 20, 3.5]].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={WHITE} {...S(p, 1.6)} />
      ))}
    </g>
  ),
  rice: (p) => (
    <g>
      <path d="M0,-34 Q38,12 30,26 Q0,34 -30,26 Q-38,12 0,-34Z" fill={WHITE} {...S(p)} />
      <path d="M-14,10 L14,10 L12,28 L-12,28Z" fill={p.ink} />
      <path d="M-4,-14 Q0,-20 4,-14" fill="none" stroke={p.light} strokeWidth={3} strokeLinecap="round" />
    </g>
  ),
  up: (p) => (
    <g>
      {[8, -12].map((y, i) => (
        <path key={i} d={`M-28,${y + 14} L0,${y - 14} L28,${y + 14} L16,${y + 14} L0,${y} L-16,${y + 14}Z`} fill={i ? p.light : p.main} {...S(p, 2.2)} />
      ))}
      <path d="M0,-34 L0,-44" {...S(p, 4)} />
    </g>
  ),
  down: (p) => (
    <g>
      {[-8, 12].map((y, i) => (
        <path key={i} d={`M-28,${y - 14} L0,${y + 14} L28,${y - 14} L16,${y - 14} L0,${y} L-16,${y - 14}Z`} fill={i ? p.light : p.dark} {...S(p, 2.2)} />
      ))}
    </g>
  ),
  muscle: (p) => (
    <g>
      <path d="M-30,24 Q-36,-6 -14,-22 Q4,-34 20,-22 Q34,-10 22,4 Q16,-6 6,-4 Q0,10 8,24Z" fill={p.main} {...S(p)} />
      <path d="M-14,-12 Q-6,-20 6,-18" fill="none" stroke={p.light} strokeWidth={4} strokeLinecap="round" />
      <polygon points={star(9, 3.6, 4, 0)} transform="translate(32 -26)" fill={p.light} {...S(p, 1.4)} />
    </g>
  ),
  clover: (p) => (
    <g>
      {[0, 90, 180, 270].map((a) => (
        <path key={a} transform={`rotate(${a})`} d="M0,-4 Q-18,-14 -12,-28 Q-2,-34 0,-18 Q2,-34 12,-28 Q18,-14 0,-4Z" fill={p.main} {...S(p, 2)} />
      ))}
      <path d="M2,6 Q8,22 20,30" fill="none" stroke={p.dark} strokeWidth={4} strokeLinecap="round" />
    </g>
  ),
  cards: (p) => (
    <g>
      {[-22, 0, 22].map((r, i) => (
        <g key={i} transform={`translate(${r * 0.8} ${Math.abs(r) * 0.2}) rotate(${r})`}>
          <rect x={-15} y={-26} width={30} height={46} rx={5} fill={i === 1 ? p.light : WHITE} {...S(p, 2.2)} />
          <polygon points={star(8, 3.4, 4, 0)} transform="translate(0 -3)" fill={p.main} {...S(p, 1.2)} />
        </g>
      ))}
    </g>
  ),
  wishstar: (p) => (
    <g>
      <polygon points={star(34, 15, 5, -Math.PI / 2)} fill={p.light} {...S(p)} />
      <polygon points={star(16, 7, 5, -Math.PI / 2)} fill={WHITE} {...S(p, 1.6)} />
      <polygon points={star(7, 3, 4, 0)} transform="translate(-34 20)" fill={p.light} {...S(p, 1.3)} />
      <polygon points={star(6, 2.4, 4, 0)} transform="translate(36 22)" fill={p.light} {...S(p, 1.2)} />
    </g>
  ),
  roar: (p) => (
    <g>
      <path d="M-40,-8 L-24,-30 L-14,-18 L0,-40 L10,-22 L28,-34 L26,-12 L42,-6 L26,4 L36,26 L14,16 L2,38 L-8,18 L-26,28 L-24,10 L-42,6Z" fill={p.light} {...S(p)} />
      <path d="M-6,-18 L-6,6 M-6,14 L-6,16" {...S(p, 6)} stroke={p.dark} />
      <path d="M10,-18 L10,6 M10,14 L10,16" {...S(p, 6)} stroke={p.dark} />
    </g>
  ),
  look: (p) => (
    <g>
      <path d="M-40,-2 Q0,-34 40,-2 Q0,30 -40,-2Z" fill={WHITE} {...S(p)} />
      <circle cx={0} cy={-2} r={13} fill={p.dark} {...S(p, 2)} />
      <circle cx={0} cy={-2} r={5} fill={p.ink} />
      <path d="M-14,-40 L0,-28 L14,-40" {...S(p, 3.4)} fill="none" />
    </g>
  ),
  hourglass: (p) => (
    <g>
      <path d="M-22,-36 L22,-36 L22,-28 Q22,-8 4,0 Q22,8 22,28 L22,36 L-22,36 L-22,28 Q-22,8 -4,0 Q-22,-8 -22,-28Z" fill={WHITE} {...S(p)} />
      <path d="M-14,-30 L14,-30 Q12,-14 0,-4 Q-12,-14 -14,-30Z" fill={p.light} />
      <path d="M-14,32 L14,32 Q12,18 0,10 Q-12,18 -14,32Z" fill={p.main} />
    </g>
  ),
  chargeorb: (p) => (
    <g>
      {[38, 28, 18].map((r, i) => (
        <circle key={r} r={r} fill="none" stroke={p.main} strokeWidth={3} strokeDasharray={`${4 + i * 2} ${5}`} opacity={0.35 + i * 0.2} />
      ))}
      <circle r={13} fill={p.main} {...S(p)} />
      <circle r={6} fill={p.light} />
      {[0, 90, 180, 270].map((a) => (
        <path key={a} transform={`rotate(${a})`} d="M-5,-42 L0,-32 L5,-42Z" fill={p.dark} {...S(p, 1.6)} />
      ))}
    </g>
  ),
  sunrays: (p) => (
    <g>
      {Array.from({ length: 10 }, (_, i) => (
        <path key={i} transform={`rotate(${i * 36})`} d="M-3,-40 L0,-26 L3,-40Z" fill={p.light} {...S(p, 1.4)} />
      ))}
      <circle r={17} fill={p.light} {...S(p)} />
    </g>
  ),
  rainbow: () => (
    <g fill="none" strokeLinecap="round" stroke="#33302b">
      {[['#ef5a2a', 38], ['#f2b705', 30], ['#3aa661', 22], ['#3b82f6', 14]].map(([c, r], i) => (
        <g key={i}>
          <path d={`M${-r},20 A${r},${r} 0 0 1 ${r},20`} strokeWidth={10} />
          <path d={`M${-r},20 A${r},${r} 0 0 1 ${r},20`} strokeWidth={6.4} stroke={c as string} />
        </g>
      ))}
    </g>
  ),
  tool: (p) => (
    <g>
      <path d="M-20,14 L20,-26 L34,-12 L-6,28Z" fill={p.light} {...S(p)} />
      <circle cx={-20} cy={22} r={9} fill={p.main} {...S(p)} />
    </g>
  ),
  kosei: (p) => (
    <g>
      <polygon points={star(42, 26, 12, 0)} fill={p.light} {...S(p)} />
      <polygon points={star(30, 13, 5, -Math.PI / 2)} fill={p.main} {...S(p)} />
      <polygon points={star(13, 6, 5, -Math.PI / 2)} fill={WHITE} {...S(p, 1.4)} />
    </g>
  ),
  // ---------- とくしゅ ----------
  rain: (p) => (
    <g>
      <path d="M-30,6 Q-42,6 -40,-6 Q-38,-18 -26,-16 Q-22,-34 -2,-32 Q14,-44 26,-26 Q42,-24 40,-6 Q42,6 28,6Z" fill="#dfe6f2" {...S(p)} />
      {[[-22, 16], [-6, 22], [10, 14], [24, 22], [-14, 32], [4, 36], [18, 34]].map(([x, y], i) => (
        <path key={i} d={`M${x},${y - 7} Q${x + 5},${y + 1} ${x},${y + 5} Q${x - 5},${y + 1} ${x},${y - 7}Z`} fill={p.main} {...S(p, 1.6)} />
      ))}
    </g>
  ),
  sun: (p) => (
    <g>
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} transform={`rotate(${i * 30})`} d="M-4,-26 L0,-42 L4,-26Z" fill={p.light} {...S(p, 1.6)} />
      ))}
      <circle r={22} fill={p.main} {...S(p)} />
      <circle r={13} fill={p.light} opacity={0.85} />
      <circle cx={-7} cy={-6} r={3} fill="#fffdf5" />
    </g>
  ),
  thundercloud: (p) => (
    <g>
      <path d="M-30,4 Q-42,4 -40,-8 Q-38,-20 -26,-18 Q-22,-36 -2,-34 Q14,-46 26,-28 Q42,-26 40,-8 Q42,4 28,4Z" fill="#8a8fa8" {...S(p)} />
      <path d="M6,2 L-10,22 L0,22 L-8,42 L16,16 L4,16 L12,2Z" fill={p.main} {...S(p, 2)} />
    </g>
  ),
  night: (p) => (
    <g>
      <path d="M10,-36 Q-38,-28 -32,12 Q-24,40 12,36 Q-18,20 -10,-8 Q-6,-24 10,-36Z" fill={p.light} {...S(p)} />
      {[[24, -20, 7], [34, 6, 5], [20, 26, 4.5]].map(([x, y, r], i) => (
        <polygon key={i} points={star(r, r * 0.4, 4, 0)} transform={`translate(${x} ${y})`} fill="#fffdf5" {...S(p, 1.3)} />
      ))}
    </g>
  ),
  dome: (p) => (
    <g>
      <path d="M-34,26 A34,34 0 0 1 34,26Z" fill={p.light} opacity={0.55} {...S(p)} />
      <path d="M-34,26 A34,34 0 0 1 34,26" fill="none" {...S(p, 3)} />
      <path d="M-22,10 Q-16,-8 0,-12" fill="none" stroke="#fffdf5" strokeWidth={4.4} strokeLinecap="round" />
      <ellipse cx={0} cy={28} rx={36} ry={5} fill={p.main} opacity={0.6} />
      <polygon points={star(7, 3, 4, 0)} transform="translate(22 -6)" fill="#fffdf5" {...S(p, 1.2)} />
    </g>
  ),
  bomb: (p) => (
    <g>
      <circle cy={8} r={26} fill={p.dark} {...S(p)} />
      <circle cx={-9} cy={-1} r={6} fill="#fffdf5" opacity={0.55} />
      <path d="M6,-18 Q14,-30 24,-28" fill="none" stroke={p.ink} strokeWidth={5} strokeLinecap="round" />
      <polygon points={star(9, 3.6, 5, 0)} transform="translate(28 -30)" fill={p.light} {...S(p, 1.4)} />
    </g>
  ),
  spikes: (p) => (
    <g>
      <path d="M-40,28 L40,28" stroke={p.ink} strokeWidth={4} strokeLinecap="round" />
      {[-30, -15, 0, 15, 30].map((x, i) => (
        <path key={i} d={`M${x - 8},28 L${x},${-6 - (i % 2) * 8} L${x + 8},28Z`} fill={i % 2 ? p.light : p.main} {...S(p, 2)} />
      ))}
    </g>
  ),
  gift: (p) => (
    <g>
      <rect x={-28} y={-6} width={56} height={36} rx={4} fill={p.main} {...S(p)} />
      <rect x={-32} y={-18} width={64} height={16} rx={4} fill={p.light} {...S(p)} />
      <path d="M0,-18 L0,30" stroke={p.ink} strokeWidth={7} />
      <path d="M0,-18 L0,30" stroke="#fffdf5" strokeWidth={3.6} />
      <path d="M0,-18 Q-14,-36 -20,-24 Q-14,-16 0,-18 Q14,-36 20,-24 Q14,-16 0,-18Z" fill="#fffdf5" {...S(p, 2)} />
    </g>
  ),
  heartcrack: (p) => (
    <g>
      <path d="M0,34 Q-42,6 -30,-18 Q-18,-34 0,-14 Q18,-34 30,-18 Q42,6 0,34Z" fill={p.main} {...S(p)} />
      <path d="M-4,-12 L6,0 L-4,8 L6,22" fill="none" stroke="#fffdf5" strokeWidth={4.4} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  chain: (p) => (
    <g>
      <rect x={-34} y={-12} width={40} height={24} rx={12} fill="none" stroke={p.ink} strokeWidth={9} />
      <rect x={-34} y={-12} width={40} height={24} rx={12} fill="none" stroke={p.light} strokeWidth={5} />
      <rect x={-6} y={-12} width={40} height={24} rx={12} fill="none" stroke={p.ink} strokeWidth={9} />
      <rect x={-6} y={-12} width={40} height={24} rx={12} fill="none" stroke={p.main} strokeWidth={5} />
    </g>
  ),
  mirror: (p) => (
    <g>
      <ellipse cx={0} cy={-2} rx={26} ry={32} fill={p.light} {...S(p)} />
      <path d="M-14,-18 Q-8,-28 4,-26" fill="none" stroke="#fffdf5" strokeWidth={5} strokeLinecap="round" />
      <rect x={-5} y={30} width={10} height={12} fill={p.main} {...S(p, 2)} />
      <path d="M-16,8 Q-8,-4 0,6 Q8,-4 16,8" fill="none" stroke={p.dark} strokeWidth={3} strokeLinecap="round" />
    </g>
  ),
  ban: (p) => (
    <g>
      {[-18, 0, 18].map((r, i) => (
        <g key={i} transform={`translate(${r * 0.9} ${Math.abs(r) * 0.2}) rotate(${r})`}>
          <rect x={-13} y={-22} width={26} height={40} rx={4} fill="#fffdf5" {...S(p, 2)} />
        </g>
      ))}
      <circle r={30} fill="none" stroke={p.ink} strokeWidth={10} />
      <circle r={30} fill="none" stroke="#e83a2a" strokeWidth={6} />
      <path d="M-21,-21 L21,21" stroke={p.ink} strokeWidth={10} strokeLinecap="round" />
      <path d="M-21,-21 L21,21" stroke="#e83a2a" strokeWidth={6} strokeLinecap="round" />
    </g>
  ),
  swapheart: (p) => (
    <g>
      <path d="M-18,6 Q-40,-8 -32,-20 Q-24,-28 -18,-18 Q-12,-28 -4,-20 Q4,-8 -18,6Z" fill={p.main} {...S(p, 2.2)} />
      <path d="M18,28 Q-4,14 4,2 Q12,-6 18,4 Q24,-6 32,2 Q40,14 18,28Z" fill={p.light} {...S(p, 2.2)} />
      <path d="M-22,22 Q-4,34 14,24" fill="none" stroke={p.ink} strokeWidth={3} strokeLinecap="round" />
      <path d="M14,24 l-9,-1 l5,-8z" fill={p.ink} />
      <path d="M22,-24 Q4,-34 -12,-26" fill="none" stroke={p.ink} strokeWidth={3} strokeLinecap="round" />
      <path d="M-12,-26 l9,0 l-5,8z" fill={p.ink} />
    </g>
  ),
  swap: (p) => (
    <g>
      <path d="M-30,-10 L22,-10" stroke={p.ink} strokeWidth={10} strokeLinecap="round" />
      <path d="M-30,-10 L22,-10" stroke={p.main} strokeWidth={6} strokeLinecap="round" />
      <path d="M18,-24 L38,-10 L18,4Z" fill={p.main} {...S(p, 2.2)} />
      <path d="M30,16 L-22,16" stroke={p.ink} strokeWidth={10} strokeLinecap="round" />
      <path d="M30,16 L-22,16" stroke={p.light} strokeWidth={6} strokeLinecap="round" />
      <path d="M-18,2 L-38,16 L-18,30Z" fill={p.light} {...S(p, 2.2)} />
    </g>
  ),
  dice: (p) => (
    <g>
      <path d="M-24,-10 L0,-24 L24,-10 L24,20 L0,34 L-24,20Z" fill="#fffdf5" {...S(p)} />
      <path d="M-24,-10 L0,4 L24,-10 M0,4 L0,34" fill="none" {...S(p, 2)} />
      {[[0, -10], [-9, -14], [9, -6]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y + 2} r={2.6} fill={p.main} />
      ))}
      {[[-12, 14], [-12, 24], [12, 20]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.6} fill={p.dark} />
      ))}
    </g>
  ),
  coin: (p) => (
    <g>
      <ellipse rx={30} ry={30} fill={p.light} {...S(p)} />
      <ellipse rx={22} ry={22} fill="none" stroke={p.dark} strokeWidth={3} />
      <polygon points={star(13, 5.5, 5, -Math.PI / 2)} fill={p.main} {...S(p, 1.8)} />
      <path d="M-18,-12 Q-12,-22 -2,-24" fill="none" stroke="#fffdf5" strokeWidth={4} strokeLinecap="round" />
    </g>
  ),
  megaphone: (p) => (
    <g>
      <path d="M-30,-6 L8,-20 L8,26 L-30,12Z" fill={p.main} {...S(p)} />
      <rect x={-38} y={-8} width={12} height={22} rx={3} fill={p.dark} {...S(p, 2)} />
      <path d="M16,-8 Q26,2 16,12 M24,-18 Q40,2 24,22" fill="none" stroke={p.ink} strokeWidth={4} strokeLinecap="round" />
      <path d="M-18,16 L-14,34 L-4,34 L-4,22" fill="none" stroke={p.ink} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  readeye: (p) => (
    <g>
      <circle r={36} fill="none" stroke={p.ink} strokeWidth={8} strokeDasharray="8 7" />
      <circle r={36} fill="none" stroke={p.main} strokeWidth={4} strokeDasharray="8 7" />
      <path d="M-26,0 Q0,-24 26,0 Q0,24 -26,0Z" fill="#fffdf5" {...S(p, 2.4)} />
      <circle r={9} fill={p.main} {...S(p, 2)} />
      <circle r={4} fill={p.ink} />
    </g>
  ),
  fire_ring: (p) => (
    <g>
      <circle r={30} fill="none" stroke={p.ink} strokeWidth={14} />
      <circle r={30} fill="none" stroke={p.main} strokeWidth={9} />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} transform={`rotate(${i * 45}) translate(0 -34)`} d="M-5,0 Q-3,-10 0,-14 Q3,-10 5,0Z" fill={p.light} {...S(p, 1.4)} />
      ))}
    </g>
  ),
};

export const MOTIF_NAMES = Object.keys(MOTIFS);
