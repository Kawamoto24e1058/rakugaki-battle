import { motion } from 'framer-motion';
import { MOTIFS } from '../../components/art/motifs';
import { PALETTES } from '../../components/art/palette';
import { STATUS_ART } from './beats';
import type { Chip } from './types';

/** 状態異常・バフ・ため中を、絵そのものに まとわせる。 */
export function Aura({ chips, side }: { chips: Chip[]; side: 0 | 1 }) {
  const has = (k: string) => chips.some((c) => c.kind === k);
  const frozen = has('freeze');
  const items = chips.filter((c) => STATUS_ART[c.kind] && c.kind !== 'freeze' && c.kind !== 'charging');
  return (
    <>
      {/* こおり：絵を氷づけに */}
      {frozen && (
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} style={{ position: 'absolute', inset: '-6%', zIndex: 4, pointerEvents: 'none' }}>
          <svg viewBox="-50 -50 100 100" width="100%" height="100%">
            <g filter="url(#crayon)" opacity={0.78}>
              <g transform="scale(1.9)">{MOTIFS.iceblock(PALETTES.water)}</g>
            </g>
          </svg>
        </motion.div>
      )}
      {/* ため中・ためた：光るリング */}
      {(has('charged') || has('charging')) && (
        <motion.div
          animate={{ opacity: [0.6, 0.9, 0.6] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          style={{ position: 'absolute', inset: '-10%', borderRadius: '50%', boxShadow: `0 0 0 0.35rem ${PALETTES.kosei.main}, 0 0 2.2rem 0.6rem ${PALETTES.kosei.light}`, pointerEvents: 'none', zIndex: 3 }}
        />
      )}
      {/* ほか：絵のまわりに小さく浮かぶ */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
        {items.slice(0, 6).map((c, i) => {
          const a = STATUS_ART[c.kind];
          if (!a) return null;
          const Draw = MOTIFS[a.motif];
          const pal = PALETTES[a.pal];
          // 左右の上のほうに ならべる
          const col = i % 3;
          const row = Math.floor(i / 3);
          const left = side === 0 ? 4 + col * 24 : 8 + col * 24;
          const top = -4 + row * 22 + (col === 1 ? -4 : 0);
          const rise = c.kind === 'poison' || c.kind === 'sleep' || c.good;
          return (
            <motion.div
              key={`${c.kind}-${i}`}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1, y: rise ? [0, -4, 0] : [0, 2, 0], rotate: 0 }}
              transition={{ opacity: { duration: 0.3 }, scale: { type: 'spring' }, y: { repeat: Infinity, duration: 2.4 + col * 0.3, ease: 'easeInOut' } }}
              style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, width: '28%', aspectRatio: '1' }}
              title={c.jp}
            >
              <svg viewBox="-48 -48 96 96" width="100%" height="100%" style={{ overflow: 'visible' }}>
                <g filter="url(#crayon)">{Draw && Draw(pal)}</g>
              </svg>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}
