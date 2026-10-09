import { STATUS_META } from '../engine/status';
import { ATTRIBUTE_META } from '../engine/attributes';
import { hasPriority, isRareMove, type Cond, type HandEffect, type MoveDef } from '../engine/moves';
import { artFor, koseiArt, type ArtSpec } from './art/artSpec';
import type { Kosei } from '../engine/personalities';
import { FIELD_META } from '../engine';
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
    case 'ban': return `あいての つぎの手札に ${PRED_WORD[h.pred]}が 出なくなる`;
    case 'only': return `あいての つぎの手札が ${PRED_WORD[h.pred]}だけになる`;
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

/**
 * カードに文字で見せる「効果」。数字・マークで絵に出ているもの（ダメージ・かいふく・連続・状態異常のマークなど）は
 * 絵にまかせ、絵では伝わりにくいもの（条件・確率・ターン数・手札）だけを短い札にする。
 */
export function moveChips(m: MoveDef): EffectChip[] {
  const out: EffectChip[] = [];
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  if (m.charge) out.push({ text: 'ため技：次のターン', tone: 'quick' });
  else if (hasPriority(m)) out.push({ text: '先に うごく', tone: 'quick' });
  if (m.when && m.whenMult) out.push({ text: `${condShort(m.when)} ×${m.whenMult}`, tone: 'cond' });
  if (m.ambush) out.push({ text: 'あいてが こうげきなら', tone: 'cond' });
  if (m.execute) out.push({ text: `HPすくないと ×${m.execute}`, tone: 'cond' });
  if (m.status && !m.status.toSelf) out.push({ text: `${STATUS_META[m.status.kind].jp} ${pct(m.status.chance)}`, tone: statusTone(m.status.kind) });
  if (m.randomAttr) out.push({ text: 'ランダム じょうたい', tone: 'status' });
  if (m.guardPct) out.push({ text: 'ダメージ 半分（2T）', tone: 'buff' });
  if (m.reflect) out.push({ text: 'こうげきを 返す（2T）', tone: 'buff' });
  if (m.buff?.stat === 'def') out.push({ text: 'ダメージ -40%（3T）', tone: 'buff' });
  else if (m.buff) out.push({ text: `${STAT_JP[m.buff.stat]} ↑（${m.buff.turns}T）`, tone: 'buff' });
  if (m.debuff?.stat === 'def') out.push({ text: 'あいて ダメージ +30%', tone: 'debuff' });
  else if (m.debuff) out.push({ text: `あいて ${STAT_JP[m.debuff.stat]} ↓`, tone: 'debuff' });
  if (m.cures) out.push({ text: m.cures === 'all' ? 'じょうたい ぜんぶ なおす' : 'じょうたい 1つ なおす', tone: 'heal' });
  if (m.hand) out.push({ text: handShort(m.hand), tone: 'hand' });
  if (m.field) out.push({ text: `${FIELD_META[m.field.kind].jp} ${m.field.turns}ターン：${ATTRIBUTE_META[FIELD_META[m.field.kind].up].jp}技↑ ${ATTRIBUTE_META[FIELD_META[m.field.kind].down].jp}技↓`, tone: 'buff' });
  if (m.barrier) out.push({ text: `バリア（HPの ${Math.round(m.barrier * 100)}%ぶん）`, tone: 'buff' });
  if (m.cost) out.push({ text: `HP ${Math.round(m.cost.hpPct * 100)}% を はらう`, tone: 'info' });
  if (m.delay?.damage) out.push({ text: `${m.delay.turns}ターンあと：HPの ${Math.round(m.delay.damage * 100)}%ダメージ`, tone: 'dmg' });
  if (m.delay?.heal) out.push({ text: `${m.delay.turns}ターンあと：HP ${Math.round(m.delay.heal * 100)}% かいふく`, tone: 'heal' });
  if (m.trap) out.push({ text: 'わな：あいてが こうげき→ダメージ', tone: 'cond' });
  if (m.bond) out.push({ text: 'やられたら あいても 大ダメージ', tone: 'cond' });
  if (m.endure) out.push({ text: 'やられても HP1で のこる', tone: 'buff' });
  if (m.copy) out.push({ text: 'あいての技を そのまま まねる', tone: 'cond' });
  if (m.swap === 'hp') out.push({ text: 'HPの わりあいを いれかえ', tone: 'cond' });
  if (m.swap === 'debuffs') out.push({ text: 'じょうたいいじょうを あいてに うつす', tone: 'cond' });
  if (m.swap === 'steal') out.push({ text: 'あいての 強化を うばう', tone: 'cond' });
  if (m.dice) out.push({ text: `さいころ：いりょく ${m.dice[0]}〜${m.dice[1]}`, tone: 'cond' });
  if (m.coin) out.push({ text: `うらなら じぶんが ${Math.round(m.coin.selfPct * 100)}% ダメージ`, tone: 'cond' });
  if (m.allOrNothing != null) out.push({ text: `${Math.round(m.allOrNothing * 100)}% で成功（はずれは なにも なし）`, tone: 'cond' });
  if (m.read) out.push({ text: `こうげきなら ふせいで ${m.read.power}の はんげき`, tone: 'cond' });
  if (m.critBoost) out.push({ text: 'きゅうしょ ねらい', tone: 'buff' });
  if (m.drain) out.push({ text: 'ダメージを すいとる', tone: 'heal' });
  if (m.recoil) out.push({ text: `はんどう ${m.recoil}%`, tone: 'info' });
  if (m.pierce) out.push({ text: 'ぼうぎょ むし', tone: 'dmg' });
  if (out.length === 0) out.push({ text: m.category === 'attack' ? 'ふつうの こうげき' : 'ほじょ', tone: 'info' });
  return out.slice(0, 3);
}

function handShort(h: HandEffect): string {
  switch (h.kind) {
    case 'guarantee': return `つぎ：${PRED_WORD[h.pred]} ${h.n}まい来る`;
    case 'extra': return `つぎ：てふだ +${h.n}`;
    case 'foeLess': return `あいての てふだ -${h.n}`;
    case 'luck': return 'つぎ：大技が来やすい';
    case 'ban': return `あいて：${PRED_WORD[h.pred]}ふうじ`;
    case 'only': return `あいて：${PRED_WORD[h.pred]}だけ`;
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
  if (m.field) out.push(`${FIELD_META[m.field.kind].jp}（${m.field.turns}ターン）：${FIELD_META[m.field.kind].desc}`);
  if (m.barrier) out.push(`バリア：さいだいHPの ${Math.round(m.barrier * 100)}% ぶん ダメージを かわりに うける（4ターンで きえる）`);
  if (m.cost) out.push(`HPを さいだいHPの ${Math.round(m.cost.hpPct * 100)}% はらって つかう（HP1までしか へらない）`);
  if (m.delay?.damage) out.push(`${m.delay.turns}ターンあと、あいてに さいだいHPの ${Math.round(m.delay.damage * 100)}% ダメージ`);
  if (m.delay?.heal) out.push(`${m.delay.turns}ターンあと、HPが さいだいHPの ${Math.round(m.delay.heal * 100)}% かいふく`);
  if (m.trap) out.push(`あいてが つぎに こうげきすると、あいての さいだいHPの ${Math.round(m.trap.damage * 100)}% ダメージ${m.trap.status ? `＋${STATUS_META[m.trap.status.kind].jp}` : ''}（3ターンのあいだ）`);
  if (m.bond) out.push('このターンに やられたら、あいてにも さいだいHPの 4わり ダメージ');
  if (m.endure) out.push('このターンは どんなダメージでも HP1で のこる');
  if (m.copy) out.push('あいてが えらんだ技を そのまま つかう（こせい・ため技は まねできない）');
  if (m.swap === 'hp') out.push('じぶんと あいての HPの「わりあい」を いれかえる');
  if (m.swap === 'debuffs') out.push('じぶんの じょうたいいじょうを ぜんぶ あいてに うつす');
  if (m.swap === 'steal') out.push('あいての 強化（バフ）を うばって じぶんのものにする');
  if (m.dice) out.push(`さいころの目で いりょくが 変わる（${m.dice[0]}〜${m.dice[1]}）`);
  if (m.coin) out.push(`コイン：おもてなら こうげき、うらなら じぶんが さいだいHPの ${Math.round(m.coin.selfPct * 100)}% ダメージ`);
  if (m.allOrNothing != null) out.push(`${Math.round(m.allOrNothing * 100)}% で 成功。はずれは なにも おきない`);
  if (m.read) out.push(`あいてが こうげきを えらんでいたら、ふせいで ${m.read.power}の はんげき`);
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
  /** 絵で説明するための元データ（こせい技は無し）。 */
  move?: MoveDef;
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
    move: m,
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
