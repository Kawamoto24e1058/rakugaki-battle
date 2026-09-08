import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../store/gameStore';
import { getMove, moveCategory, moveCost, autoLoadout, LOADOUT_BUDGET, type MoveDef } from '../engine/moves';
import { STATUS_META } from '../engine/status';
import type { Stats } from '../engine/types';
import { CharacterSprite } from '../components/bits';

const STAT_JP: Record<keyof Stats, string> = {
  hp: 'HP', atk: 'こうげき', def: 'ぼうぎょ', spd: 'すばやさ', luck: 'きゅうしょ', heart: 'こんじょう',
};
const CAT_JP = { power: '力', tech: '技', speed: '速さ' } as const;
const CAT_ICON = { power: '👊', tech: '✨', speed: '💨' } as const;
const CAT_COLOR = { power: '#e8503a', tech: '#1f9d63', speed: '#3b82f6' } as const;
type Cat = keyof typeof CAT_JP;

function gistOf(m: MoveDef): string {
  if (m.heal || m.cures) return 'かいふく';
  if (m.status && !m.status.toSelf) return `${STATUS_META[m.status.kind].jp}をねらう`;
  if (m.guardPct) return 'ダメージを へらす';
  if (m.buff) return `${STAT_JP[m.buff.stat]}アップ`;
  if (m.debuff) return `あいて ${STAT_JP[m.debuff.stat]}ダウン`;
  if (m.drain) return 'すいとり';
  if (m.first) return 'かならず せんせい';
  if (m.pierce) return 'ぼうぎょ むし';
  return m.category === 'attack' ? 'こうげき' : 'ほじょ';
}

export function LoadoutScene() {
  const player = useGame((s) => s.player);
  const confirmLoadout = useGame((s) => s.confirmLoadout);

  const pool = useMemo(() => {
    if (!player) return [] as MoveDef[];
    const seen = new Set<string>();
    const ids = [...player.character.movePool];
    for (const id of player.character.moveIds) if (!ids.includes(id)) ids.push(id);
    return ids
      .filter((id) => (seen.has(id) ? false : (seen.add(id), true)))
      .map((id) => {
        try {
          return getMove(id);
        } catch {
          return null;
        }
      })
      .filter((m): m is MoveDef => !!m)
      .sort((a, b) => {
        const ca = moveCategory(a), cb = moveCategory(b);
        const order: Cat[] = ['power', 'tech', 'speed'];
        if (ca !== cb) return order.indexOf(ca) - order.indexOf(cb);
        return moveCost(b) - moveCost(a);
      });
  }, [player]);

  const [sel, setSel] = useState<string[]>(() => player?.character.moveIds ?? []);

  if (!player) return null;

  const spent = sel.reduce((s, id) => {
    try {
      return s + moveCost(getMove(id));
    } catch {
      return s;
    }
  }, 0);
  const left = LOADOUT_BUDGET - spent;

  const catCount: Record<Cat, number> = { power: 0, tech: 0, speed: 0 };
  for (const id of sel) {
    try {
      catCount[moveCategory(getMove(id))] += 1;
    } catch {
      /* ignore */
    }
  }
  const emptyCats = (['power', 'tech', 'speed'] as Cat[]).filter((c) => catCount[c] === 0);

  const toggle = (m: MoveDef) => {
    const on = sel.includes(m.id);
    if (on) setSel(sel.filter((x) => x !== m.id));
    else if (moveCost(m) <= left) setSel([...sel, m.id]);
  };

  return (
    <div className="scene" style={{ justifyContent: 'flex-start', paddingTop: 'clamp(.8rem,3vh,1.6rem)', gap: '0.6rem' }}>
      <h2 style={{ fontSize: '1.6rem', color: 'var(--crayon-blue)', margin: 0 }}>
        {player.character.name} の わざを えらぼう
      </h2>
      <div style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', textAlign: 'center' }}>
        ★を {LOADOUT_BUDGET}こ ぶんまで。すきな だけ・すきな カテゴリだけ でも OK。
      </div>

      {/* 予算メーター */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ fontSize: '1.5rem', letterSpacing: 2 }}>
          {'★'.repeat(Math.max(0, spent))}
          <span style={{ opacity: 0.25 }}>{'★'.repeat(Math.max(0, left))}</span>
        </div>
        <span style={{ fontWeight: 700 }}>のこり ★{Math.max(0, left)}</span>
        <span style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
          {(['power', 'tech', 'speed'] as Cat[]).map((c) => (
            <span key={c} style={{ color: CAT_COLOR[c], marginLeft: 8 }}>
              {CAT_ICON[c]}
              {catCount[c]}
            </span>
          ))}
        </span>
      </div>

      {emptyCats.length > 0 && sel.length > 0 && (
        <div style={{ fontSize: '0.76rem', color: 'var(--crayon-red)' }}>
          {emptyCats.map((c) => `${CAT_JP[c]}`).join('・')} の わざが ないよ（その かまえは よわい こうげきに なる）
        </div>
      )}

      {/* 候補グリッド */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(9.5rem, 1fr))',
          gap: '0.55rem',
          width: '100%',
          maxWidth: '44rem',
          overflowY: 'auto',
          padding: '0.2rem',
        }}
      >
        {pool.map((m) => {
          const cat = moveCategory(m);
          const on = sel.includes(m.id);
          const cost = moveCost(m);
          const affordable = on || cost <= left;
          return (
            <motion.button
              key={m.id}
              whileTap={{ scale: 0.96 }}
              onClick={() => toggle(m)}
              disabled={!affordable}
              style={{
                textAlign: 'left',
                borderRadius: 12,
                border: `2.5px solid ${CAT_COLOR[cat]}`,
                background: on ? CAT_COLOR[cat] : '#fff',
                color: on ? '#fff' : 'var(--ink)',
                opacity: affordable ? 1 : 0.4,
                padding: '0.5rem 0.6rem',
                display: 'grid',
                gap: 2,
                cursor: affordable ? 'pointer' : 'default',
                font: 'inherit',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>{m.name}</span>
                <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{'★'.repeat(cost)}</span>
              </div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                {CAT_ICON[cat]} {CAT_JP[cat]}
                {m.category === 'attack' ? ` ・ いりょく${m.power}` : ''}
              </div>
              <div style={{ fontSize: '0.7rem', opacity: on ? 0.95 : 0.7 }}>{gistOf(m)}</div>
              {on && <div style={{ fontSize: '0.72rem', fontWeight: 700 }}>✓ えらんだ</div>}
            </motion.button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.3rem' }}>
        <button
          className="crayon-btn"
          onClick={() => setSel(autoLoadout(pool.map((m) => m.id), player.character.seed))}
        >
          おまかせ
        </button>
        <button
          className="crayon-btn primary big"
          disabled={sel.length === 0}
          onClick={() => confirmLoadout(sel)}
        >
          これで けってい！（★{spent}）
        </button>
      </div>

      <div style={{ width: 'min(7rem, 26vw)', aspectRatio: '1', opacity: 0.9 }}>
        <CharacterSprite imageUrl={player.imageUrl} attribute={player.character.attribute} name={player.character.name} />
      </div>
    </div>
  );
}
