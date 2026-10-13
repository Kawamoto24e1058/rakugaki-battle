import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../store/gameStore';
import {
  createClashState,
  resolveClashTurn,
  pickMoveFor,
  getKosei,
  type ClashState,
  type ClashChoice,
  type Side,
} from '../engine';
import type { Character } from '../engine/types';
import { CharacterSprite } from '../components/bits';
import { EMPTY_TABLE } from '../components/PlayArea';
import { buildBeats, snapOf } from './battle/beats';
import { HpBar, Stage } from './battle/Stage';
import { buildRecap, TurnRecap, type RecapSide } from './battle/Recap';
import { MoveReveal } from './battle/MoveReveal';
import { STATUS_META } from '../engine/status';
import { sfx } from '../audio/sfx';
import { MinigameIntro, MinigameStage, pickMinigame, type MgFighter, type MinigameOutcome } from '../minigames';
import type { Beat, Snap } from './battle/types';

/** reveal＝このターンの技が きまる → mgIntro＝ミニゲームの しょうかい → minigame＝ミニゲーム → animating＝こうげきの演出 → over */
type Phase = 'reveal' | 'mgIntro' | 'minigame' | 'animating' | 'over';

/** 待ちのあいだの ステージの状態。 */
function restBeat(snap: Snap, banner: string): Beat {
  return {
    ...snap,
    banner,
    acting: null,
    hit: null,
    floats: [],
    fx: null,
    callout: null,
    order: null,
    first: null,
    table: EMPTY_TABLE,
    shake: 0,
    flash: null,
    impact: null,
    ms: 0,
  };
}

export function BattleScene() {
  const player = useGame((s) => s.player)!;
  const opponent = useGame((s) => s.opponent)!;
  const mode = useGame((s) => s.mode);
  const runWins = useGame((s) => s.runWins);
  const finishBattle = useGame((s) => s.finishBattle);

  const seed = useMemo(
    () => (player.character.seed ^ opponent.character.seed ^ Date.now()) >>> 0,
    [player, opponent],
  );
  const [state, setState] = useState<ClashState>(() => createClashState(player.character, opponent.character, seed));
  const chars: [Character, Character] = [player.character, opponent.character];
  const names: [string, string] = [chars[0].name, chars[1].name];
  const maxHp: [number, number] = [chars[0].baseStats.hp, chars[1].baseStats.hp];
  const images: [string | null, string | null] = [player.imageUrl, opponent.imageUrl];
  const cpu = mode !== 'versus';
  const cpuSkill = Math.min(0.85, 0.45 + runWins * 0.08);

  const [phase, setPhase] = useState<Phase>('reveal');
  const [beats, setBeats] = useState<Beat[]>([]);
  const [beatIdx, setBeatIdx] = useState(0);
  const pendingNext = useRef<ClashState | null>(null);
  const [snap, setSnap] = useState<Snap>(() => snapOf(createClashState(player.character, opponent.character, seed)));
  const [turnKey, setTurnKey] = useState(0);
  const [recap, setRecap] = useState<[RecapSide, RecapSide] | null>(null);
  const lastGame = useRef<string | null>(null);

  // このターンの技と ミニゲーム（state から決まる）
  const picks = useMemo<[ClashChoice, ClashChoice]>(() => [pickMoveFor(state, 0), pickMoveFor(state, 1)], [state]);
  const game = useMemo(() => pickMinigame(state.seed, state.turn, lastGame.current), [state]);

  const curBeat: Beat = phase === 'animating' && beats[beatIdx] ? beats[beatIdx] : restBeat(snap, '');
  const lastBeat = beatIdx >= beats.length - 1;

  // 場面が変わるたびに効果音
  useEffect(() => {
    if (phase !== 'animating') return;
    const b = beats[beatIdx];
    if (!b) return;
    if (b.order) sfx.order();
    else if (b.fx?.kind === 'hit') sfx.hit(Math.min(1, (b.fx.size - 0.8) / 0.7), b.fx.crit || b.fx.release);
    else if (b.fx?.kind === 'heal') sfx.heal();
    else if (b.fx?.kind === 'buff') sfx.buff();
    else if (b.fx?.kind === 'debuff') sfx.debuff();
    else if (b.fx?.kind === 'guard') sfx.guard();
    else if (b.fx?.kind === 'charge') sfx.charge();
    else if (b.fx?.kind === 'status') sfx.status();
    else if (b.impact === 'どかん！') sfx.release();
    else if (b.callout && b.acting != null) sfx.callout();
    if (b.win != null) sfx.win();
    else if (b.hp.some((h) => h <= 0) && b.fx?.kind === 'hit') window.setTimeout(() => sfx.ko(), 250);
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
    const t = window.setTimeout(() => finishBattle(state.winner === 0), 400);
    return () => window.clearTimeout(t);
  }, [phase, state.winner, finishBattle]);

  const onMinigameDone = useCallback(
    (o: MinigameOutcome) => {
      if (state.done) return;
      lastGame.current = game.id;
      const mg = { winner: o.winner, perfect: o.perfect };
      const next = resolveClashTurn(state, picks, mg);
      pendingNext.current = next;
      setBeats(buildBeats(next.log.slice(state.log.length), snap, next, names, chars, mg));
      setBeatIdx(0);
      setPhase('animating');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, picks, game, snap],
  );

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
    setSnap(snapOf(next));
    setTurnKey((k) => k + 1);
    setRecap(buildRecap(next.log.slice(state.log.length), (k) => STATUS_META[k as keyof typeof STATUS_META]?.jp ?? k));
    setPhase(next.done ? 'over' : 'reveal');
  }

  const pinch = curBeat.hp.some((h, i) => h > 0 && h / maxHp[i] <= 0.3);
  const impact = curBeat.impact;
  const [soundOff, setSoundOff] = useState(sfx.isMuted());
  const stageLabel = phase === 'reveal' ? `ターン ${state.turn}：わざが きまるよ` : phase === 'mgIntro' || phase === 'minigame' ? `ターン ${state.turn}：${game.name}` : null;

  return (
    <div className="scene" style={{ justifyContent: 'flex-start', paddingTop: 'clamp(.3rem,1vh,.7rem)', gap: '0.4rem' }}>
      {pinch && <div className="pinch-vignette" />}
      {impact && (
        <motion.div
          key={impact + beatIdx}
          initial={{ scale: 0.3, opacity: 0, rotate: -6 }}
          animate={{ scale: [0.3, 1.25, 1], opacity: [0, 1, 1, 0.9], rotate: [-6, 3, 0] }}
          style={{
            position: 'fixed',
            top: '20%',
            left: '50%',
            translate: '-50% 0',
            zIndex: 28,
            pointerEvents: 'none',
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'clamp(2rem, 9vw, 3.6rem)',
            color: '#fff',
            WebkitTextStroke: '4px var(--ink)',
            paintOrder: 'stroke',
            whiteSpace: 'nowrap',
          }}
        >
          {impact}
        </motion.div>
      )}
      <AnimatePresence>
        {phase === 'reveal' && !state.done && (
          <MoveReveal
            key={`rv-${turnKey}`}
            turn={state.turn}
            chars={chars}
            picks={picks}
            charging={[state.combatants[0].charging, state.combatants[1].charging]}
            onDone={() => setPhase('mgIntro')}
          />
        )}
        {phase === 'mgIntro' && <MinigameIntro key={`mi-${turnKey}`} def={game} cpu={cpu} onDone={() => setPhase('minigame')} />}
      </AnimatePresence>
      {curBeat.win != null && <VictoryOverlay name={names[curBeat.win]} char={chars[curBeat.win]} image={images[curBeat.win]} />}
      {curBeat.koseiAct && (
        <KoseiCutIn
          key={beatIdx}
          name={names[curBeat.koseiAct.side]}
          char={chars[curBeat.koseiAct.side]}
          image={images[curBeat.koseiAct.side]}
          side={curBeat.koseiAct.side}
          moveName={curBeat.koseiAct.moveName}
        />
      )}

      <div style={{ width: '100%', maxWidth: '52rem', display: 'grid', gap: '0.4rem' }}>
        <div style={{ display: 'flex', gap: 'clamp(.8rem,4vw,2rem)' }}>
          {([0, 1] as Side[]).map((s) => (
            <HpBar key={s} side={s} char={chars[s]} hp={curBeat.hp[s]} maxHp={maxHp[s]} chips={curBeat.chips[s]} hitNow={curBeat.hit === s} />
          ))}
        </div>

        <Stage chars={chars} images={images} names={names} beat={curBeat} beatKey={phase === 'animating' ? beatIdx : -1 - turnKey} label={stageLabel} />

        {(phase === 'animating' || phase === 'over') && (
          <div
            className="sketch-card"
            onClick={phase === 'animating' ? advance : undefined}
            style={{
              width: '100%',
              minHeight: '2.3rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              fontWeight: 800,
              fontSize: 'clamp(.9rem, 2.6vw, 1.1rem)',
              padding: '0.35rem 0.9rem',
              cursor: phase === 'animating' ? 'pointer' : 'default',
            }}
          >
            {phase === 'animating' ? curBeat.banner : state.winner === 'draw' ? 'ひきわけ' : `${names[state.winner as Side]} の かち！`}
          </div>
        )}
      </div>

      {phase === 'animating' ? (
        <div style={{ display: 'flex', gap: 5 }}>
          {beats.map((_, i) => (
            <span key={i} style={{ width: 8, height: 8, borderRadius: 99, background: i <= beatIdx ? 'var(--crayon-blue)' : 'var(--border)' }} />
          ))}
        </div>
      ) : phase === 'over' ? (
        <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>けっかへ…</div>
      ) : phase === 'reveal' || phase === 'mgIntro' ? (
        <div style={{ width: '100%', maxWidth: '52rem', display: 'grid', gap: '0.4rem', justifyItems: 'center' }}>
          {recap && <TurnRecap recap={recap} names={names} />}
        </div>
      ) : (
        <MinigameStage key={`mg-${turnKey}`} def={game} seed={(state.seed ^ Math.imul(state.turn, 0x9e37)) >>> 0} cpu={cpu} cpuSkill={cpuSkill} names={names} fighters={[0, 1].map((i) => ({ name: names[i], attribute: chars[i].attribute, image: images[i] })) as [MgFighter, MgFighter]} onDone={onMinigameDone} />
      )}
      <button
        className="crayon-btn"
        onClick={() => {
          sfx.setMuted(!soundOff);
          setSoundOff(!soundOff);
          if (soundOff) sfx.select();
        }}
        style={{ fontSize: '0.75rem', padding: '0.2em 0.8em', opacity: 0.8, marginTop: '0.4rem' }}
      >
        おと：{soundOff ? 'OFF' : 'ON'}
      </button>
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
          こせい はつどう！
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
          おめでとう！
        </div>
      </motion.div>
    </div>
  );
}
