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
      const t = window.setTimeout(onDone, 3600);
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
        animate={{ x: 0, rotate: -3, scale: step === 'title' ? 0.7 : 1 }}
        transition={{ type: 'spring', stiffness: 150, damping: 18 }}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(2rem, 8vw, 3.4rem)',
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
          <div style={{ fontWeight: 800 }}>なにが でるかな？</div>
          <div
            style={{
              width: 'min(86vw, 26rem)',
              height: '4.6rem',
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
                  fontSize: 'clamp(1.6rem, 6vw, 2.2rem)',
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
            gap: '0.7rem',
            background: '#fff',
            border: `5px solid ${kind.color}`,
            borderRadius: 20,
            padding: '1rem 1.4rem',
            boxShadow: `0 0 0 4px var(--ink), 8px 10px 0 rgba(0,0,0,.18)`,
            maxWidth: 'min(92vw, 34rem)',
          }}
        >
          <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#fff', background: kind.color, borderRadius: 99, padding: '0.1em 0.9em' }}>
            {kind.jp} の ゲーム
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 9vw, 3.4rem)', color: 'var(--ink)', whiteSpace: 'nowrap' }}>{def.name}</div>
          <div style={{ fontWeight: 900, fontSize: 'clamp(1.05rem, 4vw, 1.35rem)', textAlign: 'center' }}>{def.howto}</div>
          <HowToInput def={def} cpu={cpu} />
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--crayon-red)' }}>かったら 先に こうげき ＆ いりょく アップ！</div>
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
    <div style={{ display: 'flex', gap: '1.2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
      {players.map((p) => (
        <div key={p} style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 900, color: P_COLOR[p] }}>{p === 0 ? 'P1' : 'P2'}</div>
          {def.input === 'main' ? (
            <motion.div
              animate={{ scale: mash ? [1, 0.88, 1] : [1, 1, 0.88, 1] }}
              transition={{ repeat: Infinity, duration: mash ? 0.3 : 1.2 }}
              style={{
                width: '3.6rem',
                height: '3.6rem',
                borderRadius: '50%',
                background: P_COLOR[p],
                border: '4px solid var(--ink)',
                boxShadow: '0 5px 0 var(--ink)',
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                fontWeight: 900,
                fontSize: '0.85rem',
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
                    padding: '0.35em 0.45em',
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    background: '#fff',
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--ink-soft)' }}>
            {def.input === 'main' ? `キー ${KEY_LABELS[p].join('・')} どれでも` : `キー ${KEY_LABELS[p].join('・')}`}
          </div>
        </div>
      ))}
      <div style={{ alignSelf: 'center', fontSize: '0.75rem', fontWeight: 800, color: 'var(--ink-soft)' }}>タッチでも OK</div>
    </div>
  );
}
