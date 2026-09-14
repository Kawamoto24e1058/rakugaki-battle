import { scanDrawing } from '../engine/scan';

function loadImageEl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像を よみこめませんでした'));
    img.src = url;
  });
}

/**
 * 撮影/選択した画像から したがき用紙を検出 → 傾き補正＋背景を透明化した PNG を作る。
 * PC（CaptureScene）・スマホ（PhoneScanScene）どちらからも使う共通処理。
 */
export async function scanCapturedImage(rawUrl: string): Promise<{ url: string; cornersFound: boolean }> {
  const img = await loadImageEl(rawUrl);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const maxDim = 1000;
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const { output, cornersFound } = scanDrawing(imageData, { outSize: 640 });
  // scanDrawing は Node(Vitest)でも動くよう { data, width, height } を返すだけ。
  // 本物の ImageData に包み直さないと putImageData に弾かれる。
  const realImageData = new ImageData(output.data, output.width, output.height);
  const outCanvas = document.createElement('canvas');
  outCanvas.width = output.width;
  outCanvas.height = output.height;
  outCanvas.getContext('2d')!.putImageData(realImageData, 0, 0);
  return { url: outCanvas.toDataURL('image/png'), cornersFound };
}
