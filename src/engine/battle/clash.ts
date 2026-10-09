/**
 * 手札バトル。
 *
 * 毎ターン、全ワザの中から「3枚」がランダムに配られ（性格・運でかたよりが出る）、
 * その中から1枚を伏せて選ぶ → 同時公開 → 速さ順（まもり系・先制技・こせいは先に）に発動する。
 * こせい技は、ときどき手札に混ざる。絵が決めるのはステータス・性格・こせい。
 *
 * ターンの手札は state.seed と turn から決まる（dealHand）ので、UI は選ぶ前に手札を表示できる。
 */
import type { Attribute, Character, StatusKind, Stats } from '../types';
import { attributeStatusMult } from '../attributes';
import { STATUS_META, type ActiveStatus } from '../status';
import { MOVES, getMove, hasPriority, isRareMove, matchesPred, moveTags, type Cond, type HandEffect, type MoveDef, type MoveId } from '../moves';
import { ATTRIBUTE_STATUS } from '../status';
import { ATTRIBUTES } from '../types';
import { koseiOrDefault, type Kosei } from '../personalities';
import { mulberry32, type Rng } from '../rng';

export type Side = 0 | 1;

/** バトルの「1手」。技ID か 'kosei'。 */
export type ClashChoice = string;

const SUDDEN_DEATH_TURN = 14;
const PER_HIT_CAP_PCT = 0.42;
/** ため技の1発の上限。 */
const CHARGE_CAP_PCT = 0.62;
/** 全体の火力。試合が「時間切れ（サドンデス）」でなく選択で決着するように調整。 */
const DMG_SCALE = 0.85;
/** 回復の底上げ。 */
const HEAL_SCALE = 1.5;
/** こせいのアクティブ技の威力の底上げ（絵の個性の主役にする）。 */
const KOSEI_POWER_MULT = 1.25;

/** 手札の枚数（ふだん）。技で ふえたり へったりする。 */
export const HAND_SIZE = 3;
const MAX_HAND = 4;
/** こせいが使えるとき、手札に混ざる確率。 */
const KOSEI_DEAL_CHANCE = 0.3;

// ---------- 状態 ----------

export interface ClashCombatant {
  characterId: string;
  name: string;
  attribute: Attribute;
  personality: Character['personality'];
  base: Stats;
  koseiId: string;
  koseiCd: number;
  koseiUses: number;
  maxHp: number;
  hp: number;
  statuses: ActiveStatus[];
  /** ため中の技（次のターンに自動で はなつ）。 */
  charging: MoveId | null;
  /** 前のターンに つかった技のタグ（コンボ判定用）。 */
  lastTags: string[];
  /** このターンの手札にかかる効果（前のターンに決まったもの）。 */
  handMods: HandEffect[];
  /** このターンの行動で決まる、次のターンの手札への効果。 */
  nextMods: HandEffect[];
}

export type ActKind = 'attack' | 'support' | 'kosei' | 'blocked' | 'charge';

/** どちらが先に動くか、の理由。 */
export type OrderReason = 'kosei' | 'priority' | 'passive' | 'speed' | 'coin';

export type ClashEvent =
  | { t: 'turn'; turn: number }
  | { t: 'order'; first: Side; reason: OrderReason; spd: [number, number] }
  | { t: 'act'; side: Side; moveName: string; kind: ActKind; moveId: string; release?: boolean }
  | { t: 'bonus'; side: Side; label: string }
  | { t: 'damage'; side: Side; amount: number; hpAfter: number; tag: string | null }
  | { t: 'heal'; side: Side; amount: number; hpAfter: number }
  | { t: 'status-apply'; side: Side; kind: StatusKind }
  | { t: 'status-resist'; side: Side; kind: StatusKind }
  | { t: 'status-tick'; side: Side; kind: StatusKind; amount: number; hpAfter: number }
  | { t: 'status-end'; side: Side; kind: StatusKind }
  | { t: 'sudden-death'; leader: Side; chipLeader: number; chipTrailer: number }
  | { t: 'end'; winner: Side | 'draw' };

export interface ClashState {
  turn: number;
  seed: number;
  combatants: [ClashCombatant, ClashCombatant];
  log: ClashEvent[];
  done: boolean;
  winner: Side | 'draw' | null;
}

function toCombatant(c: Character): ClashCombatant {
  const k = koseiOrDefault(c.koseiId, c.attribute);
  return {
    characterId: c.id,
    name: c.name,
    attribute: c.attribute,
    personality: c.personality,
    base: { ...c.baseStats },
    koseiId: k.id,
    koseiCd: 0,
    koseiUses: k.limit.kind === 'count' ? k.limit.n : 99,
    maxHp: c.baseStats.hp,
    hp: c.baseStats.hp,
    statuses: [],
    charging: null,
    lastTags: [],
    handMods: [],
    nextMods: [],
  };
}

export function createClashState(left: Character, right: Character, seed: number): ClashState {
  return {
    turn: 1,
    seed: seed >>> 0,
    combatants: [toCombatant(left), toCombatant(right)],
    log: [{ t: 'turn', turn: 1 }],
    done: false,
    winner: null,
  };
}

function kosei(c: ClashCombatant): Kosei {
  return koseiOrDefault(c.koseiId, c.attribute);
}
export function koseiReady(c: ClashCombatant): boolean {
  return c.koseiCd <= 0 && c.koseiUses > 0;
}

function has(c: ClashCombatant, k: StatusKind): boolean {
  return c.statuses.some((s) => s.kind === k);
}

/** 派生ステータス（バフ・デバフ・やけど・からまりのみ。プロトなのでこせいパッシブは省略）。 */
export function effStat(c: ClashCombatant, stat: keyof Stats): number {
  let v = c.base[stat];
  const pas = kosei(c).passive;
  if (pas.kind === 'atkUp' && stat === 'atk') v *= pas.mult;
  if (pas.kind === 'defUp' && stat === 'def') v *= pas.mult;
  if (pas.kind === 'spdUp' && stat === 'spd') v *= pas.mult;
  for (const s of c.statuses) {
    const m = STATUS_META[s.kind];
    if (m.buffStat === stat && m.buffMult) v *= m.buffMult;
  }
  if (stat === 'atk' && has(c, 'burn')) v *= STATUS_META.burn.atkMult;
  if (stat === 'spd' && has(c, 'paralysis')) v *= STATUS_META.paralysis.spdMult;
  return Math.max(1, v);
}

// ---------- 手札 ----------

const DRAW_POOL: MoveDef[] = Object.values(MOVES);

function dealWeight(c: ClashCombatant, m: MoveDef): number {
  let w = 1;
  if (m.category === 'attack') {
    if (c.personality === 'aggressive') w *= 1.3;
  } else {
    w *= c.personality === 'calm' ? 1.4 : 0.9;
  }
  if (isRareMove(m)) w *= 0.6 * (1 + c.base.luck / 40);
  return w;
}

/**
 * side のこのターンの手札（技ID 3枚。こせいが使えるときは、ときどき1枚が 'kosei' になる）。
 * state.seed・turn・side だけで決まるので、何度呼んでも同じ。
 */
export function dealHand(state: ClashState, side: Side): ClashChoice[] {
  const c = state.combatants[side];
  const rng = mulberry32((state.seed ^ Math.imul(state.turn + 1, 0x9e3779b1) ^ Math.imul(side + 7, 0x85ebca6b)) >>> 0);
  rng();
  rng();
  // 前のターンの技による手札いじり
  let size = HAND_SIZE;
  let lucky = false;
  const guarantees: Extract<HandEffect, { kind: 'guarantee' }>[] = [];
  for (const m of c.handMods) {
    if (m.kind === 'extra') size += m.n;
    else if (m.kind === 'foeLess') size -= m.n;
    else if (m.kind === 'luck') lucky = true;
    else guarantees.push(m);
  }
  size = Math.max(2, Math.min(MAX_HAND, size));

  const pool = DRAW_POOL.map((m) => ({ m, w: dealWeight(c, m) * (lucky && (isRareMove(m) || m.charge) ? 3 : 1) }));
  const hand: ClashChoice[] = [];
  const take = (list: typeof pool) => {
    const total = list.reduce((s2, p2) => s2 + p2.w, 0);
    let r = rng() * total;
    let idx = 0;
    for (; idx < list.length - 1; idx++) {
      r -= list[idx].w;
      if (r < 0) break;
    }
    const picked = list[idx];
    hand.push(picked.m.id);
    pool.splice(pool.indexOf(picked), 1);
  };
  // 保証されたカードを先に
  for (const g of guarantees) {
    for (let i = 0; i < g.n && hand.length < size; i++) {
      const cand = pool.filter((p2) => matchesPred(p2.m, g.pred));
      if (cand.length > 0) take(cand);
    }
  }
  const locked = hand.length;
  while (hand.length < size && pool.length > 0) take(pool);
  // こせいが ときどき 混ざる（保証カードは そのまま残す）
  if (koseiReady(c) && rng() < KOSEI_DEAL_CHANCE && hand.length > locked) {
    hand[locked + Math.floor(rng() * (hand.length - locked))] = 'kosei';
  }
  // 並び：見やすいように こうげき → ほじょ
  return hand.sort((x, y) => Number(x === 'kosei') - Number(y === 'kosei'));
}

/** ため技を はなつターンの強制行動。そうでなければ null。 */
export function forcedChoice(state: ClashState, side: Side): ClashChoice | null {
  return state.combatants[side].charging ? 'release' : null;
}

function MOVES_SAFE(id: MoveId): MoveDef | null {
  try {
    return getMove(id);
  } catch {
    return null;
  }
}

// ---------- ターン解決 ----------

interface Pick {
  move: MoveDef | null; // null = こせい
  /** ためていた技を はなつ。 */
  release?: boolean;
}

function resolveChoice(state: ClashState, side: Side, choice: ClashChoice): Pick {
  const c = state.combatants[side];
  if (c.charging) {
    const m = MOVES_SAFE(c.charging);
    if (m) return { move: m, release: true };
  }
  if (choice === 'kosei' && koseiReady(c)) return { move: null };
  const m = choice === 'kosei' || choice === 'release' ? null : MOVES_SAFE(choice);
  if (m) return { move: m };
  // 使えない/知らない技 → 手札の先頭
  const fb = dealHand(state, side).find((h) => h !== 'kosei' && MOVES_SAFE(h));
  return { move: (fb && MOVES_SAFE(fb)) || MOVES.c_tackle };
}

export function resolveClashTurn(state: ClashState, choices: [ClashChoice, ClashChoice]): ClashState {
  if (state.done) return state;
  const rng = mulberry32((state.seed + state.turn * 0x9e3779b1) >>> 0);
  const next = clone(state);
  const log: ClashEvent[] = [];

  const picks: [Pick, Pick] = [resolveChoice(next, 0, choices[0]), resolveChoice(next, 1, choices[1])];
  // ため技を選んだ側は、このターン むぼうび
  for (const side of [0, 1] as Side[]) {
    const m = picks[side].move;
    if (m?.charge && !picks[side].release) applyStatus(next.combatants[side], 'charging', 1);
  }
  const { order, reason } = decideOrder(next, picks, rng);
  log.push({
    t: 'order',
    first: order[0],
    reason,
    spd: [Math.round(effStat(next.combatants[0], 'spd')), Math.round(effStat(next.combatants[1], 'spd'))],
  });
  for (const side of order) {
    if (next.winner !== null) break;
    act(next, side, picks[side], picks[(1 - side) as Side], order[0] === side, rng, log);
    checkFaint(next);
  }

  // 状態異常 tick（両者を処理してから決着判定＝同時death は draw）
  if (next.winner === null) {
    tickStatuses(next, 0, log);
    tickStatuses(next, 1, log);
    checkFaint(next);
    // パッシブ：毎ターン少し回復
    if (next.winner === null) {
      for (const side of [0, 1] as Side[]) {
        const c = next.combatants[side];
        const pas = kosei(c).passive;
        if (pas.kind === 'regen' && c.hp > 0 && c.hp < c.maxHp) {
          const amt = Math.max(1, Math.round(c.maxHp * pas.pct * 1.6));
          c.hp = Math.min(c.maxHp, c.hp + amt);
          log.push({ t: 'heal', side, amount: amt, hpAfter: c.hp });
        }
      }
    }
  }

  // カウントダウン
  for (const side of [0, 1] as Side[]) {
    const c = next.combatants[side];
    c.handMods = c.nextMods;
    c.nextMods = [];
    if (c.koseiCd > 0) c.koseiCd -= 1;
    c.statuses = c.statuses
      .map((s) => ({ ...s, turnsLeft: s.turnsLeft - 1, age: s.age + 1 }))
      .filter((s) => {
        if (s.turnsLeft > 0) return true;
        log.push({ t: 'status-end', side, kind: s.kind });
        return false;
      });
  }

  // サドンデス（リード側を多めに削る非対称）。順に適用し、リードが先に落ちて決着しやすくする。
  if (next.winner === null && next.turn >= SUDDEN_DEATH_TURN) {
    const step = next.turn - SUDDEN_DEATH_TURN + 1;
    const p0 = next.combatants[0].hp / next.combatants[0].maxHp;
    const p1 = next.combatants[1].hp / next.combatants[1].maxHp;
    const leader: Side = p0 === p1 ? (rng() < 0.5 ? 0 : 1) : p0 > p1 ? 0 : 1;
    const trailer = (1 - leader) as Side;
    const chipLeader = Math.ceil(step * 11);
    const chipTrailer = Math.ceil(step * 4);
    log.push({ t: 'sudden-death', leader, chipLeader, chipTrailer });
    next.combatants[leader].hp = Math.max(0, next.combatants[leader].hp - chipLeader);
    checkFaint(next);
    if (next.winner === null) {
      next.combatants[trailer].hp = Math.max(0, next.combatants[trailer].hp - chipTrailer);
      checkFaint(next);
    }
  }

  if (next.winner === null) {
    next.turn += 1;
    log.push({ t: 'turn', turn: next.turn });
  } else {
    next.done = true;
    log.push({ t: 'end', winner: next.winner });
  }

  next.log = [...state.log, ...log];
  return next;
}


function decideOrder(state: ClashState, picks: [Pick, Pick], rng: Rng): { order: Side[]; reason: OrderReason } {
  const prio = (p: Pick) => (!p.move ? 2 : hasPriority(p.move) ? 1 : 0);
  const p0 = prio(picks[0]);
  const p1 = prio(picks[1]);
  if (p0 !== p1) return { order: p0 > p1 ? [0, 1] : [1, 0], reason: Math.max(p0, p1) === 2 ? 'kosei' : 'priority' };
  const f0 = kosei(state.combatants[0]).passive.kind === 'firstMove';
  const f1 = kosei(state.combatants[1]).passive.kind === 'firstMove';
  if (f0 !== f1) return { order: f0 ? [0, 1] : [1, 0], reason: 'passive' };
  const s0 = effStat(state.combatants[0], 'spd');
  const s1 = effStat(state.combatants[1], 'spd');
  if (s0 === s1) return { order: rng() < 0.5 ? [0, 1] : [1, 0], reason: 'coin' };
  return { order: s0 > s1 ? [0, 1] : [1, 0], reason: 'speed' };
}

interface CondCtx {
  state: ClashState;
  side: Side;
  foePick: Pick;
  isFirst: boolean;
}

function matchStatus(c: ClashCombatant, kind: StatusKind | 'debuff' | 'buff'): boolean {
  if (kind === 'debuff') return c.statuses.some((s) => STATUS_META[s.kind].kind === 'debuff' && s.kind !== 'charging');
  if (kind === 'buff') return c.statuses.some((s) => STATUS_META[s.kind].kind === 'buff');
  return has(c, kind);
}

/** 技の「条件」が いま満たされているか。 */
export function evalCond(cond: Cond, ctx: CondCtx): boolean {
  const me = ctx.state.combatants[ctx.side];
  const foe = ctx.state.combatants[1 - ctx.side as Side];
  switch (cond.t) {
    case 'foeHas': return matchStatus(foe, cond.kind);
    case 'selfHas': return matchStatus(me, cond.kind);
    case 'foeHp': return foe.hp / foe.maxHp < cond.below;
    case 'selfHp': return me.hp / me.maxHp < cond.below;
    case 'first': return ctx.isFirst;
    case 'second': return !ctx.isFirst;
    case 'foePick': return (ctx.foePick.move?.category ?? 'attack') === cond.cat && !!ctx.foePick.move;
    case 'prev': return me.lastTags.includes(cond.tag);
    case 'foeCharging': return !!foe.charging || foe.statuses.some((s) => s.kind === 'charging');
  }
}

const BONUS_LABEL: Record<Cond['t'], string> = {
  foeHas: 'つけこんだ！',
  selfHas: 'いかした！',
  foeHp: 'とどめのチャンス！',
  selfHp: 'ふんばり！',
  first: 'タイミングばっちり！',
  second: 'タイミングばっちり！',
  foePick: 'よみあたり！',
  prev: 'コンボ！',
  foeCharging: 'ためを つぶした！',
};

function act(state: ClashState, side: Side, pick: Pick, foePick: Pick, isFirst: boolean, rng: Rng, log: ClashEvent[]): void {
  const c = state.combatants[side];
  const blocked = (moveName: string) => {
    log.push({ t: 'act', side, moveName, kind: 'blocked', moveId: pick.move?.id ?? 'kosei' });
    if (c.charging) {
      c.charging = null;
      log.push({ t: 'status-end', side, kind: 'charging' });
    }
    c.lastTags = [];
  };

  // こおり：とけるか？（とけなければ行動不能）
  const frozen = c.statuses.find((s) => s.kind === 'freeze');
  if (frozen) {
    if (rng() < (STATUS_META.freeze.wakeChance ?? 0.25)) {
      c.statuses = c.statuses.filter((s) => s.kind !== 'freeze');
      log.push({ t: 'status-end', side, kind: 'freeze' });
    } else {
      blocked('（こおって うごけない）');
      return;
    }
  }
  // ねむり：duration が尽きるまで行動不能
  if (c.statuses.some((s) => s.kind === 'sleep')) {
    blocked('（ぐうぐう ねむっている）');
    return;
  }
  // まひ：ときどき動けない
  if (has(c, 'paralysis') && rng() < STATUS_META.paralysis.skipChance) {
    blocked('（まひして うごけない）');
    return;
  }
  // こんらん：ときどき自分を攻撃
  if (has(c, 'confuse') && rng() < STATUS_META.confuse.selfHitChance) {
    const dmg = Math.max(2, Math.round(c.maxHp * 0.06));
    c.hp = Math.max(0, c.hp - dmg);
    blocked('（こんらんして じめん を なぐった）');
    log.push({ t: 'damage', side, amount: dmg, hpAfter: c.hp, tag: null });
    return;
  }

  if (!pick.move) {
    applyKosei(state, side, rng, log);
    c.lastTags = ['kosei'];
    return;
  }
  let move = pick.move;
  // ふいうち：相手が こうげきを選んでいないと しっぱい
  if (move.ambush && foePick.move?.category !== 'attack') {
    blocked(`（${move.name}は しっぱい… あいては こうげきしなかった）`);
    return;
  }

  // ため技を えらんだターン：ちからを ためる（つぎのターンに はなつ）
  if (move.charge && !pick.release) {
    log.push({ t: 'act', side, moveName: move.name, kind: 'charge', moveId: move.id });
    c.charging = move.id;
    c.lastTags = moveTags(move);
    return;
  }
  if (pick.release) c.charging = null;

  const isSupport = move.category === 'support';
  log.push({ t: 'act', side, moveName: move.name, kind: isSupport ? 'support' : 'attack', moveId: move.id, release: pick.release });

  // 条件（コンボ・つけこみ…）
  let mult = 1;
  if (move.when && move.whenMult && evalCond(move.when, { state, side, foePick, isFirst })) {
    mult = move.whenMult;
    log.push({ t: 'bonus', side, label: BONUS_LABEL[move.when.t] });
  }

  if (isSupport) {
    applySupport(state, side, move, mult, rng, log);
  } else {
    // にじいろだま：ランダムな属性とその状態異常
    if (move.randomAttr) {
      const attr = ATTRIBUTES[Math.floor(rng() * ATTRIBUTES.length)];
      move = { ...move, attribute: attr, status: { kind: ATTRIBUTE_STATUS[attr], chance: 0.5 } };
    }
    const target = state.combatants[1 - side as Side];
    for (let i = 0; i < (move.hits ?? 1); i++) {
      if (state.winner !== null || target.hp <= 0 || c.hp <= 0) break;
      dealDamage(state, side, move, { mult, uncapped: !!pick.release }, rng, log);
      checkFaint(state);
    }
  }

  // 手札いじり（次のターンの手札）
  if (move.hand && c.hp > 0) {
    if (move.hand.kind === 'foeLess') state.combatants[1 - side as Side].nextMods.push(move.hand);
    else c.nextMods.push(move.hand);
  }
  c.lastTags = moveTags(move);
}

function applySupport(state: ClashState, side: Side, move: MoveDef, mult: number, rng: Rng, log: ClashEvent[]): void {
  const c = state.combatants[side];
  const foe = state.combatants[1 - side as Side];
  if (move.cures) c.statuses = c.statuses.filter((s) => STATUS_META[s.kind].kind !== 'debuff');
  if (move.buff) {
    const map: Record<string, StatusKind> = { atk: 'atkUp', def: 'defUp', spd: 'spdUp', luck: 'luckUp' };
    const k = map[move.buff.stat] ?? 'atkUp';
    applyStatus(c, k, move.buff.turns);
    log.push({ t: 'status-apply', side, kind: k });
  }
  if (move.guardPct) {
    applyStatus(c, 'guard');
    log.push({ t: 'status-apply', side, kind: 'guard' });
  }
  if (move.reflect) {
    applyStatus(c, 'thorns');
    log.push({ t: 'status-apply', side, kind: 'thorns' });
  }
  if (move.heal) {
    const amt = Math.round(move.heal * mult * HEAL_SCALE * (1 + effStat(c, 'heart') / 55));
    const b = c.hp;
    c.hp = Math.min(c.maxHp, c.hp + amt);
    if (c.hp > b) log.push({ t: 'heal', side, amount: c.hp - b, hpAfter: c.hp });
  }
  if (move.debuff && move.target === 'enemy') {
    const map: Record<string, StatusKind> = { atk: 'atkDown', def: 'defDown', spd: 'spdDown' };
    const k = map[move.debuff.stat] ?? 'atkDown';
    if (applyStatus(foe, k, move.debuff.turns)) log.push({ t: 'status-apply', side: (1 - side) as Side, kind: k });
  }
  // 状態異常をねらう補助わざ（ねむりのうた・どくのこな…）
  if (move.status && move.target === 'enemy' && !move.status.toSelf) {
    const s = move.status;
    const attrMult = move.attribute ? attributeStatusMult(move.attribute, foe.attribute) : 1;
    const chance = Math.max(0.03, Math.min(0.97, s.chance * attrMult * (0.85 + effStat(c, 'heart') / 60) - effStat(foe, 'luck') / 200));
    if (rng() < chance && applyStatus(foe, s.kind)) log.push({ t: 'status-apply', side: (1 - side) as Side, kind: s.kind });
    else log.push({ t: 'status-resist', side: (1 - side) as Side, kind: s.kind });
  }
}

const KOSEI_SUPPORT = new Set(['mend', 'fortress', 'warcry', 'hex']);

function applyKosei(state: ClashState, side: Side, rng: Rng, log: ClashEvent[]): void {
  const c = state.combatants[side];
  const tgt = state.combatants[1 - side as Side];
  const k = kosei(c);
  const a = k.active;
  if (k.limit.kind === 'cooldown') c.koseiCd = k.limit.turns + 1;
  else c.koseiUses = Math.max(0, c.koseiUses - 1);
  log.push({ t: 'act', side, moveName: k.activeName, kind: 'kosei', moveId: 'kosei' });

  const hit = (power: number, extra: Partial<MoveDef> = {}, tag: string | null = null) =>
    dealDamage(
      state,
      side,
      { id: `kosei_${k.id}`, name: k.activeName, category: 'attack', attribute: c.attribute, power: Math.round(power * KOSEI_POWER_MULT), target: 'enemy', desc: '', ...extra },
      { tag },
      rng,
      log,
    );
  const healSelf = (pct: number, cure: boolean) => {
    const amt = Math.max(1, Math.round(c.maxHp * pct));
    const b = c.hp;
    c.hp = Math.min(c.maxHp, c.hp + amt);
    if (c.hp > b) log.push({ t: 'heal', side, amount: c.hp - b, hpAfter: c.hp });
    if (cure) c.statuses = c.statuses.filter((s) => STATUS_META[s.kind].kind !== 'debuff');
  };
  const hexAll = () => {
    for (const d of ['atkDown', 'defDown', 'spdDown'] as StatusKind[]) {
      if (applyStatus(tgt, d, 3)) log.push({ t: 'status-apply', side: (1 - side) as Side, kind: d });
    }
  };

  switch (a.kind) {
    case 'smash':
      hit(a.power, { pierce: a.pierce, status: a.status ? { kind: a.status, chance: 0.75 } : undefined });
      break;
    case 'stormStatus':
      hit(a.power, { status: { kind: a.status, chance: 1 } });
      break;
    case 'leech':
      hit(a.power, { drain: a.drainPct });
      break;
    case 'vengeance':
      hit(a.base + (1 - c.hp / c.maxHp) * 90);
      break;
    case 'barrage':
      for (let i = 0; i < a.hits; i++) {
        if (state.winner !== null || tgt.hp <= 0) break;
        hit(a.power);
        checkFaint(state);
      }
      break;
    case 'mend':
      healSelf(a.pct, true);
      break;
    case 'fortress':
      if (applyStatus(c, 'guard', 3)) log.push({ t: 'status-apply', side, kind: 'guard' });
      if (applyStatus(c, 'thorns', 3)) log.push({ t: 'status-apply', side, kind: 'thorns' });
      break;
    case 'warcry':
      if (applyStatus(c, 'atkUp', 3)) log.push({ t: 'status-apply', side, kind: 'atkUp' });
      if (applyStatus(c, 'spdUp', 3)) log.push({ t: 'status-apply', side, kind: 'spdUp' });
      break;
    case 'hex':
      hexAll();
      hit(12);
      break;
    case 'wildcard': {
      const r = rng();
      if (r < 0.4) hit(46, {}, 'クリティカル');
      else if (r < 0.7) healSelf(0.45, false);
      else hexAll();
      break;
    }
  }
}

interface DamageOpts {
  tag?: string | null;
  /** 条件（コンボなど）で かかる倍率。 */
  mult?: number;
  /** ため技を はなつとき：1発の上限を ゆるめる。 */
  uncapped?: boolean;
}

function dealDamage(
  state: ClashState,
  side: Side,
  move: MoveDef,
  opts: DamageOpts = {},
  rng: Rng,
  log: ClashEvent[],
): void {
  const actor = state.combatants[side];
  const target = state.combatants[1 - side as Side];

  const hasAttr = move.attribute != null;

  // きめ（かすり/ふつう/クリティカル）。属性はダメージに影響しない。
  const luck = effStat(actor, 'luck');
  let kimeMult = 1;
  let kimeTag: string | null = null;
  const roll = rng();
  const aPas = kosei(actor).passive;
  const tPas = kosei(target).passive;
  const critChance = Math.max(
    0.04,
    Math.min(0.6, 0.06 + luck / 130 + (aPas.kind === 'critUp' ? aPas.add : 0) + (move.critBoost ?? 0)),
  );
  // 大振りな技（riskShift）は「かすり」になりやすい＝強い一撃のリスク。
  const grazeChance = 0.12 + (move.riskShift ?? 0) / 90;
  // すばやさ：相手のほうが素早いほど かわされやすい（かわされると ダメージが大きく減る）。
  const aSpd = effStat(actor, 'spd');
  const tSpd = effStat(target, 'spd');
  const dodgeChance = 0.9 * (tSpd / (tSpd + aSpd + 10));
  const dodgeRoll = rng();
  // ひるみ：次の攻撃が かすり になる（1回で消える）
  const flinched = has(actor, 'flinch');
  if (flinched) actor.statuses = actor.statuses.filter((s) => s.kind !== 'flinch');
  if (flinched || roll < grazeChance) {
    kimeMult = 0.55;
    kimeTag = 'かすった';
  } else if (dodgeRoll < dodgeChance) {
    kimeMult = 0.3;
    kimeTag = 'かわされた';
  } else if (roll > 1 - critChance) {
    kimeMult = 1.7;
    kimeTag = 'クリティカル';
  }
  let tag: string | null = kimeTag ?? opts.tag ?? null;

  const atkTerm = 0.95 + effStat(actor, 'atk') / 46;
  let dmg = move.power * (opts.mult ?? 1) * kimeMult * atkTerm * DMG_SCALE;

  // こおった相手に ほのお技 → 大ダメージ（このあと とかす）
  if (hasAttr && move.attribute === 'fire' && has(target, 'freeze')) dmg *= 1.5;

  if (move.execute && target.hp / target.maxHp < 0.4) dmg *= move.execute;
  if (!move.pierce) dmg *= 40 / (40 + effStat(target, 'def'));
  // 状態異常による被ダメ倍率（のろい＋・ガード−・ぼうぎょ↑↓ …）。ガードは貫通でも効くが、
  // 力で読み勝ちした「ぶち抜き」は軽減だけを無視する（増える側＝ぼうぎょ↓は効く）。
  for (const s of target.statuses) {
    const im = STATUS_META[s.kind].incomingMult;
    if (im === 1) continue;
    dmg *= im;
  }
  if (tPas.kind === 'ironWill') dmg *= 0.88;

  const hpPct = actor.hp / actor.maxHp;
  if (hpPct < 0.35) {
    const guts = 1 + (0.35 - hpPct) * (effStat(actor, 'heart') / 45);
    dmg *= guts;
    if (guts >= 1.12 && !tag) tag = 'こんじょう';
  }
  if (aPas.kind === 'lastStand' && hpPct < 0.4) dmg *= aPas.mult;

  dmg *= 0.92 + rng() * 0.16;

  let final = Math.max(1, Math.round(dmg));
  final = Math.min(final, Math.round(target.maxHp * (opts.uncapped ? CHARGE_CAP_PCT : PER_HIT_CAP_PCT)));

  target.hp = Math.max(0, target.hp - final);
  log.push({ t: 'damage', side: (1 - side) as Side, amount: final, hpAfter: target.hp, tag });

  // トゲ：攻撃してきた actor に一部を返す
  if (final > 0) {
    let reflect = 0;
    for (const s of target.statuses) reflect = Math.max(reflect, STATUS_META[s.kind].reflectPct ?? 0);
    if (tPas.kind === 'thorns') reflect = Math.max(reflect, tPas.pct);
    if (reflect > 0) {
      const back = Math.max(1, Math.round(final * reflect));
      actor.hp = Math.max(0, actor.hp - back);
      log.push({ t: 'damage', side, amount: back, hpAfter: actor.hp, tag: 'トゲ' });
    }
  }

  // パッシブ：与ダメの一部を回復
  if (aPas.kind === 'lifesteal' && final > 0) {
    const heal = Math.max(1, Math.round(final * aPas.pct));
    const b = actor.hp;
    actor.hp = Math.min(actor.maxHp, actor.hp + heal);
    if (actor.hp > b) log.push({ t: 'heal', side, amount: actor.hp - b, hpAfter: actor.hp });
  }
  // ドレイン
  if (move.drain && final > 0) {
    const heal = Math.max(1, Math.round(final * (move.drain / 100)));
    const b = actor.hp;
    actor.hp = Math.min(actor.maxHp, actor.hp + heal);
    if (actor.hp > b) log.push({ t: 'heal', side, amount: actor.hp - b, hpAfter: actor.hp });
  }
  // 反動
  if (move.recoil && final > 0) {
    const rec = Math.max(1, Math.round(final * (move.recoil / 100)));
    actor.hp = Math.max(0, actor.hp - rec);
    log.push({ t: 'damage', side, amount: rec, hpAfter: actor.hp, tag: null });
  }
  // 状態異常
  if (move.status && final > 0) {
    const s = move.status;
    const victim = s.toSelf ? actor : target;
    const vside = (s.toSelf ? side : (1 - side)) as Side;
    // 属性が相手に得意なら状態異常が入りやすい／不利なら入りにくい（相手に効くときだけ）。
    const attrMult = hasAttr && !s.toSelf ? attributeStatusMult(move.attribute as Attribute, victim.attribute) : 1;
    const chance = Math.max(
      0.03,
      Math.min(
        0.97,
        (s.chance * (1) * attrMult + (aPas.kind === 'venom' ? aPas.add : 0)) *
          (0.85 + effStat(actor, 'heart') / 60) -
          effStat(victim, 'luck') / 200,
      ),
    );
    if (rng() < chance && applyStatus(victim, s.kind)) log.push({ t: 'status-apply', side: vside, kind: s.kind });
    else log.push({ t: 'status-resist', side: vside, kind: s.kind });
  }

  if (final > 0) {
    // ほのお技で こおり が とける
    if (hasAttr && move.attribute === 'fire' && has(target, 'freeze')) {
      target.statuses = target.statuses.filter((s) => s.kind !== 'freeze');
      log.push({ t: 'status-end', side: (1 - side) as Side, kind: 'freeze' });
    }
    // ダメージを受けて ねむり から 目をさます
    if (has(target, 'sleep') && rng() < (STATUS_META.sleep.wakeOnHit ?? 0.5)) {
      target.statuses = target.statuses.filter((s) => s.kind !== 'sleep');
      log.push({ t: 'status-end', side: (1 - side) as Side, kind: 'sleep' });
    }
  }
}

function applyStatus(c: ClashCombatant, kind: StatusKind, durationOverride?: number): boolean {
  const meta = STATUS_META[kind];
  const dur = durationOverride ?? meta.duration;
  const existing = c.statuses.find((s) => s.kind === kind);
  if (existing) existing.turnsLeft = Math.max(existing.turnsLeft, dur);
  else c.statuses.push({ kind, turnsLeft: dur, age: 0 });
  return true;
}

function tickStatuses(state: ClashState, side: Side, log: ClashEvent[]): void {
  const c = state.combatants[side];
  for (const s of [...c.statuses]) {
    const dot = STATUS_META[s.kind].dotPercent;
    if (dot > 0) {
      const dmg = Math.max(1, Math.round(c.maxHp * dot));
      c.hp = Math.max(0, c.hp - dmg);
      log.push({ t: 'status-tick', side, kind: s.kind, amount: dmg, hpAfter: c.hp });
      if (c.hp <= 0) break;
    }
  }
}

function checkFaint(state: ClashState): void {
  if (state.winner !== null) return;
  const d0 = state.combatants[0].hp <= 0;
  const d1 = state.combatants[1].hp <= 0;
  if (d0 && d1) state.winner = 'draw';
  else if (d0) state.winner = 1;
  else if (d1) state.winner = 0;
}

function clone(s: ClashState): ClashState {
  return {
    turn: s.turn,
    seed: s.seed,
    done: s.done,
    winner: s.winner,
    log: s.log,
    combatants: [cloneC(s.combatants[0]), cloneC(s.combatants[1])],
  };
}
function cloneC(c: ClashCombatant): ClashCombatant {
  return {
    ...c,
    base: { ...c.base },
    statuses: c.statuses.map((s) => ({ ...s })),
    lastTags: [...c.lastTags],
    handMods: [...c.handMods],
    nextMods: [...c.nextMods],
  };
}


// ---------- CPU ----------

/** CPU が手札から1枚えらぶ。ダメージ見込み・回復の必要度などで点数をつけ、ときどき気まぐれ。 */
export function cpuChoose(state: ClashState, side: Side, rng: Rng): ClashChoice {
  const me = state.combatants[side];
  const foe = state.combatants[1 - side as Side];
  const myPct = me.hp / me.maxHp;
  const foePct = foe.hp / foe.maxHp;
  const forced = forcedChoice(state, side);
  if (forced) return forced;
  const hand = dealHand(state, side);
  // 条件の判定用（相手の手は わからないので「こうげきしてくる」と見ておく）
  const guessFirst = effStat(me, 'spd') >= effStat(foe, 'spd');
  const condOk = (m: MoveDef): boolean =>
    !!m.when &&
    !!m.whenMult &&
    evalCond(m.when, { state, side, isFirst: guessFirst, foePick: { move: MOVES.c_tackle } });

  const score = (choice: ClashChoice): number => {
    if (choice === 'kosei') {
      const offensive = !KOSEI_SUPPORT.has(kosei(me).active.kind);
      if (offensive) return foePct < 0.5 ? 40 : 22;
      return myPct < 0.6 ? 36 : 6;
    }
    const m = MOVES_SAFE(choice);
    if (!m) return 0;
    if (m.category === 'attack') {
      const atkTerm = 0.95 + effStat(me, 'atk') / 46;
      let per = m.power * atkTerm * (m.pierce ? 1 : 40 / (40 + effStat(foe, 'def')));
      if (condOk(m)) per *= m.whenMult as number;
      if (m.execute && foePct < 0.4) per *= m.execute;
      if (m.critBoost) per *= 1 + m.critBoost * 0.7;
      per = Math.min(per, foe.maxHp * (m.charge ? CHARGE_CAP_PCT : PER_HIT_CAP_PCT));
      let est = per * (m.hits ?? 1);
      // ため技は 1ターン むぼうび。HPに余裕があるときだけ ねらう
      if (m.charge) est *= myPct > 0.5 ? 0.85 : 0.4;
      // ふいうちは、相手が こうげきしてきそうなときだけ
      if (m.ambush) est *= 0.6;
      let s = est;
      if (est >= foe.hp) s += 60;
      if (m.status && !m.status.toSelf && !has(foe, m.status.kind)) s += m.status.chance * 8;
      if (m.status?.toSelf) s -= 4;
      if (m.recoil) s -= 3;
      if (m.drain && myPct < 0.7) s += 5;
      if (m.first) s += 2;
      if (m.hand) s += 3;
      return s;
    }
    let s = 3;
    const missing = me.maxHp - me.hp;
    if (m.heal) s += Math.min(missing, m.heal * HEAL_SCALE * (condOk(m) ? (m.whenMult as number) : 1)) * 0.9;
    if (m.charge) s -= 2;
    if (m.hand) s += 4;
    if (m.status && m.target === 'enemy' && !m.status.toSelf && !has(foe, m.status.kind)) s += m.status.chance * 14;
    if (m.cures && me.statuses.some((x) => STATUS_META[x.kind].kind === 'debuff')) s += m.cures === 'all' ? 16 : 11;
    if ((m.guardPct || m.reflect || m.buff?.stat === 'def') && !has(me, 'guard') && !has(me, 'defUp')) s += 8 + (foePct > myPct ? 6 : 0);
    if (m.buff?.stat === 'atk' && !has(me, 'atkUp')) s += state.turn <= 6 ? 14 : 6;
    if (m.buff?.stat === 'spd' && !has(me, 'spdUp')) s += 5;
    if (m.buff?.stat === 'luck' && !has(me, 'luckUp')) s += 3;
    if (m.debuff && !has(foe, m.debuff.stat === 'atk' ? 'atkDown' : m.debuff.stat === 'def' ? 'defDown' : 'spdDown')) s += 9;
    return s;
  };

  if (rng() < 0.15) return hand[Math.floor(rng() * hand.length)];
  let best = hand[0];
  let bestScore = -Infinity;
  for (const h of hand) {
    const sc = score(h) + rng() * 1.5;
    if (sc > bestScore) {
      bestScore = sc;
      best = h;
    }
  }
  return best;
}

export function playClashToEnd(state: ClashState, seed = state.seed): ClashState {
  let cur = state;
  let guard = 0;
  while (!cur.done && guard++ < 60) {
    const rng = mulberry32((seed + cur.turn * 7919) >>> 0);
    const c0 = cpuChoose(cur, 0, rng);
    const c1 = cpuChoose(cur, 1, rng);
    cur = resolveClashTurn(cur, [c0, c1]);
  }
  return cur;
}
