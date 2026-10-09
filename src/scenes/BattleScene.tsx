import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../store/gameStore';
import {
  createClashState,
  resolveClashTurn,
  cpuChoose,
  dealHand,
  koseiReady,
  archetypeLabel,
  getKosei,
  mulberry32,
  type ClashState,
  type ClashEvent,
  type ClashChoice,
  type ClashCombatant,
  type RevealCard,
  type Side,
} from '../engine';
import { STATUS_META } from '../engine/status';
import { getMove, type MoveDef } from '../engine/moves';
import { ATTRIBUTE_META } from '../engine/attributes';
import type { Attribute, Character, Stats } from '../engine/types';
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
  if (m.buff?.stat === 'def') out.push('3ターン、うけるダメージ -40%');
  else if (m.buff) out.push(`${STAT_JP[m.buff.stat]} アップ（${m.buff.turns}ターン）`);
  if (m.debuff?.stat === 'def') out.push('あいての うけるダメージ +30%');
  else if (m.debuff) out.push(`あいての ${STAT_JP[m.debuff.stat]} ダウン`);
  if (m.guardPct) out.push('2ターン、うけるダメージが 半分');
  if (m.reflect) out.push('2ターン、うけたダメージの 3わり を返す');
  if (m.drain) out.push(`与ダメの ${m.drain}% 回復`);
  if (m.recoil) out.push(`反動 ${m.recoil}%`);
  return out;
}

/** ボタンに1個だけ出す「何が起きる技か」の短いことば。 */
function moveGist(m: MoveDef): string | null {
  if (m.heal || m.cures) return 'かいふく';
  if (m.status && !m.status.toSelf) return `${STATUS_META[m.status.kind].jp}をねらう`;
  if (m.guardPct) return 'ダメージ 半分（2ターン）';
  if (m.reflect) return 'ダメージ 3わり返す（2ターン）';
  if (m.buff?.stat === 'def') return 'ダメージ -40%（3ターン）';
  if (m.buff) return `${STAT_JP[m.buff.stat]}アップ`;
  if (m.debuff?.stat === 'def') return 'あいて ダメージ +30%';
  if (m.debuff) return `あいて ${STAT_JP[m.debuff.stat]}ダウン`;
  if (m.drain) return 'すいとり';
  if (m.first) return 'かならず せんせい';
  if (m.pierce) return 'ぼうぎょ むし';
  return null;
}

/** 大きく見せたい damage tag。 */
const LOUD_TAGS = new Set(['クリティカル', 'カウンター', 'こんじょう', 'ばつぐん']);

const KOSEI_COLOR = 'var(--crayon-purple)';
const SUPPORT_COLOR = '#1f9d63';
const ATTACK_COLOR = '#e8503a';

function cardColor(c: { kind: 'attack' | 'support' | 'kosei'; attribute: Attribute | null }): string {
  if (c.kind === 'kosei') return KOSEI_COLOR;
  if (c.attribute) return ATTRIBUTE_META[c.attribute].color;
  return c.kind === 'support' ? SUPPORT_COLOR : ATTACK_COLOR;
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
  cut: [RevealCard, RevealCard] | null;
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
        add('ふたりの カードが ひらかれた！', { cut: ev.cards, ms: 2200 });
        break;
      case 'act':
        if (ev.kind === 'kosei') {
          acting = ev.side;
          add(`${names[ev.side]} こせい はつどう！`, {
            koseiAct: { side: ev.side, moveName: ev.moveName },
            ms: 2600,
          });
        } else if (ev.kind === 'blocked') {
          add(`${names[ev.side]} は ${ev.moveName.replace(/[（）]/g, '')}`);
        } else if (ev.kind === 'support') {
          add(`${names[ev.side]} は ほじょわざ ―「${ev.moveName}」`);
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

  const matchup = 'わざの ぞくせいが あいてに あうと じょうたいいじょうが 入りやすい（火→木→水→火）';

  const [phase, setPhase] = useState<Phase>('choose-p1');
  const [p1Pick, setP1Pick] = useState<ClashChoice | null>(null);
  const [flash, setFlash] = useState(false);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [beatIdx, setBeatIdx] = useState(0);
  const pendingNext = useRef<ClashState | null>(null);
  const [view, setView] = useState<View>({
    hp: [maxHp[0], maxHp[1]],
    statuses: [[], []],
    banner: 'ターン 1：カードを 1まい えらぶ',
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

  function submit(myChoice: ClashChoice, foeChoice: ClashChoice) {
    if (phase === 'animating' || state.done) return;
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
          : `ターン ${next.turn}：カードを 1まい えらぶ`,
      acting: null,
      shake: null,
      floats: [],
    });
    setPhase(next.done ? 'over' : 'choose-p1');
  }

  function pickSolo(choice: ClashChoice) {
    if (phase !== 'choose-p1' || state.done) return;
    const rng = mulberry32((state.seed + state.turn * 2654435761) >>> 0);
    submit(choice, cpuChoose(state, 1, rng));
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
  const chooserSide: Side = phase === 'choose-p2' ? 1 : 0;
  const hand = useMemo(() => dealHand(state, chooserSide), [state, chooserSide]);
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
      {curBeat?.cut && <RevealCut key={beatIdx} cards={curBeat.cut} names={names} />}
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
          {mode === 'versus' && (
            <div style={{ fontWeight: 700, color: phase === 'choose-p2' ? 'var(--crayon-blue)' : 'var(--crayon-red)' }}>
              {phase === 'choose-p2' ? `P2（${names[1]}）` : `P1（${names[0]}）`} の てふだ
            </div>
          )}
          <HandCards
            key={`${state.turn}-${chooserSide}`}
            hand={hand}
            me={state.combatants[chooserSide]}
            onPick={phase === 'choose-p2' ? pickP2 : mode === 'versus' ? pickP1 : pickSolo}
          />
        </>
      )}
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

/** 配られた手札3枚。1枚えらぶ。 */
function HandCards({ hand, me, onPick }: { hand: ClashChoice[]; me: ClashCombatant; onPick: (c: ClashChoice) => void }) {
  const kosei = getKosei(me.koseiId);
  const [open, setOpen] = useState<string | null>(null);

  const cardShell: React.CSSProperties = {
    width: 'min(29vw, 10.5rem)',
    minHeight: '9.2rem',
    padding: '0.6em 0.5em',
    lineHeight: 1.2,
    display: 'grid',
    alignContent: 'start',
    gap: 4,
    textAlign: 'center',
  };

  return (
    <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', width: '100%', maxWidth: '48rem' }}>
      {hand.map((id, i) => {
        const tilt = (i - 1) * 2.2;
        if (id === 'kosei' && koseiReady(me)) {
          return (
            <div key={id} style={{ position: 'relative', display: 'flex', transform: `rotate(${tilt}deg)` }}>
              {open === id && (
                <Tip title={kosei.activeName} sub={`こせい・${kosei.tagline}`} lines={[`パッシブ：${kosei.passiveJp}`, `効果：${kosei.activeJp}`]} />
              )}
              <button
                className="crayon-btn"
                onClick={() => onPick('kosei')}
                onMouseEnter={() => setOpen(id)}
                onMouseLeave={() => setOpen(null)}
                style={{ ...cardShell, borderColor: KOSEI_COLOR, color: 'var(--ink)', background: '#f6f0ff' }}
              >
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: KOSEI_COLOR }}>★ こせいわざ！</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: KOSEI_COLOR }}>{kosei.activeName}</span>
                <span style={{ fontSize: '0.76rem', opacity: 0.9 }}>{kosei.activeJp}</span>
                <span style={{ fontSize: '0.68rem', opacity: 0.7 }}>先に うごく</span>
              </button>
            </div>
          );
        }
        let m: MoveDef | null = null;
        try {
          m = getMove(id);
        } catch {
          m = null;
        }
        if (!m) return null;
        const isAtk = m.category === 'attack';
        const color = cardColor({ kind: isAtk ? 'attack' : 'support', attribute: m.attribute });
        const gist = moveGist(m);
        const quick = !!(m.first || m.guardPct || m.reflect || m.buff?.stat === 'def');
        return (
          <div key={id} style={{ position: 'relative', display: 'flex', transform: `rotate(${tilt}deg)` }}>
            {open === id && <Tip title={m.name} sub={isAtk ? 'こうげき' : 'ほじょ'} lines={moveDetailLines(m)} desc={m.desc || undefined} />}
            <button
              className="crayon-btn"
              onClick={() => onPick(id)}
              onMouseEnter={() => setOpen(id)}
              onMouseLeave={() => setOpen(null)}
              style={{ ...cardShell, borderColor: color, color: 'var(--ink)' }}
            >
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color }}>
                {isAtk ? '⚔ こうげき' : '✚ ほじょ'}
                {m.attribute ? `・${ATTRIBUTE_META[m.attribute].jp}` : ''}
              </span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color }}>「{m.name}」</span>
              {isAtk && <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>いりょく {m.power}</span>}
              {gist && <span style={{ fontSize: '0.76rem', opacity: 0.9 }}>{gist}</span>}
              {quick && <span style={{ fontSize: '0.68rem', opacity: 0.7 }}>先に うごく</span>}
            </button>
          </div>
        );
      })}
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

/** ふたりが選んだカードが画面中央にめくられる演出。 */
function RevealCut({ cards, names }: { cards: [RevealCard, RevealCard]; names: [string, string] }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    setGone(false);
    const t = window.setTimeout(() => setGone(true), 2000);
    return () => window.clearTimeout(t);
  }, [cards]);
  if (gone) return null;

  const card = (c: RevealCard, side: Side) => {
    const dir = side === 0 ? -1 : 1;
    const color = cardColor(c);
    return (
      <motion.div
        initial={{ x: dir * 300, opacity: 0, rotate: dir * 16 }}
        animate={{ x: dir * 10, opacity: 1, rotate: dir * -3 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        style={{
          width: 'min(36vw, 170px)',
          aspectRatio: '3 / 4',
          display: 'grid',
          placeItems: 'center',
          alignContent: 'center',
          gap: 6,
          background: color,
          color: '#fff',
          border: '4px solid #fff',
          borderRadius: 14,
          padding: 8,
          textAlign: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,.28)',
        }}
      >
        <div style={{ fontSize: 'clamp(1.8rem, 7vw, 2.6rem)', lineHeight: 1 }}>
          {c.kind === 'kosei' ? '★' : c.kind === 'support' ? '✚' : '⚔'}
        </div>
        <div style={{ fontWeight: 900, fontSize: 'clamp(1rem,3.6vw,1.3rem)' }}>{c.name}</div>
        <div style={{ fontSize: '0.74rem', opacity: 0.9 }}>{names[side]}</div>
      </motion.div>
    );
  };

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
        paddingTop: 'clamp(3rem, 16vh, 9rem)',
        background: 'rgba(0,0,0,0.14)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {card(cards[0], 0)}
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.6rem', color: '#fff', WebkitTextStroke: '3px var(--ink)', paintOrder: 'stroke' }}>
          VS
        </div>
        {card(cards[1], 1)}
      </div>
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
  const dir = side === 0 ? 1 : -1;

  return (
    <div className="sketch-card" style={{ flex: 1, minWidth: 0, padding: '0.55rem', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 'clamp(.9rem,2.5vw,1.1rem)' }}>{char.name}</strong>
        <AttributeBadge attribute={char.attribute} size={0.8} />
        {low && <span style={{ color: 'var(--crayon-red)', fontWeight: 700, fontSize: '0.8rem' }}>ピンチ！</span>}
      </div>
      <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{archetypeLabel(char.baseStats)}</div>
      {(() => {
        const k = getKosei(char.koseiId);
        return (
          <div style={{ fontSize: '0.66rem', color: 'var(--crayon-purple)', lineHeight: 1.25, marginTop: 1 }}>
            ★{char.koseiTitle ?? ''}{k.name}
            <br />
            <span style={{ color: 'var(--ink-soft)' }}>パッシブ：{k.passiveJp}</span>
          </div>
        );
      })()}

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
