/**
 * 「力・技・速さ」三すくみバトル（Phase 17 プロトタイプ）。
 *
 * 毎ターン、両者が 力 / 技 / 速さ / こせい / こんしん を1つ伏せて選ぶ → 同時公開。
 * 三すくみ：速さ → 力 → 技 → 速さ（勝つと先手＋威力ボーナス、負けると威力ダウン＋小さな慰め）。
 * こせいは三すくみの外（相手が「力」なら晒されて余計に食らう）。こんしんは HP35%以下で解禁。
 *
 * ★重要：三すくみのクラッシュ判定はステータス・属性に一切依存しない（＝生成された絵で
 *   有利不利が固定されない）。絵の個性は「どのカテゴリに良い技を持つか」だけで出る。
 *
 * この engine はまだ本体（battle/engine.ts のわざリール方式）を置き換えていない。
 * プロトタイプで手触りを確認してから移行する。
 */
import type { Attribute, Character, StatusKind, Stats } from '../types';
import { attributeStatusMult } from '../attributes';
import { STATUS_META, type ActiveStatus } from '../status';
import { getMove, moveCategory, type MoveDef, type MoveId } from '../moves';
import { koseiOrDefault, type Kosei } from '../personalities';
import { mulberry32, type Rng } from '../rng';

export { moveCategory } from '../moves';

export type Side = 0 | 1;

/** 三すくみの構え＋外枠（こせい）。 */
export type ClashStance = 'power' | 'tech' | 'speed' | 'kosei';
/** 三すくみに参加する3つ。 */
export type TriStance = 'power' | 'tech' | 'speed';

export const STANCE_JP: Record<ClashStance, string> = {
  power: '力',
  tech: '技',
  speed: '速さ',
  kosei: 'こせい',
};
/** 力＝赤／技＝緑／速さ＝青（RGB。色覚配慮でUI側はアイコン＋文字も併記）。 */
export const STANCE_COLOR: Record<TriStance, string> = {
  power: '#e8503a',
  tech: '#1f9d63',
  speed: '#3b82f6',
};
/** その構えが「勝つ」相手。速さ→力→技→速さ。 */
export const STANCE_BEATS: Record<TriStance, TriStance> = {
  speed: 'power',
  power: 'tech',
  tech: 'speed',
};

const SUDDEN_DEATH_TURN = 12;
// クラッシュ勝ち＝相手は行動できない（発動不可）。勝者側の上乗せは控えめに。
const CLASH_WIN_MULT = 1.15;
const CLASH_LOSE_MULT = 0.62; // 現在は未使用（負け＝行動なし）。五分・こせい経路の保険で残す。
/** 速さで力を「中断」したときの、力側のさらなる減衰（振りかぶりを潰す）。 */
const INTERRUPT_MULT = 0.82;
/** 力で技を「ぶち抜いた」ときの、技側の状態異常成功率の低下。 */
const OVERPOWER_STATUS_MULT = 0.5;
/** 技で速さを「見切った」ときのカウンターの基礎ダメージ（防御無視・回避不可）。 */
const COUNTER_BASE = 8;
const PER_HIT_CAP_PCT = 0.42;

// ---------- わざのカテゴリ分け（力／技／速さ）----------
// moveCategory 本体は moves/data.ts（上で re-export）。

/** どのキャラも各カテゴリに1つは持てるよう保証する基本技。 */
const BASIC: Record<TriStance, MoveDef> = {
  power: { id: 'basic_power', name: 'たいあたり', category: 'attack', attribute: null, power: 15, cooldown: 0, target: 'enemy', unlock: [], desc: '' },
  speed: { id: 'basic_speed', name: 'はやわざ', category: 'attack', attribute: null, power: 9, cooldown: 0, target: 'enemy', unlock: [], desc: '', first: true },
  tech: { id: 'basic_tech', name: 'けんせい', category: 'attack', attribute: null, power: 8, cooldown: 0, target: 'enemy', unlock: [], desc: '', status: { kind: 'flinch', chance: 0.3 } },
};

// ---------- 状態 ----------

export interface ClashCombatant {
  characterId: string;
  name: string;
  attribute: Attribute;
  base: Stats;
  moveIds: MoveId[];
  koseiId: string;
  koseiCd: number;
  koseiUses: number;
  maxHp: number;
  hp: number;
  statuses: ActiveStatus[];
  cooldowns: Record<MoveId, number>;
  /** 力／技／速さ の代表わざ（バトル開始時に確定・UI ボタンに表示・その構えで基本これが出る）。 */
  stanceMoves: Record<TriStance, MoveId>;
  /** 直近のターンでこせいを撃って晒された（相手が力なら被ダメ+30%）。 */
  koseiExposed: boolean;
}

export type ClashEvent =
  | { t: 'turn'; turn: number }
  | { t: 'reveal'; stances: [ClashStance, ClashStance] }
  | { t: 'clash'; winner: Side | null; note: string }
  | { t: 'act'; side: Side; stance: ClashStance; moveName: string }
  | { t: 'damage'; side: Side; amount: number; hpAfter: number; tag: string | null }
  | { t: 'heal'; side: Side; amount: number; hpAfter: number }
  | { t: 'status-apply'; side: Side; kind: StatusKind }
  | { t: 'status-resist'; side: Side; kind: StatusKind }
  | { t: 'status-tick'; side: Side; kind: StatusKind; amount: number; hpAfter: number }
  | { t: 'status-end'; side: Side; kind: StatusKind }
  | { t: 'consolation'; side: Side; amount: number }
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
    base: { ...c.baseStats },
    moveIds: [...c.moveIds],
    koseiId: k.id,
    koseiCd: 0,
    koseiUses: k.limit.kind === 'count' ? k.limit.n : 99,
    maxHp: c.baseStats.hp,
    hp: c.baseStats.hp,
    statuses: [],
    cooldowns: {},
    stanceMoves: signatureMoves(c.moveIds),
    koseiExposed: false,
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
  for (const s of c.statuses) {
    const m = STATUS_META[s.kind];
    if (m.buffStat === stat && m.buffMult) v *= m.buffMult;
  }
  if (stat === 'atk' && has(c, 'burn')) v *= STATUS_META.burn.atkMult;
  if (stat === 'spd' && has(c, 'bind')) v *= STATUS_META.bind.spdMult;
  return Math.max(1, v);
}

// ---------- カテゴリ別の持ち技 ----------

function MOVES_SAFE(id: MoveId): MoveDef | null {
  try {
    return getMove(id);
  } catch {
    return null;
  }
}

/** 各カテゴリで「一番いい技」の順に並べる（力＝威力／速さ＝先制優先／技＝効果）。 */
function rankCategory(moveIds: MoveId[], cat: TriStance): MoveDef[] {
  const pool = moveIds.map(MOVES_SAFE).filter((m): m is MoveDef => !!m && moveCategory(m) === cat);
  if (pool.length === 0) return [BASIC[cat]];
  if (cat === 'power') return [...pool].sort((a, b) => b.power - a.power);
  if (cat === 'speed') {
    return [...pool].sort((a, b) => Number(!!b.first) - Number(!!a.first) || b.power - a.power);
  }
  const score = (m: MoveDef) =>
    (m.cures === 'all' ? 3 : m.cures ? 2 : 0) +
    (m.heal ? m.heal / 12 : 0) +
    (m.guardPct ? m.guardPct / 30 : 0) +
    (m.status ? 2 : 0) +
    (m.debuff ? 2 : 0) +
    (m.pierce ? 1 : 0) +
    m.power / 20;
  return [...pool].sort((a, b) => score(b) - score(a));
}

/** キャラの「力／技／速さ の代表わざ」（バトル開始時に確定・UIのボタンに表示）。 */
function signatureMoves(moveIds: MoveId[]): Record<TriStance, MoveId> {
  return {
    power: rankCategory(moveIds, 'power')[0].id,
    tech: rankCategory(moveIds, 'tech')[0].id,
    speed: rankCategory(moveIds, 'speed')[0].id,
  };
}

/** その構えで実際に出るわざ：代表わざ → CD なら同カテゴリの別の技 → 基本技。 */
function pickMove(c: ClashCombatant, cat: TriStance): MoveDef {
  const ranked = rankCategory(c.moveIds, cat);
  const sig = MOVES_SAFE(c.stanceMoves[cat]);
  const order = sig ? [sig, ...ranked.filter((m) => m.id !== sig.id)] : ranked;
  const ready = order.find((m) => (c.cooldowns[m.id] ?? 0) <= 0);
  return ready ?? BASIC[cat];
}

/** UI 表示用：その構えの代表わざの名前（＋威力の目安）。 */
export function stanceMoveDef(c: ClashCombatant, cat: TriStance): MoveDef {
  return MOVES_SAFE(c.stanceMoves[cat]) ?? BASIC[cat];
}

// ---------- クラッシュ判定 ----------

type ClashResult = 'win' | 'even' | 'lose';

function triOf(s: ClashStance): TriStance | null {
  return s === 'power' || s === 'tech' || s === 'speed' ? s : null;
}

/** side から見たクラッシュ結果。三すくみ外（こせい/こんしん）は even 扱い。 */
function clashResult(mine: ClashStance, theirs: ClashStance): ClashResult {
  const a = triOf(mine);
  const b = triOf(theirs);
  if (!a || !b) return 'even';
  if (a === b) return 'even';
  if (STANCE_BEATS[a] === b) return 'win';
  if (STANCE_BEATS[b] === a) return 'lose';
  return 'even';
}

function clashNote(win: Side, wStance: TriStance): string {
  const who = win === 0 ? '' : '';
  void who;
  if (wStance === 'power') return '力で ぶち抜いた！';
  if (wStance === 'tech') return '見切った！';
  return '先手を取った！';
}

// ---------- ターン解決 ----------

export function resolveClashTurn(
  state: ClashState,
  stances: [ClashStance, ClashStance],
): ClashState {
  if (state.done) return state;
  const rng = mulberry32((state.seed + state.turn * 0x9e3779b1) >>> 0);
  const next = clone(state);
  const log: ClashEvent[] = [];

  // こせいが使えなければ 力 に落とす
  const eff: [ClashStance, ClashStance] = [
    normalizeStance(next.combatants[0], stances[0]),
    normalizeStance(next.combatants[1], stances[1]),
  ];
  log.push({ t: 'reveal', stances: eff });

  for (const c of next.combatants) c.koseiExposed = false;
  if (eff[0] === 'kosei' && eff[1] === 'power') next.combatants[0].koseiExposed = true;
  if (eff[1] === 'kosei' && eff[0] === 'power') next.combatants[1].koseiExposed = true;

  // クラッシュ
  const r0 = clashResult(eff[0], eff[1]);
  let clashWinner: Side | null = null;
  const t0 = triOf(eff[0]);
  const t1 = triOf(eff[1]);
  if (r0 === 'win' && t0) {
    clashWinner = 0;
    log.push({ t: 'clash', winner: 0, note: clashNote(0, t0) });
  } else if (r0 === 'lose' && t1) {
    clashWinner = 1;
    log.push({ t: 'clash', winner: 1, note: clashNote(1, t1) });
  } else {
    log.push({ t: 'clash', winner: null, note: '五分！' });
  }

  // 行動順：クラッシュ勝者 → 「速さ」構え → すばやさ
  const order = decideOrder(next, eff, clashWinner, rng);

  for (const side of order) {
    if (next.winner !== null) break;
    const foe = eff[(1 - side) as Side];
    const res = clashResult(eff[side], foe);
    if (res === 'lose') {
      // 三すくみに負けた側は 発動できない（見切られた）。カウンター等は勝者側の act で処理。
      log.push({ t: 'act', side, stance: eff[side], moveName: '（見切られて うごけない）' });
      continue;
    }
    act(next, side, eff[side], foe, res, rng, log);
    checkFaint(next);
  }

  // クラッシュ負け側の慰め（発動できないぶん、連敗が苦行にならないように）
  if (next.winner === null) {
    for (const side of [0, 1] as Side[]) {
      if (clashResult(eff[side], eff[1 - side as Side]) === 'lose') {
        const c = next.combatants[side];
        if (c.hp > 0 && c.hp < c.maxHp) {
          const amt = Math.max(4, Math.round(c.maxHp * 0.08));
          c.hp = Math.min(c.maxHp, c.hp + amt);
          log.push({ t: 'consolation', side, amount: amt });
        }
      }
    }
  }

  // 状態異常 tick（両者を処理してから決着判定＝同時death は draw）
  if (next.winner === null) {
    tickStatuses(next, 0, log);
    tickStatuses(next, 1, log);
    checkFaint(next);
  }

  // カウントダウン
  for (const side of [0, 1] as Side[]) {
    const c = next.combatants[side];
    if (c.koseiCd > 0) c.koseiCd -= 1;
    for (const k of Object.keys(c.cooldowns)) c.cooldowns[k] = Math.max(0, c.cooldowns[k] - 1);
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
    const chipLeader = Math.ceil(step * 16);
    const chipTrailer = Math.ceil(step * 7);
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

function normalizeStance(c: ClashCombatant, s: ClashStance): ClashStance {
  if (s === 'kosei' && !koseiReady(c)) return 'power';
  return s;
}

function decideOrder(
  state: ClashState,
  eff: [ClashStance, ClashStance],
  clashWinner: Side | null,
  rng: Rng,
): Side[] {
  if (clashWinner !== null) return [clashWinner, (1 - clashWinner) as Side];
  const fast0 = eff[0] === 'speed';
  const fast1 = eff[1] === 'speed';
  if (fast0 !== fast1) return fast0 ? [0, 1] : [1, 0];
  const s0 = effStat(state.combatants[0], 'spd');
  const s1 = effStat(state.combatants[1], 'spd');
  if (s0 === s1) return rng() < 0.5 ? [0, 1] : [1, 0];
  return s0 > s1 ? [0, 1] : [1, 0];
}

function act(
  state: ClashState,
  side: Side,
  stance: ClashStance,
  foeStance: ClashStance,
  result: ClashResult,
  rng: Rng,
  log: ClashEvent[],
): void {
  const c = state.combatants[side];

  // しびれ／こんらん
  if (has(c, 'shock') && rng() < STATUS_META.shock.skipChance) {
    log.push({ t: 'act', side, stance, moveName: '（しびれてうごけない）' });
    return;
  }
  if (has(c, 'confuse') && rng() < STATUS_META.confuse.selfHitChance) {
    const dmg = Math.max(2, Math.round(c.maxHp * 0.06));
    c.hp = Math.max(0, c.hp - dmg);
    log.push({ t: 'act', side, stance, moveName: '（こんらんして じめん を なぐった）' });
    log.push({ t: 'damage', side, amount: dmg, hpAfter: c.hp, tag: null });
    return;
  }

  if (stance === 'kosei') {
    applyKosei(state, side, rng, log);
    return;
  }

  const move = pickMove(c, stance);
  if (move.cooldown > 0 && !move.id.startsWith('basic_')) c.cooldowns[move.id] = move.cooldown + 1;
  log.push({ t: 'act', side, stance, moveName: move.name });

  // 技で速さを「見切った」→ 補助わざでも当たるカウンター（防御無視・回避不可）
  if (stance === 'tech' && result === 'win' && foeStance === 'speed') {
    const foe = state.combatants[(1 - side) as Side];
    const dmg = Math.max(1, Math.round(COUNTER_BASE + effStat(c, 'heart') / 3));
    foe.hp = Math.max(0, foe.hp - dmg);
    log.push({ t: 'damage', side: (1 - side) as Side, amount: dmg, hpAfter: foe.hp, tag: 'カウンター' });
  }

  if (move.category === 'support') {
    applySupport(state, side, move, log);
    return;
  }

  let clashMult = result === 'win' ? CLASH_WIN_MULT : result === 'lose' ? CLASH_LOSE_MULT : 1;
  // 力が「速さ」に中断されたら、振りかぶりを潰されてさらに弱くなる
  if (stance === 'power' && foeStance === 'speed') clashMult *= INTERRUPT_MULT;
  // 力 vs 技 は「ぶち抜く」だけで、殴り合いの大差はつけない（読み外し1回で試合が終わらないよう）
  if (stance === 'power' && result === 'win' && foeStance === 'tech') clashMult = 1.05;
  // 技が「力」にぶち抜かれたら、状態異常が入りにくくなる。技が勝てば逆に入りやすい。
  let statusMult = 1;
  if (stance === 'tech' && result === 'lose' && foeStance === 'power') statusMult = OVERPOWER_STATUS_MULT;
  else if (stance === 'tech' && result === 'win') statusMult = 1.35;
  dealDamage(state, side, move, { clashMult, statusMult }, rng, log);
}

function applySupport(state: ClashState, side: Side, move: MoveDef, log: ClashEvent[]): void {
  const c = state.combatants[side];
  if (move.cures) {
    const before = c.statuses.length;
    c.statuses = c.statuses.filter((s) => STATUS_META[s.kind].kind !== 'debuff');
    void before;
  }
  if (move.buff) {
    const map: Record<string, StatusKind> = { atk: 'atkUp', def: 'defUp', spd: 'spdUp', luck: 'luckUp' };
    const k = map[move.buff.stat] ?? 'atkUp';
    applyStatus(c, k, move.buff.turns);
    log.push({ t: 'status-apply', side, kind: k });
  }
  if (move.heal) {
    const amt = Math.round(move.heal * (1 + effStat(c, 'heart') / 55));
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
  log.push({ t: 'act', side, stance: 'kosei', moveName: k.activeName });

  const hit = (power: number, extra: Partial<MoveDef> = {}, tag: string | null = null) =>
    dealDamage(
      state,
      side,
      { id: `kosei_${k.id}`, name: k.activeName, category: 'attack', attribute: c.attribute, power, cooldown: 0, target: 'enemy', unlock: [], desc: '', ...extra },
      { clashMult: 1, tag },
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
      if (applyStatus(c, 'defUp', 2)) log.push({ t: 'status-apply', side, kind: 'defUp' });
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
  clashMult: number;
  /** 命中時に付与する状態異常の成功率にかかる倍率（クラッシュ結果で変わる）。 */
  statusMult?: number;
  ignoreCap?: boolean;
  tag?: string | null;
}

function dealDamage(
  state: ClashState,
  side: Side,
  move: MoveDef,
  opts: DamageOpts,
  rng: Rng,
  log: ClashEvent[],
): void {
  const actor = state.combatants[side];
  const target = state.combatants[1 - side as Side];

  const hasAttr = move.attribute != null;

  // きめ（かすり/ふつう/クリティカル）。属性はダメージに影響しない。
  const luck = effStat(actor, 'luck');
  let kimeMult = 1;
  let tag: string | null = opts.tag ?? null;
  const roll = rng();
  const critChance = Math.max(0.04, Math.min(0.34, 0.06 + luck / 130));
  // 大振りな技（riskShift）は「かすり」になりやすい＝強い一撃のリスク。
  const grazeChance = 0.12 + (move.riskShift ?? 0) / 90;
  if (roll < grazeChance) {
    kimeMult = 0.55;
    if (!tag) tag = 'かすった';
  } else if (roll > 1 - critChance) {
    kimeMult = 1.7;
    if (!tag) tag = 'クリティカル';
  }

  const atkTerm = 0.95 + effStat(actor, 'atk') / 46;
  let dmg = move.power * opts.clashMult * kimeMult * atkTerm;

  if (hasAttr && move.attribute === 'bolt' && has(target, 'wet')) dmg *= 1.6;

  if (!move.pierce) dmg *= 40 / (40 + effStat(target, 'def'));
  if (has(target, 'curse')) dmg *= STATUS_META.curse.incomingMult;
  if (target.koseiExposed) dmg *= 1.3;

  const hpPct = actor.hp / actor.maxHp;
  if (hpPct < 0.35) {
    const guts = 1 + (0.35 - hpPct) * (effStat(actor, 'heart') / 45);
    dmg *= guts;
    if (guts >= 1.12 && !tag) tag = 'こんじょう';
  }

  dmg *= 0.92 + rng() * 0.16;

  let final = Math.max(1, Math.round(dmg));
  if (!opts.ignoreCap) final = Math.min(final, Math.round(target.maxHp * PER_HIT_CAP_PCT));

  target.hp = Math.max(0, target.hp - final);
  log.push({ t: 'damage', side: (1 - side) as Side, amount: final, hpAfter: target.hp, tag });

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
        s.chance * (opts.statusMult ?? 1) * attrMult * (0.85 + effStat(actor, 'heart') / 60) -
          effStat(victim, 'luck') / 200,
      ),
    );
    if (rng() < chance && applyStatus(victim, s.kind)) log.push({ t: 'status-apply', side: vside, kind: s.kind });
    else log.push({ t: 'status-resist', side: vside, kind: s.kind });
  }
  // ぬれ×雷：ぬれを消してしびれ
  if (hasAttr && move.attribute === 'bolt' && has(target, 'wet') && final > 0) {
    target.statuses = target.statuses.filter((s) => s.kind !== 'wet');
    if (applyStatus(target, 'shock')) log.push({ t: 'status-apply', side: (1 - side) as Side, kind: 'shock' });
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
  const bind = has(c, 'bind');
  for (const s of [...c.statuses]) {
    const meta = STATUS_META[s.kind];
    let dot = meta.dotPercent;
    if (s.kind === 'poison') dot = 0.03 + s.age * 0.02;
    if (dot > 0) {
      let dmg = Math.max(1, Math.round(c.maxHp * dot));
      if (s.kind === 'burn' && bind) dmg = Math.round(dmg * 1.4);
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
    moveIds: [...c.moveIds],
    statuses: c.statuses.map((s) => ({ ...s })),
    cooldowns: { ...c.cooldowns },
    stanceMoves: { ...c.stanceMoves },
  };
}

// ---------- CPU ----------

/** ソロ相手の構え。単純ルール＋シード乱数。三すくみは基本ランダム＋クセ。 */
export function cpuClashStance(state: ClashState, side: Side, rng: Rng): ClashStance {
  const me = state.combatants[side];
  const foe = state.combatants[1 - side as Side];
  const myPct = me.hp / me.maxHp;
  const foePct = foe.hp / foe.maxHp;

  if (koseiReady(me)) {
    const offensive = !KOSEI_SUPPORT.has(kosei(me).active.kind);
    if (offensive && foePct < 0.4 && rng() < 0.6) return 'kosei';
    if (!offensive && myPct < 0.55 && rng() < 0.5) return 'kosei';
    if (offensive && state.turn >= 3 && rng() < 0.2) return 'kosei';
  }
  // 得意カテゴリ（代表わざの威力が高い所）に寄せつつ、読まれないよう散らす
  const strength = (cat: TriStance) => rankCategory(me.moveIds, cat)[0].power;
  const best = (['power', 'tech', 'speed'] as TriStance[]).sort((a, b) => strength(b) - strength(a))[0];
  const r = rng();
  if (r < 0.5) return best;
  if (r < 0.75) return 'power';
  if (r < 0.9) return 'speed';
  return 'tech';
}

export function playClashToEnd(state: ClashState, seed = state.seed): ClashState {
  let cur = state;
  let guard = 0;
  while (!cur.done && guard++ < 60) {
    const rng = mulberry32((seed + cur.turn * 7919) >>> 0);
    const s0 = cpuClashStance(cur, 0, rng);
    const s1 = cpuClashStance(cur, 1, rng);
    cur = resolveClashTurn(cur, [s0, s1]);
  }
  return cur;
}
