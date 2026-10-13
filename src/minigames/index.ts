import { mulberry32 } from '../engine/rng';
import { Mash, Reaction, Rhythm, Timing } from './games/body';
import { makeChoiceGame, makeColor, makeCount, makeMath, makeMemory, makeOdd, makeQuiz, makeSilhouette } from './games/choice';
import { Lottery, Roulette } from './games/luck';
import type { MinigameDef } from './types';

export * from './types';
export { MinigameStage, judge } from './Shell';
export { MinigameIntro, KIND_META } from './Intro';

export const MINIGAMES: MinigameDef[] = [
  { id: 'mash', name: 'れんだ！', kind: 'body', howto: '3びょうで たくさん おそう', input: 'main', Component: Mash },
  { id: 'timing', name: 'ぴったり ストップ', kind: 'body', howto: 'まんなかで とめよう', input: 'main', Component: Timing },
  { id: 'reaction', name: 'よーい ドン！', kind: 'body', howto: '「ドン！」で すぐ おす（はやすぎは フライング）', input: 'main', Component: Reaction },
  { id: 'rhythm', name: 'リズム ポン', kind: 'body', howto: 'まるが かさなったら おす', input: 'main', Component: Rhythm },
  { id: 'quiz', name: 'はやおし クイズ', kind: 'head', howto: 'さきに せいかいした ほうが かち', input: 'choice', Component: makeChoiceGame(makeQuiz) },
  { id: 'math', name: 'けいさん', kind: 'head', howto: 'こたえを えらぼう', input: 'choice', Component: makeChoiceGame(makeMath) },
  { id: 'color', name: 'いろあて', kind: 'head', howto: 'いろの なまえを えらぼう', input: 'choice', Component: makeChoiceGame(makeColor) },
  { id: 'memory', name: 'おぼえて！', kind: 'head', howto: 'さいしょに よく みて おぼえよう', input: 'choice', Component: makeChoiceGame(makeMemory) },
  { id: 'odd', name: 'まちがいさがし', kind: 'find', howto: 'ひとつだけ ちがうのを さがそう', input: 'choice', Component: makeChoiceGame(makeOdd) },
  { id: 'count', name: 'かぞえて！', kind: 'find', howto: 'いくつ あるかな', input: 'choice', Component: makeChoiceGame(makeCount) },
  { id: 'shadow', name: 'かげあて', kind: 'find', howto: 'おなじ かたちを えらぼう', input: 'choice', Component: makeChoiceGame(makeSilhouette) },
  { id: 'roulette', name: 'ルーレット', kind: 'luck', howto: 'おおきい かずで とめよう', input: 'main', Component: Roulette },
  { id: 'lottery', name: 'くじびき', kind: 'luck', howto: 'はこを ひとつ えらぼう', input: 'choice', Component: Lottery },
];

/** そのターンのミニゲーム（同じものが 続きにくい）。 */
export function pickMinigame(seed: number, turn: number, prev: string | null): MinigameDef {
  const rng = mulberry32((seed ^ Math.imul(turn + 3, 0x2545f491)) >>> 0);
  const pool = MINIGAMES.filter((g) => g.id !== prev);
  // うん系は すこし 出にくく
  const weights = pool.map((g) => (g.kind === 'luck' ? 0.5 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[0];
}
