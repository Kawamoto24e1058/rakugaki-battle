import { STATUS_META } from '../engine/status';
import { ATTRIBUTE_META } from '../engine/attributes';
import { hasPriority, isRareMove, type MoveDef } from '../engine/moves';
import type { Kosei } from '../engine/personalities';
import type { Stats } from '../engine/types';

const STAT_JP: Record<keyof Stats, string> = {
  hp: 'HP', atk: 'こうげき', def: 'ぼうぎょ', spd: 'すばやさ', luck: 'きゅうしょ', heart: 'こんじょう',
};

/** タップ・長押しで見せる、技の詳しい説明（1行ずつ）。 */
export function moveDetailLines(m: MoveDef): string[] {
  const out: string[] = [];
  if (m.category === 'attack') {
    const per = m.hits && m.hits > 1 ? `（${m.hits}かい）` : '';
    out.push(`いりょく ${m.power}${per}${m.pierce ? '・ぼうぎょ無視' : ''}`);
  }
  if (m.attribute) out.push(`ぞくせい：${ATTRIBUTE_META[m.attribute].jp}`);
  if (hasPriority(m)) out.push('先に うごく');
  if (m.ambush) out.push('あいてが こうげきしないと しっぱい');
  if (m.execute) out.push(`あいての HPが すくないと ${m.execute}ばい`);
  if (m.critBoost) out.push('きゅうしょに あたりやすい');
  if (m.status) {
    const s = m.status;
    out.push(`${Math.round(s.chance * 100)}% で ${STATUS_META[s.kind].jp}${s.toSelf ? '（自分）' : ''}`);
  }
  if (m.randomAttr) out.push('ランダムな ぞくせい・じょうたいいじょう');
  if (m.cures) out.push(m.cures === 'all' ? 'じょうたいいじょうを ぜんぶ なおす' : 'じょうたいいじょうを 1つ なおす');
  if (m.heal) out.push(`HP ${m.heal} かいふく`);
  if (m.buff?.stat === 'def') out.push(`${m.buff.turns}ターン、うけるダメージ -40%`);
  else if (m.buff) out.push(`${STAT_JP[m.buff.stat]} アップ（${m.buff.turns}ターン）`);
  if (m.debuff?.stat === 'def') out.push('あいての うけるダメージ +30%');
  else if (m.debuff) out.push(`あいての ${STAT_JP[m.debuff.stat]} ダウン（${m.debuff.turns}ターン）`);
  if (m.guardPct) out.push('2ターン、うけるダメージが 半分');
  if (m.reflect) out.push('2ターン、うけたダメージの 半分 を返す');
  if (m.drain) out.push(`与ダメの ${m.drain}% 回復`);
  if (m.recoil) out.push(`反動 ${m.recoil}%`);
  return out;
}

/** カードに1行だけ出す「何が起きる技か」。 */
export function moveGist(m: MoveDef): string {
  if (m.ambush) return 'あいてが こうげきなら 先に きまる';
  if (m.hits && m.hits > 1) return `${m.hits}かい れんぞく`;
  if (m.execute) return 'よわった あいてに つよい';
  if (m.critBoost) return 'きゅうしょ ねらい';
  if (m.randomAttr) return 'ランダムな ぞくせい';
  if (m.heal && m.cures) return 'かいふく＋じょうたいを なおす';
  if (m.heal && m.buff) return 'ダメージ -40% ＋かいふく';
  if (m.heal) return 'HPを かいふく';
  if (m.cures) return 'じょうたいいじょうを なおす';
  if (m.status && !m.status.toSelf) return `${Math.round(m.status.chance * 100)}% ${STATUS_META[m.status.kind].jp}`;
  if (m.guardPct) return 'ダメージ 半分（2ターン）';
  if (m.reflect) return 'ダメージを はんぶん 返す';
  if (m.buff?.stat === 'def') return 'ダメージ -40%（3ターン）';
  if (m.buff) return `${STAT_JP[m.buff.stat]} アップ`;
  if (m.debuff?.stat === 'def') return 'あいて ダメージ +30%';
  if (m.debuff) return `あいて ${STAT_JP[m.debuff.stat]} ダウン`;
  if (m.drain) return 'すいとり';
  if (m.pierce) return 'ぼうぎょ むし';
  if (m.recoil) return 'つよい・反動あり';
  if (m.first) return '先に うごく';
  return 'ふつうの こうげき';
}

/** カードの絵がわり（大きな絵文字）。 */
export function moveIcon(m: MoveDef): string {
  if (m.ambush) return '🥷';
  if (m.hits && m.hits > 1) return '🌀';
  if (m.execute) return '🦷';
  if (m.critBoost) return '🎯';
  if (m.randomAttr) return '🌈';
  if (m.status) {
    const k = m.status.kind;
    if (k === 'burn') return '🔥';
    if (k === 'freeze') return '❄️';
    if (k === 'poison') return '☠️';
    if (k === 'paralysis') return '⚡';
    if (k === 'confuse') return '💫';
    if (k === 'sleep') return '💤';
    if (k === 'flinch') return '💢';
  }
  if (m.heal) return '💚';
  if (m.cures) return '🫧';
  if (m.guardPct) return '🛡️';
  if (m.reflect) return '🔄';
  if (m.buff?.stat === 'atk') return '💪';
  if (m.buff?.stat === 'spd') return '🪽';
  if (m.buff?.stat === 'luck') return '🍀';
  if (m.buff?.stat === 'def') return '🌳';
  if (m.debuff) return '😠';
  if (m.drain) return '🦇';
  if (m.pierce) return '🪄';
  if (m.first) return '💨';
  if (m.recoil) return '🐗';
  return m.category === 'attack' ? '👊' : '✨';
}

export type CardKind = 'attack' | 'support' | 'kosei';

/** 手札・場に出すカードの表示用データ。 */
export interface CardData {
  id: string;
  kind: CardKind;
  name: string;
  icon: string;
  color: string;
  power: number | null;
  tag: string;
  gist: string;
  lines: string[];
  quick: boolean;
  rare: boolean;
  hits: number;
}

export function moveCard(m: MoveDef): CardData {
  const color = m.attribute ? ATTRIBUTE_META[m.attribute].color : m.category === 'support' ? '#1f9d63' : '#e8503a';
  return {
    id: m.id,
    kind: m.category,
    name: m.name,
    icon: moveIcon(m),
    color,
    power: m.category === 'attack' ? m.power : null,
    tag: `${m.category === 'attack' ? 'こうげき' : 'ほじょ'}${m.attribute ? `・${ATTRIBUTE_META[m.attribute].jp}` : ''}`,
    gist: moveGist(m),
    lines: moveDetailLines(m),
    quick: hasPriority(m),
    rare: isRareMove(m),
    hits: m.hits ?? 1,
  };
}

export function koseiCard(k: Kosei): CardData {
  return {
    id: 'kosei',
    kind: 'kosei',
    name: k.activeName,
    icon: '★',
    color: '#7b5cf0',
    power: null,
    tag: 'こせいわざ',
    gist: k.activeJp,
    lines: [`パッシブ：${k.passiveJp}`, `こせい技：${k.activeJp}`, 'かならず 先に うごく'],
    quick: true,
    rare: true,
    hits: 1,
  };
}
