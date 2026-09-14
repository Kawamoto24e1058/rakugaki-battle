import { computeHomography, warpPerspective, type Point } from './warp';
import { detectCornerMarkers, type CornerMarkers } from './markers';
import { estimatePaperColor, removeBackground } from './bgRemove';

export type { Point, CornerMarkers };
export { detectCornerMarkers, computeHomography, warpPerspective, estimatePaperColor, removeBackground };

export interface ScanResult {
  /** 台形補正＋背景透明化ずみの画像（RGBA、透過あり）。 */
  output: ImageData;
  /** 四隅マーカーを検出して傾き補正できたか。false ならそのまま切り抜いただけ。 */
  cornersFound: boolean;
}

function resizeNearest(img: ImageData, size: number): ImageData {
  if (img.width === size && img.height === size) return img;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    const sy = Math.min(img.height - 1, Math.floor((y * img.height) / size));
    for (let x = 0; x < size; x++) {
      const sx = Math.min(img.width - 1, Math.floor((x * img.width) / size));
      const si = (sy * img.width + sx) * 4;
      const di = (y * size + x) * 4;
      data[di] = img.data[si];
      data[di + 1] = img.data[si + 1];
      data[di + 2] = img.data[si + 2];
      data[di + 3] = img.data[si + 3];
    }
  }
  return { data, width: size, height: size, colorSpace: 'srgb' } as ImageData;
}

/**
 * 撮影した画像から「したがき用紙」を検出して:
 *  1. 四隅マーカーが見つかれば台形補正して まっすぐな正方形に
 *  2. 紙の背景を透明化
 * を行う。マーカーが見つからなくても背景透明化だけは行い、常に有効な画像を返す。
 */
export function scanDrawing(img: ImageData, opts: { outSize?: number } = {}): ScanResult {
  const outSize = opts.outSize ?? 640;
  const corners = detectCornerMarkers(img);

  let working: ImageData;
  let cornersFound = false;
  if (corners) {
    const dst: [Point, Point, Point, Point] = [
      { x: 0, y: 0 },
      { x: outSize, y: 0 },
      { x: 0, y: outSize },
      { x: outSize, y: outSize },
    ];
    const src: [Point, Point, Point, Point] = [corners.tl, corners.tr, corners.bl, corners.br];
    const H = computeHomography(dst, src);
    working = warpPerspective(img, H, outSize, outSize);
    cornersFound = true;
  } else {
    working = resizeNearest(img, outSize);
  }

  const paper = estimatePaperColor(working);
  const output = removeBackground(working, paper);
  // マーカーぶんの黒い点が出力の四隅にわずかに残ることがあるので、丸く抜いておく。
  if (cornersFound) clearCornerSpecks(output);
  return { output, cornersFound };
}

function clearCornerSpecks(img: ImageData, radiusFrac = 0.05): void {
  const { width: w, height: h, data } = img;
  const radius = Math.max(4, Math.round(Math.min(w, h) * radiusFrac));
  const corners: [number, number][] = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ];
  for (const [cx, cy] of corners) {
    const x0 = Math.max(0, cx - radius);
    const x1 = Math.min(w - 1, cx + radius);
    const y0 = Math.max(0, cy - radius);
    const y1 = Math.min(h - 1, cy + radius);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > radius) continue;
        const t = dist / radius;
        const fade = t * t * (3 - 2 * t); // smoothstep：角で0・半径で1
        const i = (y * w + x) * 4;
        data[i + 3] = Math.round(data[i + 3] * fade);
      }
    }
  }
}
