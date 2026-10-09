import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CharacterSprite, AttributeBadge } from '../../components/bits';
import { ATTRIBUTE_META } from '../../engine/attributes';
import type { Character } from '../../engine/types';
import type { OrderReason, Side } from '../../engine';
import { Aura } from './Aura';
import { Fx } from './Fx';
import type { Beat, Callout, Chip, Floating, OrderInfo } from './types';

const SIDE_COLOR: [string, string] = ['#e8503a', '#2f7dd1'];

const REASON_TEXT: Record<OrderReason, string> = {
  kosei: 'こせいわざは かならず 先に うごく！',
  priority: '先に うごく わざを つかった！',
  passive: 'こせいの ちからで 先に うごく！',
  speed: 'すばやさが 高い ほうが 先に うごく！',
  coin: 'すばやさが おなじ！ うんで きまった',
};

// ---------------------------------------------------------------- HP
export function HpBar({
  side,
  char,
  hp,
  maxHp,
  chips,
  hitNow,
}: {
  side: Side;
  char: Character;
  hp: number;
  maxHp: number;
  chips: Chip[];
  hitNow: boolean;
}) {
  const prev = useRef(hp);
  const [delta, setDelta] = useState<{ id: number; v: number } | null>(null);
  useEffect(() => {
    const d = Math.round(hp - prev.current);
    prev.current = hp;
    if (d !== 0) setDelta({ id: Math.random(), v: d });
  }, [hp]);
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const low = pct <= 30;
  const mid = pct <= 55;
  const color = low ? 'var(--crayon-red)' : mid ? 'var(--crayon-yellow)' : 'var(--crayon-green)';
  const right = side === 1;
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 3 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: right ? 'flex-end' : 'flex-start', flexWrap: 'wrap' }}>
        {!right && <AttributeBadge attribute={char.attribute} size={0.78} />}
        <strong style={{ fontSize: 'clamp(.95rem,2.6vw,1.2rem)', fontFamily: 'var(--font-display)', color: SIDE_COLOR[side] }}>{char.name}</strong>
        {right && <AttributeBadge attribute={char.attribute} size={0.78} />}
      </div>
      <motion.div
        animate={hitNow ? { x: [0, -4, 4, -3, 0] } : { x: 0 }}
        transition={{ duration: 0.3 }}
        style={{ position: 'relative', height: 'clamp(1.35rem,3.6vw,1.8rem)', background: '#0001', border: '3px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}
      >
        {/* 残像（へった分を ゆっくり追いかける） */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, [right ? 'right' : 'left']: 0, width: `${pct}%`, background: '#fffdf5', transition: 'width .9s cubic-bezier(.2,.8,.2,1) .45s' }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, [right ? 'right' : 'left']: 0, width: `${pct}%`, background: color, transition: 'width .35s cubic-bezier(.2,.8,.2,1), background .3s' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '38%', background: 'rgba(255,255,255,.35)' }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: right ? 'flex-start' : 'flex-end', padding: '0 0.5rem', fontWeight: 900, fontSize: 'clamp(.8rem,2.3vw,1rem)', color: 'var(--ink)', textShadow: '0 0 3px #fff, 0 0 3px #fff' }}>
          {Math.max(0, Math.round(hp))} / {maxHp}
        </div>
      </motion.div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 20, justifyContent: right ? 'flex-end' : 'flex-start', position: 'relative' }}>
        {delta && (
          <motion.span
            key={delta.id}
            initial={{ opacity: 0, y: -14, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], y: [-14, 0, 2, 8], scale: [0.6, 1.25, 1, 1] }}
            transition={{ duration: 1.6 }}
            style={{ position: 'absolute', [right ? 'left' : 'right']: 0, top: -2, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.35rem', color: delta.v < 0 ? '#e83a2a' : '#2f9e58', WebkitTextStroke: '3px #fffdf5', paintOrder: 'stroke', pointerEvents: 'none', zIndex: 3 }}
          >
            {delta.v > 0 ? `+${delta.v}` : delta.v}
          </motion.span>
        )}
        {chips.map((c, i) => (
          <motion.span
            key={`${c.kind}-${i}`}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ fontSize: '0.72rem', fontWeight: 800, padding: '1px 7px', borderRadius: 99, border: '2px solid var(--ink)', background: c.good ? '#c9f0d7' : '#ffd6e4' }}
          >
            {c.jp}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 数字
function FloatText({ f }: { f: Floating }) {
  const color = f.kind === 'heal' ? '#2f9e58' : f.kind === 'dmg' ? '#e83a2a' : '#7b5cf0';
  const size = f.kind === 'info' ? '1.3rem' : f.big ? 'clamp(2.8rem, 9vw, 4.2rem)' : 'clamp(2rem, 6.5vw, 3rem)';
  return (
    <motion.div
      key={f.id}
      initial={{ opacity: 0, y: 20, scale: 0.2 }}
      animate={{ opacity: [0, 1, 1, 0], y: [20, -34, -52, -70], scale: [0.2, f.big ? 1.45 : 1.2, 1, 1] }}
      transition={{ duration: 1.35, times: [0, 0.2, 0.7, 1] }}
      style={{ position: 'absolute', left: '50%', top: '14%', transform: 'translateX(-50%)', zIndex: 9, textAlign: 'center', pointerEvents: 'none', whiteSpace: 'nowrap' }}
    >
      {f.tag && f.kind === 'dmg' && (
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: '#fff', WebkitTextStroke: '3px var(--ink)', paintOrder: 'stroke', lineHeight: 1 }}>{f.tag}</div>
      )}
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: size, lineHeight: 1, color, WebkitTextStroke: '4px #fff', paintOrder: 'stroke', textShadow: '0 3px 0 rgba(0,0,0,.25)' }}>
        {f.text}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------- 技名の帯
function CalloutBand({ c }: { c: Callout }) {
  const dir = c.side === 0 ? -1 : 1;
  return (
    <motion.div
      key={c.id}
      initial={{ x: dir * 160, opacity: 0, skewX: -14 }}
      animate={{ x: 0, opacity: 1, skewX: -8 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      style={{
        position: 'absolute',
        top: '4%',
        [c.side === 0 ? 'left' : 'right']: '3%',
        zIndex: 12,
        maxWidth: '62%',
        pointerEvents: 'none',
      }}
    >
      <div style={{ background: c.color, border: '3px solid var(--ink)', borderRadius: 8, padding: '0.1rem 0.9rem 0.25rem', boxShadow: '4px 5px 0 rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.72rem', fontWeight: 800, color: '#fff' }}>
          {c.tag && <span style={{ background: 'rgba(0,0,0,.28)', borderRadius: 99, padding: '0 0.5rem' }}>{c.tag}</span>}
          {c.quick && <span style={{ background: '#fff4c9', color: '#7a5a00', borderRadius: 99, padding: '0 0.5rem' }}>先に うごく</span>}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.35rem, 4.6vw, 2rem)', color: '#fff', WebkitTextStroke: '3.5px var(--ink)', paintOrder: 'stroke', lineHeight: 1.15 }}>
          {c.name}
        </div>
      </div>
      {c.gist && (
        <div style={{ marginTop: 3, background: '#fffdf5', border: '2.5px solid var(--ink)', borderRadius: 8, padding: '0.05rem 0.7rem', fontSize: '0.8rem', fontWeight: 800, color: c.dark, display: 'inline-block' }}>
          {c.gist}
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------- すばやさくらべ
function OrderPanel({ o, names }: { o: OrderInfo; names: [string, string] }) {
  const bars = o.reason === 'speed' || o.reason === 'coin';
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%', zIndex: 14, width: 'min(88%, 26rem)', background: 'rgba(255,253,245,.96)', border: '3px solid var(--ink)', borderRadius: 14, padding: '0.6rem 0.9rem', boxShadow: '5px 6px 0 rgba(0,0,0,.2)', display: 'grid', gap: 6, pointerEvents: 'none' }}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', textAlign: 'center' }}>どっちが 先に うごく？</div>
      {bars &&
        ([0, 1] as Side[]).map((s) => {
          const win = o.first === s;
          return (
            <div key={s} style={{ display: 'grid', gridTemplateColumns: '5.4rem 1fr 2.2rem', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 800 }}>
              <span style={{ color: SIDE_COLOR[s], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{names[s]}</span>
              <div style={{ position: 'relative', height: 16, background: '#0001', border: '2px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (o.spd[s] / 70) * 100)}%` }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} style={{ height: '100%', background: SIDE_COLOR[s], opacity: win ? 1 : 0.55 }} />
                {win && <div style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.8), transparent)', animation: 'speed-streak 0.9s ease-out 0.8s 2' }} />}
              </div>
              <span style={{ textAlign: 'right' }}>{Math.round(o.spd[s])}</span>
            </div>
          );
        })}
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: bars ? 0.9 : 0.1, type: 'spring', stiffness: 260, damping: 14 }} style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>
        <span style={{ color: SIDE_COLOR[o.first] }}>{names[o.first]}</span> が 先！
        <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--ink-soft)' }}>{REASON_TEXT[o.reason]}</div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------- ステージ
export function Stage({
  chars,
  images,
  names,
  beat,
  beatKey,
  label,
}: {
  chars: [Character, Character];
  images: [string | null, string | null];
  names: [string, string];
  beat: Beat;
  beatKey: number;
  /** ステージ上部のラベル（ターン数など）。 */
  label?: string | null;
}) {
  const shake = beat.shake;
  return (
    <motion.div
      key={`stage-${beatKey}`}
      animate={shake ? { x: [0, -shake, shake, -shake * 0.6, shake * 0.4, 0], y: [0, shake * 0.5, -shake * 0.5, shake * 0.3, 0, 0] } : { x: 0, y: 0 }}
      transition={{ duration: 0.38 }}
      style={{ ['--stage-h' as string]: 'clamp(8.5rem, 31vh, 23rem)', position: 'relative', width: '100%', height: 'var(--stage-h)', minHeight: '8.5rem', border: '4px solid var(--ink)', borderRadius: 18, overflow: 'hidden', boxShadow: '5px 6px 0 rgba(51,48,43,.18)', background: '#fffdf6' }}
    >
      <Backdrop attrs={[chars[0].attribute, chars[1].attribute]} />

      {([0, 1] as Side[]).map((s) => (
        <Fighter key={s} side={s} char={chars[s]} image={images[s]} beat={beat} />
      ))}

      {/* 画面フラッシュ（技の色） */}
      <AnimatePresence>
        {beat.flash && (
          <motion.div key={`fl-${beatKey}`} initial={{ opacity: 0.55 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} style={{ position: 'absolute', inset: 0, background: beat.flash, mixBlendMode: 'multiply', zIndex: 10, pointerEvents: 'none' }} />
        )}
      </AnimatePresence>

      {label && (
        <div style={{ position: 'absolute', top: 8, left: '50%', translate: '-50% 0', zIndex: 11, background: 'rgba(255,253,245,.92)', border: '2.5px solid var(--ink)', borderRadius: 99, padding: '0.05rem 0.9rem', fontFamily: 'var(--font-display)', fontSize: '0.95rem', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {label}
        </div>
      )}
      <AnimatePresence mode="wait">{beat.callout && <CalloutBand key={beat.callout.id} c={beat.callout} />}</AnimatePresence>
      <AnimatePresence>{beat.order && <OrderPanel key="order" o={beat.order} names={names} />}</AnimatePresence>
    </motion.div>
  );
}

function Backdrop({ attrs }: { attrs: [Character['attribute'], Character['attribute']] }) {
  return (
    <svg viewBox="0 0 800 400" preserveAspectRatio="none" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <radialGradient id="sp0"><stop offset="0" stopColor={ATTRIBUTE_META[attrs[0]].color} stopOpacity="0.42" /><stop offset="1" stopColor={ATTRIBUTE_META[attrs[0]].color} stopOpacity="0" /></radialGradient>
        <radialGradient id="sp1"><stop offset="0" stopColor={ATTRIBUTE_META[attrs[1]].color} stopOpacity="0.42" /><stop offset="1" stopColor={ATTRIBUTE_META[attrs[1]].color} stopOpacity="0" /></radialGradient>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff9e8" /><stop offset="1" stopColor="#fdeccb" /></linearGradient>
      </defs>
      <rect width="800" height="400" fill="url(#sky)" />
      <ellipse cx="190" cy="250" rx="240" ry="200" fill="url(#sp0)" />
      <ellipse cx="610" cy="250" rx="240" ry="200" fill="url(#sp1)" />
      {/* 地面 */}
      <path d="M0,318 Q200,306 400,316 T800,314 L800,400 L0,400Z" fill="#f2dfb8" opacity="0.9" />
      <path d="M0,318 Q200,306 400,316 T800,314" fill="none" stroke="#33302b" strokeWidth="3.5" strokeLinecap="round" opacity="0.75" />
      <path d="M40,350 L90,346 M300,360 L360,356 M520,352 L580,356 M690,346 L750,350" stroke="#33302b" strokeWidth="2.4" strokeLinecap="round" opacity="0.28" />
      {/* 背景のらくがき */}
      <g stroke="#33302b" strokeWidth="2.4" fill="#fffdf5" opacity="0.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M110,70 Q100,70 100,60 Q102,48 116,50 Q122,38 138,44 Q154,42 156,58 Q166,62 160,70Z" />
        <path d="M640,52 Q630,52 632,42 Q636,32 648,36 Q656,26 668,34 Q682,34 680,46 Q690,52 682,58Z" />
      </g>
    </svg>
  );
}

function Fighter({ side, char, image, beat }: { side: Side; char: Character; image: string | null; beat: Beat }) {
  const dir = side === 0 ? 1 : -1;
  const hp = beat.hp[side];
  const down = hp <= 0;
  const acting = beat.acting === side;
  const hit = beat.hit === side;
  const chips = beat.chips[side];
  const floats = beat.floats.filter((f) => f.side === side);
  const fx = beat.fx && beat.fx.target === side ? beat.fx : null;
  const frozen = chips.some((c) => c.kind === 'freeze');
  const sleeping = chips.some((c) => c.kind === 'sleep');
  const badge = beat.first == null ? null : beat.first === side ? '1' : '2';

  return (
    <div style={{ position: 'absolute', bottom: '7%', [side === 0 ? 'left' : 'right']: '4%', width: 'min(40%, calc(var(--stage-h) * 0.8))', aspectRatio: '1' }}>
      {/* かげ */}
      <div style={{ position: 'absolute', left: '12%', right: '12%', bottom: '-4%', height: '9%', borderRadius: '50%', background: 'rgba(51,48,43,.28)', filter: 'blur(2px)' }} />
      <Aura chips={chips} side={side} />
      <motion.div
        animate={
          down
            ? { x: 0, y: '22%', rotate: dir * -78, scale: 0.9, opacity: 0.75, filter: 'grayscale(0.7)' }
            : hit
              ? { x: [0, -dir * 18, dir * 8, -dir * 5, 0], y: 0, rotate: [0, -dir * 7, dir * 3, 0, 0], scale: [1, 0.94, 1.02, 1, 1], filter: ['brightness(1)', 'brightness(2.4) saturate(0.4)', 'brightness(1.1)', 'brightness(1)', 'brightness(1)'], opacity: 1 }
              : acting
                ? { x: `${dir * 46}%`, y: 0, rotate: dir * 5, scale: 1.1, opacity: 1, filter: 'brightness(1)' }
                : { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, filter: frozen ? 'saturate(0.5) brightness(1.12)' : 'brightness(1)' }
        }
        transition={hit ? { duration: 0.42 } : acting ? { type: 'spring', stiffness: 380, damping: 18 } : { type: 'spring', stiffness: 220, damping: 20 }}
        style={{ position: 'relative', width: '100%', height: '100%', zIndex: 2, transformOrigin: '50% 90%' }}
      >
        <motion.div
          animate={sleeping || down ? { y: 0 } : { y: [0, -5, 0], scaleY: [1, 1.02, 1] }}
          transition={{ repeat: Infinity, duration: 2 + side * 0.4, ease: 'easeInOut' }}
          style={{ width: '100%', height: '100%', transformOrigin: '50% 100%' }}
        >
          <CharacterSprite imageUrl={image} attribute={char.attribute} name={char.name} flip={side === 1} />
        </motion.div>
      </motion.div>

      {badge && !down && (
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          style={{ position: 'absolute', top: '-2%', [side === 0 ? 'left' : 'right']: '2%', zIndex: 8, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-display)' }}
        >
          <span style={{ width: '1.9rem', height: '1.9rem', borderRadius: '50%', display: 'grid', placeItems: 'center', background: badge === '1' ? 'var(--crayon-yellow)' : '#e6e1d3', border: '3px solid var(--ink)', fontSize: '1.1rem' }}>{badge}</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 800 }}>{badge === '1' ? '先に うごく' : '後から'}</span>
        </motion.div>
      )}

      {fx && <Fx key={fx.id} fx={fx} />}
      {floats.map((f) => (
        <FloatText key={f.id} f={f} />
      ))}
    </div>
  );
}

