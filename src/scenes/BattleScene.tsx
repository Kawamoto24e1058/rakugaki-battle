import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../store/gameStore';
import {
  createBattleState,
  resolveTurn,
  cpuStance,
  koseiReady,
  getKosei,
  buildReel,
  archetypeLabel,
  mulberry32,
  type BattleState,
  type BattleEvent,
  type Kime,
  type SegKind,
  type Side,
  type Stance,
} from '../engine';
import { STATUS_META } from '../engine/status';
import { ATTRIBUTE_META } from '../engine/attributes';
import type { Stats } from '../engine/types';
import { CharacterSprite, AttributeBadge } from '../components/bits';

type Stage = 'spin' | 'playing' | 'over';

interface Floating {
  id: number;
  side: Side;
  text: string;
  kind: 'dmg' | 'heal' | 'info' | 'big';
}
interface ResultCard {
  side: Side;
  moveName: string;
  attribute: string | null;
  kime: Kime | null;
  segKind: SegKind;
  affinity: string | null;
  statusJp: string | null;
  amount: number;
  note: string;
}
interface StatusChip {
  jp: string;
  turnsLeft: number;
  good: boolean;
}

const CAT_COLOR: Record<string, string> = {
  physical: '#ef8a6b',
  attr: '#f2c14e',
  guard: '#6ba8dd',
  heal: '#5cc47f',
  ska: '#c9c3b6',
  ultra: '#a274f0',
};
const CAT_ICON: Record<string, string> = {
  physical: '👊',
  attr: '✦',
  guard: '🛡',
  heal: '＋',
  ska: '✕',
  ultra: '★',
};

const MINI_STATS: [keyof Stats, string, number][] = [
  ['atk', 'こうげき', 62],
  ['def', 'ぼうぎょ', 62],
  ['spd', 'すばやさ', 62],
  ['luck', 'きゅうしょ', 40],
  ['heart', 'こんじょう', 40],
];

/** 押した側の行動が先に見えるようイベント再生順を並べ替える（エンジンの処理順＝バランスは不変）。 */
function reorderForPresser(events: BattleEvent[], presser: Side): BattleEvent[] {
  const isTail = (e: BattleEvent) =>
    e.t === 'status-tick' || e.t === 'status-end' || e.t === 'turn-start' || e.t === 'battle-end';
  let tailStart = events.findIndex(isTail);
  if (tailStart < 0) tailStart = events.length;
  const action = events.slice(0, tailStart);
  const tail = events.slice(tailStart);

  const segs: { actor: Side; events: BattleEvent[] }[] = [];
  for (const e of action) {
    const side =
      'side' in e && typeof (e as { side?: number }).side === 'number'
        ? ((e as { side: number }).side as Side)
        : null;
    const startsSeg =
      e.t === 'ring-spin' || e.t === 'skip' || e.t === 'defend' || e.t === 'kosei' || e.t === 'move';
    if (startsSeg && side !== null && (segs.length === 0 || segs[segs.length - 1].actor !== side)) {
      segs.push({ actor: side, events: [e] });
    } else if (segs.length === 0) {
      segs.push({ actor: side ?? presser, events: [e] });
    } else {
      segs[segs.length - 1].events.push(e);
    }
  }
  if (segs.length === 2 && segs[0].actor !== presser) segs.reverse();
  return [...segs.flatMap((s) => s.events), ...tail];
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
  const [state, setState] = useState<BattleState>(() =>
    createBattleState(player.character, opponent.character, seed),
  );
  const [stage, setStage] = useState<Stage>('spin');
  const [reelPhase, setReelPhase] = useState<'menu' | 'reeling'>('menu');
  const [displayHp, setDisplayHp] = useState<[number, number]>([
    player.character.baseStats.hp,
    opponent.character.baseStats.hp,
  ]);
  const [shake, setShake] = useState<Side | null>(null);
  const [acting, setActing] = useState<Side | null>(null);
  const [defendingSide, setDefendingSide] = useState<Side | null>(null);
  const [koseiSide, setKoseiSide] = useState<Side | null>(null);
  const [clash, setClash] = useState<string | null>(null);
  const [floats, setFloats] = useState<Floating[]>([]);
  const [banner, setBanner] = useState('せめる・まもる・こせい！');
  const [resultCard, setResultCard] = useState<ResultCard | null>(null);
  const [ring, setRing] = useState<{ side: Side; landedIndex: number | null }>({ side: 0, landedIndex: null });
  const floatId = useRef(0);

  const names: [string, string] = [player.character.name, opponent.character.name];
  const maxHp: [number, number] = [player.character.baseStats.hp, opponent.character.baseStats.hp];
  const chars = [player.character, opponent.character];

  const presser: Side = mode === 'versus' ? ((state.turn % 2 === 1 ? 0 : 1) as Side) : 0;
  const foe: Side = (1 - presser) as Side;
  const kosei = getKosei(chars[presser].koseiId);
  const koseiCombatant = state.combatants[presser];
  const koseiOk = koseiReady(koseiCombatant);
  // 回数制は常に「のこり◯回」を出す。クールダウン制は使えない間だけ「あと◯ターン」。
  const koseiWait =
    kosei.limit.kind === 'count'
      ? `のこり${koseiCombatant.koseiUses}回`
      : koseiCombatant.koseiCd > 0
        ? `あと${koseiCombatant.koseiCd}ターン`
        : '';

  const pushFloat = useCallback((side: Side, text: string, kind: Floating['kind']) => {
    const id = floatId.current++;
    setFloats((f) => [...f, { id, side, text, kind }]);
    window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1300);
  }, []);

  const playEvents = useCallback(
    (events: BattleEvent[], finalState: BattleState) => {
      setStage('playing');
      let i = 0;
      let koseiActor: Side | null = null;
      const setHp = (side: Side, hp: number) =>
        setDisplayHp((cur) => {
          const n = [...cur] as [number, number];
          n[side] = hp;
          return n;
        });

      const nextPresser: Side =
        mode === 'versus' ? ((finalState.turn % 2 === 1 ? 0 : 1) as Side) : 0;

      const step = () => {
        if (i >= events.length) {
          setDisplayHp([finalState.combatants[0].hp, finalState.combatants[1].hp]);
          setState(finalState);
          setActing(null);
          setDefendingSide(null);
          setKoseiSide(null);
          if (finalState.phase === 'done') setStage('over');
          else {
            setRing({ side: nextPresser, landedIndex: null });
            setReelPhase('menu');
            setStage('spin');
          }
          return;
        }
        const ev = events[i++];
        let delay = 300;
        switch (ev.t) {
          case 'turn-start':
            setBanner(`ターン ${ev.turn}`);
            setResultCard(null);
            setActing(null);
            setDefendingSide(null);
            setKoseiSide(null);
            break;
          case 'defend':
            setDefendingSide(ev.side);
            setKoseiSide(null);
            setBanner(`${names[ev.side]} は みをまもった！`);
            delay = 340;
            break;
          case 'kosei':
            koseiActor = ev.side;
            setKoseiSide(ev.side);
            setDefendingSide(null);
            setActing(null);
            setBanner(`${names[ev.side]} こせい「${ev.name}」！${ev.free ? '（7コマ！）' : ''}`);
            delay = 440;
            break;
          case 'ring-spin':
            setActing(null);
            setDefendingSide(null);
            setKoseiSide(null);
            koseiActor = null;
            setResultCard(null);
            setRing({ side: ev.side, landedIndex: null });
            window.setTimeout(() => {
              setRing({ side: ev.side, landedIndex: ev.index });
              window.setTimeout(step, 1150);
            }, ev.side === presser ? 150 : 500);
            return;
          case 'ultra-fail':
            setBanner(`${names[ev.side]} こせい しっぱい…！`);
            pushFloat(ev.side, 'しっぱい！', 'info');
            delay = 420;
            break;
          case 'move':
            if (ev.moveName === 'まもる') {
              setBanner(`${names[ev.side]} は みをまもった！`);
            } else if (koseiActor === ev.side) {
              // こせい技名は kosei イベントで表示済み。紫グロー継続。
            } else {
              setBanner(`${names[ev.side]} の 「${ev.moveName}」！`);
              setActing(ev.side);
            }
            delay = 340;
            break;
          case 'skip':
            pushFloat(ev.side, ev.reason === 'shock' ? 'しびれて うごけない' : 'こんらん！', 'info');
            break;
          case 'result':
            setResultCard({
              side: ev.side,
              moveName: ev.moveName,
              attribute: ev.attribute,
              kime: ev.kime,
              segKind: ev.segKind,
              affinity: ev.affinity,
              statusJp: ev.statusJp,
              amount: ev.amount,
              note: ev.note,
            });
            window.setTimeout(() => {
              setResultCard(null);
              setActing(null);
              step();
            }, ev.amount > 0 ? 950 : 620);
            return;
          case 'damage':
            setHp(ev.side, ev.hpAfter);
            setShake(ev.side);
            if (ev.comeback) setClash('こんじょう！');
            else setClash(ev.affinity === 'こうかばつぐん' ? 'ばつぐん！' : ev.combo ? 'ずどん！' : null);
            window.setTimeout(() => setShake(null), 260);
            window.setTimeout(() => setClash(null), 480);
            if (ev.comeback) pushFloat((1 - ev.side) as Side, 'こんじょう！', 'info');
            pushFloat(
              ev.side,
              `${ev.amount}`,
              ev.affinity === 'こうかばつぐん' || ev.comeback || ev.amount >= 34 ? 'big' : 'dmg',
            );
            delay = 380;
            break;
          case 'dodge':
            pushFloat(ev.side, 'かわした！', 'info');
            break;
          case 'heal':
            setHp(ev.side, ev.hpAfter);
            pushFloat(ev.side, `＋${ev.amount}`, 'heal');
            break;
          case 'reflect':
            setHp(ev.side, ev.hpAfter);
            pushFloat(ev.side, `はんげき ${ev.amount}`, 'dmg');
            break;
          case 'status-apply':
            pushFloat(ev.side, `${STATUS_META[ev.status].jp}！`, 'info');
            break;
          case 'status-resist':
            pushFloat(ev.side, 'きかない！', 'info');
            break;
          case 'status-cure':
            pushFloat(ev.side, 'スッキリ！', 'heal');
            break;
          case 'status-tick':
            setHp(ev.side, ev.hpAfter);
            pushFloat(ev.side, `${ev.amount}`, 'dmg');
            break;
          case 'status-end':
            delay = 100;
            break;
          case 'faint':
            pushFloat(ev.side, 'たおれた…', 'info');
            break;
          case 'battle-end':
            setBanner(ev.winner === 'draw' ? 'あいこ！' : `${names[ev.winner]} の かち！`);
            break;
        }
        window.setTimeout(step, delay);
      };
      step();
    },
    [names, pushFloat, mode, presser],
  );

  const runTurn = useCallback(
    (myStance: Stance) => {
      const stances: [Stance, Stance] = ['attack', 'attack'];
      stances[presser] = myStance;
      if (mode === 'solo') {
        const rng = mulberry32((state.seed + state.turn * 2654435761) >>> 0);
        stances[foe] = cpuStance(state, foe, rng);
      }
      const nextState = resolveTurn(state, stances);
      const fresh = nextState.log.slice(state.log.length);
      playEvents(reorderForPresser(fresh, presser), nextState);
    },
    [state, playEvents, presser, foe, mode],
  );

  const chooseAttack = useCallback(() => {
    if (stage !== 'spin' || reelPhase !== 'menu') return;
    setReelPhase('reeling');
  }, [stage, reelPhase]);
  const stopReel = useCallback(() => {
    if (stage !== 'spin' || reelPhase !== 'reeling') return;
    runTurn('attack');
  }, [stage, reelPhase, runTurn]);

  useEffect(() => {
    if (stage !== 'over') return;
    const t = window.setTimeout(() => finishBattle(state.winner === 0), 1600);
    return () => window.clearTimeout(t);
  }, [stage, state.winner, finishBattle]);

  const chipsFor = (s: Side): StatusChip[] =>
    state.combatants[s].statuses.map((x) => ({
      jp: STATUS_META[x.kind].jp,
      turnsLeft: x.turnsLeft,
      good: STATUS_META[x.kind].kind === 'buff',
    }));

  const hpPct = (s: Side) => displayHp[s] / maxHp[s];
  const pinch: [boolean, boolean] = [hpPct(0) <= 0.3 && displayHp[0] > 0, hpPct(1) <= 0.3 && displayHp[1] > 0];
  const anyPinch = (pinch[0] || pinch[1]) && stage !== 'over';
  const foeLow = hpPct(foe) <= 0.2 && displayHp[foe] > 0;

  // リールを見せる場面か（まもる/こせいの間は隠す）
  const showReel =
    (stage === 'spin' && defendingSide == null && koseiSide == null) ||
    (stage === 'playing' && defendingSide == null && koseiSide == null);
  const reelSpinning = stage === 'spin' ? reelPhase === 'reeling' : ring.landedIndex == null;

  return (
    <div
      className="scene"
      style={{ gap: '0.45rem', padding: '0.55rem 0.5rem 0.7rem', justifyContent: 'flex-start', position: 'relative' }}
    >
      {anyPinch && <div className="pinch-vignette" />}

      <div
        className="sketch-card"
        style={{
          padding: '0.3rem 1rem',
          fontFamily: 'var(--font-display)',
          textAlign: 'center',
          fontSize: '1rem',
          minHeight: '2.1rem',
          display: 'grid',
          placeItems: 'center',
          width: 'min(34rem, 96vw)',
        }}
      >
        {banner}
      </div>

      {/* ===== バトルステージ ===== */}
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          width: '100%',
          maxWidth: 'min(43rem, 99vw)',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          position: 'relative',
        }}
      >
        {([0, 1] as Side[]).map((s) => (
          <div key={s} style={{ display: 'contents' }}>
            {s === 1 && (
              <div style={{ display: 'grid', placeItems: 'center', minWidth: '2rem', alignSelf: 'center', paddingTop: '2.4rem' }}>
                <AnimatePresence>
                  {clash ? (
                    <motion.div
                      key={clash}
                      initial={{ scale: 0.3, opacity: 0, rotate: -12 }}
                      animate={{ scale: 1, opacity: 1, rotate: -4 }}
                      exit={{ scale: 1.6, opacity: 0 }}
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1.05rem',
                        color: 'var(--crayon-red)',
                        textShadow: '2px 2px 0 #fff',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {clash}
                    </motion.div>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', opacity: 0.6 }}>VS</span>
                  )}
                </AnimatePresence>
              </div>
            )}
            <Fighter
              name={names[s]}
              attribute={chars[s].attribute}
              arche={archetypeLabel(chars[s].baseStats)}
              koseiName={getKosei(chars[s].koseiId).name}
              imageUrl={s === 0 ? player.imageUrl : opponent.imageUrl}
              hp={displayHp[s]}
              maxHp={maxHp[s]}
              stats={chars[s].baseStats}
              statuses={chipsFor(s)}
              shake={shake === s}
              acting={acting === s}
              defending={defendingSide === s}
              koseiing={koseiSide === s}
              pinch={pinch[s]}
              dir={s === 0 ? 1 : -1}
              flip={s === 1}
              floats={floats.filter((f) => f.side === s)}
            />
          </div>
        ))}
      </div>

      {/* ===== わざリール ＋ ターンの選択 ===== */}
      {showReel && (
        <ReelPanel
          key={`reel-${ring.side}`}
          moveIds={state.combatants[ring.side].moveIds}
          cooldowns={state.combatants[ring.side].cooldowns}
          landedIndex={ring.landedIndex}
          spinning={reelSpinning}
          sideName={names[ring.side]}
          mine={ring.side === presser}
          menuMode={stage === 'spin' && reelPhase === 'menu'}
        />
      )}
      {!showReel && <div style={{ height: '9.6rem' }} />}

      {/* ボタン */}
      {stage === 'spin' && reelPhase === 'menu' && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.1rem' }}>
          <button
            className={`crayon-btn primary${foeLow ? ' todome-glow' : ''}`}
            style={{ fontSize: '1.25rem', padding: '0.4em 1.2em' }}
            onClick={chooseAttack}
          >
            {mode === 'versus' ? `${names[presser]}、` : ''}
            {foeLow ? 'せめる（とどめ）' : 'せめる'}
          </button>
          <button
            className="crayon-btn"
            style={{ fontSize: '1.15rem', padding: '0.4em 1em' }}
            onClick={() => runTurn('defend')}
          >
            まもる
          </button>
          <button
            className="crayon-btn"
            style={{ fontSize: '1.1rem', padding: '0.4em 0.9em', opacity: koseiOk ? 1 : 0.5 }}
            disabled={!koseiOk}
            onClick={() => runTurn('kosei')}
          >
            こせい：{kosei.activeName}
            {koseiWait ? ` (${koseiWait})` : ''}
          </button>
        </div>
      )}
      {stage === 'spin' && reelPhase === 'reeling' && (
        <button
          className={`crayon-btn primary big${foeLow ? ' todome-glow' : ''}`}
          style={{ fontSize: '1.65rem', padding: '0.5em 2.2em', marginTop: '0.15rem' }}
          onClick={stopReel}
        >
          {foeLow ? 'とどめ！' : 'とめる！'}
        </button>
      )}

      {stage === 'over' && (
        <motion.p
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '1.5rem', marginTop: '0.5rem' }}
        >
          {state.winner === 'draw' ? 'あいこ！' : state.winner === 0 ? 'かった！🎉' : 'まけちゃった…'}
        </motion.p>
      )}

      <AnimatePresence>
        {resultCard && <ResultCardView key="rc" card={resultCard} names={names} />}
      </AnimatePresence>
    </div>
  );
}

// ---------- ファイター ----------

function StatBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const strong = pct >= 66;
  const weak = pct <= 33;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '3.6em 1fr 1.6em', gap: '0.3rem', alignItems: 'center' }}>
      <span style={{ fontSize: '0.58rem', color: 'var(--ink-soft)' }}>{label}</span>
      <span style={{ height: 8, borderRadius: 5, border: '1.5px solid var(--border)', background: '#fff', overflow: 'hidden' }}>
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${pct}%`,
            background: strong ? 'var(--crayon-red)' : weak ? '#9fb0c0' : 'var(--crayon-yellow)',
          }}
        />
      </span>
      <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-display)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
}

function Fighter({
  name, attribute, arche, koseiName, imageUrl, hp, maxHp, stats, statuses, shake, acting, defending, koseiing, pinch, dir, flip, floats,
}: {
  name: string;
  attribute: Parameters<typeof AttributeBadge>[0]['attribute'];
  arche: string;
  koseiName: string;
  imageUrl: string | null;
  hp: number;
  maxHp: number;
  stats: Stats;
  statuses: StatusChip[];
  shake: boolean;
  acting: boolean;
  defending: boolean;
  koseiing: boolean;
  pinch: boolean;
  dir: 1 | -1;
  flip?: boolean;
  floats: Floating[];
}) {
  const pct = Math.max(0, (hp / maxHp) * 100);
  const low = pct <= 30;
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: '0.22rem', alignContent: 'start', justifyItems: 'center' }}>
      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem' }}>{name}</strong>
        <AttributeBadge attribute={attribute} size={0.7} />
      </div>
      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.7rem',
            border: '2px solid var(--border)',
            borderRadius: 999,
            padding: '0 0.45rem',
            background: 'var(--crayon-yellow)',
          }}
        >
          {arche}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.7rem',
            border: '2px solid var(--border)',
            borderRadius: 999,
            padding: '0 0.45rem',
            background: 'var(--crayon-purple)',
            color: '#fff',
          }}
        >
          {koseiName}
        </span>
        {pinch && (
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.7rem',
              border: '2px solid var(--border)',
              borderRadius: 999,
              padding: '0 0.45rem',
              background: 'var(--crayon-red)',
              color: '#fff',
            }}
          >
            ピンチ！
          </span>
        )}
      </div>

      {/* HP バー */}
      <motion.div animate={shake ? { x: [0, -3, 3, -2, 0] } : { x: 0 }} transition={{ duration: 0.26 }} style={{ width: '100%' }}>
        <div
          style={{
            height: 20,
            border: '3px solid var(--border)',
            borderRadius: 11,
            background: '#fff',
            overflow: 'hidden',
            boxShadow: shake ? '0 0 0 4px rgba(214,69,69,0.5)' : 'none',
            transition: 'box-shadow 0.15s ease',
          }}
        >
          <div style={{ height: '100%', width: `${pct}%`, background: low ? 'var(--bad)' : 'var(--good)', transition: 'width 0.45s ease' }} />
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1rem',
            textAlign: 'center',
            marginTop: '0.05rem',
            color: low ? 'var(--bad)' : 'var(--ink)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          HP {Math.max(0, Math.ceil(hp))} / {maxHp}
        </div>
      </motion.div>

      {/* キャラ */}
      <div style={{ position: 'relative', width: 'min(28vw, 124px)', height: 'min(28vw, 124px)', marginTop: '0.1rem' }}>
        <div
          style={{
            position: 'absolute',
            bottom: -3,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '70%',
            height: 12,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(51,48,43,0.26), transparent 70%)',
          }}
        />
        <motion.div
          animate={
            shake
              ? { x: [0, -6, 6, -4, 0], rotate: [0, -3, 3, 0] }
              : acting
                ? { x: dir * 18, y: -3 }
                : defending
                  ? { y: 3, scale: 0.94 }
                  : koseiing
                    ? { scale: 1.08, y: -4 }
                    : { x: 0, y: 0, scale: 1, rotate: dir * -1.5 }
          }
          transition={acting && !shake ? { type: 'spring', stiffness: 520, damping: 13 } : { duration: 0.26 }}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '12px 16px 12px 14px',
            ...(defending ? { boxShadow: '0 0 0 4px var(--crayon-blue)', background: 'rgba(47,125,209,0.14)' } : {}),
            ...(koseiing ? { boxShadow: '0 0 0 5px var(--crayon-purple)', background: 'rgba(123,92,240,0.16)' } : {}),
            ...(imageUrl && !defending && !koseiing
              ? { background: '#fff', border: '3px solid var(--border)', boxShadow: '3px 4px 0 rgba(51,48,43,0.16)', padding: '0.25rem' }
              : imageUrl
                ? { border: '3px solid var(--border)', padding: '0.25rem' }
                : {}),
          }}
        >
          <CharacterSprite imageUrl={imageUrl} attribute={attribute} name={name} flip={flip} />
        </motion.div>
        {(defending || koseiing) && (
          <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', fontSize: '1.4rem' }}>
            {defending ? '🛡' : '✦'}
          </div>
        )}
        {floats.map((f) => (
          <motion.div
            key={f.id}
            initial={{ y: 0, opacity: 0, scale: 0.6 }}
            animate={{ y: -46, opacity: 1, scale: 1 }}
            style={{
              position: 'absolute',
              left: '50%',
              top: '14%',
              translateX: '-50%',
              fontFamily: 'var(--font-display)',
              fontSize: f.kind === 'info' ? '0.86rem' : f.kind === 'big' ? '2rem' : '1.5rem',
              color:
                f.kind === 'heal' ? 'var(--good)' : f.kind === 'dmg' || f.kind === 'big' ? 'var(--bad)' : 'var(--ink)',
              textShadow: '2px 2px 0 #fff, -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {f.text}
          </motion.div>
        ))}
      </div>

      {/* ステータス（バー） */}
      <div style={{ display: 'grid', gap: '0.12rem', width: '100%', maxWidth: '13rem', marginTop: '0.1rem' }}>
        {MINI_STATS.map(([k, label, max]) => (
          <StatBar key={k} label={label} value={stats[k]} max={max} />
        ))}
      </div>

      {/* 状態異常 */}
      {statuses.length > 0 && (
        <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {statuses.map((s, i) => (
            <span
              key={i}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.62rem',
                border: '2px solid var(--border)',
                borderRadius: 6,
                padding: '0 0.3rem',
                background: s.good ? 'var(--crayon-green)' : '#ffe2d8',
                color: s.good ? '#fff' : 'var(--ink)',
                whiteSpace: 'nowrap',
              }}
            >
              {s.jp}
              <span style={{ opacity: 0.8 }}> {s.turnsLeft}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- わざリール ----------

const ROW_H = 46;
const VIEW_ROWS = 3;

function ReelPanel({
  moveIds, cooldowns, landedIndex, spinning, sideName, mine, menuMode,
}: {
  moveIds: string[];
  cooldowns: Record<string, number>;
  landedIndex: number | null;
  spinning: boolean;
  sideName: string;
  mine: boolean;
  menuMode: boolean;
}) {
  const reel = useMemo(() => buildReel(moveIds), [moveIds]);
  const stripRef = useRef<HTMLDivElement>(null);
  const yRef = useRef(-Math.random() * reel.length * ROW_H);
  const loopH = reel.length * ROW_H;
  const centerY = (VIEW_ROWS * ROW_H - ROW_H) / 2;
  const REPS = 8;

  useEffect(() => {
    if (!spinning || landedIndex != null) return;
    const el = stripRef.current;
    if (el) el.style.transition = 'none';
    let raf = 0;
    let last = performance.now();
    const speed = 860;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      yRef.current -= speed * dt;
      if (yRef.current <= -loopH) yRef.current += loopH;
      if (stripRef.current) stripRef.current.style.transform = `translateY(${yRef.current}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spinning, landedIndex, loopH]);

  useEffect(() => {
    if (landedIndex == null) return;
    const el = stripRef.current;
    if (!el) return;
    const slip = (Math.random() - 0.5) * ROW_H * 0.5;
    const cur = yRef.current;
    let target = centerY - landedIndex * ROW_H;
    while (target > cur - loopH * 1.6) target -= loopH;
    target += slip;
    yRef.current = target;
    requestAnimationFrame(() => {
      el.style.transition = 'transform 1.05s cubic-bezier(.1,.7,.12,1)';
      el.style.transform = `translateY(${target}px)`;
    });
  }, [landedIndex, centerY, loopH]);

  const label = menuMode
    ? `${sideName} の わざ`
    : mine
      ? `${sideName} の わざリール`
      : `${sideName} が えらんでいる…`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', width: '100%', marginTop: '0.15rem' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>{label}</span>
      <div
        className="sketch-card"
        style={{
          position: 'relative',
          width: 'min(22rem, 94vw)',
          height: VIEW_ROWS * ROW_H,
          overflow: 'hidden',
          padding: 0,
          background: 'var(--card)',
          opacity: menuMode ? 0.72 : 1,
        }}
      >
        <div ref={stripRef} style={{ position: 'absolute', left: 0, right: 0, top: 0, willChange: 'transform' }}>
          {Array.from({ length: REPS }).flatMap((_, rep) =>
            reel.map((seg, idx) => {
              const dim = seg.moveId && (cooldowns[seg.moveId] ?? 0) > 0;
              const strong = seg.stars === 3;
              const weak = seg.stars === 1;
              return (
                <div
                  key={`${rep}-${idx}`}
                  style={{
                    height: ROW_H,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0 0.65rem',
                    borderBottom: '2px solid rgba(51,48,43,0.15)',
                    boxShadow: strong ? 'inset 0 0 0 3px var(--crayon-yellow)' : undefined,
                    background: CAT_COLOR[seg.cat],
                    opacity: dim ? 0.4 : weak ? 0.82 : 1,
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  <span style={{ fontSize: '0.9rem', width: '1.1rem', textAlign: 'center' }}>{CAT_ICON[seg.cat]}</span>
                  {seg.kind === 'ultra' ? (
                    <span style={{ color: '#33302b', fontSize: '1.4rem', flex: 1 }}>7　こせい</span>
                  ) : seg.kind === 'ska' ? (
                    <span style={{ color: '#33302b', fontSize: '1.05rem', flex: 1 }}>スカ（はずれ）</span>
                  ) : (
                    <>
                      <span
                        style={{
                          color: '#33302b',
                          flex: 1,
                          minWidth: 0,
                          fontWeight: strong ? 700 : 400,
                          fontSize: strong ? '1.1rem' : weak ? '0.98rem' : '1.05rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {seg.label}
                      </span>
                      <span style={{ fontSize: '0.9rem', color: '#fff', textShadow: '0 0 2px #6b4a10, 1px 1px 0 #6b4a10', flexShrink: 0 }}>
                        {'★'.repeat(seg.stars)}
                        <span style={{ opacity: 0.35 }}>{'★'.repeat(3 - seg.stars)}</span>
                      </span>
                      <span
                        style={{
                          minWidth: '2.2rem',
                          textAlign: 'right',
                          flexShrink: 0,
                          color: strong ? '#8a1c0c' : '#33302b',
                          fontWeight: strong ? 700 : 400,
                          fontSize: seg.power != null ? (strong ? '1.22rem' : '1.02rem') : '0.74rem',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {seg.power != null ? seg.power : seg.supportWord}
                      </span>
                    </>
                  )}
                </div>
              );
            }),
          )}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: centerY, background: 'rgba(51,48,43,0.12)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: centerY + ROW_H, bottom: 0, background: 'rgba(51,48,43,0.12)', pointerEvents: 'none' }} />
        {!menuMode && (
          <>
            <div
              style={{
                position: 'absolute',
                left: 2,
                right: 2,
                top: centerY - 2,
                height: ROW_H + 4,
                zIndex: 3,
                border: '5px solid var(--crayon-red)',
                borderRadius: 10,
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'absolute', right: -3, top: centerY + ROW_H / 2 - 10, zIndex: 3, pointerEvents: 'none' }}>
              <div style={{ width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderRight: '16px solid var(--crayon-red)' }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ResultCardView({ card, names }: { card: ResultCard; names: [string, string] }) {
  const actorSide = card.side;
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        top: '33%',
        transform: 'translate(-50%, -50%)',
        zIndex: 20,
        pointerEvents: 'none',
        width: 'max-content',
      }}
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0, rotate: -4 }}
        animate={{ scale: 1, opacity: 1, rotate: -1.5 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="sketch-card"
        style={{ padding: '0.7rem 1.4rem', textAlign: 'center', background: 'var(--card)', minWidth: '13rem', maxWidth: '92vw' }}
      >
        <div style={{ fontSize: '0.72rem', color: 'var(--ink-soft)', fontFamily: 'var(--font-display)' }}>{names[actorSide]}</div>
        {card.moveName && (
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', margin: '0 0 0.2rem' }}>
            {card.attribute ? ATTRIBUTE_META[card.attribute as keyof typeof ATTRIBUTE_META].jp + 'の ' : ''}
            {card.moveName}
          </div>
        )}
        {card.affinity && (
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1rem',
              color: card.affinity === 'こうかばつぐん' ? 'var(--crayon-red)' : 'var(--ink-soft)',
            }}
          >
            {card.affinity === 'こうかばつぐん' ? 'こうかは ばつぐん！' : 'こうかは いまひとつ…'}
          </div>
        )}
        {card.kime === 'crit' && (
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--crayon-red)' }}>クリティカル！</div>
        )}
        {card.kime === 'graze' && (
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--ink-soft)' }}>かすった…</div>
        )}
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: card.amount > 0 ? '1.5rem' : '1.1rem',
            color: card.amount > 0 ? 'var(--bad)' : 'var(--ink-soft)',
            marginTop: '0.2rem',
          }}
        >
          {card.amount > 0 ? `${card.amount} ダメージ！` : card.note}
        </div>
        {card.statusJp && (
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--crayon-purple)', marginTop: '0.1rem' }}>
            ＋ {card.statusJp}
          </div>
        )}
      </motion.div>
    </div>
  );
}
