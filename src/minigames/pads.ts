import { useEffect, useRef } from 'react';
import type { Player } from './types';

/**
 * 新しい ミニゲーム（メイドインワリオ／アンダーテール風）の 入力。
 * 子どもでも わかる キーだけ：やじるし・スペース・マウス。
 *  1人（CPU と たいせん）：やじるし でも WASD でも うごく。けってい は スペース（エンター でも可）
 *  2人（1台の キーボード）：P1＝WASD＋スペース ／ P2＝やじるし＋エンター
 */
export type Dir = 'up' | 'down' | 'left' | 'right';
export type Control = 'arrows' | 'space' | 'mouse';

const DIR_KEYS: Record<string, [Player | 'any', Dir]> = {
  arrowup: [1, 'up'], arrowdown: [1, 'down'], arrowleft: [1, 'left'], arrowright: [1, 'right'],
  w: [0, 'up'], s: [0, 'down'], a: [0, 'left'], d: [0, 'right'],
};
const ACTION_KEYS: Record<string, Player> = { ' ': 0, enter: 1 };

/** キーが どの プレイヤーの ものか（1人の ときは ぜんぶ P1）。 */
function owner(p: Player | 'any', twoPlayer: boolean): Player {
  if (!twoPlayer) return 0;
  return p === 'any' ? 0 : p;
}

/** そのプレイヤーが つかう キーの 表示。 */
export function padLabels(player: Player, twoPlayer: boolean): { dirs: string; action: string } {
  if (!twoPlayer) return { dirs: 'やじるし', action: 'スペース' };
  return player === 0 ? { dirs: 'W A S D', action: 'スペース' } : { dirs: 'やじるし', action: 'エンター' };
}

export interface Pads {
  /** いま おされている むき（プレイヤーごと）。 */
  held: [Set<Dir>, Set<Dir>];
}

/**
 * むきキーは「おしている あいだ」を held に 入れる。けってい（スペース／エンター）と むきの おした しゅんかんは onPress で よぶ。
 */
export function usePads(twoPlayer: boolean, onPress?: (p: Player, key: Dir | 'action') => void, enabled = true): Pads {
  const pads = useRef<Pads>({ held: [new Set(), new Set()] });
  const cb = useRef(onPress);
  cb.current = onPress;
  useEffect(() => {
    if (!enabled) return;
    const held = pads.current.held;
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const d = DIR_KEYS[k];
      if (d) {
        e.preventDefault();
        const p = owner(d[0], twoPlayer);
        if (!e.repeat) cb.current?.(p, d[1]);
        held[p].add(d[1]);
        return;
      }
      if (k in ACTION_KEYS) {
        e.preventDefault();
        if (e.repeat) return;
        cb.current?.(owner(ACTION_KEYS[k], twoPlayer), 'action');
      }
    };
    const up = (e: KeyboardEvent) => {
      const d = DIR_KEYS[e.key.toLowerCase()];
      if (d) held[owner(d[0], twoPlayer)].delete(d[1]);
    };
    const blur = () => {
      held[0].clear();
      held[1].clear();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      blur();
    };
  }, [twoPlayer, enabled]);
  return pads.current;
}
