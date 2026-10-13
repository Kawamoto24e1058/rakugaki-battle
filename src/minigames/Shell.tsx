import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MinigameDef, MinigameOutcome, Player } from './types';
import { KEY_LABELS } from './input';
import { P_COLOR } from './Arena';
import { sfx } from '../audio/sfx';

/** スコアから 勝ち負けを決める（4点差未満は ひきわけ）。 */
export function judge(scores: [number, number]): MinigameOutcome {
  const [a, b] = scores;
  if (Math.abs(a - b) < 4) return { scores, winner: null, perfect: false };
  const winner: Player = a > b ? 0 : 1;
  const ws = Math.max(a, b);
  const ls = Math.min(a, b);
  return { scores, winner, perfect: ws >= 80 && ws - ls >= 45 };
}

type Stage = 'intro' | 'play' | 'result';

/**
 * ミニゲーム1回ぶんの ながれ：タイトルと遊び方 → 3・2・1 → ゲーム → 結果 → onDone。
 */
export function MinigameStage({
  def,
  seed,
  cpu,
  cpuSkill,
  names,
  onDone,
}: {
  def: MinigameDef;
  seed: number;
  cpu: boolean;
  cpuSkill: number;
  names: [string, string];
  onDone: (o: MinigameOutcome) => void;
}) {
  const [stage, setStage] = useState<Stage>('intro');
  const [count, setCount] = useState(3);
  const [outcome, setOutcome] = useState<MinigameOutcome | null>(null);
  const done = useRef(false);

  // 3・2・1・スタート！
  useEffect(() => {
    if (stage !== 'intro') return;
    if (count > 0) sfx.count();
    else sfx.go();
    const t = window.setTimeout(() => {
      if (count <= 0) setStage('play');
      else setCount((c) => c - 1);
    }, count <= 0 ? 600 : 750);
    return () => window.clearTimeout(t);
  }, [stage, count]);

  useEffect(() => {
    if (stage === 'result' && outcome) {
      if (outcome.winner != null) sfx.reveal();
      else sfx.select();
    }
  }, [stage, outcome]);

  useEffect(() => {
    if (stage !== 'result' || !outcome) return;
    const t = window.setTimeout(() => {
      if (done.current) return;
      done.current = true;
      onDone(outcome);
    }, 1700);
    return () => window.clearTimeout(t);
  }, [stage, outcome, onDone]);

  const Game = def.Component;
  const finish = useMemo(
    () => (scores: [number, number]) => {
      setOutcome((prev) => prev ?? judge(scores));
      setStage('result');
    },
    [],
  );

  return (
    <div style={{ width: '100%', maxWidth: '52rem', position: 'relative', display: 'grid', gap: '0.4rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'center', columnGap: '0.6rem', rowGap: '0.1rem', textAlign: 'center' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', whiteSpace: 'nowrap' }}>{def.name}</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--ink-soft)' }}>{def.howto}</span>
      </div>

      {stage === 'intro' ? (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '13rem', gap: '0.5rem' }}>
          <AnimatePresence mode="popLayout">
            <motion.div
              key={count}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.6, opacity: 0 }}
              style={{ fontFamily: 'var(--font-display)', fontSize: count <= 0 ? '3.2rem' : '5rem', color: count <= 0 ? 'var(--crayon-red)' : 'var(--ink)' }}
            >
              {count <= 0 ? 'スタート！' : count}
            </motion.div>
          </AnimatePresence>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-soft)', textAlign: 'center' }}>
            {def.input === 'main' ? 'ボタン' : 'こたえのボタン'}：
            <span style={{ color: P_COLOR[0] }}> P1 {KEY_LABELS[0].join(' ')} </span>
            {!cpu && <span style={{ color: P_COLOR[1] }}> ／ P2 {KEY_LABELS[1].join(' ')}</span>}
            ・ タッチでも OK
          </div>
        </div>
      ) : (
        <Game seed={seed} cpu={cpu} cpuSkill={cpuSkill} names={names} onFinish={stage === 'play' ? finish : () => {}} />
      )}

      <AnimatePresence>
        {stage === 'result' && outcome && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', zIndex: 20 }}
          >
            <div style={{ background: 'rgba(255,253,245,.96)', border: '4px solid var(--ink)', borderRadius: 16, padding: '0.6rem 1.4rem', textAlign: 'center', boxShadow: '5px 6px 0 rgba(0,0,0,.2)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', color: outcome.winner == null ? 'var(--ink)' : P_COLOR[outcome.winner] }}>
                {outcome.winner == null ? 'ひきわけ！' : `${names[outcome.winner]} の かち！`}
              </div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                {outcome.winner == null ? 'すばやさで じゅんばんが きまるよ' : outcome.perfect ? 'パーフェクト！ 先に こうげき＋クリティカル！' : '先に こうげき ＆ いりょく アップ！'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', marginTop: 2 }}>
                スコア {Math.round(outcome.scores[0])} ー {Math.round(outcome.scores[1])}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
