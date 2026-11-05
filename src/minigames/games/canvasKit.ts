import { ATTRIBUTE_META } from '../../engine/attributes';
import type { MgFighter } from '../context';

/** キャンバスの ミニゲームで つかう 道具。 */

/** 画面の 大きさに あわせて 解像度を そろえ、W×H の 座標で 描けるように する。 */
export function fitCanvas(cv: HTMLCanvasElement, W: number, H: number): CanvasRenderingContext2D | null {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = cv.clientWidth;
  if (cv.width !== Math.round(cw * dpr)) {
    cv.width = Math.round(cw * dpr);
    cv.height = Math.round(((cw * H) / W) * dpr);
  }
  const g = cv.getContext('2d');
  if (!g) return null;
  const k = cv.width / W;
  g.setTransform(k, 0, 0, k, 0, 0);
  return g;
}

/** ふたりの 絵を 読みこむ。 */
export function loadFighterImages(fighters: [MgFighter, MgFighter]): (HTMLImageElement | null)[] {
  return fighters.map((f) => {
    if (!f.image) return null;
    const im = new Image();
    im.src = f.image;
    return im;
  });
}

/** キャラを 描く（絵が なければ 属性の 色の まる＋目）。(x, y) は 足もとではなく まんなか。 */
export function drawFighter(g: CanvasRenderingContext2D, im: HTMLImageElement | null, f: MgFighter, x: number, y: number, r: number, opts: { flip?: boolean; squash?: number; alpha?: number } = {}) {
  g.save();
  g.translate(x, y);
  if (opts.alpha != null) g.globalAlpha = opts.alpha;
  const sq = opts.squash ?? 1;
  g.scale((opts.flip ? -1 : 1) / Math.sqrt(sq), sq);
  if (im && im.complete && im.naturalWidth > 0) {
    g.drawImage(im, -r, -r, r * 2, r * 2);
  } else {
    g.fillStyle = ATTRIBUTE_META[f.attribute].color;
    g.strokeStyle = '#33302b';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(0, 0, r * 0.8, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(r * 0.25, -r * 0.15, r * 0.17, 0, Math.PI * 2);
    g.arc(-r * 0.25, -r * 0.15, r * 0.17, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** キャンバスの わく（ミニゲーム共通の 見た目）。 */
export const canvasStyle = (aspect: string, dark = false): React.CSSProperties => ({
  width: '100%',
  aspectRatio: aspect,
  display: 'block',
  borderRadius: 8,
  border: `4px solid ${dark ? '#fff' : '#fffdf5'}`,
  outline: '3px solid var(--ink)',
  touchAction: 'none',
});

/** ほし（あつめる もの）。 */
export function drawStar(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, spin = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(spin);
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = '#33302b';
  g.lineWidth = 1.2;
  g.stroke();
  g.restore();
}
