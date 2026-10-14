import type { ReactElement, ReactNode } from 'react';
import { PALETTES, type Pal } from './palette';

/**
 * カードの 描きおろしイラスト（すっきりした 線と ぬりの SVG・トレカっぽい 迫力）。viewBox は 200×160。
 *  ・ぬり：グラデーション（gv-*）＋ 右下の かげ（2トーン）＋ 左上の ハイライト ＝ 立体感
 *  ・クレヨンの ガタガタ（#crayon）や ざらざらは つかわない（カードが ゆがんで 見えるため）
 *  ・構図：主役を 大きく・ななめに、手前と おくを つくる、ひかり（glow）と 集中線で 迫力
 * 動かしたい部分には ill-* の class（.gcard-anim の中でだけ CSS で 動く）。
 */
export type Illust = (pal: Pal) => ReactElement;

export const INK = '#33302b';
const PAPER = '#fffdf5';
const ink = (w = 3) => ({ stroke: INK, strokeWidth: w, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const });

/** パレット → グラデーションの id。 */
const keyOf = (p: Pal) => (Object.entries(PALETTES).find(([, v]) => v === p)?.[0] ?? 'atk') as keyof typeof PALETTES;
export const gv = (p: Pal | keyof typeof PALETTES) => `url(#gv-${typeof p === 'string' ? p : keyOf(p)})`;
export const gr = (p: Pal | keyof typeof PALETTES) => `url(#gr-${typeof p === 'string' ? p : keyOf(p)})`;

/** だ円の path。 */
export const E = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx},${cy} a${rx},${ry} 0 1 0 ${2 * rx},0 a${rx},${ry} 0 1 0 ${-2 * rx},0Z`;

/**
 * 立体ぬり：かげ色の 上に ずらした 本体色を かさね（右下に かげが のこる）、かげには ななめ線、
 * 左上に ハイライト、さいごに 線。id は カードの中で 一意に。
 */
function Vol({ id, d, fill, shade, off = [-5, -6], hi, w = 3.2, hatch = false }: { id: string; d: string; fill: string; shade: string; off?: [number, number]; hi?: ReactNode; w?: number; hatch?: boolean }) {
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <path d={d} />
        </clipPath>
      </defs>
      <path d={d} fill={shade} />
      <g clipPath={`url(#${id})`}>
        {hatch && <rect x={-400} y={-400} width={1000} height={1000} fill="url(#hatch)" />}
        <path d={d} fill={fill} transform={`translate(${off[0]} ${off[1]})`} />
        {hi}
      </g>
      <path d={d} fill="none" {...ink(w)} />
    </g>
  );
}

// ------------------------------------------------------------------ 部品

export const Shadow = ({ x, y, rx = 26, ry = 6, o = 0.2 }: { x: number; y: number; rx?: number; ry?: number; o?: number }) => <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={INK} opacity={o} />;

/** ひかりの たま（うしろに おく）。 */
export const Glow = ({ x, y, r, p, cls }: { x: number; y: number; r: number; p: Pal | 'white'; cls?: string }) => (
  <circle className={cls} cx={x} cy={y} r={r} fill={p === 'white' ? 'url(#gr-white)' : gr(p)} style={cls ? { transformOrigin: `${x}px ${y}px`, transformBox: 'view-box' } : undefined} />
);

/** 集中線（cx,cy に むかって）。 */
export function Radial({ cx, cy, n = 22, r0 = 40, r1 = 170, color = INK, o = 0.22, w = 0.06 }: { cx: number; cy: number; n?: number; r0?: number; r1?: number; color?: string; o?: number; w?: number }) {
  return (
    <g opacity={o}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + (i % 3) * 0.05;
        const ww = w * (0.6 + (i % 4) * 0.25);
        const rr0 = r0 * (0.85 + (i % 5) * 0.08);
        return (
          <polygon
            key={i}
            points={`${cx + Math.cos(a - ww) * r1},${cy + Math.sin(a - ww) * r1} ${cx + Math.cos(a + ww) * r1},${cy + Math.sin(a + ww) * r1} ${cx + Math.cos(a) * rr0},${cy + Math.sin(a) * rr0}`}
            fill={color}
          />
        );
      })}
    </g>
  );
}

/** ギザギザの しょうげき（3まい かさね＋しろい しん）。 */
export function Burst({ x, y, r = 30, p, rot = 0, points = 12, cls }: { x: number; y: number; r?: number; p: Pal; rot?: number; points?: number; cls?: string }) {
  const pts = (R: number, ri: number, jit: number) =>
    Array.from({ length: points * 2 }, (_, i) => {
      const rr = i % 2 === 0 ? R * (0.82 + (((i * 37 + jit) % 11) / 11) * 0.3) : ri;
      const a = (Math.PI * i) / points;
      return `${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`;
    }).join(' ');
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <g className={cls} style={cls ? { transformOrigin: '0px 0px', transformBox: 'view-box' } : undefined}>
        <circle r={r * 1.15} fill={gr(p)} />
        <polygon points={pts(r, r * 0.6, 3)} fill={p.main} {...ink(3)} />
        <polygon points={pts(r * 0.7, r * 0.42, 7)} fill={p.light} />
        <polygon points={pts(r * 0.42, r * 0.24, 5)} fill={PAPER} />
      </g>
    </g>
  );
}

/** 4つかどの キラキラ。 */
export const Sparkle = ({ x, y, r = 7, fill = PAPER, cls = 'ill-twinkle', delay = 0 }: { x: number; y: number; r?: number; fill?: string; cls?: string; delay?: number }) => (
  <path
    className={cls}
    style={{ animationDelay: `${delay}s`, transformOrigin: `${x}px ${y}px`, transformBox: 'view-box' }}
    d={`M${x},${y - r} Q${x + r * 0.16},${y - r * 0.16} ${x + r},${y} Q${x + r * 0.16},${y + r * 0.16} ${x},${y + r} Q${x - r * 0.16},${y + r * 0.16} ${x - r},${y} Q${x - r * 0.16},${y - r * 0.16} ${x},${y - r}Z`}
    fill={fill}
    {...ink(1.8)}
  />
);

/** ほのお（4そう：こい → いろ → あかるい → しろい しん）。 */
export function Flame({ x, y, s = 1, p, cls = 'ill-flicker', delay = 0, rot = 0 }: { x: number; y: number; s?: number; p: Pal; cls?: string; delay?: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <g className={cls} style={{ animationDelay: `${delay}s`, transformOrigin: '0px 20px', transformBox: 'view-box' }}>
        <path d="M0,-30 C6,-18 20,-12 19,4 C18,18 9,25 0,25 C-10,25 -19,18 -19,6 C-19,-6 -10,-10 -8,-20 C-4,-14 -3,-10 0,-30Z" fill={p.dark} {...ink(2.6)} />
        <path d="M0,-20 C5,-10 15,-6 14,6 C13,16 7,21 0,21 C-8,21 -14,16 -14,7 C-14,-2 -7,-6 -5,-12 C-2,-8 -1,-6 0,-20Z" fill={p.main} />
        <path d="M0,-6 C4,0 9,4 8,10 C7,16 4,18 0,18 C-4,18 -8,16 -8,10 C-8,5 -3,2 0,-6Z" fill={p.light} />
        <ellipse cx={0} cy={12} rx={3.5} ry={5} fill={PAPER} opacity={0.9} />
      </g>
    </g>
  );
}

/** しずく（ハイライトつき）。 */
export const Drop = ({ x, y, r = 6, p, cls = 'ill-float', delay = 0 }: { x: number; y: number; r?: number; p: Pal; cls?: string; delay?: number }) => (
  <g className={cls} style={{ animationDelay: `${delay}s` }}>
    <path d={`M${x},${y - r * 1.9} C${x + r * 0.5},${y - r * 0.9} ${x + r},${y - r * 0.3} ${x + r},${y + r * 0.2} A${r},${r} 0 1 1 ${x - r},${y + r * 0.2} C${x - r},${y - r * 0.3} ${x - r * 0.5},${y - r * 0.9} ${x},${y - r * 1.9}Z`} fill={p.light} {...ink(1.8)} />
    <ellipse cx={x - r * 0.35} cy={y} rx={r * 0.22} ry={r * 0.38} fill={PAPER} />
  </g>
);

/** 書き文字（まんがの 音）。 */
export const Sfx = ({ x, y, text, size = 22, fill, rot = -8 }: { x: number; y: number; text: string; size?: number; fill: string; rot?: number }) => (
  <text x={x} y={y} transform={`rotate(${rot} ${x} ${y})`} textAnchor="middle" fontFamily="var(--font-display)" fontSize={size} fontWeight={900} fill={fill} stroke={INK} strokeWidth={6} paintOrder="stroke" strokeLinejoin="round">
    {text}
  </text>
);

/** スピード線（はしる むきに ながい）。 */
export const Speed = ({ x, y, len = 40, n = 4, gap = 9, w = 3, o = 0.7 }: { x: number; y: number; len?: number; n?: number; gap?: number; w?: number; o?: number }) => (
  <g {...ink(w)} opacity={o}>
    {Array.from({ length: n }, (_, i) => (
      <line key={i} x1={x + (i % 2) * 10} y1={y + i * gap} x2={x + len - (i % 3) * 8} y2={y + i * gap} />
    ))}
  </g>
);

type Elem = 'fire' | 'water' | 'wood' | 'bolt' | 'dark' | 'none';

/** うで（ふちどり＋いろ）。 */
const Arm = ({ d, color }: { d: string; color: string }) => (
  <g>
    <path d={d} fill="none" stroke={INK} strokeWidth={10} strokeLinecap="round" />
    <path d={d} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" />
  </g>
);

/**
 * まるい いきもの（じぶん）。立体ぬり・目のハイライト・うで・属性の かざり。
 * pose：dash（つっこむ）／stand（たつ）／guard（かまえる）
 */
export function Buddy({
  id,
  x,
  y,
  s = 1,
  p,
  elem = 'none',
  face = 'fierce',
  pose = 'stand',
  flip = false,
  rot = 0,
  stretch = 1,
}: {
  id: string;
  x: number;
  y: number;
  s?: number;
  p: Pal;
  elem?: Elem;
  face?: 'fierce' | 'happy' | 'puff' | 'calm';
  pose?: 'dash' | 'stand' | 'guard';
  flip?: boolean;
  rot?: number;
  /** よこに のびる（つっこむ とき）。 */
  stretch?: number;
}) {
  const body = 'M-31,4 C-33,-23 -12,-34 4,-33 C24,-32 34,-15 32,5 C31,24 15,32 0,32 C-18,32 -30,22 -31,4Z';
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${(flip ? -s : s) * stretch} ${s / Math.sqrt(stretch)})`}>
      {/* かざり（うしろ） */}
      {elem === 'water' && <path d="M-20,-24 C-30,-46 -6,-52 2,-34 Z" fill={p.light} {...ink(2.6)} />}
      {elem === 'dark' && (
        <g>
          <path d="M-14,-28 L-22,-50 L-4,-32Z" fill={p.dark} {...ink(2.6)} />
          <path d="M12,-30 L18,-52 L24,-28Z" fill={p.dark} {...ink(2.6)} />
        </g>
      )}
      {pose === 'dash' && <Arm d="M-26,8 C-40,10 -48,4 -50,-2" color={p.main} />}
      {/* あし */}
      <ellipse cx={-13} cy={30} rx={9} ry={5.5} fill={p.dark} {...ink(2.6)} />
      <ellipse cx={13} cy={30} rx={9} ry={5.5} fill={p.dark} {...ink(2.6)} />
      {/* からだ */}
      <Vol
        id={`${id}-b`}
        d={body}
        fill={gv(p)}
        shade={p.dark}
        hi={
          <g>
            <path d="M-22,-14 C-18,-24 -8,-28 2,-28" fill="none" stroke={PAPER} strokeWidth={5} strokeLinecap="round" opacity={0.75} />
            <circle cx={-24} cy={-2} r={2.6} fill={PAPER} opacity={0.75} />
          </g>
        }
      />
      <path d={E(6, 12, 15, 12)} fill={PAPER} opacity={0.82} />
      {/* かざり（まえ） */}
      {elem === 'fire' && (
        <g transform="translate(-2 -33)">
          <path d="M0,-20 C6,-10 14,-6 12,4 C10,10 4,12 0,12 C-6,12 -12,8 -12,2 C-12,-6 -4,-8 0,-20Z" fill={p.light} {...ink(2.6)} />
          <path d="M0,-6 C3,-1 6,2 5,6 C4,9 2,10 0,10 C-3,10 -5,8 -5,5 C-5,2 -2,0 0,-6Z" fill={PAPER} />
        </g>
      )}
      {elem === 'wood' && <path d="M0,-32 C-4,-46 10,-54 20,-48 C16,-38 8,-32 0,-32Z" fill={p.light} {...ink(2.6)} />}
      {elem === 'bolt' && <path d="M2,-32 L-6,-46 L4,-46 L-2,-60" fill="none" stroke={p.dark} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />}
      {/* かお */}
      {(face === 'fierce' || face === 'puff') && (
        <g>
          <path d="M2,-15 L13,-10 M18,-10 L29,-15" {...ink(3.2)} />
          <ellipse cx={9} cy={-3} rx={4.2} ry={5.4} fill={INK} />
          <ellipse cx={23} cy={-3} rx={4.2} ry={5.4} fill={INK} />
          <circle cx={10.4} cy={-5} r={1.6} fill={PAPER} />
          <circle cx={24.4} cy={-5} r={1.6} fill={PAPER} />
          {face === 'fierce' ? <path d="M10,9 Q17,4 24,9" fill="none" {...ink(2.8)} /> : <path d={E(31, 9, 5, 5.5)} fill={INK} />}
        </g>
      )}
      {face === 'happy' && (
        <g>
          <path d="M5,-5 Q9,-12 13,-5 M18,-5 Q22,-12 26,-5" fill="none" {...ink(3)} />
          <path d="M8,5 Q15,15 23,5Z" fill="#e8503a" {...ink(2.4)} />
        </g>
      )}
      {face === 'calm' && (
        <g>
          <ellipse cx={9} cy={-4} rx={3.8} ry={4.8} fill={INK} />
          <ellipse cx={23} cy={-4} rx={3.8} ry={4.8} fill={INK} />
          <circle cx={10.2} cy={-6} r={1.4} fill={PAPER} />
          <circle cx={24.2} cy={-6} r={1.4} fill={PAPER} />
          <path d="M11,8 Q16,11 21,8" fill="none" {...ink(2.4)} />
        </g>
      )}
      <ellipse cx={-1} cy={6} rx={4} ry={2.6} fill="#ff8a9b" opacity={0.65} />
      {/* まえの うで */}
      {pose === 'dash' && <Arm d="M22,10 C34,8 42,0 46,-6" color={p.main} />}
      {pose === 'guard' && <Arm d="M20,12 C30,10 36,4 38,-2" color={p.main} />}
      {pose === 'stand' && <Arm d="M-28,10 C-36,14 -38,20 -36,24" color={p.main} />}
    </g>
  );
}

/** あいて（グレーの いきもの）。hurt だと ×め＋あせ。 */
export function Foe({ id, x, y, s = 1, hurt = true, rot = 0 }: { id: string; x: number; y: number; s?: number; hurt?: boolean; rot?: number }) {
  const body = 'M-27,2 C-28,-21 -10,-29 2,-28 C19,-27 28,-12 27,4 C26,21 12,28 0,28 C-15,28 -26,19 -27,2Z';
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <ellipse cx={-11} cy={27} rx={8} ry={5} fill="#6f6788" {...ink(2.4)} />
      <ellipse cx={11} cy={27} rx={8} ry={5} fill="#6f6788" {...ink(2.4)} />
      <Vol id={`${id}-f`} d={body} fill="url(#gv-foe)" shade="#6f6788" hi={<path d="M-18,-14 C-14,-21 -6,-24 2,-24" fill="none" stroke={PAPER} strokeWidth={4} strokeLinecap="round" opacity={0.6} />} />
      {hurt ? (
        <g {...ink(3)}>
          <path d="M-17,-9 L-9,-1 M-9,-9 L-17,-1" />
          <path d="M-3,-9 L5,-1 M5,-9 L-3,-1" />
          <path d="M-15,11 Q-9,6 -3,11 Q3,16 8,11" fill="none" />
        </g>
      ) : (
        <g>
          <ellipse cx={-12} cy={-5} rx={3.4} ry={4.2} fill={INK} />
          <ellipse cx={2} cy={-5} rx={3.4} ry={4.2} fill={INK} />
        </g>
      )}
      {hurt && <path d="M22,-22 q5,-8 1,-13 q-7,5 -1,13z" fill="#a8dbff" {...ink(2)} />}
    </g>
  );
}

/** くも（ふちどり＋かげ）。 */
const Cloud = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-30,8 C-36,8 -38,-4 -28,-6 C-28,-18 -10,-20 -6,-12 C0,-24 22,-22 22,-8 C34,-10 38,8 26,8Z" fill={PAPER} stroke="#9fb7c9" strokeWidth={2} strokeLinejoin="round" />
    <path d="M-24,6 C-10,10 10,10 24,6" fill="none" stroke="#d6e4ee" strokeWidth={3} strokeLinecap="round" />
  </g>
);

/** ちめん（おくゆき）。 */
const Ground = ({ y = 132, color }: { y?: number; color: string }) => (
  <g>
    <path d={`M0,${y} Q100,${y - 8} 200,${y} L200,160 L0,160Z`} fill={color} opacity={0.55} />
    <path d={`M0,${y} Q100,${y - 8} 200,${y}`} fill="none" {...ink(2.6)} opacity={0.6} />
    <path d={`M40,${y + 6} L10,160 M100,${y + 2} L100,160 M160,${y + 6} L190,160`} {...ink(1.6)} opacity={0.18} />
  </g>
);

/** りったいの さいころ（うえ・ひだり・みぎ の 3めん）。 */
function Die({ x, y, s = 1, rot = 0, faces, top, left, right, pip = INK }: { x: number; y: number; s?: number; rot?: number; faces: [number, number, number]; top: string; left: string; right: string; pip?: string }) {
  // めんの なかの 位置（u：よこ 0〜1、v：たて 0〜1）
  const L = (u: number, v: number) => [-34 + 34 * u, -18 + 18 * u + 38 * v] as const;
  const R = (u: number, v: number) => [34 * u, -18 * u + 38 * v] as const;
  const T = (u: number, v: number) => [-34 + 34 * u + 34 * v, -18 - 18 * u + 18 * v] as const;
  const PIPS: Record<number, [number, number][]> = {
    1: [[0.5, 0.5]],
    2: [[0.25, 0.25], [0.75, 0.75]],
    3: [[0.22, 0.22], [0.5, 0.5], [0.78, 0.78]],
    4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
    5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
    6: [[0.27, 0.2], [0.73, 0.2], [0.27, 0.5], [0.73, 0.5], [0.27, 0.8], [0.73, 0.8]],
  };
  const dots = (f: number, at: (u: number, v: number) => readonly [number, number], rx: number, ry: number, ang: number, color: string) =>
    PIPS[f].map(([u, v], i) => {
      const [px, py] = at(u, v);
      return <ellipse key={`${f}-${i}`} cx={px} cy={py} rx={rx} ry={ry} transform={`rotate(${ang} ${px} ${py})`} fill={color} />;
    });
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M-34,-18 L0,-36 L34,-18 L0,0Z" fill={top} {...ink(3.2)} />
      <path d="M-34,-18 L0,0 L0,38 L-34,20Z" fill={left} {...ink(3.2)} />
      <path d="M34,-18 L0,0 L0,38 L34,20Z" fill={right} {...ink(3.2)} />
      {dots(faces[0], T, 6, 3.4, -28, faces[0] === 1 ? '#e8503a' : pip)}
      {dots(faces[1], L, 3.2, 4.4, 28, pip)}
      {dots(faces[2], R, 3.2, 4.4, -28, pip)}
      <path d="M-26,-20 L-4,-31" stroke={PAPER} strokeWidth={3} strokeLinecap="round" opacity={0.9} />
    </g>
  );
}

// ------------------------------------------------------------------ 背景（属性ごとの もよう）

export type BgKind = 'fire' | 'water' | 'wood' | 'bolt' | 'dark' | 'atk' | 'sup' | 'kosei' | 'special';

export function ArtBg({ kind, pal }: { kind: BgKind; pal: Pal }) {
  return (
    <g>
      <rect width="200" height="160" fill={pal.bg1} />
      <rect width="200" height="160" fill={gr(pal)} opacity={0.6} />
      {kind === 'fire' &&
        [12, 50, 88, 126, 164, 198].map((x, i) => (
          <path key={i} d={`M${x - 18},160 C${x - 18},138 ${x - 4},134 ${x},${112 - (i % 2) * 16} C${x + 4},134 ${x + 18},138 ${x + 18},160Z`} fill={pal.light} opacity={0.4} />
        ))}
      {kind === 'water' &&
        [36, 64, 92, 120, 148].map((y, i) => (
          <path key={i} d={`M-10,${y} Q15,${y - 9} 40,${y} T90,${y} T140,${y} T190,${y} T240,${y}`} fill="none" stroke={pal.light} strokeWidth={5} opacity={0.5} transform={`translate(${(i % 2) * -20} 0)`} />
        ))}
      {kind === 'wood' &&
        [
          [20, 28, 20],
          [176, 36, -30],
          [34, 132, 60],
          [184, 136, -50],
          [100, 16, 10],
        ].map(([x, y, r], i) => <path key={i} d="M0,-14 C10,-6 10,6 0,14 C-10,6 -10,-6 0,-14Z" transform={`translate(${x} ${y}) rotate(${r}) scale(1.1)`} fill={pal.light} opacity={0.55} />)}
      {kind === 'bolt' &&
        [15, 75, 135].map((x, i) => <path key={i} d={`M${x},0 L${x + 22},40 L${x + 6},44 L${x + 30},90`} fill="none" stroke={pal.light} strokeWidth={7} opacity={0.55} strokeLinejoin="round" />)}
      {kind === 'dark' && (
        <g>
          <rect width="200" height="160" fill={pal.dark} opacity={0.14} />
          <path d="M170,20 a16,16 0 1 0 12,26 a12,12 0 1 1 -12,-26z" fill={pal.light} opacity={0.75} />
          {[
            [25, 25],
            [60, 46],
            [130, 16],
            [150, 66],
            [20, 86],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2.2} fill={PAPER} opacity={0.8} />
          ))}
        </g>
      )}
      {kind === 'atk' && <Radial cx={100} cy={80} n={18} r0={10} r1={190} color={pal.light} o={0.45} w={0.08} />}
      {kind === 'sup' &&
        [
          [30, 36, 18],
          [172, 28, 12],
          [164, 124, 20],
          [38, 130, 10],
        ].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={PAPER} opacity={0.5} />)}
      {(kind === 'special' || kind === 'kosei') && (
        <g opacity={0.38}>
          {['#ff8a8a', '#ffd36e', '#9be59b', '#8ac6ff', '#c7a4ff'].map((c, i) => (
            <path key={i} d={`M-20,${160 - i * 14} Q100,${50 - i * 14} 220,${160 - i * 14}`} fill="none" stroke={c} strokeWidth={12} />
          ))}
        </g>
      )}
    </g>
  );
}

// ------------------------------------------------------------------ 描きおろし（見本 8まい）

export const ILLUST: Record<string, Illust> = {
  // たいあたり：草原。ざんぞうを のこして つっこみ、あいては ふっとぶ
  c_tackle: (p) => (
    <g>
      <defs>
        <linearGradient id="tk-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc8ff" />
          <stop offset="0.75" stopColor="#e8f6ff" />
        </linearGradient>
      </defs>
      <rect width={200} height={160} fill="url(#tk-sky)" />
      <circle cx={26} cy={18} r={38} fill="#fff6c2" opacity={0.75} filter="url(#soft)" />
      <Cloud x={150} y={26} s={0.9} />
      <Cloud x={70} y={16} s={0.6} />
      <path d="M0,96 Q34,74 70,90 T140,82 T200,88 L200,160 L0,160Z" fill="#bfe6a6" />
      <path d="M0,110 Q50,96 100,108 T200,104 L200,160 L0,160Z" fill="#93d27c" />
      <path d="M0,124 Q100,114 200,124 L200,160 L0,160Z" fill="#ead8aa" {...ink(2.4)} />
      {[20, 58, 96, 140, 178].map((x, i) => (
        <path key={i} d={`M${x},${126 - (i % 2) * 2} l3,-7 l2,6 l3,-8 l2,9`} fill="none" stroke="#5fa04a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <Radial cx={124} cy={84} n={26} r0={22} r1={170} color={PAPER} o={0.45} />
      {/* ふっとぶ あいて */}
      <Shadow x={162} y={134} rx={18} ry={4} o={0.14} />
      <path d="M128,90 C140,84 148,84 154,88" fill="none" {...ink(2.4)} strokeDasharray="5 6" opacity={0.6} />
      <Foe id="tk" x={160} y={90} s={0.74} rot={30} />
      {[
        [148, 60],
        [172, 64],
        [160, 54],
      ].map(([x, y], i) => (
        <Sparkle key={i} x={x} y={y} r={4} fill="#ffe27a" delay={i * 0.2} />
      ))}
      <g filter="url(#glow)">
        <Burst x={124} y={82} r={32} p={p} cls="ill-pulse" />
      </g>
      {[
        [104, 44, 5, 20],
        [186, 116, 6, -10],
        [146, 122, 4, 40],
        [126, 30, 4, 0],
        [96, 112, 3.5, 60],
      ].map(([x, y, r, a], i) => (
        <g key={i} transform={`rotate(${a} ${x} ${y})`}>
          <rect x={x - r} y={y - r * 0.8} width={r * 2} height={r * 1.6} rx={1.5} fill="#c9b79a" {...ink(1.8)} />
          <rect x={x - r} y={y - r * 0.8} width={r} height={r * 0.6} fill="#e8dcc4" />
        </g>
      ))}
      {/* ざんぞう */}
      <g opacity={0.16}>
        <Buddy id="tk-a1" x={40} y={106} s={1.2} p={p} pose="dash" rot={-16} stretch={1.1} />
      </g>
      <g opacity={0.3}>
        <Buddy id="tk-a2" x={58} y={102} s={1.22} p={p} pose="dash" rot={-16} stretch={1.1} />
      </g>
      <Shadow x={72} y={140} rx={36} ry={7} />
      <Speed x={0} y={70} len={40} n={6} gap={10} w={3.4} o={0.55} />
      <Buddy id="tk" x={78} y={98} s={1.25} p={p} pose="dash" rot={-16} stretch={1.12} />
      {/* てまえの つちけむり（ぼかし＋くっきり） */}
      <circle cx={18} cy={150} r={16} fill={PAPER} opacity={0.8} filter="url(#soft)" />
      {[
        [34, 138, 11],
        [16, 130, 8],
        [50, 148, 9],
      ].map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} fill={PAPER} {...ink(2)} />
          <circle cx={x + r * 0.3} cy={y + r * 0.3} r={r * 0.55} fill="#e8e1d2" />
        </g>
      ))}
      <Sfx x={60} y={34} text="ドン！" size={30} fill="#ffe27a" rot={-12} />
    </g>
  ),

  // かみつき：画面いっぱいの あごが かみあう しゅんかん
  c_bite: (p) => (
    <g>
      <rect width={200} height={160} fill={p.dark} opacity={0.25} />
      <Radial cx={100} cy={80} n={28} r0={30} r1={160} color={PAPER} o={0.35} />
      <Burst x={100} y={80} r={22} p={p} cls="ill-pulse" />
      <g className="ill-shake" style={{ transformOrigin: '100px 80px', transformBox: 'view-box' }}>
        <Vol id="bt-u" d="M-6,62 C10,-4 190,-4 206,62 C176,50 24,50 -6,62Z" fill={gv(p)} shade={p.dark} off={[0, -6]} />
        <path d="M14,50 C50,38 150,38 186,50" fill="none" stroke={PAPER} strokeWidth={4} opacity={0.5} strokeLinecap="round" />
        {Array.from({ length: 9 }, (_, i) => {
          const x = 16 + i * 21;
          const y = 52 + Math.abs(i - 4) * 1.8;
          const h = 26 - Math.abs(i - 4) * 2.4;
          return (
            <g key={i}>
              <path d={`M${x - 9},${y} L${x},${y + h} L${x + 9},${y}Z`} fill={PAPER} {...ink(2.4)} />
              <path d={`M${x - 4},${y + 3} L${x},${y + h * 0.6}`} stroke="#d9d2c4" strokeWidth={2.2} strokeLinecap="round" />
            </g>
          );
        })}
        <Vol id="bt-d" d="M4,104 C30,166 170,166 196,104 C160,116 40,116 4,104Z" fill={gv(p)} shade={p.dark} off={[0, -6]} />
        {Array.from({ length: 8 }, (_, i) => {
          const x = 27 + i * 21;
          const y = 112 - Math.abs(i - 3.5) * 1.6;
          const h = 22 - Math.abs(i - 3.5) * 2.2;
          return (
            <g key={i}>
              <path d={`M${x - 9},${y} L${x},${y - h} L${x + 9},${y}Z`} fill={PAPER} {...ink(2.4)} />
              <path d={`M${x - 4},${y - 3} L${x},${y - h * 0.6}`} stroke="#d9d2c4" strokeWidth={2.2} strokeLinecap="round" />
            </g>
          );
        })}
      </g>
      <path d="M100,2 L100,16 M62,8 L70,22 M138,8 L130,22" {...ink(3.4)} />
      <Sparkle x={30} y={80} r={8} fill={p.light} />
      <Sparkle x={172} y={78} r={10} fill={p.light} delay={0.4} />
    </g>
  ),

  // ひのこ：ゆうやけの 火山。ほのおの子が 火のこを ふきつける
  f_spark: (p) => (
    <g>
      <defs>
        <linearGradient id="fs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff8a4c" />
          <stop offset="0.6" stopColor="#ffd59a" />
        </linearGradient>
      </defs>
      <rect width={200} height={160} fill="url(#fs-sky)" />
      {/* とおくの 火山 */}
      <path d="M96,96 L128,46 L140,52 L152,44 L186,96Z" fill="#a8583a" opacity={0.55} />
      <ellipse cx={142} cy={44} rx={18} ry={8} fill="#ffe27a" opacity={0.8} filter="url(#soft)" />
      <path d="M134,40 q4,-12 10,-4 q6,-10 10,2" fill="none" stroke="#7a3a24" strokeWidth={3} opacity={0.4} />
      {/* ゆらゆら（かげろう） */}
      {[60, 74].map((y, i) => (
        <path key={i} d={`M10,${y} q10,-4 20,0 t20,0 t20,0`} fill="none" stroke={PAPER} strokeWidth={2} opacity={0.4} />
      ))}
      {/* いわの じめん＋ようがんの ひび */}
      <path d="M0,118 Q60,106 110,116 T200,112 L200,160 L0,160Z" fill="#6e3b2a" {...ink(2.4)} />
      <path d="M0,130 Q70,122 130,132 T200,128 L200,160 L0,160Z" fill="#54291d" />
      <path d="M30,140 l14,-6 l10,8 l16,-4 M120,146 l12,-8 l14,6 l10,-5" fill="none" stroke="#ffb347" strokeWidth={3} strokeLinecap="round" filter="url(#glow)" />
      <Glow x={150} y={84} r={50} p={p} />
      {/* あいて（こげて けむり） */}
      <Shadow x={160} y={128} rx={22} ry={5} o={0.22} />
      <Foe id="fs" x={162} y={98} s={0.82} rot={8} />
      {[
        [176, 62, 6],
        [184, 50, 4.5],
        [170, 52, 3.5],
      ].map(([x, y, r], i) => (
        <circle key={i} className="ill-float" style={{ animationDelay: `${i * 0.3}s` }} cx={x} cy={y} r={r} fill="#9a9488" opacity={0.75} />
      ))}
      <Flame x={168} y={78} s={0.5} p={p} delay={0.3} />
      {/* ふきだす 火のこ：ひかる すじ ＋ ほのお */}
      <path d="M76,82 C100,66 126,68 148,82" fill="none" stroke={p.light} strokeWidth={14} opacity={0.55} strokeLinecap="round" filter="url(#glow)" />
      <path d="M78,82 C100,70 124,72 146,82" fill="none" stroke={PAPER} strokeWidth={4} opacity={0.8} strokeLinecap="round" />
      {[
        [96, 74, 0.62, 0, 70],
        [118, 64, 0.8, 0.15, 80],
        [140, 80, 0.66, 0.3, 95],
        [106, 96, 0.5, 0.45, 60],
        [130, 100, 0.42, 0.1, 100],
      ].map(([x, y, s, d, r], i) => (
        <Flame key={i} x={x} y={y} s={s} p={p} delay={d} rot={r} />
      ))}
      {/* まう ひのこ（てまえは ぼかし） */}
      {[
        [86, 58],
        [128, 46],
        [152, 58],
        [100, 116],
        [146, 108],
        [60, 40],
      ].map(([x, y], i) => (
        <circle key={i} className="ill-twinkle" style={{ animationDelay: `${i * 0.2}s`, transformOrigin: `${x}px ${y}px`, transformBox: 'view-box' }} cx={x} cy={y} r={3} fill="#ffe27a" {...ink(1.4)} />
      ))}
      <circle cx={186} cy={140} r={9} fill="#ffb347" opacity={0.7} filter="url(#soft)" />
      <circle cx={10} cy={20} r={7} fill="#ffe27a" opacity={0.7} filter="url(#soft)" />
      {/* じぶん */}
      <Shadow x={50} y={132} rx={30} ry={6} o={0.28} />
      <Buddy id="fs" x={48} y={96} s={1.08} p={p} elem="fire" face="puff" rot={-6} />
      <Sfx x={56} y={30} text="ボッ" size={26} fill="#ffe27a" rot={-14} />
    </g>
  ),

  // アクアカノン：うみべ。大ほうりゅうが まっすぐ つらぬく
  water_sig: (p) => (
    <g>
      <defs>
        <linearGradient id="wa-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fd8ff" />
          <stop offset="1" stopColor="#e9f8ff" />
        </linearGradient>
        <linearGradient id="wa-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5aa9f0" />
          <stop offset="1" stopColor="#1c4fb0" />
        </linearGradient>
      </defs>
      <rect width={200} height={160} fill="url(#wa-sky)" />
      <Cloud x={40} y={22} s={0.7} />
      <Cloud x={120} y={14} s={0.5} />
      {/* うみ */}
      <path d="M0,70 L200,66 L200,160 L0,160Z" fill="url(#wa-sea)" />
      <path d="M0,70 L200,66" stroke={PAPER} strokeWidth={2} opacity={0.7} />
      {[84, 100, 116].map((y, i) => (
        <path key={i} d={`M${-10 + i * 12},${y} q10,-4 20,0 t20,0 M${90 + i * 8},${y + 6} q10,-4 20,0 t20,0`} fill="none" stroke={PAPER} strokeWidth={2} opacity={0.45} />
      ))}
      {/* おくの 大なみ */}
      <path d="M150,70 C150,40 190,30 200,46 L200,70Z" fill="#7cc4ff" {...ink(2.2)} />
      <path d="M160,52 C168,42 182,40 190,46" fill="none" stroke={PAPER} strokeWidth={3} strokeLinecap="round" />
      <Radial cx={176} cy={96} n={22} r0={16} r1={180} color={PAPER} o={0.35} />
      {/* ビーム（ひかる ふち＋しろい しん） */}
      <g filter="url(#glow)">
        <path d="M54,88 C100,80 150,76 204,70 L204,124 C150,118 100,116 54,110Z" fill={gv(p)} {...ink(3.4)} />
      </g>
      <path d="M58,99 C104,94 150,92 204,92" fill="none" stroke={PAPER} strokeWidth={7} strokeLinecap="round" opacity={0.9} />
      <path className="ill-flow" d="M60,92 C104,84 150,80 204,78" fill="none" stroke={p.light} strokeWidth={5} strokeDasharray="20 12" strokeLinecap="round" />
      <path className="ill-flow" d="M62,106 C108,106 152,108 204,112" fill="none" stroke={p.light} strokeWidth={4} strokeDasharray="12 14" strokeLinecap="round" style={{ animationDelay: '0.2s' }} />
      {[96, 130].map((x, i) => (
        <ellipse key={i} cx={x} cy={99 - i * 2} rx={8} ry={24} fill="none" stroke={PAPER} strokeWidth={3.4} opacity={0.95} />
      ))}
      {/* あわ */}
      {[
        [80, 124, 3],
        [110, 74, 2.6],
        [150, 126, 3.4],
        [140, 72, 2.2],
      ].map(([x, y, r], i) => (
        <circle key={i} className="ill-float" style={{ animationDelay: `${i * 0.25}s` }} cx={x} cy={y} r={r} fill="none" stroke={PAPER} strokeWidth={1.6} />
      ))}
      {/* しぶきの おうかん */}
      <g transform="translate(176 96) rotate(-90) scale(0.95)">
        <path d="M-22,14 L-28,-10 L-14,4 L-10,-24 L0,0 L8,-28 L12,2 L26,-14 L22,14Z" fill={p.light} {...ink(2.8)} />
        <ellipse cx={0} cy={14} rx={24} ry={7} fill={PAPER} {...ink(2.4)} />
      </g>
      {[
        [112, 40, 5],
        [92, 26, 4],
        [188, 140, 6],
        [160, 146, 4],
        [132, 56, 3.6],
      ].map(([x, y, r], i) => (
        <Drop key={i} x={x} y={y} r={r} p={p} delay={i * 0.22} />
      ))}
      {/* じぶん（いわの 上） */}
      <path d="M2,138 Q4,118 34,116 Q66,116 68,138 Q66,150 34,152 Q4,150 2,138Z" fill="#8e8a80" {...ink(2.6)} />
      <path d="M10,128 Q24,120 40,122" fill="none" stroke="#c9c4b8" strokeWidth={3} strokeLinecap="round" />
      <Buddy id="wa" x={34} y={92} s={1.02} p={p} elem="water" face="puff" rot={-4} />
      <circle cx={194} cy={20} r={10} fill={PAPER} opacity={0.6} filter="url(#soft)" />
      <Sfx x={104} y={146} text="ドバァッ" size={22} fill={p.light} rot={-4} />
    </g>
  ),

  // メガトンパンチ：がめんから とびだす 巨大な こぶし
  ch_megapunch: (p) => (
    <g>
      <Radial cx={98} cy={86} n={30} r0={44} r1={190} o={0.28} />
      <Glow x={98} y={86} r={78} p={p} cls="ill-pulse" />
      {[66, 50].map((r, i) => (
        <circle key={i} className="ill-pulse" style={{ animationDelay: `${i * 0.3}s`, transformOrigin: '98px 86px', transformBox: 'view-box' }} cx={98} cy={86} r={r} fill="none" stroke={i === 0 ? PAPER : p.light} strokeWidth={i === 0 ? 4 : 7} strokeDasharray={i === 0 ? '14 9' : undefined} />
      ))}
      <path d="M0,140 L200,140 L200,160 L0,160Z" fill={p.bg2} opacity={0.7} />
      <path d="M112,140 L100,150 L106,160 M112,140 L126,152 L120,160 M112,140 L84,146 M112,140 L146,144" fill="none" {...ink(2.6)} />
      <g transform="translate(100 92) rotate(-16) scale(1.42)">
        <Vol id="mp-w" d="M-64,-16 L-36,-18 L-36,18 L-64,16Z" fill="url(#gv-gold)" shade="#b57c00" off={[0, -3]} w={2.8} />
        <path d="M-56,-17 L-56,17 M-46,-18 L-46,18" {...ink(2)} />
        <Vol
          id="mp-p"
          d="M-38,-12 C-38,-26 -28,-30 -16,-30 L8,-30 C18,-30 22,-24 22,-16 L22,16 C22,24 16,28 8,28 L-24,28 C-34,28 -38,22 -38,12Z"
          fill={gv(p)}
          shade={p.dark}
          hi={<path d="M-28,-20 C-18,-26 -4,-26 6,-24" fill="none" stroke={PAPER} strokeWidth={4.5} strokeLinecap="round" opacity={0.8} />}
        />
        {[-21, -7, 7].map((y, i) => (
          <Vol key={i} id={`mp-f${i}`} d={`M12,${y - 7} L30,${y - 7} C36,${y - 7} 38,${y - 3} 38,${y} C38,${y + 4} 36,${y + 7} 30,${y + 7} L12,${y + 7}Z`} fill={gv(p)} shade={p.dark} off={[-2, -3]} w={2.6} />
        ))}
        <Vol id="mp-t" d="M-10,14 C-2,8 14,10 24,15 C28,19 24,26 18,26 L-6,26 C-12,26 -14,19 -10,14Z" fill={gv(p)} shade={p.dark} off={[-2, -3]} w={2.6} />
        <path d="M-32,0 L-16,0" stroke={PAPER} strokeWidth={2} strokeDasharray="3 3" opacity={0.8} />
      </g>
      <path d="M10,46 L32,58 M6,86 L28,88 M10,124 L32,114" {...ink(3.4)} />
      <Sparkle x={34} y={22} r={10} fill={p.light} />
      <Sparkle x={186} y={106} r={7} delay={0.4} />
      <Sparkle x={40} y={140} r={7} fill={p.light} delay={0.8} />
    </g>
  ),

  // ガード：ひかる たてで こうげきを はじく
  c_guard: (p) => (
    <g>
      <Ground y={130} color={p.bg2} />
      <path className="ill-pulse" d="M28,132 C28,40 172,40 172,132" fill={p.light} opacity={0.28} stroke={PAPER} strokeWidth={3} style={{ transformOrigin: '100px 132px', transformBox: 'view-box' }} />
      {[
        [182, 78, 196],
        [192, 104, 182],
        [180, 134, 166],
      ].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <path d="M0,0 L26,0" stroke={INK} strokeWidth={7} strokeLinecap="round" />
          <path d="M0,0 L26,0" stroke="#e8503a" strokeWidth={3.4} strokeLinecap="round" />
          <path d="M26,0 L16,-7 M26,0 L16,7" {...ink(3.2)} />
        </g>
      ))}
      <Burst x={152} y={76} r={13} p={PALETTES.bolt} points={9} />
      <Burst x={156} y={118} r={11} p={PALETTES.bolt} points={9} />
      <Shadow x={64} y={138} rx={26} ry={5} />
      <Buddy id="gd" x={62} y={108} s={0.86} p={PALETTES.bolt} face="calm" pose="guard" />
      <g transform="translate(108 78) rotate(-8)">
        <Vol id="gd-r" d="M-38,-52 L38,-52 L38,0 C38,30 18,48 0,60 C-18,48 -38,30 -38,0Z" fill="url(#gv-gold)" shade="#b57c00" off={[-3, -4]} w={3.6} />
        <Vol
          id="gd-i"
          d="M-29,-43 L29,-43 L29,-2 C29,22 14,37 0,47 C-14,37 -29,22 -29,-2Z"
          fill={gv(p)}
          shade={p.dark}
          w={2.6}
          hi={<path d="M-22,-36 L-22,6" stroke={PAPER} strokeWidth={5} strokeLinecap="round" opacity={0.6} />}
        />
        <path d="M0,-28 L7,-11 L25,-11 L10,0 L16,18 L0,7 L-16,18 L-10,0 L-25,-11 L-7,-11Z" fill="url(#gv-gold)" {...ink(2.4)} />
        {[
          [-30, -46],
          [30, -46],
          [0, 52],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3.2} fill={PAPER} {...ink(1.6)} />
        ))}
      </g>
      <Sparkle x={88} y={22} r={8} />
      <Sparkle x={136} y={140} r={6} delay={0.5} />
    </g>
  ),

  // いやしのて：あたたかい 手から ひかりと ハート
  ca_heal: (p) => (
    <g>
      {[
        [30, 30, 14],
        [170, 40, 18],
        [160, 130, 12],
        [40, 128, 16],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={PAPER} opacity={0.55} filter="url(#soft)" />
      ))}
      <Radial cx={100} cy={70} n={18} r0={30} r1={150} color={PAPER} o={0.55} w={0.09} />
      <Glow x={100} y={74} r={64} p="white" cls="ill-pulse" />
      <g transform="translate(100 118) rotate(-6)">
        <Vol
          id="hl-h"
          d="M-48,-4 C-42,-18 -30,-18 -26,-8 L-26,-36 C-26,-45 -13,-45 -13,-36 L-13,-46 C-13,-55 0,-55 0,-46 L0,-44 C0,-53 13,-53 13,-44 L13,-36 C13,-45 26,-45 26,-36 L26,4 C26,22 12,32 -6,32 C-24,32 -34,22 -40,10Z"
          fill="url(#gv-skin)"
          shade="#e39a72"
          off={[-3, -4]}
          hi={<path d="M-20,-30 L-20,-10 M-6,-38 L-6,-14" stroke={PAPER} strokeWidth={3.4} strokeLinecap="round" opacity={0.7} />}
        />
        <path d="M-13,-30 L-13,-8 M0,-34 L0,-8 M13,-30 L13,-8" {...ink(2)} opacity={0.45} />
      </g>
      {[
        [74, 50, 1.15, 0],
        [128, 40, 0.95, 0.5],
        [102, 22, 0.7, 1],
      ].map(([x, y, s, d], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <g className="ill-float" style={{ animationDelay: `${d}s` }}>
            <path d="M0,13 C-20,0 -16,-15 -7,-15 C-2,-15 0,-11 0,-9 C0,-11 2,-15 7,-15 C16,-15 20,0 0,13Z" fill="#ff6f8c" {...ink(2.6)} />
            <path d="M-9,-9 C-6,-11 -3,-10 -2,-8" fill="none" stroke={PAPER} strokeWidth={3} strokeLinecap="round" />
          </g>
        </g>
      ))}
      {[
        [44, 92],
        [158, 84],
        [152, 126],
      ].map(([x, y], i) => (
        <g key={i} className="ill-float" style={{ animationDelay: `${0.3 + i * 0.4}s` }}>
          <path d={`M${x - 9},${y} L${x + 9},${y} M${x},${y - 9} L${x},${y + 9}`} stroke={INK} strokeWidth={8} strokeLinecap="round" />
          <path d={`M${x - 9},${y} L${x + 9},${y} M${x},${y - 9} L${x},${y + 9}`} stroke={p.main} strokeWidth={4.5} strokeLinecap="round" />
        </g>
      ))}
      <Sparkle x={58} y={24} r={7} />
      <Sparkle x={178} y={98} r={8} delay={0.5} />
      <Sparkle x={26} y={68} r={6} delay={1} />
    </g>
  ),

  // さいころアタック：りったいの さいころが ころがって ぶつかる
  gm_dice: () => (
    <g>
      <Ground y={128} color="#f3e3ff" />
      <Radial cx={120} cy={96} n={24} r0={20} r1={170} o={0.18} />
      <path d="M4,112 Q26,72 50,84" fill="none" {...ink(2.6)} strokeDasharray="6 7" />
      <path d="M112,70 Q132,44 150,82" fill="none" {...ink(2.6)} strokeDasharray="6 7" />
      <Shadow x={70} y={140} rx={34} ry={6} />
      <g className="ill-spin" style={{ transformOrigin: '68px 96px', transformBox: 'view-box' }}>
        <Die x={68} y={96} s={1.05} rot={-10} faces={[1, 5, 3]} top="#ffffff" left="#ece6da" right="#cfc6b6" />
      </g>
      <Shadow x={158} y={140} rx={22} ry={4} o={0.15} />
      <Die x={156} y={108} s={0.66} rot={18} faces={[2, 4, 6]} top="#fff6c2" left="#ffd36e" right="#e0a90c" />
      <Burst x={118} y={110} r={16} p={PALETTES.bolt} points={10} cls="ill-pulse" />
      <Sparkle x={34} y={40} r={10} fill="#ffd36e" />
      <Sparkle x={118} y={30} r={8} fill="#9be59b" delay={0.4} />
      <Sparkle x={182} y={130} r={7} fill="#8ac6ff" delay={0.8} />
      <Sparkle x={112} y={140} r={6} fill="#ff8a8a" delay={0.2} />
      <Sfx x={60} y={26} text="コロコロ" size={18} fill="#ffd36e" rot={-10} />
    </g>
  ),
};
