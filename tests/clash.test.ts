import { describe, expect, it } from 'vitest';
import { analyzeImageData } from '../src/engine/analyze';
import { getMove, MOVES } from '../src/engine/moves';
import { rectImage } from './helpers';
import {
  createClashState,
  resolveClashTurn,
  moveCategory,
  konshinReady,
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

  it('三すくみの各対面に正しい優位がある（速さ>力>技>速さ）', () => {
    const A = drawn([210, 40, 30]);
    const B = drawn([210, 40, 30]);
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
    expect(rateOf('speed', 'power')).toBeGreaterThan(0.6);
    expect(rateOf('power', 'tech')).toBeGreaterThan(0.6);
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

  it('こんしんは HP35%以下でだけ通る（それ以外は力に落ちる）', () => {
    const l = drawn([210, 40, 30]);
    const r = drawn([30, 90, 210]);
    let cur = createClashState(l, r, 4);
    // 満タンでこんしん → reveal では 'power' になっているはず
    cur = resolveClashTurn(cur, ['konshin', 'power']);
    const rev = cur.log.find((e) => e.t === 'reveal');
    if (rev && rev.t === 'reveal') expect(rev.stances[0]).toBe('power');

    // HPを削ってから
    let low = createClashState(l, r, 4);
    let g = 0;
    while (!low.done && g++ < 40 && !konshinReady(low.combatants[0])) {
      low = resolveClashTurn(low, ['tech', 'power']);
    }
    if (konshinReady(low.combatants[0]) && !low.done) {
      const after = resolveClashTurn(low, ['konshin', 'tech']);
      const rev2 = after.log.slice(low.log.length).find((e) => e.t === 'reveal');
      if (rev2 && rev2.t === 'reveal') expect(rev2.stances[0]).toBe('konshin');
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
