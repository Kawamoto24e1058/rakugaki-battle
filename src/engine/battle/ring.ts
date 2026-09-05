import type { Rng } from '../rng';
import { getMove, moveStars, supportKindWord, type MoveDef } from '../moves';

/** わざリングの1区画。 */
export type SegKind = 'move' | 'ska' | 'ultra';

export interface RingSeg {
  kind: SegKind;
  moveId?: string;
  /** 区画の広さ（重み）。大きいほど止まりやすい＝円グラフの角度も広い。 */
  weight: number;
  /** 表示用。 */
  label: string;
  /** 色分け用のカテゴリ。 */
  cat: 'physical' | 'attr' | 'guard' | 'heal' | 'ska' | 'ultra';
  /** 強さ星 1〜3（move のみ。ska/ultra は 0）。 */
  stars: 0 | 1 | 2 | 3;
  /** 攻撃わざの威力（表示用。攻撃 move のみ）。 */
  power?: number;
  /** 補助わざの効果の一言（補助 move のみ）。 */
  supportWord?: string;
}

export interface Ring {
  segs: RingSeg[];
}

/**
 * 縦リール（オレカ風）：わざリングの区画を、重みに比例した「コマ数」だけ並べた1本の帯。
 * 弱い技・共通技はコマが多く、強い技・7 はコマが少ない ＝ 流れてくる頻度で強さが分かる。
 * 構築は決定論的（engine と UI で同じ帯になる）。
 */
export function buildReel(moveIds: string[], evolveBonus: Record<string, number> = {}): RingSeg[] {
  const ring = buildRing(moveIds, evolveBonus);
  const buckets = ring.segs.map((seg) => ({ seg, n: Math.max(1, Math.round(seg.weight / 3.2)) }));
  const rows: RingSeg[] = [];
  let more = true;
  while (more) {
    more = false;
    for (const b of buckets) {
      if (b.n > 0) {
        rows.push(b.seg);
        b.n--;
        more = true;
      }
    }
  }
  return rows;
}

function moveCat(m: MoveDef): RingSeg['cat'] {
  if (m.category === 'support') {
    if (m.heal || m.cures) return 'heal';
    return 'guard';
  }
  return m.attribute ? 'attr' : 'physical';
}

/**
 * キャラの技セット → わざリング。
 * 弱い技・共通技は広く、強い技は狭く、必殺(7)はごく狭く、スカも少し入る。
 * evolveBonus[moveId] があるとその区画が広がる（オレカの「わざ強化」）。
 */
export function buildRing(moveIds: string[], evolveBonus: Record<string, number> = {}): Ring {
  const segs: RingSeg[] = [];
  for (const id of moveIds) {
    const m = getMove(id);
    let w: number;
    if (m.category === 'support') w = 12;
    else w = Math.max(5, 30 - m.power * 0.42);
    w += (evolveBonus[id] ?? 0) * 5;
    segs.push({
      kind: 'move',
      moveId: id,
      weight: w,
      label: m.name,
      cat: moveCat(m),
      stars: moveStars(m),
      power: m.category === 'attack' ? m.power : undefined,
      supportWord: m.category === 'support' ? supportKindWord(m) : undefined,
    });
  }
  // スカ 2区画
  segs.push({ kind: 'ska', weight: 8, label: 'スカ', cat: 'ska', stars: 0 });
  // 必殺（7）1区画・ごく狭い（抽選時に こううん/慈悲 で少し広がる）
  segs.push({ kind: 'ultra', weight: 3, label: '7', cat: 'ultra', stars: 0 });
  segs.push({ kind: 'ska', weight: 7, label: 'スカ', cat: 'ska', stars: 0 });
  return { segs };
}

export interface RingSpinInput {
  luck: number; // 6..28
  /** 負けている側のわずかな慈悲（0..1）。 */
  mercy: number;
  /** クールダウン中の技ID（コマは残るが、ほぼ止まらない）。 */
  onCooldown: Set<string>;
  /** ひるみ中：必ずスカ or 弱いコマ寄り。 */
  flinch: boolean;
}

/** 縦リールを回して止まるコマ（行）を決める。UIはこの index を中央窓に合わせる。 */
export function spinReel(
  rng: Rng,
  reel: RingSeg[],
  input: RingSpinInput,
): { index: number; seg: RingSeg } {
  const weights = reel.map((s) => {
    if (s.kind === 'ultra') return 1 + input.luck * 0.04 + input.mercy * 1.4;
    if (s.kind === 'ska') return input.flinch ? 2.2 : Math.max(0.6, 1 - input.luck * 0.02);
    if (s.moveId && input.onCooldown.has(s.moveId)) return 0.12;
    if (input.flinch && s.kind === 'move') {
      const m = getMove(s.moveId!);
      return m.category === 'attack' && m.power > 20 ? 0.3 : 1;
    }
    return 1;
  });
  const total = weights.reduce((n, x) => n + x, 0);
  let r = rng() * total;
  for (let i = 0; i < reel.length; i++) {
    r -= weights[i];
    if (r <= 0) return { index: i, seg: reel[i] };
  }
  return { index: 0, seg: reel[0] };
}

/** リングを回して止まる区画を決める。UIはこの index にポインターを合わせる。 */
export function spinRing(rng: Rng, ring: Ring, input: RingSpinInput): { index: number; seg: RingSeg } {
  const weights = ring.segs.map((s) => {
    if (s.kind === 'ultra') return s.weight + input.luck * 0.12 + input.mercy * 3;
    if (s.kind === 'ska') return input.flinch ? s.weight * 2 : s.weight * Math.max(0.5, 1 - input.luck * 0.02);
    if (s.moveId && input.onCooldown.has(s.moveId)) return 0.6;
    if (input.flinch && s.kind === 'move') {
      const m = getMove(s.moveId!);
      return m.category === 'attack' && m.power > 20 ? s.weight * 0.3 : s.weight;
    }
    return s.weight;
  });
  const total = weights.reduce((n, x) => n + x, 0);
  let r = rng() * total;
  for (let i = 0; i < ring.segs.length; i++) {
    r -= weights[i];
    if (r <= 0) return { index: i, seg: ring.segs[i] };
  }
  return { index: 0, seg: ring.segs[0] };
}

/** 円グラフ用：各区画の開始角と角度（度、0が真上、時計回り）。 */
export function ringGeometry(ring: Ring): { start: number; sweep: number; mid: number }[] {
  const total = ring.segs.reduce((n, s) => n + s.weight, 0);
  let acc = 0;
  return ring.segs.map((s) => {
    const sweep = (s.weight / total) * 360;
    const start = acc;
    acc += sweep;
    return { start, sweep, mid: start + sweep / 2 };
  });
}

// ---- きめ（止まったあとのダメージの質）----

export type Kime = 'graze' | 'normal' | 'crit';

export const KIME_JP: Record<Kime, string> = { graze: 'かすり', normal: 'ふつう', crit: 'クリティカル！' };
export const KIME_MULT: Record<Kime, number> = { graze: 0.6, normal: 1, crit: 1.75 };

export function rollKime(rng: Rng, luck: number): Kime {
  if (rng() < 0.12) return 'graze';
  const critChance = Math.min(0.34, 0.06 + luck * 0.009);
  if (rng() < critChance) return 'crit';
  return 'normal';
}

/** 必殺の成功判定。失敗すると「つよい通常攻撃」相当に落ちる。 */
export function ultraSucceeds(rng: Rng, heart: number): boolean {
  return rng() < Math.min(0.9, 0.55 + heart / 90);
}
