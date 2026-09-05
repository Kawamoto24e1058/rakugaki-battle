import type { Character } from '../types';
import { hashBytes } from '../rng';
import { extractFeatures, type FeatureVector } from './features';
import { featuresToCharacter, type AnalysisOverrides } from './toCharacter';

export { extractFeatures } from './features';
export type { FeatureVector } from './features';
export { featuresToCharacter, archetypeLabel } from './toCharacter';
export type { AnalysisOverrides } from './toCharacter';

export interface AnalyzeResult {
  character: Character;
  features: FeatureVector;
  seed: number;
}

/**
 * 切り抜き済み ImageData を解析してキャラを生成する。
 * seed は画像のハッシュから作るので「同じ絵 → 同じキャラ」。
 */
export function analyzeImageData(img: ImageData, overrides: AnalysisOverrides = {}): AnalyzeResult {
  const seed = hashBytes(img.data);
  const features = extractFeatures(img);
  const character = featuresToCharacter(features, seed, overrides);
  return { character, features, seed };
}

/**
 * ブラウザ用ヘルパー：Canvas / Image / ImageBitmap から ImageData を取り出して解析。
 * 解析は最大 512px にダウンスケールして行う（速度と安定性のため）。
 */
export function analyzeSource(
  source: CanvasImageSource & { width: number; height: number },
  overrides: AnalysisOverrides = {},
): AnalyzeResult {
  const maxSide = 512;
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2Dコンテキストを取得できませんでした');
  ctx.drawImage(source, 0, 0, w, h);
  return analyzeImageData(ctx.getImageData(0, 0, w, h), overrides);
}
