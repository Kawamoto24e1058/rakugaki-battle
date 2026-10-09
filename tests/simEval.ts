import { detectCornerMarkers } from '../src/engine/scan/markers';
import { scanDrawing } from '../src/engine/scan';
import { simulatePhoto, TPL, type SimOpts } from './simPhoto';

export interface EvalResult {
  seed: number;
  found: boolean;
  /** 検出した4点とテンプレ上の正解との最大ずれ（テンプレpx。箱の幅は480）。 */
  markerErr: number;
  cornersFound: boolean;
  precision: number;
  recall: number;
}

export function evaluate(seed: number, o: SimOpts = {}): EvalResult {
  const sim = simulatePhoto(seed, o);
  const det = detectCornerMarkers(sim.photo);
  let markerErr = Infinity;
  if (det) {
    const pts = [det.tl, det.tr, det.bl, det.br];
    let worst = 0;
    pts.forEach((p, i) => {
      const t = sim.toTemplate(p);
      const g = sim.tpl.markers[i];
      worst = Math.max(worst, Math.hypot(t.x - g.x, t.y - g.y));
    });
    markerErr = worst;
  }
  const out = 320;
  const scan = scanDrawing(sim.photo, { outSize: out });
  const { box } = TPL;
  let tp = 0;
  let predN = 0;
  let truthN = 0;
  const skip = out * 0.12;
  for (let y = 0; y < out; y++) {
    for (let x = 0; x < out; x++) {
      const nearCorner = (x < skip || x >= out - skip) && (y < skip || y >= out - skip);
      if (nearCorner) continue;
      const tx = box.l + ((x + 0.5) / out) * (box.r - box.l);
      const ty = box.t + ((y + 0.5) / out) * (box.b - box.t);
      const cov = sim.tpl.charCov[Math.min(TPL.H - 1, Math.floor(ty)) * TPL.W + Math.min(TPL.W - 1, Math.floor(tx))];
      const truth = cov > 0.5;
      const pred = scan.output.data[(y * out + x) * 4 + 3] > 127;
      if (truth) truthN++;
      if (pred) predN++;
      if (truth && pred) tp++;
    }
  }
  return {
    seed,
    found: det !== null,
    markerErr,
    cornersFound: scan.cornersFound,
    precision: predN ? tp / predN : 0,
    recall: truthN ? tp / truthN : 0,
  };
}

export function summarize(rs: EvalResult[]) {
  const n = rs.length;
  const ok = rs.filter((r) => r.markerErr < 8).length;
  const found = rs.filter((r) => r.found).length;
  const sorted = (a: number[]) => [...a].sort((x, y) => x - y);
  const med = (a: number[]) => sorted(a)[Math.floor(a.length / 2)] ?? 0;
  const errs = rs.filter((r) => isFinite(r.markerErr)).map((r) => r.markerErr);
  return {
    n,
    found: `${found}/${n}`,
    accurate: `${ok}/${n}`,
    medianErr: +med(errs).toFixed(2),
    p90Err: +(sorted(errs)[Math.floor(errs.length * 0.9)] ?? 0).toFixed(2),
    meanPrecision: +(rs.reduce((s, r) => s + r.precision, 0) / n).toFixed(3),
    meanRecall: +(rs.reduce((s, r) => s + r.recall, 0) / n).toFixed(3),
    worstRecall: +Math.min(...rs.map((r) => r.recall)).toFixed(3),
    worstPrecision: +Math.min(...rs.map((r) => r.precision)).toFixed(3),
  };
}
