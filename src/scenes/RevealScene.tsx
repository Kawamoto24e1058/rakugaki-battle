import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../store/gameStore';
import { AttributeBadge, StatBars, AnimatedStatBar, STAT_MAX, STAT_LABEL_JP as STAT_JP, CharacterSprite } from '../components/bits';
import { MOVES, moveStars, archetypeLabel, getKosei, limitJp } from '../engine';
import type { Stats } from '../engine/types';

const WEAPON_JP: Record<string, string> = { sword: 'ツメ・剣', wand: '杖', shield: '盾', wing: '翼' };

/** リビールの理由キー → 一緒に見せるステータスゲージ。 */
const REASON_STAT: Record<string, keyof Stats> = {
  edge: 'atk',
  sym: 'def',
  slim: 'spd',
  eyes: 'heart',
  colors: 'luck',
};

export function RevealScene() {
  const player = useGame((s) => s.player);
  const confirmReveal = useGame((s) => s.confirmReveal);
  const [step, setStep] = useState(0);

  if (!player) return null;
  const { character, imageUrl, analyzedBy } = player;
  const reasons = character.analysis;
  const done = step >= reasons.length;

  return (
    <div className="scene">
      <h2 style={{ fontSize: '1.8rem', color: 'var(--crayon-blue)' }}>
        {done ? `「${character.name}」の たんじょう！` : 'えを しらべているよ…'}
      </h2>
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

      <div
        className="sketch-card"
        style={{ width: 'min(16rem, 60vw)', aspectRatio: '1', padding: 10, background: '#fff' }}
      >
        <CharacterSprite imageUrl={imageUrl} attribute={character.attribute} name={character.name} />
      </div>

      {!done && (
        <>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {reasons.map((r, i) => (
              <span
                key={r.key}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  border: '2px solid var(--border)',
                  background: i <= step ? 'var(--crayon-red)' : '#fff',
                }}
              />
            ))}
          </div>
          <div style={{ minHeight: '9rem', width: 'min(30rem, 92vw)', display: 'grid', placeItems: 'center' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={reasons[step].key}
                className="sketch-card"
                initial={{ opacity: 0, y: 20, rotate: -2 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                exit={{ opacity: 0, y: -20 }}
                style={{ padding: '1.1rem 1.3rem', textAlign: 'center', display: 'grid', gap: '0.4rem', width: '100%' }}
              >
                <span style={{ fontSize: '0.95rem', color: 'var(--ink-soft)' }}>{reasons[step].label}</span>
                <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>
                  {reasons[step].detected}
                </strong>
                <span style={{ fontFamily: 'var(--font-display)', color: 'var(--crayon-red)', fontSize: '1.1rem' }}>
                  → {reasons[step].effect}
                </span>

                {/* ステータス系の理由なら、そのゲージも一緒に「ギュン」と伸ばす */}
                {REASON_STAT[reasons[step].key] && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <AnimatedStatBar
                      big
                      label={STAT_JP[REASON_STAT[reasons[step].key]]}
                      value={character.baseStats[REASON_STAT[reasons[step].key]]}
                      max={STAT_MAX[REASON_STAT[reasons[step].key]]}
                      color="var(--crayon-red)"
                    />
                  </div>
                )}
                {reasons[step].key === 'arche' && (
                  <div style={{ display: 'grid', gap: '0.3rem', marginTop: '0.5rem' }}>
                    {(['atk', 'def', 'spd'] as (keyof Stats)[]).map((k) => (
                      <AnimatedStatBar
                        key={k}
                        big
                        label={STAT_JP[k]}
                        value={character.baseStats[k]}
                        max={STAT_MAX[k]}
                        color="var(--crayon-red)"
                      />
                    ))}
                  </div>
                )}
                {reasons[step].key === 'power' && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <AnimatedStatBar
                      big
                      label="ぜんたい"
                      value={character.baseStats.atk + character.baseStats.def + character.baseStats.spd}
                      max={110}
                      color="var(--crayon-purple)"
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <button className="crayon-btn primary big" onClick={() => setStep((n) => n + 1)}>
            {step + 1 >= reasons.length ? 'できあがり！' : 'つぎへ'}
          </button>
        </>
      )}

      {done && (
        <>
          <motion.div
            className="sketch-card"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ width: 'min(30rem, 92vw)', padding: '1rem 1.2rem', display: 'grid', gap: '0.7rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem' }}>{character.name}</strong>
              <AttributeBadge attribute={character.attribute} />
              <span
                style={{
                  fontFamily: 'var(--font-display)', fontSize: '0.9rem',
                  border: '2px solid var(--border)', borderRadius: 999, padding: '0.05rem 0.6rem',
                  background: 'var(--crayon-yellow)',
                }}
              >
                {archetypeLabel(character.baseStats)}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
                {WEAPON_JP[character.weapon]} ・ {character.personality === 'aggressive' ? '好戦的' : '穏やか'}
              </span>
            </div>
            <StatBars stats={character.baseStats} animate />
            {(() => {
              const k = getKosei(character.koseiId);
              return (
                <div
                  style={{
                    border: '2px solid var(--border)',
                    borderRadius: 10,
                    background: 'rgba(123,92,240,0.1)',
                    padding: '0.5rem 0.7rem',
                    display: 'grid',
                    gap: '0.15rem',
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem' }}>
                    こせい：{k.name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>{k.tagline}</div>
                  <div style={{ fontSize: '0.8rem' }}>
                    パッシブ：{k.passiveJp}
                  </div>
                  <div style={{ fontSize: '0.8rem' }}>
                    こせい技：<strong style={{ fontFamily: 'var(--font-display)' }}>{k.activeName}</strong>（{k.activeJp}／{limitJp(k.limit)}）
                  </div>
                </div>
              );
            })()}
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {character.moveIds.map((m) => {
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
            </div>
          </motion.div>
          <button className="crayon-btn primary big" onClick={confirmReveal}>
            けってい！
          </button>
        </>
      )}
    </div>
  );
}
