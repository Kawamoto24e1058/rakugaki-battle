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
 * マーカー・枠線を画角の外へ追い出すための内側マージン（出力サイズに対する割合）。
 * マーカーは わく（160mm四方）の角に12mm角で半分だけかぶせてあるので、理論上は
 * 6/160 ≈ 3.75% 切り込めば わく線のインクは画角に入らない計算。ただし実写では
 * マーカー検出・台形補正が辺ごとに均等には揃わないため、大きめ（7%）に取って
 * いたが、その分 わくぎりぎりに描かれた絵まで一緒に切ってしまう事故が実写で
 * 発生した（絵が消えるより わく線が薄く残る方がまだマシ、という判断で縮小）。
 */
const CROP_MARGIN_FRAC = 0.045;

/**
 * 撮影した画像から「したがき用紙」を検出して:
 *  1. 四隅マーカーが見つかれば台形補正して まっすぐな正方形に
 *  2. 紙の背景を透明化
 * を行う。マーカーが見つからなくても背景透明化だけは行い、常に有効な画像を返す。
 * 影への強さ（局所的な明るさで判定する）は markers.ts / bgRemove.ts 側で
 * それぞれ担っている（実際の画素値はここでは一切書き換えない）。
 */
export function scanDrawing(img: ImageData, opts: { outSize?: number } = {}): ScanResult {
  const outSize = opts.outSize ?? 640;
  const corners = detectCornerMarkers(img);

  let working: ImageData;
  let cornersFound = false;
  if (corners) {
    // マーカーの中心＝印刷したわく線のちょうど角。実写では検出や補正が完璧には
    // 揃わず、わく線やマーカーの黒がわずかに画角内へ残ることがある（色での
    // 背景判定だけでは消せない＝印刷物のインクなので）。なので出力の四辺を
    // マーカーの位置よりひとまわり内側に切り込ませ、わく線ごと画角の外に
    // 追い出す（色に関係なく幾何学的に確実に除ける）。
    const m = outSize * CROP_MARGIN_FRAC;
    const dst: [Point, Point, Point, Point] = [
      { x: -m, y: -m },
      { x: outSize + m, y: -m },
      { x: -m, y: outSize + m },
      { x: outSize + m, y: outSize + m },
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
  return { output, cornersFound };
}
