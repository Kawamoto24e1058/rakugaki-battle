import { useEffect, useRef } from 'react';
import type { Player } from './types';

/**
 * キーボード／アーケードボタン（キーとして入力）の割り当て。
 *  P1：A S D（どれでも「ボタン」。3択のときは A=1 S=2 D=3）
 *  P2：J K L（同じく J=1 K=2 L=3）／←↓→ でも可
 * 押しっぱなしの くりかえし入力は 数えない（連打の公平さ・機器への負担のため）。
 */
const KEYMAP: Record<string, [Player, number]> = {
  a: [0, 0], s: [0, 1], d: [0, 2],
  j: [1, 0], k: [1, 1], l: [1, 2],
  arrowleft: [1, 0], arrowdown: [1, 1], arrowright: [1, 2],
};

export const KEY_LABELS: [string[], string[]] = [['A', 'S', 'D'], ['J', 'K', 'L']];

export function usePlayerKeys(handler: (p: Player, idx: number) => void, enabled = true): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const on = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const m = KEYMAP[e.key.toLowerCase()];
      if (!m) return;
      e.preventDefault();
      ref.current(m[0], m[1]);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [enabled]);
}
