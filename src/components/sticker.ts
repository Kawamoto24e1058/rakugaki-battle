import { useEffect, useState } from 'react';

/**
 * 絵を「ステッカー」（白い ふち＋かげ）の 画像に 1回だけ 焼きこんで、つかいまわす。
 * 以前は CSS の drop-shadow を 6つ かさねて いたが、キャラが のびちぢみ する たびに 毎フレーム
 * 描きなおしに なり、バトルや ミニゲームが カクついた。SVG（NPC の 絵）も ここで 1回 画像に する。
 */
const SIZE = 480;
const BORDER = 10; // 白い ふちの 太さ（SIZE に たいして）
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

async function bake(src: string): Promise<string> {
  const im = await load(src);
  const pad = BORDER + 8;
  const inner = SIZE - pad * 2;
  const k = Math.min(inner / im.naturalWidth, inner / im.naturalHeight);
  const w = im.naturalWidth * k;
  const h = im.naturalHeight * k;
  const x = (SIZE - w) / 2;
  const y = (SIZE - h) / 2;

  // 絵の かたち（シルエット）
  const sil = document.createElement('canvas');
  sil.width = SIZE;
  sil.height = SIZE;
  const sg = sil.getContext('2d')!;
  sg.drawImage(im, x, y, w, h);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = '#fff';
  sg.fillRect(0, 0, SIZE, SIZE);

  const out = document.createElement('canvas');
  out.width = SIZE;
  out.height = SIZE;
  const g = out.getContext('2d')!;
  // かげ（右下に うすく）
  g.globalAlpha = 0.22;
  g.filter = 'brightness(0.2)';
  for (let a = 0; a < 16; a++) g.drawImage(sil, Math.cos((a / 16) * Math.PI * 2) * BORDER + 6, Math.sin((a / 16) * Math.PI * 2) * BORDER + 8);
  g.filter = 'none';
  g.globalAlpha = 1;
  // 白い ふち（まわり 16方向に ずらして かさねる）
  for (let a = 0; a < 16; a++) g.drawImage(sil, Math.cos((a / 16) * Math.PI * 2) * BORDER, Math.sin((a / 16) * Math.PI * 2) * BORDER);
  g.drawImage(im, x, y, w, h);
  return out.toDataURL('image/png');
}

/** ステッカー画像を つくる（つくり おわって いれば すぐ かえす）。 */
export function stickerOf(src: string): Promise<string> {
  const hit = cache.get(src);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(src);
  if (!p) {
    p = bake(src)
      .then((url) => {
        cache.set(src, url);
        return url;
      })
      .catch(() => src)
      .finally(() => pending.delete(src));
    pending.set(src, p);
  }
  return p;
}

/** できて いれば ステッカー画像、まだなら null。 */
export const stickerNow = (src: string | null): string | null => (src ? (cache.get(src) ?? null) : null);

/** ステッカー画像を つかう（できるまでは null）。 */
export function useSticker(src: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => stickerNow(src));
  useEffect(() => {
    if (!src) {
      setUrl(null);
      return;
    }
    const now = stickerNow(src);
    if (now) {
      setUrl(now);
      return;
    }
    let alive = true;
    void stickerOf(src).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [src]);
  return url;
}
