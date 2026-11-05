import { motion } from 'framer-motion';
import type { Side } from '../../engine';
import { MG_LOSE_MULT, MG_WIN_MULT } from '../../engine';
import type { Character } from '../../engine/types';
import { CharacterSprite } from '../../components/bits';
import { P_COLOR } from '../../minigames/Arena';

/**
 * ミニゲームの ごほうび：かった キャラと「先に こうげき！」「いりょく ×1.3」を 大きく 見せる。
 * まけた ほうの「いりょく ×0.8」も 小さく 出す（なにが かわったのか わかるように）。
 */
export function RewardBanner({ winner, perfect, names, chars, images }: { winner: Side; perfect: boolean; names: [string, string]; chars: [Character, Character]; images: [string | null, string | null] }) {
  const loser = (1 - winner) as Side;
  const chip = (text: string, bg: string, delay: number) => (
    <motion.div
      initial={{ scale: 0, rotate: -8 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 16, delay }}
      style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.2rem, 4vw, 1.9rem)', color: '#fff', background: bg, border: '4px solid var(--ink)', borderRadius: 14, padding: '0.1em 0.7em', boxShadow: '3px 4px 0 rgba(0,0,0,.2)', whiteSpace: 'nowrap' }}
    >
      {text}
    </motion.div>
  );
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 30, display: 'grid', placeItems: 'center', background: 'rgba(255,248,225,.72)', pointerEvents: 'none' }}
    >
      <motion.div
        initial={{ scale: 0.4, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        style={{ display: 'grid', justifyItems: 'center', gap: '0.7rem', background: '#fffdf5', border: `6px solid ${P_COLOR[winner]}`, borderRadius: 22, boxShadow: '0 0 0 5px var(--ink), 10px 12px 0 rgba(0,0,0,.18)', padding: 'clamp(.8rem, 3vh, 1.6rem) clamp(1rem, 4vw, 2.6rem)', maxWidth: '92vw' }}
      >
        <div style={{ fontWeight: 900, fontSize: 'clamp(.95rem, 2.8vw, 1.2rem)', color: 'var(--ink-soft)' }}>ミニゲームの ごほうび</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <motion.div animate={{ y: [0, -10, 0], rotate: [0, -5, 5, 0] }} transition={{ repeat: Infinity, duration: 0.7 }} style={{ width: 'clamp(4rem, 12vw, 6rem)', height: 'clamp(4rem, 12vw, 6rem)' }}>
            <CharacterSprite imageUrl={images[winner]} attribute={chars[winner].attribute} name={names[winner]} />
          </motion.div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem, 5vw, 2.4rem)', color: P_COLOR[winner], WebkitTextStroke: '1px var(--ink)' }}>{names[winner]}の かち！</div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {chip('先に こうげき！', '#2f7dd1', 0.25)}
          {chip(`いりょく ×${MG_WIN_MULT}`, '#e8503a', 0.45)}
          {perfect && chip('パーフェクト！ クリティカル', '#d99a00', 0.65)}
        </div>
        <div style={{ fontWeight: 800, fontSize: 'clamp(.9rem, 2.6vw, 1.1rem)', color: 'var(--ink-soft)' }}>
          {names[loser]}は いりょく ×{MG_LOSE_MULT}
        </div>
      </motion.div>
    </motion.div>
  );
}
