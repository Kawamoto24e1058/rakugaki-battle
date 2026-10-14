import { describe, expect, it } from 'vitest';
import { detectCornerMarkers } from '../src/engine/scan';
import { simulatePhoto } from './simPhoto';

/** ちいさく する（ライブ判定と おなじ 360px）。 */
function downscale(img: ImageData, size: number): ImageData {
  const data = new Uint8ClampedArray(size * size * 4);
  const side = Math.min(img.width, img.height);
  const ox = (img.width - side) / 2;
  const oy = (img.height - side) / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      // 2x2 平均（かんたんな 縮小）
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const sx = Math.min(img.width - 1, Math.floor(ox + ((x + dx * 0.5) * side) / size));
          const sy = Math.min(img.height - 1, Math.floor(oy + ((y + dy * 0.5) * side) / size));
          const i = (sy * img.width + sx) * 4;
          r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; a += img.data[i + 3];
        }
      const o = (y * size + x) * 4;
      data[o] = r / 4; data[o + 1] = g / 4; data[o + 2] = b / 4; data[o + 3] = a / 4;
    }
  return { data, width: size, height: size, colorSpace: 'srgb' } as ImageData;
}

describe('ライブ判定（撮影ガイド）', () => {
  it('360px に ちいさく しても 用紙の 四すみを 見つけられる', () => {
    let found = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const sim = simulatePhoto(seed, { squareCrop: true, paperFrac: 0.78, centerBox: true });
      if (detectCornerMarkers(downscale(sim.photo, 360))) found++;
    }
    expect(found).toBeGreaterThanOrEqual(7);
  });
});
