import type { Character } from '../engine/types';

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
    return Array.isArray(parsed) ? (parsed as Character[]) : [];
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
