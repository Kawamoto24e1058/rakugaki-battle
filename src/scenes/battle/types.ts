import type { StatusKind } from '../../engine/types';
import type { OrderReason, Side } from '../../engine';
import type { Pal } from '../../components/art/palette';
import type { TableState } from '../../components/PlayArea';

/** 状態異常・ため中のチップ（絵の上のオーラにも使う）。 */
export interface Chip {
  kind: StatusKind | 'charged';
  jp: string;
  good: boolean;
}

export interface Floating {
  id: number;
  side: Side;
  text: string;
  kind: 'dmg' | 'heal' | 'info';
  big: boolean;
  /** かすった／クリティカル などの ひとこと。 */
  tag?: string | null;
}

/** 絵の上で ばくはつする エフェクト。 */
export interface FxSpec {
  id: number;
  kind: 'hit' | 'heal' | 'buff' | 'debuff' | 'guard' | 'charge' | 'status';
  target: Side;
  pal: Pal;
  motifs: string[];
  /** 大きさ（0.8〜1.6）。ダメージの割合・大技で大きくなる。 */
  size: number;
  crit: boolean;
  /** ためた技を はなった。 */
  release: boolean;
}

/** 技名の帯。 */
export interface Callout {
  id: number;
  side: Side;
  name: string;
  tag: string;
  gist: string;
  color: string;
  dark: string;
  quick: boolean;
  rare: boolean;
  blocked: boolean;
}

export interface OrderInfo {
  first: Side;
  reason: OrderReason;
  spd: [number, number];
}

export interface Snap {
  hp: [number, number];
  chips: [Chip[], Chip[]];
}

export interface Beat extends Snap {
  banner: string;
  /** 動いている（つっこむ）側。 */
  acting: Side | null;
  /** ダメージを受けた側。 */
  hit: Side | null;
  floats: Floating[];
  fx: FxSpec | null;
  callout: Callout | null;
  order: OrderInfo | null;
  /** 先に動く側（行動順が決まった後）。 */
  first: Side | null;
  table: TableState;
  /** ステージを ゆらす強さ(px)。 */
  shake: number;
  /** 画面のフラッシュ色。 */
  flash: string | null;
  impact: string | null;
  ms: number;
  win?: Side;
  koseiAct?: { side: Side; moveName: string };
}
