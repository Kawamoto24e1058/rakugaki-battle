import { STATUS_META } from '../engine/status';
import { ATTRIBUTE_META } from '../engine/attributes';
import { hasPriority, isRareMove, type Cond, type HandEffect, type MoveDef } from '../engine/moves';
import { artFor, koseiArt, type ArtSpec } from './art/artSpec';
import type { Kosei } from '../engine/personalities';
import type { Stats } from '../engine/types';

const STAT_JP: Record<keyof Stats, string> = {
  hp: 'HP', atk: 'こうげき', def: 'ぼうぎょ', spd: 'すばやさ', luck: 'きゅうしょ', heart: 'こんじょう',
};


const STATUS_WORD: Record<string, string> = {
  burn: 'やけど', paralysis: 'まひ', freeze: 'こおり', sleep: 'ねむり', poison: 'どく', confuse: 'こんらん',
  atkDown: 'こうげきダウン', defDown: 'ぼうぎょダウン', spdDown: 'すばやさダウン', flinch: 'ひるみ',
  debuff: 'じょうたいいじょう', buff: 'バフ中',
};
const TAG_WORD: Record<string, string> = {
  fire: 'ほのお', water: 'みず', wood: 'き', bolt: 'かみなり', dark: 'やみ',
  blow: 'たたく', slash: 'きる', guard: 'まもり', heal: 'かいふく', charge: 'ため', claw: 'ひっかく', bite: 'かむ',
};

/** 条件を ひとことで（「〜なら」の形）。 */
export function condText(c: Cond): string {
  switch (c.t) {
    case 'foeHas': return `あいてが ${STATUS_WORD[c.kind] ?? c.kind}${c.kind === 'buff' ? '' : c.kind === 'debuff' ? '' : ''}なら`;
    case 'selfHas': return `自分が ${STATUS_WORD[c.kind] ?? c.kind}なら`;
    case 'foeHp': return `あいての HPが ${Math.round(c.below * 10)}わり いかなら`;
    case 'selfHp': return `自分の HPが ${Math.round(c.below * 10)}わり いかなら`;
    case 'first': return '先に うごけたなら';
    case 'second': return '先に うごけなかったなら';
    case 'foePick': return c.cat === 'attack' ? 'あいてが こうげきなら' : 'あいてが ほじょわざなら';
    case 'prev': return `まえのターンに「${TAG_WORD[c.tag] ?? c.tag}」わざを つかっていたなら`;
    case 'foeCharging': return 'あいてが ためている ときなら';
  }
}

/** カードの1行用の短い条件。 */
function condShort(c: Cond): string {
  switch (c.t) {
    case 'prev': return `前が「${TAG_WORD[c.tag] ?? c.tag}」なら`;
    case 'foeHas': return `あいてが ${c.kind === 'debuff' ? '状態異常' : STATUS_WORD[c.kind] ?? c.kind}なら`;
    case 'foePick': return c.cat === 'attack' ? 'あいてが こうげきなら' : 'あいてが ほじょなら';
    case 'foeHp': return `あいて HP ${Math.round(c.below * 10)}わり以下なら`;
    case 'selfHp': return `自分 HP ${Math.round(c.below * 10)}わり以下なら`;
    case 'first': return '先に うごけたら';
    case 'second': return 'あとに うごいたら';
    default: return condText(c);
  }
}

const PRED_WORD: Record<string, string> = {
  attack: 'こうげき', support: 'ほじょ', guard: 'まもり', heal: 'かいふく', first: '先に うごく技', rare: '大技', status: 'じょうたいいじょう技',
};
export function handText(h: HandEffect): string {
  switch (h.kind) {
    case 'guarantee': return `つぎの手札に ${PRED_WORD[h.pred]}が ${h.n}まい かならず 来る`;
    case 'extra': return `つぎの手札が ${h.n}まい ふえる`;
    case 'foeLess': return `あいての つぎの手札が ${h.n}まい へる`;
    case 'luck': return 'つぎの手札に 大技・ため技が 来やすい';
  }
}


export type ChipTone =
  | 'dmg' | 'heal' | 'status' | 'buff' | 'debuff' | 'cond' | 'quick' | 'hand' | 'info'
  | 'st-burn' | 'st-freeze' | 'st-poison' | 'st-paralysis' | 'st-confuse' | 'st-sleep' | 'st-flinch';

/** 状態異常の色（やけど=赤、こおり=水色、どく=紫、まひ=黄、こんらん=ピンク、ねむり=青灰）。 */
function statusTone(kind: string): ChipTone {
  const k = `st-${kind}`;
  return (['st-burn', 'st-freeze', 'st-poison', 'st-paralysis', 'st-confuse', 'st-sleep', 'st-flinch'].includes(k) ? k : 'status') as ChipTone;
}
export interface EffectChip {
  text: string;
  tone: ChipTone;
}

/** カードに はっきり見せる「効果」。色分けした短い札（多くて3つ）。 */
export function moveChips(m: MoveDef): EffectChip[] {
  const out: EffectChip[] = [];
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  if (m.charge) out.push({ text: 'ため技：次のターン', tone: 'quick' });
  if (m.category === 'attack') {
    out.push({ text: `ダメージ ${m.power}${m.hits && m.hits > 1 ? ` ×${m.hits}かい` : ''}`, tone: 'dmg' });
    if (m.pierce) out.push({ text: 'ぼうぎょ むし', tone: 'dmg' });
    if (m.execute) out.push({ text: `HPすくないと ×${m.execute}`, tone: 'cond' });
    if (m.critBoost) out.push({ text: 'きゅうしょ ねらい', tone: 'buff' });
    if (m.drain) out.push({ text: 'ダメージを すいとる', tone: 'heal' });
  }
  if (m.heal) out.push({ text: `HP +${m.heal}`, tone: 'heal' });
  if (m.cures) out.push({ text: m.cures === 'all' ? 'じょうたい ぜんぶ なおす' : 'じょうたい 1つ なおす', tone: 'heal' });
  if (m.guardPct) out.push({ text: 'うけるダメージ 半分', tone: 'buff' });
  if (m.reflect) out.push({ text: 'こうげきを はんぶん 返す', tone: 'buff' });
  if (m.buff?.stat === 'def') out.push({ text: 'ダメージ -40%', tone: 'buff' });
  else if (m.buff) out.push({ text: `${STAT_JP[m.buff.stat]} ↑ ${m.buff.turns}ターン`, tone: 'buff' });
  if (m.debuff?.stat === 'def') out.push({ text: 'あいて ダメージ +30%', tone: 'debuff' });
  else if (m.debuff) out.push({ text: `あいて ${STAT_JP[m.debuff.stat]} ↓`, tone: 'debuff' });
  if (m.status && !m.status.toSelf) out.push({ text: `${STATUS_META[m.status.kind].jp} ${pct(m.status.chance)}`, tone: statusTone(m.status.kind) });
  if (m.randomAttr) out.push({ text: 'ランダム じょうたい', tone: 'status' });
  if (m.ambush) out.push({ text: 'あいてが こうげきなら', tone: 'cond' });
  if (m.when && m.whenMult) out.push({ text: `${condShort(m.when)} ×${m.whenMult}`, tone: 'cond' });
  if (m.hand) out.push({ text: handShort(m.hand), tone: 'hand' });
  if (m.recoil) out.push({ text: `はんどう ${m.recoil}%`, tone: 'info' });
  if (m.riskShift && m.riskShift >= 6) out.push({ text: 'かすりやすい', tone: 'info' });
  if (hasPriority(m) && !m.charge) out.unshift({ text: '先に うごく', tone: 'quick' });
  // 先頭（ダメージ/かいふく）→ 条件 → ほか の順に並べて3つまで
  const rank = (t: ChipTone) => ({ quick: 0, dmg: 1, heal: 1, cond: 2, hand: 4, info: 5 } as Record<string, number>)[t] ?? 3;
  const sorted = out.map((c, i) => ({ c, i })).sort((a, b) => rank(a.c.tone) - rank(b.c.tone) || a.i - b.i).map((x) => x.c);
  return sorted.slice(0, 3);
}

function handShort(h: HandEffect): string {
  switch (h.kind) {
    case 'guarantee': return `つぎ：${PRED_WORD[h.pred]} ${h.n}まい来る`;
    case 'extra': return `つぎ：てふだ +${h.n}`;
    case 'foeLess': return `あいての てふだ -${h.n}`;
    case 'luck': return 'つぎ：大技が来やすい';
  }
}

/** タップ・長押しで見せる、技の詳しい説明（1行ずつ）。 */
export function moveDetailLines(m: MoveDef): string[] {
  const out: string[] = [];
  if (m.category === 'attack') {
    const per = m.hits && m.hits > 1 ? `（${m.hits}かい）` : '';
    out.push(`いりょく ${m.power}${per}${m.pierce ? '・ぼうぎょ無視' : ''}`);
  }
  if (m.attribute) out.push(`ぞくせい：${ATTRIBUTE_META[m.attribute].jp}`);
  if (hasPriority(m)) out.push('先に うごく');
  if (m.charge) out.push('ため技：選んだターンは むぼうび（ダメージ 3わり ふえる）。つぎのターンに かならず はなつ');
  if (m.ambush) out.push('あいてが こうげきしないと しっぱい');
  if (m.execute) out.push(`あいての HPが すくないと ${m.execute}ばい`);
  if (m.critBoost) out.push('きゅうしょに あたりやすい');
  if (m.status) {
    const s = m.status;
    out.push(`${Math.round(s.chance * 100)}% で ${STATUS_META[s.kind].jp}${s.toSelf ? '（自分）' : ''}`);
  }
  if (m.when && m.whenMult) out.push(`${condText(m.when)} ${m.category === 'attack' ? 'ダメージ' : 'かいふく'} ${m.whenMult}ばい`);
  if (m.hand) out.push(handText(m.hand));
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
  if (m.charge) return m.category === 'attack' ? 'ためて つぎのターンに どかん！' : 'ためて つぎのターンに かいふく';
  if (m.when && m.whenMult) return `${condShort(m.when)} ${m.whenMult}ばい`;
  if (m.hand && !m.heal && !m.buff && !m.debuff) return handText(m.hand).replace('つぎの手札', 'つぎの手札');
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
  if (m.hand) return handText(m.hand);
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

export type CardKind = 'attack' | 'support' | 'kosei';

/** 手札・場に出すカードの表示用データ。 */
export interface CardData {
  id: string;
  kind: CardKind;
  name: string;
  art: ArtSpec;
  color: string;
  power: number | null;
  tag: string;
  gist: string;
  chips: EffectChip[];
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
    art: artFor(m),
    color,
    power: m.category === 'attack' ? m.power : null,
    tag: `${m.category === 'attack' ? 'こうげき' : 'ほじょ'}${m.attribute ? `・${ATTRIBUTE_META[m.attribute].jp}` : ''}`,
    gist: moveGist(m),
    chips: moveChips(m),
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
    art: koseiArt(),
    color: '#7b5cf0',
    power: null,
    tag: 'こせいわざ',
    gist: k.activeJp,
    chips: [],
    lines: [`パッシブ：${k.passiveJp}`, `こせい技：${k.activeJp}`, 'かならず 先に うごく'],
    quick: true,
    rare: true,
    hits: 1,
  };
}
