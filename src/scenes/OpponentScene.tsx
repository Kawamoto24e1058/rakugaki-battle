import { useGame } from '../store/gameStore';
import { AttributeBadge } from '../components/bits';
import { CPU_BLURBS } from '../data/cpuRoster';

export function OpponentScene() {
  const roster = useGame((s) => s.cpuRoster);
  const chooseCpu = useGame((s) => s.chooseCpu);
  const player = useGame((s) => s.player);
  const runWins = useGame((s) => s.runWins);
  const savePlayerToZukan = useGame((s) => s.savePlayerToZukan);
  const reset = useGame((s) => s.reset);

  if (!player) return null;

  function finish() {
    savePlayerToZukan();
    reset();
  }

  return (
    <div className="scene">
      <h2 style={{ fontSize: '1.7rem' }}>だれと たたかう？</h2>
      <p style={{ color: 'var(--ink-soft)' }}>
        {player.character.name} ・ ここまで {runWins} しょう
      </p>

      <div style={{ display: 'grid', gap: '0.8rem', width: 'min(30rem, 94vw)' }}>
        {roster.map((cpu) => (
          <button
            key={cpu.id}
            className="crayon-btn"
            onClick={() => chooseCpu(cpu)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', textAlign: 'left', fontFamily: 'var(--font-body)' }}
          >
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', minWidth: '6rem' }}>{cpu.name}</span>
            <AttributeBadge attribute={cpu.attribute} size={0.85} />
            <span style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>{CPU_BLURBS[cpu.id]}</span>
          </button>
        ))}
      </div>

      <button className="crayon-btn" style={{ marginTop: '1rem' }} onClick={finish}>
        きょうは ここまで（ずかんに とうろく）
      </button>
    </div>
  );
}
