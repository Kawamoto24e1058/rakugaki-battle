/**
 * 紙の背景を透明にする。各画素を「その場所に紙があったら何色に見えるはずか」の
 * 予測値と比べ、近ければ背景として透明にする。
 * 以前は外周からのfloodfillで「紙とつながっている領域だけ」を背景にしていたが、
 * それだと わっか（輪っか・ドーナツ状の線）のように閉じた形の内側にある地の紙が
 * 外周と繋がらず、背景として抜けずに残ってしまう不具合があった（実写で確認済み）。
 * 目のハイライトのような小さな囲まれた白も同様に消えるようにはなるが、
 * 「閉じた形の中に紙が残る」方が実害が大きいと判断し、連結性は見ずに
 * 画素ごと独立に判定する。
 */
import { estimateIlluminationField } from './illum';

export interface RGB {
  r: number;
  g: number;
  b: number;
  /** どこからサンプルしたか（そこでの照明の明るさを基準点にするため）。 */
  x?: number;
  y?: number;
}

/**
 * 4辺のまん中の小さいパッチをサンプリングして紙の色を推定する。
 * 角は台形補正でマーカーの残りがにじむことがあるので避け、4パッチのうち
 * 一番明るい（＝絵の具が乗っていなさそうな）ものを採用する。
 */
export function estimatePaperColor(img: ImageData): RGB {
  const { width: w, height: h, data } = img;
  const half = Math.max(1, Math.round(Math.min(w, h) * 0.025));
  const centers: [number, number][] = [
    [Math.floor(w / 2), half], // 上辺まん中
    [Math.floor(w / 2), h - 1 - half], // 下辺まん中
    [half, Math.floor(h / 2)], // 左辺まん中
    [w - 1 - half, Math.floor(h / 2)], // 右辺まん中
  ];
  let best: RGB = { r: 255, g: 255, b: 255, x: Math.floor(w / 2), y: half };
  let bestLum = -1;
  for (const [cx, cy] of centers) {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let dy = -half; dy <= half; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= h) continue;
      for (let dx = -half; dx <= half; dx++) {
        const x = cx + dx;
        if (x < 0 || x >= w) continue;
        const i = (y * w + x) * 4;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
    }
    if (n === 0) continue;
    const avg = { r: r / n, g: g / n, b: b / n, x: cx, y: cy };
    const lum = 0.299 * avg.r + 0.587 * avg.g + 0.114 * avg.b;
    if (lum > bestLum) {
      bestLum = lum;
      best = avg;
    }
  }
  return best;
}

function dist3(dr: number, dg: number, db: number): number {
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export interface BgRemoveOptions {
  /** その場所で予測される紙色との色差がこれ以下なら背景。 */
  threshold?: number;
  /** 照明ムラ推定に使う箱ぼかしの半径（画像の短辺に対する割合）。 */
  illumRadiusFrac?: number;
}

export function removeBackground(img: ImageData, paper: RGB, opts: BgRemoveOptions = {}): ImageData {
  const { width: w, height: h, data } = img;
  const threshold = opts.threshold ?? 42;
  const { field: illum } = estimateIlluminationField(img, opts.illumRadiusFrac ?? 0.16);

  // 基準は画像全体の平均ではなく、紙色をサンプルした「その場所」の明るさにする。
  // 全体平均を使うと、紙色サンプル地点（=一番明るい場所）でも比が1を超えて
  // 予測が255を超え、そこの紙自身が背景と認識されなくなる事故が起きる。
  const px = Math.min(w - 1, Math.max(0, Math.round(paper.x ?? w / 2)));
  const py = Math.min(h - 1, Math.max(0, Math.round(paper.y ?? h / 2)));
  const illumAtPaper = illum[py * w + px];

  // 画素ごとに独立判定（連結性は見ない＝わっかの中の地の紙もちゃんと透明になる）。
  const bg = new Uint8Array(w * h); // 1 = 背景
  for (let p = 0; p < w * h; p++) {
    const ratio = illum[p] / Math.max(24, illumAtPaper);
    const pr = Math.min(255, paper.r * ratio);
    const pg = Math.min(255, paper.g * ratio);
    const pb = Math.min(255, paper.b * ratio);
    const i = p * 4;
    if (dist3(data[i] - pr, data[i + 1] - pg, data[i + 2] - pb) <= threshold) bg[p] = 1;
  }

  // 境界を3x3で軽くぼかしてジャギーを抑える
  const rawAlpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) rawAlpha[i] = bg[i] ? 0 : 255;
  const outAlpha = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          sum += rawAlpha[ny * w + nx];
          n++;
        }
      }
      outAlpha[y * w + x] = n ? sum / n : rawAlpha[y * w + x];
    }
  }

  const out = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    out[i] = data[i];
    out[i + 1] = data[i + 1];
    out[i + 2] = data[i + 2];
    out[i + 3] = outAlpha[p];
  }
  return { data: out, width: w, height: h, colorSpace: 'srgb' } as ImageData;
}
