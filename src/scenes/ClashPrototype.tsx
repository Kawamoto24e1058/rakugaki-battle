import { useMemo, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';
import { STATUS_META } from '../engine/status';
import { mulberry32 } from '../engine/rng';
import type { Character } from '../engine/types';
import {
  createClashState,
  resolveClashTurn,
  cpuClashStance,
  koseiReady,
  konshinReady,
  moveCategory,
  STANCE_JP,
  STANCE_COLOR,
  STANCE_BEATS,
  type ClashState,
  type ClashStance,
  type ClashEvent,
  type TriStance,
  type Side,
} from '../engine/battle/clash';
import { getMove } from '../engine/moves';

const TRI: TriStance[] = ['power', 'tech', 'speed'];
const ICON: Record<ClashStance, string> = {
  power: '👊',
  tech: '✨',
  speed: '💨',
  kosei: '★',
  konshin: '🔥',
};

function categoryCounts(c: Character): Record<TriStance, number> {
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

interface Display {
  hp: [number, number];
  statuses: [string[], string[]];
  banner: string;
}

export function ClashPrototype() {
  const roster = useGame((s) => s.cpuRoster);
  const player = useGame((s) => s.player?.character ?? null);
  const reset = useGame((s) => s.reset);

  const pool = useMemo(() => (player ? [player, ...roster] : roster), [player, roster]);
  const [li, setLi] = useState(0);
  const [ri, setRi] = useState(1 % Math.max(1, pool.length));
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 9999));
  const [state, setState] = useState<ClashState | null>(null);
  const [display, setDisplay] = useState<Display | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastClash, setLastClash] = useState<{ mine: ClashStance; theirs: ClashStance } | null>(null);
  const timers = useRef<number[]>([]);

  const left = pool[li];
  const right = pool[ri];

  function begin() {
    timers.current.forEach(clearTimeout);
    const st = createClashState(left, right, seed);
    setState(st);
    setDisplay({
      hp: [st.combatants[0].hp, st.combatants[1].hp],
      statuses: [[], []],
      banner: 'せめる・まもる…じゃない！ 力 / 技 / 速さ を えらぶ',
    });
    setLastClash(null);
    setBusy(false);
  }

  function statusList(side: Side, st: ClashState): string[] {
    return st.combatants[side].statuses.map((s) => STATUS_META[s.kind].jp);
  }

  function pick(stance: ClashStance) {
    if (!state || busy || state.done) return;
    const rng = mulberry32((state.seed + state.turn * 2654435761) >>> 0);
    const cpu = cpuClashStance(state, 1, rng);
    setLastClash({ mine: stance, theirs: cpu });
    const next = resolveClashTurn(state, [stance, cpu]);
    const events = next.log.slice(state.log.length);
    setBusy(true);
    playEvents(events, next);
  }

  function playEvents(events: ClashEvent[], next: ClashState) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const names: [string, string] = [left.name, right.name];
    let t = 0;
    const cur: Display = display
      ? { hp: [...display.hp] as [number, number], statuses: [[], []], banner: display.banner }
      : { hp: [next.combatants[0].maxHp, next.combatants[1].maxHp], statuses: [[], []], banner: '' };

    const step = (fn: () => void, gap: number) => {
      timers.current.push(window.setTimeout(fn, t));
      t += gap;
    };

    for (const ev of events) {
      switch (ev.t) {
        case 'reveal': {
          const [a, b] = ev.stances;
          step(() => setDisplay({ ...cur, banner: `${names[0]}「${STANCE_JP[a]}」  ×  ${names[1]}「${STANCE_JP[b]}」  せーの！` }), 900);
          break;
        }
        case 'clash': {
          const note =
            ev.winner === null ? '五分！' : `${names[ev.winner]} ${ev.note}`;
          step(() => setDisplay({ ...cur, banner: note }), 900);
          break;
        }
        case 'act': {
          const who = names[ev.side];
          step(() => setDisplay({ ...cur, banner: `${who} → ${ev.moveName}` }), 700);
          break;
        }
        case 'damage': {
          cur.hp[ev.side] = ev.hpAfter;
          const tag = ev.tag ? `【${ev.tag}】` : '';
          step(() => setDisplay({ ...cur, hp: [...cur.hp] as [number, number], banner: `${names[ev.side]} に ${ev.amount} ダメージ ${tag}` }), 750);
          break;
        }
        case 'heal': {
          cur.hp[ev.side] = ev.hpAfter;
          step(() => setDisplay({ ...cur, hp: [...cur.hp] as [number, number], banner: `${names[ev.side]} が ${ev.amount} かいふく` }), 650);
          break;
        }
        case 'consolation': {
          cur.hp[ev.side] = Math.min(next.combatants[ev.side].maxHp, cur.hp[ev.side] + ev.amount);
          step(() => setDisplay({ ...cur, hp: [...cur.hp] as [number, number], banner: `${names[ev.side]} 立て直し（+${ev.amount}）` }), 550);
          break;
        }
        case 'status-apply':
          step(() => setDisplay({ ...cur, banner: `${names[ev.side]} は ${STATUS_META[ev.kind].jp}！` }), 550);
          break;
        case 'status-resist':
          step(() => setDisplay({ ...cur, banner: `${names[ev.side]} は こうかなし` }), 400);
          break;
        case 'status-tick': {
          cur.hp[ev.side] = ev.hpAfter;
          step(() => setDisplay({ ...cur, hp: [...cur.hp] as [number, number], banner: `${names[ev.side]} は ${STATUS_META[ev.kind].jp} で ${ev.amount}` }), 550);
          break;
        }
        case 'sudden-death':
          step(() => setDisplay({ ...cur, banner: `サドンデス！ ${names[ev.leader]}（リード）が おおきく けずられる` }), 700);
          break;
        case 'end': {
          const msg =
            ev.winner === 'draw' ? 'ひきわけ！' : `${names[ev.winner]} の かち！`;
          step(() => setDisplay({ ...cur, banner: msg }), 400);
          break;
        }
        default:
          break;
      }
    }

    step(() => {
      setState(next);
      setDisplay({
        hp: [next.combatants[0].hp, next.combatants[1].hp],
        statuses: [statusList(0, next), statusList(1, next)],
        banner:
          next.done
            ? next.winner === 'draw'
              ? 'ひきわけ'
              : `${names[next.winner as Side]} の かち！`
            : `ターン ${next.turn}：力 / 技 / 速さ を えらぶ`,
      });
      setBusy(false);
    }, 0);
  }

  // ---- picker screen ----
  if (!state) {
    return (
      <div className="scene" style={{ justifyContent: 'flex-start', paddingTop: '1.5rem', gap: '1rem' }}>
        <button className="crayon-btn" style={{ alignSelf: 'flex-start' }} onClick={reset}>
          ← もどる
        </button>
        <h2 style={{ color: 'var(--crayon-purple)' }}>力 / 技 / 速さ プロトタイプ</h2>
        <p style={{ maxWidth: '26rem', fontSize: '0.95rem', textAlign: 'center' }}>
          毎ターン <b style={{ color: STANCE_COLOR.power }}>力</b> /{' '}
          <b style={{ color: STANCE_COLOR.tech }}>技</b> /{' '}
          <b style={{ color: STANCE_COLOR.speed }}>速さ</b> を1つ選ぶ。
          <br />
          <b>速さ→力→技→速さ</b>。三すくみは絵のつよさに関係なく左右対称。
        </p>
        <div style={{ display: 'grid', gap: '0.75rem', width: 'min(22rem, 92%)' }}>
          <label>
            じぶん（左）：
            <select value={li} onChange={(e) => setLi(Number(e.target.value))} style={{ width: '100%' }}>
              {pool.map((c, i) => (
                <option key={i} value={i}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            あいて（右・CPU）：
            <select value={ri} onChange={(e) => setRi(Number(e.target.value))} style={{ width: '100%' }}>
              {pool.map((c, i) => (
                <option key={i} value={i}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            シード：
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value) || 0)}
              style={{ width: '100%' }}
            />
          </label>
          <button className="crayon-btn primary big" onClick={begin}>
            はじめる
          </button>
        </div>
      </div>
    );
  }

  // ---- battle screen ----
  const meC = state.combatants[0];
  const canKosei = koseiReady(meC);
  const canKonshin = konshinReady(meC);
  const d = display!;

  return (
    <div className="scene" style={{ justifyContent: 'flex-start', paddingTop: '1rem', gap: '0.8rem' }}>
      <button className="crayon-btn" style={{ alignSelf: 'flex-start', fontSize: '0.8rem' }} onClick={() => setState(null)}>
        ← やりなおし
      </button>

      <div style={{ display: 'flex', gap: '1rem', width: 'min(40rem, 96%)' }}>
        {[0, 1].map((s) => {
          const c = state.combatants[s as Side];
          const cc = categoryCounts(s === 0 ? left : right);
          const hp = d.hp[s];
          const pct = Math.max(0, (hp / c.maxHp) * 100);
          return (
            <div key={s} className="sketch-card" style={{ flex: 1, padding: '0.6rem' }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                {c.name} {s === 1 && '(CPU)'}
              </div>
              <div style={{ background: '#0001', borderRadius: 6, height: 20, overflow: 'hidden', margin: '0.35rem 0' }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: pct > 30 ? 'var(--crayon-green)' : 'var(--crayon-red)',
                    transition: 'width .35s',
                  }}
                />
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                {Math.max(0, Math.round(hp))} / {c.maxHp}
              </div>
              <div style={{ display: 'flex', gap: 6, fontSize: '0.8rem', marginTop: 4 }}>
                {TRI.map((cat) => (
                  <span key={cat} style={{ color: STANCE_COLOR[cat] }}>
                    {ICON[cat]}
                    {STANCE_JP[cat]}
                    {cc[cat]}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, minHeight: 18 }}>
                {d.statuses[s].map((jp, i) => (
                  <span key={i} style={{ fontSize: '0.72rem', background: '#0001', padding: '1px 5px', borderRadius: 5 }}>
                    {jp}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="sketch-card"
        style={{ width: 'min(40rem, 96%)', minHeight: '3.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontWeight: 700 }}
      >
        {d.banner}
      </div>

      {lastClash && (
        <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
          さっき：{ICON[lastClash.mine]}
          {STANCE_JP[lastClash.mine]} vs {ICON[lastClash.theirs]}
          {STANCE_JP[lastClash.theirs]}
        </div>
      )}

      {!state.done ? (
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center', width: 'min(40rem, 96%)' }}>
          {TRI.map((cat) => (
            <button
              key={cat}
              className="crayon-btn"
              disabled={busy}
              onClick={() => pick(cat)}
              style={{
                borderColor: STANCE_COLOR[cat],
                color: STANCE_COLOR[cat],
                minWidth: '6.5rem',
                fontWeight: 700,
              }}
            >
              {ICON[cat]} {STANCE_JP[cat]}
              <span style={{ display: 'block', fontSize: '0.62em', opacity: 0.8 }}>
                {STANCE_JP[STANCE_BEATS[cat]]}に強い
              </span>
            </button>
          ))}
          <button
            className="crayon-btn"
            disabled={busy || !canKosei}
            onClick={() => pick('kosei')}
            style={{ borderColor: 'var(--crayon-purple)', color: 'var(--crayon-purple)', minWidth: '6.5rem', fontWeight: 700 }}
          >
            ★ こせい
            <span style={{ display: 'block', fontSize: '0.62em', opacity: 0.8 }}>
              {canKosei ? '三すくみの外' : 'つかえない'}
            </span>
          </button>
          <button
            className="crayon-btn"
            disabled={busy || !canKonshin}
            onClick={() => pick('konshin')}
            style={{ borderColor: 'var(--crayon-yellow)', color: '#b06f00', minWidth: '6.5rem', fontWeight: 700 }}
          >
            🔥 こんしん
            <span style={{ display: 'block', fontSize: '0.62em', opacity: 0.8 }}>
              {canKonshin ? 'ピンチで解禁' : 'HP35%以下で'}
            </span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="crayon-btn primary big" onClick={begin}>
            もういちど
          </button>
          <button className="crayon-btn big" onClick={() => { setSeed(Math.floor(Math.random() * 9999)); setState(null); }}>
            シードを変えて
          </button>
        </div>
      )}
    </div>
  );
}
