import { useGame } from '../store/gameStore';

export function RewardScene() {
  const won = useGame((s) => s.lastWon);
  const choices = useGame((s) => s.rewardChoices);
  const chooseReward = useGame((s) => s.chooseReward);

  return (
    <div className="scene" style={{ justifyContent: 'center' }}>
      <h2 style={{ fontSize: '1.8rem', color: won ? 'var(--good)' : 'var(--crayon-blue)' }}>
        {won ? 'かった！ ごほうびを えらぼう' : 'つぎは かてるように… ごほうび！'}
      </h2>
      <p style={{ color: 'var(--ink-soft)' }}>1つ えらんでね</p>

      <div style={{ display: 'grid', gap: '0.8rem', width: 'min(30rem, 94vw)' }}>
        {choices.map((c, i) => (
          <button
            key={i}
            className="crayon-btn"
            onClick={() => chooseReward(c)}
            style={{ textAlign: 'left', fontFamily: 'var(--font-body)' }}
          >
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem' }}>{c.label}</strong>
            <div style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>{c.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
