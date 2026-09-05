import type { Attribute, Character, StatusKind, Stats } from '../types';
import { affinityMultiplier, affinityLabel } from '../attributes';
import {
  STATUS_META,
  DEBUFFS,
  BUFF_FOR_STAT,
  DEBUFF_FOR_STAT,
  type ActiveStatus,
} from '../status';
import { getMove, type MoveDef, type MoveId } from '../moves';
import { koseiOrDefault, type Kosei, type KoseiPassive } from '../personalities';
import { mulberry32, type Rng } from '../rng';
import {
  buildReel,
  spinReel,
  rollKime,
  ultraSucceeds,
  KIME_MULT,
  KIME_JP,
  type Kime,
  type SegKind,
} from './ring';

export type Side = 0 | 1;
/** そのターンの構え。せめる＝リールを回す。まもる＝回さず被ダメを大きく減らす。こせい＝専用スキル発動。 */
export type Stance = 'attack' | 'defend' | 'kosei';
const ATTR_LIST: Attribute[] = ['fire', 'water', 'wood', 'bolt', 'dark'];
const SUDDEN_DEATH_TURN = 12;
/** まもる：被ダメージの目安 -55%（guardPct 60 → dmg×(1-60/110)）＋最大HPの約1割回復＋状態異常1つ解除。 */
const DEFEND_GUARD_PCT = 60;

export interface Combatant {
  characterId: string;
  name: string;
  attribute: Attribute;
  personality: 'aggressive' | 'calm';
  base: Stats;
  moveIds: MoveId[];
  koseiId: string;
  /** こせいアクティブの残りクールダウン（0で使える）。 */
  koseiCd: number;
  /** こせいアクティブの残り使用回数（回数制のみ。0で打ち止め）。 */
  koseiUses: number;
  maxHp: number;
  hp: number;
  statuses: ActiveStatus[];
  cooldowns: Record<MoveId, number>;
  reflect: number;
  guardPct: number;
}

export type BattleEvent =
  | { t: 'turn-start'; turn: number }
  | { t: 'ring-spin'; side: Side; index: number; segKind: SegKind; moveName: string | null }
  | { t: 'ultra-fail'; side: Side }
  | { t: 'move'; side: Side; moveName: string; category: 'attack' | 'support' }
  | { t: 'skip'; side: Side; reason: 'shock' | 'confuse' }
  | {
      t: 'result';
      side: Side;
      moveName: string;
      attribute: Attribute | null;
      kime: Kime | null;
      segKind: SegKind;
      affinity: ReturnType<typeof affinityLabel> | null;
      statusJp: string | null;
      amount: number;
      note: string;
    }
  | {
      t: 'damage';
      side: Side;
      amount: number;
      hpAfter: number;
      affinity: ReturnType<typeof affinityLabel>;
      combo: boolean;
      /** 攻撃側が瀕死で「こんじょう」火力アップが乗った一撃。 */
      comeback?: boolean;
    }
  | { t: 'defend'; side: Side }
  | { t: 'kosei'; side: Side; name: string; free: boolean }
  | { t: 'dodge'; side: Side }
  | { t: 'heal'; side: Side; amount: number; hpAfter: number }
  | { t: 'reflect'; side: Side; amount: number; hpAfter: number }
  | { t: 'status-apply'; side: Side; status: StatusKind }
  | { t: 'status-resist'; side: Side; status: StatusKind }
  | { t: 'status-cure'; side: Side; count: number }
  | { t: 'status-tick'; side: Side; status: StatusKind; amount: number; hpAfter: number }
  | { t: 'status-end'; side: Side; status: StatusKind }
  | { t: 'faint'; side: Side }
  | { t: 'battle-end'; winner: Side | 'draw' };

export interface BattleState {
  turn: number;
  seed: number;
  combatants: [Combatant, Combatant];
  log: BattleEvent[];
  phase: 'spin' | 'done';
  winner: Side | 'draw' | null;
}

function toCombatant(c: Character): Combatant {
  const k = koseiOrDefault(c.koseiId, c.attribute);
  return {
    characterId: c.id,
    name: c.name,
    attribute: c.attribute,
    personality: c.personality,
    base: { ...c.baseStats },
    moveIds: [...c.moveIds],
    koseiId: k.id,
    koseiCd: 0,
    koseiUses: k.limit.kind === 'count' ? k.limit.n : 99,
    maxHp: c.baseStats.hp,
    hp: c.baseStats.hp,
    statuses: [],
    cooldowns: {},
    reflect: 0,
    guardPct: 0,
  };
}

// ---------- こせい（パッシブ／アクティブ）----------

function kosei(c: Combatant): Kosei {
  return koseiOrDefault(c.koseiId, c.attribute);
}
function passiveIs<K extends KoseiPassive['kind']>(
  c: Combatant,
  k: K,
): Extract<KoseiPassive, { kind: K }> | null {
  const p = kosei(c).passive;
  return p.kind === k ? (p as Extract<KoseiPassive, { kind: K }>) : null;
}
/** こせいアクティブが今つかえるか。 */
export function koseiReady(c: Combatant): boolean {
  return c.koseiCd <= 0 && c.koseiUses > 0;
}

export function createBattleState(left: Character, right: Character, seed: number): BattleState {
  return {
    turn: 1,
    seed: seed >>> 0,
    combatants: [toCombatant(left), toCombatant(right)],
    log: [{ t: 'turn-start', turn: 1 }],
    phase: 'spin',
    winner: null,
  };
}

// ---------- 派生ステータス ----------

function has(c: Combatant, kind: StatusKind): boolean {
  return c.statuses.some((s) => s.kind === kind);
}

export function effStat(c: Combatant, stat: keyof Stats): number {
  let v = c.base[stat];
  for (const s of c.statuses) {
    const m = STATUS_META[s.kind];
    if (m.buffStat === stat && m.buffMult) v *= m.buffMult;
  }
  if (stat === 'atk' && has(c, 'burn')) v *= STATUS_META.burn.atkMult;
  if (stat === 'spd' && has(c, 'bind')) v *= STATUS_META.bind.spdMult;

  // こせいパッシブ
  if (stat === 'atk') {
    const up = passiveIs(c, 'atkUp');
    if (up) v *= up.mult;
    const ls = passiveIs(c, 'lastStand');
    if (ls && c.hp / c.maxHp < 0.4) v *= ls.mult;
  }
  if (stat === 'def') {
    const up = passiveIs(c, 'defUp');
    if (up) v *= up.mult;
  }
  if (stat === 'spd') {
    const up = passiveIs(c, 'spdUp');
    if (up) v *= up.mult;
  }
  return Math.max(1, v);
}

/** 行動順に使うすばやさ（firstMove パッシブが乗る）。 */
function orderSpd(c: Combatant): number {
  let v = effStat(c, 'spd');
  if (passiveIs(c, 'firstMove')) v *= 1.4;
  return v;
}

// ---------- ターン解決（引数なし・両者ルーレット）----------

export function resolveTurn(
  state: BattleState,
  stances: [Stance, Stance] = ['attack', 'attack'],
): BattleState {
  if (state.phase === 'done') return state;
  const rng = mulberry32((state.seed + state.turn * 0x9e3779b1) >>> 0);
  const next = cloneState(state);
  const log: BattleEvent[] = [];
  const tookDamage: [boolean, boolean] = [false, false];

  for (const c of next.combatants) c.guardPct = 0;

  // まもる構え（＋こせいアクティブが要塞系のとき）は行動順に関係なくターン開始時に効かせる
  for (const side of [0, 1] as Side[]) {
    if (stances[side] === 'defend') {
      let g = DEFEND_GUARD_PCT;
      if (passiveIs(next.combatants[side], 'ironWill')) g += 12;
      next.combatants[side].guardPct = g;
    }
  }

  const s0 = orderSpd(next.combatants[0]);
  const s1 = orderSpd(next.combatants[1]);
  const order: Side[] = s0 === s1 ? (rng() < 0.5 ? [0, 1] : [1, 0]) : s0 > s1 ? [0, 1] : [1, 0];

  for (const side of order) {
    if (next.winner !== null) break;
    if (stances[side] === 'defend') applyDefend(next, side, log);
    else if (stances[side] === 'kosei') applyKoseiActive(next, side, rng, log, tookDamage, false);
    else performAction(next, side, rng, log, tookDamage);
    checkFaint(next, log);
  }

  if (next.winner === null) {
    for (const side of [0, 1] as Side[]) {
      tickStatuses(next, side, log);
      checkFaint(next, log);
      if (next.winner !== null) break;
    }
  }

  // こせいパッシブ：毎ターン回復（リジェネ）
  if (next.winner === null) {
    for (const side of [0, 1] as Side[]) {
      const c = next.combatants[side];
      const rg = passiveIs(c, 'regen');
      if (rg && c.hp > 0 && c.hp < c.maxHp) {
        const amt = Math.max(1, Math.round(c.maxHp * rg.pct));
        const before = c.hp;
        c.hp = Math.min(c.maxHp, c.hp + amt);
        log.push({ t: 'heal', side, amount: c.hp - before, hpAfter: c.hp });
      }
    }
  }

  for (const side of [0, 1] as Side[]) {
    const c = next.combatants[side];
    if (c.koseiCd > 0) c.koseiCd -= 1;
    for (const k of Object.keys(c.cooldowns)) c.cooldowns[k] = Math.max(0, c.cooldowns[k] - 1);
    c.statuses = c.statuses
      .map((s) => ({ ...s, turnsLeft: s.turnsLeft - 1, age: s.age + 1 }))
      .filter((s) => {
        if (s.turnsLeft > 0) return true;
        log.push({ t: 'status-end', side, status: s.kind });
        return false;
      });
    c.guardPct = 0;
  }

  if (next.winner === null && next.turn >= SUDDEN_DEATH_TURN) {
    const chip = Math.ceil((next.turn - SUDDEN_DEATH_TURN + 1) * 14);
    for (const side of [0, 1] as Side[]) {
      const c = next.combatants[side];
      c.hp = Math.max(0, c.hp - chip);
      log.push({ t: 'status-tick', side, status: 'burn', amount: chip, hpAfter: c.hp });
    }
    checkFaint(next, log);
  }

  if (next.winner === null) {
    next.turn += 1;
    log.push({ t: 'turn-start', turn: next.turn });
  } else {
    next.phase = 'done';
    log.push({ t: 'battle-end', winner: next.winner });
  }

  next.log = [...state.log, ...log];
  return next;
}

/** まもる構え：被ダメ大幅減（guardPct は resolveTurn で先に設定済み）＋少し回復＋状態異常1つ解除。 */
function applyDefend(state: BattleState, side: Side, log: BattleEvent[]): void {
  const c = state.combatants[side];
  log.push({ t: 'defend', side });
  log.push({ t: 'move', side, moveName: 'まもる', category: 'support' });

  const base = Math.round(c.maxHp * 0.07);
  const amt = Math.round(base * (1 + effStat(c, 'heart') / 80));
  const before = c.hp;
  c.hp = Math.min(c.maxHp, c.hp + amt);
  if (c.hp > before) log.push({ t: 'heal', side, amount: c.hp - before, hpAfter: c.hp });

  const idx = c.statuses.findIndex((s) => STATUS_META[s.kind].kind === 'debuff');
  if (idx >= 0) {
    c.statuses.splice(idx, 1);
    log.push({ t: 'status-cure', side, count: 1 });
  }

  log.push({
    t: 'result', side, moveName: 'まもる', attribute: null, kime: null, segKind: 'move',
    affinity: null, statusJp: null, amount: 0, note: 'みをまもった！',
  });
}

/**
 * CPU（ソロの相手）の構え。思考ロジックではなく単純ルール＋シード乱数。
 * こせいが使えるなら状況に応じて。瀕死なら守りがち、相手が瀕死なら攻めて決めにいく。
 */
export function cpuStance(state: BattleState, side: Side, rng: Rng): Stance {
  const me = state.combatants[side];
  const foe = state.combatants[(1 - side) as Side];
  const myPct = me.hp / me.maxHp;
  const foePct = foe.hp / foe.maxHp;

  if (koseiReady(me)) {
    const offensive = !KOSEI_SUPPORT_KINDS.has(kosei(me).active.kind);
    // とどめに使う / 中盤の勝負手として使う（開幕アルファストライクはしない）
    if (offensive && foePct < 0.35 && rng() < 0.7) return 'kosei';
    if (offensive && state.turn >= 4 && foePct > 0.4 && foePct < 0.75 && rng() < 0.4) return 'kosei';
    if (!offensive && myPct < 0.6 && rng() < 0.5) return 'kosei';
  }
  if (foePct < 0.2) return 'attack';
  if (myPct < 0.3) return rng() < 0.55 ? 'defend' : 'attack';
  if (myPct < 0.55) return rng() < 0.22 ? 'defend' : 'attack';
  return rng() < 0.07 ? 'defend' : 'attack';
}

function performAction(
  state: BattleState,
  side: Side,
  rng: Rng,
  log: BattleEvent[],
  tookDamage: [boolean, boolean],
): void {
  const actor = state.combatants[side];

  if (has(actor, 'shock') && rng() < STATUS_META.shock.skipChance) {
    log.push({ t: 'skip', side, reason: 'shock' });
    return;
  }
  if (has(actor, 'confuse') && rng() < STATUS_META.confuse.selfHitChance) {
    const selfDmg = Math.max(2, Math.round(actor.maxHp * 0.06));
    actor.hp = Math.max(0, actor.hp - selfDmg);
    log.push({ t: 'skip', side, reason: 'confuse' });
    log.push({ t: 'damage', side, amount: selfDmg, hpAfter: actor.hp, affinity: 'ふつう', combo: false });
    tookDamage[side] = true;
    return;
  }

  // わざリングを回す
  const hpPct = actor.hp / actor.maxHp;
  const mercy = hpPct < 0.4 ? Math.min(1, (0.4 - hpPct) * 2.2) : 0;
  const onCooldown = new Set(
    Object.keys(actor.cooldowns).filter((id) => (actor.cooldowns[id] ?? 0) > 0),
  );
  const reel = buildReel(actor.moveIds);
  const { index, seg } = spinReel(rng, reel, {
    luck: effStat(actor, 'luck'),
    mercy,
    onCooldown,
    flinch: consumeFlinch(actor),
  });
  log.push({
    t: 'ring-spin',
    side,
    index,
    segKind: seg.kind,
    moveName: seg.kind === 'move' ? seg.label : null,
  });

  if (seg.kind === 'ska') {
    log.push({
      t: 'result', side, moveName: '', attribute: null, kime: null, segKind: 'ska',
      affinity: null, statusJp: null, amount: 0, note: 'スカッ！',
    });
    return;
  }

  if (seg.kind === 'ultra') {
    // 7コマ ＝ 運で「こせい技」が無料発動（クールダウン/回数を消費しない）。失敗もある。
    if (ultraSucceeds(rng, effStat(actor, 'heart'))) {
      applyKoseiActive(state, side, rng, log, tookDamage, true);
    } else {
      log.push({ t: 'ultra-fail', side });
      const fallback = getMove(pickBestAttack(actor));
      log.push({ t: 'move', side, moveName: fallback.name, category: 'attack' });
      if (fallback.cooldown > 0) actor.cooldowns[fallback.id] = fallback.cooldown + 1;
      dealDamage(state, side, fallback, 1.3, 'normal', rng, log, tookDamage);
    }
    return;
  }

  const move = getMove(seg.moveId!);
  if (move.cooldown > 0) actor.cooldowns[move.id] = move.cooldown + 1;
  log.push({ t: 'move', side, moveName: move.name, category: move.category });

  if (move.category === 'support') {
    resolveSupport(state, side, move, log);
    return;
  }
  let kime = rollKime(rng, effStat(actor, 'luck'));
  const cu = passiveIs(actor, 'critUp');
  if (kime === 'normal' && cu && rng() < cu.add) kime = 'crit';
  dealDamage(state, side, move, KIME_MULT[kime], kime, rng, log, tookDamage);
}

function pickBestAttack(c: Combatant): MoveId {
  const atk = c.moveIds.map(getMove).filter((m) => m.category === 'attack');
  if (atk.length === 0) return 'c_tackle';
  return atk.reduce((a, b) => (b.power > a.power ? b : a)).id;
}

/** こせいアクティブ用の合成わざ。 */
function koseiMove(name: string, power: number, attr: Attribute, extra: Partial<MoveDef> = {}): MoveDef {
  return {
    id: `kosei_${name}`,
    name,
    category: 'attack',
    attribute: attr,
    power,
    cooldown: 0,
    target: 'enemy',
    unlock: [],
    desc: '',
    ...extra,
  };
}

const KOSEI_SUPPORT_KINDS = new Set(['mend', 'fortress', 'warcry']);

/** こせいボタン（または7コマ）でアクティブを発動。free=true でクールダウン/回数を消費しない。 */
function applyKoseiActive(
  state: BattleState,
  side: Side,
  rng: Rng,
  log: BattleEvent[],
  tookDamage: [boolean, boolean],
  free: boolean,
): void {
  const actor = state.combatants[side];
  const target = state.combatants[(1 - side) as Side];
  const k = kosei(actor);
  const a = k.active;
  const attr = actor.attribute;

  if (!free) {
    if (k.limit.kind === 'cooldown') actor.koseiCd = k.limit.turns + 1;
    else actor.koseiUses = Math.max(0, actor.koseiUses - 1);
  }
  log.push({ t: 'kosei', side, name: k.activeName, free });
  log.push({
    t: 'move',
    side,
    moveName: k.activeName,
    category: KOSEI_SUPPORT_KINDS.has(a.kind) ? 'support' : 'attack',
  });

  const hit = (power: number, kime: Kime, extra: Partial<MoveDef> = {}) =>
    dealDamage(state, side, koseiMove(k.activeName, power, attr, extra), 1, kime, rng, log, tookDamage);
  const supportResult = (note: string) =>
    log.push({
      t: 'result', side, moveName: k.activeName, attribute: null, kime: null, segKind: 'move',
      affinity: null, statusJp: null, amount: 0, note,
    });
  const fullMend = (pct: number) => {
    const heal = Math.max(1, Math.round(actor.maxHp * pct));
    const before = actor.hp;
    actor.hp = Math.min(actor.maxHp, actor.hp + heal);
    if (actor.hp > before) log.push({ t: 'heal', side, amount: actor.hp - before, hpAfter: actor.hp });
    const n = actor.statuses.length;
    actor.statuses = actor.statuses.filter((s) => STATUS_META[s.kind].kind !== 'debuff');
    if (actor.statuses.length < n) log.push({ t: 'status-cure', side, count: n - actor.statuses.length });
  };
  const hexAll = () => {
    for (const dk of ['atkDown', 'defDown', 'spdDown'] as const) {
      if (applyStatus(target, dk, 3)) log.push({ t: 'status-apply', side: (1 - side) as Side, status: dk });
    }
  };

  switch (a.kind) {
    case 'smash':
      hit(a.power, 'normal', {
        pierce: a.pierce,
        status: a.status ? { kind: a.status, chance: 0.75 } : undefined,
      });
      break;
    case 'stormStatus':
      hit(a.power, 'normal', { status: { kind: a.status, chance: 1 } });
      break;
    case 'leech':
      hit(a.power, 'normal', { drain: a.drainPct });
      break;
    case 'vengeance': {
      const missing = 1 - actor.hp / actor.maxHp;
      hit(Math.round(a.base + missing * 90), 'normal');
      break;
    }
    case 'barrage':
      for (let i = 0; i < a.hits; i++) {
        if (state.winner !== null || target.hp <= 0) break;
        hit(a.power, 'normal');
        checkFaint(state, log);
      }
      break;
    case 'mend':
      fullMend(a.pct);
      supportResult('かいふく！');
      break;
    case 'fortress':
      actor.guardPct = a.guardPct;
      actor.reflect = a.reflect;
      if (applyStatus(actor, 'defUp', 2)) log.push({ t: 'status-apply', side, status: 'defUp' });
      supportResult('てっぺき！');
      break;
    case 'warcry':
      if (applyStatus(actor, 'atkUp', 3)) log.push({ t: 'status-apply', side, status: 'atkUp' });
      if (applyStatus(actor, 'spdUp', 3)) log.push({ t: 'status-apply', side, status: 'spdUp' });
      supportResult('きあい！');
      break;
    case 'hex':
      hexAll();
      hit(12, 'normal');
      break;
    case 'wildcard': {
      const roll = rng();
      if (roll < 0.4) hit(46, 'crit');
      else if (roll < 0.7) {
        fullMend(0.45);
        supportResult('大かいふく！');
      } else {
        hexAll();
        supportResult('大じゃま！');
      }
      break;
    }
  }
}

function dealDamage(
  state: BattleState,
  side: Side,
  move: MoveDef,
  mult: number,
  kime: Kime,
  rng: Rng,
  log: BattleEvent[],
  tookDamage: [boolean, boolean],
): void {
  const actor = state.combatants[side];
  const target = state.combatants[(1 - side) as Side];

  // 属性を持つわざだけ相性補正がかかる（たいあたり等の無属性わざは常にふつう＝分かりやすさ優先）
  const hasOwnAttr = move.attribute != null || !!move.randomAttr;
  let atkAttr: Attribute = move.attribute ?? actor.attribute;
  if (move.randomAttr) atkAttr = ATTR_LIST[Math.floor(rng() * ATTR_LIST.length)];
  const shownAttr = move.randomAttr ? atkAttr : move.attribute;
  const affMult = hasOwnAttr ? affinityMultiplier(atkAttr, target.attribute) : 1;
  const affLabel = affinityLabel(affMult);

  // 回避
  if (!has(target, 'bind') && !move.first) {
    const spdDiff = effStat(target, 'spd') - effStat(actor, 'spd');
    const dodge = Math.max(0, Math.min(0.3, 0.03 + spdDiff / 160));
    if (rng() < dodge) {
      log.push({ t: 'dodge', side: (1 - side) as Side });
      log.push({
        t: 'result', side, moveName: move.name, attribute: shownAttr, kime, segKind: 'move',
        affinity: null, statusJp: null, amount: 0, note: 'かわされた！',
      });
      return;
    }
  }

  let base = move.power;
  if (move.id === 'fi_finish' && target.hp / target.maxHp < 0.4) base *= 1.6;

  const atkTerm = 0.9 + effStat(actor, 'atk') / 64;
  let dmg = base * mult * atkTerm * affMult;

  const wetBolt = hasOwnAttr && atkAttr === 'bolt' && has(target, 'wet');
  if (wetBolt) dmg *= 1.6;

  if (!move.pierce) dmg *= (50 / (50 + effStat(target, 'def'))) * (1 - target.guardPct / 110);
  else dmg *= 1 - target.guardPct / 220;

  if (has(target, 'curse')) dmg *= STATUS_META.curse.incomingMult;

  const hpPct = actor.hp / actor.maxHp;
  const comeback = hpPct < 0.35;
  if (comeback) dmg *= 1 + (0.35 - hpPct) * (effStat(actor, 'heart') / 45);

  dmg *= 0.92 + rng() * 0.16;
  // 通常わざは相手の最大HPの55%までに制限（乱数だけで一撃死しない＝理不尽よけ）。必殺は別枠。
  const final = Math.min(Math.max(1, Math.round(dmg)), Math.round(target.maxHp * 0.55));

  target.hp = Math.max(0, target.hp - final);
  tookDamage[(1 - side) as Side] = true;
  log.push({
    t: 'damage', side: (1 - side) as Side, amount: final, hpAfter: target.hp,
    affinity: affLabel, combo: wetBolt || kime === 'crit', comeback,
  });

  const statusJp = applyHitExtras(state, side, move, final, rng, log, tookDamage, wetBolt);
  log.push({
    t: 'result', side, moveName: move.name, attribute: shownAttr, kime, segKind: 'move',
    affinity: affLabel === 'ふつう' ? null : affLabel, statusJp, amount: final,
    note: kime === 'crit' ? 'クリティカル！' : KIME_JP[kime],
  });
}

function applyHitExtras(
  state: BattleState,
  side: Side,
  move: MoveDef,
  final: number,
  rng: Rng,
  log: BattleEvent[],
  tookDamage: [boolean, boolean],
  wetBolt: boolean,
): string | null {
  const actor = state.combatants[side];
  const target = state.combatants[(1 - side) as Side];
  let statusJp: string | null = null;

  if (move.drain && final > 0) {
    const healed = Math.max(1, Math.round(final * (move.drain / 100)));
    const before = actor.hp;
    actor.hp = Math.min(actor.maxHp, actor.hp + healed);
    log.push({ t: 'heal', side, amount: actor.hp - before, hpAfter: actor.hp });
  }
  if (move.recoil && final > 0) {
    const rec = Math.max(1, Math.round(final * (move.recoil / 100)));
    actor.hp = Math.max(0, actor.hp - rec);
    log.push({ t: 'damage', side, amount: rec, hpAfter: actor.hp, affinity: 'ふつう', combo: false });
    tookDamage[side] = true;
  }
  if (target.reflect > 0 && final > 0 && target.hp > 0) {
    const back = Math.max(1, Math.round(final * (target.reflect / 100)));
    target.reflect = 0;
    actor.hp = Math.max(0, actor.hp - back);
    log.push({ t: 'reflect', side: (1 - side) as Side, amount: back, hpAfter: actor.hp });
    tookDamage[side] = true;
  }
  if (move.status && final > 0) {
    const s = move.status;
    const victim = s.toSelf ? actor : target;
    const vside = s.toSelf ? side : ((1 - side) as Side);
    let chance = statusChance(s.chance, effStat(actor, 'heart'), s.toSelf ? 0 : effStat(victim, 'luck'));
    if (!s.toSelf) {
      const vm = passiveIs(actor, 'venom');
      if (vm) chance = Math.min(1, chance + vm.add);
    }
    if (rng() < chance && applyStatus(victim, s.kind)) {
      log.push({ t: 'status-apply', side: vside, status: s.kind });
      if (!s.toSelf) statusJp = STATUS_META[s.kind].jp;
    } else {
      log.push({ t: 'status-resist', side: vside, status: s.kind });
    }
  }
  if (wetBolt && final > 0) {
    target.statuses = target.statuses.filter((s) => s.kind !== 'wet');
    if (applyStatus(target, 'shock')) {
      log.push({ t: 'status-apply', side: (1 - side) as Side, status: 'shock' });
      statusJp = STATUS_META.shock.jp;
    }
  }
  // こせいパッシブ：ライフスティール
  const ls = passiveIs(actor, 'lifesteal');
  if (ls && final > 0 && actor.hp > 0) {
    const gain = Math.max(1, Math.round(final * ls.pct));
    const before = actor.hp;
    actor.hp = Math.min(actor.maxHp, actor.hp + gain);
    if (actor.hp > before) log.push({ t: 'heal', side, amount: actor.hp - before, hpAfter: actor.hp });
  }
  // こせいパッシブ：とげ（受け側が常に反射）
  const th = passiveIs(target, 'thorns');
  if (th && final > 0 && target.hp > 0) {
    const back = Math.max(1, Math.round(final * (th.pct / 100)));
    actor.hp = Math.max(0, actor.hp - back);
    log.push({ t: 'reflect', side: (1 - side) as Side, amount: back, hpAfter: actor.hp });
    tookDamage[side] = true;
  }
  return statusJp;
}

function resolveSupport(state: BattleState, side: Side, move: MoveDef, log: BattleEvent[]): void {
  const actor = state.combatants[side];
  const target = state.combatants[(1 - side) as Side];
  const boost = 1;

  if (move.cures) {
    const before = actor.statuses.length;
    if (move.cures === 'all') actor.statuses = actor.statuses.filter((s) => STATUS_META[s.kind].kind !== 'debuff');
    else {
      const idx = actor.statuses.findIndex((s) => STATUS_META[s.kind].kind === 'debuff');
      if (idx >= 0) actor.statuses.splice(idx, 1);
    }
    const removed = before - actor.statuses.length;
    if (removed > 0) log.push({ t: 'status-cure', side, count: removed });
  }
  if (move.buff) {
    const bk = BUFF_FOR_STAT[move.buff.stat as 'atk' | 'def' | 'spd' | 'luck'] ?? 'atkUp';
    applyStatus(actor, bk, move.buff.turns);
    log.push({ t: 'status-apply', side, status: bk });
  }
  if (move.debuff && move.target === 'enemy') {
    const dk = DEBUFF_FOR_STAT[move.debuff.stat as 'atk' | 'def' | 'spd'] ?? 'atkDown';
    if (applyStatus(target, dk, move.debuff.turns)) {
      log.push({ t: 'status-apply', side: (1 - side) as Side, status: dk });
    } else {
      log.push({ t: 'status-resist', side: (1 - side) as Side, status: dk });
    }
  }
  if (move.status?.toSelf) {
    applyStatus(actor, move.status.kind);
    log.push({ t: 'status-apply', side, status: move.status.kind });
  }
  if (move.guardPct) actor.guardPct = Math.round(move.guardPct * boost);
  if (move.reflect) actor.reflect = Math.round(move.reflect * boost);
  if (move.heal) {
    const amt = Math.round(move.heal * boost * (1 + effStat(actor, 'heart') / 55));
    const before = actor.hp;
    actor.hp = Math.min(actor.maxHp, actor.hp + amt);
    log.push({ t: 'heal', side, amount: actor.hp - before, hpAfter: actor.hp });
  }
  log.push({
    t: 'result', side, moveName: move.name, attribute: null, kime: null, segKind: 'move',
    affinity: null, statusJp: null, amount: 0,
    note: move.guardPct ? 'かまえた！' : move.cures ? 'きよめた！' : move.heal ? 'かいふく！' : 'こうかがあった！',
  });
}

function statusChance(base: number, attackerHeart: number, victimLuck: number): number {
  let c = base * (0.85 + attackerHeart / 60);
  c -= victimLuck / 200;
  return Math.max(0.05, Math.min(1, c));
}

function consumeFlinch(c: Combatant): boolean {
  const had = has(c, 'flinch');
  if (had) c.statuses = c.statuses.filter((s) => s.kind !== 'flinch');
  return had;
}

/** 付与できたら true。こせいパッシブ「immune」でその状態異常は入らない。 */
function applyStatus(c: Combatant, kind: StatusKind, durationOverride?: number): boolean {
  const meta = STATUS_META[kind];
  if (meta.kind === 'debuff' && passiveIs(c, 'immune')?.status === kind) return false;
  const dur = durationOverride ?? meta.duration;
  const existing = c.statuses.find((s) => s.kind === kind);
  if (existing) existing.turnsLeft = Math.max(existing.turnsLeft, dur);
  else c.statuses.push({ kind, turnsLeft: dur, age: 0 });
  return true;
}

function tickStatuses(state: BattleState, side: Side, log: BattleEvent[]): void {
  const c = state.combatants[side];
  const hasBind = has(c, 'bind');
  for (const s of [...c.statuses]) {
    const meta = STATUS_META[s.kind];
    let dot = meta.dotPercent;
    if (s.kind === 'poison') dot = 0.03 + s.age * 0.02;
    if (dot > 0) {
      let dmg = Math.max(1, Math.round(c.maxHp * dot));
      if (s.kind === 'burn' && hasBind) dmg = Math.round(dmg * 1.4);
      c.hp = Math.max(0, c.hp - dmg);
      log.push({ t: 'status-tick', side, status: s.kind, amount: dmg, hpAfter: c.hp });
      if (c.hp <= 0) break;
    }
  }
}

function checkFaint(state: BattleState, log: BattleEvent[]): void {
  if (state.winner !== null) return;
  const d0 = state.combatants[0].hp <= 0;
  const d1 = state.combatants[1].hp <= 0;
  if (d0 && d1) {
    state.winner = 'draw';
    log.push({ t: 'faint', side: 0 });
    log.push({ t: 'faint', side: 1 });
  } else if (d0) {
    state.winner = 1;
    log.push({ t: 'faint', side: 0 });
  } else if (d1) {
    state.winner = 0;
    log.push({ t: 'faint', side: 1 });
  }
}

function cloneState(state: BattleState): BattleState {
  return {
    turn: state.turn,
    seed: state.seed,
    phase: state.phase,
    winner: state.winner,
    log: state.log,
    combatants: [cloneCombatant(state.combatants[0]), cloneCombatant(state.combatants[1])],
  };
}
function cloneCombatant(c: Combatant): Combatant {
  return {
    ...c,
    base: { ...c.base },
    moveIds: [...c.moveIds],
    statuses: c.statuses.map((s) => ({ ...s })),
    cooldowns: { ...c.cooldowns },
  };
}

export { DEBUFFS };
