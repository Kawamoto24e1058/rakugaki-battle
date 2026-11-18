import type { Attribute } from '../engine/types';

/**
 * 取りこんだ 絵の 保存（缶バッジ印刷で えらぶ ため）。
 * 画像が 大きいので localStorage ではなく IndexedDB に入れる。つかえない 端末では 何も しない。
 */
export interface SavedDrawing {
  id: string;
  name: string;
  attribute: Attribute;
  /** 切りぬき ずみの 絵（data URL）。 */
  image: string;
  createdAt: number;
}

const DB = 'rakugaki';
const STORE = 'drawings';
const MAX = 300;

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((res) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(null);
    } catch {
      res(null);
    }
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((res) => {
    tx.oncomplete = () => res();
    tx.onerror = () => res();
    tx.onabort = () => res();
  });
}

export async function listDrawings(): Promise<SavedDrawing[]> {
  const db = await open();
  if (!db) return [];
  return new Promise((res) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => res((req.result as SavedDrawing[]).sort((a, b) => b.createdAt - a.createdAt));
    req.onerror = () => res([]);
  });
}

/** 保存（おなじ id なら 上書き）。ふえすぎたら ふるい ものから けす。 */
export async function saveDrawing(d: SavedDrawing): Promise<void> {
  const db = await open();
  if (!db) return;
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(d);
  await done(tx);
  const all = await listDrawings();
  if (all.length > MAX) {
    const tx2 = db.transaction(STORE, 'readwrite');
    for (const old of all.slice(MAX)) tx2.objectStore(STORE).delete(old.id);
    await done(tx2);
  }
}

export async function deleteDrawing(id: string): Promise<void> {
  const db = await open();
  if (!db) return;
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  await done(tx);
}
