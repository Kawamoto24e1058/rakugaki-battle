import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MinigameDef, MinigameOutcome, Player } from './types';
import { P_COLOR } from './Arena';
import { sfx } from '../audio/sfx';
import { KIND_META } from './Intro';
import { MinigameCtx, type MgFighter } from './context';

/** スコアから 勝ち負けを決める（4点差未満は ひきわけ）。 */
export function judge(scores: [number, number]): MinigameOutcome {
  const [a, b] = scores;
  if (Math.abs(a - b) < 4) return { scores, winner: null, perfect: false };
  const winner: Player = a > b ? 0 : 1;
  const ws = Math.max(a, b);
  const ls = Math.min(a, b);
  return { scores, winner, perfect: ws >= 80 && ws - ls >= 45 };
}

type Stage = 'play' | 'result';

/**
 * ミニゲーム1回ぶんの ながれ：タイトルと遊び方 → 3・2・1 → ゲーム → 結果 → onDone。
 */
export function MinigameStage({
  def,
  seed,
  cpu,
  cpuSkill,
  names,
  fighters,
  onDone,
}: {
  def: MinigameDef;
  seed: number;
  cpu: boolean;
  cpuSkill: number;
  names: [string, string];
  fighters: [MgFighter, MgFighter];
  onDone: (o: MinigameOutcome) => void;
}) {
  // カウントダウンは MinigameIntro が やる（タイトルから そのまま ゲームへ）
  const [stage, setStage] = useState<Stage>('play');
  const [outcome, setOutcome] = useState<MinigameOutcome | null>(null);
  const done = useRef(false);

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
    }, 2300);
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
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 6vw, 2.6rem)', whiteSpace: 'nowrap', color: KIND_META[def.kind].color, WebkitTextStroke: '2px var(--ink)', paintOrder: 'stroke' }}>{def.command}</span>
        <span style={{ fontSize: 'clamp(1rem, 3.4vw, 1.3rem)', fontWeight: 900, color: 'var(--ink)' }}>{def.howto}</span>
      </div>

      <MinigameCtx.Provider value={{ fighters, outcome: stage === 'result' ? outcome : null }}>
        <Game seed={seed} cpu={cpu} cpuSkill={cpuSkill} names={names} fighters={fighters} onFinish={stage === 'play' ? finish : () => {}} />
      </MinigameCtx.Provider>

      <AnimatePresence>
        {stage === 'result' && outcome && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            style={{ position: 'absolute', left: 0, right: 0, top: '-0.4rem', display: 'grid', justifyItems: 'center', pointerEvents: 'none', zIndex: 20 }}
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
