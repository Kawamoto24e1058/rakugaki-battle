import { useGame } from '../store/gameStore';
import { Headline, ResultCards, type Outcome } from './battle/Finale';

export function ResultScene() {
  const mode = useGame((s) => s.mode);
  const won = useGame((s) => s.lastWon);
  const player = useGame((s) => s.player);
  const opponent = useGame((s) => s.opponent);
  const runWins = useGame((s) => s.runWins);
  const runBattles = useGame((s) => s.runBattles);
  const nextRound = useGame((s) => s.nextRound);
  const savePlayerToZukan = useGame((s) => s.savePlayerToZukan);
  const reset = useGame((s) => s.reset);

  function endRun() {
    savePlayerToZukan();
    reset();
  }

  const draw = useGame((s) => s.lastDraw);
  const winner: Outcome = draw ? 'draw' : won ? 0 : 1;
  const cards =
    player && opponent ? (
      <ResultCards
        winner={winner}
        cpu={mode !== 'versus'}
        names={[player.character.name, opponent.character.name]}
        chars={[player.character, opponent.character]}
        images={[player.imageUrl, opponent.imageUrl]}
      />
    ) : null;

  if (mode === 'versus') {
    // side 0 = P1, side 1 = P2（バトル画面と おなじ ならび）
    return (
      <div className="scene" style={{ justifyContent: 'center', gap: '1.4rem' }}>
        <Headline winner={winner} cpu={false} />
        {cards}
        <button className="crayon-btn primary big" onClick={reset}>
          タイトルに もどる
        </button>
      </div>
    );
  }

  // ソロ：強化なし。勝敗のカウントだけ見せて、つぎの相手 or おわる。
  return (
    <div className="scene" style={{ justifyContent: 'center', gap: '1rem' }}>
      <Headline winner={winner} cpu />
      {cards}

      <div
        className="sketch-card"
        style={{ padding: '0.7rem 1.4rem', display: 'grid', gap: 2, placeItems: 'center' }}
      >
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem' }}>
          {runWins} しょう {runBattles - runWins} はい
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
          {player?.character.name} ・ {runBattles} かい たたかった
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="crayon-btn primary big" onClick={nextRound}>
          つぎの あいて →
        </button>
        <button className="crayon-btn" onClick={endRun}>
          きょうは ここまで（ずかんへ）
        </button>
      </div>
    </div>
  );
}
