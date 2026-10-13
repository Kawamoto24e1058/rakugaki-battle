import { useEffect, useMemo, useState } from 'react';
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

type Step = 'band' | 'spin' | 'title';

/**
 * ミニゲームの はじまり：「ミニゲーム！」の帯 → ゲーム名が ルーレットで まわって きまる
 * → 大きな タイトルと 遊び方・つかう ボタン。全部 自動（タップで はやおくり）。
 */
export function MinigameIntro({
  def,
  all,
  cpu,
  onDone,
}: {
  def: MinigameDef;
  /** ルーレットに ながす ゲーム一覧。 */
  all: MinigameDef[];
  cpu: boolean;
  onDone: () => void;
}) {
  const [step, setStep] = useState<Step>('band');
  // ルーレットの ならび：ほかのゲームを ながして、さいごに きまった ゲーム
  const reel = useMemo(() => {
    const others = all.filter((g) => g.id !== def.id);
    const seq: MinigameDef[] = [];
    for (let i = 0; i < 14; i++) seq.push(others[(i * 5 + def.id.length) % others.length]);
    seq.push(def);
    return seq;
  }, [all, def]);
  const [pos, setPos] = useState(0);

  useEffect(() => {
    if (step === 'band') {
      sfx.whoosh();
      const t = window.setTimeout(() => setStep('spin'), 1100);
      return () => window.clearTimeout(t);
    }
    if (step === 'title') {
      sfx.reveal();
      const t = window.setTimeout(onDone, 4200);
      return () => window.clearTimeout(t);
    }
    // spin：だんだん ゆっくり
    if (pos >= reel.length - 1) {
      const t = window.setTimeout(() => setStep('title'), 450);
      return () => window.clearTimeout(t);
    }
    const left = reel.length - 1 - pos;
    const delay = left > 6 ? 70 : 70 + (7 - left) * 55;
    const t = window.setTimeout(() => {
      setPos((p) => p + 1);
      sfx.tick(left <= 1 ? 1.4 : 1);
    }, delay);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pos]);

  const skip = () => {
    if (step === 'band') setStep('spin');
    else if (step === 'spin') {
      setPos(reel.length - 1);
      setStep('title');
    } else onDone();
  };

  const kind = KIND_META[def.kind];
  const cur = reel[pos];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
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
      }}
    >
      {/* 帯 */}
      <motion.div
        initial={{ x: '-120vw', rotate: -3 }}
        animate={{ x: 0, rotate: -3, scale: step === 'title' ? 0.6 : 1.15 }}
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

      {/* ルーレット */}
      {step === 'spin' && (
        <div style={{ display: 'grid', justifyItems: 'center', gap: '0.5rem' }}>
          <div style={{ fontWeight: 900, fontSize: 'clamp(1.1rem, 4vw, 1.5rem)' }}>なにが でるかな？</div>
          <div
            style={{
              width: 'min(92vw, 36rem)',
              height: 'clamp(5.5rem, 16vw, 8rem)',
              border: '4px solid var(--ink)',
              borderRadius: 14,
              background: '#fff',
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '4px 5px 0 rgba(0,0,0,.15)',
            }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={pos}
                initial={{ y: '-100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.06 }}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(2.4rem, 10vw, 4.2rem)',
                  color: KIND_META[cur.kind].color,
                  whiteSpace: 'nowrap',
                }}
              >
                {cur.name}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* タイトル＋遊び方 */}
      {step === 'title' && (
        <motion.div
          initial={{ scale: 0.3, opacity: 0, rotate: -6 }}
          animate={{ scale: [0.3, 1.12, 1], opacity: 1, rotate: [-6, 2, 0] }}
          transition={{ duration: 0.5 }}
          style={{
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
          <div style={{ fontWeight: 900, fontSize: 'clamp(1rem, 3.4vw, 1.3rem)', color: '#fff', background: kind.color, borderRadius: 99, padding: '0.15em 1.1em' }}>
            {kind.jp} の ゲーム
          </div>
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ repeat: Infinity, duration: 1.1, delay: 0.5 }}
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem, 13vw, 6rem)', color: kind.color, whiteSpace: 'nowrap', lineHeight: 1.05, WebkitTextStroke: '3px var(--ink)', paintOrder: 'stroke' }}
          >
            {def.name}
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
          <div style={{ fontSize: 'clamp(.95rem, 3.2vw, 1.2rem)', fontWeight: 900, color: 'var(--crayon-red)' }}>かったら 先に こうげき ＆ いりょく アップ！</div>
        </motion.div>
      )}

      <div style={{ position: 'fixed', bottom: '0.8rem', left: 0, right: 0, textAlign: 'center', fontSize: '0.75rem', color: 'var(--ink-soft)' }}>
        タップで はやおくり
      </div>
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
