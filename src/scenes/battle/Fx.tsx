import { motion } from 'framer-motion';
import { MOTIFS } from '../../components/art/motifs';
import type { FxSpec } from './types';

/** 相手の絵の上で ばくはつする エフェクト。技のイラストを大きく使う。 */
export function Fx({ fx }: { fx: FxSpec }) {
  const { pal } = fx;
  const rays = Array.from({ length: 14 }, (_, i) => i);
  const particles = Array.from({ length: 12 }, (_, i) => i);
  const big = Math.min(1.25, 0.85 + (fx.size - 0.85) * 0.5);

  if (fx.kind === 'heal') {
    return (
      <motion.div key={fx.id} style={layer}>
        <svg viewBox="-60 -50 120 100" width="100%" height="100%" style={{ overflow: 'visible' }}>
          <g filter="url(#crayon)">
            {[0, 1].map((i) => (
              <motion.circle key={i} r={16} fill="none" stroke={pal.main} strokeWidth={4} initial={{ r: 12, opacity: 0.9 }} animate={{ r: 56, opacity: 0 }} transition={{ duration: 0.9, delay: i * 0.25 }} />
            ))}
            {[-30, -10, 12, 32, 0].map((x, i) => (
              <motion.g key={i} initial={{ x, y: 30, opacity: 0, scale: 0.5 }} animate={{ y: -34 - (i % 3) * 8, opacity: [0, 1, 1, 0], scale: 1 }} transition={{ duration: 1.1, delay: i * 0.1 }}>
                <path d="M0,-9 L0,9 M-9,0 L9,0" stroke={pal.ink} strokeWidth={7} strokeLinecap="round" />
                <path d="M0,-9 L0,9 M-9,0 L9,0" stroke={i % 2 ? '#fffdf5' : pal.light} strokeWidth={3.6} strokeLinecap="round" />
              </motion.g>
            ))}
          </g>
        </svg>
      </motion.div>
    );
  }

  if (fx.kind === 'buff' || fx.kind === 'debuff' || fx.kind === 'guard' || fx.kind === 'charge') {
    const Draw = MOTIFS[fx.motifs[0] ?? (fx.kind === 'debuff' ? 'down' : 'up')];
    const down = fx.kind === 'debuff';
    return (
      <motion.div key={fx.id} style={layer}>
        <svg viewBox="-60 -50 120 100" width="100%" height="100%" style={{ overflow: 'visible' }}>
          <motion.circle r={40} fill={pal.light} initial={{ opacity: 0.0, scale: 0.4 }} animate={{ opacity: [0, 0.45, 0], scale: [0.4, 1.3, 1.5] }} transition={{ duration: 1.1 }} />
          <g filter="url(#crayon)">
            {fx.kind === 'charge'
              ? [1.9, 1.4, 0.95].map((s, i) => (
                  <motion.circle key={i} r={30 * s} fill="none" stroke={pal.main} strokeWidth={3} strokeDasharray="8 7" initial={{ opacity: 0, scale: 1.6 }} animate={{ opacity: [0, 0.9, 0.5], scale: [1.6, 1, 0.9] }} transition={{ duration: 1.2, delay: i * 0.18 }} />
                ))
              : null}
            {Draw && (
              <motion.g initial={{ y: down ? -40 : 40, opacity: 0, scale: 0.6 }} animate={{ y: down ? 6 : -6, opacity: [0, 1, 1, 0.2], scale: [0.6, 1.25 * big, 1.1 * big] }} transition={{ duration: 1.2 }}>
                <g transform="scale(1.1)">{Draw(pal)}</g>
              </motion.g>
            )}
          </g>
        </svg>
      </motion.div>
    );
  }

  // hit / status
  const Motifs = fx.motifs.map((m) => MOTIFS[m]).filter(Boolean);
  return (
    <motion.div key={fx.id} style={layer} initial={{ opacity: 0, scale: 0.3, rotate: -10 }} animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.2 * big, 1.02 * big, 1.05 * big], rotate: [-10, 4, 0, 0] }} transition={{ duration: 1.05, times: [0, 0.18, 0.72, 1] }}>
      <svg viewBox="-60 -50 120 100" width="100%" height="100%" style={{ overflow: 'visible' }}>
        {fx.kind === 'hit' && (
          <g opacity={0.9}>
            {rays.map((i) => (
              <path key={i} transform={`rotate(${i * (360 / rays.length)})`} d="M-3.5,-8 L0,-48 L3.5,-8Z" fill={i % 2 ? pal.light : pal.main} stroke={pal.ink} strokeWidth={1.2} />
            ))}
            <circle r={16 * big} fill="#fffdf5" opacity={0.85} />
          </g>
        )}
        <g filter="url(#crayon)">
          {Motifs.map((Draw, i) => (
            <g key={i} transform={`translate(${i === 0 ? 0 : 30} ${i === 0 ? 0 : -22}) scale(${(i === 0 ? 1.0 : 0.6) * (fx.crit ? 1.12 : 1)})`}>
              {Draw(pal)}
            </g>
          ))}
        </g>
        {fx.kind === 'hit' &&
          particles.map((i) => {
            const a = (i / particles.length) * Math.PI * 2;
            const r = 38 + (i % 3) * 7;
            return (
              <motion.circle key={i} r={2.6 + (i % 3)} fill={i % 2 ? pal.main : pal.light} stroke={pal.ink} strokeWidth={0.8} initial={{ cx: 0, cy: 0, opacity: 1 }} animate={{ cx: Math.cos(a) * r, cy: Math.sin(a) * r, opacity: [1, 1, 0] }} transition={{ duration: 0.8, delay: 0.08 }} />
            );
          })}
      </svg>
    </motion.div>
  );
}

const layer = { position: 'absolute', inset: '-12%', pointerEvents: 'none', zIndex: 6 } as const;
