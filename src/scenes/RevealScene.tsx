import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../store/gameStore';
import { AttributeBadge, AnimatedStatBar, STAT_MAX, STAT_LABEL_JP as STAT_JP, CharacterSprite } from '../components/bits';
import { MOVES, moveStars, archetypeLabel, getKosei, limitJp } from '../engine';
import type { Stats } from '../engine/types';

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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!player) return null;
  const { character, imageUrl, analyzedBy } = player;
  const reasons = character.analysis;
  const reasonOf = (key: string) => reasons.find((r) => r.key === key);
  const kosei = getKosei(character.koseiId);
  const attrReason = reasonOf('color');

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
              ✏️ なまえをかえる
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
        {analyzedBy === 'ai' ? '🤖 AI が解析' : '✏️ かんたん解析（AIオフ / キー確認）'}
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
              <span
                style={{
                  fontFamily: 'var(--font-display)', fontSize: '0.85rem',
                  border: '2px solid var(--border)', borderRadius: 999, padding: '0.05rem 0.6rem',
                  background: 'var(--crayon-yellow)',
                }}
              >
                {archetypeLabel(character.baseStats)}
              </span>
            </div>
            {attrReason && (
              <div style={{ fontSize: '0.76rem', color: 'var(--ink-soft)' }}>
                {attrReason.detected} → {attrReason.effect}
              </div>
            )}
            <div style={{ fontSize: '0.78rem' }}>
              {WEAPON_JP[character.weapon]} ・ {character.personality === 'aggressive' ? '好戦的' : '穏やか'}
            </div>
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
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>こせい：{kosei.name}</div>
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
          style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'center' }}
        >
          <span style={{ width: '100%', textAlign: 'center', fontSize: '0.74rem', color: 'var(--ink-soft)' }}>
            わざの こうほ（つぎの がめんで えらぶ）
          </span>
          {character.movePool.map((m) => {
            const mv = MOVES[m];
            const stars = mv ? moveStars(mv) : 1;
            return (
              <span
                key={m}
                style={{
                  fontSize: '0.75rem', border: '2px solid var(--border)', borderRadius: 8,
                  padding: '0.1rem 0.5rem', background: '#fff', fontFamily: 'var(--font-display)',
                  display: 'inline-flex', gap: '0.3rem', alignItems: 'center',
                }}
              >
                {mv?.name ?? m}
                <span style={{ color: '#b8860b', letterSpacing: '-1px' }}>{'★'.repeat(stars)}</span>
              </span>
            );
          })}
        </motion.div>
      </motion.div>

      <motion.button
        className="crayon-btn primary big"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 + STAT_ORDER.length * 0.16 + 0.5 }}
        style={{ marginTop: '0.8rem' }}
        onClick={confirmReveal}
      >
        わざを えらぶ →
      </motion.button>
    </div>
  );
}
