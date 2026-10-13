import { useState } from 'react';
import { GameCard } from '../GameCard';
import { moveCard } from '../moveText';
import { getMove } from '../../engine/moves';
import { ILLUST } from './illust';

/** 開発用：?cardlab で 描きおろしカードを 大きく ならべて 見る（うごきつき）。 */
export function CardLab() {
  const ids = Object.keys(ILLUST);
  const [size, setSize] = useState(16);
  return (
    <div className="scene" style={{ justifyContent: 'flex-start', gap: '1rem', paddingTop: '1rem' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {[10, 16, 22].map((s) => (
          <button key={s} className="crayon-btn" style={{ background: s === size ? 'var(--crayon-yellow)' : undefined }} onClick={() => setSize(s)}>
            {s}rem
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.2rem', justifyContent: 'center' }}>
        {ids.map((id) => (
          <GameCard key={id} card={moveCard(getMove(id))} size={`${size}rem`} animated />
        ))}
      </div>
    </div>
  );
}
