import { describe, expect, it } from 'vitest';
import { layoutOf } from '../src/scenes/BadgePrintScene';

describe('缶バッジの ならべかた（A4）', () => {
  it('32mm バッジ（紙 44mm）は よこ4・たて5 の 20こ', () => {
    expect(layoutOf(44)).toEqual({ cols: 4, rows: 5, perPage: 20 });
  });
  it('大きく しても 1こは 入る', () => {
    expect(layoutOf(80).perPage).toBeGreaterThanOrEqual(1);
  });
});
