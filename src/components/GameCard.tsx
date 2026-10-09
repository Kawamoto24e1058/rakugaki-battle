import type { CSSProperties } from 'react';
import type { CardData } from './moveText';
import { CardArt } from './art/CardArt';

/** カードの表。size は CSS の長さ（例 'min(29vw, 9.6rem)'）。文字サイズも size から決まる。 */
export function GameCard({
  card,
  size,
  selected = false,
  style,
}: {
  card: CardData;
  size: string;
  selected?: boolean;
  style?: CSSProperties;
}) {
  const long = card.name.length > 6;
  return (
    <div
      className={`gcard${selected ? ' gcard-selected' : ''}`}
      style={
        {
          width: size,
          aspectRatio: '5 / 7',
          fontSize: `calc(${size} / 9)`,
          '--card-color': card.color,
          '--name-color': card.art.pal.dark,
          '--band-ink': card.art.pal.bandInk ?? '#fff',
          background: card.kind === 'kosei' ? '#f6f0ff' : undefined,
          ...style,
        } as CSSProperties
      }
    >
      {card.power != null && (
        <div className="gcard-power">
          {card.power}
          {card.hits > 1 && <span style={{ fontSize: '0.5em' }}>×{card.hits}</span>}
        </div>
      )}
      <div className="gcard-band" style={card.power == null ? { paddingLeft: '0.55em' } : undefined}>
        <span>{card.kind === 'kosei' ? '★ ' : card.kind === 'support' ? '✚ ' : '⚔ '}{card.tag}</span>
      </div>
      <div className="gcard-art">
        <CardArt art={card.art} />
        {card.rare && <div className="gcard-foil" />}
      </div>
      <div className="gcard-name" style={{ fontSize: long ? '1.02em' : '1.3em' }}>
        {card.name}
      </div>
      <div className="gcard-gist">{card.gist}</div>
      {card.quick && <div className="gcard-chip">⚡ 先に うごく</div>}
    </div>
  );
}

/** カードの裏。 */
export function CardBack({ size, style }: { size: string; style?: CSSProperties }) {
  return (
    <div
      className="gcard-back"
      style={{ width: size, aspectRatio: '5 / 7', fontSize: `calc(${size} / 9)`, ...style }}
    >
      ?
    </div>
  );
}
