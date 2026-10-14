import { useState } from 'react';
import { GameCard } from '../GameCard';
import { moveCard } from '../moveText';
import { getMove } from '../../engine/moves';
import { ALL_ILLUST as ILLUST } from './allIllust';

/** 開発用：?cardlab で 描きおろしカードを 大きく ならべて 見る（うごきつき）。 */
const COMPARE = ['c_tackle', 'f_spark', 'water_sig'];

/** SVG と 画像生成AI の 見くらべ（?cardlab&compare）。 */
function Compare({ size }: { size: number }) {
  return (
    <div style={{ display: 'grid', gap: '1.4rem' }}>
      {COMPARE.map((id) => (
        <div key={id} style={{ display: 'flex', gap: '1.4rem', justifyContent: 'center', alignItems: 'end' }}>
          <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
            <b>SVG（手描き）</b>
            <GameCard card={moveCard(getMove(id))} size={`${size}rem`} animated />
          </div>
          <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
            <b>画像生成AI</b>
            <GameCard card={moveCard(getMove(id))} size={`${size}rem`} artImage={`/ai-samples/${id}.jpg`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardLab() {
  const ids = Object.keys(ILLUST);
  const compare = window.location.search.includes('compare');
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
      {compare ? (
        <Compare size={size} />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.2rem', justifyContent: 'center' }}>
          {ids.map((id) => (
            <GameCard key={id} card={moveCard(getMove(id))} size={`${size}rem`} animated />
          ))}
        </div>
      )}
    </div>
  );
}
