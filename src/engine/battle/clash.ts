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
import { MOVES, getMove, type MoveDef, type MoveId } from '../moves';
import { koseiOrDefault, type Kosei } from '../personalities';
import { mulberry32, type Rng } from '../rng';

export type Side = 0 | 1;

/** バトルの「1手」。技ID か 'kosei'。 */
export type ClashChoice = string;

const SUDDEN_DEATH_TURN = 14;
const PER_HIT_CAP_PCT = 0.42;
/** 全体の火力。試合が「時間切れ（サドンデス）」でなく選択で決着するように調整。 */
const DMG_SCALE = 0.8;
/** 回復の底上げ。 */
const HEAL_SCALE = 1.5;
/** こせいのアクティブ技の威力の底上げ（絵の個性の主役にする）。 */
const KOSEI_POWER_MULT = 1.25;

/** 手札の枚数。 */
export const HAND_SIZE = 3;
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
}

export type ActKind = 'attack' | 'support' | 'kosei' | 'blocked';

/** 公開された「選んだカード」の見せ方。 */
export interface RevealCard {
  name: string;
  kind: 'attack' | 'support' | 'kosei';
  attribute: Attribute | null;
}

export type ClashEvent =
  | { t: 'turn'; turn: number }
  | { t: 'reveal'; cards: [RevealCard, RevealCard] }
  | { t: 'act'; side: Side; moveName: string; kind: ActKind }
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

/** 強い技（大技）かどうか。レアなので配られにくい（運が高いと出やすい）。 */
function isRare(m: MoveDef): boolean {
  return m.category === 'attack' && m.power >= 34;
}

function dealWeight(c: ClashCombatant, m: MoveDef): number {
  let w = 1;
  if (m.category === 'attack') {
    if (c.personality === 'aggressive') w *= 1.3;
  } else {
    w *= c.personality === 'calm' ? 1.4 : 0.9;
  }
  if (isRare(m)) w *= 0.6 * (1 + c.base.luck / 40);
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
  const pool = DRAW_POOL.map((m) => ({ id: m.id, w: dealWeight(c, m) }));
  const hand: ClashChoice[] = [];
  for (let i = 0; i < HAND_SIZE && pool.length > 0; i++) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let r = rng() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= pool[idx].w;
      if (r < 0) break;
    }
    hand.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  if (koseiReady(c) && rng() < KOSEI_DEAL_CHANCE) {
    hand[Math.floor(rng() * hand.length)] = 'kosei';
  }
  return hand;
}

function MOVES_SAFE(id: MoveId): MoveDef | null {
  try {
    return getMove(id);
  } catch {
    return null;
  }
}

/** 先に動く技か（まもり系・先制技）。 */
function hasPriority(m: MoveDef): boolean {
  return !!(m.first || m.guardPct || m.reflect || (m.buff && m.buff.stat === 'def'));
}

// ---------- ターン解決 ----------

interface Pick {
  move: MoveDef | null; // null = こせい
}

function resolveChoice(state: ClashState, side: Side, choice: ClashChoice): Pick {
  const c = state.combatants[side];
  if (choice === 'kosei' && koseiReady(c)) return { move: null };
  const m = choice === 'kosei' ? null : MOVES_SAFE(choice);
  if (m) return { move: m };
  // 使えない/知らない技 → 手札の先頭
  const fb = dealHand(state, side).find((h) => h !== 'kosei' && MOVES_SAFE(h));
  return { move: (fb && MOVES_SAFE(fb)) || MOVES.c_tackle };
}

function revealCard(c: ClashCombatant, p: Pick): RevealCard {
  if (!p.move) return { name: kosei(c).activeName, kind: 'kosei', attribute: c.attribute };
  return { name: p.move.name, kind: p.move.category === 'support' ? 'support' : 'attack', attribute: p.move.attribute };
}

export function resolveClashTurn(state: ClashState, choices: [ClashChoice, ClashChoice]): ClashState {
  if (state.done) return state;
  const rng = mulberry32((state.seed + state.turn * 0x9e3779b1) >>> 0);
  const next = clone(state);
  const log: ClashEvent[] = [];

  const picks: [Pick, Pick] = [resolveChoice(next, 0, choices[0]), resolveChoice(next, 1, choices[1])];
  log.push({
    t: 'reveal',
    cards: [revealCard(next.combatants[0], picks[0]), revealCard(next.combatants[1], picks[1])],
  });

  const order = decideOrder(next, picks, rng);
  for (const side of order) {
    if (next.winner !== null) break;
    act(next, side, picks[side], rng, log);
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


function decideOrder(state: ClashState, picks: [Pick, Pick], rng: Rng): Side[] {
  const prio = (p: Pick) => (!p.move ? 2 : hasPriority(p.move) ? 1 : 0);
  const p0 = prio(picks[0]);
  const p1 = prio(picks[1]);
  if (p0 !== p1) return p0 > p1 ? [0, 1] : [1, 0];
  const f0 = kosei(state.combatants[0]).passive.kind === 'firstMove';
  const f1 = kosei(state.combatants[1]).passive.kind === 'firstMove';
  if (f0 !== f1) return f0 ? [0, 1] : [1, 0];
  const s0 = effStat(state.combatants[0], 'spd');
  const s1 = effStat(state.combatants[1], 'spd');
  if (s0 === s1) return rng() < 0.5 ? [0, 1] : [1, 0];
  return s0 > s1 ? [0, 1] : [1, 0];
}

function act(state: ClashState, side: Side, pick: Pick, rng: Rng, log: ClashEvent[]): void {
  const c = state.combatants[side];
  const blocked = (moveName: string) => log.push({ t: 'act', side, moveName, kind: 'blocked' });

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
    return;
  }
  const move = pick.move;
  const isSupport = move.category === 'support';
  log.push({ t: 'act', side, moveName: move.name, kind: isSupport ? 'support' : 'attack' });
  if (isSupport) applySupport(state, side, move, log);
  else dealDamage(state, side, move, {}, rng, log);
}

function applySupport(state: ClashState, side: Side, move: MoveDef, log: ClashEvent[]): void {
  const c = state.combatants[side];
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
    const amt = Math.round(move.heal * HEAL_SCALE * (1 + effStat(c, 'heart') / 55));
    const b = c.hp;
    c.hp = Math.min(c.maxHp, c.hp + amt);
    if (c.hp > b) log.push({ t: 'heal', side, amount: c.hp - b, hpAfter: c.hp });
  }
  if (move.debuff && move.target === 'enemy') {
    const tgt = state.combatants[1 - side as Side];
    const map: Record<string, StatusKind> = { atk: 'atkDown', def: 'defDown', spd: 'spdDown' };
    const k = map[move.debuff.stat] ?? 'atkDown';
    if (applyStatus(tgt, k, move.debuff.turns)) log.push({ t: 'status-apply', side: (1 - side) as Side, kind: k });
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
  log.push({ t: 'act', side, moveName: k.activeName, kind: 'kosei' });

  const hit = (power: number, extra: Partial<MoveDef> = {}, tag: string | null = null) =>
    dealDamage(
      state,
      side,
      { id: `kosei_${k.id}`, name: k.activeName, category: 'attack', attribute: c.attribute, power: Math.round(power * KOSEI_POWER_MULT), cooldown: 0, target: 'enemy', unlock: [], desc: '', ...extra },
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
    Math.min(0.4, 0.06 + luck / 130 + (aPas.kind === 'critUp' ? aPas.add : 0)),
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
  let dmg = move.power * kimeMult * atkTerm * DMG_SCALE;

  // こおった相手に ほのお技 → 大ダメージ（このあと とかす）
  if (hasAttr && move.attribute === 'fire' && has(target, 'freeze')) dmg *= 1.5;

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
  final = Math.min(final, Math.round(target.maxHp * PER_HIT_CAP_PCT));

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
  return { ...c, base: { ...c.base }, statuses: c.statuses.map((s) => ({ ...s })) };
}


// ---------- CPU ----------

/** CPU が手札から1枚えらぶ。ダメージ見込み・回復の必要度などで点数をつけ、ときどき気まぐれ。 */
export function cpuChoose(state: ClashState, side: Side, rng: Rng): ClashChoice {
  const me = state.combatants[side];
  const foe = state.combatants[1 - side as Side];
  const myPct = me.hp / me.maxHp;
  const foePct = foe.hp / foe.maxHp;
  const hand = dealHand(state, side);

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
      let est = m.power * atkTerm * (m.pierce ? 1 : 40 / (40 + effStat(foe, 'def')));
      est = Math.min(est, foe.maxHp * PER_HIT_CAP_PCT);
      let s = est;
      if (est >= foe.hp) s += 60;
      if (m.status && !m.status.toSelf && !has(foe, m.status.kind)) s += m.status.chance * 8;
      if (m.status?.toSelf) s -= 4;
      if (m.recoil) s -= 3;
      if (m.drain && myPct < 0.7) s += 5;
      if (m.first) s += 2;
      return s;
    }
    let s = 3;
    const missing = me.maxHp - me.hp;
    if (m.heal) s += Math.min(missing, m.heal * HEAL_SCALE) * 0.9;
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
