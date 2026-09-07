import { describe, expect, it } from 'vitest';
import { analyzeImageData, extractFeatures, featuresToCharacter } from '../src/engine/analyze';
import { rectImage } from './helpers';

describe('特徴抽出とキャラ生成', () => {
  it('色 → 属性', () => {
    expect(analyzeImageData(rectImage(200, 200, 80, 80, [220, 30, 20])).character.attribute).toBe('fire');
    expect(analyzeImageData(rectImage(200, 200, 80, 80, [30, 80, 220])).character.attribute).toBe('water');
    expect(analyzeImageData(rectImage(200, 200, 80, 80, [30, 170, 60])).character.attribute).toBe('wood');
    expect(analyzeImageData(rectImage(200, 200, 80, 80, [235, 200, 20])).character.attribute).toBe('bolt');
  });

  it('くらい絵・グレーの絵 → 闇属性', () => {
    // 黒っぽい絵
    expect(analyzeImageData(rectImage(200, 200, 120, 120, [22, 22, 26])).character.attribute).toBe('dark');
    // えんぴつ（グレー）の絵
    expect(analyzeImageData(rectImage(200, 200, 120, 120, [130, 128, 132])).character.attribute).toBe('dark');
  });

  it('メイン3ステータスの合計は種族値スケール（79〜101）内', () => {
    for (let seed = 0; seed < 60; seed++) {
      const img = rectImage(200, 200, 50 + (seed % 50), 50 + ((seed * 7) % 60), [
        (seed * 53) % 256,
        (seed * 97) % 256,
        (seed * 29) % 256,
      ]);
      const { character } = analyzeImageData(img);
      const { hp, atk, def, spd, luck, heart } = character.baseStats;
      expect(atk + def + spd).toBeGreaterThanOrEqual(79);
      expect(atk + def + spd).toBeLessThanOrEqual(101);
      expect(Math.min(atk, def, spd)).toBeGreaterThanOrEqual(13);
      expect(Math.max(atk, def, spd)).toBeLessThanOrEqual(52);
      expect(hp).toBeGreaterThanOrEqual(50);
      expect(hp).toBeLessThanOrEqual(118);
      expect(luck).toBeGreaterThanOrEqual(5);
      expect(heart).toBeGreaterThanOrEqual(5);
      expect(character.analysis.length).toBeGreaterThan(5);
      expect(character.skillLevel).toBe(1);
    }
  });

  it('細身・すきまのある絵は すばやさ が高い', () => {
    const thin = featuresToCharacter(extractFeatures(rectImage(240, 240, 22, 170, [200, 50, 50])), 1);
    const chunky = featuresToCharacter(extractFeatures(rectImage(240, 240, 160, 160, [200, 50, 50])), 1);
    expect(thin.baseStats.spd).toBeGreaterThan(chunky.baseStats.spd);
  });

  it('同じ画像 → 同じキャラ（決定論）', () => {
    const a = analyzeImageData(rectImage(200, 200, 80, 90, [200, 40, 30]));
    const b = analyzeImageData(rectImage(200, 200, 80, 90, [200, 40, 30]));
    expect(a.character.baseStats).toEqual(b.character.baseStats);
    expect(a.character.attribute).toBe(b.character.attribute);
    expect(a.character.moveIds).toEqual(b.character.moveIds);
  });

  it('用紙のチェック欄（overrides）が解析より優先される', () => {
    const { character } = analyzeImageData(rectImage(200, 200, 80, 80, [220, 30, 20]), {
      attribute: 'dark',
      weapon: 'shield',
    });
    expect(character.attribute).toBe('dark');
    expect(character.weapon).toBe('shield');
    // 闇の属性技が入っている
    expect(character.moveIds.some((m) => m.startsWith('dark'))).toBe(true);
  });
});
