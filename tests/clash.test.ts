import { describe, expect, it } from 'vitest';
import { analyzeImageData } from '../src/engine/analyze';
import { getMove, MOVES } from '../src/engine/moves';
import { rectImage } from './helpers';
import {
  createClashState,
  resolveClashTurn,
  moveCategory,
  koseiReady,
  cpuClashStance,
  playClashToEnd,
  STANCE_BEATS,
  type ClashState,
  type ClashStance,
  type TriStance,
} from '../src/engine/battle/clash';
import { mulberry32 } from '../src/engine/rng';

function drawn(color: [number, number, number], w = 80, h = 90) {
  return analyzeImageData(rectImage(220, 220, w, h, color)).character;
}

function scriptToEnd(state: ClashState, s0: ClashStance, s1: ClashStance): ClashState {
  let cur = state;
  let guard = 0;
  while (!cur.done && guard++ < 60) cur = resolveClashTurn(cur, [s0, s1]);
  return cur;
}

describe('力・技・速さ 三すくみ（プロトタイプ）', () => {
  it('わざのカテゴリ分け：属性3段は力、先制わざは速さ、補助は技', () => {
    expect(moveCategory(getMove('fire_a3'))).toBe('power'); // 威力38
    expect(moveCategory(getMove('sw_great'))).toBe('power'); // 威力46
    expect(moveCategory(getMove('fire_a1'))).toBe('speed'); // 威力14の弱い属性技
    expect(moveCategory(getMove('ta_stretch'))).toBe('speed'); // 先制
    expect(moveCategory(getMove('sm_jab'))).toBe('speed'); // 威力12
    expect(moveCategory(getMove('c_guard'))).toBe('tech'); // 補助
    expect(moveCategory(getMove('ey_glare'))).toBe('tech'); // デバフ補助
    expect(moveCategory(getMove('ey_see'))).toBe('tech'); // 貫通（みやぶり 威力22）
    expect(moveCategory(getMove('fire_a2'))).toBe('tech'); // 威力24＋状態異常
  });

  it('全わざがいずれかのカテゴリに入る', () => {
    const cats = new Set<TriStance>();
    for (const m of Object.values(MOVES)) cats.add(moveCategory(m));
    expect([...cats].sort()).toEqual(['power', 'speed', 'tech']);
  });

  it('決定論：同じシード・同じ構えなら結果が完全一致', () => {
    const l = drawn([210, 40, 30]);
    const r = drawn([30, 90, 210]);
    const a = scriptToEnd(createClashState(l, r, 123), 'power', 'tech');
    const b = scriptToEnd(createClashState(l, r, 123), 'power', 'tech');
    expect(a.combatants[0].hp).toBe(b.combatants[0].hp);
    expect(a.combatants[1].hp).toBe(b.combatants[1].hp);
    expect(a.winner).toBe(b.winner);
    expect(a.log.length).toBe(b.log.length);
  });

  it('三すくみのクラッシュはステータス・属性に依存しない（構えだけで決まる）', () => {
    // 弱いキャラ vs 強いキャラでも、速さ vs 力 なら必ず速さ側がクラッシュ勝ち
    const weak = drawn([200, 200, 200], 30, 30); // 小さい灰色
    const strong = drawn([220, 30, 20], 140, 150); // 大きい赤
    for (const [a, b] of [[weak, strong], [strong, weak]] as const) {
      const st = resolveClashTurn(createClashState(a, b, 5), ['speed', 'power']);
      const clash = st.log.find((e) => e.t === 'clash');
      expect(clash).toBeDefined();
      if (clash && clash.t === 'clash') expect(clash.winner).toBe(0); // 速さ側（side 0）が勝つ
    }
  });

  it('三すくみに負けた側は 技を発動できない（見切られる）', () => {
    const l = drawn([210, 40, 30]);
    const r = drawn([30, 90, 210]);
    // side0=力、side1=速さ → 速さが勝ち、力（side0）は発動できない
    const st = resolveClashTurn(createClashState(l, r, 21), ['power', 'speed']);
    const evs = st.log.slice(0);
    const act0 = evs.find((e) => e.t === 'act' && e.side === 0);
    expect(act0 && act0.t === 'act' && act0.moveName.startsWith('（')).toBe(true);
    // side1（速さ・勝者）は普通に行動し、side0 にダメージが入る
    const dmgToLoser = evs.some((e) => e.t === 'damage' && e.side === 0 && e.amount > 0);
    expect(dmgToLoser).toBe(true);
    // 勝者（速さ）はこのターン ノーダメージ（力は発動していないので）
    const dmgFromLoser = evs.some((e) => e.t === 'damage' && e.side === 1 && (e.tag === null || e.tag === 'かすった' || e.tag === 'クリティカル' || e.tag === 'ばつぐん'));
    expect(dmgFromLoser).toBe(false);
  });

  it('サイクル：速さ→力→技→速さ が正しい', () => {
    expect(STANCE_BEATS.speed).toBe('power');
    expect(STANCE_BEATS.power).toBe('tech');
    expect(STANCE_BEATS.tech).toBe('speed');
    const l = drawn([210, 40, 30]);
    const r = drawn([30, 90, 210]);
    const pairs: [TriStance, TriStance, 0 | 1 | null][] = [
      ['speed', 'power', 0],
      ['power', 'tech', 0],
      ['tech', 'speed', 0],
      ['power', 'speed', 1],
      ['power', 'power', null],
    ];
    for (const [s0, s1, want] of pairs) {
      const st = resolveClashTurn(createClashState(l, r, 9), [s0, s1]);
      const clash = st.log.find((e) => e.t === 'clash');
      if (clash && clash.t === 'clash') expect(clash.winner).toBe(want);
    }
  });

  it('同キャラ・同じ構えスクリプトなら勝率はほぼ五分（生成で有利不利が付かない）', () => {
    const a = drawn([210, 40, 30]);
    let wins0 = 0;
    let decided = 0;
    for (let seed = 0; seed < 120; seed++) {
      // 両者ランダムだが同じ乱数列で対称に選ぶ → side バイアスが無いことを見る
      let cur = createClashState(a, drawn([210, 40, 30]), seed);
      let g = 0;
      while (!cur.done && g++ < 50) {
        const rng = mulberry32((seed * 131 + cur.turn) >>> 0);
        const s0 = cpuClashStance(cur, 0, rng);
        const rng2 = mulberry32((seed * 131 + cur.turn) >>> 0);
        const s1 = cpuClashStance(cur, 1, rng2);
        cur = resolveClashTurn(cur, [s0, s1]);
      }
      if (cur.winner === 0 || cur.winner === 1) {
        decided++;
        if (cur.winner === 0) wins0++;
      }
    }
    expect(decided).toBeGreaterThan(85);
    const rate = wins0 / decided;
    expect(rate).toBeGreaterThan(0.35);
    expect(rate).toBeLessThan(0.65);
  });

  it('同一キャラ・ランダム構えで side バイアスが無い（左右対称）', () => {
    const opts: ClashStance[] = ['power', 'tech', 'speed'];
    let w0 = 0;
    let w1 = 0;
    for (let seed = 0; seed < 300; seed++) {
      let cur = createClashState(drawn([200, 40, 30]), drawn([200, 40, 30]), seed * 7 + 1);
      let g = 0;
      while (!cur.done && g++ < 50) {
        const rr = mulberry32((seed * 997 + cur.turn) >>> 0);
        cur = resolveClashTurn(cur, [opts[Math.floor(rr() * 3)], opts[Math.floor(rr() * 3)]]);
      }
      if (cur.winner === 0) w0++;
      else if (cur.winner === 1) w1++;
    }
    const rate = w0 / (w0 + w1);
    expect(rate).toBeGreaterThan(0.42);
    expect(rate).toBeLessThan(0.58);
  });

  it('三すくみの各対面に正しい優位がある（攻撃わざを持つ場合、速さ>力>技>速さ）', () => {
    const A = drawn([210, 40, 30]);
    const B = drawn([210, 40, 30]);
    // 各カテゴリに「攻撃わざ」を確実に持たせる（補助だけだと中断できない）
    for (const c of [A, B]) c.moveIds = ['c_tackle', 'c_bite', 'ey_see', 'sm_jab', 'sm_dart'];
    const rateOf = (x: ClashStance, y: ClashStance) => {
      let a = 0;
      let b = 0;
      for (let s = 0; s < 200; s++) {
        const end = scriptToEnd(createClashState(A, B, s * 11 + 1), x, y);
        if (end.winner === 0) a++;
        else if (end.winner === 1) b++;
      }
      return a / (a + b);
    };
    // 見切った側が必ず先に動ける＝そのカテゴリが有利（速さは技が弱いので伸びは控えめ）。
    expect(rateOf('speed', 'power')).toBeGreaterThan(0.5);
    expect(rateOf('power', 'tech')).toBeGreaterThan(0.55);
    expect(rateOf('tech', 'speed')).toBeGreaterThan(0.55);
  });

  it('バトルは必ず決着する（CPU 同士・いろんなシード）', () => {
    for (let seed = 0; seed < 40; seed++) {
      const end = playClashToEnd(
        createClashState(drawn([200 - seed, 40 + seed, 30]), drawn([30, 150 - seed, 60 + seed]), seed * 97 + 3),
      );
      expect(end.done).toBe(true);
      expect(end.winner === 0 || end.winner === 1 || end.winner === 'draw').toBe(true);
      expect(end.turn).toBeLessThanOrEqual(24);
    }
  });

  it('バトル長の中央値がだいたい 5〜16 ターン', () => {
    const lens: number[] = [];
    for (let seed = 0; seed < 60; seed++) {
      const l = drawn([200 - (seed % 60), 40 + (seed % 40), 30], 60 + (seed % 40), 80 + (seed % 30));
      const r = drawn([30, 150 - (seed % 50), 60 + (seed % 30)], 70 + (seed % 30), 90 + (seed % 40));
      lens.push(playClashToEnd(createClashState(l, r, seed * 53 + 7)).turn);
    }
    lens.sort((a, b) => a - b);
    const median = lens[Math.floor(lens.length / 2)];
    expect(median).toBeGreaterThanOrEqual(4);
    expect(median).toBeLessThanOrEqual(18);
  });

  it('使えないこせいを選んだら 力 に落ちる', () => {
    const l = drawn([210, 40, 30]);
    const r = drawn([30, 90, 210]);
    // こせいを使い切ってから もう一度こせいを選ぶ
    let cur = createClashState(l, r, 4);
    cur = resolveClashTurn(cur, ['kosei', 'power']);
    for (let i = 0; i < 4 && !cur.done && koseiReady(cur.combatants[0]); i++) {
      cur = resolveClashTurn(cur, ['kosei', 'power']);
    }
    if (!koseiReady(cur.combatants[0]) && !cur.done) {
      const after = resolveClashTurn(cur, ['kosei', 'power']);
      const rev = after.log.slice(cur.log.length).find((e) => e.t === 'reveal');
      if (rev && rev.t === 'reveal') expect(rev.stances[0]).toBe('power');
    }
  });

  it('技IDを直接えらべる：偏った編成（技2・速さ1、力なし）でも動く', () => {
    const a = drawn([210, 40, 30]);
    const b = drawn([30, 90, 210]);
    // 力なし・技/速さ編成を組む
    const tech = Object.values(MOVES).find((m) => moveCategory(m) === 'tech' && m.category === 'attack')!;
    const tech2 = Object.values(MOVES).find((m) => moveCategory(m) === 'tech' && m.id !== tech.id)!;
    const speed = Object.values(MOVES).find((m) => moveCategory(m) === 'speed')!;
    a.moveIds = [tech.id, tech2.id, speed.id];
    b.moveIds = [speed.id, tech.id];
    let st = createClashState(a, b, 3);
    // side0 が「技ID を直接」えらぶ → その技が出る
    st = resolveClashTurn(st, [tech.id, speed.id]);
    const act0 = st.log.find((e) => e.t === 'act' && e.side === 0);
    expect(act0 && act0.t === 'act' && (act0.moveName === tech.name || act0.stance === 'tech')).toBe(true);
    // 別の技IDを指定すると別の技が出る
    if (!st.done) {
      const before = st.log.length;
      st = resolveClashTurn(st, [tech2.id, 'speed']);
      const act = st.log.slice(before).find((e) => e.t === 'act' && e.side === 0);
      expect(act && act.t === 'act').toBe(true);
    }
  });

  it('こせいは三すくみと無関係：クラッシュ判定が出ない・相手はふつうに行動', () => {
    const l = drawn([210, 40, 30]);
    const r = drawn([30, 90, 210]);
    const st = resolveClashTurn(createClashState(l, r, 33), ['kosei', 'power']);
    const evs = st.log.slice(0);
    expect(evs.some((e) => e.t === 'clash')).toBe(false);
    // side1（力）は「見切られて うごけない」ではなく、ちゃんと技を出す
    const act1 = evs.find((e) => e.t === 'act' && e.side === 1);
    expect(act1 && act1.t === 'act' && !act1.moveName.startsWith('（')).toBe(true);
  });

  it('補助わざが勝っても 相手は中断されない（補助技は攻撃しない）', () => {
    const a = drawn([210, 40, 30]);
    const b = drawn([30, 90, 210]);
    a.moveIds = ['c_guard', 'c_tackle', 'sm_jab']; // 技枠は c_guard（補助）
    b.moveIds = ['c_tackle', 'sm_jab', 'sm_dart'];
    // side0 技(ガード) vs side1 速さ → 技が勝つが 補助なので side1 は動ける
    const st = resolveClashTurn(createClashState(a, b, 6), ['c_guard', 'sm_dart']);
    const act1 = st.log.find((e) => e.t === 'act' && e.side === 1);
    expect(act1 && act1.t === 'act' && !act1.moveName.startsWith('（')).toBe(true);
    // side0 は ガードを張っただけ（相手にダメージを与えていない）
    const dmgToFoe = st.log.some((e) => e.t === 'damage' && e.side === 1 && e.amount > 0);
    expect(dmgToFoe).toBe(false);
  });

  it('毒：毎ターン じわじわ減る', () => {
    const a = drawn([210, 40, 30]);
    const b = drawn([30, 150, 60]);
    b.moveIds = ['wood_a2', 'c_tackle', 'sm_jab']; // どく技
    a.moveIds = ['c_tackle', 'c_bite', 'sm_jab'];
    let st = createClashState(a, b, 15);
    // side1 が どく技(技カテゴリ) を当てるまで回す
    for (let i = 0; i < 12 && !st.done && !st.combatants[0].statuses.some((s) => s.kind === 'poison'); i++) {
      st = resolveClashTurn(st, ['c_tackle', 'wood_a2']);
    }
    if (st.combatants[0].statuses.some((s) => s.kind === 'poison') && !st.done) {
      const hp0 = st.combatants[0].hp;
      st = resolveClashTurn(st, ['c_tackle', 'c_tackle']); // 五分（毒 tick だけ見る）
      const tick = st.log.some((e) => e.t === 'status-tick' && e.side === 0 && e.kind === 'poison');
      expect(tick || st.combatants[0].hp < hp0).toBe(true);
    }
  });

  it('ガード（guardPct技）は 受けるダメージを大きく減らす', () => {
    // side1 が ガード → 次に side0 の攻撃ダメージが素の半分くらいになる
    const atkr = drawn([210, 40, 30]);
    const gd = drawn([30, 90, 210]);
    atkr.moveIds = ['c_tackle', 'c_scratch', 'sm_jab'];
    gd.moveIds = ['c_guard', 'c_tackle', 'sm_jab'];

    const dmgOn = (guardFirst: boolean) => {
      let st = createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), 4);
      st.combatants[0].moveIds = [...atkr.moveIds];
      st.combatants[1].moveIds = [...gd.moveIds];
      if (guardFirst) {
        // side1 が 技(ガード) で 速さ に勝って ガードを張る
        st = resolveClashTurn(st, ['sm_jab', 'c_guard']);
      }
      const n = st.log.length;
      const before = st.combatants[1].hp;
      // 力 vs 力 の五分 → 両者行動 → side0 の たいあたり が side1 に当たる
      st = resolveClashTurn(st, ['c_tackle', 'c_tackle']);
      const dmg = st.log.slice(n).find((e) => e.t === 'damage' && e.side === 1);
      return dmg && dmg.t === 'damage' ? dmg.amount : before - st.combatants[1].hp;
    };
    const plain = dmgOn(false);
    const guarded = dmgOn(true);
    expect(guarded).toBeLessThan(plain * 0.7);
  });

  it('こせいは必ず先制（相手より先に行動する）', () => {
    const l = drawn([210, 40, 30]);
    const r = drawn([30, 90, 210]);
    const st = resolveClashTurn(createClashState(l, r, 8), ['kosei', 'power']);
    const acts = st.log.filter((e): e is Extract<typeof e, { t: 'act' }> => e.t === 'act');
    expect(acts[0]?.side).toBe(0);
    expect(acts[0]?.stance).toBe('kosei');
  });

  it('通常わざにクールダウンは無い（同じ技を連発できる）', () => {
    const a = drawn([210, 40, 30]);
    const b = drawn([30, 90, 210]);
    const bite = getMove('c_bite'); // 旧 cooldown 1
    a.moveIds = [bite.id, 'c_scratch', 'sm_jab'];
    let st = createClashState(a, b, 2);
    for (let i = 0; i < 3 && !st.done; i++) {
      const before = st.log.length;
      st = resolveClashTurn(st, [bite.id, 'speed']);
      const acted = st.log.slice(before).some((e) => e.t === 'act' && e.side === 0 && e.moveName === bite.name);
      // 力 vs 速さ で負けなければ bite が出続ける（CD で別技/基本技に落ちない）
      const lost = st.log.slice(before).some((e) => e.t === 'act' && e.side === 0 && e.moveName.startsWith('（'));
      expect(acted || lost).toBe(true);
    }
  });

  it('こせい構え：発動してクールダウン/回数を消費する', () => {
    const l = drawn([210, 40, 30]);
    const r = drawn([30, 90, 210]);
    const cur = resolveClashTurn(createClashState(l, r, 7), ['kosei', 'power']);
    const c0 = cur.combatants[0];
    expect(c0.koseiCd > 0 || c0.koseiUses < 99).toBe(true);
    const acted = cur.log.some((e) => e.t === 'act' && e.side === 0 && e.stance === 'kosei');
    expect(acted).toBe(true);
  });
});
