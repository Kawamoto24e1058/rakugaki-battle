import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { Control } from './pads';
import type { Player } from './types';
import { P_COLOR } from './Arena';

/**
 * つかう キーの 絵（ミニゲームの 説明で 大きく 出す）。文字が 読めなくても わかるように、キーの 形と うごきで 見せる。
 *  やじるし：4つの キーが じゅんばんに 光る ／ スペース：はばの ひろい キーが へこむ ／ マウス：マウスの 絵
 *  2人の ときは P1＝WASD＋スペース、P2＝やじるし＋エンター
 */
export function ControlPicture({ controls, player, twoPlayer }: { controls: Control[]; player: Player; twoPlayer: boolean }) {
  const color = P_COLOR[player];
  const useWasd = twoPlayer && player === 0;
  const items: ReactNode[] = [];
  if (controls.includes('arrows')) items.push(<DirKeys key="arrows" color={color} wasd={useWasd} />);
  if (controls.includes('space')) items.push(<ActionKey key="space" color={color} label={twoPlayer && player === 1 ? 'エンター' : 'スペース'} />);
  if (controls.includes('mouse') && !twoPlayer) items.push(<MouseIcon key="mouse" color={color} />);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {i > 0 && <span style={{ fontWeight: 900, fontSize: 'clamp(.9rem, 2.6vw, 1.1rem)', color: 'var(--ink-soft)' }}>か</span>}
          {it}
        </div>
      ))}
    </div>
  );
}

const CAP = 'clamp(2.4rem, 7vw, 3.4rem)';

function Key({ children, color, lit, wide }: { children: ReactNode; color: string; lit: number[] | boolean; wide?: boolean }) {
  return (
    <motion.div
      animate={Array.isArray(lit) ? { backgroundColor: lit.map((v) => (v ? color : '#fffdf5')), y: lit.map((v) => (v ? 3 : 0)), boxShadow: lit.map((v) => (v ? '0 1px 0 var(--ink)' : '0 4px 0 var(--ink)')) } : undefined}
      transition={{ repeat: Infinity, duration: 2.4, ease: 'linear' }}
      style={{
        width: wide ? `calc(${CAP} * 3.4)` : CAP,
        height: CAP,
        borderRadius: 10,
        border: '3px solid var(--ink)',
        background: '#fffdf5',
        boxShadow: '0 4px 0 var(--ink)',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 900,
        fontSize: 'clamp(1rem, 3vw, 1.4rem)',
      }}
    >
      {children}
    </motion.div>
  );
}

/** 4つの むきキー（やじるし／WASD）。上→右→下→左 の じゅんに 光る。 */
function DirKeys({ color, wasd }: { color: string; wasd: boolean }) {
  // 2.4びょうで 4つ。各キーが 光る タイミング（キーフレーム 8こ）
  const lit = (i: number) => Array.from({ length: 8 }, (_, k) => (Math.floor(k / 2) === i ? 1 : 0));
  const arrow = (rot: number) => (
    <svg viewBox="-10 -10 20 20" width="55%" height="55%" style={{ transform: `rotate(${rot}deg)` }}>
      <path d="M0,-7 L7,1 L2.5,1 L2.5,7 L-2.5,7 L-2.5,1 L-7,1Z" fill="var(--ink)" />
    </svg>
  );
  const cap = (i: number, rot: number, letter: string) => (
    <Key color={color} lit={lit(i)}>
      {wasd ? letter : arrow(rot)}
    </Key>
  );
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${CAP})`, gap: 4 }}>
        <div />
        {cap(0, 0, 'W')}
        <div />
        {cap(3, -90, 'A')}
        {cap(2, 180, 'S')}
        {cap(1, 90, 'D')}
      </div>
      <div style={{ fontWeight: 900, fontSize: 'clamp(.9rem, 2.6vw, 1.1rem)' }}>{wasd ? 'W A S D' : 'やじるし'}で うごく</div>
    </div>
  );
}

/** けってい キー（スペース／エンター）。トン、トンと へこむ。 */
function ActionKey({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
      <Key color={color} lit={[0, 0, 1, 0, 0, 0, 1, 0]} wide>
        {label}
      </Key>
      <div style={{ fontWeight: 900, fontSize: 'clamp(.9rem, 2.6vw, 1.1rem)' }}>{label}を おす</div>
    </div>
  );
}

function MouseIcon({ color }: { color: string }) {
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
      <motion.svg viewBox="-20 -28 40 56" style={{ width: CAP, height: `calc(${CAP} * 1.4)` }} animate={{ x: [0, 8, 0, -8, 0] }} transition={{ repeat: Infinity, duration: 2.4 }}>
        <rect x={-15} y={-24} width={30} height={48} rx={15} fill="#fffdf5" stroke="var(--ink)" strokeWidth={3} />
        <path d="M-15,-6 L15,-6 M0,-24 L0,-6" stroke="var(--ink)" strokeWidth={3} />
        <path d="M-13,-8 L-13,-12 Q-13,-22 -2,-22 L-2,-8Z" fill={color} />
      </motion.svg>
      <div style={{ fontWeight: 900, fontSize: 'clamp(.9rem, 2.6vw, 1.1rem)' }}>マウスでも OK</div>
    </div>
  );
}
