import type { ReactElement } from 'react';
import type { Pal } from './palette';

/**
 * カードの 描きおろしイラスト（クレヨン風 SVG）。viewBox は 200×170。
 * 動かしたい部分には ill-* の class を つける（.gcard-anim の中でだけ CSS で動く＝軽い）。
 *  ill-flicker（炎のゆらぎ）／ill-twinkle（キラキラ）／ill-float（上へ ふわふわ）／ill-pulse（ため の わっか）
 *  ill-flow（水・ビームの ながれ）／ill-shake（ぷるぷる）／ill-spin（くるくる）
 */
export type Illust = (pal: Pal) => ReactElement;

export const INK = '#33302b';
const PAPER = '#fffdf5';
const ink = (w = 3) => ({ stroke: INK, strokeWidth: w, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const });

// ------------------------------------------------------------------ 部品

/** 地面の かげ。 */
export const Shadow = ({ x, y, rx = 26, ry = 6 }: { x: number; y: number; rx?: number; ry?: number }) => <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={INK} opacity={0.16} />;

/** まるい いきもの（じぶん）。 */
export function Buddy({
  x,
  y,
  s = 1,
  body,
  belly = PAPER,
  face = 'fierce',
  flip = false,
  rot = 0,
}: {
  x: number;
  y: number;
  s?: number;
  body: string;
  belly?: string;
  face?: 'fierce' | 'happy' | 'calm' | 'puff';
  flip?: boolean;
  rot?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${flip ? -s : s} ${s})`}>
      {/* あし */}
      <ellipse cx={-12} cy={29} rx={8} ry={5} fill={body} {...ink(2.6)} />
      <ellipse cx={12} cy={29} rx={8} ry={5} fill={body} {...ink(2.6)} />
      {/* からだ */}
      <path d="M-30,4 C-32,-22 -12,-33 4,-32 C23,-31 33,-14 31,5 C30,23 15,31 0,31 C-17,31 -29,21 -30,4Z" fill={body} {...ink(3.2)} />
      <ellipse cx={5} cy={11} rx={15} ry={12} fill={belly} opacity={0.9} />
      {/* つや */}
      <path d="M-20,-14 C-16,-22 -8,-25 0,-25" fill="none" stroke={PAPER} strokeWidth={4} strokeLinecap="round" opacity={0.7} />
      {/* かお */}
      {face === 'fierce' && (
        <g>
          <path d="M2,-14 L12,-10 M17,-10 L27,-14" {...ink(3)} />
          <ellipse cx={9} cy={-4} rx={3.6} ry={4.6} fill={INK} />
          <ellipse cx={22} cy={-4} rx={3.6} ry={4.6} fill={INK} />
          <path d="M10,8 Q16,4 22,8" fill="none" {...ink(2.6)} />
        </g>
      )}
      {face === 'happy' && (
        <g>
          <path d="M5,-5 Q9,-11 13,-5 M18,-5 Q22,-11 26,-5" fill="none" {...ink(3)} />
          <path d="M8,5 Q15,14 23,5Z" fill="#e8503a" {...ink(2.4)} />
          <circle cx={1} cy={4} r={3.4} fill="#ff9ba8" opacity={0.7} />
        </g>
      )}
      {face === 'calm' && (
        <g>
          <ellipse cx={9} cy={-5} rx={3.2} ry={4} fill={INK} />
          <ellipse cx={22} cy={-5} rx={3.2} ry={4} fill={INK} />
          <path d="M11,7 Q16,10 21,7" fill="none" {...ink(2.4)} />
        </g>
      )}
      {face === 'puff' && (
        <g>
          <path d="M3,-12 L13,-8 M17,-8 L27,-12" {...ink(3)} />
          <ellipse cx={9} cy={-3} rx={3.4} ry={4.4} fill={INK} />
          <ellipse cx={22} cy={-3} rx={3.4} ry={4.4} fill={INK} />
          <ellipse cx={30} cy={8} rx={5} ry={5.5} fill={INK} />
        </g>
      )}
    </g>
  );
}

/** あいて（グレーの まと）。hurt だと ×め。 */
export function Foe({ x, y, s = 1, hurt = true, rot = 0, tint = '#b9b3c9' }: { x: number; y: number; s?: number; hurt?: boolean; rot?: number; tint?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <ellipse cx={-10} cy={27} rx={7} ry={4.5} fill={tint} {...ink(2.4)} />
      <ellipse cx={10} cy={27} rx={7} ry={4.5} fill={tint} {...ink(2.4)} />
      <path d="M-26,2 C-27,-20 -10,-28 2,-27 C18,-26 27,-12 26,4 C25,20 12,27 0,27 C-14,27 -25,18 -26,2Z" fill={tint} {...ink(3)} />
      {hurt ? (
        <g {...ink(2.8)}>
          <path d="M-16,-9 L-8,-1 M-8,-9 L-16,-1" />
          <path d="M-2,-9 L6,-1 M6,-9 L-2,-1" />
          <path d="M-14,10 Q-8,6 -2,10 Q4,14 8,10" fill="none" />
        </g>
      ) : (
        <g>
          <ellipse cx={-12} cy={-5} rx={3.2} ry={4} fill={INK} />
          <ellipse cx={2} cy={-5} rx={3.2} ry={4} fill={INK} />
        </g>
      )}
      {hurt && <path d="M20,-22 q4,-7 1,-12 q-6,4 -1,12z" fill="#9fd3ff" {...ink(2)} />}
    </g>
  );
}

/** ギザギザの しょうげき。 */
export function Impact({ x, y, r = 24, fill, inner = PAPER, points = 11, rot = 0, cls }: { x: number; y: number; r?: number; fill: string; inner?: string; points?: number; rot?: number; cls?: string }) {
  const pts = (R: number, ri: number) =>
    Array.from({ length: points * 2 }, (_, i) => {
      const rr = i % 2 === 0 ? R * (0.9 + ((i * 37) % 10) / 50) : ri;
      const a = (Math.PI * i) / points;
      return `${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`;
    }).join(' ');
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`} className={cls}>
      <polygon points={pts(r, r * 0.55)} fill={fill} {...ink(2.8)} />
      <polygon points={pts(r * 0.55, r * 0.3)} fill={inner} />
    </g>
  );
}

/** 4つかどの キラキラ。 */
export const Sparkle = ({ x, y, r = 7, fill = PAPER, cls = 'ill-twinkle', delay = 0 }: { x: number; y: number; r?: number; fill?: string; cls?: string; delay?: number }) => (
  <path
    className={cls}
    style={{ animationDelay: `${delay}s`, transformOrigin: `${x}px ${y}px`, transformBox: 'view-box' }}
    d={`M${x},${y - r} Q${x + r * 0.18},${y - r * 0.18} ${x + r},${y} Q${x + r * 0.18},${y + r * 0.18} ${x},${y + r} Q${x - r * 0.18},${y + r * 0.18} ${x - r},${y} Q${x - r * 0.18},${y - r * 0.18} ${x},${y - r}Z`}
    fill={fill}
    {...ink(2)}
  />
);

/** ほのお（しずく形）。 */
export const Flame = ({ x, y, s = 1, pal, cls = 'ill-flicker', delay = 0, rot = 0 }: { x: number; y: number; s?: number; pal: Pal; cls?: string; delay?: number; rot?: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
    <g className={cls} style={{ animationDelay: `${delay}s`, transformOrigin: '0px 12px', transformBox: 'fill-box' }}>
      <path d="M0,-22 C8,-10 16,-4 14,6 C12,15 5,19 0,19 C-6,19 -13,15 -14,6 C-15,-3 -6,-8 0,-22Z" fill={pal.main} {...ink(2.6)} />
      <path d="M0,-6 C4,0 8,3 7,8 C6,13 3,14 0,14 C-3,14 -6,12 -7,8 C-7,3 -3,1 0,-6Z" fill={pal.light} />
    </g>
  </g>
);

/** スピード線（右へ）。 */
export const Speed = ({ x, y, len = 40, n = 4, gap = 9, w = 3 }: { x: number; y: number; len?: number; n?: number; gap?: number; w?: number }) => (
  <g {...ink(w)} opacity={0.75}>
    {Array.from({ length: n }, (_, i) => (
      <line key={i} x1={x + (i % 2) * 8} y1={y + i * gap} x2={x + len - (i % 2) * 6} y2={y + i * gap} />
    ))}
  </g>
);

/** 書き文字（まんがの 音）。 */
export const Sfx = ({ x, y, text, size = 22, fill, rot = -8 }: { x: number; y: number; text: string; size?: number; fill: string; rot?: number }) => (
  <text
    x={x}
    y={y}
    transform={`rotate(${rot} ${x} ${y})`}
    textAnchor="middle"
    fontFamily="var(--font-display)"
    fontSize={size}
    fontWeight={900}
    fill={fill}
    stroke={INK}
    strokeWidth={5}
    paintOrder="stroke"
    strokeLinejoin="round"
  >
    {text}
  </text>
);

// ------------------------------------------------------------------ 背景（属性ごとの もよう）

export type BgKind = 'fire' | 'water' | 'wood' | 'bolt' | 'dark' | 'atk' | 'sup' | 'kosei' | 'special';

export function ArtBg({ kind, pal }: { kind: BgKind; pal: Pal }) {
  return (
    <g>
      <rect width="200" height="170" fill={pal.bg1} />
      <rect y="70" width="200" height="100" fill={pal.bg2} opacity={0.55} />
      {kind === 'fire' &&
        [10, 48, 86, 124, 162, 196].map((x, i) => (
          <path key={i} d={`M${x - 16},170 C${x - 16},150 ${x - 4},146 ${x},${126 - (i % 2) * 14} C${x + 4},146 ${x + 16},150 ${x + 16},170Z`} fill={pal.light} opacity={0.45} />
        ))}
      {kind === 'water' &&
        [40, 70, 100, 130, 160].map((y, i) => (
          <path key={i} d={`M-10,${y} Q15,${y - 9} 40,${y} T90,${y} T140,${y} T190,${y} T240,${y}`} fill="none" stroke={pal.light} strokeWidth={5} opacity={0.6} transform={`translate(${(i % 2) * -20} 0)`} />
        ))}
      {kind === 'wood' &&
        [
          [20, 30, 20],
          [170, 40, -30],
          [40, 140, 60],
          [180, 145, -50],
          [100, 20, 10],
        ].map(([x, y, r], i) => <path key={i} d="M0,-14 C10,-6 10,6 0,14 C-10,6 -10,-6 0,-14Z" transform={`translate(${x} ${y}) rotate(${r}) scale(1.1)`} fill={pal.light} opacity={0.6} />)}
      {kind === 'bolt' &&
        [15, 75, 135].map((x, i) => <path key={i} d={`M${x},0 L${x + 22},40 L${x + 6},44 L${x + 30},90`} fill="none" stroke={pal.light} strokeWidth={7} opacity={0.6} strokeLinejoin="round" />)}
      {kind === 'dark' && (
        <g>
          <rect width="200" height="170" fill={pal.dark} opacity={0.12} />
          <path d="M170,22 a16,16 0 1 0 12,26 a12,12 0 1 1 -12,-26z" fill={pal.light} opacity={0.75} />
          {[
            [25, 25],
            [60, 50],
            [130, 18],
            [150, 70],
            [20, 90],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2.2} fill={PAPER} opacity={0.8} />
          ))}
        </g>
      )}
      {kind === 'atk' &&
        Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2;
          return <path key={i} d={`M100,85 L${100 + Math.cos(a) * 160},${85 + Math.sin(a) * 160} L${100 + Math.cos(a + 0.12) * 160},${85 + Math.sin(a + 0.12) * 160}Z`} fill={pal.light} opacity={0.32} />;
        })}
      {kind === 'sup' &&
        [
          [30, 40, 18],
          [170, 30, 12],
          [160, 130, 20],
          [40, 140, 10],
        ].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={PAPER} opacity={0.55} />)}
      {(kind === 'special' || kind === 'kosei') && (
        <g opacity={0.4}>
          {['#ff8a8a', '#ffd36e', '#9be59b', '#8ac6ff', '#c7a4ff'].map((c, i) => (
            <path key={i} d={`M-20,${170 - i * 14} Q100,${60 - i * 14} 220,${170 - i * 14}`} fill="none" stroke={c} strokeWidth={12} />
          ))}
        </g>
      )}
    </g>
  );
}

// ------------------------------------------------------------------ 描きおろし（見本 8まい）

export const ILLUST: Record<string, Illust> = {
  // たいあたり：まるい からだで つっこむ
  c_tackle: (p) => (
    <g>
      <Shadow x={70} y={140} rx={30} />
      <Shadow x={160} y={140} rx={24} />
      <Speed x={8} y={78} len={42} n={5} gap={10} />
      {/* つちけむり */}
      {[
        [34, 132, 9],
        [22, 126, 6],
        [46, 138, 6],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={PAPER} {...ink(2.2)} />
      ))}
      <Foe x={160} y={108} rot={14} />
      <Impact x={124} y={92} r={26} fill={p.light} cls="ill-pulse" />
      <Buddy x={78} y={104} s={1.15} body={p.main} rot={-12} />
      <Sfx x={112} y={52} text="ドン！" size={28} fill={p.light} rot={-12} />
    </g>
  ),

  // かみつき：大きな あご
  c_bite: (p) => (
    <g>
      <g className="ill-shake" style={{ transformOrigin: '100px 85px', transformBox: 'view-box' }}>
        {/* うえの あご */}
        <path d="M14,70 C30,22 170,22 186,70 C160,58 40,58 14,70Z" fill={p.main} {...ink(3.4)} />
        {Array.from({ length: 8 }, (_, i) => {
          const x = 32 + i * 19;
          const y = 58 + Math.abs(i - 3.5) * 1.6;
          return <path key={i} d={`M${x - 8},${y} L${x},${y + 22} L${x + 8},${y}Z`} fill={PAPER} {...ink(2.4)} />;
        })}
        {/* したの あご */}
        <path d="M22,108 C46,152 154,152 178,108 C150,118 50,118 22,108Z" fill={p.main} {...ink(3.4)} />
        {Array.from({ length: 7 }, (_, i) => {
          const x = 42 + i * 19;
          const y = 116 - Math.abs(i - 3) * 1.4;
          return <path key={i} d={`M${x - 8},${y} L${x},${y - 20} L${x + 8},${y}Z`} fill={PAPER} {...ink(2.4)} />;
        })}
      </g>
      {/* かみあう いきおい */}
      <path d="M100,8 L100,24 M70,14 L76,28 M130,14 L124,28" {...ink(3)} />
      <path d="M100,162 L100,148 M70,158 L76,144 M130,158 L124,144" {...ink(3)} />
    </g>
  ),

  // ひのこ：ちいさな 火を ふく
  f_spark: (p) => (
    <g>
      <Shadow x={52} y={142} />
      <Shadow x={160} y={142} rx={22} />
      <Buddy x={52} y={110} body={p.main} belly={p.light} face="puff" />
      {/* とんでいく ひのこ */}
      {[
        [96, 92, 0.7, 0],
        [118, 70, 0.85, 0.15],
        [140, 96, 0.6, 0.3],
        [104, 120, 0.5, 0.45],
      ].map(([x, y, s, d], i) => (
        <Flame key={i} x={x} y={y} s={s} pal={p} delay={d} rot={70} />
      ))}
      {[
        [86, 80],
        [128, 112],
        [150, 70],
        [110, 52],
      ].map(([x, y], i) => (
        <circle key={i} className="ill-twinkle" style={{ animationDelay: `${i * 0.2}s`, transformOrigin: `${x}px ${y}px`, transformBox: 'view-box' }} cx={x} cy={y} r={3} fill={p.light} {...ink(1.6)} />
      ))}
      <Foe x={164} y={112} s={0.85} />
      <Flame x={176} y={72} s={0.55} pal={p} delay={0.2} />
    </g>
  ),

  // アクアカノン：水の大ほう
  water_sig: (p) => (
    <g>
      <Shadow x={40} y={146} />
      <Buddy x={40} y={114} body={p.main} belly={p.light} face="puff" s={0.95} />
      {/* ビーム */}
      <path d="M68,104 C110,92 150,86 196,70 L200,118 C150,114 110,116 68,118Z" fill={p.main} {...ink(3.2)} />
      <path className="ill-flow" d="M74,108 C112,100 150,94 196,82" fill="none" stroke={p.light} strokeWidth={6} strokeDasharray="18 12" strokeLinecap="round" />
      <path className="ill-flow" d="M76,114 C116,110 156,108 196,104" fill="none" stroke={PAPER} strokeWidth={3.5} strokeDasharray="10 14" strokeLinecap="round" style={{ animationDelay: '0.2s' }} />
      {/* わっか */}
      {[110, 150].map((x, i) => (
        <ellipse key={i} cx={x} cy={102 - i * 8} rx={9} ry={24} fill="none" stroke={PAPER} strokeWidth={3.2} opacity={0.9} />
      ))}
      {/* しぶき */}
      <Impact x={176} y={58} r={24} fill={p.light} points={9} />
      {[
        [150, 30, 5],
        [196, 30, 4],
        [186, 132, 5],
        [160, 140, 3.5],
      ].map(([x, y, r], i) => (
        <path key={i} className="ill-float" style={{ animationDelay: `${i * 0.25}s` }} d={`M${x},${y - r * 2} Q${x + r},${y - r * 0.2} ${x},${y + r} Q${x - r},${y - r * 0.2} ${x},${y - r * 2}Z`} fill={p.light} {...ink(1.8)} />
      ))}
    </g>
  ),

  // メガトンパンチ：ためて どかん
  ch_megapunch: (p) => (
    <g>
      {/* ため の ひかり */}
      <circle cx={100} cy={78} r={70} fill={p.light} opacity={0.35} />
      {[66, 50].map((r, i) => (
        <circle key={i} className="ill-pulse" style={{ animationDelay: `${i * 0.3}s` }} cx={100} cy={78} r={r} fill="none" stroke={i === 0 ? PAPER : p.light} strokeWidth={i === 0 ? 4 : 7} strokeDasharray={i === 0 ? '12 9' : undefined} />
      ))}
      {/* こぶし（大きく・ななめ） */}
      <g transform="translate(106 80) rotate(-18) scale(1.35)">
        {/* てくび */}
        <rect x={-62} y={-17} width={30} height={34} rx={8} fill={p.light} {...ink(3)} />
        <path d="M-54,-17 L-54,17 M-45,-17 L-45,17" {...ink(2.2)} />
        {/* てのひら */}
        <rect x={-36} y={-28} width={54} height={54} rx={17} fill={p.main} {...ink(3.2)} />
        {/* ゆび（にぎった） */}
        {[-21, -8, 5].map((y, i) => (
          <rect key={i} x={8} y={y - 7} width={24} height={14} rx={7} fill={p.main} {...ink(2.8)} />
        ))}
        {/* おやゆび */}
        <path d="M-8,14 C0,8 14,10 22,14 C26,18 22,24 16,24 L-4,24 C-10,24 -12,18 -8,14Z" fill={p.main} {...ink(2.8)} />
        <path d="M-26,-16 C-16,-24 -2,-24 6,-20" fill="none" stroke={PAPER} strokeWidth={4} strokeLinecap="round" opacity={0.75} />
      </g>
      {/* いきおいの 線 */}
      <path d="M30,40 L48,50 M24,72 L44,74 M30,104 L48,96" {...ink(3)} />
      <Sparkle x={168} y={34} r={9} fill={p.light} />
      <Sparkle x={176} y={110} r={7} delay={0.4} />
      <Sparkle x={36} y={136} r={6} delay={0.8} />
    </g>
  ),

  // ガード：おおきな たて
  c_guard: (p) => (
    <g>
      <Shadow x={92} y={148} rx={44} ry={7} />
      {/* はねかえされる こうげき */}
      {[
        [170, 40, 200],
        [182, 90, 180],
        [168, 136, 160],
      ].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <path d="M0,0 L22,0" {...ink(3.2)} />
          <path d="M22,0 L14,-6 M22,0 L14,6" {...ink(3.2)} />
        </g>
      ))}
      <Impact x={146} y={58} r={11} fill={PAPER} points={8} />
      <Impact x={150} y={110} r={10} fill={PAPER} points={8} />
      <Buddy x={60} y={112} s={0.8} body="#f2b705" face="calm" />
      {/* たて */}
      <g transform="translate(108 86)">
        <path d="M-34,-48 L34,-48 L34,0 C34,26 16,44 0,54 C-16,44 -34,26 -34,0Z" fill={p.main} {...ink(3.6)} />
        <path d="M-24,-38 L24,-38 L24,-2 C24,18 12,32 0,40 C-12,32 -24,18 -24,-2Z" fill={p.light} {...ink(2.4)} />
        <path d="M0,-26 L6,-10 L22,-10 L9,0 L14,16 L0,6 L-14,16 L-9,0 L-22,-10 L-6,-10Z" fill={PAPER} {...ink(2.2)} />
        <path d="M-28,-42 L-28,-6" stroke={PAPER} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
      </g>
      <Sparkle x={150} y={150} r={7} delay={0.3} />
    </g>
  ),

  // いやしのて：あたたかい 手と ハート
  ca_heal: (p) => (
    <g>
      {/* ひかり */}
      <circle cx={100} cy={98} r={52} fill={PAPER} opacity={0.55} />
      <circle cx={100} cy={98} r={34} fill={p.light} opacity={0.45} />
      {/* て */}
      <g transform="translate(100 124)">
        <path d="M-46,-6 C-40,-18 -30,-18 -26,-8 L-26,-34 C-26,-42 -14,-42 -14,-34 L-14,-44 C-14,-52 -2,-52 -2,-44 L-2,-42 C-2,-50 10,-50 10,-42 L10,-34 C10,-42 22,-42 22,-34 L22,4 C22,20 10,30 -6,30 C-22,30 -32,20 -38,8Z" fill="#ffd9b8" {...ink(3.2)} />
        <path d="M-14,-30 L-14,-6 M-2,-34 L-2,-6 M10,-30 L10,-6" {...ink(2)} opacity={0.6} />
      </g>
      {/* ハートと プラス */}
      {[
        [76, 54, 1, 0],
        [124, 44, 0.8, 0.5],
        [100, 30, 0.6, 1],
      ].map(([x, y, s, d], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <path className="ill-float" style={{ animationDelay: `${d}s` }} d="M0,12 C-18,0 -14,-14 -6,-14 C-2,-14 0,-10 0,-8 C0,-10 2,-14 6,-14 C14,-14 18,0 0,12Z" fill="#ff7a93" {...ink(2.6)} />
        </g>
      ))}
      {[
        [48, 96],
        [152, 84],
        [150, 130],
      ].map(([x, y], i) => (
        <g key={i} className="ill-float" style={{ animationDelay: `${0.3 + i * 0.4}s` }}>
          <path d={`M${x - 8},${y} L${x + 8},${y} M${x},${y - 8} L${x},${y + 8}`} stroke={INK} strokeWidth={7} strokeLinecap="round" />
          <path d={`M${x - 8},${y} L${x + 8},${y} M${x},${y - 8} L${x},${y + 8}`} stroke={p.main} strokeWidth={4} strokeLinecap="round" />
        </g>
      ))}
      <Sparkle x={40} y={40} r={6} />
      <Sparkle x={166} y={52} r={8} delay={0.5} />
    </g>
  ),

  // さいころアタック：ころがる さいころ
  gm_dice: (p) => (
    <g>
      <Shadow x={70} y={148} rx={30} />
      <Shadow x={146} y={148} rx={24} />
      {/* ころがった あと */}
      <path d="M10,120 Q40,80 64,96" fill="none" {...ink(2.6)} strokeDasharray="6 7" />
      <path d="M100,60 Q126,30 140,70" fill="none" {...ink(2.6)} strokeDasharray="6 7" />
      {/* さいころ 1 */}
      <g className="ill-spin" style={{ transformOrigin: '72px 112px', transformBox: 'view-box' }}>
        <g transform="translate(72 112) rotate(-16)">
          <rect x={-30} y={-30} width={60} height={60} rx={12} fill={PAPER} {...ink(3.4)} />
          {[
            [-15, -15],
            [15, -15],
            [-15, 0],
            [15, 0],
            [-15, 15],
            [15, 15],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={5.2} fill={INK} />
          ))}
        </g>
      </g>
      {/* さいころ 2 */}
      <g transform="translate(146 104) rotate(22)">
        <rect x={-24} y={-24} width={48} height={48} rx={10} fill={p.light} {...ink(3.2)} />
        <circle cx={-11} cy={-11} r={4.6} fill="#e8503a" />
        <circle cx={0} cy={0} r={4.6} fill="#e8503a" />
        <circle cx={11} cy={11} r={4.6} fill="#e8503a" />
      </g>
      <Sparkle x={36} y={50} r={9} fill="#ffd36e" />
      <Sparkle x={176} y={50} r={7} fill="#9be59b" delay={0.4} />
      <Sparkle x={112} y={150} r={6} fill="#8ac6ff" delay={0.8} />
    </g>
  ),
};
