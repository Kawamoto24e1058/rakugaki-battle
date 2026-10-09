import type { Weapon } from '../types';
import type { FeatureVector } from './features';

export interface TagInput {
  features: FeatureVector;
  weapon: Weapon;
  personality: 'aggressive' | 'calm';
}

/** 絵の特徴 → 発動する unlock タグ（強い順）。 */
export function activeTags(input: TagInput): string[] {
  const f = input.features;
  const tags: [string, number][] = [];
  const add = (tag: string, score: number) => tags.push([tag, score]);

  // 形
  if (f.spikiness > 0.5) add('shape:spiky', f.spikiness);
  if (f.spikiness < 0.3 && f.fillDensity > 0.55) add('shape:round', 1 - f.spikiness);
  if (f.aspect < 0.8) add('shape:tall', 0.8 - f.aspect);
  if (f.aspect > 1.25) add('shape:wide', f.aspect - 1.25);
  if (f.coverage > 0.2) add('shape:big', f.coverage);
  if (f.coverage < 0.09) add('shape:small', 0.1 - f.coverage);
  if (f.symmetry > 0.8) add('shape:symmetric', f.symmetry);
  if (f.symmetry < 0.55) add('shape:asymmetric', 0.6 - f.symmetry);

  // 部位
  if (f.eyeSpots >= 2) add('part:eyes', f.eyeSpots / 3);
  if (input.weapon === 'wing' || (f.aspect < 0.75 && f.fillDensity < 0.4)) add('part:wings', 0.7);

  // 雰囲気
  add(input.personality === 'aggressive' ? 'mood:fierce' : 'mood:calm', 0.6);

  // 装飾
  if (f.colorCount >= 4) add('deco:colorful', f.colorCount / 6);
  if (f.colorCount <= 1) add('deco:plain', 0.5);

  // 持ち物
  add(`weapon:${input.weapon}` as string, 0.5);

  tags.sort((a, b) => b[1] - a[1]);
  return tags.map((t) => t[0]);
}
