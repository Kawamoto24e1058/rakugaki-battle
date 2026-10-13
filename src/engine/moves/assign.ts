import type { Attribute, Character, Stats, Weapon } from '../types';
import { mulberry32 } from '../rng';
import { MOVES, isRareMove, matchesPred, moveTags, type MoveDef, type MoveId } from './data';

/** キャラ1体がもつ技の数。 */
export const MOVES_PER_CHARACTER = 4;

/** 技1つと「なぜ この技なのか」（リビールで子どもに見せる一言）。 */
export interface MoveSlot {
  id: MoveId;
  reason: string;
}

/** 技を決めるのに使う 絵の情報。 */
export interface AssignInput {
  seed: number;
  attribute: Attribute;
  personality: Character['personality'];
  /** 絵の特徴タグ（analyze/tags.ts の activeTags。強い順）。 */
  tags?: string[];
  weapon?: Weapon;
  stats?: Stats;
}

// ------------------------------------------------------------------
//  技の「性質」：絵の特徴と むすびつけるための 目じるし
// ------------------------------------------------------------------
type Trait =
  | 'claw' | 'bite' | 'slash' | 'blow' | 'wind' | 'trick'
  | 'quick' | 'multi' | 'heavy' | 'charge' | 'recoil'
  | 'guard' | 'reflect' | 'heal' | 'buff' | 'debuff' | 'status'
  | 'eye' | 'luck' | 'field' | 'magic' | 'sneaky' | 'grit';

const TAG_TRAITS = ['claw', 'bite', 'slash', 'blow', 'wind', 'trick'];

function traitsOf(m: MoveDef): Set<Trait> {
  const t = new Set<Trait>();
  for (const tag of m.tags ?? []) if (TAG_TRAITS.includes(tag)) t.add(tag as Trait);
  if (m.first) t.add('quick');
  if ((m.hits ?? 1) > 1) t.add('multi');
  if (isRareMove(m)) t.add('heavy');
  if (m.charge) t.add('charge');
  if (m.recoil || (m.cost && m.category === 'attack')) t.add('recoil');
  if (m.guardPct || m.barrier || (m.buff && m.buff.stat === 'def')) t.add('guard');
  if (m.reflect || m.read) t.add('reflect');
  if (m.heal || m.drain || m.cures || m.delay?.heal) t.add('heal');
  if (m.buff && m.buff.stat !== 'def') t.add('buff');
  if (m.debuff) t.add('debuff');
  if (m.status && !m.status.toSelf) t.add('status');
  if (m.critBoost || m.pierce || m.read || m.when?.t === 'foePick' || m.id.startsWith('ey_')) t.add('eye');
  if (m.dice || m.coin || m.allOrNothing || m.randomAttr || m.hand?.kind === 'luck') t.add('luck');
  if (m.field) t.add('field');
  if (m.pierce || m.id.startsWith('wd_')) t.add('magic');
  if (m.ambush || m.trap || m.delay || m.swap || m.copy || m.hand) t.add('sneaky');
  if (m.endure || m.bond || m.cost || m.when?.t === 'selfHp') t.add('grit');
  return t;
}

/** 絵の特徴 → 好きな技の性質。reason は子ども向けの一言。 */
interface Rule {
  reason: string;
  traits: Partial<Record<Trait, number>>;
}

const SHAPE_RULES: Record<string, Rule> = {
  'shape:spiky': { reason: 'トゲトゲ だから', traits: { claw: 3, bite: 3, slash: 2, status: 1 } },
  'shape:round': { reason: 'まるい からだ だから', traits: { blow: 3, guard: 3, heal: 2 } },
  'shape:tall': { reason: 'ほそながい からだ だから', traits: { quick: 3, multi: 2, slash: 1 } },
  'shape:wide': { reason: 'よこに どっしり しているから', traits: { blow: 2, heavy: 2, guard: 2 } },
  'shape:big': { reason: 'からだが おおきい から', traits: { heavy: 3, charge: 3, blow: 1 } },
  'shape:small': { reason: 'ちいさくて すばしっこい から', traits: { quick: 3, trick: 2, sneaky: 2, multi: 1 } },
  'shape:symmetric': { reason: 'きちっと ととのった かたち だから', traits: { guard: 1, eye: 2 } },
  'shape:asymmetric': { reason: 'ふしぎな かたち だから', traits: { luck: 2, trick: 2, sneaky: 1 } },
  'part:eyes': { reason: '目が はっきり しているから', traits: { eye: 4, debuff: 2, reflect: 1 } },
  'part:wings': { reason: 'つばさが ある から', traits: { wind: 4, quick: 3 } },
  'mood:fierce': { reason: 'あらっぽい せいかく だから', traits: { recoil: 3, heavy: 2, buff: 2, blow: 1 } },
  'mood:calm': { reason: 'おだやかな せいかく だから', traits: { heal: 3, guard: 2, sneaky: 1 } },
  'deco:colorful': { reason: 'いろが たくさんで カラフル だから', traits: { luck: 3, field: 3, status: 1 } },
  'deco:plain': { reason: 'シンプルで まっすぐ だから', traits: { blow: 1, eye: 1, quick: 1 } },
};

const WEAPON_RULES: Record<Weapon, Rule> = {
  sword: { reason: 'するどい ところが ある から', traits: { slash: 4, claw: 1 } },
  wand: { reason: 'ふしぎな ちからが ありそう だから', traits: { magic: 3, status: 2, field: 1, sneaky: 1 } },
  shield: { reason: 'かたそう だから', traits: { guard: 4, reflect: 3 } },
  wing: { reason: 'とべそう だから', traits: { wind: 3, quick: 3 } },
};

const STAT_RULES: Record<'atk' | 'def' | 'spd' | 'hp' | 'luck', Rule> = {
  atk: { reason: 'こうげきが たかい から', traits: { heavy: 3, buff: 1, recoil: 1 } },
  def: { reason: 'ぼうぎょが たかい から', traits: { guard: 3, reflect: 2 } },
  spd: { reason: 'すばやさが たかい から', traits: { quick: 3, multi: 2 } },
  hp: { reason: 'たいりょくが ある から', traits: { charge: 2, grit: 3, heal: 1 } },
  luck: { reason: 'きゅうしょを よく 見ている から', traits: { eye: 2, luck: 1 } },
};

const ATTR_WORD: Record<Attribute, string> = { fire: 'ほのお', water: 'みず', wood: 'くさき', bolt: 'かみなり', dark: 'やみ' };

interface ActiveRule extends Rule {
  w: number;
}

/** この絵に効いている ルール（強さつき）。 */
function activeRules(input: AssignInput): ActiveRule[] {
  const out: ActiveRule[] = [];
  (input.tags ?? []).forEach((tag, i) => {
    const r = SHAPE_RULES[tag];
    // 上位のタグほど強く効く
    if (r) out.push({ ...r, w: Math.max(0.5, 1.2 - i * 0.12) });
  });
  if (input.weapon) out.push({ ...WEAPON_RULES[input.weapon], w: 0.9 });
  if (input.stats) {
    const s = input.stats;
    // HP は ほかより 数値が 大きいので ならして くらべる
    const ranked = (['atk', 'def', 'spd', 'hp'] as const)
      .map((k) => ({ k, v: k === 'hp' ? s.hp / 2.4 : s[k] }))
      .sort((a, b) => b.v - a.v);
    out.push({ ...STAT_RULES[ranked[0].k], w: 1 });
    if (s.luck >= 60) out.push({ ...STAT_RULES.luck, w: 0.6 });
  }
  return out;
}

/** 技の「この絵に合っている度」と いちばん効いた理由。 */
function fitOf(m: MoveDef, rules: ActiveRule[]): { score: number; reason: string | null } {
  const traits = traitsOf(m);
  let score = 0;
  let best = 0;
  let reason: string | null = null;
  for (const r of rules) {
    let s = 0;
    for (const t of traits) s += r.traits[t] ?? 0;
    s *= r.w;
    score += s;
    if (s > best) {
      best = s;
      reason = r.reason;
    }
  }
  return { score, reason };
}

/**
 * この技が 役に立つには、ほかに どんな技が いるか（コンボの あいぼう）。
 * いらなければ null。
 */
function partnerNeed(m: MoveDef): ((x: MoveDef) => boolean) | null {
  const w = m.when;
  if (w?.t === 'prev') {
    const tag = w.tag;
    return (x) => x.id !== m.id && moveTags(x).includes(tag);
  }
  if (w?.t === 'foeHas') {
    const kind = w.kind;
    if (kind === 'buff') return null;
    if (kind === 'debuff') return (x) => x.id !== m.id && !!x.status && !x.status.toSelf;
    return (x) => x.id !== m.id && x.status?.kind === kind;
  }
  if (m.hand?.kind === 'guarantee' && m.hand.pred !== 'attack') {
    const pred = m.hand.pred;
    return (x) => x.id !== m.id && matchesPred(x, pred);
  }
  return null;
}

/** 絵の理由が ないとき：もう入っている技との 相性を 理由にする。 */
function synergyReason(m: MoveDef, picked: MoveDef[]): string | null {
  const w = m.when;
  let partner: MoveDef | undefined;
  if (w?.t === 'first') partner = picked.find((p) => p.id !== m.id && p.first);
  else {
    const need = partnerNeed(m);
    if (need) partner = picked.find(need);
  }
  return partner ? `「${partner.name}」と あわせると つよい から` : null;
}

/** あいてに 何もしない まもり・かいふく技。 */
function isStall(m: MoveDef): boolean {
  if (m.category !== 'support') return false;
  const t = traitsOf(m);
  return (t.has('guard') || t.has('heal')) && !m.reflect && !m.read && !m.status && !m.debuff && !m.trap && !m.delay?.damage;
}

/** どれだけ こうげき寄りか（＋なら こうげき、−なら ほじょ）。 */
function aggression(input: AssignInput, rng: () => number): number {
  const tags = new Set(input.tags ?? []);
  let a = input.personality === 'aggressive' ? 0.3 : -0.3;
  if (tags.has('shape:spiky')) a += 0.3;
  if (tags.has('shape:round')) a -= 0.15;
  if (input.weapon === 'sword') a += 0.15;
  if (input.weapon === 'shield') a -= 0.2;
  if (input.stats) a += (input.stats.atk - input.stats.def) / 80;
  return a + (rng() - 0.5) * 0.5;
}

/** こうげき寄り度 → ほじょ技の数（0〜3）。 */
export function supportCountFor(a: number): number {
  return a > 0.3 ? 0 : a > -0.25 ? 1 : a > -0.6 ? 2 : 3;
}

function pickWeighted<T>(list: { v: T; w: number }[], rng: () => number): T | null {
  const total = list.reduce((s, x) => s + x.w, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const x of list) {
    r -= x.w;
    if (r < 0) return x.v;
  }
  return list[list.length - 1]?.v ?? null;
}

/**
 * 絵から キャラの技を4つ きめる（同じ絵→同じ技）。
 *  1つめ：じぶんの属性の こうげき（かならず）
 *  のこり：絵の特徴で こうげき／ほじょの 数が 大きく かたよる（こうげき4つ〜ほじょ3つ）。
 *  どの技が入るかも 絵の特徴（かたち・パーツ・せいかく・いろ・ステータス）に 合うものほど 出やすい。
 *  コンボ技（「まえのターンに ○○なら」など）は、あいぼうの技も いっしょに入る。
 */
export function assignMoveSet(input: AssignInput): MoveSlot[] {
  const rng = mulberry32((input.seed ^ 0x4d4f5645) >>> 0);
  const rules = activeRules(input);
  const all = Object.values(MOVES);
  const allowed = (m: MoveDef) => !m.attribute || m.attribute === input.attribute;
  const supports = supportCountFor(aggression(input, rng));

  const slots: MoveSlot[] = [];
  const picked: MoveDef[] = [];
  const has = (m: MoveDef) => picked.some((p) => p.id === m.id);
  // ほじょが 2つ以上なら、そのうち1つは あいてに はたらきかける技にする
  const stallCap = Math.max(1, supports - 1);
  const stallFull = () => picked.filter(isStall).length >= stallCap;
  const add = (m: MoveDef, reason: string) => {
    picked.push(m);
    slots.push({ id: m.id, reason });
  };

  /** cands から 絵に合うものを ひとつ えらぶ。あいぼうが入らない コンボ技は のぞく。 */
  const choose = (cands: MoveDef[], fallbackReason: string) => {
    const left = MOVES_PER_CHARACTER - picked.length;
    const list = cands
      .filter((m) => !has(m) && allowed(m))
      .filter((m) => !(m.charge && picked.some((p) => p.charge)))
      .filter((m) => !(isRareMove(m) && picked.filter((p) => isRareMove(p)).length >= 2))
      // まもり・かいふくだけの技は かずを しぼる（ずっと まもって おわらない を ふせぐ）
      .filter((m) => !(isStall(m) && stallFull()))
      .filter((m) => {
        const need = partnerNeed(m);
        if (!need || picked.some(need)) return true;
        return left >= 2 && all.some((x) => allowed(x) && !has(x) && x.id !== m.id && need(x) && !(isStall(x) && (isStall(m) ? picked.filter(isStall).length + 1 : picked.filter(isStall).length) >= stallCap));
      })
      .map((m) => {
        const f = fitOf(m, rules);
        // 絵に合うほど 出やすい（合わない技も すこしは 出る＝あそび）
        return { v: { m, reason: f.reason }, w: (0.35 + f.score * f.score * 0.04) * (isRareMove(m) ? 0.55 : 1) };
      });
    const got = pickWeighted(list, rng);
    if (!got) return;
    add(got.m, got.reason ?? synergyReason(got.m, picked) ?? fallbackReason);
    // コンボの あいぼうが まだ いなければ、つぎの枠で いっしょに入れる
    const need = partnerNeed(got.m);
    if (need && !picked.some(need) && picked.length < MOVES_PER_CHARACTER) {
      const partners = all.filter((x) => {
        if (!allowed(x) || has(x) || !need(x) || (x.charge && picked.some((p) => p.charge))) return false;
        if (isStall(x) && stallFull()) return false;
        const own = partnerNeed(x);
        return !own || picked.some(own);
      });
      const p = pickWeighted(
        partners.map((x) => ({ v: x, w: 0.4 + fitOf(x, rules).score * 0.1 })),
        rng,
      );
      if (p) add(p, `「${got.m.name}」と くみあわせると つよい から`);
    }
  };

  // 1つめ：じぶんの属性の こうげき（理由は いつも 属性＝いちばん わかりやすい）
  const attrWhy = `${ATTR_WORD[input.attribute]}タイプ だから`;
  choose(all.filter((m) => m.category === 'attack' && m.attribute === input.attribute), attrWhy);
  if (slots[0]) slots[0].reason = attrWhy;

  const attacksWanted = MOVES_PER_CHARACTER - supports;
  for (let i = 0; i < 12 && picked.length < MOVES_PER_CHARACTER; i++) {
    const cat = picked.filter((p) => p.category === 'attack').length < attacksWanted ? 'attack' : 'support';
    choose(all.filter((m) => m.category === cat), cat === 'attack' ? 'つよそう だから' : 'たたかいを たすける ため');
  }
  // 万が一 たりなければ 何でも
  while (picked.length < MOVES_PER_CHARACTER) {
    const rest = all.filter((m) => allowed(m) && !has(m) && !partnerNeed(m));
    add(rest[Math.floor(rng() * rest.length)], 'なんとなく 気に入った から');
  }
  return slots.slice(0, MOVES_PER_CHARACTER);
}

/** 技IDだけ ほしいとき（古いセーブの おぎない等）。 */
export function assignMoves(
  seed: number,
  attribute: Attribute,
  personality: Character['personality'],
  extra: Omit<AssignInput, 'seed' | 'attribute' | 'personality'> = {},
): MoveId[] {
  return assignMoveSet({ seed, attribute, personality, ...extra }).map((s) => s.id);
}
