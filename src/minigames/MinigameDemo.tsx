import { useState } from 'react';
import { MINIGAMES, MinigameStage, type MinigameOutcome } from './index';

/** 開発用：?mg=ID（&vs で2人）で ミニゲームだけ遊べる。 */
export function MinigameDemo() {
  const q = new URLSearchParams(window.location.search);
  const [idx, setIdx] = useState(() => Math.max(0, MINIGAMES.findIndex((g) => g.id === q.get('mg'))));
  const [round, setRound] = useState(0);
  const [last, setLast] = useState<MinigameOutcome | null>(null);
  const vs = q.has('vs');
  return (
    <div className="scene" style={{ justifyContent: 'flex-start', gap: '0.6rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
        {MINIGAMES.map((g, i) => (
          <button key={g.id} className="crayon-btn" style={{ fontSize: '0.75rem', padding: '0.2em 0.7em', background: i === idx ? 'var(--crayon-yellow)' : undefined }} onClick={() => { setIdx(i); setRound((r) => r + 1); }}>
            {g.name}
          </button>
        ))}
      </div>
      <MinigameStage key={`${idx}-${round}`} def={MINIGAMES[idx]} seed={1234 + round * 77} cpu={!vs} cpuSkill={0.6} names={['ポチころ', 'ドカドカおに']} onDone={(o) => { setLast(o); setRound((r) => r + 1); }} />
      {last && <div style={{ fontSize: '0.8rem' }}>前回：{last.scores.map(Math.round).join(' - ')} / 勝ち {String(last.winner)} {last.perfect ? 'perfect' : ''}</div>}
    </div>
  );
}
