import type { CSSProperties } from 'react';
import type { CardData } from './moveText';
import { CardArt } from './art/CardArt';
import { ArtBg, type BgKind } from './art/illust';
import { ALL_ILLUST as ILLUST } from './art/allIllust';
import { CardText } from './CardText';
import { ATTRIBUTE_META } from '../engine/attributes';

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
 * カードの表（Slay the Spire ふう：見る ところを へらす）。
 *  ① 名前（上の 帯。帯の 色＝レア度）
 *  ② いりょく（左上の まる。こうげきだけ）
 *  ③ 絵（わくの 形＝種類：こうげき＝下が とがる／ほじょ＝しかく／こせい＝まるい）
 *  ④ 説明（ひとこと。数字と キーワードだけ 色）
 * わくの 色＝属性（ふつうの こうげき＝赤、ほじょ＝緑）。
 */
export function GameCard({
  card,
  size,
  selected = false,
  animated = false,
  artImage,
  style,
}: {
  card: CardData;
  size: string;
  selected?: boolean;
  animated?: boolean;
  /** 絵を 画像で さしかえる（見くらべ用）。 */
  artImage?: string;
  style?: CSSProperties;
}) {
  const tier = tierOf(card);
  const pal = card.art.pal;
  const ill = card.move ? ILLUST[card.move.id] : undefined;
  const shape = card.kind === 'attack' ? 'atk' : card.kind === 'kosei' ? 'kosei' : 'sup';
  const nameSize = Math.min(1.3, 6.2 / (card.name.length * 1.05));
  const text = card.move?.desc ?? card.gist;
  const typeLabel = card.kind === 'kosei' ? 'こせい' : `${card.kind === 'attack' ? 'こうげき' : 'ほじょ'}${card.move?.attribute ? `・${ATTRIBUTE_META[card.move.attribute].jp}` : ''}`;
  return (
    <div
      className={`gc3 tier-${tier} shape-${shape}${card.power != null ? ' has-orb' : ''}${animated ? ' gcard-anim' : ''}${selected ? ' gcard-selected' : ''}`}
      style={
        {
          width: size,
          aspectRatio: '5 / 7',
          fontSize: `calc(${size} / 9)`,
          '--card-color': card.color,
          '--card-dark': pal.dark,
          '--card-light': pal.light,
          ...style,
        } as CSSProperties
      }
    >
      {/* ① 名前 */}
      <div className="gc3-banner">
        <span style={{ fontSize: `${nameSize}em` }}>{card.name}</span>
      </div>

      {/* ③ 絵（わくの 形で 種類） */}
      <div className="gc3-artframe">
        <div className="gc3-art">
          {artImage ? (
            <img src={artImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : ill ? (
            <svg viewBox="0 0 200 160" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ display: 'block' }}>
              <ArtBg kind={bgOf(card, tier)} pal={pal} />
              {ill(pal)}
            </svg>
          ) : (
            <div className="gc3-legacy">
              <CardArt art={card.art} />
            </div>
          )}
          {tier !== 'normal' && <div className="gc2-holo" />}
        </div>
      </div>

      {/* ② いりょく */}
      {card.power != null && <div className="gc3-orb">{card.power}</div>}

      <div className="gc3-type">{typeLabel}</div>

      {/* ④ 説明 */}
      <div className="gc3-text" style={{ fontSize: text.length > 30 ? '0.57em' : text.length > 18 ? '0.63em' : undefined }}>
        <span>
          <CardText text={text} />
        </span>
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
