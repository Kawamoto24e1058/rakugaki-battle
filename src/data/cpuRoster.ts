import type { Character } from '../engine/types';
import { featuresToCharacter } from '../engine/analyze';
import type { FeatureVector } from '../engine/analyze';
import { hashString } from '../engine/rng';

/** テスト用CPU（雑なダミー）。本番はプレイヤー同士のホットシート。 */
interface DummySpec {
  key: string;
  name: string;
  blurb: string;
  features: FeatureVector;
}

function fv(partial: Partial<FeatureVector>): FeatureVector {
  return {
    inkCount: 4000,
    coverage: 0.16,
    bbox: { x: 10, y: 10, w: 80, h: 80 },
    aspect: 1,
    dominantHue: 0,
    saturation: 0.6,
    value: 0.6,
    colorCount: 2,
    symmetry: 0.7,
    spikiness: 0.4,
    fillDensity: 0.6,
    eyeSpots: 2,
    ...partial,
  };
}

const SPECS: DummySpec[] = [
  {
    key: 'dummy-pochi',
    name: 'ポチころ',
    blurb: 'れんしゅう用。バランス型のいぬ。',
    features: fv({ dominantHue: 24, coverage: 0.15, aspect: 1.05, spikiness: 0.35, symmetry: 0.75, fillDensity: 0.6, eyeSpots: 2, colorCount: 2 }),
  },
  {
    key: 'dummy-mecha',
    name: 'ガシャンこぞう',
    blurb: 'かたい。ぼうぎょが高いロボ。',
    features: fv({ dominantHue: 210, coverage: 0.24, aspect: 1.4, spikiness: 0.3, symmetry: 0.92, fillDensity: 0.82, eyeSpots: 2, colorCount: 3, saturation: 0.4, value: 0.5 }),
  },
  {
    key: 'dummy-tori',
    name: 'ビュンどり',
    blurb: 'すばやい。かわしが得意なとり。',
    features: fv({ dominantHue: 52, coverage: 0.09, aspect: 0.55, spikiness: 0.5, symmetry: 0.6, fillDensity: 0.32, eyeSpots: 2, colorCount: 2, saturation: 0.8, value: 0.8 }),
  },
  {
    key: 'dummy-oni',
    name: 'ドカドカおに',
    blurb: 'ごり押し。こうげきが高いおに。',
    features: fv({ dominantHue: 300, coverage: 0.2, aspect: 0.95, spikiness: 0.82, symmetry: 0.5, fillDensity: 0.7, eyeSpots: 1, colorCount: 3, saturation: 0.85, value: 0.7 }),
  },
];

export function makeCpuRoster(): Character[] {
  return SPECS.map((spec) => {
    const seed = hashString(spec.key);
    const c = featuresToCharacter(spec.features, seed, { name: spec.name });
    return { ...c, id: spec.key, isCpu: true } satisfies Character;
  });
}

export const CPU_BLURBS: Record<string, string> = Object.fromEntries(SPECS.map((s) => [s.key, s.blurb]));
