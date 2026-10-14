import type { CSSProperties } from 'react';
import type { CardData } from './moveText';
import { CardArt } from './art/CardArt';
import { SceneArt } from './art/SceneArt';
import { ArtBg, ILLUST, type BgKind } from './art/illust';
import { Emblem } from './art/emblem';
import { MOVES } from '../engine/moves';

type Tier = 'normal' | 'rare' | 'special' | 'kosei';

function tierOf(card: CardData): Tier {
  if (card.kind === 'kosei') return 'kosei';
  if (card.special) return 'special';
  if (card.rare) return 'rare';
  return 'normal';
}

function kindOf(card: CardData, tier: Tier): BgKind {
  if (tier === 'kosei') return 'kosei';
  if (tier === 'special') return 'special';
  if (card.move?.attribute) return card.move.attribute;
  return card.kind === 'support' ? 'sup' : 'atk';
}

const STARS: Record<Tier, number> = { normal: 1, rare: 2, special: 3, kosei: 3 };
const MOVE_NO: Record<string, number> = Object.fromEntries(Object.keys(MOVES).map((id, i) => [id, i + 1]));
const TOTAL = Object.keys(MOVES).length;

/**
 * カードの表（トレカふう）。size は CSS の長さ（例 'min(29vw, 9.6rem)'）。文字サイズも size から決まる。
 *  ・上：属性メダル＋名前 ／ 中：絵（右上に いりょくバッジ）／ 種類の帯 ／ 下：効果・カード番号・レア度の★
 *  ・わく：ふつう＝属性の色／大技＝金／とくしゅ＝にじいろ／こせい＝むらさき（金属の つや）
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
  const kind = kindOf(card, tier);
  const pal = card.art.pal;
  const ill = card.move ? ILLUST[card.move.id] : undefined;
  // 名前は 上の帯に おさまる 大きさに（まるい フォントは 1字 ≒ 1.05em）
  const nameSize = Math.min(1.25, 5.7 / (card.name.length * 1.05));
  const no = card.move ? MOVE_NO[card.move.id] : null;
  const [kindLabel, attrLabel] = card.tag.split('・');
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
          '--card-bg': pal.bg1,
          ...style,
        } as CSSProperties
      }
    >
      <div className="gc2-inner">
        {/* 上：メダル＋名前 */}
        <div className="gc2-head">
          <div className="gc2-medal">
            <Emblem kind={kind} />
          </div>
          <div className="gc2-name" style={{ fontSize: `${nameSize}em` }}>
            {card.name}
          </div>
        </div>

        {/* 絵 */}
        <div className="gc2-art">
          {ill ? (
            <svg viewBox="0 0 200 160" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ display: 'block' }}>
              <ArtBg kind={kind} pal={pal} />
              {ill(pal)}
            </svg>
          ) : (
            <div className="gc2-legacy">{card.move ? <SceneArt move={card.move} /> : <CardArt art={card.art} />}</div>
          )}
          {tier !== 'normal' && <div className="gc2-holo" />}
          {ill && card.power != null && (
            <div className="gc2-power">
              <svg viewBox="-20 -20 40 40" className="gc2-power-bg">
                <polygon
                  points={Array.from({ length: 24 }, (_, i) => {
                    const r = i % 2 === 0 ? 19 : 15;
                    const a = (Math.PI * i) / 12;
                    return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
                  }).join(' ')}
                />
              </svg>
              <span>{card.power}</span>
              {card.hits > 1 && <span className="gc2-hits">×{card.hits}</span>}
            </div>
          )}
        </div>

        {/* 種類の帯 */}
        <div className="gc2-type">
          <span>{kindLabel}</span>
          {attrLabel && <span className="gc2-attr">{attrLabel}</span>}
          {card.quick && <span className="gc2-quick">先</span>}
        </div>

        {/* 効果 */}
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

        {/* 番号と レア度 */}
        <div className="gc2-foot">
          <span>{no ? `No.${String(no).padStart(3, '0')}/${TOTAL}` : 'こせい'}</span>
          <span className="gc2-stars">{'★'.repeat(STARS[tier])}</span>
        </div>
      </div>
    </div>
  );
}

/** カードの裏。 */
export function CardBack({ size, style }: { size: string; style?: CSSProperties }) {
  return (
    <div className="gcard-back" style={{ width: size, aspectRatio: '5 / 7', fontSize: `calc(${size} / 9)`, ...style }}>
      ?
    </div>
  );
}
