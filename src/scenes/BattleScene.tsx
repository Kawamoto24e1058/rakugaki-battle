import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../store/gameStore';
import {
  createClashState,
  resolveClashTurn,
  cpuClashStance,
  koseiReady,
  moveCategory,
  stanceMoveDef,
  archetypeLabel,
  getKosei,
  mulberry32,
  STANCE_JP,
  STANCE_COLOR,
  STANCE_BEATS,
  type ClashState,
  type ClashEvent,
  type ClashStance,
  type ClashCombatant,
  type TriStance,
  type Side,
} from '../engine';
import { STATUS_META } from '../engine/status';
import { getMove, type MoveDef } from '../engine/moves';
import { ATTRIBUTE_META, attributeMatchup } from '../engine/attributes';
import type { Character } from '../engine/types';
import { CharacterSprite, AttributeBadge } from '../components/bits';

const CAT_WORD: Record<MoveDef['category'], string> = { attack: 'こうげき', support: 'ほじょ' };

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
  if (m.buff) out.push(`${m.buff.stat} アップ（${m.buff.turns}ターン）`);
  if (m.debuff) out.push(`あいての ${m.debuff.stat} ダウン`);
  if (m.guardPct) out.push(`このターン 被ダメ -${m.guardPct}%`);
  if (m.reflect) out.push(`受けたダメージを ${m.reflect}% 返す`);
  if (m.drain) out.push(`与ダメの ${m.drain}% 回復`);
  if (m.recoil) out.push(`反動 ${m.recoil}%`);
  if (m.cooldown > 0) out.push(`クールダウン ${m.cooldown}`);
  return out;
}

const TRI: TriStance[] = ['power', 'tech', 'speed'];
const ICON: Record<ClashStance, string> = { power: '👊', tech: '✨', speed: '💨', kosei: '★' };
const BTN_COLOR: Record<ClashStance, string> = {
  power: STANCE_COLOR.power,
  tech: STANCE_COLOR.tech,
  speed: STANCE_COLOR.speed,
  kosei: 'var(--crayon-purple)',
};
const LOSES_TO: Record<TriStance, TriStance> = { power: 'speed', tech: 'power', speed: 'tech' };
/** 大きく見せたい damage tag。 */
const LOUD_TAGS = new Set(['ばつぐん', 'いまひとつ', 'クリティカル', 'こんしん', 'カウンター']);

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
interface View {
  hp: [number, number];
  statuses: [{ jp: string; good: boolean }[], { jp: string; good: boolean }[]];
  banner: string;
  acting: Side | null;
  shake: Side | null;
  floats: Floating[];
}

type Phase = 'choose-p1' | 'handoff' | 'choose-p2' | 'animating' | 'over';

let floatSeq = 0;

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
    if (m === 'strong') return `${j0} は ${j1} に つよい！（${names[0]} 有利）`;
    if (m === 'weak') return `${j1} は ${j0} に つよい！（${names[1]} 有利）`;
    return `${j0} と ${j1}：属性の 有利不利なし`;
  }, [chars, names]);

  const [phase, setPhase] = useState<Phase>('choose-p1');
  const [p1Pick, setP1Pick] = useState<ClashStance | null>(null);
  const [lastPair, setLastPair] = useState<[ClashStance, ClashStance] | null>(null);
  const [clashCut, setClashCut] = useState<{ a: ClashStance; b: ClashStance; winner: Side | null | 'pending' } | null>(null);
  const [flash, setFlash] = useState(false);
  const [impact, setImpact] = useState<string | null>(null);
  const [view, setView] = useState<View>({
    hp: [maxHp[0], maxHp[1]],
    statuses: [[], []],
    banner: 'よみあい！ 力 / 技 / 速さ を えらぶ',
    acting: null,
    shake: null,
    floats: [],
  });
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (phase !== 'over') return;
    const t = window.setTimeout(() => finishBattle(state.winner === 0), 1700);
    return () => clearTimeout(t);
  }, [phase, state.winner, finishBattle]);

  function statusView(side: Side, st: ClashState) {
    return st.combatants[side].statuses.map((s) => ({
      jp: STATUS_META[s.kind].jp,
      good: STATUS_META[s.kind].kind === 'buff',
    }));
  }

  function submit(myStance: ClashStance, foeStance: ClashStance) {
    if (phase === 'animating' || state.done) return;
    setLastPair([myStance, foeStance]);
    setPhase('animating');
    setView((v) => ({ ...v, banner: 'せーの！' }));
    const next = resolveClashTurn(state, [myStance, foeStance]);
    play(next.log.slice(state.log.length), next);
  }

  function pickSolo(stance: ClashStance) {
    if (phase !== 'choose-p1' || state.done) return;
    const rng = mulberry32((state.seed + state.turn * 2654435761) >>> 0);
    submit(stance, cpuClashStance(state, 1, rng));
  }
  function pickP1(stance: ClashStance) {
    if (phase !== 'choose-p1') return;
    setP1Pick(stance);
    setPhase('handoff');
  }
  function pickP2(stance: ClashStance) {
    if (phase !== 'choose-p2' || !p1Pick) return;
    submit(p1Pick, stance);
    setP1Pick(null);
  }

  function play(events: ClashEvent[], next: ClashState) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    let t = 250;
    const v: View = {
      hp: [...view.hp] as [number, number],
      statuses: [[], []],
      banner: 'せーの！',
      acting: null,
      shake: null,
      floats: [],
    };
    const commit = () => {
      const snap: View = { ...v, hp: [...v.hp] as [number, number], floats: [...v.floats] };
      timers.current.push(window.setTimeout(() => setView(snap), t));
    };
    const step = (fn: () => void, gap: number) => {
      timers.current.push(window.setTimeout(fn, t));
      t += gap;
    };
    const addFloat = (side: Side, text: string, kind: Floating['kind'], big = false) => {
      const id = ++floatSeq;
      v.floats = [...v.floats, { id, side, text, kind, big }];
      timers.current.push(
        window.setTimeout(
          () => setView((prev) => ({ ...prev, floats: prev.floats.filter((f) => f.id !== id) })),
          t + 1200,
        ),
      );
    };
    const at = (fn: () => void, extraMs = 0) => timers.current.push(window.setTimeout(fn, t + extraMs));

    let cutCleared = false;
    for (const ev of events) {
      switch (ev.t) {
        case 'reveal':
          step(() => {
            setClashCut({ a: ev.stances[0], b: ev.stances[1], winner: 'pending' });
            v.banner = 'せーの！';
            commit();
          }, 900);
          break;
        case 'clash':
          step(() => {
            setClashCut((c) => (c ? { ...c, winner: ev.winner } : c));
            v.banner = ev.winner === null ? '五分！' : `${names[ev.winner]} ${ev.note}`;
            commit();
          }, 1150);
          break;
        case 'act':
          step(() => {
            if (!cutCleared) {
              setClashCut(null);
              cutCleared = true;
            }
            v.acting = ev.side;
            v.banner = `${names[ev.side]} → ${ev.moveName}！`;
            commit();
          }, 480);
          step(() => {
            v.acting = null;
            commit();
          }, 90);
          break;
        case 'damage': {
          const loud = !!ev.tag && LOUD_TAGS.has(ev.tag);
          const big = loud || ev.amount >= 26;
          step(() => {
            v.hp[ev.side] = ev.hpAfter;
            v.shake = ev.side;
            addFloat(ev.side, `${ev.amount}`, 'dmg', big);
            commit();
            setFlash(true);
            at(() => setFlash(false), 120);
            if (ev.tag && LOUD_TAGS.has(ev.tag)) {
              setImpact(`${ev.tag}！`);
              at(() => setImpact(null), 800);
            }
          }, big ? 130 : 90);
          step(() => {
            v.shake = null;
            commit();
          }, big ? 480 : 360);
          break;
        }
        case 'heal':
          step(() => {
            v.hp[ev.side] = ev.hpAfter;
            addFloat(ev.side, `+${ev.amount}`, 'heal');
            commit();
          }, 420);
          break;
        case 'consolation':
          step(() => {
            v.hp[ev.side] = Math.min(maxHp[ev.side], v.hp[ev.side] + ev.amount);
            addFloat(ev.side, `立て直し +${ev.amount}`, 'heal');
            commit();
          }, 360);
          break;
        case 'status-apply':
          step(() => {
            v.banner = `${names[ev.side]} は ${STATUS_META[ev.kind].jp}！`;
            addFloat(ev.side, STATUS_META[ev.kind].jp, 'info');
            commit();
          }, 460);
          break;
        case 'status-resist':
          step(() => {
            v.banner = `${names[ev.side]} は こうかなし`;
            commit();
          }, 280);
          break;
        case 'status-tick':
          step(() => {
            v.hp[ev.side] = ev.hpAfter;
            addFloat(ev.side, `${STATUS_META[ev.kind].jp} ${ev.amount}`, 'dmg');
            commit();
          }, 440);
          break;
        case 'sudden-death':
          step(() => {
            v.banner = `サドンデス！ ${names[ev.leader]}（リード）が おおきく けずられる`;
            setImpact('サドンデス！');
            at(() => setImpact(null), 900);
            commit();
          }, 640);
          break;
        case 'end':
          step(() => {
            v.banner = ev.winner === 'draw' ? 'ひきわけ！' : `${names[ev.winner]} の かち！`;
            commit();
          }, 360);
          break;
        default:
          break;
      }
    }

    step(() => {
      setClashCut(null);
      setImpact(null);
      setState(next);
      setView({
        hp: [next.combatants[0].hp, next.combatants[1].hp],
        statuses: [statusView(0, next), statusView(1, next)],
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
    }, 40);
  }

  const pinch = view.hp.some((h, i) => h > 0 && h / maxHp[i] <= 0.3);
  const chooser: ClashCombatant = phase === 'choose-p2' ? state.combatants[1] : state.combatants[0];

  return (
    <div className="scene" style={{ justifyContent: 'flex-start', paddingTop: 'clamp(.4rem,2vh,1rem)', gap: '0.7rem' }}>
      {pinch && <div className="pinch-vignette" />}
      {flash && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,.55)', zIndex: 25, pointerEvents: 'none' }} />
      )}
      {impact && (
        <motion.div
          key={impact}
          initial={{ scale: 0.3, opacity: 0, rotate: -6 }}
          animate={{ scale: [0.3, 1.2, 1], opacity: 1, rotate: [-6, 3, 0] }}
          style={{
            position: 'fixed',
            top: '34%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 28,
            pointerEvents: 'none',
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'clamp(1.6rem, 7vw, 2.8rem)',
            color: '#fff',
            WebkitTextStroke: '3px var(--ink)',
            paintOrder: 'stroke',
          }}
        >
          {impact}
        </motion.div>
      )}
      {clashCut && <ClashCut cut={clashCut} names={names} />}

      <div style={{ display: 'flex', gap: 'clamp(.6rem,3vw,1.5rem)', width: '100%', maxWidth: '48rem' }}>
        {[0, 1].map((s) => (
          <FighterPanel
            key={s}
            side={s as Side}
            char={chars[s]}
            image={images[s]}
            hp={view.hp[s]}
            maxHp={maxHp[s]}
            statuses={view.statuses[s]}
            acting={view.acting === s}
            shake={view.shake === s}
            floats={view.floats.filter((f) => f.side === s)}
          />
        ))}
      </div>

      <div
        className="sketch-card"
        style={{ width: '100%', maxWidth: '48rem', minHeight: '2.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontWeight: 700, padding: '0.45rem 1rem' }}
      >
        {view.banner}
      </div>

      <div style={{ fontSize: '0.76rem', color: 'var(--ink-soft)' }}>{matchup}</div>

      <TriangleGuide />

      {phase === 'over' ? (
        <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>けっかへ…</div>
      ) : phase === 'animating' ? (
        <div style={{ fontSize: '0.85rem', opacity: 0.55, minHeight: '4.5rem', display: 'grid', placeItems: 'center' }}>…</div>
      ) : phase === 'handoff' ? (
        <div style={{ display: 'grid', gap: '0.8rem', placeItems: 'center' }}>
          <div style={{ fontWeight: 700 }}>P1 は えらんだ！ がめんを P2 にわたして…</div>
          <button className="crayon-btn primary big" onClick={() => setPhase('choose-p2')}>
            P2 の ばん →
          </button>
        </div>
      ) : (
        <>
          {mode === 'versus' && (
            <div style={{ fontWeight: 700, color: phase === 'choose-p2' ? 'var(--crayon-blue)' : 'var(--crayon-red)' }}>
              {phase === 'choose-p2' ? `P2（${names[1]}）` : `P1（${names[0]}）`} が えらぶ
            </div>
          )}
          <StanceButtons
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
  // viewBox 300x232。速さ=上、力=右下、技=左下。
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
  // 勝つ方向: 速さ→力, 力→技, 技→速さ
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
      <svg width="236" height="182" viewBox="0 0 300 232" role="img" aria-label="速さは力に、力は技に、技は速さに勝つ">
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

function StanceButtons({ onPick, me }: { onPick: (s: ClashStance) => void; me: ClashCombatant }) {
  const kosei = getKosei(me.koseiId);
  const canKosei = koseiReady(me);
  const [hover, setHover] = useState<ClashStance | null>(null);

  const bigBtn: React.CSSProperties = {
    minWidth: '9rem',
    fontWeight: 700,
    padding: '0.55em 0.9em',
    fontSize: '1.15rem',
    lineHeight: 1.15,
  };

  const triBtn = (s: TriStance) => {
    const mv = stanceMoveDef(me, s);
    const powWord = mv.category === 'attack' ? `威力 ${mv.power}` : 'ほじょ';
    return (
      <div key={s} style={{ position: 'relative' }} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(null)}>
        {hover === s && (
          <Tip title={mv.name} sub={`${STANCE_JP[s]}・${CAT_WORD[mv.category]}`} lines={moveDetailLines(mv)} desc={mv.desc || undefined} />
        )}
        <button className="crayon-btn" onClick={() => onPick(s)} style={{ ...bigBtn, borderColor: BTN_COLOR[s], color: BTN_COLOR[s] }}>
          {ICON[s]} {STANCE_JP[s]}
          <span style={{ display: 'block', fontSize: '0.66em', opacity: 0.95, marginTop: 2 }}>
            「{mv.name}」<span style={{ opacity: 0.7 }}>{powWord}</span>
          </span>
          <span style={{ display: 'block', fontSize: '0.55em', opacity: 0.8, color: STANCE_COLOR[STANCE_BEATS[s]] }}>
            {STANCE_JP[STANCE_BEATS[s]]}に かつ ／ {STANCE_JP[LOSES_TO[s]]}に よわい
          </span>
        </button>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: '48rem' }}>
      {TRI.map(triBtn)}
      <div style={{ position: 'relative' }} onMouseEnter={() => setHover('kosei')} onMouseLeave={() => setHover(null)}>
        {hover === 'kosei' && (
          <Tip title={kosei.activeName} sub={`こせい・${kosei.tagline}`} lines={[`パッシブ：${kosei.passiveJp}`, `効果：${kosei.activeJp}`]} />
        )}
        <button
          className="crayon-btn"
          disabled={!canKosei}
          onClick={() => onPick('kosei')}
          style={{ ...bigBtn, borderColor: BTN_COLOR.kosei, color: BTN_COLOR.kosei, opacity: canKosei ? 1 : 0.45 }}
        >
          ★ こせい
          <span style={{ display: 'block', fontSize: '0.6em', opacity: 0.85, marginTop: 2 }}>
            {canKosei ? kosei.activeName : 'いま つかえない'}
          </span>
        </button>
      </div>
    </div>
  );
}

/** 選んだ構えが画面中央で大きくぶつかる演出。 */
function ClashCut({
  cut,
  names,
}: {
  cut: { a: ClashStance; b: ClashStance; winner: Side | null | 'pending' };
  names: [string, string];
}) {
  const colorOf = (st: ClashStance) => (st === 'kosei' ? 'var(--crayon-purple)' : STANCE_COLOR[st as TriStance]);

  const card = (st: ClashStance, side: Side) => {
    const mode: 'pending' | 'win' | 'lose' | 'even' =
      cut.winner === 'pending' ? 'pending' : cut.winner === null ? 'even' : cut.winner === side ? 'win' : 'lose';
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

  const bigText = cut.winner === 'pending' ? '' : cut.winner === null ? 'ごかく！' : `${names[cut.winner]} の かち！`;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 30, pointerEvents: 'none', display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.16)' }}>
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
        {card(cut.a, 0)}
        {cut.winner === 'pending' && (
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
            position: 'absolute',
            bottom: '28%',
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
  statuses: { jp: string; good: boolean }[];
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
