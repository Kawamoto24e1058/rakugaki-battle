import type { ComponentType } from 'react';

export type Player = 0 | 1;

/** ミニゲーム本体に わたすもの。 */
export interface GameProps {
  seed: number;
  /** 右がわ（P2）を CPU が遊ぶ。 */
  cpu: boolean;
  /** CPU のうまさ 0〜1。 */
  cpuSkill: number;
  /** 左右の名前（表示用）。 */
  names: [string, string];
  /** 0〜100 のスコアを ふたり分 かえす。 */
  onFinish: (scores: [number, number]) => void;
}

export type MinigameKind = 'body' | 'head' | 'find' | 'luck';

export interface MinigameDef {
  id: string;
  name: string;
  kind: MinigameKind;
  /** 遊び方（ひとこと）。 */
  howto: string;
  /** 操作のヒント（'main'＝ボタン1つ、'choice'＝3つから選ぶ）。 */
  input: 'main' | 'choice';
  Component: ComponentType<GameProps>;
}

export interface MinigameOutcome {
  scores: [number, number];
  winner: Player | null;
  perfect: boolean;
}
