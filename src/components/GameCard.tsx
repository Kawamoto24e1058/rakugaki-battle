import type { CSSProperties } from 'react';
import type { CardData } from './moveText';
import { CardArt } from './art/CardArt';
import { SceneArt } from './art/SceneArt';
import { ArtBg, ILLUST, type BgKind } from './art/illust';

type Tier = 'normal' | 'rare' | 'special' | 'kosei';

function tierOf(card: CardData): Tier {
  if (card.kind === 'kosei') return 'kosei';
  if (card.special) return 'special';
  if (card.rare) return 'rare';
  return 'normal';
}

function bgOf(card: CardData, tier: Tier): BgKind {
  if (tier === 'kosei') return 'kosei';
  if (tier === 'special') return 'special';
  if (card.move?.attribute) return card.move.attribute;
  return card.kind === 'support' ? 'sup' : 'atk';
}

/**
 * カードの表。size は CSS の長さ（例 'min(29vw, 9.6rem)'）。文字サイズも size から決まる。
 *  ・わく：ふつう＝属性の色／大技＝金／とくしゅ＝にじいろ／こせい＝むらさき
 *  ・絵：描きおろし（ILLUST）があれば それを 大きく。なければ 前の絵。
 *  ・animated：大きく出たときだけ 絵が うごき、レアは ひかりが はしる。
 */
export function GameCard({
  card,
  size,
  selected = false,
  animated = false,
  style,
}: {
  card: CardData;
  size: string;
  selected?: boolean;
  animated?: boolean;
  style?: CSSProperties;
}) {
  const tier = tierOf(card);
  const pal = card.art.pal;
  const ill = card.move ? ILLUST[card.move.id] : undefined;
  // 名前の 文字数で 大きさを かえる（まるい フォントは 横に ひろいので 切れないように）
  const len = card.name.length;
  const nameSize = len <= 3 ? '1.3em' : len === 4 ? '1.14em' : len === 5 ? '0.96em' : len === 6 ? '0.82em' : len === 7 ? '0.72em' : '0.62em';
  return (
    <div
      className={`gcard2 tier-${tier}${animated ? ' gcard-anim' : ''}${selected ? ' gcard-selected' : ''}`}
      style={
        {
          width: size,
          aspectRatio: '5 / 7',
          fontSize: `calc(${size} / 9)`,
          '--card-color': card.color,
          '--card-dark': pal.dark,
          '--card-light': pal.light,
          '--band-ink': pal.bandInk ?? '#fff',
          ...style,
        } as CSSProperties
      }
    >
      <div className="gc2-inner">
        <div className="gc2-art">
          {ill ? (
            <svg viewBox="0 0 200 170" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ display: 'block' }}>
              <ArtBg kind={bgOf(card, tier)} pal={pal} />
              <g filter="url(#crayon)">{ill(pal)}</g>
            </svg>
          ) : (
            <div className="gc2-legacy">{card.move ? <SceneArt move={card.move} /> : <CardArt art={card.art} />}</div>
          )}
          {tier !== 'normal' && <div className="gc2-holo" />}
          {ill && card.power != null && (
            <div className="gc2-power">
              {card.power}
              {card.hits > 1 && <span className="gc2-hits">×{card.hits}</span>}
            </div>
          )}
          <div className="gc2-tag">{card.tag}</div>
        </div>
        <div className="gc2-name" style={{ fontSize: nameSize }}>
          {card.name}
        </div>
        <div className="gc2-body">
          {card.chips.length > 0 ? (
            <div className="gcard-chips">
              {card.chips.map((c, i) => (
                <div key={i} className={`gcard-fx gcard-fx-${c.tone}`}>
                  {c.text}
                </div>
              ))}
            </div>
          ) : (
            <div className="gcard-gist">{card.gist}</div>
          )}
        </div>
      </div>
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
