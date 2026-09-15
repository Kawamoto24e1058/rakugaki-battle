import { computeHomography, warpPerspective, type Point } from './warp';
import { detectCornerMarkers, type CornerMarkers } from './markers';
import { estimatePaperColor, removeBackground } from './bgRemove';

export type { Point, CornerMarkers };
export { detectCornerMarkers, computeHomography, warpPerspective, estimatePaperColor, removeBackground };
export { estimateIlluminationField, boxBlur2D } from './illum';

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
 *  3. マーカー＋角のL字目印のインクが角にわずかに残ることがあるので、角だけ丸く消す
 * を行う。マーカーが見つからなくても背景透明化だけは行い、常に有効な画像を返す。
 * 影への強さ（局所的な明るさで判定する）は markers.ts / bgRemove.ts 側で
 * それぞれ担っている（実際の画素値はここでは一切書き換えない）。
 *
 * ★以前は わく線ごと確実に消すため、四辺全体をマーカーよりひとまわり内側に
 * 切り込ませていた（CROP_MARGIN_FRAC）。しかしそれだと「わく線のインク」と
 * 「わく際に描いた子どもの絵」を位置だけでは区別できず、絵ごと切ってしまう
 * 事故が実写で起きた。用紙の目印を「四辺ぜんぶの実線」から「角だけの目立つ
 * L字マーク」に変えたことで、対処すべきは各コーナー周辺のインクだけになった
 * ので、コーナー周辺だけを丸く消す方式に戻した＝辺の途中に描いた絵は一切削らない。
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
  if (cornersFound) clearCornerSpecks(output);
  return { output, cornersFound };
}

/**
 * マーカー＋角のL字目印のインク残りを、出力の四隅だけ丸く（なめらかに）透明化する。
 * 目印は角から12mm（160mm四方の箱に対して7.5%）まで伸びているので、少し余裕を
 * 持って9%を半径にしている。
 */
function clearCornerSpecks(img: ImageData, radiusFrac = 0.09): void {
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
        const fade = t * t * t; // 角の近くはしっかり消し、半径に近づくほど元の絵を残す
        const i = (y * w + x) * 4;
        data[i + 3] = Math.round(data[i + 3] * fade);
      }
    }
  }
}
