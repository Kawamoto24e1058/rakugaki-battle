import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { KIND_META, type MinigameDef } from '../../minigames';
import { P_COLOR } from '../../minigames/Arena';

/**
 * ミニゲームの 場面（バトル画面から 切りかわる）。
 *  入る：まんなかから まるく ひろがって ミニゲームの 画面に（メイドインワリオ風）
 *  中：画面ぜんぶを つかう。うしろで 光の すじが ゆっくり まわる
 *  出る：まるく しぼんで バトル画面に もどる
 */
export function MinigameScene({ def, turn, names, children }: { def: MinigameDef; turn: number; names: [string, string]; children: ReactNode }) {
  const color = KIND_META[def.kind].color;
  return (
    <motion.div
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)', transition: { duration: 0.55, ease: [0.3, 0, 0.2, 1] } }}
      exit={{ clipPath: 'circle(0% at 50% 50%)', transition: { duration: 0.45, ease: [0.5, 0, 0.8, 0.4] } }}
      style={{ position: 'fixed', inset: 0, zIndex: 35, overflow: 'hidden', background: '#fff6d8' }}
    >
      {/* 光の すじ（ゆっくり まわる） */}
      <motion.div
        aria-hidden
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 40, ease: 'linear' }}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '220vmax',
          height: '220vmax',
          marginLeft: '-110vmax',
          marginTop: '-110vmax',
          background: `repeating-conic-gradient(${color}22 0deg 10deg, transparent 10deg 20deg)`,
          pointerEvents: 'none',
        }}
      />
      {/* ドット */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(#33302b14 1.5px, transparent 1.6px)', backgroundSize: '18px 18px', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', height: '100%', overflowY: 'auto', display: 'grid', alignContent: 'start', justifyItems: 'center', gap: '0.6rem', padding: 'clamp(.5rem, 2vh, 1.2rem) clamp(.6rem, 3vw, 2rem)' }}>
        {/* 上の 帯：ターンと 2人 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem, 3vw, 1.4rem)', color: '#fff', background: color, border: '3px solid var(--ink)', borderRadius: 99, padding: '0.05em 0.9em', boxShadow: '3px 3px 0 rgba(0,0,0,.2)' }}>
            ターン {turn}　ミニゲーム
          </span>
          <span style={{ fontWeight: 900, fontSize: 'clamp(.9rem, 2.6vw, 1.1rem)', background: '#fffdf5', border: '3px solid var(--ink)', borderRadius: 12, padding: '0.1em 0.7em' }}>
            <span style={{ color: P_COLOR[0] }}>{names[0]}</span>
            <span style={{ margin: '0 0.5em', fontFamily: 'var(--font-display)' }}>VS</span>
            <span style={{ color: P_COLOR[1] }}>{names[1]}</span>
          </span>
        </div>
        <div style={{ width: '100%', maxWidth: '68rem', display: 'grid', justifyItems: 'center' }}>{children}</div>
      </div>
    </motion.div>
  );
}
