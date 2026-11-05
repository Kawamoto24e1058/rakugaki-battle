import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../store/gameStore';
import { AttributeBadge, AnimatedStatBar, STAT_MAX, STAT_LABEL_JP as STAT_JP, CharacterSprite } from '../components/bits';
import { archetypeLabel, focusMult, getKosei, limitJp } from '../engine';
import type { Stats } from '../engine/types';
import { getMove } from '../engine/moves';
import { GameCard } from '../components/GameCard';
import { moveCard } from '../components/moveText';
import { STYLE_META } from '../engine/analyze/style';
import { moveRole } from '../engine/moves/assign';

const WEAPON_JP: Record<string, string> = { sword: 'ツメ・剣', wand: '杖', shield: '盾', wing: '翼' };

/** ステータス → その理由カードのキー。 */
const STAT_REASON: Record<keyof Stats, string> = {
  hp: 'hpwhy',
  atk: 'edge',
  def: 'sym',
  spd: 'slim',
  luck: 'colors',
  heart: 'eyes',
};
const STAT_COLOR: Record<keyof Stats, string> = {
  hp: 'var(--crayon-green)',
  atk: 'var(--crayon-red)',
  def: 'var(--crayon-blue)',
  spd: '#3b82f6',
  luck: 'var(--crayon-yellow)',
  heart: 'var(--crayon-pink)',
};
const STAT_ORDER: (keyof Stats)[] = ['hp', 'atk', 'def', 'spd', 'luck', 'heart'];

export function RevealScene() {
  const player = useGame((s) => s.player);
  const confirmReveal = useGame((s) => s.confirmReveal);
  const renamePlayer = useGame((s) => s.renamePlayer);
  const chooseMove = useGame((s) => s.chooseMove);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!player) return null;
  const { character, imageUrl, analyzedBy } = player;
  const reasons = character.analysis;
  const reasonOf = (key: string) => reasons.find((r) => r.key === key);
  const kosei = getKosei(character.koseiId);
  const attrReason = reasonOf('color');
  const choices = character.moveChoices ?? [];
  const picked = !!player.movePicked;
  const needPick = choices.length > 0 && !picked;

  return (
    <div className="scene" style={{ justifyContent: 'flex-start', paddingTop: 'clamp(1rem,4vh,2rem)' }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}
      >
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              renamePlayer(draft);
              setEditing(false);
            }}
            style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}
          >
            <input
              autoFocus
              value={draft}
              maxLength={12}
              onChange={(e) => setDraft(e.target.value)}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.4rem',
                width: 'min(11rem, 60vw)',
                textAlign: 'center',
                border: '2.5px solid var(--ink)',
                borderRadius: 10,
                padding: '0.1rem 0.5rem',
              }}
            />
            <button type="submit" className="crayon-btn" style={{ fontSize: '0.9rem' }}>
              けってい
            </button>
          </form>
        ) : (
          <>
            <h2 style={{ fontSize: '1.7rem', color: 'var(--crayon-blue)', textAlign: 'center', margin: 0 }}>
              「{character.name}」の たんじょう！
            </h2>
            <button
              className="crayon-btn"
              onClick={() => {
                setDraft(character.name);
                setEditing(true);
              }}
              style={{ fontSize: '0.8rem', padding: '0.15rem 0.6rem' }}
            >
              なまえをかえる
            </button>
          </>
        )}
      </motion.div>
      <div
        style={{
          fontSize: '0.72rem',
          padding: '0.1rem 0.6rem',
          borderRadius: 999,
          border: '2px solid var(--border)',
          background: analyzedBy === 'ai' ? 'rgba(58,166,97,.18)' : 'rgba(0,0,0,.06)',
        }}
      >
        {analyzedBy === 'ai' ? 'AI が解析' : 'かんたん解析（AIオフ / キー確認）'}
      </div>

      <motion.div
        className="sketch-card"
        initial={{ scale: 0.85, rotate: -3, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 14 }}
        style={{ width: 'min(30rem, 94vw)', padding: '1rem 1.1rem', display: 'grid', gap: '0.7rem', marginTop: '0.4rem' }}
      >
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div
            className="sketch-card"
            style={{ width: 'min(9rem, 34vw)', aspectRatio: '1', padding: 6, background: '#fff', flexShrink: 0 }}
          >
            <CharacterSprite imageUrl={imageUrl} attribute={character.attribute} name={character.name} />
          </div>
          <div style={{ display: 'grid', gap: '0.35rem', minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <AttributeBadge attribute={character.attribute} />
              {character.style ? (
                <motion.span
                  initial={{ scale: 0, rotate: -12 }}
                  animate={{ scale: [0, 1.25, 1], rotate: [-12, 4, 0] }}
                  transition={{ delay: 0.15, duration: 0.5 }}
                  style={{
                    fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: '#fff',
                    border: '3px solid var(--ink)', borderRadius: 999, padding: '0.05rem 0.8rem',
                    background: STYLE_META[character.style].color, boxShadow: '2px 3px 0 rgba(0,0,0,.2)',
                  }}
                >
                  {STYLE_META[character.style].jp}
                </motion.span>
              ) : (
                <span
                  style={{
                    fontFamily: 'var(--font-display)', fontSize: '0.85rem',
                    border: '2px solid var(--border)', borderRadius: 999, padding: '0.05rem 0.6rem',
                    background: 'var(--crayon-yellow)',
                  }}
                >
                  {archetypeLabel(character.baseStats)}
                </span>
              )}
            </div>
            {character.style && (
              <div style={{ fontSize: '0.82rem', fontWeight: 800 }}>
                {STYLE_META[character.style].desc}
                {reasonOf('style')?.detected && <span style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>（{reasonOf('style')!.detected}）</span>}
              </div>
            )}
            {attrReason && (
              <div style={{ fontSize: '0.76rem', color: 'var(--ink-soft)' }}>
                {attrReason.detected} → {attrReason.effect}
              </div>
            )}
            {character.motif && (
              <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>
                この え は：<span style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem' }}>{character.motif}</span>
              </div>
            )}
            <div style={{ fontSize: '0.78rem' }}>
              {WEAPON_JP[character.weapon]} ・ {character.personality === 'aggressive' ? '好戦的' : '穏やか'}
            </div>
            {character.quirk && (
              <div
                style={{
                  marginTop: 4,
                  display: 'inline-grid',
                  gap: 2,
                  padding: '0.3em 0.7em',
                  border: '2.5px solid var(--ink)',
                  borderRadius: 10,
                  background: '#fff4c9',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                }}
              >
                <span>
                  とくせい：<span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>{character.quirk.name}</span>
                </span>
                <span>
                  <span style={{ color: '#1b7a47' }}>{character.quirk.plus}</span>／<span style={{ color: '#c2361c' }}>{character.quirk.minus}</span>
                  <span style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>（{character.quirk.why}）</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ステータス：最初から全部見えていて、順ぐりにギュンと伸びる */}
        <div style={{ display: 'grid', gap: '0.55rem' }}>
          {STAT_ORDER.map((k, i) => (
            <AnimatedStatBar
              key={k}
              big
              label={STAT_JP[k]}
              value={character.baseStats[k]}
              max={STAT_MAX[k]}
              color={STAT_COLOR[k]}
              delay={0.25 + i * 0.16}
              note={reasonOf(STAT_REASON[k])?.detected}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 + STAT_ORDER.length * 0.16 + 0.2 }}
          style={{
            border: '2px solid var(--border)',
            borderRadius: 10,
            background: 'rgba(123,92,240,0.1)',
            padding: '0.5rem 0.7rem',
            display: 'grid',
            gap: '0.12rem',
          }}
        >
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>
            こせい：{character.koseiTitle ?? ''}{kosei.name}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--ink-soft)' }}>{kosei.tagline}</div>
          <div style={{ fontSize: '0.78rem' }}>パッシブ：{kosei.passiveJp}</div>
          <div style={{ fontSize: '0.78rem' }}>
            こせい技：<strong style={{ fontFamily: 'var(--font-display)' }}>{kosei.activeName}</strong>
            （{kosei.activeJp}／{limitJp(kosei.limit)}）
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 + STAT_ORDER.length * 0.16 + 0.35 }}
          style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', textAlign: 'center', width: '100%' }}
        >
          <div style={{ fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>この子の わざ（まいターン この中から 1つが でるよ）</div>
          {/* きまった わざ（えらぶ ときは 3まい、えらばない キャラは 4まい） */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${choices.length > 0 ? 4 : character.moveIds.length}, minmax(0, 1fr))`, gap: '0.4rem', width: '100%', maxWidth: '32rem', margin: '0 auto' }}>
            {(choices.length > 0 ? character.moveIds.slice(0, 3) : character.moveIds).map((id, i) => (
              <MoveTile key={id} id={id} why={character.moveReasons?.[i]} delay={0.25 + STAT_ORDER.length * 0.16 + 0.45 + i * 0.22} />
            ))}
            {choices.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 + STAT_ORDER.length * 0.16 + 0.45 + 3 * 0.22 }}
                style={{ display: 'grid', placeItems: 'center', aspectRatio: '5 / 7', border: '3px dashed var(--ink)', borderRadius: 10, background: picked ? 'transparent' : '#fff8d6', containerType: 'inline-size' }}
              >
                {picked ? (
                  <GameCard card={moveCard(getMove(character.moveIds[3]))} size="100cqw" />
                ) : (
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', color: 'var(--ink-soft)' }}>？</span>
                )}
              </motion.div>
            )}
          </div>

          {/* 4つめは 子どもが えらぶ（おなじ 強さで 役わりが ちがう 3まい） */}
          {choices.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + STAT_ORDER.length * 0.16 + 1.3 }}
              style={{ marginTop: '0.8rem', border: '3px solid var(--ink)', borderRadius: 14, background: picked ? '#f3f8ef' : '#fff1ec', padding: '0.6rem', display: 'grid', gap: '0.4rem' }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--ink)' }}>4つめの わざを えらぼう！</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800 }}>どれも おなじ つよさ。すきな たたかいかたを えらんでね</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.5rem', width: '100%', maxWidth: '26rem', margin: '0 auto' }}>
                {choices.map((c) => {
                  const on = picked && character.moveIds[3] === c.id;
                  let role = '';
                  try {
                    role = moveRole(getMove(c.id));
                  } catch {
                    role = '';
                  }
                  return (
                    <motion.button
                      key={c.id}
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => chooseMove(c.id)}
                      style={{ all: 'unset', cursor: 'pointer', display: 'grid', justifyItems: 'center', gap: 4, minWidth: 0, containerType: 'inline-size', opacity: picked && !on ? 0.55 : 1 }}
                    >
                      <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#fff', background: on ? 'var(--crayon-red)' : 'var(--ink)', borderRadius: 99, padding: '1px 8px' }}>{role}</span>
                      <GameCard card={moveCard(getMove(c.id))} size="100cqw" selected={on} />
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, lineHeight: 1.3 }}>{c.reason}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
          {focusMult(character.moveIds) > 1 && (
            <div style={{ marginTop: 6, fontWeight: 800, color: 'var(--crayon-red)' }}>
              こうげき技が すくない ぶん、こうげきの いりょく ×{focusMult(character.moveIds)}
            </div>
          )}
        </motion.div>
      </motion.div>

      <motion.button
        className="crayon-btn primary big"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 + STAT_ORDER.length * 0.16 + 0.5 }}
        style={{ marginTop: '0.8rem', opacity: needPick ? 0.45 : 1 }}
        disabled={needPick}
        onClick={confirmReveal}
      >
        {needPick ? '4つめの わざを えらんでね' : 'たたかいへ →'}
      </motion.button>
    </div>
  );
}

/** きまった わざ 1まい（カード＋なぜ この わざ なのか）。 */
function MoveTile({ id, why, delay }: { id: string; why?: string; delay: number }) {
  let card;
  try {
    card = moveCard(getMove(id));
  } catch {
    return null;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, rotate: -4 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 18 }}
      style={{ display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 4, minWidth: 0, containerType: 'inline-size' }}
    >
      <GameCard card={card} size="100cqw" />
      {why && (
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            color: 'var(--ink)',
            background: '#fff8d6',
            border: '2px solid var(--ink)',
            borderRadius: 8,
            padding: '2px 5px',
            lineHeight: 1.3,
            width: '100%',
          }}
        >
          {why}
        </div>
      )}
    </motion.div>
  );
}
