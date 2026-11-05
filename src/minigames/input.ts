import { useEffect, useRef } from 'react';
import type { Player } from './types';

/**
 * ボタン1つ／3つから えらぶ ミニゲームの 入力。ゲームごとに 操作は 1つ（マウスと キーで 有利・不利を 出さない）：
 *  ボタン1つ：スペース（2人の ときは P1 スペース・P2 エンター）。クリックでは おせない
 *  3つから：1人＝マウスで クリック ／ 2人＝P1 A S D・P2 ← ↓ →（1台で マウスは 分けられないので キー）
 * 1人か 2人かは MinigameStage / MinigameIntro が setTwoPlayer で きめる。
 * 押しっぱなしの くりかえし入力は 数えない（連打の公平さ・機器への負担のため）。
 */
let twoPlayerMode = false;
export function setTwoPlayer(v: boolean): void {
  twoPlayerMode = v;
}
export const isTwoPlayer = () => twoPlayerMode;

export type KeyKind = 'button' | 'choice';

function lookup(key: string, kind: KeyKind): [Player, number] | null {
  if (kind === 'button') {
    if (key === ' ') return [0, 0];
    if (key === 'enter' && twoPlayerMode) return [1, 0];
    return null;
  }
  // 1人の ときは マウスだけ
  if (!twoPlayerMode) return null;
  const asd: Record<string, number> = { a: 0, s: 1, d: 2 };
  const arrows: Record<string, number> = { arrowleft: 0, arrowdown: 1, arrowright: 2 };
  if (key in asd) return [0, asd[key]];
  if (key in arrows) return [1, arrows[key]];
  return null;
}

/** ボタンに 出す キーの なまえ。 */
export function keyLabels(player: Player, kind: KeyKind): string[] {
  if (kind === 'button') return [player === 0 ? 'スペース' : 'エンター'];
  if (!twoPlayerMode) return ['', '', ''];
  return player === 0 ? ['A', 'S', 'D'] : ['←', '↓', '→'];
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
