import { useGame } from '../store/gameStore';
import { AttributeBadge } from '../components/bits';

export function ZukanScene() {
  const zukan = useGame((s) => s.zukan);
  const reset = useGame((s) => s.reset);

  return (
    <div className="scene">
      <h2 style={{ fontSize: '1.8rem' }}>ずかん（{zukan.length}）</h2>

      {zukan.length === 0 && <p style={{ color: 'var(--ink-soft)' }}>まだ だれも いないよ。えを かいて とうろくしよう！</p>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))',
          gap: '0.8rem',
          width: '100%',
        }}
      >
        {zukan.map((c) => (
          <div key={c.id} className="sketch-card" style={{ padding: '0.7rem', display: 'grid', gap: '0.3rem', textAlign: 'center' }}>
            <strong style={{ fontFamily: 'var(--font-display)' }}>{c.name}</strong>
            <div style={{ justifySelf: 'center' }}>
              <AttributeBadge attribute={c.attribute} size={0.8} />
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--ink-soft)' }}>
              HP{c.baseStats.hp} こうげき{c.baseStats.atk} ぼうぎょ{c.baseStats.def}
              <br />すばやさ{c.baseStats.spd} きゅうしょ{c.baseStats.luck} こんじょう{c.baseStats.heart}
            </span>
          </div>
        ))}
      </div>

      <button className="crayon-btn" style={{ marginTop: 'auto' }} onClick={reset}>
        タイトルに もどる
      </button>
    </div>
  );
}
