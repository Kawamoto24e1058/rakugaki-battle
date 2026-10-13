import { mulberry32 } from '../engine/rng';
import { Mash, Reaction, Rhythm, Timing } from './games/body';
import { makeChoiceGame, makeColor, makeCount, makeMath, makeMemory, makeOdd, makeQuiz, makeSilhouette } from './games/choice';
import { Lottery, Roulette } from './games/luck';
import { HighLow, Janken, Mole, Stopwatch, Tug } from './games/party';
import { Cups, makeHowMany, makeWhoShadow } from './games/drawing';
import type { MinigameDef } from './types';

export * from './types';
export type { MgFighter } from './context';
export { MinigameStage, judge } from './Shell';
export { MinigameIntro, KIND_META } from './Intro';

export const MINIGAMES: MinigameDef[] = [
  { id: 'mash', command: 'れんだ！', name: 'れんだ！', kind: 'body', howto: '3びょうで たくさん おそう', input: 'main', Component: Mash },
  { id: 'timing', command: 'とめろ！', name: 'ぴったり ストップ', kind: 'body', howto: 'まんなかで とめよう', input: 'main', Component: Timing },
  { id: 'reaction', command: 'はやおし！', name: 'よーい ドン！', kind: 'body', howto: '「ドン！」で すぐ おす（はやすぎは フライング）', input: 'main', Component: Reaction },
  { id: 'rhythm', command: 'あわせろ！', name: 'リズム ポン', kind: 'body', howto: 'まるが かさなったら おす', input: 'main', Component: Rhythm },
  { id: 'quiz', command: 'こたえろ！', name: 'はやおし クイズ', kind: 'head', howto: 'さきに せいかいした ほうが かち', input: 'choice', Component: makeChoiceGame(makeQuiz) },
  { id: 'math', command: 'けいさん！', name: 'けいさん', kind: 'head', howto: 'こたえを えらぼう', input: 'choice', Component: makeChoiceGame(makeMath) },
  { id: 'color', command: 'いろを えらべ！', name: 'いろあて', kind: 'head', howto: 'いろの なまえを えらぼう', input: 'choice', Component: makeChoiceGame(makeColor) },
  { id: 'memory', command: 'おぼえろ！', name: 'おぼえて！', kind: 'head', howto: 'さいしょに よく みて おぼえよう', input: 'choice', Component: makeChoiceGame(makeMemory) },
  { id: 'odd', command: 'さがせ！', name: 'まちがいさがし', kind: 'find', howto: 'ひとつだけ ちがうのを さがそう', input: 'choice', Component: makeChoiceGame(makeOdd) },
  { id: 'count', command: 'いくつ？', name: 'かぞえて！', kind: 'find', howto: 'いくつ あるかな', input: 'choice', Component: makeChoiceGame(makeCount) },
  { id: 'shadow', command: 'かげを あてろ！', name: 'かげあて', kind: 'find', howto: 'おなじ かたちを えらぼう', input: 'choice', Component: makeChoiceGame(makeSilhouette) },
  { id: 'roulette', command: 'とめろ！', name: 'ルーレット', kind: 'luck', howto: 'おおきい かずで とめよう', input: 'main', Component: Roulette },
  { id: 'mole', command: 'たたけ！', name: 'もぐらたたき', kind: 'body', howto: 'でてきた あいてを たたこう', input: 'choice', Component: Mole },
  { id: 'stopwatch', command: 'ぴったり！', name: 'ぴったり 5びょう', kind: 'body', howto: '5びょうだと おもったら おす', input: 'main', Component: Stopwatch },
  { id: 'tug', command: 'ひっぱれ！', name: 'つなひき', kind: 'body', howto: 'れんだで つなを ひっぱろう', input: 'main', Component: Tug },
  { id: 'cups', command: 'みやぶれ！', name: 'カップシャッフル', kind: 'find', howto: 'じぶんの キャラは どの カップ？', input: 'choice', Component: Cups },
  { id: 'whoshadow', command: 'あてろ！', name: 'だれの かげ？', kind: 'find', howto: 'かげを みて キャラを あてよう', input: 'choice', Component: makeChoiceGame(makeWhoShadow) },
  { id: 'howmany', command: 'かぞえろ！', name: 'なんびき いる？', kind: 'find', howto: 'キャラが なんびき いるか かぞえよう', input: 'choice', Component: makeChoiceGame(makeHowMany) },
  { id: 'janken', command: 'じゃんけん ポン！', name: 'じゃんけん', kind: 'luck', howto: 'グー・チョキ・パーを えらぼう', input: 'choice', Component: Janken },
  { id: 'highlow', command: 'よそうしろ！', name: 'ハイ＆ロー', kind: 'luck', howto: 'つぎの かずは 大きい？ 小さい？', input: 'choice', Component: HighLow },
  { id: 'lottery', command: 'ひけ！', name: 'くじびき', kind: 'luck', howto: 'はこを ひとつ えらぼう', input: 'choice', Component: Lottery },
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
