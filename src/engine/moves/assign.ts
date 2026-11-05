import type { Attribute, BattleStyle, Character, Stats, Weapon } from '../types';
import { mulberry32 } from '../rng';
import { MOVES, isRareMove, matchesPred, moveTags, type MoveDef, type MoveId } from './data';
import { MOVE_VALUE } from './values';

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
  /** AI が 見た「何の絵か」（理由の 文に つかう）と 特徴タグ。 */
  motif?: string;
  motifTags?: string[];
  /** タイプ（たたかいかた）。とくいな 技が 1つ かならず 入る。 */
  style?: BattleStyle;
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
  // ひるみは「じょうたいいじょう（まほうっぽい）」では なく たいあたりの おまけ
  if (m.status && !m.status.toSelf) t.add(m.status.kind === 'flinch' ? 'blow' : 'status');
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

/** 「何の絵か」タグ → 好きな 技の 性質。理由は「〇〇 だから」（〇〇＝タグの ことば か AI の motif）。 */
const MOTIF_RULES: Record<string, { word: string; traits: Partial<Record<Trait, number>> }> = {
  claws: { word: 'するどい ツメが ある', traits: { claw: 5 } },
  fangs: { word: 'キバが ある', traits: { bite: 5 } },
  horns: { word: 'つのが ある', traits: { heavy: 2, blow: 2, recoil: 1 } },
  wings: { word: 'つばさが ある', traits: { wind: 5, quick: 3 } },
  tail: { word: 'しっぽが ある', traits: { blow: 2, multi: 2 } },
  shell: { word: 'こうらが ある', traits: { guard: 5, reflect: 2 } },
  armor: { word: 'よろいを きている', traits: { guard: 4, reflect: 3 } },
  weapon: { word: 'ぶきを もっている', traits: { slash: 5 } },
  big_mouth: { word: '大きな 口が ある', traits: { bite: 4 } },
  many_eyes: { word: '目が たくさん ある', traits: { eye: 5, debuff: 2 } },
  long_legs: { word: 'あしが ながい', traits: { quick: 4 } },
  cute: { word: 'かわいい', traits: { heal: 4, guard: 1, sneaky: 1 } },
  fluffy: { word: 'ふわふわ', traits: { heal: 3, guard: 2 } },
  scary: { word: 'こわそう', traits: { status: 3, debuff: 3 } },
  cool: { word: 'かっこいい', traits: { quick: 2, slash: 2 } },
  hard: { word: 'かたそう', traits: { guard: 4 } },
  fast: { word: 'はやそう', traits: { quick: 4, multi: 2 } },
  magic: { word: 'まほうが つかえそう', traits: { magic: 4, field: 3, status: 1 } },
  dragon: { word: 'ドラゴン', traits: { bite: 3, heavy: 3 } },
  dinosaur: { word: 'きょうりゅう', traits: { bite: 4, heavy: 2 } },
  robot: { word: 'ロボット', traits: { guard: 3, magic: 2, heavy: 1 } },
  vehicle: { word: 'のりもの', traits: { quick: 3, heavy: 2 } },
  plant: { word: 'しょくぶつ', traits: { heal: 2, status: 3 } },
  food: { word: 'たべもの', traits: { heal: 5 } },
  ghost: { word: 'おばけ', traits: { sneaky: 3, status: 2, debuff: 2 } },
  slime: { word: 'スライム', traits: { guard: 2, heal: 3 } },
  bug: { word: 'むし', traits: { multi: 3, status: 2 } },
  bird: { word: 'とり', traits: { wind: 4, quick: 2 } },
  fish: { word: 'さかな', traits: { quick: 2, multi: 1 } },
  human: { word: 'ひと', traits: { slash: 2, guard: 1 } },
  monster: { word: 'モンスター', traits: { heavy: 2, claw: 2 } },
};
/** タイプ → とくいな 技の 性質（2つめの 技は この なかから）。 */
const STYLE_RULES: Record<BattleStyle, Rule & { need: Trait[] }> = {
  power: { reason: 'パワータイプ だから', traits: { heavy: 5, charge: 4, recoil: 3, blow: 2 }, need: ['heavy', 'charge', 'recoil'] },
  guard: { reason: 'かたいタイプ だから', traits: { reflect: 6, guard: 2, grit: 2 }, need: ['reflect'] },
  speed: { reason: 'すばやいタイプ だから', traits: { quick: 5, multi: 4, sneaky: 1 }, need: ['quick', 'multi'] },
  magic: { reason: 'まほうタイプ だから', traits: { status: 5, field: 3, debuff: 3, magic: 3 }, need: ['status', 'field', 'debuff'] },
  balance: { reason: 'バランスタイプ だから', traits: { eye: 2, buff: 2, heal: 1, blow: 1 }, need: [] },
};

const KIND_TAGS = new Set(['dragon', 'dinosaur', 'robot', 'vehicle', 'plant', 'food', 'ghost', 'slime', 'bug', 'bird', 'fish', 'human', 'monster', 'animal']);

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
  // AI が 見た「何の絵か」：いちばん つよく 効かせる（絵に いちばん 合う 技に なる）
  for (const t of input.motifTags ?? []) {
    const r = MOTIF_RULES[t];
    if (!r) continue;
    // 種類（ドラゴン 等）は AI の ことば（「あかい ドラゴン」）で、部位・ふんいきは タグの ことばで 理由を 書く
    const word = KIND_TAGS.has(t) && input.motif ? input.motif : r.word;
    out.push({ reason: `${word} だから`, traits: r.traits, w: 1.5 });
  }
  if (input.style) out.push({ ...STYLE_RULES[input.style], w: 2 });
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
function fitOf(m: MoveDef, rules: ActiveRule[]): { score: number; reason: string | null; reasons: string[] } {
  const traits = traitsOf(m);
  let score = 0;
  const scored: [string, number][] = [];
  for (const r of rules) {
    let s = 0;
    for (const t of traits) s += r.traits[t] ?? 0;
    s *= r.w;
    score += s;
    if (s > 0) scored.push([r.reason, s]);
  }
  // 効いた 順の 理由（おなじ 理由が かさならないよう、2ばんめ以降も つかう）
  const reasons = scored.sort((a, b) => b[1] - a[1]).map(([r]) => r);
  return { score, reason: reasons[0] ?? null, reasons };
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

/** あいてに 何もしない まもり・かいふく技。 */
function isStall(m: MoveDef): boolean {
  if (m.category !== 'support') return false;
  const t = traitsOf(m);
  return (t.has('guard') || t.has('heal')) && !m.reflect && !m.read && !m.status && !m.debuff && !m.trap && !m.delay?.damage;
}

/** 技の 役わり（えらべる 3枚は ちがう 役わりに する）。 */
const ROLE_ORDER: Trait[] = ['charge', 'quick', 'multi', 'status', 'reflect', 'guard', 'heal', 'buff', 'debuff', 'field', 'heavy', 'recoil', 'sneaky', 'luck', 'eye'];
const ROLE_JP: Partial<Record<Trait, string>> = {
  charge: 'ためて 大わざ', quick: '先に うごく', multi: 'なんども こうげき', status: 'じょうたいいじょう', reflect: 'はねかえす',
  guard: 'まもる', heal: 'かいふく', buff: 'じぶんを つよく', debuff: 'あいてを よわく', field: 'てんきを かえる',
  heavy: 'おもい いちげき', recoil: 'すてみの こうげき', sneaky: 'トリック', luck: 'うんだめし', eye: 'ねらいうち',
};
export function moveRole(m: MoveDef): string {
  const t = traitsOf(m);
  const r = ROLE_ORDER.find((x) => t.has(x));
  return r ? (ROLE_JP[r] ?? 'こうげき') : m.category === 'attack' ? 'ふつうの こうげき' : 'ほじょ';
}

/** えらべる 技の 強さの はんい（つよすぎ・よわすぎは 候補に しない＝つよい技を えらぶだけに ならない）。 */
const CHOICE_BAND: [number, number] = [0.38, 0.58];
/** 3枚の 強さの ちがいの 上限（勝率）。そろわない ときは CHOICE_SPREAD_WIDE まで ゆるめる。 */
export const CHOICE_SPREAD = 0.04;
const CHOICE_SPREAD_WIDE = 0.06;

/** 技の 強さの 値（勝率。表に なければ まんなか）。 */
export const moveValue = (id: MoveId) => MOVE_VALUE[id] ?? 0.5;

/** 技えらびの 1回ぶん（テーマと 3枚）。 */
export interface MoveRound {
  title: string;
  options: MoveSlot[];
}

export interface MoveChoiceSet {
  /** きまった 4つ（えらぶ 前は 各回の 1まいめ＝いちばん 絵に 合う もの。CPU は これを つかう）。 */
  slots: MoveSlot[];
  /** 4回ぶんの 技えらび（子どもが 1回ずつ 3まいから 1まい えらぶ）。 */
  rounds: MoveRound[];
}

/**
 * 絵から 技えらびを つくる（同じ絵→同じ候補）。4つとも 子どもが えらぶ。
 *  1回め：ぞくせいの わざ（じぶんの 属性の こうげき）
 *  2回め：タイプの わざ（パワー＝大わざ・かたい＝はねかえす・すばやい＝先制や れんぞく・まほう＝じょうたいいじょう）
 *  3回め：えの とくちょうの わざ（AI が 見た ツメ・つばさ など に 合う もの）
 *  4回め：すきな わざ（絵に 合う もの なら なんでも）
 * どの 回も 1まいめ は その 絵に いちばん 合う 技。のこり 2まいは それと「強さが ちかい（勝率 ±4%）」
 * 「おなじ しゅるい（こうげき／ほじょ）」「役わりが ちがう」もの。
 * 1つの 技は 1回にしか 出ない。ため技は 1キャラ 1つまで。コンボの あいぼうが いる 技・まもるだけ の 技・
 * つよすぎ／よわすぎ の 技は 出さない。
 */
export function assignMoveChoices(input: AssignInput): MoveChoiceSet {
  const rng = mulberry32((input.seed ^ 0x4d4f5645) >>> 0);
  const rules = activeRules(input);
  const all = Object.values(MOVES);
  const allowed = (m: MoveDef) => !m.attribute || m.attribute === input.attribute;
  const shown = new Set<MoveId>();
  const usedReasons = new Set<string>();
  let chargeShown = false;
  const base = all.filter((m) => allowed(m) && !partnerNeed(m) && !isStall(m));
  const inBand = (m: MoveDef) => moveValue(m.id) >= CHOICE_BAND[0] && moveValue(m.id) <= CHOICE_BAND[1];

  /** cands から 3まい。1まいめ＝いちばん 合う もの、のこり＝強さが ちかくて おなじ しゅるい・ちがう 役わり。 */
  const pick3 = (cands: MoveDef[], fallbackReason: string, extra: MoveDef[] = []): MoveSlot[] => {
    const rank = (list: MoveDef[]) =>
      list
        .filter((m) => !shown.has(m.id) && inBand(m) && !(m.charge && chargeShown))
        // せいしつが おおい 技（のしかかり 等）が いつも 上に こないよう、せいしつの かずで ならす
        .map((m) => ({ m, fit: fitOf(m, rules), score: fitOf(m, rules).score / Math.sqrt(Math.max(1, traitsOf(m).size)), jitter: rng() }))
        .sort((a, b) => b.score + b.jitter * 2 - (a.score + a.jitter * 2));
    const pool = rank(cands);
    const backup = rank(extra.filter((m) => !cands.includes(m)));
    // まず テーマの 技だけで そろえる。だめなら ふつうの 技で おぎなう
    for (const fill of [pool, [...pool, ...backup]])
    for (const spread of [CHOICE_SPREAD, CHOICE_SPREAD_WIDE]) {
      for (const strictRole of [true, false]) {
        for (const anchor of pool.slice(0, 4)) {
          const set = [anchor];
          for (const c of fill) {
            if (set.length >= 3) break;
            if (set.some((x) => x.m.id === c.m.id)) continue;
            // 3まいは おなじ しゅるい（こうげき／ほじょ）。どれを えらんでも こうげきと ほじょの かずが かわらない
            if (c.m.category !== anchor.m.category) continue;
            if (c.m.charge && set.some((x) => x.m.charge)) continue;
            if (strictRole && set.some((x) => moveRole(x.m) === moveRole(c.m))) continue;
            if (set.some((x) => Math.abs(moveValue(x.m.id) - moveValue(c.m.id)) > spread)) continue;
            set.push(c);
          }
          if (set.length === 3) {
            return set.map((c) => {
              shown.add(c.m.id);
              if (c.m.charge) chargeShown = true;
              const reason = c.fit.reasons.find((r) => !usedReasons.has(r)) ?? fallbackReason;
              usedReasons.add(reason);
              return { id: c.m.id, reason };
            });
          }
        }
      }
    }
    return [];
  };

  // パワータイプは ため技（大わざ）を パワーの 回の ために とっておく
  if (input.style === 'power') chargeShown = true;
  const rounds: MoveRound[] = [];
  const attrWhy = `${ATTR_WORD[input.attribute]}タイプ だから`;
  // 1回め：ぞくせいの わざ（たりなければ ふつうの こうげきも まぜる）
  let r1 = pick3(base.filter((m) => m.category === 'attack' && m.attribute === input.attribute), attrWhy, base.filter((m) => m.category === 'attack' && !m.attribute));
  r1 = r1.map((o) => ({ ...o, reason: MOVES[o.id].attribute ? attrWhy : o.reason }));
  rounds.push({ title: `${ATTR_WORD[input.attribute]}の わざ`, options: r1 });
  // 2回め：タイプの わざ
  const sr = input.style ? STYLE_RULES[input.style] : null;
  const styleCands = sr && sr.need.length > 0 ? base.filter((m) => [...traitsOf(m)].some((t) => sr.need.includes(t))) : base;
  if (input.style === 'power') chargeShown = false;
  const r2 = pick3(styleCands, sr?.reason ?? 'たたかいに つかえる から', base);
  if (input.style === 'power') chargeShown = true;
  rounds.push({ title: input.style ? `${STYLE_TITLE[input.style]}の わざ` : 'とくいな わざ', options: r2 });
  // 3回め：えの とくちょう（AI の タグが あれば それに 合う もの）
  const motifRules = (input.motifTags ?? []).map((t) => MOTIF_RULES[t]).filter(Boolean);
  const motifCands = motifRules.length > 0 ? base.filter((m) => motifRules.some((r) => [...traitsOf(m)].some((t) => (r.traits[t] ?? 0) > 0))) : base;
  const r3 = pick3(motifCands, 'えに あっている から', base);
  rounds.push({ title: 'えの とくちょうの わざ', options: r3 });
  // 4回め：すきな わざ
  rounds.push({ title: 'すきな わざ', options: pick3(base, 'つかって みたい から') });

  // そろわなかった 回は、のこりの 技から 3まい（強さだけ そろえる）
  for (const r of rounds) if (r.options.length === 0) r.options = pick3(all.filter((m) => allowed(m) && !partnerNeed(m)), 'つかって みたい から');
  const ok = rounds.filter((r) => r.options.length === 3);
  const slots = ok.map((r) => r.options[0]);
  return { slots, rounds: ok };
}

const STYLE_TITLE: Record<BattleStyle, string> = { power: 'パワー', guard: 'かたい', speed: 'すばやい', magic: 'まほう', balance: 'バランス' };

/** 4つの 技（えらぶ 前の おすすめ）。 */
export function assignMoveSet(input: AssignInput): MoveSlot[] {
  return assignMoveChoices(input).slots;
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
