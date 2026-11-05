import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const CHAR_MS = 32;

/**
 * 実況の まど（ポケモン風）：1文字ずつ 出して、読みおわったら ▼ が ぴこぴこ。
 * おす（クリック・スペース・エンター）と：とちゅうなら 文を ぜんぶ 出す／出しおわって いたら つぎへ。
 * 自動でも すすむ（beat.ms は 文の ながさに あわせて ある）。
 */
export function MessageBox({ text, onNext, active }: { text: string; onNext: () => void; active: boolean }) {
  const chars = Array.from(text);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    if (!text) return;
    const id = window.setInterval(() => {
      setShown((n) => {
        if (n >= chars.length) {
          window.clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, CHAR_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const done = shown >= chars.length;
  const press = () => {
    if (!active) return;
    if (!done) setShown(chars.length);
    else onNext();
  };
  // スペース／エンターでも はやおくり
  useEffect(() => {
    if (!active) return;
    const on = (e: KeyboardEvent) => {
      if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return;
      e.preventDefault();
      press();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  return (
    <div
      onClick={press}
      role="button"
      tabIndex={-1}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 'clamp(4.6rem, 12vh, 6.2rem)',
        background: '#fffdf5',
        border: '5px solid var(--ink)',
        borderRadius: 14,
        boxShadow: 'inset 0 0 0 3px #fffdf5, inset 0 0 0 5px #c9c1b0, 4px 5px 0 rgba(0,0,0,.18)',
        padding: 'clamp(.5rem, 1.6vh, .9rem) clamp(.9rem, 3vw, 1.6rem)',
        display: 'flex',
        alignItems: 'center',
        cursor: active ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 'clamp(1.15rem, 3.4vw, 1.7rem)', lineHeight: 1.45, whiteSpace: 'pre-line', letterSpacing: '0.02em' }}>
        {chars.slice(0, shown).join('')}
        {/* のこりの 文字は 見えない ように して、まどの 大きさが かわらない ように */}
        <span style={{ visibility: 'hidden' }}>{chars.slice(shown).join('')}</span>
      </div>
      {done && active && (
        <motion.div
          animate={{ y: [0, 4, 0] }}
          transition={{ repeat: Infinity, duration: 0.7 }}
          style={{ position: 'absolute', right: '0.9rem', bottom: '0.45rem', width: 0, height: 0, borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderTop: '12px solid var(--ink)' }}
        />
      )}
    </div>
  );
}
