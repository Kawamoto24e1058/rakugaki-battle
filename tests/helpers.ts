/**
 * テスト用に合成 ImageData（相当のオブジェクト）を作る。
 * node 環境なので本物の ImageData は無いが、extractFeatures は {data,width,height} しか見ない。
 */
export function makeImage(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number, number] | null,
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  // 既定は白
  data.fill(255);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = paint(x, y);
      if (!px) continue;
      const i = (y * width + x) * 4;
      data[i] = px[0];
      data[i + 1] = px[1];
      data[i + 2] = px[2];
      data[i + 3] = px[3];
    }
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

/** 中央に矩形を描く（縦横比・色を指定）。 */
export function rectImage(
  w: number,
  h: number,
  rectW: number,
  rectH: number,
  color: [number, number, number],
): ImageData {
  const x0 = (w - rectW) / 2;
  const y0 = (h - rectH) / 2;
  return makeImage(w, h, (x, y) =>
    x >= x0 && x < x0 + rectW && y >= y0 && y < y0 + rectH ? [...color, 255] : null,
  );
}
