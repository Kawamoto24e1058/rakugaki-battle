import { useMemo, useState } from 'react';
import { makeCpuRoster } from '../../data/cpuRoster';
import { PALETTES } from '../../components/art/palette';
import { EMPTY_TABLE } from '../../components/PlayArea';
import { HpBar, Stage } from './Stage';
import type { Beat, Chip, FxSpec } from './types';

/** 開発用：?fxdemo で、エフェクトを1つずつ確認できる画面。 */
export function FxDemo() {
  const roster = useMemo(() => makeCpuRoster(), []);
  const chars: [typeof roster[0], typeof roster[0]] = [roster[0], roster[3]];
  const [i, setI] = useState(0);
  const mk = (kind: FxSpec['kind'], pal: keyof typeof PALETTES, motifs: string[], size = 1.2, crit = false): FxSpec => ({ id: Math.random(), kind, target: 1, pal: PALETTES[pal], motifs, size, crit, release: false });
  const base = (o: Partial<Beat>): Beat => ({
    hp: [70, 40], chips: [[], []], banner: '', acting: null, hit: null, floats: [], fx: null, callout: null, order: null, first: null, table: EMPTY_TABLE, shake: 0, flash: null, impact: null, ms: 1000, ...o,
  });
  const chip = (kind: Chip['kind'], jp: string, good: boolean): Chip => ({ kind, jp, good });
  const scenes: [string, Beat][] = [
    ['ひっかき (ふつう)', base({ acting: 0, hit: 1, fx: mk('hit', 'atk', ['claw'], 1), floats: [{ id: 1, side: 1, text: '14', kind: 'dmg', big: false }], shake: 4, callout: { id: 1, side: 0, name: 'ひっかき', tag: 'こうげき', gist: 'ちいさな ダメージ', color: '#e8503a', dark: '#9c2a16', quick: false, rare: false, blocked: false } })],
    ['かえん (クリティカル)', base({ hit: 1, fx: mk('hit', 'fire', ['flame'], 1.5, true), floats: [{ id: 2, side: 1, text: '38', kind: 'dmg', big: true, tag: 'クリティカル' }], shake: 10, flash: '#ef5a2a' })],
    ['アクアカノン', base({ hit: 1, fx: mk('hit', 'water', ['wave'], 1.4), floats: [{ id: 3, side: 1, text: '30', kind: 'dmg', big: true }], shake: 8, flash: '#3b82f6' })],
    ['いなずま', base({ hit: 1, fx: mk('hit', 'bolt', ['bolt'], 1.3), floats: [{ id: 4, side: 1, text: '22', kind: 'dmg', big: false }], shake: 6, flash: '#f2b705' })],
    ['かいふく', base({ fx: { ...mk('heal', 'sup', ['cure']), target: 0 }, floats: [{ id: 5, side: 0, text: '+20', kind: 'heal', big: true }] })],
    ['きあいだめ (バフ)', base({ fx: { ...mk('buff', 'atk', ['up']), target: 0 }, chips: [[chip('atkUp', 'こうげき↑', true)], []] })],
    ['にらむ (デバフ)', base({ fx: mk('debuff', 'dark', ['down']), chips: [[], [chip('atkDown', 'こうげき↓', false)]] })],
    ['ガード', base({ fx: { ...mk('guard', 'water', ['shield']), target: 0 }, chips: [[chip('guard', 'ガード', true)], []] })],
    ['ため中', base({ fx: { ...mk('charge', 'kosei', ['chargeorb']), target: 0 }, chips: [[chip('charged', 'ためた！', true)], []] })],
    ['やけど・どく', base({ chips: [[chip('burn', 'やけど', false), chip('atkUp', 'こうげき↑', true)], [chip('poison', 'どく', false), chip('paralysis', 'まひ', false)]] })],
    ['こおり・ねむり', base({ chips: [[chip('freeze', 'こおり', false)], [chip('sleep', 'ねむり', false), chip('confuse', 'こんらん', false)]] })],
    ['すばやさくらべ', base({ order: { first: 0, reason: 'speed', spd: [42, 28] }, first: 0 })],
    ['せんせいわざ', base({ order: { first: 1, reason: 'priority', spd: [42, 28] }, first: 1 })],
    ['ためわざ はっしゃ', base({ acting: 0, impact: 'どかん！', callout: { id: 9, side: 0, name: 'メガトンパンチ', tag: 'ためた力を はなつ', gist: 'ためて つぎのターンに どかん！', color: '#e8503a', dark: '#9c2a16', quick: false, rare: true, blocked: false }, shake: 12 })],
    ['KO', base({ hp: [70, 0], hit: 1 })],
  ];
  const [, b] = scenes[i];
  return (
    <div className="scene" style={{ justifyContent: 'flex-start', gap: '0.6rem' }}>
      <div style={{ width: '100%', maxWidth: '52rem', display: 'grid', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <HpBar side={0} char={chars[0]} hp={b.hp[0]} maxHp={80} chips={b.chips[0]} hitNow={b.hit === 0} />
          <HpBar side={1} char={chars[1]} hp={b.hp[1]} maxHp={85} chips={b.chips[1]} hitNow={b.hit === 1} />
        </div>
        <Stage chars={chars} images={[null, null]} names={[chars[0].name, chars[1].name]} beat={b} beatKey={i * 1000 + Math.floor(Math.random() * 999)} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {scenes.map(([name], k) => (
          <button key={k} className="crayon-btn" style={{ fontSize: '0.8rem', padding: '0.3em 0.8em', background: k === i ? 'var(--crayon-yellow)' : undefined }} onClick={() => setI(k)}>
            {name}
          </button>
        ))}
        <button className="crayon-btn" onClick={() => setI((x) => x)}>もういちど</button>
      </div>
    </div>
  );
}
