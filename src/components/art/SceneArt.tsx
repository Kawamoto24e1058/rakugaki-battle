import type { ReactElement } from 'react';
import type { MoveDef, Cond } from '../../engine/moves';
import type { StatusKind } from '../../engine/types';
import { MOTIFS } from './motifs';
import { PALETTES, type Pal } from './palette';
import { artFor } from './artSpec';

/**
 * 「何が起きるか」を絵で見せるカードのイラスト。
 * 左＝じぶん、右＝あいて。技のデータから自動で組み立てるので、どのカードも同じルールで読める。
 *  ・攻撃 … じぶん → あいて に技の絵がぶつかり、ダメージの数字
 *  ・かいふく/強化/まもり … じぶんの上に絵と矢印（↑）
 *  ・状態異常/弱体 … あいての上に マークや ↓
 *  ・条件つき … 左上の「もし」ふきだし ＋ 右上の ×倍率
 */
const INK = '#33302b';
const PAPER = '#fffdf5';

const STATUS_GLYPH: Partial<Record<StatusKind, { motif: string; pal: keyof typeof PALETTES }>> = {
  burn: { motif: 'flame', pal: 'fire' },
  freeze: { motif: 'iceblock', pal: 'water' },
  poison: { motif: 'venom', pal: 'dark' },
  paralysis: { motif: 'spark', pal: 'bolt' },
  confuse: { motif: 'dizzy', pal: 'dark' },
  sleep: { motif: 'zzz', pal: 'water' },
  flinch: { motif: 'burst', pal: 'atk' },
  atkDown: { motif: 'down', pal: 'dark' },
  defDown: { motif: 'down', pal: 'dark' },
  spdDown: { motif: 'down', pal: 'dark' },
};

function Glyph({ motif, pal, x, y, s }: { motif: string; pal: Pal; x: number; y: number; s: number }) {
  const Draw = MOTIFS[motif];
  if (!Draw) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g filter="url(#crayon)">{Draw(pal)}</g>
    </g>
  );
}

/** ちいさな キャラ（まるい体＋目）。 */
function Blob({ x, y, s = 1, tint, faded = false }: { x: number; y: number; s?: number; tint: string; faded?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={faded ? 0.45 : 1}>
      <ellipse cx={0} cy={19} rx={17} ry={3.4} fill="rgba(51,48,43,.18)" />
      <path d="M-17,11 Q-22,-14 0,-19 Q22,-14 17,11 Q0,19 -17,11Z" fill={tint} stroke={INK} strokeWidth={2.3} strokeLinejoin="round" />
      <circle cx={-6} cy={-3} r={2.2} fill={INK} />
      <circle cx={6} cy={-3} r={2.2} fill={INK} />
      <path d="M-4,5 Q0,8 4,5" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
    </g>
  );
}

function NumBadge({ x, y, text, color = '#d8321c', r = 11 }: { x: number; y: number; text: string; color?: string; r?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={PAPER} stroke={INK} strokeWidth={2} />
      <text textAnchor="middle" y={r * 0.38} fontSize={r * 1.1} fontWeight={900} fill={color} fontFamily="var(--font-display)">
        {text}
      </text>
    </g>
  );
}

/** 条件を ちいさな絵で。 */
function CondGlyph({ cond, pal }: { cond: Cond; pal: Pal }): ReactElement | null {
  switch (cond.t) {
    case 'foeHas': {
      const k = cond.kind;
      const g = (k === 'debuff' ? STATUS_GLYPH.poison : k === 'buff' ? { motif: 'up', pal: 'atk' as const } : STATUS_GLYPH[k as StatusKind]) ?? STATUS_GLYPH.poison!;
      return (
        <g>
          <Blob x={-1} y={3} s={0.55} tint="#cfd8ea" />
          <Glyph motif={g.motif} pal={PALETTES[g.pal]} x={9} y={-7} s={0.2} />
        </g>
      );
    }
    case 'selfHas':
      return <Blob x={0} y={3} s={0.6} tint="#ffe9a8" />;
    case 'foeHp':
    case 'selfHp': {
      return (
        <g>
          <Blob x={0} y={5} s={0.5} tint={cond.t === 'selfHp' ? '#ffe9a8' : '#cfd8ea'} />
          <rect x={-11} y={-11} width={22} height={5} rx={2.5} fill="#fff" stroke={INK} strokeWidth={1.4} />
          <rect x={-10} y={-10} width={6} height={3} rx={1.5} fill="#e83a2a" />
        </g>
      );
    }
    case 'first':
    case 'second':
      return (
        <g>
          <circle r={9} fill={cond.t === 'first' ? '#f2b705' : '#e6e1d3'} stroke={INK} strokeWidth={1.8} />
          <text textAnchor="middle" y={4.6} fontSize={13} fontWeight={900} fill={INK} fontFamily="var(--font-display)">
            {cond.t === 'first' ? '1' : '2'}
          </text>
        </g>
      );
    case 'foePick':
      return (
        <g>
          <Blob x={-2} y={4} s={0.5} tint="#cfd8ea" />
          <Glyph motif={cond.cat === 'attack' ? 'burst' : 'heart'} pal={cond.cat === 'attack' ? PALETTES.atk : PALETTES.sup} x={9} y={-6} s={0.17} />
        </g>
      );
    case 'foeCharging':
      return (
        <g>
          <Blob x={-3} y={5} s={0.5} tint="#cfd8ea" />
          <Glyph motif="hourglass" pal={pal} x={9} y={-4} s={0.2} />
        </g>
      );
    case 'prev': {
      const map: Record<string, { motif: string; pal: keyof typeof PALETTES }> = {
        fire: { motif: 'flame', pal: 'fire' },
        water: { motif: 'drops', pal: 'water' },
        wood: { motif: 'leaf', pal: 'wood' },
        bolt: { motif: 'bolt', pal: 'bolt' },
        dark: { motif: 'moon', pal: 'dark' },
        blow: { motif: 'fist', pal: 'atk' },
        slash: { motif: 'slash', pal: 'atk' },
        guard: { motif: 'shield', pal: 'sup' },
        heal: { motif: 'heart', pal: 'sup' },
        charge: { motif: 'chargeorb', pal: 'kosei' },
      };
      const g = map[cond.tag] ?? { motif: 'burst', pal: 'atk' as const };
      return (
        <g>
          <rect x={-10} y={-13} width={20} height={26} rx={3} fill={PAPER} stroke={INK} strokeWidth={1.6} />
          <Glyph motif={g.motif} pal={PALETTES[g.pal]} x={0} y={0} s={0.2} />
        </g>
      );
    }
  }
}

/** 効果ステッカー：丸いシールに ちいさな絵。 */
function Sticker({ x, y, children }: { x: number; y: number; children: ReactElement }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={11} fill={PAPER} stroke={INK} strokeWidth={2} />
      {children}
    </g>
  );
}

/** 絵の下に ならべる「効果ステッカー」。左端が対象（じぶん／あいて）、そのあとに効果。 */
function stickersFor(move: MoveDef, pal: Pal): ReactElement[] {
  const out: ReactElement[] = [];
  const g = (motif: string, p: Pal, s = 0.22, dx = 0, dy = 0) => <Glyph key={motif + out.length} motif={motif} pal={p} x={dx} y={dy} s={s} />;
  if (move.first || move.guardPct || move.reflect || (move.buff && move.buff.stat === 'def')) {
    out.push(
      <g key="q">
        <path d="M-9,-4 L-2,-4 M-10,1 L-3,1 M-9,6 L-2,6" stroke={pal.dark} strokeWidth={1.6} strokeLinecap="round" />
        <text x={4} y={5} textAnchor="middle" fontSize={13} fontWeight={900} fill={INK} fontFamily="var(--font-display)">1</text>
      </g>,
    );
  }
  if (move.hits && move.hits > 1) {
    out.push(
      <text key="h" textAnchor="middle" y={4.5} fontSize={11} fontWeight={900} fill={pal.dark} fontFamily="var(--font-display)">
        ×{move.hits}
      </text>,
    );
  }
  if (move.pierce) out.push(<path key="pi" d="M0,-8 L7,-5 Q8,4 0,9 Q-8,4 -7,-5Z" fill="none" stroke={INK} strokeWidth={1.8} strokeDasharray="2.6 2.6" />);
  if (move.status && !move.status.toSelf && STATUS_GLYPH[move.status.kind]) {
    const sg = STATUS_GLYPH[move.status.kind]!;
    out.push(g(sg.motif, PALETTES[sg.pal], 0.22));
  }
  if (move.drain) out.push(g('heart', PALETTES.sup, 0.2));
  if (move.critBoost) out.push(g('crit', pal, 0.2));
  if (move.execute) {
    out.push(
      <g key="ex">
        <rect x={-8} y={-2} width={16} height={5} rx={2.5} fill="#fff" stroke={INK} strokeWidth={1.4} />
        <rect x={-7} y={-1} width={4} height={3} rx={1.5} fill="#e83a2a" />
      </g>,
    );
  }
  if (move.ambush) out.push(g('ninja', pal, 0.2));
  if (move.randomAttr) out.push(g('rainbow', pal, 0.2, 0, 2));
  if (move.recoil) out.push(g('recoil', PALETTES.atk, 0.18));
  if (move.cures) {
    out.push(
      <g key="cu">
        <Glyph motif="venom" pal={PALETTES.dark} x={0} y={0} s={0.2} />
        <path d="M-7,-7 L7,7 M7,-7 L-7,7" stroke="#e83a2a" strokeWidth={2.6} strokeLinecap="round" />
      </g>,
    );
  }
  if (move.guardPct) out.push(g('shield', PALETTES.water, 0.2));
  if (move.reflect) out.push(g('counter', PALETTES.sup, 0.2));
  if (move.buff) {
    const m = ({ atk: ['muscle', 'atk'], spd: ['wing', 'bolt'], luck: ['clover', 'wood'], def: ['shield', 'water'] } as Record<string, [string, keyof typeof PALETTES]>)[move.buff.stat];
    if (m) out.push(g(m[0], PALETTES[m[1]], 0.2));
    out.push(
      <g key="up">
        <Glyph motif="up" pal={PALETTES.atk} x={0} y={0} s={0.2} />
      </g>,
    );
  }
  if (move.debuff) {
    const m = ({ atk: 'fist', spd: 'wing', def: 'shield' } as Record<string, string>)[move.debuff.stat] ?? 'fist';
    out.push(g(m, PALETTES.dark, 0.2));
    out.push(<Glyph key="dn" motif="down" pal={PALETTES.dark} x={0} y={0} s={0.2} />);
  }
  if (move.hand) {
    const h = move.hand;
    out.push(
      <g key="hd">
        <Glyph motif="cards" pal={pal} x={-1} y={1} s={0.2} />
        {(h.kind === 'extra' || h.kind === 'foeLess' || h.kind === 'guarantee') && (
          <text x={7} y={-3} textAnchor="middle" fontSize={9} fontWeight={900} fill={h.kind === 'foeLess' ? '#d8321c' : '#1b7a47'} fontFamily="var(--font-display)" stroke="#fff" strokeWidth={2} paintOrder="stroke">
            {h.kind === 'extra' ? `+${h.n}` : h.kind === 'foeLess' ? `-${h.n}` : h.n}
          </text>
        )}
      </g>,
    );
  }
  return out;
}

/** 属性ごとの やわらかい背景（うすく・ごちゃつかせない）。 */
function Backdrop({ attr, pal }: { attr: MoveDef['attribute']; pal: Pal }) {
  switch (attr) {
    case 'fire':
      return (
        <g opacity={0.5}>
          <path d="M0,90 Q20,60 40,84 Q60,52 80,86 Q104,56 124,84 Q144,62 160,88 L160,100 L0,100Z" fill={pal.light} />
          {[[24, 26, 3], [140, 22, 2.6], [112, 12, 2], [46, 14, 2.2]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={pal.main} opacity={0.5} />
          ))}
        </g>
      );
    case 'water':
      return (
        <g opacity={0.5} fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round">
          <path d="M-4,70 Q16,64 36,70 T76,70 T116,70 T164,70" />
          <path d="M-4,82 Q18,76 40,82 T84,82 T128,82 T170,82" />
          <circle cx={26} cy={24} r={5} />
          <circle cx={136} cy={30} r={3.6} />
        </g>
      );
    case 'wood':
      return (
        <g opacity={0.45} fill={pal.light} stroke={pal.main} strokeWidth={1.2}>
          <path d="M-2,20 Q18,8 30,28 Q10,34 -2,20Z" />
          <path d="M162,60 Q142,44 128,64 Q148,72 162,60Z" />
          <path d="M120,6 Q138,0 146,16 Q128,20 120,6Z" />
        </g>
      );
    case 'bolt':
      return (
        <g opacity={0.45} fill={pal.light}>
          <path d="M20,0 L36,0 L10,100 L-6,100Z" />
          <path d="M120,0 L132,0 L110,100 L98,100Z" />
          <path d="M152,0 L162,0 L150,100 L140,100Z" />
        </g>
      );
    case 'dark':
      return (
        <g opacity={0.55} fill="#fff">
          {[[22, 20, 2], [140, 16, 2.6], [46, 62, 1.6], [128, 54, 1.8], [96, 12, 1.6], [16, 74, 2]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} />
          ))}
        </g>
      );
    default:
      return (
        <g opacity={0.5} fill={pal.light}>
          <circle cx={24} cy={72} r={14} />
          <circle cx={140} cy={70} r={18} />
          <circle cx={128} cy={14} r={7} />
        </g>
      );
  }
}

export function SceneArt({ move }: { move: MoveDef }) {
  const art = artFor(move);
  const pal = art.pal;
  const atk = move.category === 'attack';
  const toFoe = atk || move.target === 'enemy';
  const explicit = art.motifs[0]?.includes(':');
  const toks = explicit ? art.motifs : art.motifs.slice(0, 1);

  const num = atk ? `${move.power}` : move.heal ? `+${move.heal}` : null;
  const numColor = atk ? '#d8321c' : '#1b7a47';
  const stickers = stickersFor(move, pal).slice(0, 4);
  // 対象（左端）＋効果
  const all: ReactElement[] = [
    <Blob key="tg" x={0} y={4} s={0.5} tint={toFoe ? '#cfd8ea' : '#ffe9a8'} />,
    ...stickers,
  ];

  return (
    <svg viewBox="0 6 160 84" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="mav" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pal.bg1} />
          <stop offset="1" stopColor={pal.bg2} />
        </linearGradient>
        <radialGradient id="maglow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id="masoft" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="1.5" dy="3" stdDeviation="1.6" floodColor="#33302b" floodOpacity="0.28" />
        </filter>
      </defs>
      <rect y="-10" width="160" height="120" fill="url(#mav)" />
      <Backdrop attr={move.attribute} pal={pal} />
      <ellipse cx={80} cy={46} rx={66} ry={46} fill="url(#maglow)" />
      <ellipse cx={80} cy={64} rx={36} ry={4} fill="rgba(51,48,43,.12)" />
      <g filter="url(#masoft)">
        <g filter="url(#crayon)">
          {toks.map((tok, i) => {
            const [name, rest] = tok.split(':');
            const Draw = MOTIFS[name];
            if (!Draw) return null;
            const [x, y, sc, r] = rest ? rest.split(',').map(Number) : [80, 40, 1.02, 0];
            return (
              <g key={i} transform={`translate(${x} ${y - 8}) rotate(${r}) scale(${sc})`}>
                {Draw(pal)}
              </g>
            );
          })}
        </g>
      </g>
      {/* 効果ステッカー（下の列）。左端＝対象 */}
      <g>
        {all.map((el, i) => (
          <Sticker key={i} x={16 + i * 26} y={77}>
            {el}
          </Sticker>
        ))}
      </g>
      {num && <NumBadge x={17} y={19} text={num} color={numColor} r={13} />}
      {move.when && move.whenMult && (
        <g>
          <g transform="translate(106 10)">
            <rect width={30} height={26} rx={7} fill={PAPER} stroke={INK} strokeWidth={1.8} strokeDasharray="4 3" />
            <g transform="translate(15 14) scale(0.9)">
              <CondGlyph cond={move.when} pal={pal} />
            </g>
          </g>
          <g transform="translate(146 24)">
            <polygon points="0,-15 4.5,-5.5 15,-5.5 6.5,2 9.5,13 0,6.5 -9.5,13 -6.5,2 -15,-5.5 -4.5,-5.5" fill="#f2b705" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
            <text textAnchor="middle" y={4} fontSize={9.5} fontWeight={900} fill={INK} fontFamily="var(--font-display)">
              ×{move.whenMult}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
}
