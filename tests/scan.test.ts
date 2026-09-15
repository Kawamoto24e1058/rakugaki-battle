import { describe, expect, it } from 'vitest';
import { computeHomography, applyHomography, warpPerspective } from '../src/engine/scan/warp';
import { detectCornerMarkers } from '../src/engine/scan/markers';
import { estimatePaperColor, removeBackground } from '../src/engine/scan/bgRemove';
import { estimateIlluminationField } from '../src/engine/scan/illum';
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

  it('影で紙の明るさが場所によって違っても、背景全体をちゃんと抜ける', () => {
    // 左端が白(255)・右端が影で暗い(160)の緩やかなグラデーション背景＋中央に色つきの絵。
    const w = 120;
    const h = 120;
    const img = makeImage(w, h, (x, y) => {
      if (x >= 45 && x < 75 && y >= 45 && y < 75) return [30, 140, 60, 255];
      const shade = 255 - Math.round((x / (w - 1)) * 95); // 255 → 160
      return [shade, shade, shade, 255];
    });
    const paper = estimatePaperColor(img); // 左辺まん中付近＝明るい方を拾うはず
    const out = removeBackground(img, paper);
    const alphaAt = (x: number, y: number) => out.data[(y * w + x) * 4 + 3];
    // 影が落ちている右側の背景も、旧実装（固定閾値）なら残ってしまうところ
    expect(alphaAt(5, 60)).toBeLessThan(40);
    expect(alphaAt(w - 6, 60)).toBeLessThan(40);
    expect(alphaAt(60, 60)).toBeGreaterThan(200); // 中央の絵は残る
  });

  it('回帰：画面に対して大きいキャラは、影対策でも消えずに残る', () => {
    // 実写で見つかった事故の再現：ぼかし半径よりキャラが大きいと、画素値を
    // 直接いじる実装だとキャラの色が紙の明るさに引っ張られて消えてしまっていた。
    const size = 300;
    const img = makeImage(size, size, (x, y) => {
      const dx = x - size / 2;
      const dy = y - size / 2;
      if (Math.hypot(dx, dy) < 90) return [224, 128, 32, 255]; // 画面の大部分を占めるオレンジのキャラ
      const shade = 255 - Math.round((x / (size - 1)) * 70); // ゆるやかな影
      return [shade, shade, shade, 255];
    });
    const paper = estimatePaperColor(img);
    const out = removeBackground(img, paper);
    const alphaAt = (x: number, y: number) => out.data[(y * size + x) * 4 + 3];
    expect(alphaAt(size / 2, size / 2)).toBeGreaterThan(200); // キャラ中央は残る
    const i = (Math.floor(size / 2) * size + Math.floor(size / 2)) * 4;
    expect(out.data[i]).toBeGreaterThan(out.data[i + 1]); // 色味（オレンジ）も保たれている
    expect(alphaAt(5, size / 2)).toBeLessThan(40); // 背景は抜ける
  });
});

describe('illum: 照明ムラ推定', () => {
  it('明暗のグラデーションでも、場所ごとの明るさフィールドを推定できる', () => {
    const w = 100;
    const h = 100;
    const img = makeImage(w, h, (x) => {
      const shade = 255 - Math.round((x / (w - 1)) * 120); // 255 → 135
      return [shade, shade, shade, 255];
    });
    const { field } = estimateIlluminationField(img);
    // 元のグラデーションの傾向（左が明るく右が暗い）を反映しているはず
    expect(field[50 * w + 5]).toBeGreaterThan(field[50 * w + (w - 6)]);
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
