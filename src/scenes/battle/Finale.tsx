import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Character } from '../../engine/types';
import type { Side } from '../../engine';
import { CharacterSprite } from '../../components/bits';
import { P_COLOR } from '../../minigames/Arena';

/**
 * バトルの おわり：どっちが かったか ひとめで わかる 画面。
 *  ・名前（AI が つけた カタカナ）だけだと どっちが 自分か わかりにくいので、
 *    「きみ／あいて」（ひとり）・「P1／P2」（ふたり）の ラベルを いちばん 大きく 出す
 *  ・ふたりを ならべて、かった ほうは 大きく はねる＋「かち」、まけた ほうは 灰色で たおれる＋「まけ」
 *  ・おすまで（または すこし たつまで）のこる
 */
export type Outcome = Side | 'draw';

export function sideLabel(side: Side, cpu: boolean): string {
  return cpu ? (side === 0 ? 'きみ' : 'あいて') : side === 0 ? 'P1' : 'P2';
}
export function sideColor(side: Side, cpu: boolean): string {
  return cpu ? (side === 0 ? P_COLOR[0] : '#77716a') : P_COLOR[side];
}

export function headline(winner: Outcome, cpu: boolean): string {
  if (winner === 'draw') return 'ひきわけ！';
  if (cpu) return winner === 0 ? 'きみの かち！' : 'きみの まけ…';
  return `${sideLabel(winner, false)} の かち！`;
}

const COLORS = ['#e8503a', '#f2b705', '#1f9d63', '#3b82f6', '#7b5cf0', '#ec6a9c'];

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.7,
        dur: 1.6 + Math.random() * 1.4,
        rot: Math.random() * 720 - 360,
        color: COLORS[i % COLORS.length],
        size: 8 + Math.random() * 8,
      })),
    [],
  );
  return (
    <>
      {bits.map((b) => (
        <motion.div
          key={b.id}
          initial={{ y: '-12vh', x: `${b.x}vw`, rotate: 0 }}
          animate={{ y: '110vh', rotate: b.rot }}
          transition={{ duration: b.dur, delay: b.delay, repeat: Infinity, ease: 'linear' }}
          style={{ position: 'absolute', left: 0, top: 0, width: b.size, height: b.size * 0.6, background: b.color, borderRadius: 2 }}
        />
      ))}
    </>
  );
}

/** 1人ぶんの カード（ラベル・絵・名前・かち／まけ の ハンコ）。 */
function FighterCard({ side, result, cpu, name, char, image }: { side: Side; result: 'win' | 'lose' | 'draw'; cpu: boolean; name: string; char: Character; image: string | null }) {
  const win = result === 'win';
  const lose = result === 'lose';
  const color = sideColor(side, cpu);
  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={lose ? { y: 18, opacity: 1, rotate: side === 0 ? -10 : 10 } : { y: 0, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 180, damping: 14, delay: lose ? 0.35 : 0.15 }}
      style={{ display: 'grid', justifyItems: 'center', gap: '0.35rem', width: win ? 'min(40vw, 15rem)' : 'min(30vw, 11rem)' }}
    >
      {/* だれか（いちばん 大きく） */}
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: win ? 'clamp(1.4rem, 5vw, 2.2rem)' : 'clamp(1.1rem, 4vw, 1.6rem)',
          color: '#fff',
          background: lose ? '#9a948b' : color,
          border: '3px solid var(--ink)',
          borderRadius: 99,
          padding: '0 0.8em',
          boxShadow: '3px 3px 0 rgba(0,0,0,.25)',
        }}
      >
        {sideLabel(side, cpu)}
      </div>
      <motion.div
        animate={win ? { y: [0, -16, 0] } : undefined}
        transition={win ? { repeat: Infinity, duration: 0.7, ease: 'easeInOut' } : undefined}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1',
          background: lose ? '#e9e5dd' : '#fff',
          border: '4px solid var(--ink)',
          borderRadius: 14,
          padding: 8,
          boxShadow: win ? '0 0 0 8px rgba(242,183,5,.9), 0 14px 34px rgba(0,0,0,.35)' : '0 8px 18px rgba(0,0,0,.25)',
        }}
      >
        <div style={{ width: '100%', height: '100%', opacity: lose ? 0.45 : 1 }}>
          <CharacterSprite imageUrl={image} attribute={char.attribute} name={name} flip={side === 1} />
        </div>
        {/* かち／まけ の ハンコ */}
        {result !== 'draw' && (
          <motion.div
            initial={{ scale: 2.4, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: win ? -12 : 10 }}
            transition={{ delay: 0.55, type: 'spring', stiffness: 260, damping: 14 }}
            style={{
              position: 'absolute',
              right: '-8%',
              bottom: '-6%',
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: win ? 'clamp(1.6rem, 6vw, 2.6rem)' : 'clamp(1.2rem, 4.5vw, 1.8rem)',
              color: win ? '#e8503a' : '#5f5a53',
              background: '#fff',
              border: `4px solid ${win ? '#e8503a' : '#5f5a53'}`,
              borderRadius: 12,
              padding: '0 0.35em',
              lineHeight: 1.2,
            }}
          >
            {win ? 'かち' : 'まけ'}
          </motion.div>
        )}
      </motion.div>
      <div style={{ fontWeight: 900, fontSize: 'clamp(.85rem, 2.6vw, 1rem)', background: '#fffdf5', border: '2px solid var(--ink)', borderRadius: 8, padding: '0 0.5em', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </div>
    </motion.div>
  );
}

/** ふたりを ならべる（左が side 0、右が side 1。バトル画面と おなじ ならび）。 */
export function ResultCards({ winner, cpu, names, chars, images }: { winner: Outcome; cpu: boolean; names: [string, string]; chars: [Character, Character]; images: [string | null, string | null] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 'clamp(1rem, 6vw, 4rem)' }}>
      {([0, 1] as Side[]).map((s) => (
        <FighterCard key={s} side={s} cpu={cpu} result={winner === 'draw' ? 'draw' : winner === s ? 'win' : 'lose'} name={names[s]} char={chars[s]} image={images[s]} />
      ))}
    </div>
  );
}

export function Headline({ winner, cpu }: { winner: Outcome; cpu: boolean }) {
  const color = winner === 'draw' ? 'var(--ink)' : cpu ? (winner === 0 ? '#e8503a' : '#3b6fb6') : P_COLOR[winner];
  return (
    <motion.div
      initial={{ scale: 0.2, rotate: -12, opacity: 0 }}
      animate={{ scale: [0.2, 1.2, 1], rotate: [-12, 5, 0], opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 12 }}
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 900,
        fontSize: 'clamp(2.4rem, 11vw, 4.6rem)',
        color: '#fff',
        WebkitTextStroke: `6px ${color}`,
        paintOrder: 'stroke',
        textShadow: '0 6px 0 rgba(0,0,0,.18)',
        whiteSpace: 'nowrap',
        lineHeight: 1.1,
      }}
    >
      {headline(winner, cpu)}
    </motion.div>
  );
}

/** バトルの さいごに 出す 画面。onNext を わたすと「おして つぎへ」になる。 */
export function BattleFinale({ winner, cpu, names, chars, images, onNext }: { winner: Outcome; cpu: boolean; names: [string, string]; chars: [Character, Character]; images: [string | null, string | null]; onNext?: () => void }) {
  useEffect(() => {
    if (!onNext) return;
    const go = () => onNext();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') go();
    };
    // 出てすぐの 連打で とばさないように すこし まつ
    const arm = window.setTimeout(() => {
      window.addEventListener('keydown', onKey);
      window.addEventListener('pointerdown', go);
    }, 1200);
    // おさなくても 7びょうで つぎへ
    const auto = window.setTimeout(go, 7000);
    return () => {
      window.clearTimeout(arm);
      window.clearTimeout(auto);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', go);
    };
  }, [onNext]);

  const happy = winner !== 'draw' && (!cpu || winner === 0);
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 45,
        overflow: 'hidden',
        display: 'grid',
        alignContent: 'center',
        justifyItems: 'center',
        gap: 'clamp(1rem, 4vh, 2rem)',
        padding: '1rem',
        background: happy ? 'radial-gradient(circle at 50% 40%, rgba(255,240,190,.97), rgba(250,226,150,.95))' : 'radial-gradient(circle at 50% 40%, rgba(240,238,232,.97), rgba(205,210,220,.95))',
        cursor: onNext ? 'pointer' : 'default',
      }}
    >
      {happy && <Confetti />}
      <Headline winner={winner} cpu={cpu} />
      <ResultCards winner={winner} cpu={cpu} names={names} chars={chars} images={images} />
      <div style={{ height: '1.6em', fontSize: '0.95rem', fontWeight: 700, color: 'var(--ink-soft)' }}>
        {onNext && (
          <motion.span animate={{ opacity: [1, 0.35, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}>
            おすと つぎへ
          </motion.span>
        )}
      </div>
    </div>
  );
}
