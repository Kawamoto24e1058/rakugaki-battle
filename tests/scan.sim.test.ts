import { describe, expect, it } from 'vitest';
import { evaluate, summarize } from './simEval';
import type { SimOpts } from './simPhoto';

/**
 * 実写っぽい合成写真（斜め・回転・影・ぼけ・ノイズ・暗い机・説明文の■や黒い文字・
 * 子どもの絵）でマーカー検出と切り抜きの精度を測る回帰テスト。
 * 「写真が見切れていて4つのマーカーが写っていない」ケースは対象外（検出は null を返す仕様）。
 */
const CONFIGS: Record<string, SimOpts> = {
  標準: {},
  影つよい: { shadow: 0.55 },
  明るい机: { darkBg: false },
  ガイド枠で撮影: { squareCrop: true, paperFrac: 0.78, centerBox: true },
  ぼけ強め: { blur: 2, noise: 9 },
  大きな塗りつぶしあり: { bigFill: true },
};

describe('scan シミュレーション（実写っぽい合成写真）', () => {
  for (const [name, opts] of Object.entries(CONFIGS)) {
    it(
      `${name}：マーカーを正確に検出し、絵を残して背景だけ抜ける`,
      () => {
        const rs = [];
        for (let seed = 1; seed <= 8; seed++) rs.push(evaluate(seed, opts));
        const sum = summarize(rs);
        // 4つ全部見つかって、位置のずれが箱の幅(480)の1.7%未満
        expect(rs.every((r) => r.found && r.markerErr < 8)).toBe(true);
        expect(sum.medianErr).toBeLessThan(1);
        // 絵（線・塗り）を拾えている / 余計な背景を拾っていない
        expect(sum.meanRecall).toBeGreaterThan(0.85);
        expect(sum.meanPrecision).toBeGreaterThan(0.82);
        expect(sum.worstRecall).toBeGreaterThan(0.75);
        expect(sum.worstPrecision).toBeGreaterThan(0.6);
      },
      120000,
    );
  }
});
