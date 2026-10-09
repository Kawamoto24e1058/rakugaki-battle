import type { ClashEvent, ClashState, Side } from '../../engine';
import { getKosei } from '../../engine';
import { STATUS_META } from '../../engine/status';
import { getMove, type MoveDef } from '../../engine/moves';
import type { Character, StatusKind } from '../../engine/types';
import { koseiCard, moveCard, type CardData } from '../../components/moveText';
import { artFor, koseiArt } from '../../components/art/artSpec';
import { PALETTES } from '../../components/art/palette';
import { EMPTY_TABLE, type TableState } from '../../components/PlayArea';
import type { Beat, Callout, Chip, FxSpec, Floating, OrderInfo, Snap } from './types';
import type { ClashCombatant } from '../../engine';

const LOUD_TAGS = new Set(['クリティカル', 'カウンター', 'こんじょう', 'ばつぐん']);
let seq = 0;

export function chipsOf(c: ClashCombatant): Chip[] {
  const chips: Chip[] = c.statuses.map((x) => ({ kind: x.kind, jp: STATUS_META[x.kind].jp, good: STATUS_META[x.kind].kind === 'buff' }));
  if (c.charging && !c.statuses.some((x) => x.kind === 'charging')) chips.push({ kind: 'charged', jp: 'ためた！', good: true });
  return chips;
}

export function snapOf(s: ClashState): Snap {
  return { hp: [s.combatants[0].hp, s.combatants[1].hp], chips: [chipsOf(s.combatants[0]), chipsOf(s.combatants[1])] };
}

/** 状態異常ごとの絵（エフェクト・オーラ共通）。 */
export const STATUS_ART: Partial<Record<StatusKind | 'charged', { pal: keyof typeof PALETTES; motif: string }>> = {
  burn: { pal: 'fire', motif: 'flame' },
  freeze: { pal: 'water', motif: 'iceblock' },
  poison: { pal: 'dark', motif: 'venom' },
  paralysis: { pal: 'bolt', motif: 'spark' },
  confuse: { pal: 'dark', motif: 'dizzy' },
  sleep: { pal: 'water', motif: 'zzz' },
  flinch: { pal: 'atk', motif: 'burst' },
  atkUp: { pal: 'atk', motif: 'up' },
  defUp: { pal: 'sup', motif: 'shield' },
  guard: { pal: 'water', motif: 'shield' },
  spdUp: { pal: 'bolt', motif: 'wing' },
  luckUp: { pal: 'sup', motif: 'clover' },
  thorns: { pal: 'wood', motif: 'vine' },
  atkDown: { pal: 'dark', motif: 'down' },
  defDown: { pal: 'dark', motif: 'down' },
  spdDown: { pal: 'dark', motif: 'down' },
  charging: { pal: 'kosei', motif: 'chargeorb' },
  charged: { pal: 'kosei', motif: 'chargeorb' },
};

const WIN_BANNER_DRAW = 'ひきわけ！';

/** エンジンの ClashEvent 列を、画面で順に見せる「場面（Beat）」の列に変換する。 */
export function buildBeats(
  events: ClashEvent[],
  start: Snap,
  next: ClashState,
  names: [string, string],
  chars: [Character, Character],
): Beat[] {
  const beats: Beat[] = [];
  let hp: [number, number] = [...start.hp];
  let chips: [Chip[], Chip[]] = [[...start.chips[0]], [...start.chips[1]]];
  let table: TableState = EMPTY_TABLE;
  let first: Side | null = null;
  let lastAct: { side: Side; move: MoveDef | null } | null = null;
  let callout: Callout | null = null;
  let lastRelease = false;

  const setHp = (side: Side, v: number) => {
    hp = side === 0 ? [v, hp[1]] : [hp[0], v];
  };

  const add = (
    banner: string,
    o: Partial<Pick<Beat, 'acting' | 'hit' | 'floats' | 'fx' | 'order' | 'shake' | 'flash' | 'impact' | 'ms' | 'win' | 'koseiAct'>> & { keepCallout?: boolean } = {},
  ) => {
    beats.push({
      hp: [...hp],
      chips: [[...chips[0]], [...chips[1]]],
      banner,
      acting: o.acting ?? null,
      hit: o.hit ?? null,
      floats: o.floats ?? [],
      fx: o.fx ?? null,
      callout: o.keepCallout === false ? null : callout,
      order: o.order ?? null,
      first,
      table,
      shake: o.shake ?? 0,
      flash: o.flash ?? null,
      impact: o.impact ?? null,
      ms: o.ms ?? 1300,
      win: o.win,
      koseiAct: o.koseiAct,
    });
  };

  const fxFor = (kind: FxSpec['kind'], target: Side, size: number, extra: Partial<FxSpec> = {}): FxSpec => {
    const spec = lastAct?.move ? artFor(lastAct.move) : koseiArt();
    const kosei = !lastAct?.move;
    return {
      id: ++seq,
      kind,
      target,
      pal: kosei ? PALETTES.kosei : spec.pal,
      motifs: kind === 'hit' ? spec.motifs.slice(0, 2) : spec.motifs.slice(0, 1),
      size,
      crit: false,
      release: false,
      ...extra,
    };
  };

  const statusFx = (kind: StatusKind | 'charged', target: Side, fxKind: FxSpec['kind']): FxSpec | null => {
    const a = STATUS_ART[kind];
    if (!a) return null;
    return { id: ++seq, kind: fxKind, target, pal: PALETTES[a.pal], motifs: [a.motif], size: 1, crit: false, release: false };
  };

  for (const ev of events) {
    switch (ev.t) {
      case 'order': {
        first = ev.first;
        callout = null;
        const order: OrderInfo = { first: ev.first, reason: ev.reason, spd: ev.spd };
        table = { ...EMPTY_TABLE, first: ev.first };
        add('すばやさくらべ！', { order, ms: 2800 });
        break;
      }
      case 'act': {
        const side = ev.side;
        let card: CardData | null = null;
        let move: MoveDef | null = null;
        if (ev.moveId === 'kosei') {
          card = koseiCard(getKosei(chars[side].koseiId));
        } else {
          try {
            move = getMove(ev.moveId);
            card = moveCard(move);
          } catch {
            card = null;
          }
        }
        lastAct = { side, move };
        lastRelease = !!ev.release;
        const cards: TableState['cards'] = [...table.cards];
        cards[side] = card;
        const revealed: TableState['revealed'] = [...table.revealed];
        revealed[side] = true;
        const blocked: TableState['blocked'] = [...table.blocked];
        blocked[side] = ev.kind === 'blocked';
        table = { ...table, cards, revealed, blocked, actor: side, race: null };
        const pal = card?.art.pal ?? PALETTES.atk;
        callout = {
          id: ++seq,
          side,
          name: ev.kind === 'blocked' ? ev.moveName.replace(/[（）]/g, '') : ev.moveName,
          tag: ev.kind === 'charge' ? 'ため技' : ev.release ? 'ためた力を はなつ' : ev.kind === 'kosei' ? 'こせいわざ' : ev.kind === 'support' ? 'ほじょ' : ev.kind === 'blocked' ? '' : 'こうげき',
          gist: ev.kind === 'blocked' ? '' : (card?.gist ?? ''),
          color: ev.kind === 'blocked' ? '#8a8478' : (card?.color ?? '#e8503a'),
          dark: ev.kind === 'blocked' ? '#55514a' : pal.dark,
          quick: !!card?.quick,
          rare: !!card?.rare,
          blocked: ev.kind === 'blocked',
        };
        if (ev.kind === 'charge') {
          add(`${names[side]} は ちからを ためている…！ 次の ターンに はなつよ`, {
            acting: side,
            fx: fxFor('charge', side, 1.2, { pal: PALETTES.kosei, motifs: ['chargeorb'] }),
            ms: 2000,
          });
        } else if (ev.release) {
          add(`${names[side]} は ためた ちからを はなつ！`, { acting: side, impact: 'どかん！', flash: card?.art.pal.main ?? null, shake: 8, ms: 1500 });
        } else if (ev.kind === 'kosei') {
          add(`${names[side]} こせい はつどう！`, { acting: side, koseiAct: { side, moveName: ev.moveName }, ms: 2600 });
        } else if (ev.kind === 'blocked') {
          add(`${names[side]} は ${ev.moveName.replace(/[（）]/g, '')}`, { ms: 1300 });
        } else if (ev.kind === 'support') {
          add(`${names[side]} の ほじょわざ「${ev.moveName}」`, { ms: 1100 });
        } else {
          add(`${names[side]} の こうげき「${ev.moveName}」！`, { acting: side, ms: 1000 });
        }
        break;
      }
      case 'bonus':
        add(`${names[ev.side]}：${ev.label}`, { impact: ev.label, ms: 1300 });
        break;
      case 'damage': {
        const loud = !!ev.tag && LOUD_TAGS.has(ev.tag);
        const max = next.combatants[ev.side].maxHp;
        const ratio = ev.amount / max;
        const crit = ev.tag === 'クリティカル';
        const attackerHits = !!lastAct && lastAct.side !== ev.side;
        setHp(ev.side, ev.hpAfter);
        const float: Floating = { id: ++seq, side: ev.side, text: `${ev.amount}`, kind: 'dmg', big: loud || ratio >= 0.2, tag: ev.tag };
        const size = Math.max(0.85, Math.min(1.6, 0.85 + ratio * 3.2)) * (crit ? 1.2 : 1);
        const fx = attackerHits ? fxFor('hit', ev.side, size * (lastRelease ? 1.25 : 1), { crit, release: lastRelease }) : fxFor('hit', ev.side, 0.8, { motifs: ['burst'], pal: PALETTES.atk });
        const msg = ev.tag ? `${ev.tag}！ ${names[ev.side]} に ${ev.amount} ダメージ（のこり ${ev.hpAfter}）` : `${names[ev.side]} に ${ev.amount} ダメージ！（のこり ${ev.hpAfter}）`;
        add(msg, {
          hit: ev.side,
          floats: [float],
          fx,
          shake: Math.min(14, 3 + ratio * 40) * (crit ? 1.3 : 1),
          flash: attackerHits ? fx.pal.main : null,
          impact: loud ? `${ev.tag}！` : null,
          ms: 1400,
        });
        break;
      }
      case 'heal': {
        setHp(ev.side, ev.hpAfter);
        add(`${names[ev.side]} は HP を ${ev.amount} かいふく！（のこり ${ev.hpAfter}）`, {
          floats: [{ id: ++seq, side: ev.side, text: `+${ev.amount}`, kind: 'heal', big: ev.amount >= 20 }],
          fx: { id: ++seq, kind: 'heal', target: ev.side, pal: PALETTES.sup, motifs: ['cure'], size: 1, crit: false, release: false },
          ms: 1400,
        });
        break;
      }
      case 'status-apply': {
        const meta = STATUS_META[ev.kind];
        const debuff = meta.kind === 'debuff';
        if (ev.kind !== 'charging') chips = [ev.side === 0 ? [...chips[0].filter((c) => c.kind !== ev.kind), { kind: ev.kind, jp: meta.jp, good: !debuff }] : chips[0], ev.side === 1 ? [...chips[1].filter((c) => c.kind !== ev.kind), { kind: ev.kind, jp: meta.jp, good: !debuff }] : chips[1]];
        const fxKind: FxSpec['kind'] = ev.kind === 'guard' || ev.kind === 'defUp' || ev.kind === 'thorns' ? 'guard' : debuff ? 'debuff' : 'buff';
        add(`${names[ev.side]} は「${meta.jp}」に なった！`, {
          floats: [{ id: ++seq, side: ev.side, text: meta.jp, kind: 'info', big: false }],
          fx: statusFx(ev.kind, ev.side, fxKind),
          impact: debuff && ev.kind !== 'charging' ? `${meta.jp}！` : null,
          ms: 1300,
        });
        break;
      }
      case 'status-resist':
        add(`${names[ev.side]} には きかなかった`, { ms: 900 });
        break;
      case 'status-tick': {
        const meta = STATUS_META[ev.kind];
        setHp(ev.side, ev.hpAfter);
        add(`${names[ev.side]} は ${meta.jp} で ${ev.amount} ダメージ（のこり ${ev.hpAfter}）`, {
          hit: ev.side,
          floats: [{ id: ++seq, side: ev.side, text: `${ev.amount}`, kind: 'dmg', big: false, tag: meta.jp }],
          fx: statusFx(ev.kind, ev.side, 'status'),
          shake: 3,
          keepCallout: false,
          ms: 1200,
        });
        break;
      }
      case 'sudden-death':
        add(`サドンデス！ リードしている ${names[ev.leader]} が おおきく けずられる`, { impact: 'サドンデス！', keepCallout: false, ms: 1800 });
        break;
      default:
        break;
    }
  }

  // しめの1枚（決着 or 次ターン案内）
  const fin = snapOf(next);
  hp = fin.hp;
  chips = fin.chips;
  callout = null;
  table = EMPTY_TABLE;
  first = null;
  if (next.done) {
    if (next.winner === 'draw') add(WIN_BANNER_DRAW, { ms: 1800 });
    else add(`${names[next.winner as Side]} の かち！`, { ms: 3000, win: next.winner as Side });
  } else {
    add(`ターン ${next.turn} へ`, { ms: 900 });
  }
  return beats;
}
