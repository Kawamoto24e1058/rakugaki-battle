import { describe, expect, it } from 'vitest';
import { analyzeImageData } from '../src/engine/analyze';
import { assignMoveSet, getMove, moveTags, MOVES } from '../src/engine/moves';
import { rectImage } from './helpers';
import {
  createClashState,
  resolveClashTurn,
  pickMoveFor,
  playClashToEnd,
  koseiReady,
  forcedChoice,
  type ClashState,
  type ClashEvent,
} from '../src/engine/battle/clash';
import { mulberry32 } from '../src/engine/rng';

function drawn(color: [number, number, number], w = 80, h = 90) {
  return analyzeImageData(rectImage(220, 220, w, h, color)).character;
}

const acts = (log: ClashEvent[]) => log.filter((e): e is Extract<ClashEvent, { t: 'act' }> => e.t === 'act');

describe('手札バトル', () => {
  it('技：キャラは4つの技をもち、毎ターン その中から1つ出る（同じ状態なら同じ技）', () => {
    const a = drawn([210, 40, 30]);
    expect(a.moveIds.length).toBe(4);
    expect(new Set(a.moveIds).size).toBe(4);
    let st = createClashState(a, drawn([30, 90, 210]), 11);
    const seen = new Set<string>();
    for (let i = 0; i < 20 && !st.done; i++) {
      const p0 = pickMoveFor(st, 0);
      expect(pickMoveFor(st, 0)).toBe(p0);
      if (p0 !== 'kosei' && p0 !== 'release') {
        expect(a.moveIds).toContain(p0);
        seen.add(p0);
      }
      st = resolveClashTurn(st, [p0, pickMoveFor(st, 1)]);
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('技の割り振り：同じ絵なら同じ技、いろんな絵で いろんな技が出る', () => {
    expect(drawn([210, 40, 30]).moveIds).toEqual(drawn([210, 40, 30]).moveIds);
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) for (const id of drawn([(i * 53) % 256, (i * 97) % 256, (i * 29) % 256], 40 + (i % 60), 50 + ((i * 7) % 60)).moveIds) seen.add(id);
    expect(seen.size).toBeGreaterThan(40);
  });

  it('技の割り振り：属性のこうげきを かならず もち、理由が つく', () => {
    for (let i = 0; i < 40; i++) {
      const c = drawn([(i * 53) % 256, (i * 97) % 256, (i * 29) % 256], 40 + (i % 60), 50 + ((i * 7) % 60));
      const ms = c.moveIds.map((id) => getMove(id));
      expect(ms.some((m) => m.category === 'attack' && m.attribute === c.attribute)).toBe(true);
      expect(c.moveReasons?.length).toBe(4);
      for (const r of c.moveReasons!) expect(r.length).toBeGreaterThan(0);
    }
  });

  it('技の割り振り：絵の特徴で かたよる（トゲ・あらっぽい＝こうげき多め／まる・おだやか＝ほじょ多め）', () => {
    const stats = (atk: number, def: number) => ({ hp: 90, atk, def, spd: 35, luck: 30, heart: 30 });
    let fierce = 0;
    let calm = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const a = assignMoveSet({ seed, attribute: 'fire', personality: 'aggressive', tags: ['shape:spiky', 'mood:fierce'], weapon: 'sword', stats: stats(55, 25) });
      const b = assignMoveSet({ seed, attribute: 'water', personality: 'calm', tags: ['shape:round', 'mood:calm'], weapon: 'shield', stats: stats(25, 55) });
      fierce += a.filter((s) => getMove(s.id).category === 'attack').length;
      calm += b.filter((s) => getMove(s.id).category === 'attack').length;
    }
    expect(fierce / 60).toBeGreaterThan(3.3);
    expect(calm / 60).toBeLessThan(2.3);
  });

  it('技の割り振り：つばさの絵には 先制・かぜの技が 入りやすい', () => {
    let quick = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const set = assignMoveSet({ seed, attribute: 'bolt', personality: 'aggressive', tags: ['part:wings'], weapon: 'wing' });
      if (set.some((s) => getMove(s.id).first || getMove(s.id).tags?.includes('wind'))) quick++;
    }
    expect(quick).toBeGreaterThan(50);
  });

  it('技の割り振り：コンボ技には あいぼうの技も入る', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const ms = assignMoveSet({ seed, attribute: (['fire', 'water', 'wood', 'bolt', 'dark'] as const)[seed % 5], personality: seed % 2 ? 'calm' : 'aggressive', tags: ['deco:colorful'] }).map((s) => getMove(s.id));
      for (const m of ms) {
        if (m.when?.t === 'prev') {
          const tag = m.when.tag;
          expect(ms.some((x) => x.id !== m.id && moveTags(x).includes(tag))).toBe(true);
        }
      }
    }
  });

  it('こせい：使えるとき ときどき技のかわりに出る／使えないときは出ない', () => {
    let withKosei = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const st = createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), seed);
      if (pickMoveFor(st, 0) === 'kosei') withKosei++;
    }
    expect(withKosei).toBeGreaterThan(15);
    expect(withKosei).toBeLessThan(90);
    const st = createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), 5);
    st.combatants[0].koseiCd = 3;
    for (let t = 1; t <= 40; t++) {
      st.turn = t;
      expect(pickMoveFor(st, 0)).not.toBe('kosei');
    }
  });

  it('ミニゲーム：勝った方が先に うごき 威力アップ、負けた方は 威力ダウン、パーフェクトは クリティカル', () => {
    const dmg = (mg: { winner: 0 | 1 | null; perfect: boolean }) => {
      let d0 = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const st = resolveClashTurn(createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), seed), ['c_tackle', 'c_tackle'], mg);
        d0 += st.log.reduce((x, e) => (e.t === 'damage' && e.side === 1 ? x + e.amount : x), 0);
      }
      return d0;
    };
    const win = dmg({ winner: 0, perfect: false });
    const lose = dmg({ winner: 1, perfect: false });
    expect(win).toBeGreaterThan(lose * 1.25);
    // 勝った方が先
    const st = resolveClashTurn(createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), 3), ['c_tackle', 'sm_dart'], { winner: 0, perfect: false });
    expect(acts(st.log)[0].side).toBe(0);
    const ord = st.log.find((e) => e.t === 'order');
    expect(ord && ord.t === 'order' && ord.reason).toBe('minigame');
    // パーフェクト：クリティカル
    const p = resolveClashTurn(createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), 4), ['c_tackle', 'c_guard'], { winner: 0, perfect: true });
    expect(p.log.some((e) => e.t === 'damage' && e.side === 1 && e.tag === 'クリティカル')).toBe(true);
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

  it('使えないこせいを選んでも キャラの技が出る（固まらない）', () => {
    const st0 = createClashState(drawn([210, 40, 30]), drawn([30, 90, 210]), 8);
    st0.combatants[0].koseiCd = 5;
    const st = resolveClashTurn(st0, ['kosei', 'c_tackle']);
    expect(acts(st.log).some((e) => e.side === 0 && e.kind !== 'kosei')).toBe(true);
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
    // かわされにくい ステータスに して、乱数で ダメージが ぶれないように
    const mk = () => {
      const a = drawn([210, 40, 30]);
      const b = drawn([30, 90, 210]);
      a.baseStats = { ...a.baseStats, atk: 40, spd: 45 };
      b.baseStats = { ...b.baseStats, spd: 13, def: 25 };
      return createClashState(a, b, 31);
    };
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

  it('つぎの技いじり：みちびき→じぶんの次の技は こうげき／まどわし→あいての次の技は ほじょ', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const a = drawn([210, 40, 30]);
      let st = resolveClashTurn(createClashState(a, drawn([30, 90, 210]), seed), ['c_gather', 'c_scratch']);
      const p = pickMoveFor(st, 0);
      if (p !== 'kosei' && p !== 'release') expect(getMove(p).category).toBe('attack');
      st = resolveClashTurn(createClashState(a, drawn([30, 90, 210]), seed), ['d_scramble', 'c_scratch']);
      const q = pickMoveFor(st, 1);
      if (q !== 'kosei' && q !== 'release') expect(getMove(q).category).toBe('support');
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
      for (let seed = 1; seed <= 120; seed++) {
        let st = mk(seed);
        if (rain) st = resolveClashTurn(st, ['f_rain', 'c_scratch']);
        const n = st.log.length;
        st = resolveClashTurn(st, [move, 'c_guard']);
        total += st.log.slice(n).reduce((x, e) => (e.t === 'damage' && e.side === 1 ? x + e.amount : x), 0);
      }
      return total;
    };
    expect(run(true, 'w_gun')).toBeGreaterThan(run(false, 'w_gun') * 1.2);
    expect(run(true, 'f_spark')).toBeLessThan(run(false, 'f_spark') * 0.93);
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

  it('技を縛る：だいわざふうじ／ちょうはつ は あいての次の技に効く', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const b = drawn([30, 90, 210]);
      b.moveIds = ['c_tackle', 'sw_great', 'c_guard', 'ca_heal'];
      let st = resolveClashTurn(createClashState(drawn([210, 40, 30]), b, seed), ['cp_nobig', 'c_scratch']);
      expect(pickMoveFor(st, 1)).not.toBe('sw_great');
      let t = resolveClashTurn(createClashState(drawn([210, 40, 30]), b, seed), ['fc_taunt', 'c_scratch']);
      const q = pickMoveFor(t, 1);
      if (q !== 'kosei') expect(getMove(q).category).toBe('attack');
      void st;
      void t;
    }
  });
});

describe('技の割り振り：AI が 見た「何の絵か」', () => {
  it('つばさの タグが あると かぜ・先制の 技が 入りやすく、理由に その ことばが 出る', () => {
    let hit = 0;
    let reasonHit = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const set = assignMoveSet({ seed, attribute: 'water', personality: 'calm', motif: 'あおい とり', motifTags: ['bird', 'wings'] });
      if (set.some((s) => getMove(s.id).first || getMove(s.id).tags?.includes('wind'))) hit++;
      if (set.some((s) => s.reason.includes('つばさ') || s.reason.includes('あおい とり'))) reasonHit++;
    }
    expect(hit).toBeGreaterThan(28);
    expect(reasonHit).toBeGreaterThan(28);
  });
  it('こうらの タグが あると まもりの 技が 入りやすい', () => {
    let hit = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const set = assignMoveSet({ seed, attribute: 'wood', personality: 'calm', motifTags: ['shell', 'hard'] });
      if (set.some((s) => { const m = getMove(s.id); return !!(m.guardPct || m.barrier || m.reflect || (m.buff && m.buff.stat === 'def')); })) hit++;
    }
    expect(hit).toBeGreaterThan(30);
  });
});
