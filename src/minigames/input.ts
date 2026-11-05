import { useEffect, useRef } from 'react';
import type { Player } from './types';

/**
 * ボタン1つ／3つから えらぶ ミニゲームの キー。子どもでも わかる キーだけ：
 *  ボタン1つ：1人＝スペース（エンターでも可）／2人＝P1 スペース・P2 エンター
 *  3つから：1人＝← ↓ →（A S D でも可）＋マウス／2人＝P1 A S D・P2 ← ↓ →
 * 1人か 2人かは MinigameStage が setTwoPlayer で きめる。
 * 押しっぱなしの くりかえし入力は 数えない（連打の公平さ・機器への負担のため）。
 */
let twoPlayerMode = false;
export function setTwoPlayer(v: boolean): void {
  twoPlayerMode = v;
}

export type KeyKind = 'button' | 'choice';

function lookup(key: string, kind: KeyKind): [Player, number] | null {
  if (kind === 'button') {
    if (key === ' ') return [0, 0];
    if (key === 'enter') return [twoPlayerMode ? 1 : 0, 0];
    return null;
  }
  const asd: Record<string, number> = { a: 0, s: 1, d: 2 };
  const arrows: Record<string, number> = { arrowleft: 0, arrowdown: 1, arrowright: 2 };
  if (key in asd) return [0, asd[key]];
  if (key in arrows) return [twoPlayerMode ? 1 : 0, arrows[key]];
  return null;
}

/** ボタンに 出す キーの なまえ。 */
export function keyLabels(player: Player, kind: KeyKind): string[] {
  if (kind === 'button') return [player === 0 ? 'スペース' : 'エンター'];
  if (twoPlayerMode && player === 0) return ['A', 'S', 'D'];
  return ['←', '↓', '→'];
}

export function usePlayerKeys(handler: (p: Player, idx: number) => void, enabled = true, kind: KeyKind = 'choice'): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const on = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const m = lookup(e.key.toLowerCase(), kind);
      if (!m) return;
      e.preventDefault();
      ref.current(m[0], m[1]);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [enabled, kind]);
}
