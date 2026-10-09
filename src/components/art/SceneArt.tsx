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

function Arrow({ x1, x2, y, color }: { x1: number; x2: number; y: number; color: string }) {
  return (
    <g>
      <path d={`M${x1},${y} L${x2 - 7},${y}`} stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <path d={`M${x1},${y} L${x2 - 7},${y}`} stroke={color} strokeWidth={3.6} strokeLinecap="round" strokeDasharray="7 5" />
      <path d={`M${x2 - 9},${y - 8} L${x2 + 2},${y} L${x2 - 9},${y + 8}Z`} fill={color} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
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

function HandBadge({ m, pal, x, y }: { m: MoveDef; pal: Pal; x: number; y: number }) {
  const h = m.hand!;
  const text = h.kind === 'extra' ? `+${h.n}` : h.kind === 'foeLess' ? `-${h.n}` : h.kind === 'guarantee' ? `${h.n}` : '';
  const sub =
    h.kind === 'guarantee'
      ? ({ attack: 'burst', support: 'cure', guard: 'shield', heal: 'heart', first: 'wing', rare: 'wishstar', status: 'venom' } as Record<string, string>)[h.pred]
      : h.kind === 'luck'
        ? 'wishstar'
        : null;
  return (
    <g transform={`translate(${x} ${y})`}>
      <Glyph motif="cards" pal={pal} x={0} y={0} s={0.5} />
      {text && (
        <g transform="translate(16 -14)">
          <circle r={9} fill={h.kind === 'foeLess' ? '#e8503a' : '#2f9e58'} stroke={INK} strokeWidth={1.8} />
          <text textAnchor="middle" y={4.6} fontSize={12} fontWeight={900} fill="#fff" fontFamily="var(--font-display)">
            {text}
          </text>
        </g>
      )}
      {sub && <Glyph motif={sub} pal={pal} x={-17} y={-12} s={0.22} />}
    </g>
  );
}

export function SceneArt({ move }: { move: MoveDef }) {
  const art = artFor(move);
  const pal = art.pal;
  const main = art.motifs[0] ?? 'burst';
  const ME_TINT = '#ffe9a8';
  const FOE_TINT = '#cfd8ea';
  const atk = move.category === 'attack';

  const toFoe = atk || move.target === 'enemy';
  const hasSelfEffect = !atk && !!(move.heal || move.cures || move.guardPct || move.reflect || move.buff);
  const onlyHand = !atk && !hasSelfEffect && !move.debuff && !move.status && !!move.hand;
  const selfOnly = !toFoe && !onlyHand;

  const els: ReactElement[] = [];

  if (atk) {
    const num = `${move.power}${move.hits && move.hits > 1 ? `×${move.hits}` : ''}`;
    els.push(
      <g key="a">
        <Blob x={28} y={66} tint={ME_TINT} />
        <Blob x={132} y={66} tint={FOE_TINT} />
        {move.charge && (
          <g>
            <circle cx={28} cy={64} r={25} fill="none" stroke={pal.main} strokeWidth={2.6} strokeDasharray="6 5" />
            <Glyph motif="hourglass" pal={pal} x={80} y={36} s={0.34} />
          </g>
        )}
        <Arrow x1={move.charge ? 54 : 52} x2={98} y={move.charge ? 60 : 46} color={pal.main} />
        {/* あたった絵 */}
        <g transform="translate(128 44)">
          <g filter="url(#crayon)">
            <g transform="scale(0.5)">{MOTIFS.burst({ ...pal })}</g>
          </g>
        </g>
        <Glyph motif={main} pal={pal} x={128} y={44} s={0.46} />
        {move.hits && move.hits > 1 && (
          <g stroke={INK} strokeWidth={2.4} strokeLinecap="round">
            {Array.from({ length: Math.min(5, move.hits) }, (_, i) => (
              <path key={i} d={`M${96 + i * 8},${60} l5,-9`} stroke={pal.dark} />
            ))}
          </g>
        )}
        {move.pierce && (
          <g transform="translate(110 64)" opacity={0.9}>
            <path d="M0,-12 L9,-8 Q10,5 0,13 Q-10,5 -9,-8Z" fill="none" stroke={INK} strokeWidth={1.8} strokeDasharray="3 3" />
          </g>
        )}
        {move.status && !move.status.toSelf && STATUS_GLYPH[move.status.kind] && (
          <Glyph motif={STATUS_GLYPH[move.status.kind]!.motif} pal={PALETTES[STATUS_GLYPH[move.status.kind]!.pal]} x={150} y={44} s={0.3} />
        )}
        {move.drain && <Glyph motif="heart" pal={PALETTES.sup} x={28} y={36} s={0.3} />}
        {move.recoil && <Glyph motif="burst" pal={PALETTES.atk} x={12} y={44} s={0.22} />}
        {move.critBoost && <Glyph motif="crit" pal={pal} x={104} y={32} s={0.26} />}
        {move.execute && (
          <g>
            <rect x={116} y={26} width={26} height={5} rx={2.5} fill="#fff" stroke={INK} strokeWidth={1.4} />
            <rect x={117.2} y={27.2} width={7} height={2.6} rx={1.3} fill="#e83a2a" />
          </g>
        )}
        {move.randomAttr && <Glyph motif="rainbow" pal={pal} x={80} y={30} s={0.4} />}
        {move.ambush && <Glyph motif="ninja" pal={pal} x={28} y={42} s={0.3} />}
        <NumBadge x={132} y={16} text={num} />
      </g>,
    );
  } else if (onlyHand) {
    els.push(
      <g key="h">
        <Blob x={30} y={66} s={0.9} tint={ME_TINT} />
        <Blob x={132} y={66} s={0.9} tint={FOE_TINT} faded={move.hand!.kind !== 'foeLess'} />
        <HandBadge m={move} pal={pal} x={move.hand!.kind === 'foeLess' ? 126 : 80} y={move.hand!.kind === 'foeLess' ? 38 : 40} />
      </g>,
    );
  } else if (selfOnly || (!toFoe && hasSelfEffect)) {
    // じぶんに かかる効果
    els.push(<Blob key="me" x={80} y={68} s={1.2} tint={ME_TINT} />);
    if (move.heal) {
      els.push(<Glyph key="heal" motif="heart" pal={PALETTES.sup} x={80} y={28} s={0.55} />);
      els.push(<NumBadge key="n" x={124} y={30} text={`+${move.heal}`} color="#1b7a47" r={12} />);
    }
    if (move.cures) {
      els.push(<Glyph key="cure" motif="bubble" pal={PALETTES.water} x={42} y={48} s={0.4} />);
      els.push(
        <g key="x" transform="translate(120 44)">
          <Glyph motif="venom" pal={PALETTES.dark} x={0} y={0} s={0.32} />
          <path d="M-13,-13 L13,13 M13,-13 L-13,13" stroke="#e83a2a" strokeWidth={5} strokeLinecap="round" />
        </g>,
      );
    }
    if (move.guardPct || move.reflect || move.buff?.stat === 'def') {
      els.push(<Glyph key="sh" motif="shield" pal={PALETTES.water} x={80} y={52} s={0.95} />);
      els.push(
        <g key="in">
          <path d="M150,34 L110,50" stroke={INK} strokeWidth={6} strokeLinecap="round" />
          <path d="M150,34 L110,50" stroke="#e8503a" strokeWidth={3.2} strokeLinecap="round" />
          <path d="M118,38 l-10,13 l16,2z" fill="#e8503a" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
        </g>,
      );
      if (move.reflect) els.push(<Glyph key="rf" motif="counter" pal={PALETTES.sup} x={30} y={34} s={0.4} />);
    }
    if (move.buff && move.buff.stat !== 'def') {
      const glyph = ({ atk: 'muscle', spd: 'wing', luck: 'clover' } as Record<string, string>)[move.buff.stat] ?? 'up';
      els.push(<Glyph key="up" motif="up" pal={PALETTES.atk} x={80} y={26} s={0.6} />);
      els.push(<Glyph key="st" motif={glyph} pal={PALETTES[move.buff.stat === 'luck' ? 'wood' : move.buff.stat === 'spd' ? 'bolt' : 'atk']} x={124} y={42} s={0.5} />);
      els.push(<NumBadge key="t" x={36} y={30} text={`${move.buff.turns}T`} color="#164f93" r={11} />);
    }
    if (move.hand) els.push(<HandBadge key="hb" m={move} pal={pal} x={28} y={86} />);
  } else {
    // あいてに かかる効果（弱体・状態異常・手札へらし）
    els.push(<Blob key="me" x={28} y={66} tint={ME_TINT} />, <Blob key="foe" x={132} y={66} tint={FOE_TINT} />);
    els.push(<Arrow key="ar" x1={52} x2={98} y={48} color={pal.main} />);
    if (move.debuff) {
      els.push(<Glyph key="d" motif="down" pal={PALETTES.dark} x={132} y={28} s={0.6} />);
      const g = ({ atk: 'fist', spd: 'wing', def: 'shield' } as Record<string, string>)[move.debuff.stat] ?? 'fist';
      els.push(<Glyph key="dg" motif={g} pal={PALETTES.dark} x={104} y={36} s={0.3} />);
    }
    if (move.status && STATUS_GLYPH[move.status.kind]) {
      els.push(<Glyph key="s" motif={STATUS_GLYPH[move.status.kind]!.motif} pal={PALETTES[STATUS_GLYPH[move.status.kind]!.pal]} x={132} y={32} s={0.55} />);
    }
    if (move.hand) els.push(<HandBadge key="hb" m={move} pal={pal} x={78} y={86} />);
  }

  return (
    <svg viewBox="0 4 160 90" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="scn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pal.bg1} />
          <stop offset="1" stopColor={pal.bg2} />
        </linearGradient>
      </defs>
      <rect y="-10" width="160" height="120" fill="url(#scn)" />
      <path d="M0,86 Q80,80 160,86 L160,100 L0,100Z" fill="rgba(51,48,43,.07)" />
      {art.quick && atk && (
        <g>
          <path d="M2,52 L18,52 M0,62 L14,62 M3,72 L16,72" stroke={pal.dark} strokeWidth={2.4} strokeLinecap="round" opacity={0.45} />
          <NumBadge x={12} y={18} text="1" color="#3a2a00" r={9} />
        </g>
      )}
      {els}
      {move.when && move.whenMult && (
        <g>
          <g transform="translate(8 6)">
            <rect width={34} height={30} rx={8} fill={PAPER} stroke={INK} strokeWidth={1.8} strokeDasharray="4 3" />
            <g transform="translate(17 16)">
              <CondGlyph cond={move.when} pal={pal} />
            </g>
          </g>
          <g transform="translate(148 12)">
            <polygon points="0,-14 4,-5 14,-5 6,2 9,12 0,6 -9,12 -6,2 -14,-5 -4,-5" fill="#f2b705" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
            <text textAnchor="middle" y={4} fontSize={9} fontWeight={900} fill={INK} fontFamily="var(--font-display)">
              ×{move.whenMult}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
}
