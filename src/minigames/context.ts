import { createContext, useContext } from 'react';
import type { Attribute } from '../engine/types';
import type { MinigameOutcome } from './types';

/** ミニゲームに 出てくる キャラ（描いた絵）。 */
export interface MgFighter {
  name: string;
  attribute: Attribute;
  image: string | null;
}

export interface MgContext {
  fighters: [MgFighter, MgFighter] | null;
  /** 結果が でたら 入る（それぞれの わくに「かち！」スタンプを出す）。 */
  outcome: MinigameOutcome | null;
}

export const MinigameCtx = createContext<MgContext>({ fighters: null, outcome: null });
export const useMinigameCtx = () => useContext(MinigameCtx);
