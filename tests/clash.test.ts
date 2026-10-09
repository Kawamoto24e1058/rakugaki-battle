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

  // ---------- とくしゅわざ ----------
  const mk = (seed: number, a = drawn([210, 40, 30]), b = drawn([30, 90, 210])) => createClashState(a, b, seed);
  const dmgTo = (st: ClashState, side: 0 | 1) => st.log.reduce((x, e) => (e.t === 'damage' && e.side === side ? x + e.amount : x), 0);

  it('場の効果：あまごいで みず技が強く ほのお技が弱くなり、4ターンで消える', () => {
    const run = (rain: boolean, move: string) => {
      let total = 0;
      for (let seed = 1; seed <= 30; seed++) {
        let st = mk(seed);
        if (rain) st = resolveClashTurn(st, ['f_rain', 'c_scratch']);
        const n = st.log.length;
        st = resolveClashTurn(st, [move, 'c_guard']);
        total += st.log.slice(n).reduce((x, e) => (e.t === 'damage' && e.side === 1 ? x + e.amount : x), 0);
      }
      return total;
    };
    expect(run(true, 'w_gun')).toBeGreaterThan(run(false, 'w_gun') * 1.2);
    expect(run(true, 'f_spark')).toBeLessThan(run(false, 'f_spark') * 0.97);
    let st = resolveClashTurn(mk(3), ['f_rain', 'c_scratch']);
    expect(st.field?.kind).toBe('rain');
    for (let i = 0; i < 4; i++) st = resolveClashTurn(st, ['c_scratch', 'c_scratch']);
    expect(st.field).toBeNull();
    expect(st.log.some((e) => e.t === 'field-end')).toBe(true);
    // べつの天気で おきかわる
    const sun = resolveClashTurn(resolveClashTurn(mk(4), ['f_rain', 'c_scratch']), ['f_sun', 'c_scratch']);
    expect(sun.field?.kind).toBe('sun');
  });

  it('バリア：HPのかわりに ダメージを うけ、HPを はらうコストがある', () => {
    let st = mk(11);
    st = resolveClashTurn(st, ['c_scratch', 'br_sub']);
    const c1 = st.combatants[1];
    expect(c1.barrier?.amount).toBeGreaterThan(c1.maxHp * 0.3);
    expect(c1.hp).toBeLessThan(c1.maxHp); // コスト
    const hpBefore = c1.hp;
    const n = st.log.length;
    st = resolveClashTurn(st, ['c_bite', 'c_scratch']);
    const evs = st.log.slice(n);
    expect(evs.some((e) => e.t === 'barrier-hit' && e.side === 1)).toBe(true);
    expect(st.combatants[1].hp).toBeGreaterThanOrEqual(hpBefore - 3);
  });

  it('時限：じげんばくだん は 2ターンあとに あいてへ大ダメージ／おくりものは かいふく', () => {
    let st = resolveClashTurn(mk(12), ['tm_bomb', 'c_scratch']);
    expect(st.log.some((e) => e.t === 'timer')).toBe(false);
    st = resolveClashTurn(st, ['c_scratch', 'c_scratch']);
    expect(st.log.some((e) => e.t === 'timer' && e.side === 0 && e.kind === 'damage')).toBe(true);
    let g = mk(13);
    g.combatants[0].hp = Math.round(g.combatants[0].maxHp * 0.4);
    g = resolveClashTurn(g, ['tm_gift', 'c_scratch']);
    g = resolveClashTurn(g, ['c_scratch', 'c_scratch']);
    expect(g.log.some((e) => e.t === 'timer' && e.kind === 'heal')).toBe(true);
  });

  it('わな：まきびしを 仕掛けられた側が こうげきすると ダメージを受ける', () => {
    let st = resolveClashTurn(mk(14), ['tm_trap', 'c_scratch']);
    const n = st.log.length;
    st = resolveClashTurn(st, ['c_guard', 'c_tackle']);
    expect(st.log.slice(n).some((e) => e.t === 'trap' && e.side === 1)).toBe(true);
    // こうげきしなければ ひっかからない
    let st2 = resolveClashTurn(mk(14), ['tm_trap', 'c_scratch']);
    const n2 = st2.log.length;
    st2 = resolveClashTurn(st2, ['c_guard', 'ca_heal']);
    expect(st2.log.slice(n2).some((e) => e.t === 'trap')).toBe(false);
  });

  it('みちづれ／ふんばり', () => {
    // ふんばり：致命傷でも HP1で のこる
    const a = mk(15);
    a.combatants[0].hp = 3;
    const r = resolveClashTurn(a, ['sc_endure', 'c_bite']);
    expect(r.combatants[0].hp).toBeGreaterThanOrEqual(1);
    expect(r.done).toBe(false);
    expect(r.log.some((e) => e.t === 'damage' && e.side === 0 && e.tag === 'ふんばった！')).toBe(true);
    // みちづれ：やられたら あいても ダメージ
    let hit = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const b = mk(seed);
      b.combatants[0].hp = 2;
      const rr = resolveClashTurn(b, ['sc_bond', 'c_bite']);
      if (rr.log.some((e) => e.t === 'damage' && e.side === 1 && e.tag === 'みちづれ')) hit++;
    }
    expect(hit).toBeGreaterThan(5);
  });

  it('いのちがけ：HPをはらうが 1より下には ならない', () => {
    const st0 = mk(16);
    st0.combatants[0].hp = 5;
    const st = resolveClashTurn(st0, ['sc_life', 'c_guard']);
    expect(st.combatants[0].hp).toBeGreaterThanOrEqual(1);
    const st1 = resolveClashTurn(mk(16), ['sc_life', 'c_guard']);
    expect(st1.log.some((e) => e.t === 'damage' && e.side === 0 && e.tag === 'いのちをけずった')).toBe(true);
  });

  it('まねっこ：あいてが えらんだ技を そのまま つかう', () => {
    const st = resolveClashTurn(mk(17), ['cp_copy', 'c_bite']);
    const a = acts(st.log).find((e) => e.side === 0);
    expect(a?.moveId).toBe('c_bite');
    expect(a?.moveName).toContain('まね');
    expect(dmgTo(st, 1)).toBeGreaterThan(0);
    // こせいは まねできない
    const f = resolveClashTurn(mk(17), ['cp_copy', 'kosei']);
    expect(acts(f.log).some((e) => e.side === 0 && e.kind === 'blocked')).toBe(true);
  });

  it('いれかえ：HPのわりあい／じょうたいいじょう／強化', () => {
    const st0 = mk(18);
    st0.combatants[0].hp = Math.round(st0.combatants[0].maxHp * 0.2);
    st0.combatants[1].hp = st0.combatants[1].maxHp;
    const st = resolveClashTurn(st0, ['sw_heart', 'c_guard']);
    expect(st.combatants[0].hp / st.combatants[0].maxHp).toBeGreaterThan(0.8);
    expect(st.combatants[1].hp / st.combatants[1].maxHp).toBeLessThan(0.35);

    const d = mk(19);
    d.combatants[0].statuses.push({ kind: 'poison', turnsLeft: 4, age: 0 });
    const dr = resolveClashTurn(d, ['sw_dump', 'c_guard']);
    expect(dr.combatants[0].statuses.some((x) => x.kind === 'poison')).toBe(false);
    expect(dr.combatants[1].statuses.some((x) => x.kind === 'poison')).toBe(true);

    const t = mk(20);
    t.combatants[1].statuses.push({ kind: 'atkUp', turnsLeft: 3, age: 0 });
    const tr = resolveClashTurn(t, ['sw_steal', 'c_scratch']);
    expect(tr.combatants[0].statuses.some((x) => x.kind === 'atkUp')).toBe(true);
    expect(tr.combatants[1].statuses.some((x) => x.kind === 'atkUp')).toBe(false);
  });

  it('ギャンブル：さいころの目で威力が変わる／コインは おもて・うら／いちかばちかは当たり外れ', () => {
    const dice = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const st = resolveClashTurn(mk(seed), ['gm_dice', 'c_guard']);
      for (const e of st.log) if (e.t === 'bonus' && e.label.startsWith('さいころの目')) dice.add(Number(e.label.split('：')[1]));
    }
    expect(dice.size).toBeGreaterThanOrEqual(4);
    let heads = 0;
    let tails = 0;
    let wins = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const c = resolveClashTurn(mk(seed), ['gm_coin', 'c_guard']);
      if (c.log.some((e) => e.t === 'bonus' && e.label === 'おもて！')) heads++;
      if (c.log.some((e) => e.t === 'bonus' && e.label === 'うら…')) tails++;
      const a = resolveClashTurn(mk(seed), ['gm_all', 'c_guard']);
      if (a.log.some((e) => e.t === 'bonus' && e.label === 'だいせいこう！')) wins++;
    }
    expect(heads).toBeGreaterThan(15);
    expect(tails).toBeGreaterThan(15);
    expect(wins).toBeGreaterThan(14);
    expect(wins).toBeLessThan(42);
  });

  it('みきり：こうげきを みやぶって はんげき（こうげきでなければ からぶり）', () => {
    const st = resolveClashTurn(mk(21), ['fc_read', 'c_bite']);
    expect(acts(st.log).some((e) => e.side === 1 && e.kind === 'blocked')).toBe(true);
    expect(dmgTo(st, 1)).toBeGreaterThan(0);
    expect(dmgTo(st, 0)).toBe(0);
    const miss = resolveClashTurn(mk(21), ['fc_read', 'c_guard']);
    expect(miss.log.some((e) => e.t === 'bonus' && e.label.includes('からぶり'))).toBe(true);
  });

  it('手札を縛る：ふうじは そのカードが出なくなる／ちょうはつは こうげきだけ', () => {
    for (let seed = 1; seed <= 25; seed++) {
      let st = mk(seed);
      st = resolveClashTurn(st, ['cp_nobig', 'c_scratch']);
      for (const id of dealHand(st, 1)) {
        if (id === 'kosei') continue;
        const m = getMove(id);
        expect(m.charge || (m.category === 'attack' && m.power >= 34)).toBeFalsy();
      }
      let t = mk(seed);
      t = resolveClashTurn(t, ['fc_taunt', 'c_scratch']);
      for (const id of dealHand(t, 1)) if (id !== 'kosei') expect(getMove(id).category).toBe('attack');
    }
  });
});
