import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Character } from '../../engine/types';
import type { Side } from '../../engine';
import { CharacterSprite } from '../../components/bits';
import { P_COLOR } from '../../minigames/Arena';
import { sfx } from '../../audio/sfx';
import { bgm } from '../../audio/bgm';

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
  // 1文字ずつ 上から おちてくる
  return (
    <div style={{ display: 'flex', whiteSpace: 'nowrap', lineHeight: 1.1 }}>
      {[...headline(winner, cpu)].map((ch, i) => (
        <motion.span
          key={i}
          initial={{ y: -120, opacity: 0, rotate: -20 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          transition={{ delay: 0.15 + i * 0.07, type: 'spring', stiffness: 380, damping: 14 }}
          style={{
            display: 'inline-block',
            minWidth: ch === ' ' ? '0.35em' : undefined,
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'clamp(2.4rem, 11vw, 4.6rem)',
            color: '#fff',
            WebkitTextStroke: `6px ${color}`,
            paintOrder: 'stroke',
            textShadow: '0 6px 0 rgba(0,0,0,.18)',
          }}
        >
          {ch}
        </motion.span>
      ))}
    </div>
  );
}

/** うしろで ゆっくり まわる 光の すじ。 */
function Rays({ color }: { color: string }) {
  return (
    <motion.div
      aria-hidden
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, rotate: 360 }}
      transition={{ scale: { duration: 0.6 }, opacity: { duration: 0.6 }, rotate: { repeat: Infinity, duration: 30, ease: 'linear' } }}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: '170vmax',
        height: '170vmax',
        marginLeft: '-85vmax',
        marginTop: '-85vmax',
        willChange: 'transform',
        background: `repeating-conic-gradient(${color} 0deg 9deg, transparent 9deg 18deg)`,
        pointerEvents: 'none',
      }}
    />
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
  // 結果の ジングル（ふたりの ときは だれかが かつので かちの ほう）
  useEffect(() => {
    bgm.jingle(happy ? 'win' : 'lose');
  }, [happy]);
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
      <Rays color={happy ? 'rgba(242,183,5,.22)' : 'rgba(120,130,150,.14)'} />
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

/**
 * 決着の しゅんかん（約3びょう）。
 *  0.0  白く ひかる＋画面が ゆれる＋「どーん」（BGM は とまる）
 *  0.25 「けっちゃく！」が たたきつけられる。うしろに 集中線
 *  0.7  まけた ほうが くるくる まわって とおくへ ふっとぶ →「キラーン」
 *  1.5  かった ほうが とんできて 着地
 *  2.7  白く なって 結果へ
 */
export function KoSequence({ winner, names, chars, images }: { winner: Side; names: [string, string]; chars: [Character, Character]; images: [string | null, string | null] }) {
  const loser = (1 - winner) as Side;
  const out = loser === 0 ? -1 : 1; // まけた ほうは 自分の がわへ とんでいく
  useEffect(() => {
    bgm.play(null);
    sfx.finish();
    const ts = [window.setTimeout(() => sfx.whoosh(), 700), window.setTimeout(() => sfx.twinkle(), 1350), window.setTimeout(() => sfx.release(), 1650)];
    return () => ts.forEach((t) => window.clearTimeout(t));
  }, []);

  const card = (s: Side, ring: string) => (
    <div style={{ width: 'min(36vw, 13rem)', aspectRatio: '1', background: '#fff', border: '4px solid var(--ink)', borderRadius: 14, padding: 8, boxShadow: `0 0 0 7px ${ring}, 0 14px 30px rgba(0,0,0,.45)` }}>
      <CharacterSprite imageUrl={images[s]} attribute={chars[s].attribute} name={names[s]} flip={s === 1} />
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 47, overflow: 'hidden', background: '#140f1c', pointerEvents: 'none' }}>
    <motion.div
      animate={{ x: [0, -18, 14, -10, 6, 0], y: [0, 10, -8, 5, -2, 0] }}
      transition={{ duration: 0.5 }}
      style={{ position: 'absolute', inset: -24, overflow: 'hidden', background: 'radial-gradient(circle at 50% 50%, #4a2a1a, #140f1c 70%)' }}
    >
      {/* 集中線 */}
      <motion.div
        aria-hidden
        initial={{ scale: 0.2, opacity: 0, rotate: 0 }}
        animate={{ scale: 1.1, opacity: 1, rotate: 30 }}
        transition={{ duration: 2.8, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '180vmax',
          height: '180vmax',
          marginLeft: '-90vmax',
          marginTop: '-90vmax',
          willChange: 'transform',
          background: 'repeating-conic-gradient(rgba(255,200,60,.55) 0deg 2deg, transparent 2deg 9deg)',
          WebkitMaskImage: 'radial-gradient(circle, transparent 12%, #000 40%)',
          maskImage: 'radial-gradient(circle, transparent 12%, #000 40%)',
        }}
      />

      {/* まけた ほう：ゆれて → ふっとぶ */}
      <div style={{ position: 'absolute', left: '50%', top: '58%' }}>
        <motion.div
          initial={{ x: '-50%', y: '-50%', scale: 1.15, rotate: 0, opacity: 1 }}
          animate={{
            x: ['-50%', '-56%', '-44%', '-50%', `calc(-50% + ${out * 75}vw)`],
            y: ['-50%', '-50%', '-50%', '-50%', '-60vh'],
            rotate: [0, -8, 8, 0, out * 900],
            scale: [1.15, 1.15, 1.15, 1.15, 0.15],
          }}
          transition={{ duration: 1.35, times: [0, 0.12, 0.24, 0.45, 1], ease: 'easeIn' }}
        >
          {card(loser, '#9a948b')}
        </motion.div>
      </div>
      {/* キラーン（とんでいった さき） */}
      <motion.div
        initial={{ scale: 0, opacity: 0, rotate: 0 }}
        animate={{ scale: [0, 1.4, 0], opacity: [0, 1, 0], rotate: 90 }}
        transition={{ delay: 1.3, duration: 0.5 }}
        style={{ position: 'absolute', top: '8%', [out < 0 ? 'left' : 'right']: '10%', width: 60, height: 60 }}
      >
        <svg viewBox="-10 -10 20 20" width="60" height="60">
          <path d="M0,-10 L2,-2 L10,0 L2,2 L0,10 L-2,2 L-10,0 L-2,-2Z" fill="#fff6c8" />
        </svg>
      </motion.div>

      {/* かった ほう：とんできて 着地 */}
      <div style={{ position: 'absolute', left: '50%', top: '58%' }}>
        <motion.div
          initial={{ x: `calc(-50% + ${-out * 70}vw)`, y: '-120%', rotate: -out * 30, opacity: 0 }}
          animate={{ x: '-50%', y: '-50%', rotate: 0, opacity: 1 }}
          transition={{ delay: 1.5, type: 'spring', stiffness: 240, damping: 14 }}
        >
          {card(winner, 'rgba(242,183,5,.95)')}
        </motion.div>
      </div>

      {/* けっちゃく！ */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: '16%', display: 'grid', placeItems: 'center' }}>
        <motion.div
          initial={{ scale: 4, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: -4 }}
          transition={{ delay: 0.25, type: 'spring', stiffness: 420, damping: 15 }}
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'clamp(3rem, 14vw, 6.5rem)',
            color: '#ffe066',
            WebkitTextStroke: '7px #c0392b',
            paintOrder: 'stroke',
            textShadow: '0 8px 0 rgba(0,0,0,.45)',
            whiteSpace: 'nowrap',
          }}
        >
          けっちゃく！
        </motion.div>
      </div>

      {/* はじめの 白い ひかり */}
      <motion.div initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.4 }} style={{ position: 'absolute', inset: 0, background: '#fff' }} />
      {/* おわりの 白い ひかり（結果へ） */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 1] }} transition={{ duration: 3, times: [0, 0.88, 1] }} style={{ position: 'absolute', inset: 0, background: '#fff' }} />
    </motion.div>
    </div>
  );
}
