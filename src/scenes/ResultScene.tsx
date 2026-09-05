import { useGame } from '../store/gameStore';

export function ResultScene() {
  const won = useGame((s) => s.lastWon);
  const player = useGame((s) => s.player);
  const pending = useGame((s) => s.pendingChallenger);
  const reset = useGame((s) => s.reset);

  // versus: side 0 = player（ふたりめ）, side 1 = pendingChallenger（ひとりめ）
  const winnerName = won ? player?.character.name : pending?.character.name;

  return (
    <div className="scene" style={{ justifyContent: 'center' }}>
      <h2 style={{ fontSize: '2rem', color: 'var(--crayon-red)' }}>
        {winnerName ? `${winnerName} の かち！🎉` : 'あいこ！'}
      </h2>
      <p style={{ color: 'var(--ink-soft)' }}>
        {pending?.character.name} vs {player?.character.name}
      </p>
      <button className="crayon-btn primary big" onClick={reset}>
        タイトルに もどる
      </button>
    </div>
  );
}
