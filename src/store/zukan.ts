import type { Character } from '../engine/types';
import { assignMoves } from '../engine/moves/assign';

/**
 * 図鑑の保存。今は localStorage の簡易版。
 * TODO(週3): Dexie / IndexedDB に移し、切り抜き画像 blob と印刷用原画も保存する。
 */
const KEY = 'rakugaki.zukan.v1';

export function loadZukan(): Character[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 旧データ互換：技が無ければ 絵のシードから割り振る
    return (parsed as Character[]).map((c) => (Array.isArray(c.moveIds) && c.moveIds.length ? c : { ...c, moveIds: assignMoves(c.seed, c.attribute, c.personality) }));
  } catch {
    return [];
  }
}

export function saveZukan(list: Character[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* 展示端末でストレージが使えなくても続行 */
  }
}
