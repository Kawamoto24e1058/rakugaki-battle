import { motion } from 'framer-motion';
import { useGame } from '../store/gameStore';
import { CharacterSprite } from '../components/bits';

export function ResultScene() {
  const mode = useGame((s) => s.mode);
  const won = useGame((s) => s.lastWon);
  const player = useGame((s) => s.player);
  const pending = useGame((s) => s.pendingChallenger);
  const runWins = useGame((s) => s.runWins);
  const runBattles = useGame((s) => s.runBattles);
  const nextRound = useGame((s) => s.nextRound);
  const savePlayerToZukan = useGame((s) => s.savePlayerToZukan);
  const reset = useGame((s) => s.reset);

  function endRun() {
    savePlayerToZukan();
    reset();
  }

  if (mode === 'versus') {
    // side 0 = player（ふたりめ）, side 1 = pendingChallenger（ひとりめ）
    const winnerName = won ? player?.character.name : pending?.character.name;
    return (
      <div className="scene" style={{ justifyContent: 'center' }}>
        <motion.h2
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{ fontSize: '2rem', color: 'var(--crayon-red)' }}
        >
          {winnerName ? `${winnerName} の かち！🎉` : 'あいこ！'}
        </motion.h2>
        <p style={{ color: 'var(--ink-soft)' }}>
          {pending?.character.name} vs {player?.character.name}
        </p>
        <button className="crayon-btn primary big" onClick={reset}>
          タイトルに もどる
        </button>
      </div>
    );
  }

  // ソロ：強化なし。勝敗のカウントだけ見せて、つぎの相手 or おわる。
  return (
    <div className="scene" style={{ justifyContent: 'center', gap: '1rem' }}>
      <motion.div
        initial={{ scale: 0.4, rotate: -8, opacity: 0 }}
        animate={{ scale: [0.4, 1.15, 1], rotate: [-8, 4, 0], opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12 }}
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: '2.4rem',
          color: won ? 'var(--crayon-green)' : 'var(--crayon-blue)',
        }}
      >
        {won ? 'かった！ 🎉' : 'まけちゃった…'}
      </motion.div>

      {player && (
        <div
          className="sketch-card"
          style={{ width: 'min(9rem, 34vw)', aspectRatio: '1', padding: 8, background: '#fff' }}
        >
          <CharacterSprite
            imageUrl={player.imageUrl}
            attribute={player.character.attribute}
            name={player.character.name}
          />
        </div>
      )}

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
