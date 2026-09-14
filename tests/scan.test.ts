import { describe, expect, it } from 'vitest';
import { computeHomography, applyHomography, warpPerspective } from '../src/engine/scan/warp';
import { detectCornerMarkers } from '../src/engine/scan/markers';
import { estimatePaperColor, removeBackground } from '../src/engine/scan/bgRemove';
import { scanDrawing } from '../src/engine/scan';
import { makeImage } from './helpers';

describe('warp: ホモグラフィ', () => {
  it('4点対応を正しく解く（対応点を通す）', () => {
    const dst: [any, any, any, any] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ];
    const src: [any, any, any, any] = [
      { x: 10, y: 15 },
      { x: 210, y: 5 },
      { x: 20, y: 205 },
      { x: 200, y: 200 },
    ];
    const H = computeHomography(dst, src);
    for (let i = 0; i < 4; i++) {
      const p = applyHomography(H, dst[i].x, dst[i].y);
      expect(p.x).toBeCloseTo(src[i].x, 3);
      expect(p.y).toBeCloseTo(src[i].y, 3);
    }
  });

  it('warpPerspective：単純な拡大縮小で色が期待位置に移る', () => {
    // 200x200、中央40x40の赤四角
    const img = makeImage(200, 200, (x, y) => (x >= 80 && x < 120 && y >= 80 && y < 120 ? [220, 30, 30, 255] : null));
    const dst: [any, any, any, any] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ];
    const src: [any, any, any, any] = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 0, y: 200 },
      { x: 200, y: 200 },
    ];
    const H = computeHomography(dst, src);
    const out = warpPerspective(img, H, 100, 100);
    const at = (x: number, y: number) => {
      const i = (y * 100 + x) * 4;
      return [out.data[i], out.data[i + 1], out.data[i + 2]];
    };
    const [r, g, b] = at(50, 50); // 中央 → 赤いはず
    expect(r).toBeGreaterThan(150);
    expect(g).toBeLessThan(100);
    const [cr, cg, cb] = at(3, 3); // 端 → 白いはず
    expect(cr).toBeGreaterThan(200);
    expect(cg).toBeGreaterThan(200);
    expect(cb).toBeGreaterThan(200);
  });
});

describe('markers: 四隅マーカー検出', () => {
  function imageWithMarkers(size = 200, mk = 12) {
    return makeImage(size, size, (x, y) => {
      const inTL = x < mk && y < mk;
      const inTR = x >= size - mk && y < mk;
      const inBL = x < mk && y >= size - mk;
      const inBR = x >= size - mk && y >= size - mk;
      return inTL || inTR || inBL || inBR ? [0, 0, 0, 255] : null;
    });
  }

  it('4隅の黒い■を検出できる', () => {
    const img = imageWithMarkers();
    const corners = detectCornerMarkers(img);
    expect(corners).not.toBeNull();
    if (!corners) return;
    expect(corners.tl.x).toBeCloseTo(5.5, 0);
    expect(corners.tl.y).toBeCloseTo(5.5, 0);
    expect(corners.tr.x).toBeCloseTo(193.5, 0);
    expect(corners.br.x).toBeCloseTo(193.5, 0);
    expect(corners.br.y).toBeCloseTo(193.5, 0);
  });

  it('マーカーが無い真っ白な画像では null', () => {
    const img = makeImage(200, 200, () => null);
    expect(detectCornerMarkers(img)).toBeNull();
  });
});

describe('bgRemove: 背景の透明化', () => {
  it('紙の色（白）を辺のまん中から推定する', () => {
    const img = makeImage(100, 100, (x, y) => (x >= 40 && x < 60 && y >= 40 && y < 60 ? [30, 90, 200, 255] : null));
    const paper = estimatePaperColor(img);
    expect(paper.r).toBeGreaterThan(230);
    expect(paper.g).toBeGreaterThan(230);
    expect(paper.b).toBeGreaterThan(230);
  });

  it('外周は透明・中の絵は不透明のまま残る', () => {
    const img = makeImage(100, 100, (x, y) => (x >= 40 && x < 60 && y >= 40 && y < 60 ? [30, 90, 200, 255] : null));
    const out = removeBackground(img, { r: 255, g: 255, b: 255 });
    const alphaAt = (x: number, y: number) => out.data[(y * 100 + x) * 4 + 3];
    expect(alphaAt(2, 2)).toBeLessThan(20);
    expect(alphaAt(50, 50)).toBeGreaterThan(230);
  });
});

describe('scanDrawing: 一連の処理', () => {
  it('マーカーがあれば補正して背景を抜く', () => {
    const size = 200;
    const mk = 12;
    const img = makeImage(size, size, (x, y) => {
      const inMarker =
        (x < mk && y < mk) ||
        (x >= size - mk && y < mk) ||
        (x < mk && y >= size - mk) ||
        (x >= size - mk && y >= size - mk);
      if (inMarker) return [0, 0, 0, 255];
      if (x >= 80 && x < 120 && y >= 80 && y < 120) return [30, 90, 200, 255];
      return null;
    });
    const { output, cornersFound } = scanDrawing(img, { outSize: 120 });
    expect(cornersFound).toBe(true);
    expect(output.width).toBe(120);
    const alphaAt = (x: number, y: number) => output.data[(y * 120 + x) * 4 + 3];
    expect(alphaAt(60, 60)).toBeGreaterThan(150); // 中央の絵は残る
    expect(alphaAt(0, 0)).toBeLessThan(10); // 角そのものはマーカー残りごと透明
    expect(alphaAt(30, 30)).toBeLessThan(40); // 角から離れた背景はふつうに透明
  });

  it('マーカーが無くても背景透明化だけは行う（フォールバック）', () => {
    const img = makeImage(150, 150, (x, y) => (x >= 60 && x < 90 && y >= 60 && y < 90 ? [200, 40, 40, 255] : null));
    const { output, cornersFound } = scanDrawing(img, { outSize: 80 });
    expect(cornersFound).toBe(false);
    expect(output.width).toBe(80);
  });
});
