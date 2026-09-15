import type { Point } from './warp';
import { boxBlur2D } from './illum';

export interface CornerMarkers {
  tl: Point;
  tr: Point;
  bl: Point;
  br: Point;
}

interface Blob {
  count: number;
  sumX: number;
  sumY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * 用紙に印刷した4隅の黒いマーカー（■）を写真から検出する。
 * ダウンサンプル → 二値化 → 連結成分 → 「四角くて・ほどよい大きさで・各コーナーに一番近い」ものを採用。
 * 見つからなければ null（呼び出し側は台形補正なしにフォールバック）。
 */
export function detectCornerMarkers(img: ImageData): CornerMarkers | null {
  const maxDim = 260;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const dw = Math.max(1, Math.round(img.width * scale));
  const dh = Math.max(1, Math.round(img.height * scale));

  const gray = new Float32Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(img.height - 1, Math.floor(y / scale));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(img.width - 1, Math.floor(x / scale));
      const i = (sy * img.width + sx) * 4;
      gray[y * dw + x] = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
    }
  }

  // 写真全体の平均ではなく「その場所の周り」と比べて暗いかどうかで判定する。
  // 紙に影が落ちていても、マーカーは常にその場の周囲よりはっきり暗いはず。
  const localMean = boxBlur2D(gray, dw, dh, Math.max(4, Math.round(Math.min(dw, dh) * 0.15)));
  const dark = new Uint8Array(dw * dh);
  for (let i = 0; i < dark.length; i++) {
    const threshold = Math.min(150, Math.max(30, localMean[i] * 0.62));
    dark[i] = gray[i] < threshold ? 1 : 0;
  }

  // 連結成分ラベリング（4近傍BFS）
  const visited = new Uint8Array(dw * dh);
  const blobs: Blob[] = [];
  const qx = new Int32Array(dw * dh);
  const qy = new Int32Array(dw * dh);
  for (let sy = 0; sy < dh; sy++) {
    for (let sx = 0; sx < dw; sx++) {
      const start = sy * dw + sx;
      if (!dark[start] || visited[start]) continue;
      let head = 0;
      let tail = 0;
      qx[tail] = sx;
      qy[tail] = sy;
      tail++;
      visited[start] = 1;
      const b: Blob = { count: 0, sumX: 0, sumY: 0, minX: sx, maxX: sx, minY: sy, maxY: sy };
      while (head < tail) {
        const x = qx[head];
        const y = qy[head];
        head++;
        b.count++;
        b.sumX += x;
        b.sumY += y;
        if (x < b.minX) b.minX = x;
        if (x > b.maxX) b.maxX = x;
        if (y < b.minY) b.minY = y;
        if (y > b.maxY) b.maxY = y;
        const neighbors: [number, number][] = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= dw || ny >= dh) continue;
          const ni = ny * dw + nx;
          if (!dark[ni] || visited[ni]) continue;
          visited[ni] = 1;
          qx[tail] = nx;
          qy[tail] = ny;
          tail++;
        }
      }
      blobs.push(b);
    }
  }

  const totalArea = dw * dh;
  const candidates = blobs.filter((b) => {
    const area = b.count;
    if (area < totalArea * 0.0006 || area > totalArea * 0.08) return false;
    const bboxW = b.maxX - b.minX + 1;
    const bboxH = b.maxY - b.minY + 1;
    const aspect = bboxW / bboxH;
    if (aspect < 0.5 || aspect > 2) return false;
    const fill = area / (bboxW * bboxH);
    if (fill < 0.4) return false;
    return true;
  });
  if (candidates.length < 4) return null;

  const corners: [number, number][] = [
    [0, 0],
    [dw, 0],
    [0, dh],
    [dw, dh],
  ];
  const used = new Set<Blob>();
  const picked: Point[] = [];
  for (const [cx, cy] of corners) {
    let best: Blob | null = null;
    let bestDist = Infinity;
    for (const b of candidates) {
      if (used.has(b)) continue;
      const px = b.sumX / b.count;
      const py = b.sumY / b.count;
      const d = (px - cx) ** 2 + (py - cy) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = b;
      }
    }
    if (!best) return null;
    used.add(best);
    picked.push({ x: best.sumX / best.count / scale, y: best.sumY / best.count / scale });
  }

  const [tl, tr, bl, br] = picked;
  return { tl, tr, bl, br };
}
