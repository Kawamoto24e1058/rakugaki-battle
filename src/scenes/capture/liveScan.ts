import { useEffect, useRef, useState, type RefObject } from 'react';
import { detectCornerMarkers } from '../../engine/scan';

/** 写りの ようす。 */
export type ShotQuality = 'ok' | 'dark' | 'blur' | 'glare';

export interface LiveScanState {
  /** 見つかった 四すみ（ガイド枠の中での 0〜1）。見つからなければ null。 */
  corners: { x: number; y: number }[] | null;
  quality: ShotQuality;
  /** うごかさずに いられた ていど（0〜1。1 で 自動さつえい）。 */
  steady: number;
}

const SIZE = 360; // 判定用に ちいさくする（はやく うごく ように）
const INTERVAL = 280;
const STEADY_NEEDED = 4; // 4回（約1.1びょう）つづけて うごかなければ さつえい
const MOVE_TOL = 0.025; // 枠の 2.5% いないの ずれは「うごいていない」

/** ガイド枠と おなじ ところ（まんなかの 正方形 90%）を 切りだす。 */
export function guideSquare(video: HTMLVideoElement) {
  const side = Math.min(video.videoWidth, video.videoHeight) * 0.9;
  return { sx: (video.videoWidth - side) / 2, sy: (video.videoHeight - side) / 2, side };
}

/** あかるさ・ぶれ・てかりを はかる。 */
function measure(img: ImageData): ShotQuality {
  const { data, width: w, height: h } = img;
  const step = 2;
  const gw = Math.floor(w / step);
  const gh = Math.floor(h / step);
  const g = new Float32Array(gw * gh);
  let sum = 0;
  let bright = 0;
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const i = (y * step * w + x * step) * 4;
      const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      g[y * gw + x] = l;
      sum += l;
      if (l > 250) bright++;
    }
  const mean = sum / (gw * gh);
  if (mean < 55) return 'dark';
  if (bright / (gw * gh) > 0.12) return 'glare';
  // ラプラシアンの 分散（ちいさいほど ぼけている）
  let s = 0;
  let s2 = 0;
  let n = 0;
  for (let y = 1; y < gh - 1; y++)
    for (let x = 1; x < gw - 1; x++) {
      const p = y * gw + x;
      const lap = g[p - 1] + g[p + 1] + g[p - gw] + g[p + gw] - 4 * g[p];
      s += lap;
      s2 += lap * lap;
      n++;
    }
  const variance = s2 / n - (s / n) ** 2;
  if (variance < 18) return 'blur';
  return 'ok';
}

/**
 * カメラ映像を 見つづけて、用紙の 四すみを さがす。
 * 四すみが 見つかって、しばらく うごかなければ onShoot を よぶ（自動シャッター）。
 */
export function useLiveScan(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean, onShoot: () => void): LiveScanState {
  const [state, setState] = useState<LiveScanState>({ corners: null, quality: 'ok', steady: 0 });
  const shootRef = useRef(onShoot);
  shootRef.current = onShoot;

  useEffect(() => {
    if (!enabled) return;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let prev: { x: number; y: number }[] | null = null;
    let steady = 0;
    let fired = false;
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || !ctx || !v.videoWidth || fired) return;
      const { sx, sy, side } = guideSquare(v);
      ctx.drawImage(v, sx, sy, side, side, 0, 0, SIZE, SIZE);
      const img = ctx.getImageData(0, 0, SIZE, SIZE);
      const quality = measure(img);
      const m = detectCornerMarkers(img);
      const corners = m ? [m.tl, m.tr, m.br, m.bl].map((p) => ({ x: p.x / SIZE, y: p.y / SIZE })) : null;
      if (corners && quality !== 'dark' && quality !== 'blur') {
        const still = prev && prev.every((p, i) => Math.hypot(p.x - corners[i].x, p.y - corners[i].y) < MOVE_TOL);
        steady = still ? steady + 1 : 1;
      } else steady = 0;
      prev = corners;
      setState({ corners, quality, steady: Math.min(1, steady / STEADY_NEEDED) });
      if (steady >= STEADY_NEEDED) {
        fired = true;
        shootRef.current();
      }
    }, INTERVAL);
    return () => window.clearInterval(id);
  }, [enabled, videoRef]);

  return state;
}
