import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MinigameDef, MinigameKind } from './types';
import { KEY_LABELS } from './input';
import { P_COLOR } from './Arena';
import { sfx } from '../audio/sfx';

export const KIND_META: Record<MinigameKind, { jp: string; color: string }> = {
  body: { jp: 'からだ', color: '#e8503a' },
  head: { jp: 'あたま', color: '#2f7dd1' },
  find: { jp: 'さがす', color: '#1f9d63' },
  luck: { jp: 'うん', color: '#d99a00' },
};

type Step = 'band' | 'title' | 3 | 2 | 1 | 'go';
const STEP_MS: Record<string, number> = { band: 900, title: 2800, 3: 650, 2: 650, 1: 650 };
const NEXT: Record<string, Step> = { band: 'title', title: 3, 3: 2, 2: 1, 1: 'go' };

/**
 * ミニゲームの はじまり（メイドインワリオ風）：
 * 「ミニゲーム！」の帯 → 大きな お題（「れんだ！」）と 遊び方を じっくり見せる
 * → 同じカードの上で 3・2・1 → 「スタート！」で カードが はじけて そのまま ゲームへ。
 * onDone は「スタート！」の しゅんかんに よぶ（カードが きえる あいだに ゲームが はじまる）。
 */
export function MinigameIntro({ def, cpu, onDone }: { def: MinigameDef; cpu: boolean; onDone: () => void }) {
  const [step, setStep] = useState<Step>('band');

  useEffect(() => {
    if (step === 'band') sfx.whoosh();
    else if (step === 'title') sfx.reveal();
    else if (step === 'go') {
      sfx.go();
      onDone();
      return;
    } else sfx.count();
    const t = window.setTimeout(() => setStep(NEXT[String(step)]), STEP_MS[String(step)]);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // タップで はやおくり（お題の あいだだけ。カウントダウンは とばさない）
  const skip = () => {
    if (step === 'band') setStep('title');
    else if (step === 'title') setStep(3);
  };

  const kind = KIND_META[def.kind];
  const counting = typeof step === 'number';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      onClick={skip}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: 'rgba(250, 246, 236, 0.94)',
        display: 'grid',
        alignContent: 'center',
        justifyItems: 'center',
        gap: '1.1rem',
        padding: '1rem',
        overflow: 'hidden',
        cursor: 'pointer',
        pointerEvents: step === 'go' ? 'none' : 'auto',
      }}
    >
      {/* 帯 */}
      <motion.div
        initial={{ x: '-120vw', rotate: -3 }}
        animate={{ x: 0, rotate: -3, scale: step === 'band' ? 1.15 : 0.6 }}
        transition={{ type: 'spring', stiffness: 150, damping: 18 }}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(2.4rem, 10vw, 4.4rem)',
          color: '#fff',
          background: 'linear-gradient(90deg, #e8503a, #f2b705, #1f9d63, #2f7dd1)',
          padding: '0.1em 1.4em',
          WebkitTextStroke: '5px var(--ink)',
          paintOrder: 'stroke',
          boxShadow: '5px 6px 0 rgba(0,0,0,.2)',
          border: '4px solid var(--ink)',
        }}
      >
        ミニゲーム！
      </motion.div>

      {/* お題カード（そのまま カウントダウン → はじけて ゲームへ） */}
      {step !== 'band' && (
        <motion.div
          initial={{ scale: 0.3, opacity: 0, rotate: -6 }}
          animate={{ scale: [0.3, 1.12, 1], opacity: 1, rotate: [-6, 2, 0] }}
          exit={{ scale: 1.7, opacity: 0, transition: { duration: 0.35, ease: 'easeIn' } }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'relative',
            display: 'grid',
            justifyItems: 'center',
            gap: 'clamp(.6rem, 2vh, 1.1rem)',
            background: '#fff',
            border: `6px solid ${kind.color}`,
            borderRadius: 24,
            padding: 'clamp(1rem, 3vh, 1.8rem) clamp(1rem, 4vw, 2.6rem)',
            boxShadow: `0 0 0 5px var(--ink), 10px 12px 0 rgba(0,0,0,.18)`,
            width: 'min(94vw, 46rem)',
          }}
        >
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontWeight: 900, fontSize: 'clamp(1rem, 3.4vw, 1.3rem)', color: '#fff', background: kind.color, borderRadius: 99, padding: '0.15em 1.1em' }}>
              {kind.jp} の ゲーム
            </span>
            {def.name !== def.command && <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.1rem, 3.6vw, 1.5rem)' }}>{def.name}</span>}
          </div>
          {/* お題：いちばん 大きく */}
          <motion.div
            animate={{ scale: [1, 1.07, 1], rotate: [0, -1.5, 1.5, 0] }}
            transition={{ repeat: Infinity, duration: 0.9, delay: 0.5 }}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(3.4rem, 15vw, 7rem)',
              color: kind.color,
              whiteSpace: 'nowrap',
              lineHeight: 1.05,
              WebkitTextStroke: '4px var(--ink)',
              paintOrder: 'stroke',
            }}
          >
            {def.command}
          </motion.div>
          <div
            style={{
              fontWeight: 900,
              fontSize: 'clamp(1.3rem, 5vw, 2rem)',
              textAlign: 'center',
              background: '#fff8d6',
              border: '3px solid var(--ink)',
              borderRadius: 14,
              padding: '0.2em 0.9em',
            }}
          >
            {def.howto}
          </div>
          <HowToInput def={def} cpu={cpu} />

          {/* お題を 見せる 時間の バー → カウントダウン */}
          <div style={{ width: '70%', height: '0.7rem', borderRadius: 99, border: '3px solid var(--ink)', overflow: 'hidden', background: '#fff' }}>
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: step === 'title' ? '100%' : '100%' }}
              transition={{ duration: step === 'title' ? STEP_MS.title / 1000 : 0, ease: 'linear' }}
              style={{ height: '100%', background: kind.color }}
            />
          </div>
          <div style={{ fontSize: 'clamp(.95rem, 3.2vw, 1.2rem)', fontWeight: 900, color: 'var(--crayon-red)' }}>かったら 先に こうげき ＆ いりょく アップ！</div>

          {/* 3・2・1・スタート！ は カードの 上に 大きく */}
          <AnimatePresence>
            {(counting || step === 'go') && (
              <motion.div
                key={String(step)}
                initial={{ scale: 2.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  pointerEvents: 'none',
                  fontFamily: 'var(--font-display)',
                  fontSize: step === 'go' ? 'clamp(4rem, 16vw, 8rem)' : 'clamp(7rem, 30vw, 14rem)',
                  color: '#fff',
                  WebkitTextStroke: `10px ${step === 'go' ? 'var(--crayon-red)' : 'var(--ink)'}`,
                  paintOrder: 'stroke',
                  textShadow: '0 8px 0 rgba(0,0,0,.18)',
                  whiteSpace: 'nowrap',
                }}
              >
                {step === 'go' ? 'スタート！' : step}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {(step === 'band' || step === 'title') && (
        <div style={{ position: 'fixed', bottom: '0.8rem', left: 0, right: 0, textAlign: 'center', fontSize: '0.75rem', color: 'var(--ink-soft)' }}>
          タップで はやおくり
        </div>
      )}
    </motion.div>
  );
}

/** つかう ボタンの絵（ボタン1つ／3つから えらぶ）と キー。 */
function HowToInput({ def, cpu }: { def: MinigameDef; cpu: boolean }) {
  const players = cpu ? ([0] as const) : ([0, 1] as const);
  const mash = def.id === 'mash';
  return (
    <div style={{ display: 'flex', gap: '1.8rem', justifyContent: 'center', alignItems: 'end', flexWrap: 'wrap' }}>
      {players.map((p) => (
        <div key={p} style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
          <div style={{ fontSize: '1rem', fontWeight: 900, color: P_COLOR[p] }}>{p === 0 ? 'P1' : 'P2'}</div>
          {def.input === 'main' ? (
            <motion.div
              animate={{ scale: mash ? [1, 0.88, 1] : [1, 1, 0.88, 1] }}
              transition={{ repeat: Infinity, duration: mash ? 0.3 : 1.2 }}
              style={{
                width: 'clamp(4rem, 14vw, 5.6rem)',
                height: 'clamp(4rem, 14vw, 5.6rem)',
                borderRadius: '50%',
                background: P_COLOR[p],
                border: '4px solid var(--ink)',
                boxShadow: '0 5px 0 var(--ink)',
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                fontWeight: 900,
                fontSize: 'clamp(1rem, 3.6vw, 1.3rem)',
              }}
            >
              {mash ? 'れんだ' : 'おす'}
            </motion.div>
          ) : (
            <div style={{ display: 'flex', gap: 5 }}>
              {['ひだり', 'まんなか', 'みぎ'].map((t) => (
                <div
                  key={t}
                  style={{
                    border: `3px solid ${P_COLOR[p]}`,
                    borderRadius: 8,
                    padding: '0.5em 0.6em',
                    fontSize: 'clamp(.85rem, 3vw, 1.05rem)',
                    fontWeight: 900,
                    background: '#fff',
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 'clamp(.85rem, 2.8vw, 1rem)', fontWeight: 800, color: 'var(--ink-soft)' }}>
            {def.input === 'main' ? `キー ${KEY_LABELS[p].join('・')} どれでも` : `キー ${KEY_LABELS[p].join('・')}`}
          </div>
        </div>
      ))}
      <div style={{ alignSelf: 'center', fontSize: 'clamp(.85rem, 2.8vw, 1rem)', fontWeight: 800, color: 'var(--ink-soft)' }}>タッチでも OK</div>
    </div>
  );
}
