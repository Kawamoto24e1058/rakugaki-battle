import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../store/gameStore';
import {
  createClashState,
  resolveClashTurn,
  cpuClashStance,
  koseiReady,
  konshinReady,
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
  type ClashCombatant,
  type TriStance,
  type Side,
} from '../engine';
import { STATUS_META } from '../engine/status';
import { getMove } from '../engine/moves';
import type { Character } from '../engine/types';
import { CharacterSprite, AttributeBadge } from '../components/bits';

const TRI: TriStance[] = ['power', 'tech', 'speed'];
const ICON: Record<ClashStance, string> = { power: '👊', tech: '✨', speed: '💨', kosei: '★', konshin: '🔥' };
const BTN_COLOR: Record<ClashStance, string> = {
  power: STANCE_COLOR.power,
  tech: STANCE_COLOR.tech,
  speed: STANCE_COLOR.speed,
  kosei: 'var(--crayon-purple)',
  konshin: '#c98a00',
};

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
}
interface View {
  hp: [number, number];
  statuses: [{ jp: string; good: boolean }[], { jp: string; good: boolean }[]];
  banner: string;
  acting: Side | null;
  shake: Side | null;
  floats: Floating[];
}

type Phase = 'choose-p1' | 'handoff' | 'choose-p2' | 'playing' | 'over';

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

  const [phase, setPhase] = useState<Phase>(mode === 'versus' ? 'choose-p1' : 'playing');
  const [p1Pick, setP1Pick] = useState<ClashStance | null>(null);
  const [lastPair, setLastPair] = useState<[ClashStance, ClashStance] | null>(null);
  const [view, setView] = useState<View>({
    hp: [maxHp[0], maxHp[1]],
    statuses: [[], []],
    banner: 'ちからだめし！ 力 / 技 / 速さ を えらぶ',
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

  const me = state.combatants[0];
  const canKosei = koseiReady(me);
  const canKonshin = konshinReady(me);

  function statusView(side: Side, st: ClashState) {
    return st.combatants[side].statuses.map((s) => ({
      jp: STATUS_META[s.kind].jp,
      good: STATUS_META[s.kind].kind === 'buff',
    }));
  }

  function submit(myStance: ClashStance, foeStance: ClashStance) {
    setLastPair([myStance, foeStance]);
    const next = resolveClashTurn(state, [myStance, foeStance]);
    const events = next.log.slice(state.log.length);
    setPhase('playing');
    play(events, next);
  }

  function pickSolo(stance: ClashStance) {
    if (phase !== 'playing' || state.done) return;
    const rng = mulberry32((state.seed + state.turn * 2654435761) >>> 0);
    submit(stance, cpuClashStance(state, 1, rng));
  }
  function pickP1(stance: ClashStance) {
    setP1Pick(stance);
    setPhase('handoff');
  }
  function pickP2(stance: ClashStance) {
    if (!p1Pick) return;
    submit(p1Pick, stance);
    setP1Pick(null);
  }

  function play(events: ClashEvent[], next: ClashState) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    let t = 0;
    const v: View = {
      hp: [...view.hp] as [number, number],
      statuses: [[], []],
      banner: view.banner,
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
    const addFloat = (side: Side, text: string, kind: Floating['kind']) => {
      const id = ++floatSeq;
      v.floats = [...v.floats, { id, side, text, kind }];
      timers.current.push(
        window.setTimeout(
          () => setView((prev) => ({ ...prev, floats: prev.floats.filter((f) => f.id !== id) })),
          t + 1100,
        ),
      );
    };

    for (const ev of events) {
      switch (ev.t) {
        case 'reveal':
          step(() => {
            v.banner = `${names[0]}「${STANCE_JP[ev.stances[0]]}」 × ${names[1]}「${STANCE_JP[ev.stances[1]]}」 せーの！`;
            commit();
          }, 600);
          break;
        case 'clash':
          step(() => {
            v.banner = ev.winner === null ? '五分！' : `${names[ev.winner]} ${ev.note}`;
            commit();
          }, 620);
          break;
        case 'act':
          step(() => {
            v.acting = ev.side;
            v.banner = `${names[ev.side]} → ${ev.moveName}`;
            commit();
          }, 420);
          step(() => {
            v.acting = null;
            commit();
          }, 90);
          break;
        case 'damage':
          step(() => {
            v.hp[ev.side] = ev.hpAfter;
            v.shake = ev.side;
            addFloat(ev.side, `-${ev.amount}${ev.tag ? ` ${ev.tag}` : ''}`, 'dmg');
            commit();
          }, 200);
          step(() => {
            v.shake = null;
            commit();
          }, 340);
          break;
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
            commit();
          }, 400);
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
            addFloat(ev.side, `${STATUS_META[ev.kind].jp} -${ev.amount}`, 'dmg');
            commit();
          }, 420);
          break;
        case 'sudden-death':
          step(() => {
            v.banner = `サドンデス！ ${names[ev.leader]}（リード）が おおきく けずられる`;
            commit();
          }, 560);
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
      setState(next);
      setView({
        hp: [next.combatants[0].hp, next.combatants[1].hp],
        statuses: [statusView(0, next), statusView(1, next)],
        banner: next.done
          ? next.winner === 'draw'
            ? 'ひきわけ'
            : `${names[next.winner as Side]} の かち！`
          : mode === 'versus'
            ? `ターン ${next.turn}：P1 が えらぶ`
            : `ターン ${next.turn}：力 / 技 / 速さ を えらぶ`,
        acting: null,
        shake: null,
        floats: [],
      });
      setPhase(next.done ? 'over' : mode === 'versus' ? 'choose-p1' : 'playing');
    }, 0);
  }

  const pinch = view.hp.some((h, i) => h > 0 && h / maxHp[i] <= 0.3);

  return (
    <div className="scene" style={{ justifyContent: 'flex-start', paddingTop: 'clamp(.5rem,3vh,1.5rem)', gap: '0.9rem' }}>
      {pinch && <div className="pinch-vignette" />}

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
        style={{ width: '100%', maxWidth: '48rem', minHeight: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontWeight: 700, padding: '0.5rem 1rem' }}
      >
        {view.banner}
      </div>

      {lastPair && phase !== 'over' && (
        <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
          さっき：{ICON[lastPair[0]]}{STANCE_JP[lastPair[0]]} vs {ICON[lastPair[1]]}{STANCE_JP[lastPair[1]]}
        </div>
      )}

      {phase === 'over' ? (
        <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>けっかへ…</div>
      ) : phase === 'playing' && !state.done && mode === 'solo' ? (
        <StanceButtons onPick={pickSolo} canKosei={canKosei} canKonshin={canKonshin} me={me} />
      ) : phase === 'choose-p1' ? (
        <>
          <div style={{ fontWeight: 700, color: 'var(--crayon-red)' }}>P1（{names[0]}）が えらぶ</div>
          <StanceButtons onPick={pickP1} canKosei={canKosei} canKonshin={canKonshin} me={me} />
        </>
      ) : phase === 'handoff' ? (
        <div style={{ display: 'grid', gap: '0.8rem', placeItems: 'center' }}>
          <div style={{ fontWeight: 700 }}>P1 は えらんだ！ がめんを P2 にわたして…</div>
          <button className="crayon-btn primary big" onClick={() => setPhase('choose-p2')}>
            P2 の ばん →
          </button>
        </div>
      ) : phase === 'choose-p2' ? (
        <>
          <div style={{ fontWeight: 700, color: 'var(--crayon-blue)' }}>P2（{names[1]}）が えらぶ</div>
          <StanceButtons
            onPick={pickP2}
            canKosei={koseiReady(state.combatants[1])}
            canKonshin={konshinReady(state.combatants[1])}
            me={state.combatants[1]}
          />
        </>
      ) : null}
    </div>
  );
}

function StanceButtons({
  onPick,
  canKosei,
  canKonshin,
  me,
}: {
  onPick: (s: ClashStance) => void;
  canKosei: boolean;
  canKonshin: boolean;
  me: ClashCombatant;
}) {
  const kName = getKosei(me.koseiId).activeName;
  const btn = (s: ClashStance, sub: string, disabled = false) => (
    <button
      key={s}
      className="crayon-btn"
      disabled={disabled}
      onClick={() => onPick(s)}
      style={{ borderColor: BTN_COLOR[s], color: BTN_COLOR[s], minWidth: '6rem', fontWeight: 700, opacity: disabled ? 0.45 : 1 }}
    >
      {ICON[s]} {STANCE_JP[s]}
      <span style={{ display: 'block', fontSize: '0.6em', opacity: 0.8 }}>{sub}</span>
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: '48rem' }}>
      {TRI.map((s) => btn(s, `${STANCE_JP[STANCE_BEATS[s]]}に強い`))}
      {btn('kosei', canKosei ? kName : 'つかえない', !canKosei)}
      {btn('konshin', canKonshin ? '一発逆転' : 'HP35%以下で', !canKonshin)}
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
        animate={shake ? { x: [0, -6, 6, -4, 0] } : acting ? { x: dir * 14 } : { x: 0 }}
        transition={{ duration: shake ? 0.3 : 0.2 }}
        style={{ position: 'relative', margin: '0.4rem 0' }}
      >
        <div
          style={{
            width: 'min(28vw, 120px)',
            aspectRatio: '1',
            margin: '0 auto',
            background: '#fff',
            border: '2px solid var(--border)',
            borderRadius: 8,
            padding: 6,
            transform: `rotate(${dir * -1.5}deg)`,
            boxShadow: shake ? '0 0 0 4px rgba(214,69,69,.5)' : '2px 3px 0 rgba(51,48,43,.15)',
          }}
        >
          <CharacterSprite imageUrl={image} attribute={char.attribute} name={char.name} flip={side === 1} />
        </div>
        {floats.map((f, i) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: -28 - i * 18 }}
            style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              transform: 'translateX(-50%)',
              fontWeight: 700,
              fontSize: f.kind === 'dmg' ? '1.15rem' : '1rem',
              color: f.kind === 'heal' ? 'var(--crayon-green)' : f.kind === 'dmg' ? 'var(--crayon-red)' : 'var(--ink)',
              whiteSpace: 'nowrap',
            }}
          >
            {f.text}
          </motion.div>
        ))}
      </motion.div>

      <div style={{ background: '#0001', borderRadius: 6, height: 18, overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: low ? 'var(--crayon-red)' : 'var(--crayon-green)',
            transition: 'width .35s',
          }}
        />
      </div>
      <div style={{ fontSize: 'clamp(1rem,3vw,1.25rem)', fontWeight: 700 }}>
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
