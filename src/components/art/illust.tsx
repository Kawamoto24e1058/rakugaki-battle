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
export const keyOf = (p: Pal) => (Object.entries(PALETTES).find(([, v]) => v === p)?.[0] ?? 'atk') as keyof typeof PALETTES;
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
  // たいあたり：つやつやの 大きな たまが ななめに つっこみ、しょうげきで はじける
  c_tackle: (p) => (
    <g>
      <defs>
        <radialGradient id="tk-bg" cx="0.68" cy="0.42" r="0.85">
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset="0.45" stopColor={p.bg2} />
          <stop offset="1" stopColor={p.dark} />
        </radialGradient>
        <radialGradient id="tk-ball" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.12" stopColor={p.light} />
          <stop offset="0.55" stopColor={p.main} />
          <stop offset="1" stopColor={p.dark} />
        </radialGradient>
        <linearGradient id="tk-trail" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.light} stopOpacity="1" />
          <stop offset="1" stopColor={p.light} stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <rect width={200} height={160} fill="url(#tk-bg)" />
      <Radial cx={140} cy={58} n={34} r0={26} r1={220} color={PAPER} o={0.55} w={0.05} />
      {/* しょうげきの わ */}
      {[52, 38].map((r, i) => (
        <ellipse key={i} className="ill-pulse" style={{ animationDelay: `${i * 0.25}s`, transformOrigin: '140px 58px', transformBox: 'view-box' }} cx={140} cy={58} rx={r * 1.15} ry={r * 0.9} fill="none" stroke={PAPER} strokeWidth={i ? 6 : 4} opacity={0.9} transform="rotate(-30 140 58)" />
      ))}
      {/* しょうげき */}
      <g filter="url(#glow)">
        <Burst x={140} y={58} r={44} p={p} points={14} cls="ill-pulse" />
      </g>
      {/* とびちる かけら */}
      {[
        [174, 30, 7, 30],
        [184, 84, 6, -20],
        [156, 112, 5, 50],
        [118, 22, 5, 10],
        [190, 50, 4, 70],
        [100, 34, 3.5, -30],
      ].map(([x, y, r, a], i) => (
        <path key={i} d={`M${x - r},${y} L${x - r * 0.2},${y - r} L${x + r},${y - r * 0.2} L${x + r * 0.3},${y + r}Z`} transform={`rotate(${a} ${x} ${y})`} fill={i % 2 ? p.light : PAPER} {...ink(1.8)} />
      ))}
      {/* たまの きせき */}
      <path d="M-20,190 L30,190 L112,104 L80,72 Z" fill="url(#tk-trail)" />
      <path d="M-4,158 L58,108 M14,176 L78,124 M-14,138 L36,98" stroke={PAPER} strokeWidth={4} strokeLinecap="round" opacity={0.85} />
      {/* たま */}
      <g transform="translate(96 88) rotate(-40) scale(1.5 1.22)">
        <circle r={30} fill="url(#tk-ball)" {...ink(3.2)} />
        <path d="M-22,-10 A24,24 0 0 1 4,-26" fill="none" stroke={PAPER} strokeWidth={5} strokeLinecap="round" opacity={0.9} />
        <ellipse cx={-12} cy={-14} rx={6} ry={3.6} fill="#fff" transform="rotate(-30 -12 -14)" />
        <path d="M24,8 A26,26 0 0 1 4,27" fill="none" stroke={p.light} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
      </g>
      <Sparkle x={162} y={20} r={8} />
      <Sparkle x={40} y={30} r={6} fill={p.light} delay={0.5} />
    </g>
  ),

  // かみつき：画面いっぱいの あごが かみあう しゅんかん（くらい 口の おく＋つやつやの 歯）
  c_bite: (p) => (
    <g>
      <defs>
        <radialGradient id="bt-in" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#5a1e18" />
          <stop offset="1" stopColor="#1e0b09" />
        </radialGradient>
        <linearGradient id="bt-tooth" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.6" stopColor="#f6f0e2" />
          <stop offset="1" stopColor="#d6cbb4" />
        </linearGradient>
        <linearGradient id="bt-gum" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.light} />
          <stop offset="0.5" stopColor={p.main} />
          <stop offset="1" stopColor={p.dark} />
        </linearGradient>
      </defs>
      <rect width={200} height={160} fill="url(#bt-in)" />
      <Radial cx={100} cy={80} n={30} r0={26} r1={160} color={p.light} o={0.35} />
      <g filter="url(#glow)">
        <Burst x={100} y={80} r={20} p={p} cls="ill-pulse" />
      </g>
      <g className="ill-shake" style={{ transformOrigin: '100px 80px', transformBox: 'view-box' }}>
        {/* うえの あご */}
        <path d="M-8,64 C8,-6 192,-6 208,64 C178,50 22,50 -8,64Z" fill="url(#bt-gum)" {...ink(3.4)} />
        <path d="M18,44 C56,30 144,30 182,44" fill="none" stroke={PAPER} strokeWidth={4} opacity={0.55} strokeLinecap="round" />
        {Array.from({ length: 9 }, (_, i) => {
          const x = 16 + i * 21;
          const y = 53 + Math.abs(i - 4) * 1.8;
          const h = 28 - Math.abs(i - 4) * 2.6;
          return (
            <g key={i}>
              <path d={`M${x - 9.5},${y} Q${x - 4},${y + h * 0.7} ${x},${y + h} Q${x + 4},${y + h * 0.7} ${x + 9.5},${y}Z`} fill="url(#bt-tooth)" {...ink(2.4)} />
              <path d={`M${x - 5},${y + 3} L${x - 1.5},${y + h * 0.65}`} stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
            </g>
          );
        })}
        {/* したの あご */}
        <path d="M2,104 C28,168 172,168 198,104 C162,118 38,118 2,104Z" fill="url(#bt-gum)" {...ink(3.4)} />
        {Array.from({ length: 8 }, (_, i) => {
          const x = 27 + i * 21;
          const y = 113 - Math.abs(i - 3.5) * 1.6;
          const h = 24 - Math.abs(i - 3.5) * 2.4;
          return (
            <g key={i}>
              <path d={`M${x - 9.5},${y} Q${x - 4},${y - h * 0.7} ${x},${y - h} Q${x + 4},${y - h * 0.7} ${x + 9.5},${y}Z`} fill="url(#bt-tooth)" {...ink(2.4)} />
              <path d={`M${x - 5},${y - 3} L${x - 1.5},${y - h * 0.62}`} stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
            </g>
          );
        })}
        {/* よだれの ひかり */}
        <path d="M58,62 q2,10 -1,16" fill="none" stroke="#e6f6ff" strokeWidth={2.4} strokeLinecap="round" opacity={0.8} />
        <circle cx={57} cy={80} r={2.2} fill="#e6f6ff" opacity={0.8} />
      </g>
      <path d="M100,0 L100,12 M64,4 L71,16 M136,4 L129,16" stroke={PAPER} strokeWidth={3.4} strokeLinecap="round" />
      <path d="M100,160 L100,150 M64,158 L71,148 M136,158 L129,148" stroke={PAPER} strokeWidth={3.4} strokeLinecap="round" />
    </g>
  ),

  // ひのこ：ななめに とんでくる 火のたま（ほのおの しっぽ＋ひかる しん）
  f_spark: (p) => (
    <g>
      <defs>
        <radialGradient id="fs-bg" cx="0.7" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#fff0c4" />
          <stop offset="0.4" stopColor="#ff9a4c" />
          <stop offset="1" stopColor="#5e1a0c" />
        </radialGradient>
        <radialGradient id="fs-core">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.35" stopColor="#fff2a8" />
          <stop offset="0.75" stopColor={p.light} />
          <stop offset="1" stopColor={p.main} />
        </radialGradient>
      </defs>
      <rect width={200} height={160} fill="url(#fs-bg)" />
      <Radial cx={170} cy={30} n={26} r0={20} r1={220} color="#fff2a8" o={0.3} w={0.05} />
      {/* 火のたま：ひだり下 → みぎ上 */}
      {[
        [124, 62, 1.25, 0],
        [62, 102, 0.95, 0.2],
        [150, 124, 0.7, 0.4],
        [56, 36, 0.55, 0.1],
      ].map(([x, y, s, d], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(-32) scale(${s})`}>
          <g className="ill-flicker" style={{ animationDelay: `${d}s`, transformOrigin: '0px 0px', transformBox: 'view-box' }}>
            <circle r={30} fill="#fff2a8" opacity={0.45} filter="url(#soft)" />
            {/* しっぽ（ゆらゆらの ほのお） */}
            <path d="M8,-17 C-14,-22 -30,-10 -46,-16 C-38,-8 -52,-2 -64,0 C-52,4 -40,8 -46,16 C-30,10 -14,22 8,17Z" fill={p.dark} {...ink(2.6)} />
            <path d="M6,-12 C-10,-15 -22,-7 -34,-10 C-28,-4 -38,0 -46,1 C-36,4 -28,6 -32,11 C-20,7 -10,15 6,12Z" fill={p.main} />
            <path d="M4,-7 C-6,-8 -14,-4 -22,-5 C-18,-1 -24,1 -28,2 C-20,4 -14,5 -16,8 C-8,5 -4,9 4,7Z" fill={p.light} />
            {/* あたま */}
            <circle cx={6} cy={0} r={17} fill="url(#fs-core)" {...ink(2.6)} />
            <ellipse cx={10} cy={-6} rx={5} ry={3.4} fill="#fff" />
          </g>
        </g>
      ))}
      {/* ひのこ */}
      {[
        [30, 70],
        [96, 28],
        [176, 92],
        [112, 140],
        [20, 140],
        [186, 20],
        [90, 84],
      ].map(([x, y], i) => (
        <g key={i} className="ill-twinkle" style={{ animationDelay: `${i * 0.18}s`, transformOrigin: `${x}px ${y}px`, transformBox: 'view-box' }}>
          <circle cx={x} cy={y} r={3.4} fill="#fff2a8" stroke={p.dark} strokeWidth={1.4} />
        </g>
      ))}
    </g>
  ),

  // アクアカノン：らせんを まいて つらぬく 太い 水の大ほう
  water_sig: (p) => (
    <g>
      <defs>
        <radialGradient id="wa-bg" cx="0.8" cy="0.25" r="0.95">
          <stop offset="0" stopColor="#f2fbff" />
          <stop offset="0.4" stopColor="#8fd0ff" />
          <stop offset="1" stopColor="#0f2f70" />
        </radialGradient>
        <linearGradient id="wa-jet" x1="0" y1="0" x2="0" y2="1" gradientTransform="rotate(-33 0.5 0.5)">
          <stop offset="0" stopColor={p.light} />
          <stop offset="0.45" stopColor={p.main} />
          <stop offset="1" stopColor={p.dark} />
        </linearGradient>
      </defs>
      <rect width={200} height={160} fill="url(#wa-bg)" />
      <Radial cx={156} cy={58} n={30} r0={22} r1={220} color={PAPER} o={0.45} w={0.05} />
      <g transform="translate(-10 18)">
      {/* ふとい 水の はしら */}
      <g filter="url(#glow)">
        <path d="M-30,124 C20,100 80,68 140,22 L176,70 C116,108 56,146 -4,182Z" fill="url(#wa-jet)" {...ink(3.6)} />
      </g>
      {/* あわだつ ふち */}
      <path d="M-24,126 q8,-8 16,-6 q6,-10 16,-8 q6,-10 16,-9 q6,-10 16,-10 q6,-10 16,-11 q6,-10 16,-12 q6,-10 16,-12 q6,-9 14,-11" fill="none" stroke={PAPER} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
      {/* しろい しん */}
      <path d="M-14,152 C36,124 96,88 156,46" fill="none" stroke={PAPER} strokeWidth={11} strokeLinecap="round" opacity={0.85} />
      <path className="ill-flow" d="M-14,162 C38,134 98,98 160,58" fill="none" stroke={p.light} strokeWidth={5} strokeDasharray="18 12" strokeLinecap="round" />
      <path className="ill-flow" d="M-14,140 C34,114 92,80 150,38" fill="none" stroke={p.light} strokeWidth={3} strokeDasharray="10 14" strokeLinecap="round" style={{ animationDelay: '0.25s' }} />
      {/* らせん */}
      {[30, 76, 122].map((x, i) => {
        const y = 140 - i * 32;
        return <ellipse key={i} cx={x} cy={y} rx={10} ry={34} fill="none" stroke={PAPER} strokeWidth={4} transform={`rotate(57 ${x} ${y})`} opacity={0.95} />;
      })}
      {/* しぶきの おうかん */}
      <g transform="translate(160 44) rotate(-33) scale(1.25)">
        <path d="M-30,10 L-38,-18 L-20,0 L-16,-36 L-4,-4 L6,-40 L12,-2 L30,-24 L28,10Z" fill={p.light} {...ink(2.6)} />
        <path d="M-16,4 L-12,-20 M6,0 L8,-24" stroke={PAPER} strokeWidth={2.4} strokeLinecap="round" />
        <ellipse cx={-2} cy={10} rx={32} ry={9} fill={PAPER} {...ink(2.4)} />
      </g>
      </g>
      {[
        [190, 100, 6],
        [176, 132, 4.5],
        [120, 14, 4],
        [196, 64, 3.6],
        [96, 30, 3],
      ].map(([x, y, r], i) => (
        <Drop key={i} x={x} y={y} r={r} p={p} delay={i * 0.2} />
      ))}
      {[
        [96, 128, 5],
        [130, 140, 3.4],
        [60, 150, 4],
      ].map(([x, y, r], i) => (
        <circle key={i} className="ill-float" style={{ animationDelay: `${i * 0.3}s` }} cx={x} cy={y} r={r} fill="none" stroke={PAPER} strokeWidth={2} />
      ))}
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

  // ガード：きんの ふちの たてと ひかる バリア。とんできた こうげきを はじく
  c_guard: (p) => (
    <g>
      <defs>
        <radialGradient id="gd-bg" cx="0.5" cy="0.45" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor={p.bg2} />
          <stop offset="1" stopColor={p.dark} />
        </radialGradient>
        <linearGradient id="gd-face" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={p.light} />
          <stop offset="0.5" stopColor={p.main} />
          <stop offset="1" stopColor={p.dark} />
        </linearGradient>
      </defs>
      <rect width={200} height={160} fill="url(#gd-bg)" />
      {/* バリアの ろっかく もよう */}
      <g className="ill-pulse" style={{ transformOrigin: '100px 80px', transformBox: 'view-box' }} opacity={0.55}>
        <circle cx={100} cy={80} r={70} fill={p.light} opacity={0.35} />
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2;
          const x = 100 + Math.cos(a) * 46;
          const y = 80 + Math.sin(a) * 46;
          return <polygon key={i} points={Array.from({ length: 6 }, (_, k) => `${x + Math.cos((k / 6) * Math.PI * 2) * 15},${y + Math.sin((k / 6) * Math.PI * 2) * 15}`).join(' ')} fill="none" stroke={PAPER} strokeWidth={2.4} />;
        })}
        <circle cx={100} cy={80} r={70} fill="none" stroke={PAPER} strokeWidth={3} />
      </g>
      {/* はじかれる やじるし */}
      {[
        [182, 40, 210, 0],
        [188, 96, 168, 1],
        [22, 50, -20, 2],
        [18, 118, 20, 3],
      ].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <path d="M-4,0 L24,0" stroke={INK} strokeWidth={7} strokeLinecap="round" />
          <path d="M-4,0 L24,0" stroke="#c9d3df" strokeWidth={3.4} strokeLinecap="round" />
          <path d="M24,0 L15,-7 L15,7Z" fill="#c9d3df" {...ink(2)} />
          <path d="M-4,0 L-10,-5 M-4,0 L-10,5" {...ink(2.4)} />
        </g>
      ))}
      <Burst x={160} y={46} r={11} p={PALETTES.bolt} points={9} />
      <Burst x={164} y={104} r={10} p={PALETTES.bolt} points={9} />
      <Burst x={40} y={56} r={10} p={PALETTES.bolt} points={9} />
      {/* たて */}
      <g transform="translate(100 80)">
        <path d="M-44,-58 L44,-58 L44,0 C44,34 22,54 0,68 C-22,54 -44,34 -44,0Z" fill={INK} opacity={0.18} transform="translate(5 6)" />
        <path d="M-44,-58 L44,-58 L44,0 C44,34 22,54 0,68 C-22,54 -44,34 -44,0Z" fill="url(#gv-gold)" {...ink(3.6)} />
        <path d="M-34,-48 L34,-48 L34,-2 C34,26 17,42 0,54 C-17,42 -34,26 -34,-2Z" fill="url(#gd-face)" {...ink(2.6)} />
        {/* ひかりの はんしゃ */}
        <path d="M-28,-42 L-6,-42 L-28,10Z" fill="#fff" opacity={0.35} />
        <path d="M0,-30 L8,-12 L28,-12 L12,0 L18,20 L0,8 L-18,20 L-12,0 L-28,-12 L-8,-12Z" fill="url(#gv-gold)" {...ink(2.4)} />
        <path d="M0,-22 L4,-11" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
        {[
          [-38, -52],
          [38, -52],
          [-38, 0],
          [38, 0],
          [0, 60],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3.2} fill="#fff6c2" {...ink(1.6)} />
        ))}
      </g>
      <Sparkle x={150} y={142} r={7} delay={0.5} />
      <Sparkle x={52} y={18} r={6} delay={0.2} />
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
