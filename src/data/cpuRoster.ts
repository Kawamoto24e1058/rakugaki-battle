import type { Character } from '../engine/types';
import { featuresToCharacter } from '../engine/analyze';
import type { AnalysisOverrides } from '../engine/analyze/toCharacter';
import type { FeatureVector } from '../engine/analyze';
import { hashString } from '../engine/rng';

/** テスト用CPU（雑なダミー）。本番はプレイヤー同士のホットシート。 */
interface DummySpec {
  key: string;
  name: string;
  blurb: string;
  features: FeatureVector;
  /** 見た目（npcArt の 絵）に あわせた タイプ・何の絵か・見た目の 印象。 */
  look: AnalysisOverrides;
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
    look: { style: 'balance', motif: 'いぬ', motifTags: ['animal', 'fangs', 'cute', 'tail'], statLook: { power: 0.55, tough: 0.5, speed: 0.55, hp: 0.55 } },
  },
  {
    key: 'dummy-mecha',
    name: 'ガシャンこぞう',
    blurb: 'かたい。ぼうぎょが高いロボ。',
    features: fv({ dominantHue: 210, coverage: 0.24, aspect: 1.4, spikiness: 0.3, symmetry: 0.92, fillDensity: 0.82, eyeSpots: 2, colorCount: 3, saturation: 0.4, value: 0.5 }),
    look: { style: 'guard', motif: 'ロボット', motifTags: ['robot', 'hard', 'armor'], statLook: { power: 0.45, tough: 0.85, speed: 0.3, hp: 0.65 } },
  },
  {
    key: 'dummy-tori',
    name: 'ビュンどり',
    blurb: 'すばやい。かわしが得意なとり。',
    features: fv({ dominantHue: 52, coverage: 0.09, aspect: 0.55, spikiness: 0.5, symmetry: 0.6, fillDensity: 0.32, eyeSpots: 2, colorCount: 2, saturation: 0.8, value: 0.8 }),
    look: { style: 'speed', motif: 'とり', motifTags: ['bird', 'wings', 'fast', 'cool'], statLook: { power: 0.5, tough: 0.3, speed: 0.9, hp: 0.35 } },
  },
  {
    key: 'dummy-oni',
    name: 'ドカドカおに',
    blurb: 'ごり押し。こうげきが高いおに。',
    features: fv({ dominantHue: 300, coverage: 0.2, aspect: 0.95, spikiness: 0.82, symmetry: 0.5, fillDensity: 0.7, eyeSpots: 1, colorCount: 3, saturation: 0.85, value: 0.7 }),
    look: { style: 'power', motif: 'おに', motifTags: ['monster', 'horns', 'weapon', 'scary'], statLook: { power: 0.9, tough: 0.55, speed: 0.35, hp: 0.6 } },
  },
];

export function makeCpuRoster(): Character[] {
  return SPECS.map((spec) => {
    const seed = hashString(spec.key);
    const c = featuresToCharacter(spec.features, seed, { name: spec.name, ...spec.look });
    return { ...c, id: spec.key, isCpu: true } satisfies Character;
  });
}

export const CPU_BLURBS: Record<string, string> = Object.fromEntries(SPECS.map((s) => [s.key, s.blurb]));
