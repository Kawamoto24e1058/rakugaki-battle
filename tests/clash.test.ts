import { describe, expect, it } from 'vitest';
import { analyzeImageData } from '../src/engine/analyze';
import { getMove, MOVES } from '../src/engine/moves';
import { rectImage } from './helpers';
import {
  createClashState,
  resolveClashTurn,
  dealHand,
  cpuChoose,
  playClashToEnd,
  koseiReady,
  forcedChoice,
  HAND_SIZE,
  type ClashState,
  type ClashEvent,
} from '../src/engine/battle/clash';
import { mulberry32 } from '../src/engine/rng';

function drawn(color: [number, number, number], w = 80, h = 90) {
  return analyzeImageData(rectImage(220, 220, w, h, color)).character;
}

const acts = (log: ClashEvent[]) => log.filter((e): e is Extract<ClashEvent, { t: 'act' }> => e.t === 'act');

describe('手札バトル', () => {
  it('手札：毎ターン3枚・重複なし・同じ状態なら同じ手札（UIが先に見せられる）', () => {
    const st = createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), 11);
    for (const side of [0, 1] as const) {
      const h = dealHand(st, side);
      expect(h.length).toBe(HAND_SIZE);
      expect(new Set(h).size).toBe(HAND_SIZE);
      expect(dealHand(st, side)).toEqual(h);
      for (const id of h) if (id !== 'kosei') expect(MOVES[id]).toBeTruthy();
    }
    // ターンが進むと手札が変わる
    const t1 = dealHand(st, 0).join();
    let changed = false;
    let cur: ClashState = st;
    for (let i = 0; i < 4 && !cur.done; i++) {
      cur = resolveClashTurn(cur, [dealHand(cur, 0)[0], dealHand(cur, 1)[0]]);
      if (!cur.done && dealHand(cur, 0).join() !== t1) changed = true;
    }
    expect(changed).toBe(true);
  });

  it('手札はキャラの絵（属性・形）に左右されず、ぜんぶのワザから配られる', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const st = createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), seed);
      for (const id of dealHand(st, 0)) seen.add(id);
    }
    expect(seen.size).toBeGreaterThan(Object.keys(MOVES).length * 0.6);
  });

  it('性格：あばれん坊は こうげきわざ、おだやかは ほじょわざが 出やすい', () => {
    const atkShare = (personality: 'aggressive' | 'calm') => {
      const c = drawn([210, 40, 30]);
      c.personality = personality;
      let atk = 0;
      let n = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const st = createClashState(c, c, seed);
        for (const id of dealHand(st, 0)) {
          if (id === 'kosei') continue;
          n++;
          if (getMove(id).category === 'attack') atk++;
        }
      }
      return atk / n;
    };
    expect(atkShare('aggressive')).toBeGreaterThan(atkShare('calm') + 0.1);
  });

  it('こせい：使えるとき ときどき手札に混ざる／使えないときは混ざらない', () => {
    let withKosei = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const st = createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), seed);
      if (dealHand(st, 0).includes('kosei')) withKosei++;
    }
    expect(withKosei).toBeGreaterThan(20);
    expect(withKosei).toBeLessThan(120);

    const st = createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), 5);
    st.combatants[0].koseiCd = 3;
    for (let t = 1; t <= 40; t++) {
      st.turn = t;
      expect(dealHand(st, 0)).not.toContain('kosei');
    }
  });

  it('決定論：同じシード・同じ選択なら結果が完全一致', () => {
    const run = () => {
      const l = drawn([210, 40, 30]);
      const r = drawn([30, 90, 210]);
      return playClashToEnd(createClashState(l, r, 77)).log;
    };
    expect(run()).toEqual(run());
  });

  it('バトルは必ず決着する（CPU 同士・いろんなシード）', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const l = drawn([(seed * 53) % 256, (seed * 97) % 256, 60], 50 + (seed % 50), 60 + (seed % 60));
      const r = drawn([(seed * 29) % 256, 90, (seed * 71) % 256], 70 + (seed % 40), 50 + (seed % 70));
      const end = playClashToEnd(createClashState(l, r, seed));
      expect(end.done).toBe(true);
      expect(end.winner).not.toBeNull();
    }
  });

  it('選んだ技がそのまま発動する（技ID直接）', () => {
    const st = resolveClashTurn(
      createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), 3),
      ['c_tackle', 'c_scratch'],
    );
    const names = acts(st.log).map((e) => e.moveName);
    expect(names).toContain(getMove('c_tackle').name);
    expect(names).toContain(getMove('c_scratch').name);
    // 行動順のイベントが出る（すばやさ比べの演出用）
    const ord = st.log.find((e) => e.t === 'order');
    expect(ord && ord.t === 'order' && ord.spd.length).toBe(2);
    // 行動イベントに技IDが入る
    expect(acts(st.log).map((e) => e.moveId)).toEqual(expect.arrayContaining(['c_tackle', 'c_scratch']));
  });

  it('行動順：すばやさが高い方が先／まもり系・先制技は先に動く', () => {
    const slow = drawn([210, 40, 30]);
    const fast = drawn([30, 90, 210]);
    slow.baseStats = { ...slow.baseStats, spd: 14 };
    fast.baseStats = { ...fast.baseStats, spd: 50 };
    let st = resolveClashTurn(createClashState(slow, fast, 4), ['c_tackle', 'c_tackle']);
    expect(acts(st.log)[0].side).toBe(1);
    // 遅い側が まもる（先に動く）
    st = resolveClashTurn(createClashState(slow, fast, 4), ['c_guard', 'c_tackle']);
    expect(acts(st.log)[0].side).toBe(0);
    // 遅い側が 先制技
    st = resolveClashTurn(createClashState(slow, fast, 4), ['sm_dart', 'c_tackle']);
    expect(acts(st.log)[0].side).toBe(0);
  });

  it('ガード：同じターンの相手の攻撃を大きく減らす（遅くても間に合う）', () => {
    const dmgOn = (guard: boolean, seed: number) => {
      const a = drawn([210, 40, 30]);
      const b = drawn([30, 90, 210]);
      a.baseStats = { ...a.baseStats, spd: 50 };
      b.baseStats = { ...b.baseStats, spd: 14 };
      const st = resolveClashTurn(createClashState(a, b, seed), ['c_tackle', guard ? 'c_guard' : 'c_scratch']);
      return st.log.reduce((s, e) => (e.t === 'damage' && e.side === 1 ? s + e.amount : s), 0);
    };
    let plain = 0;
    let guarded = 0;
    for (let seed = 1; seed <= 30; seed++) {
      plain += dmgOn(false, seed);
      guarded += dmgOn(true, seed);
    }
    expect(guarded).toBeLessThan(plain * 0.7);
  });

  it('どく：毎ターン じわじわ減る', () => {
    const a = drawn([210, 40, 30]);
    const b = drawn([30, 150, 60]);
    let st = createClashState(a, b, 15);
    for (let i = 0; i < 14 && !st.done && !st.combatants[0].statuses.some((s) => s.kind === 'poison'); i++) {
      st = resolveClashTurn(st, ['c_scratch', 'wood_a2']);
    }
    if (st.combatants[0].statuses.some((s) => s.kind === 'poison') && !st.done) {
      const hp0 = st.combatants[0].hp;
      st = resolveClashTurn(st, ['c_scratch', 'c_scratch']);
      const tick = st.log.some((e) => e.t === 'status-tick' && e.side === 0 && e.kind === 'poison');
      expect(tick || st.combatants[0].hp < hp0).toBe(true);
    }
  });

  it('こせいを選ぶと 必ず先に発動し、クールダウン／回数を消費する', () => {
    const l = drawn([210, 40, 30]);
    const r = drawn([30, 90, 210]);
    r.baseStats = { ...r.baseStats, spd: 60 };
    const st0 = createClashState(l, r, 8);
    expect(koseiReady(st0.combatants[0])).toBe(true);
    const st = resolveClashTurn(st0, ['kosei', 'c_tackle']);
    const a = acts(st.log);
    expect(a[0].side).toBe(0);
    expect(a[0].kind).toBe('kosei');
    const c0 = st.combatants[0];
    expect(c0.koseiCd > 0 || c0.koseiUses < 99).toBe(true);
  });

  it('使えないこせいを選んでも 手札の技が出る（固まらない）', () => {
    const st0 = createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), 8);
    st0.combatants[0].koseiCd = 5;
    const st = resolveClashTurn(st0, ['kosei', 'c_tackle']);
    expect(acts(st.log).some((e) => e.side === 0 && e.kind !== 'kosei')).toBe(true);
  });

  it('CPU は手札の中から選ぶ', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const st = createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), seed);
      const pick = cpuChoose(st, 1, mulberry32(seed));
      expect(dealHand(st, 1)).toContain(pick);
    }
  });

  it('同キャラ同士なら 左右の勝率はほぼ五分', () => {
    let wins0 = 0;
    let decided = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const c = drawn([210, 40, 30]);
      const end = playClashToEnd(createClashState(c, c, seed));
      if (end.winner === 0 || end.winner === 1) {
        decided++;
        if (end.winner === 0) wins0++;
      }
    }
    expect(wins0 / decided).toBeGreaterThan(0.35);
    expect(wins0 / decided).toBeLessThan(0.65);
  });

  it('ふいうち：相手が こうげきを選んだときだけ決まる／ほかは しっぱい', () => {
    const mk = () => createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), 21);
    const hit = resolveClashTurn(mk(), ['as_sucker', 'c_tackle']);
    expect(hit.log.some((e) => e.t === 'damage' && e.side === 1)).toBe(true);
    const miss = resolveClashTurn(mk(), ['as_sucker', 'c_guard']);
    expect(miss.log.some((e) => e.t === 'damage' && e.side === 1)).toBe(false);
    expect(acts(miss.log).some((e) => e.side === 0 && e.kind === 'blocked')).toBe(true);
  });

  it('れんぞくぎり：1回の行動で3回ダメージが入る', () => {
    const st = resolveClashTurn(
      createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), 5),
      ['sw_rapid', 'c_guard'],
    );
    const hits = st.log.filter((e) => e.t === 'damage' && e.side === 1).length;
    expect(hits).toBe(3);
  });

  it('とどめのキバ：弱った相手には 大きく効く', () => {
    const run = (hpPct: number) => {
      let total = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const st0 = createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), seed);
        st0.combatants[1].hp = Math.round(st0.combatants[1].maxHp * hpPct);
        const before = st0.combatants[1].hp;
        const st = resolveClashTurn(st0, ['fi_finish', 'c_guard']);
        total += before - st.combatants[1].hp;
      }
      return total;
    };
    expect(run(0.35)).toBeGreaterThan(run(0.9) * 1.3);
  });

  it('にじいろだま：ランダムな状態異常が付くことがある', () => {
    let any = false;
    for (let seed = 1; seed <= 40 && !any; seed++) {
      const st = resolveClashTurn(
        createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), seed),
        ['co_rainbow', 'c_scratch'],
      );
      any = st.log.some((e) => e.t === 'status-apply' && e.side === 1);
    }
    expect(any).toBe(true);
  });

  // ---------- 新しい仕組み ----------

  it('ため技：選んだターンは ダメージが出ず、つぎのターンに かならず はなつ（えらべない）', () => {
    const mk = () => createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), 31);
    let st = resolveClashTurn(mk(), ['ch_megapunch', 'c_scratch']);
    // 1ターン目：ダメージなし、ため中
    expect(st.log.some((e) => e.t === 'damage' && e.side === 1)).toBe(false);
    expect(st.combatants[0].charging).toBe('ch_megapunch');
    expect(forcedChoice(st, 0)).toBe('release');
    expect(forcedChoice(st, 1)).toBeNull();
    expect(acts(st.log).some((e) => e.side === 0 && e.kind === 'charge')).toBe(true);
    // 2ターン目：何を渡しても ためていた技が出る
    const before = st.log.length;
    st = resolveClashTurn(st, ['c_scratch', 'c_scratch']);
    const evs = st.log.slice(before);
    const rel = acts(evs).find((e) => e.side === 0);
    expect(rel?.release).toBe(true);
    expect(rel?.moveId).toBe('ch_megapunch');
    expect(st.combatants[0].charging).toBeNull();
    const dmg = evs.filter((e) => e.t === 'damage' && e.side === 1).reduce((sum, e) => sum + (e.t === 'damage' ? e.amount : 0), 0);
    expect(dmg).toBeGreaterThan(20);
  });

  it('ため技：ためている間は むぼうび（受けるダメージが ふえる）', () => {
    const total = (charge: boolean) => {
      let sum = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const a = drawn([210, 40, 30]);
        const b = drawn([30, 90, 210]);
        a.baseStats = { ...a.baseStats, spd: 14 };
        b.baseStats = { ...b.baseStats, spd: 50 };
        const st = resolveClashTurn(createClashState(a, b, seed), [charge ? 'ch_megapunch' : 'c_scratch', 'c_tackle']);
        sum += st.log.reduce((x, e) => (e.t === 'damage' && e.side === 0 ? x + e.amount : x), 0);
      }
      return sum;
    };
    expect(total(true)).toBeGreaterThan(total(false) * 1.15);
  });

  it('ため技：ねむりなどで うごけないと ためが きえる', () => {
    let st = resolveClashTurn(createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), 41), ['ch_megapunch', 'c_guard']);
    st.combatants[0].statuses.push({ kind: 'sleep', turnsLeft: 2, age: 0 });
    st = resolveClashTurn(st, ['c_scratch', 'c_scratch']);
    expect(st.combatants[0].charging).toBeNull();
    expect(st.log.some((e) => e.t === 'damage' && e.side === 1)).toBe(false);
  });

  it('コンボ：まえのターンの技で ダメージが のびる（bonus が出る）', () => {
    const dmgOf = (first: string) => {
      let sum = 0;
      let bonus = 0;
      for (let seed = 1; seed <= 30; seed++) {
        let st = createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), seed);
        st = resolveClashTurn(st, [first, 'c_guard']);
        const n = st.log.length;
        st = resolveClashTurn(st, ['c_onetwo', 'c_guard']);
        const evs = st.log.slice(n);
        bonus += evs.filter((e) => e.t === 'bonus' && e.side === 0).length;
        sum += evs.reduce((x, e) => (e.t === 'damage' && e.side === 1 ? x + e.amount : x), 0);
      }
      return { sum, bonus };
    };
    const hit = dmgOf('c_tackle'); // たたく → ワンツー
    const none = dmgOf('c_scratch');
    expect(hit.bonus).toBeGreaterThan(20);
    expect(none.bonus).toBe(0);
    expect(hit.sum).toBeGreaterThan(none.sum * 1.3);
  });

  it('条件：あいてが やけどなら もえひろがる が強い／ねらいのHP条件も効く', () => {
    const run = (burned: boolean) => {
      let sum = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const st0 = createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), seed);
        if (burned) st0.combatants[1].statuses.push({ kind: 'burn', turnsLeft: 4, age: 0 });
        const st = resolveClashTurn(st0, ['f_spread', 'c_guard']);
        sum += st.log.reduce((x, e) => (e.t === 'damage' && e.side === 1 ? x + e.amount : x), 0);
      }
      return sum;
    };
    expect(run(true)).toBeGreaterThan(run(false) * 1.4);
  });

  it('条件：あとに うごいたときだけ 強い（おくれてスパーク）', () => {
    const fast = drawn([210, 40, 30]);
    const slow = drawn([30, 90, 210]);
    fast.baseStats = { ...fast.baseStats, spd: 50 };
    slow.baseStats = { ...slow.baseStats, spd: 14 };
    // slow が side0 で使う → 後攻になる
    const st = resolveClashTurn(createClashState(slow, fast, 9), ['b_spark2', 'c_scratch']);
    expect(st.log.some((e) => e.t === 'bonus' && e.side === 0)).toBe(true);
    // fast が side0 で使う → 先攻なので ボーナスなし
    const st2 = resolveClashTurn(createClashState(fast, slow, 9), ['b_spark2', 'c_scratch']);
    expect(st2.log.some((e) => e.t === 'bonus')).toBe(false);
  });

  it('手札いじり：おにぎり→つぎの手札が4まい／てふだくずし→あいての手札が2まい', () => {
    let st = createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), 51);
    expect(dealHand(st, 0).length).toBe(3);
    st = resolveClashTurn(st, ['c_scratch', 'd_scramble']);
    expect(dealHand(st, 0).length).toBe(2); // あいてに へらされた
    expect(dealHand(st, 1).length).toBe(3);
    st = resolveClashTurn(st, ['c_scratch', 'c_scratch']);
    // 効果は1ターンだけ
    expect(dealHand(st, 0).length).toBe(3);
    // おにぎり単体
    let st2 = createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), 52);
    st2 = resolveClashTurn(st2, ['c_onigiri', 'c_scratch']);
    expect(dealHand(st2, 0).length).toBe(4);
  });

  it('手札いじり：みちびき→つぎの手札に こうげきが2まい以上／おまもり→かいふくが入る', () => {
    for (let seed = 1; seed <= 25; seed++) {
      let st = createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), seed);
      st = resolveClashTurn(st, ['c_gather', 'c_scratch']);
      const attacks = dealHand(st, 0).filter((id) => id !== 'kosei' && getMove(id).category === 'attack');
      expect(attacks.length).toBeGreaterThanOrEqual(2);
      let st2 = createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), seed);
      st2 = resolveClashTurn(st2, ['c_ward', 'c_scratch']);
      expect(dealHand(st2, 0).some((id) => id !== 'kosei' && (getMove(id).heal || getMove(id).cures))).toBe(true);
    }
  });

  it('補助の状態異常：ねむりのうた／どくのこな が あいてに かかることがある', () => {
    let sleep = 0;
    let poison = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const a = createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), seed);
      if (resolveClashTurn(a, ['d_lullaby', 'c_guard']).combatants[1].statuses.some((x) => x.kind === 'sleep')) sleep++;
      if (resolveClashTurn(a, ['k_powder', 'c_guard']).combatants[1].statuses.some((x) => x.kind === 'poison')) poison++;
    }
    expect(sleep).toBeGreaterThan(10);
    expect(poison).toBeGreaterThan(15);
  });
});
