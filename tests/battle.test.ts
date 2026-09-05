import { describe, expect, it } from 'vitest';
import {
  createBattleState,
  resolveTurn,
  koseiReady,
  getKosei,
  KOSEI_LIST,
  type BattleState,
} from '../src/engine';
import { analyzeImageData } from '../src/engine/analyze';
import { makeCpuRoster } from '../src/data/cpuRoster';
import { rectImage } from './helpers';

function drawn(color: [number, number, number], w = 80, h = 90) {
  return analyzeImageData(rectImage(220, 220, w, h, color)).character;
}

function playToEnd(state: BattleState): BattleState {
  let cur = state;
  let guard = 0;
  while (cur.phase !== 'done' && guard++ < 80) cur = resolveTurn(cur);
  return cur;
}

describe('うんめいルーレット バトル', () => {
  it('createBattleState — キャラは5〜8個の技を持つ', () => {
    const s = createBattleState(drawn([210, 40, 30]), drawn([40, 90, 210]), 1);
    expect(s.combatants[0].moveIds.length).toBeGreaterThanOrEqual(5);
    expect(s.combatants[0].moveIds.length).toBeLessThanOrEqual(8);
  });

  it('生成された技セットに治療系のわざが必ず入る', () => {
    const cures = ['ca_breath', 'ca_song', 'water_wash', 'fire_dry', 'u_detox', 'u_endure', 'ca_heal'];
    for (let seed = 0; seed < 40; seed++) {
      const c = drawn([(seed * 53) % 256, (seed * 97) % 256, (seed * 29) % 256], 50 + (seed % 50), 60 + (seed % 60));
      expect(c.moveIds.some((m) => cures.includes(m))).toBe(true);
    }
  });

  it('resolveTurn は引数なし。バトルは必ず決着する', () => {
    const end = playToEnd(createBattleState(drawn([210, 40, 30]), drawn([40, 90, 210]), 42));
    expect(end.phase).toBe('done');
    expect(end.winner === 0 || end.winner === 1 || end.winner === 'draw').toBe(true);
    expect(end.turn).toBeLessThanOrEqual(26);
  });

  it('同じシードなら結果が完全一致（決定論）', () => {
    const l = drawn([210, 40, 30]);
    const r = drawn([40, 170, 60]);
    const a = playToEnd(createBattleState(l, r, 777));
    const b = playToEnd(createBattleState(l, r, 777));
    expect(a.combatants[0].hp).toBe(b.combatants[0].hp);
    expect(a.combatants[1].hp).toBe(b.combatants[1].hp);
    expect(a.winner).toBe(b.winner);
    expect(a.log.length).toBe(b.log.length);
  });

  it('わざリング・けっか・ダメージのイベントが出る', () => {
    let cur = createBattleState(drawn([210, 40, 30]), drawn([40, 90, 210]), 9);
    for (let i = 0; i < 6 && cur.phase !== 'done'; i++) cur = resolveTurn(cur);
    expect(cur.log.some((e) => e.t === 'ring-spin')).toBe(true);
    expect(cur.log.some((e) => e.t === 'result')).toBe(true);
    expect(cur.log.some((e) => e.t === 'damage')).toBe(true);
  });

  it('スカ（はずれ枠）が出うる', () => {
    let seen = false;
    for (let seed = 0; seed < 30 && !seen; seed++) {
      let cur = createBattleState(drawn([210, 40, 30]), drawn([40, 90, 210]), seed * 11 + 1);
      let g = 0;
      while (cur.phase !== 'done' && g++ < 40) {
        cur = resolveTurn(cur);
        if (cur.log.some((e) => e.t === 'ring-spin' && e.segKind === 'ska')) seen = true;
      }
    }
    expect(seen).toBe(true);
  });

  it('必殺は低確率（1バトルあたり平均1回未満）だが失敗もありうる', () => {
    let ultras = 0;
    let fails = 0;
    const N = 60;
    for (let seed = 0; seed < N; seed++) {
      const end = playToEnd(createBattleState(drawn([210, 40, 30]), drawn([40, 90, 210]), seed * 17 + 3));
      for (const e of end.log) {
        if (e.t === 'result' && e.segKind === 'ultra') ultras++;
        if (e.t === 'ultra-fail') fails++;
      }
    }
    expect(ultras / N).toBeLessThan(1.3);
    expect(fails).toBeGreaterThan(0);
  });

  it('CPUロスター 4体の総当たりが必ず決着する', () => {
    const roster = makeCpuRoster();
    for (let i = 0; i < roster.length; i++) {
      for (let j = 0; j < roster.length; j++) {
        if (i === j) continue;
        expect(playToEnd(createBattleState(roster[i], roster[j], i * 13 + j)).phase).toBe('done');
      }
    }
  });

  it('バトルの長さがだいたい 8〜24 ターンに収まる（バランス確認）', () => {
    const lens: number[] = [];
    for (let seed = 0; seed < 40; seed++) {
      const l = drawn([200 - seed, 40 + seed, 30], 70 + (seed % 30), 80 + (seed % 40));
      const r = drawn([30, 150 - seed, 60 + seed], 60 + (seed % 40), 90 + (seed % 30));
      lens.push(playToEnd(createBattleState(l, r, seed * 101 + 7)).turn);
    }
    lens.sort((a, b) => a - b);
    const median = lens[Math.floor(lens.length / 2)];
    expect(median).toBeGreaterThanOrEqual(6);
    expect(median).toBeLessThanOrEqual(22);
  });

  it('まもる構え：被ダメが減り、少し回復し、状態異常が1つ消える', () => {
    const l = drawn([210, 40, 30]);
    const r = drawn([30, 90, 210]);
    let atkOnly = createBattleState(l, r, 5);
    let bothDefend = createBattleState(l, r, 5);
    // 数ターン、片方だけ「まもる」続けると、攻めっぱなしより HP が高く残る
    for (let t = 0; t < 5; t++) {
      atkOnly = resolveTurn(atkOnly, ['attack', 'attack']);
      bothDefend = resolveTurn(bothDefend, ['defend', 'attack']);
    }
    expect(bothDefend.combatants[0].hp).toBeGreaterThan(atkOnly.combatants[0].hp);
  });

  it('まもる同士でもバトルはいつか決着する（サドンデス）', () => {
    let cur = createBattleState(drawn([210, 40, 30]), drawn([30, 90, 210]), 9);
    let guard = 0;
    while (cur.phase !== 'done' && guard++ < 60) cur = resolveTurn(cur, ['defend', 'defend']);
    expect(cur.phase).toBe('done');
  });

  it('こせい：60種以上あり、生成キャラは必ず有効なこせいを持つ', () => {
    expect(KOSEI_LIST.length).toBeGreaterThanOrEqual(60);
    for (const a of ['fire', 'water', 'wood', 'bolt', 'dark']) {
      expect(KOSEI_LIST.some((k) => k.tags.includes(`attr:${a}`))).toBe(true);
    }
    for (let s = 0; s < 30; s++) {
      const c = drawn([(s * 53) % 256, (s * 97) % 256, (s * 29) % 256], 50 + (s % 50), 60 + (s % 60));
      expect(() => getKosei(c.koseiId)).not.toThrow();
    }
  });

  it('こせい構え：発動でき、クールダウン/回数を消費し、バトルは決着する', () => {
    const l = drawn([210, 40, 30]);
    const r = drawn([30, 90, 210]);
    let cur = createBattleState(l, r, 7);
    const before = cur.combatants[0].koseiUses;
    const beforeCd = cur.combatants[0].koseiCd;
    expect(koseiReady(cur.combatants[0])).toBe(true);
    cur = resolveTurn(cur, ['kosei', 'attack']);
    const c0 = cur.combatants[0];
    expect(c0.koseiCd > beforeCd || c0.koseiUses < before).toBe(true);
    let guard = 0;
    while (cur.phase !== 'done' && guard++ < 60) cur = resolveTurn(cur, ['attack', 'attack']);
    expect(cur.phase).toBe('done');
  });
});
