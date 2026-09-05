import { useGame } from '../store/gameStore';

export function TitleScene() {
  const startSolo = useGame((s) => s.startSolo);
  const startVersus = useGame((s) => s.startVersus);
  const openZukan = useGame((s) => s.openZukan);
  const zukanCount = useGame((s) => s.zukan.length);

  return (
    <div className="scene" style={{ justifyContent: 'center' }}>
      <h1 className="wiggle" style={{ fontSize: 'clamp(2.6rem, 9vw, 4.5rem)', color: 'var(--crayon-red)' }}>
        ラクガキ
        <br />
        バトル
      </h1>
      <p style={{ fontSize: '1.1rem', textAlign: 'center', maxWidth: '22rem' }}>
        かみに かいた えを カメラで とりこむと、
        <br />
        つよさが きまって バトルできる！
      </p>

      <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem', width: 'min(20rem, 90%)' }}>
        <button className="crayon-btn primary big" onClick={startSolo}>
          ひとりで あそぶ
        </button>
        <button className="crayon-btn big" onClick={startVersus}>
          ふたりで たいせん
        </button>
        <button className="crayon-btn" onClick={openZukan}>
          ずかんを みる（{zukanCount}）
        </button>
      </div>
    </div>
  );
}
