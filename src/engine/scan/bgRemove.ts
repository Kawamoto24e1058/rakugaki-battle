/**
 * 紙の背景を透明にする。用紙の色を推定 → 外周から塗りつぶし（floodfill）で
 * 「紙とつながっている・紙に近い色」の領域だけを背景として抜く。
 * 絵の内側の白（目のハイライト等）は外周とつながっていなければ残る。
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

/**
 * 外周からの floodfill で背景を透明化し、境界だけ軽くぼかす。
 * 紙に影が落ちていると「紙の色」は場所によって結構変わるので、固定の1色とだけ
 * 比較すると影の境目で塗りつぶしが止まってしまう（＝背景が抜けきらず四角のまま残る）。
 * かといって単純にぼかして明るさを均すと、キャラが画面に対して大きいときに
 * ぼかしへキャラ自身の色が混ざり込み、キャラごと紙色に飛ばして消してしまう事故が
 * 起きる（実写で確認済み）。
 * そこで「その場所はだいたい何色の紙に見えるはずか」を大きな箱ぼかしで予測する
 * "ものさし" だけを作り、実際の画素値（data）は一切書き換えずに、外周からの
 * floodfillで各画素をその場所ごとの予測値と比較する。影はなだらかに予測へ
 * 反映されて越えられるが、キャラの輪郭のような急激な色の変化はちゃんと止まる。
 */
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

  // 各画素位置で「そこに紙があったら何色に見えるはずか」を明るさ比で予測。
  const predicted = new Float32Array(w * h * 3);
  for (let p = 0; p < w * h; p++) {
    const ratio = illum[p] / Math.max(24, illumAtPaper);
    predicted[p * 3] = Math.min(255, paper.r * ratio);
    predicted[p * 3 + 1] = Math.min(255, paper.g * ratio);
    predicted[p * 3 + 2] = Math.min(255, paper.b * ratio);
  }

  const bg = new Uint8Array(w * h); // 1 = 背景
  const visited = new Uint8Array(w * h);
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  const tryPush = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    const i = idx * 4;
    const j = idx * 3;
    if (dist3(data[i] - predicted[j], data[i + 1] - predicted[j + 1], data[i + 2] - predicted[j + 2]) > threshold) return;
    visited[idx] = 1;
    bg[idx] = 1;
    qx[tail] = x;
    qy[tail] = y;
    tail++;
  };

  for (let x = 0; x < w; x++) {
    tryPush(x, 0);
    tryPush(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryPush(0, y);
    tryPush(w - 1, y);
  }
  while (head < tail) {
    const x = qx[head];
    const y = qy[head];
    head++;
    tryPush(x - 1, y);
    tryPush(x + 1, y);
    tryPush(x, y - 1);
    tryPush(x, y + 1);
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
