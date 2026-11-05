import { mulberry32 } from '../engine/rng';
import { Mash, Reaction, Rhythm, Timing } from './games/body';
import { makeChoiceGame, makeOdd } from './games/choice';
import { Mole } from './games/party';
import { Cups } from './games/drawing';
import { Jump } from './games/jump';
import { Collect } from './games/collect';
import { CatchGame } from './games/catchGame';
import { Dodge } from './games/dodge';
import type { MinigameDef } from './types';

export * from './types';
export type { MgFighter } from './context';
export { MinigameStage, judge } from './Shell';
export { MinigameIntro, KIND_META } from './Intro';

/**
 * ミニゲーム（メイドインワリオ風に ひとことで わかる／アンダーテール風に そうさが かんたん）。
 * つかう キーは やじるし・スペース・マウス だけ（controls を 説明カードに 絵で 出す）。
 */
export const MINIGAMES: MinigameDef[] = [
  // スペース
  { id: 'mash', command: 'れんだ！', name: 'れんだ！', kind: 'body', howto: '3びょうで たくさん おそう', input: 'main', controls: ['space'], Component: Mash },
  { id: 'timing', command: 'とめろ！', name: 'ぴったり ストップ', kind: 'body', howto: 'まんなかで とめよう', input: 'main', controls: ['space'], Component: Timing },
  { id: 'reaction', command: 'いまだ！', name: 'よーい ドン！', kind: 'body', howto: '「ドン！」で すぐ おす（はやすぎは フライング）', input: 'main', controls: ['space'], Component: Reaction },
  { id: 'rhythm', command: 'あわせろ！', name: 'リズム ポン', kind: 'body', howto: 'まるが かさなったら おす', input: 'main', controls: ['space'], Component: Rhythm },
  { id: 'jump', command: 'とべ！', name: 'とべ！', kind: 'body', howto: 'ぶつからないように とびこえよう', input: 'main', controls: ['space', 'mouse'], Component: Jump },
  // やじるし
  { id: 'dodge', command: 'よけろ！', name: 'よけろ！', kind: 'body', howto: 'たまに あたらないように にげよう', input: 'main', controls: ['arrows', 'mouse'], Component: Dodge },
  { id: 'collect', command: 'あつめろ！', name: 'あつめろ！', kind: 'body', howto: 'ほしを たくさん とろう（トゲに ちゅうい）', input: 'main', controls: ['arrows', 'mouse'], Component: Collect },
  { id: 'catch', command: 'うけとめろ！', name: 'うけとめろ！', kind: 'body', howto: 'くだもの を キャッチ（ばくだんは よける）', input: 'main', controls: ['lr', 'mouse'], Component: CatchGame },
  // 3つから えらぶ
  { id: 'mole', command: 'たたけ！', name: 'もぐらたたき', kind: 'find', howto: 'でてきた あいてを たたこう', input: 'choice', controls: ['pick3', 'mouse'], Component: Mole },
  { id: 'odd', command: 'さがせ！', name: 'まちがいさがし', kind: 'find', howto: 'ひとつだけ ちがうのを さがそう', input: 'choice', controls: ['pick3', 'mouse'], Component: makeChoiceGame(makeOdd) },
  { id: 'cups', command: 'みやぶれ！', name: 'カップシャッフル', kind: 'find', howto: 'じぶんの キャラは どの カップ？', input: 'choice', controls: ['pick3', 'mouse'], Component: Cups },
];

/** そのターンのミニゲーム（同じものが 続きにくい）。 */
export function pickMinigame(seed: number, turn: number, prev: string | null): MinigameDef {
  const rng = mulberry32((seed ^ Math.imul(turn + 3, 0x2545f491)) >>> 0);
  const pool = MINIGAMES.filter((g) => g.id !== prev);
  // あたらしい（キャラが うごく）ゲームを すこし 出やすく
  const weights = pool.map((g) => (g.controls?.some((c) => c === 'arrows' || c === 'lr') || g.id === 'jump' ? 1.3 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[0];
}
