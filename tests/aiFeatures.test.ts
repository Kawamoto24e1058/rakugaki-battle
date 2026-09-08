import { describe, expect, it } from 'vitest';
import { aiFeaturesToCharacter, coerceAiFeatures, aiToFeatureVector, type AiFeatures } from '../src/engine/analyze';
import { getKosei } from '../src/engine';

function ai(overrides: Partial<AiFeatures> = {}): AiFeatures {
  return {
    attribute: 'fire',
    attributeReason: 'あかい',
    weapon: 'none',
    aspectRatio: 1,
    coverage: 0.5,
    spikiness: 0.5,
    symmetry: 0.5,
    fillDensity: 0.5,
    saturation: 0.6,
    brightness: 0.6,
    colorCount: 2,
    eyeCount: 2,
    temperament: 'calm',
    powerLook: 0.5,
    toughnessLook: 0.5,
    speedLook: 0.5,
    hpLook: 0.5,
    name: 'テストン',
    flavor: 'てすと。',
    revealNotes: [{ step: 'attribute', text: 'あかい！' }],
    ...overrides,
  };
}

describe('AI Vision の特徴 → キャラ変換', () => {
  it('AI の属性・名前が反映され、キャラが妥当（5〜9技・有効なこせい・ステータス範囲内）', () => {
    for (let seed = 0; seed < 30; seed++) {
      const c = aiFeaturesToCharacter(ai({ attribute: (['fire', 'water', 'wood', 'bolt', 'dark'] as const)[seed % 5], name: `キャラ${seed}` }), seed * 101 + 7);
      expect(c.attribute).toBe((['fire', 'water', 'wood', 'bolt', 'dark'] as const)[seed % 5]);
      expect(c.name).toBe(`キャラ${seed}`);
      expect(c.moveIds.length).toBeGreaterThanOrEqual(5);
      expect(c.moveIds.length).toBeLessThanOrEqual(9);
      expect(() => getKosei(c.koseiId)).not.toThrow();
      const { hp, atk, def, spd } = c.baseStats;
      expect(hp).toBeGreaterThanOrEqual(40);
      expect(hp).toBeLessThanOrEqual(130);
      expect(atk + def + spd).toBeGreaterThanOrEqual(70);
      expect(atk + def + spd).toBeLessThanOrEqual(110);
    }
  });

  it('同じ AI 特徴 ＋ 同じシードなら同じキャラ（決定論）', () => {
    const a = aiFeaturesToCharacter(ai(), 555);
    const b = aiFeaturesToCharacter(ai(), 555);
    expect(a.baseStats).toEqual(b.baseStats);
    expect(a.moveIds).toEqual(b.moveIds);
    expect(a.koseiId).toBe(b.koseiId);
  });

  it('トゲトゲ・大きい絵は こうげき／HP が上がる方向', () => {
    const spiky = aiFeaturesToCharacter(ai({ spikiness: 1, coverage: 0.9, powerLook: 0.9, hpLook: 0.9 }), 42);
    const round = aiFeaturesToCharacter(ai({ spikiness: 0, coverage: 0.2, powerLook: 0.1, hpLook: 0.1 }), 42);
    expect(spiky.baseStats.atk).toBeGreaterThan(round.baseStats.atk);
    expect(spiky.baseStats.hp).toBeGreaterThan(round.baseStats.hp);
  });

  it('AI の powerLook / speedLook / toughnessLook が「型」を左右する', () => {
    const atkC = aiFeaturesToCharacter(ai({ powerLook: 0.95, toughnessLook: 0.1, speedLook: 0.1 }), 7);
    const spdC = aiFeaturesToCharacter(ai({ powerLook: 0.1, toughnessLook: 0.1, speedLook: 0.95 }), 7);
    const defC = aiFeaturesToCharacter(ai({ powerLook: 0.1, toughnessLook: 0.95, speedLook: 0.1 }), 7);
    expect(atkC.baseStats.atk).toBeGreaterThan(atkC.baseStats.spd);
    expect(atkC.baseStats.atk).toBeGreaterThan(atkC.baseStats.def);
    expect(spdC.baseStats.spd).toBeGreaterThan(spdC.baseStats.atk);
    expect(defC.baseStats.def).toBeGreaterThan(defC.baseStats.atk);
  });

  it('coerceAiFeatures：壊れた入力は null、範囲外はクランプ', () => {
    expect(coerceAiFeatures(null)).toBeNull();
    expect(coerceAiFeatures({ name: 'x' })).toBeNull(); // attribute 無し
    const c = coerceAiFeatures({ attribute: 'water', name: ' x', spikiness: 5, colorCount: 99, eyeCount: -3 });
    expect(c).not.toBeNull();
    expect(c!.spikiness).toBe(1);
    expect(c!.colorCount).toBe(6);
    expect(c!.eyeCount).toBe(0);
  });

  it('aiToFeatureVector：属性の色相が入り、coverage がピクセル解析レンジに収まる', () => {
    const fv = aiToFeatureVector(ai({ attribute: 'water', coverage: 1 }));
    expect(fv.dominantHue).toBe(210); // water
    expect(fv.coverage).toBeLessThanOrEqual(0.32);
    expect(fv.coverage).toBeGreaterThan(0.2);
  });
});
