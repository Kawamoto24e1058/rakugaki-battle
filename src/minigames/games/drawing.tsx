import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { mulberry32 } from '../../engine/rng';
import { CharacterSprite } from '../../components/bits';
import { Arena, ChoiceButtons, Half } from '../Arena';
import { usePlayerKeys } from '../input';
import type { GameProps, Player } from '../types';
import type { MgFighter } from '../context';
import { TimeBar } from './body';
import { shuffle } from './choice';
import { sfx } from '../../audio/sfx';

const now = () => performance.now();

function Sprite({ f, size, flip, shadow }: { f: MgFighter; size: string; flip?: boolean; shadow?: boolean }) {
  return (
    <div style={{ width: size, height: size, filter: shadow ? 'brightness(0) opacity(0.85)' : undefined }}>
      <CharacterSprite imageUrl={f.image} attribute={f.attribute} name={shadow ? '' : f.name} flip={flip} />
    </div>
  );
}

// ================================================================ カップシャッフル
const CUP_SHOW = 1500;
const CUP_SWAPS = 6;
const CUP_SWAP_MS = 480;
const CUP_PICK = 4000;

/**
 * 3つの カップの下に ふたりの キャラ（と から）が かくれて シャッフル。
 * じぶんの キャラが どこに いるか あてる。
 */
export function Cups({ seed, cpu, cpuSkill, names, fighters, onFinish }: GameProps) {
  // item：0＝P1の キャラ、1＝P2の キャラ、2＝から
  const plan = useMemo(() => {
    const r = mulberry32(seed ^ 0x6375);
    const start = shuffle([0, 1, 2], r);
    const swaps: [number, number][] = Array.from({ length: CUP_SWAPS }, () => {
      const a = Math.floor(r() * 3);
      return [a, (a + 1 + Math.floor(r() * 2)) % 3];
    });
    return { start, swaps };
  }, [seed]);
  // slots[i] = その場所に ある item
  const [slots, setSlots] = useState<number[]>(plan.start);
  const [phase, setPhase] = useState<'show' | 'cover' | 'shuffle' | 'pick' | 'reveal'>('show');
  const picks = useRef<[{ i: number; t: number } | null, { i: number; t: number } | null]>([null, null]);
  const [view, setView] = useState<[number | null, number | null]>([null, null]);
  const pickStart = useRef(0);
  const [left, setLeft] = useState(CUP_PICK);
  const over = useRef(false);
  const finalSlots = useMemo(() => {
    const s = [...plan.start];
    for (const [a, b] of plan.swaps) [s[a], s[b]] = [s[b], s[a]];
    return s;
  }, [plan]);
  const answer = (p: Player) => finalSlots.indexOf(p);

  const end = () => {
    if (over.current) return;
    over.current = true;
    setPhase('reveal');
    const sc = (p: Player) => {
      const k = picks.current[p];
      return k && k.i === answer(p) ? 60 + 40 * Math.max(0, 1 - k.t / CUP_PICK) : 0;
    };
    window.setTimeout(() => onFinish([sc(0), sc(1)]), 1100);
  };
  const pick = (p: Player, i: number) => {
    if (over.current || phase !== 'pick' || picks.current[p]) return;
    picks.current = p === 0 ? [{ i, t: now() - pickStart.current }, picks.current[1]] : [picks.current[0], { i, t: now() - pickStart.current }];
    setView([picks.current[0]?.i ?? null, picks.current[1]?.i ?? null]);
    if (picks.current[0] && picks.current[1]) window.setTimeout(end, 300);
  };
  usePlayerKeys((p, i) => {
    if (p === 1 && cpu) return;
    pick(p, i);
  });

  // みせる → かぶせる → シャッフル → えらぶ
  useEffect(() => {
    const ids: number[] = [];
    ids.push(window.setTimeout(() => setPhase('cover'), CUP_SHOW));
    ids.push(window.setTimeout(() => setPhase('shuffle'), CUP_SHOW + 500));
    plan.swaps.forEach(([a, b], k) => {
      ids.push(
        window.setTimeout(() => {
          sfx.tick(1.1);
          setSlots((s) => {
            const n = [...s];
            [n[a], n[b]] = [n[b], n[a]];
            return n;
          });
        }, CUP_SHOW + 600 + k * CUP_SWAP_MS),
      );
    });
    const pickAt = CUP_SHOW + 600 + CUP_SWAPS * CUP_SWAP_MS + 250;
    ids.push(
      window.setTimeout(() => {
        pickStart.current = now();
        setPhase('pick');
      }, pickAt),
    );
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [plan]);
  useEffect(() => {
    if (phase !== 'pick') return;
    const id = window.setInterval(() => {
      const el = now() - pickStart.current;
      setLeft(Math.max(0, CUP_PICK - el));
      if (el >= CUP_PICK) {
        window.clearInterval(id);
        end();
      }
    }, 80);
    let cpuT = 0;
    if (cpu) {
      const r = mulberry32(seed ^ 0x6370);
      const right = r() < 0.5 + cpuSkill * 0.42;
      const ans = answer(1);
      cpuT = window.setTimeout(() => pick(1, right ? ans : (ans + 1 + Math.floor(r() * 2)) % 3), 700 + (1 - cpuSkill) * 1600 + r() * 600);
    }
    return () => {
      window.clearInterval(id);
      window.clearTimeout(cpuT);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const lifted = phase === 'show' || phase === 'reveal';
  // item の いまの 場所
  const posOf = (item: number) => slots.indexOf(item);
  return (
    <Arena
      top={
        <div style={{ display: 'grid', gap: 4 }}>
          <TimeBar ms={phase === 'pick' ? left : phase === 'reveal' ? 0 : CUP_PICK} total={CUP_PICK} label={phase === 'show' ? 'よく みて！ どこに いるかな？' : phase === 'pick' ? 'じぶんの キャラは どこ？' : phase === 'reveal' ? 'こたえ！' : 'シャッフル！'} />
          <div style={{ position: 'relative', height: '8.5rem', border: '4px solid var(--ink)', borderRadius: 14, background: '#fff8e6', overflow: 'hidden' }}>
            {[0, 1, 2].map((item) => {
              const pos = posOf(item);
              return (
                <motion.div
                  key={item}
                  animate={{ y: phase === 'shuffle' ? [0, item % 2 ? -14 : 14, 0] : 0 }}
                  transition={{ y: { duration: CUP_SWAP_MS / 1000 } }}
                  style={{ position: 'absolute', top: 0, bottom: 0, width: '27.3%', left: `${pos * 33.3 + 3}%`, transition: `left ${CUP_SWAP_MS / 1000 - 0.08}s ease-in-out` }}
                >
                  {/* なかみ */}
                  <div style={{ position: 'absolute', left: '27%', right: '27%', bottom: '7%', height: '46%' }}>
                    {item < 2 ? <Sprite f={fighters[item]} size="100%" flip={item === 1} /> : <div style={{ textAlign: 'center', fontWeight: 900, marginTop: '35%', color: 'var(--ink-soft)' }}>から</div>}
                  </div>
                  {/* カップ */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: '4%',
                      height: '78%',
                      transform: `translateY(${lifted ? '-62%' : '0%'})`,
                      transition: 'transform .35s cubic-bezier(.3,1.5,.5,1)',
                    }}
                  >
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
                      <path d="M10,97 L22,6 Q50,-2 78,6 L90,97 Q50,105 10,97Z" fill="#e8503a" stroke="#33302b" strokeWidth={4} />
                      <path d="M22,60 Q50,66 78,60" stroke="#fff" strokeWidth={5} fill="none" opacity={0.6} />
                    </svg>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      }
    >
      {([0, 1] as Player[]).map((p) => (
        <Half
          key={p}
          player={p}
          name={names[p]}
          cpu={p === 1 && cpu}
          style={{ minHeight: '8rem' }}
          mood={phase === 'reveal' && view[p] != null ? (view[p] === answer(p) ? 'good' : 'bad') : null}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 900 }}>
            <Sprite f={fighters[p]} size="1.8rem" flip={p === 1} /> は どこ？
          </div>
          <ChoiceButtons
            player={p}
            options={['ひだり', 'まんなか', 'みぎ']}
            onPick={(i) => pick(p, i)}
            disabled={phase !== 'pick' || view[p] != null}
            picked={view[p]}
            correct={phase === 'reveal' ? answer(p) : null}
            cpu={p === 1 && cpu}
          />
        </Half>
      )) as [ReactNode, ReactNode]}
    </Arena>
  );
}

// ================================================================ だれの かげ？