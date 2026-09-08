import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../store/gameStore';
import {
  createClashState,
  resolveClashTurn,
  cpuClashStance,
  koseiReady,
  moveCategory,
  archetypeLabel,
  getKosei,
  mulberry32,
  STANCE_JP,
  STANCE_COLOR,
  STANCE_BEATS,
  type ClashState,
  type ClashEvent,
  type ClashStance,
  type ClashChoice,
  type ClashCombatant,
  type TriStance,
  type Side,
} from '../engine';
import { STATUS_META } from '../engine/status';
import { getMove, type MoveDef } from '../engine/moves';
import { ATTRIBUTE_META, attributeMatchup } from '../engine/attributes';
import type { Character, Stats } from '../engine/types';
import { CharacterSprite, AttributeBadge } from '../components/bits';

const STAT_JP: Record<keyof Stats, string> = {
  hp: 'HP', atk: 'こうげき', def: 'ぼうぎょ', spd: 'すばやさ', luck: 'きゅうしょ', heart: 'こんじょう',
};

function moveDetailLines(m: MoveDef): string[] {
  const out: string[] = [];
  if (m.category === 'attack') out.push(`威力 ${m.power}${m.pierce ? '・ぼうぎょ無視' : ''}`);
  if (m.attribute) out.push(`属性：${ATTRIBUTE_META[m.attribute].jp}`);
  if (m.first) out.push('かならず 先制');
  if (m.status) {
    const s = m.status;
    out.push(`${Math.round(s.chance * 100)}% で ${STATUS_META[s.kind].jp}${s.toSelf ? '（自分）' : ''}`);
  }
  if (m.cures) out.push(m.cures === 'all' ? '状態異常を ぜんぶ なおす' : '状態異常を 1つ なおす');
  if (m.heal) out.push(`HP ${m.heal} かいふく`);
  if (m.buff) out.push(`${STAT_JP[m.buff.stat]} アップ（${m.buff.turns}ターン）`);
  if (m.debuff) out.push(`あいての ${STAT_JP[m.debuff.stat]} ダウン`);
  if (m.guardPct) out.push(`このターン 被ダメ -${m.guardPct}%`);
  if (m.reflect) out.push(`受けたダメージを ${m.reflect}% 返す`);
  if (m.drain) out.push(`与ダメの ${m.drain}% 回復`);
  if (m.recoil) out.push(`反動 ${m.recoil}%`);
  if (m.cooldown > 0) out.push(`クールダウン ${m.cooldown}`);
  return out;
}

/** ボタンに1個だけ出す「何が起きる技か」の短いことば。 */
function moveGist(m: MoveDef): string | null {
  if (m.heal || m.cures) return 'かいふく';
  if (m.status && !m.status.toSelf) return `${STATUS_META[m.status.kind].jp}をねらう`;
  if (m.guardPct) return 'ダメージを へらす';
  if (m.buff) return `${STAT_JP[m.buff.stat]}アップ`;
  if (m.debuff) return `あいて ${STAT_JP[m.debuff.stat]}ダウン`;
  if (m.drain) return 'すいとり';
  if (m.first) return 'かならず せんせい';
  if (m.pierce) return 'ぼうぎょ むし';
  return null;
}

const TRI: TriStance[] = ['power', 'tech', 'speed'];
const ICON: Record<ClashStance, string> = { power: '👊', tech: '✨', speed: '💨', kosei: '★' };
const BTN_COLOR: Record<ClashStance, string> = {
  power: STANCE_COLOR.power,
  tech: STANCE_COLOR.tech,
  speed: STANCE_COLOR.speed,
  kosei: 'var(--crayon-purple)',
};
/** 大きく見せたい damage tag。 */
const LOUD_TAGS = new Set(['クリティカル', 'カウンター', 'こんじょう', 'ばつぐん']);

function catCounts(c: Character): Record<TriStance, number> {
  const out: Record<TriStance, number> = { power: 0, tech: 0, speed: 0 };
  for (const id of c.moveIds) {
    try {
      out[moveCategory(getMove(id))] += 1;
    } catch {
      /* ignore */
    }
  }
  return out;
}

interface Floating {
  id: number;
  side: Side;
  text: string;
  kind: 'dmg' | 'heal' | 'info';
  big: boolean;
}
interface StatusChip {
  jp: string;
  good: boolean;
}
interface View {
  hp: [number, number];
  statuses: [StatusChip[], StatusChip[]];
  banner: string;
  acting: Side | null;
  shake: Side | null;
  floats: Floating[];
}
interface Beat {
  view: View;
  cut: { a: ClashStance; b: ClashStance; winner: Side | null } | null;
  flash: boolean;
  impact: string | null;
  /** この場面を見せる時間（ms）。過ぎたら自動で次へ。 */
  ms: number;
  /** 勝利演出（決着の場面のみ）。 */
  win?: Side;
  /** こせい発動のカットイン。 */
  koseiAct?: { side: Side; moveName: string };
}

type Phase = 'choose-p1' | 'handoff' | 'choose-p2' | 'animating' | 'over';

let floatSeq = 0;

const withHp = (hp: [number, number], side: Side, val: number): [number, number] =>
  side === 0 ? [val, hp[1]] : [hp[0], val];

/** エンジンの ClashEvent 列を「1タップ = 1場面」の Beat 列に変換する。 */
function buildBeats(
  events: ClashEvent[],
  start: View,
  next: ClashState,
  names: [string, string],
): Beat[] {
  const beats: Beat[] = [];
  let hp: [number, number] = [...start.hp];
  let sv: [StatusChip[], StatusChip[]] = [[...start.statuses[0]], [...start.statuses[1]]];
  let acting: Side | null = null;
  let shake: Side | null = null;
  let floats: Floating[] = [];
  let pending: [ClashStance, ClashStance] | null = null;

  const add = (
    banner: string,
    opts: {
      cut?: Beat['cut'];
      flash?: boolean;
      impact?: string | null;
      ms?: number;
      win?: Side;
      koseiAct?: Beat['koseiAct'];
    } = {},
  ) => {
    beats.push({
      view: {
        hp: [...hp],
        statuses: [[...sv[0]], [...sv[1]]],
        banner,
        acting,
        shake,
        floats: [...floats],
      },
      cut: opts.cut ?? null,
      flash: !!opts.flash,
      impact: opts.impact ?? null,
      ms: opts.ms ?? 2000,
      win: opts.win,
      koseiAct: opts.koseiAct,
    });
  };

  for (const ev of events) {
    floats = [];
    shake = null;
    acting = null;
    switch (ev.t) {
      case 'reveal':
        pending = ev.stances;
        break;
      case 'clash':
        add(
          ev.winner === null ? 'おなじ かまえ！ どうじに うごく' : `${names[ev.winner]} が よんだ！ あいては うごけない`,
          { cut: pending ? { a: pending[0], b: pending[1], winner: ev.winner } : null, ms: 2400 },
        );
        break;
      case 'act':
        if (ev.stance === 'kosei') {
          acting = ev.side;
          add(`${names[ev.side]} こせい はつどう！`, {
            koseiAct: { side: ev.side, moveName: ev.moveName },
            ms: 2600,
          });
        } else if (ev.moveName.startsWith('（')) {
          add(`${names[ev.side]} は ${ev.moveName.replace(/[（）]/g, '')}`);
        } else {
          acting = ev.side;
          add(`${names[ev.side]} の こうげき ―「${ev.moveName}」！`);
        }
        break;
      case 'damage': {
        const loud = !!ev.tag && LOUD_TAGS.has(ev.tag);
        const big = loud || ev.amount >= 26;
        hp = withHp(hp, ev.side, ev.hpAfter);
        acting = (1 - ev.side) as Side;
        shake = ev.side;
        floats = [{ id: ++floatSeq, side: ev.side, text: `${ev.amount}`, kind: 'dmg', big }];
        add(
          ev.tag ? `${ev.tag}！ ${names[ev.side]} に ${ev.amount} ダメージ` : `${names[ev.side]} に ${ev.amount} ダメージ！`,
          { flash: true, impact: loud ? `${ev.tag}！` : null },
        );
        break;
      }
      case 'heal':
        hp = withHp(hp, ev.side, ev.hpAfter);
        floats = [{ id: ++floatSeq, side: ev.side, text: `+${ev.amount}`, kind: 'heal', big: false }];
        add(`${names[ev.side]} は HP を ${ev.amount} かいふく！`);
        break;
      case 'consolation':
        hp = withHp(hp, ev.side, Math.min(next.combatants[ev.side].maxHp, hp[ev.side] + ev.amount));
        floats = [{ id: ++floatSeq, side: ev.side, text: `+${ev.amount}`, kind: 'heal', big: false }];
        add(`${names[ev.side]} は たてなおした（+${ev.amount}）`);
        break;
      case 'status-apply': {
        const jp = STATUS_META[ev.kind].jp;
        const debuff = STATUS_META[ev.kind].kind === 'debuff';
        sv = [
          ev.side === 0 ? [...sv[0], { jp, good: !debuff }] : sv[0],
          ev.side === 1 ? [...sv[1], { jp, good: !debuff }] : sv[1],
        ];
        floats = [{ id: ++floatSeq, side: ev.side, text: jp, kind: 'info', big: false }];
        add(`${names[ev.side]} は ${jp} に なった！`, { impact: debuff ? `${jp}！` : null });
        break;
      }
      case 'status-resist':
        add(`${names[ev.side]} には きかなかった`);
        break;
      case 'status-tick': {
        const jp = STATUS_META[ev.kind].jp;
        hp = withHp(hp, ev.side, ev.hpAfter);
        floats = [{ id: ++floatSeq, side: ev.side, text: `${jp} ${ev.amount}`, kind: 'dmg', big: false }];
        add(`${names[ev.side]} は ${jp} で ${ev.amount} ダメージ`);
        break;
      }
      case 'sudden-death':
        add(`サドンデス！ リードしている ${names[ev.leader]} が おおきく けずられる`, { impact: 'サドンデス！' });
        break;
      default:
        break;
    }
  }

  // しめの1枚（決着 or 次ターン案内）。状態異常は確定値で表示。
  floats = [];
  shake = null;
  acting = null;
  sv = [
    next.combatants[0].statuses.map((s) => ({ jp: STATUS_META[s.kind].jp, good: STATUS_META[s.kind].kind === 'buff' })),
    next.combatants[1].statuses.map((s) => ({ jp: STATUS_META[s.kind].jp, good: STATUS_META[s.kind].kind === 'buff' })),
  ];
  hp = [next.combatants[0].hp, next.combatants[1].hp];
  if (next.done) {
    if (next.winner === 'draw') {
      add('ひきわけ！', { ms: 1800 });
    } else {
      add(`${names[next.winner as Side]} の かち！`, { ms: 3000, win: next.winner as Side });
    }
  } else {
    add(`ターン ${next.turn} へ`, { ms: 1200 });
  }
  return beats;
}

export function BattleScene() {
  const player = useGame((s) => s.player)!;
  const opponent = useGame((s) => s.opponent)!;
  const mode = useGame((s) => s.mode);
  const finishBattle = useGame((s) => s.finishBattle);

  const seed = useMemo(
    () => (player.character.seed ^ opponent.character.seed ^ Date.now()) >>> 0,
    [player, opponent],
  );
  const [state, setState] = useState<ClashState>(() =>
    createClashState(player.character, opponent.character, seed),
  );
  const chars: [Character, Character] = [player.character, opponent.character];
  const names: [string, string] = [chars[0].name, chars[1].name];
  const maxHp: [number, number] = [chars[0].baseStats.hp, chars[1].baseStats.hp];
  const images: [string | null, string | null] = [player.imageUrl, opponent.imageUrl];

  const matchup = useMemo(() => {
    const m = attributeMatchup(chars[0].attribute, chars[1].attribute);
    const j0 = ATTRIBUTE_META[chars[0].attribute].jp;
    const j1 = ATTRIBUTE_META[chars[1].attribute].jp;
    if (m === 'strong') return `${j0}の技は ${j1}に 状態異常が 入りやすい！（${names[0]}）`;
    if (m === 'weak') return `${j1}の技は ${j0}に 状態異常が 入りやすい！（${names[1]}）`;
    return `${j0} と ${j1}：属性の 得意・苦手なし`;
  }, [chars, names]);

  const [phase, setPhase] = useState<Phase>('choose-p1');
  const [p1Pick, setP1Pick] = useState<ClashChoice | null>(null);
  const [lastPair, setLastPair] = useState<[ClashStance, ClashStance] | null>(null);
  const [flash, setFlash] = useState(false);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [beatIdx, setBeatIdx] = useState(0);
  const pendingNext = useRef<ClashState | null>(null);
  const [view, setView] = useState<View>({
    hp: [maxHp[0], maxHp[1]],
    statuses: [[], []],
    banner: 'よみあい！ 力 / 技 / 速さ を えらぶ',
    acting: null,
    shake: null,
    floats: [],
  });

  const cur = phase === 'animating' && beats[beatIdx] ? beats[beatIdx].view : view;
  const curBeat = phase === 'animating' ? beats[beatIdx] : undefined;
  const lastBeat = beatIdx >= beats.length - 1;

  // ダメージ演出のフラッシュ（beat に入った瞬間だけ）
  useEffect(() => {
    if (phase !== 'animating') return;
    if (!beats[beatIdx]?.flash) return;
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 150);
    return () => window.clearTimeout(t);
  }, [phase, beatIdx, beats]);

  // 演出は各場面を beat.ms だけ見せて、自動で次へ切り替わる。
  useEffect(() => {
    if (phase !== 'animating') return;
    const b = beats[beatIdx];
    if (!b) return;
    const t = window.setTimeout(() => advance(), b.ms);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, beatIdx, beats]);

  useEffect(() => {
    if (phase !== 'over') return;
    // 勝利演出は最後の beat で見せ切っているので、ここは短く。
    const t = window.setTimeout(() => finishBattle(state.winner === 0), 400);
    return () => window.clearTimeout(t);
  }, [phase, state.winner, finishBattle]);

  const choiceStance = (ch: ClashChoice): ClashStance => {
    if (ch === 'kosei' || ch === 'power' || ch === 'tech' || ch === 'speed') return ch;
    try {
      return moveCategory(getMove(ch));
    } catch {
      return 'power';
    }
  };

  function submit(myChoice: ClashChoice, foeChoice: ClashChoice) {
    if (phase === 'animating' || state.done) return;
    setLastPair([choiceStance(myChoice), choiceStance(foeChoice)]);
    const next = resolveClashTurn(state, [myChoice, foeChoice]);
    pendingNext.current = next;
    setBeats(buildBeats(next.log.slice(state.log.length), view, next, names));
    setBeatIdx(0);
    setPhase('animating');
  }

  function advance() {
    if (!lastBeat) {
      setBeatIdx((i) => i + 1);
      return;
    }
    const next = pendingNext.current;
    if (!next) return;
    setState(next);
    setBeats([]);
    setBeatIdx(0);
    setFlash(false);
    setView({
      hp: [next.combatants[0].hp, next.combatants[1].hp],
      statuses: [
        next.combatants[0].statuses.map((s) => ({ jp: STATUS_META[s.kind].jp, good: STATUS_META[s.kind].kind === 'buff' })),
        next.combatants[1].statuses.map((s) => ({ jp: STATUS_META[s.kind].jp, good: STATUS_META[s.kind].kind === 'buff' })),
      ],
      banner: next.done
        ? next.winner === 'draw'
          ? 'ひきわけ'
          : `${names[next.winner as Side]} の かち！`
        : mode === 'versus'
          ? `ターン ${next.turn}：P1（${names[0]}）が えらぶ`
          : `ターン ${next.turn}：力 / 技 / 速さ を えらぶ`,
      acting: null,
      shake: null,
      floats: [],
    });
    setPhase(next.done ? 'over' : 'choose-p1');
  }

  function pickSolo(choice: ClashChoice) {
    if (phase !== 'choose-p1' || state.done) return;
    const rng = mulberry32((state.seed + state.turn * 2654435761) >>> 0);
    submit(choice, cpuClashStance(state, 1, rng));
  }
  function pickP1(choice: ClashChoice) {
    if (phase !== 'choose-p1') return;
    setP1Pick(choice);
    setPhase('handoff');
  }
  function pickP2(choice: ClashChoice) {
    if (phase !== 'choose-p2' || !p1Pick) return;
    submit(p1Pick, choice);
    setP1Pick(null);
  }

  const pinch = cur.hp.some((h, i) => h > 0 && h / maxHp[i] <= 0.3);
  const chooser: ClashCombatant = phase === 'choose-p2' ? state.combatants[1] : state.combatants[0];
  const impact = curBeat?.impact ?? null;

  return (
    <div className="scene" style={{ justifyContent: 'flex-start', paddingTop: 'clamp(.4rem,2vh,1rem)', gap: '0.7rem' }}>
      {pinch && <div className="pinch-vignette" />}
      {flash && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,.55)', zIndex: 25, pointerEvents: 'none' }} />
      )}
      {impact && (
        <motion.div
          key={impact + beatIdx}
          initial={{ scale: 0.3, opacity: 0, rotate: -6 }}
          animate={{ scale: [0.3, 1.2, 1], opacity: 1, rotate: [-6, 3, 0] }}
          style={{
            position: 'fixed',
            top: '32%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 28,
            pointerEvents: 'none',
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'clamp(1.8rem, 8vw, 3rem)',
            color: '#fff',
            WebkitTextStroke: '3px var(--ink)',
            paintOrder: 'stroke',
          }}
        >
          {impact}
        </motion.div>
      )}
      {curBeat?.cut && <ClashCut cut={curBeat.cut} names={names} />}
      {curBeat?.win != null && (
        <VictoryOverlay name={names[curBeat.win]} char={chars[curBeat.win]} image={images[curBeat.win]} />
      )}
      {curBeat?.koseiAct && (
        <KoseiCutIn
          key={beatIdx}
          name={names[curBeat.koseiAct.side]}
          char={chars[curBeat.koseiAct.side]}
          image={images[curBeat.koseiAct.side]}
          side={curBeat.koseiAct.side}
          moveName={curBeat.koseiAct.moveName}
        />
      )}

      <div style={{ display: 'flex', gap: 'clamp(.6rem,3vw,1.5rem)', width: '100%', maxWidth: '48rem' }}>
        {[0, 1].map((s) => (
          <FighterPanel
            key={s}
            side={s as Side}
            char={chars[s]}
            image={images[s]}
            hp={cur.hp[s]}
            maxHp={maxHp[s]}
            statuses={cur.statuses[s]}
            acting={cur.acting === s}
            shake={cur.shake === s}
            floats={cur.floats.filter((f) => f.side === s)}
          />
        ))}
      </div>

      <div
        className="sketch-card"
        onClick={phase === 'animating' ? advance : undefined}
        style={{
          width: '100%',
          maxWidth: '48rem',
          minHeight: '3.2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontWeight: 700,
          fontSize: phase === 'animating' ? '1.05rem' : '1rem',
          padding: '0.5rem 1rem',
          cursor: phase === 'animating' ? 'pointer' : 'default',
        }}
      >
        {cur.banner}
      </div>

      {phase === 'animating' ? (
        <div style={{ display: 'grid', placeItems: 'center', gap: '0.35rem', width: '100%', position: 'relative', zIndex: 40 }}>
          {/* 自動再生の進み具合 */}
          <div style={{ display: 'flex', gap: 5 }}>
            {beats.map((_, i) => (
              <span
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: i <= beatIdx ? 'var(--crayon-blue)' : 'var(--border)',
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--ink-soft)' }}>じどうで すすむ（タップで はやく）</div>
        </div>
      ) : phase === 'over' ? (
        <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>けっかへ…</div>
      ) : phase === 'handoff' ? (
        <div style={{ display: 'grid', gap: '0.8rem', placeItems: 'center' }}>
          <div style={{ fontWeight: 700 }}>P1 は えらんだ！ がめんを P2 にわたして…</div>
          <button className="crayon-btn primary big" onClick={() => setPhase('choose-p2')}>
            P2 の ばん →
          </button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '0.76rem', color: 'var(--ink-soft)' }}>{matchup}</div>
          <TriangleGuide />
          {mode === 'versus' && (
            <div style={{ fontWeight: 700, color: phase === 'choose-p2' ? 'var(--crayon-blue)' : 'var(--crayon-red)' }}>
              {phase === 'choose-p2' ? `P2（${names[1]}）` : `P1（${names[0]}）`} が えらぶ
            </div>
          )}
          <MoveButtons
            onPick={phase === 'choose-p2' ? pickP2 : mode === 'versus' ? pickP1 : pickSolo}
            me={chooser}
          />
          {lastPair && (
            <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>
              さっき：{ICON[lastPair[0]]}{STANCE_JP[lastPair[0]]} vs {ICON[lastPair[1]]}{STANCE_JP[lastPair[1]]}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** 三すくみを三角形で。速さ→力→技→速さ（矢印の向きに勝つ）。 */
function TriangleGuide() {
  const V = { speed: [150, 42], power: [246, 188], tech: [54, 188] } as const;
  const R = 36;
  const node = (s: TriStance, [x, y]: readonly [number, number]) => (
    <g key={s}>
      <circle cx={x} cy={y} r={R} fill={STANCE_COLOR[s]} stroke="var(--ink)" strokeWidth={3} />
      <text x={x} y={y - 4} textAnchor="middle" fontSize="21" fontWeight="900" fill="#fff" fontFamily="var(--font-display)">
        {STANCE_JP[s]}
      </text>
      <text x={x} y={y + 18} textAnchor="middle" fontSize="16">
        {ICON[s]}
      </text>
    </g>
  );
  const edges: [readonly [number, number], readonly [number, number]][] = [
    [V.speed, V.power],
    [V.power, V.tech],
    [V.tech, V.speed],
  ];
  return (
    <div style={{ display: 'grid', placeItems: 'center', gap: 3 }}>
      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-soft)' }}>
        じゃんけん：矢印の むきに かつ
      </span>
      <svg width="212" height="164" viewBox="0 0 300 232" role="img" aria-label="速さは力に、力は技に、技は速さに勝つ">
        <defs>
          <marker id="tg-arrow" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L12 6 L0 12 z" fill="var(--ink)" />
          </marker>
        </defs>
        {edges.map(([[x1, y1], [x2, y2]], i) => {
          const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
          const ux = dx / len, uy = dy / len;
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          return (
            <g key={i}>
              <line
                x1={x1 + ux * (R + 4)}
                y1={y1 + uy * (R + 4)}
                x2={x2 - ux * (R + 13)}
                y2={y2 - uy * (R + 13)}
                stroke="var(--ink)"
                strokeWidth={3}
                markerEnd="url(#tg-arrow)"
              />
              <g transform={`translate(${mx + uy * 15} ${my - ux * 15})`}>
                <rect x={-15} y={-11} width={30} height={20} rx={5} fill="#fff" stroke="var(--ink)" strokeWidth={1.5} />
                <text textAnchor="middle" y={5} fontSize="13" fontWeight="900" fill="var(--ink)" fontFamily="var(--font-display)">
                  かつ
                </text>
              </g>
            </g>
          );
        })}
        {node('speed', V.speed)}
        {node('power', V.power)}
        {node('tech', V.tech)}
      </svg>
    </div>
  );
}

function Tip({ title, sub, lines, desc }: { title: string; sub?: string; lines: string[]; desc?: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(16rem, 76vw)',
        background: '#fff',
        border: '2.5px solid var(--ink)',
        borderRadius: 10,
        padding: '0.55rem 0.7rem',
        textAlign: 'left',
        fontWeight: 400,
        color: 'var(--ink)',
        boxShadow: '3px 4px 0 rgba(0,0,0,.18)',
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>
        {title}
        {sub && <span style={{ fontSize: '0.74rem', color: 'var(--ink-soft)' }}>　{sub}</span>}
      </div>
      {lines.map((l, i) => (
        <div key={i} style={{ fontSize: '0.78rem' }}>
          ・{l}
        </div>
      ))}
      {desc && <div style={{ fontSize: '0.74rem', color: 'var(--ink-soft)', marginTop: 3 }}>{desc}</div>}
    </div>
  );
}

const TRI_ORDER: Record<TriStance, number> = { power: 0, tech: 1, speed: 2 };

/** 編成した技（最大3）＋こせい を そのままボタンに。技のカテゴリで三すくみが決まる。 */
function MoveButtons({ onPick, me }: { onPick: (c: ClashChoice) => void; me: ClashCombatant }) {
  const kosei = getKosei(me.koseiId);
  const canKosei = koseiReady(me);
  const [open, setOpen] = useState<string | null>(null);

  const moves = useMemo(() => {
    const list = me.moveIds
      .map((id) => {
        try {
          return getMove(id);
        } catch {
          return null;
        }
      })
      .filter((m): m is MoveDef => !!m);
    return list.sort((a, b) => TRI_ORDER[moveCategory(a)] - TRI_ORDER[moveCategory(b)] || b.power - a.power);
  }, [me.moveIds]);

  const shell: React.CSSProperties = {
    minWidth: '9.5rem',
    maxWidth: '13rem',
    flex: '1 1 9.5rem',
    padding: '0.7em 0.8em',
    lineHeight: 1.2,
    display: 'grid',
    gap: 3,
    textAlign: 'center',
  };

  const moveBtn = (m: MoveDef) => {
    const s = moveCategory(m);
    const cd = me.cooldowns[m.id] ?? 0;
    const gist = moveGist(m);
    return (
      <div key={m.id} style={{ position: 'relative', display: 'flex' }}>
        {open === m.id && (
          <Tip title={m.name} sub={STANCE_JP[s]} lines={moveDetailLines(m)} desc={m.desc || undefined} />
        )}
        <button
          className="crayon-btn"
          disabled={cd > 0}
          onClick={() => onPick(m.id)}
          onMouseEnter={() => setOpen(m.id)}
          onMouseLeave={() => setOpen(null)}
          style={{ ...shell, borderColor: BTN_COLOR[s], color: 'var(--ink)', opacity: cd > 0 ? 0.4 : 1 }}
        >
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: BTN_COLOR[s] }}>
            「{m.name}」
          </span>
          <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>
            {m.category === 'attack' ? `いりょく ${m.power}` : 'ほじょわざ'}
            {cd > 0 ? `（あと${cd}）` : ''}
          </span>
          {gist && <span style={{ fontSize: '0.76rem', opacity: 0.85 }}>{gist}</span>}
          <span style={{ fontSize: '0.72rem', color: BTN_COLOR[s], opacity: 0.9 }}>
            {ICON[s]} {STANCE_JP[s]}（{STANCE_JP[STANCE_BEATS[s]]}に かつ）
          </span>
        </button>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: '48rem' }}>
      {moves.map(moveBtn)}
      <div style={{ position: 'relative', display: 'flex' }}>
        {open === 'kosei' && (
          <Tip title={kosei.activeName} sub={`こせい・${kosei.tagline}`} lines={[`パッシブ：${kosei.passiveJp}`, `効果：${kosei.activeJp}`]} />
        )}
        <button
          className="crayon-btn"
          disabled={!canKosei}
          onClick={() => onPick('kosei')}
          onMouseEnter={() => setOpen('kosei')}
          onMouseLeave={() => setOpen(null)}
          style={{ ...shell, borderColor: BTN_COLOR.kosei, color: 'var(--ink)', opacity: canKosei ? 1 : 0.45 }}
        >
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: BTN_COLOR.kosei }}>
            ★ {kosei.activeName}
          </span>
          <span style={{ fontSize: '0.8rem' }}>{canKosei ? 'こせいわざ（三すくみ外）' : 'いま つかえない'}</span>
          <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>{kosei.tagline}</span>
        </button>
      </div>
    </div>
  );
}

/** こせい発動のカットイン：黒帯＋紫の閃光＋斜めスライドするキャラ＋こせい名。 */
function KoseiCutIn({
  name,
  char,
  image,
  side,
  moveName,
}: {
  name: string;
  char: Character;
  image: string | null;
  side: Side;
  moveName: string;
}) {
  const kosei = getKosei(char.koseiId);
  const dir = side === 0 ? -1 : 1;
  const fullName = `${char.koseiTitle ?? ''}${kosei.name}`;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 46,
        pointerEvents: 'none',
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {/* 黒帯 */}
      <motion.div
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.18 }}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '18%',
          bottom: '18%',
          background: 'linear-gradient(90deg, rgba(30,20,50,.92), rgba(90,50,160,.86), rgba(30,20,50,.92))',
        }}
      />
      {/* 閃光の線 */}
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          initial={{ x: `${dir * -120}vw`, opacity: 0.9 }}
          animate={{ x: `${dir * 120}vw`, opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.05 + i * 0.06, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            top: `${28 + i * 12}%`,
            height: 6,
            width: '60vw',
            background: '#fff',
            filter: 'blur(1px)',
          }}
        />
      ))}
      {/* キャラ */}
      <motion.div
        initial={{ x: `${dir * 60}vw`, opacity: 0, rotate: dir * 10 }}
        animate={{ x: `${dir * -6}vw`, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.12 }}
        style={{
          position: 'relative',
          width: 'min(38vw, 160px)',
          aspectRatio: '1',
          background: '#fff',
          border: '4px solid #fff',
          borderRadius: 12,
          padding: 8,
          boxShadow: '0 0 0 6px var(--crayon-purple), 0 14px 30px rgba(0,0,0,.4)',
        }}
      >
        <CharacterSprite imageUrl={image} attribute={char.attribute} name={name} flip={side === 1} />
      </motion.div>
      {/* テキスト */}
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.28 }}
        style={{ position: 'absolute', bottom: '22%', display: 'grid', placeItems: 'center', gap: 4 }}
      >
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(1rem,3.4vw,1.3rem)', color: '#ffe08a' }}>
          ★ こせい はつどう！
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'clamp(1.4rem,5vw,2rem)',
            color: '#fff',
            WebkitTextStroke: '3px var(--crayon-purple)',
            paintOrder: 'stroke',
          }}
        >
          {fullName}
        </div>
        <div style={{ fontSize: 'clamp(0.9rem,3vw,1.1rem)', color: '#fff', fontWeight: 700 }}>「{moveName}」</div>
      </motion.div>
    </div>
  );
}

/** 勝利演出：紙吹雪 ＋ 大きな「かち！」＋ 勝者スプライトが跳ねる。 */
function VictoryOverlay({ name, char, image }: { name: string; char: Character; image: string | null }) {
  const COLORS = ['#e8503a', '#f2b705', '#1f9d63', '#3b82f6', '#7b5cf0', '#ec6a9c'];
  const bits = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.7,
        dur: 1.6 + Math.random() * 1.4,
        rot: Math.random() * 720 - 360,
        color: COLORS[i % COLORS.length],
        size: 8 + Math.random() * 8,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 45,
        pointerEvents: 'none',
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
        background: 'radial-gradient(circle at 50% 40%, rgba(242,183,5,.28), rgba(0,0,0,.28))',
      }}
    >
      {bits.map((b) => (
        <motion.div
          key={b.id}
          initial={{ y: '-12vh', x: `${b.x}vw`, rotate: 0, opacity: 1 }}
          animate={{ y: '110vh', rotate: b.rot, opacity: [1, 1, 0.6] }}
          transition={{ duration: b.dur, delay: b.delay, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: b.size,
            height: b.size * 0.6,
            background: b.color,
            borderRadius: 2,
          }}
        />
      ))}

      <motion.div
        initial={{ scale: 0.2, rotate: -12, opacity: 0 }}
        animate={{ scale: [0.2, 1.25, 1], rotate: [-12, 6, 0], opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12 }}
        style={{ display: 'grid', placeItems: 'center', gap: '0.8rem' }}
      >
        <motion.div
          animate={{ y: [0, -16, 0] }}
          transition={{ repeat: Infinity, duration: 0.7, ease: 'easeInOut' }}
          style={{
            width: 'min(40vw, 170px)',
            aspectRatio: '1',
            background: '#fff',
            border: '4px solid var(--ink)',
            borderRadius: 14,
            padding: 8,
            transform: 'rotate(-2deg)',
            boxShadow: '0 0 0 8px rgba(242,183,5,.85), 0 14px 34px rgba(0,0,0,.35)',
          }}
        >
          <CharacterSprite imageUrl={image} attribute={char.attribute} name={name} />
        </motion.div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'clamp(2rem, 9vw, 3.4rem)',
            color: '#fff',
            WebkitTextStroke: '4px var(--ink)',
            paintOrder: 'stroke',
          }}
        >
          {name} の かち！
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1rem, 3.6vw, 1.4rem)',
            color: 'var(--ink)',
            background: '#fff',
            border: '3px solid var(--ink)',
            borderRadius: 10,
            padding: '0.15em 0.9em',
            boxShadow: '3px 4px 0 rgba(0,0,0,.2)',
          }}
        >
          🎉 おめでとう 🎉
        </div>
      </motion.div>
    </div>
  );
}

/** 選んだ構えが画面中央で大きくぶつかる演出。pending→勝者 を内部で自動再生。 */
function ClashCut({
  cut,
  names,
}: {
  cut: { a: ClashStance; b: ClashStance; winner: Side | null };
  names: [string, string];
}) {
  const [resolved, setResolved] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    setResolved(false);
    setGone(false);
    const t1 = window.setTimeout(() => setResolved(true), 650);
    const t2 = window.setTimeout(() => setGone(true), 2200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [cut]);
  if (gone) return null;

  const colorOf = (st: ClashStance) => (st === 'kosei' ? 'var(--crayon-purple)' : STANCE_COLOR[st as TriStance]);

  const card = (st: ClashStance, side: Side) => {
    const mode: 'pending' | 'win' | 'lose' | 'even' = !resolved
      ? 'pending'
      : cut.winner === null
        ? 'even'
        : cut.winner === side
          ? 'win'
          : 'lose';
    const dir = side === 0 ? -1 : 1;
    return (
      <motion.div
        initial={{ x: dir * 340, opacity: 0, rotate: dir * 16 }}
        animate={
          mode === 'pending'
            ? { x: dir * 8, opacity: 1, rotate: 0, scale: [1, 1.06, 1] }
            : mode === 'win'
              ? { x: dir * 22, opacity: 1, rotate: 0, scale: 1.3 }
              : mode === 'lose'
                ? { x: dir * 170, opacity: 0.3, rotate: dir * 26, scale: 0.72 }
                : { x: dir * 16, opacity: 1, rotate: 0, scale: 1 }
        }
        transition={{ type: 'spring', stiffness: 280, damping: 16, scale: { repeat: mode === 'pending' ? Infinity : 0, duration: 0.5 } }}
        style={{
          width: 'min(36vw, 170px)',
          aspectRatio: '3 / 4',
          display: 'grid',
          placeItems: 'center',
          gap: 2,
          background: colorOf(st),
          color: '#fff',
          border: '4px solid #fff',
          borderRadius: 14,
          boxShadow: mode === 'win' ? '0 0 0 7px rgba(242,183,5,.95), 0 10px 26px rgba(0,0,0,.3)' : '0 8px 24px rgba(0,0,0,.25)',
        }}
      >
        <div style={{ fontSize: 'clamp(2.2rem, 9vw, 3.2rem)', lineHeight: 1 }}>{ICON[st]}</div>
        <div style={{ fontWeight: 900, fontSize: 'clamp(1.1rem,4vw,1.5rem)' }}>{STANCE_JP[st]}</div>
      </motion.div>
    );
  };

  const bigText = !resolved ? '' : cut.winner === null ? 'ごかく！' : `${names[cut.winner]} の かち！`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 30,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 'clamp(3rem, 16vh, 9rem)',
        background: 'rgba(0,0,0,0.14)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
        {card(cut.a, 0)}
        {!resolved && (
          <motion.div
            animate={{ scale: [1, 1.4, 1], rotate: [0, 18, -18, 0] }}
            transition={{ repeat: Infinity, duration: 0.55 }}
            style={{ fontSize: 'clamp(1.8rem,7vw,2.8rem)', margin: '0 -0.7rem', zIndex: 2 }}
          >
            💥
          </motion.div>
        )}
        {card(cut.b, 1)}
      </div>
      {bigText && (
        <motion.div
          initial={{ scale: 0.4, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          style={{
            marginTop: '1.1rem',
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'clamp(1.4rem,5.5vw,2rem)',
            color: 'var(--ink)',
            background: '#fff',
            border: '3px solid var(--ink)',
            borderRadius: 10,
            padding: '0.2em 0.9em',
            boxShadow: '3px 4px 0 rgba(0,0,0,.2)',
          }}
        >
          {bigText}
        </motion.div>
      )}
    </div>
  );
}

function FighterPanel({
  side,
  char,
  image,
  hp,
  maxHp,
  statuses,
  acting,
  shake,
  floats,
}: {
  side: Side;
  char: Character;
  image: string | null;
  hp: number;
  maxHp: number;
  statuses: StatusChip[];
  acting: boolean;
  shake: boolean;
  floats: Floating[];
}) {
  const pct = Math.max(0, (hp / maxHp) * 100);
  const low = pct <= 30;
  const cc = catCounts(char);
  const dir = side === 0 ? 1 : -1;

  return (
    <div className="sketch-card" style={{ flex: 1, minWidth: 0, padding: '0.55rem', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 'clamp(.9rem,2.5vw,1.1rem)' }}>{char.name}</strong>
        <AttributeBadge attribute={char.attribute} size={0.8} />
        {low && <span style={{ color: 'var(--crayon-red)', fontWeight: 700, fontSize: '0.8rem' }}>ピンチ！</span>}
      </div>
      <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{archetypeLabel(char.baseStats)}</div>

      <motion.div
        animate={
          shake
            ? { x: [0, -13, 13, -9, 7, 0], rotate: [0, -3, 3, 0] }
            : acting
              ? { x: dir * 30, scale: 1.06 }
              : { x: 0, scale: 1 }
        }
        transition={{ duration: shake ? 0.34 : 0.16 }}
        style={{ position: 'relative', margin: '0.4rem 0' }}
      >
        <div
          style={{
            width: 'min(28vw, 122px)',
            aspectRatio: '1',
            margin: '0 auto',
            background: '#fff',
            border: '2px solid var(--border)',
            borderRadius: 8,
            padding: 6,
            transform: `rotate(${dir * -1.5}deg)`,
            boxShadow: shake ? '0 0 0 5px rgba(214,69,69,.6)' : acting ? '0 0 0 4px rgba(242,183,5,.7)' : '2px 3px 0 rgba(51,48,43,.15)',
          }}
        >
          <CharacterSprite imageUrl={image} attribute={char.attribute} name={char.name} flip={side === 1} />
        </div>
        {floats.map((f, i) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 10, scale: 0.6 }}
            animate={{ opacity: 1, y: -30 - (floats.length - 1 - i) * 22, scale: 1 }}
            style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              transform: 'translateX(-50%)',
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: f.kind === 'dmg' ? (f.big ? '2.2rem' : '1.4rem') : '1.05rem',
              color: f.kind === 'heal' ? 'var(--crayon-green)' : f.kind === 'dmg' ? 'var(--crayon-red)' : 'var(--crayon-purple)',
              WebkitTextStroke: f.kind === 'dmg' ? '2px #fff' : undefined,
              paintOrder: 'stroke',
              whiteSpace: 'nowrap',
            }}
          >
            {f.text}
          </motion.div>
        ))}
      </motion.div>

      <div style={{ background: '#0001', borderRadius: 6, height: 20, overflow: 'hidden', border: '2px solid var(--border)' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: low ? 'var(--crayon-red)' : 'var(--crayon-green)',
            transition: 'width .4s cubic-bezier(.2,.8,.2,1)',
          }}
        />
      </div>
      <div style={{ fontSize: 'clamp(1.05rem,3.4vw,1.35rem)', fontWeight: 700 }}>
        {Math.max(0, Math.round(hp))} <span style={{ fontSize: '0.7em', opacity: 0.6 }}>/ {maxHp}</span>
      </div>

      <div style={{ display: 'flex', gap: 6, fontSize: '0.72rem', marginTop: 2 }}>
        {TRI.map((cat) => (
          <span key={cat} style={{ color: STANCE_COLOR[cat] }}>
            {ICON[cat]}
            {cc[cat]}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3, minHeight: 16 }}>
        {statuses.map((s, i) => (
          <span
            key={i}
            style={{
              fontSize: '0.68rem',
              padding: '1px 5px',
              borderRadius: 5,
              background: s.good ? 'rgba(58,166,97,.18)' : 'rgba(236,106,156,.18)',
            }}
          >
            {s.jp}
          </span>
        ))}
      </div>
    </div>
  );
}
