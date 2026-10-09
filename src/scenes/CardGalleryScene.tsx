import { useMemo, useState } from 'react';
import { useGame } from '../store/gameStore';
import { MOVES } from '../engine/moves';
import { GameCard } from '../components/GameCard';
import { moveCard } from '../components/moveText';

type Filter = 'all' | 'attack' | 'support' | 'charge' | 'cond' | 'hand' | 'fire' | 'water' | 'wood' | 'bolt' | 'dark';

const FILTERS: [Filter, string][] = [
  ['all', 'ぜんぶ'], ['attack', 'こうげき'], ['support', 'ほじょ'], ['charge', 'ため技'], ['cond', 'コンボ・じょうけん'], ['hand', '手札いじり'],
  ['fire', 'ほのお'], ['water', 'みず'], ['wood', 'き'], ['bolt', 'かみなり'], ['dark', 'やみ'],
];

/** カードずかん：ぜんぶのカードを見られる。 */
export function CardGalleryScene() {
  const reset = useGame((s) => s.reset);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(
    () =>
      Object.values(MOVES).filter((m) => {
        if (filter === 'all') return true;
        if (filter === 'attack' || filter === 'support') return m.category === filter;
        if (filter === 'charge') return !!m.charge;
        if (filter === 'cond') return !!m.when;
        if (filter === 'hand') return !!m.hand;
        return m.attribute === filter;
      }),
    [filter],
  );
  const sel = open ? MOVES[open] : null;

  return (
    <div className="scene" style={{ justifyContent: 'flex-start', gap: '0.8rem', paddingTop: '1rem' }}>
      <h2 style={{ fontSize: '1.6rem' }}>カードずかん（{Object.keys(MOVES).length}まい）</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', maxWidth: '46rem' }}>
        {FILTERS.map(([f, label]) => (
          <button
            key={f}
            className="crayon-btn"
            onClick={() => setFilter(f)}
            style={{ fontSize: '0.85rem', padding: '0.3em 0.9em', background: filter === f ? 'var(--crayon-yellow)' : undefined }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>{list.length}まい ・ カードを タップすると くわしく</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9rem', justifyContent: 'center', maxWidth: '64rem', padding: '0 0.5rem' }}>
        {list.map((m) => {
          const c = moveCard(m);
          return (
            <div key={m.id} onClick={() => setOpen(open === m.id ? null : m.id)} style={{ cursor: 'pointer' }}>
              <GameCard card={c} size="min(42vw, 9.4rem)" selected={open === m.id} />
            </div>
          );
        })}
      </div>
      {sel && (
        <div style={{ position: 'sticky', bottom: 8, background: '#fff', border: '3px solid var(--ink)', borderRadius: 12, padding: '0.6rem 1rem', maxWidth: '32rem', boxShadow: '4px 5px 0 rgba(0,0,0,.18)', zIndex: 10 }}>
          <strong style={{ fontFamily: 'var(--font-display)' }}>「{sel.name}」</strong>
          {moveCard(sel).lines.map((l, i) => (
            <div key={i} style={{ fontSize: '0.85rem' }}>・{l}</div>
          ))}
        </div>
      )}
      <button className="crayon-btn" onClick={reset} style={{ marginBottom: '1rem' }}>
        タイトルに もどる
      </button>
    </div>
  );
}
