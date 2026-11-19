import { useEffect, useState } from 'react';
import { useGame } from '../store/gameStore';
import { listDrawings, type SavedDrawing } from '../store/drawings';
import { ATTRIBUTE_META } from '../engine/attributes';

export function TitleScene() {
  const startSolo = useGame((s) => s.startSolo);
  const startVersus = useGame((s) => s.startVersus);
  const openZukan = useGame((s) => s.openZukan);
  const openPrintTemplate = useGame((s) => s.openPrintTemplate);
  const openCards = useGame((s) => s.openCards);
  const openBadges = useGame((s) => s.openBadges);
  const devQuickBattle = useGame((s) => s.devQuickBattle);
  const zukanCount = useGame((s) => s.zukan.length);

  return (
    <div className="scene" style={{ justifyContent: 'center' }}>
      <h1 className="wiggle" style={{ fontSize: 'clamp(2.6rem, 9vw, 4.5rem)', color: 'var(--crayon-red)' }}>
        ラクガキ
        <br />
        バトル
      </h1>
      <p style={{ fontSize: '1.1rem', textAlign: 'center', maxWidth: '22rem' }}>
        かみに かいた えを カメラで とりこむと、
        <br />
        つよさが きまって バトルできる！
      </p>

      <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem', width: 'min(20rem, 90%)' }}>
        <button className="crayon-btn primary big" onClick={startSolo}>
          ひとりで あそぶ
        </button>
        <button className="crayon-btn big" onClick={startVersus}>
          ふたりで たいせん
        </button>
        <button className="crayon-btn" onClick={openCards}>
          カードずかん
        </button>
        <button className="crayon-btn" onClick={openZukan}>
          ずかんを みる（{zukanCount}）
        </button>
        <button className="crayon-btn" onClick={openPrintTemplate}>
          したがきようしを いんさつ
        </button>
        <button
          className="crayon-btn"
          style={{ fontSize: '0.85rem', opacity: 0.7, borderStyle: 'dashed' }}
          onClick={() => devQuickBattle('solo')}
        >
          バトル直行（開発・撮影スキップ）
        </button>
      </div>

      <DrawingShelf onPrint={openBadges} />
    </div>
  );
}

/**
 * いままでに 取りこんだ 絵の たな。
 * おして えらぶ → 「かんバッジに する」で 印刷画面へ（えらんだ 絵が 入った 状態で ひらく）。
 */
function DrawingShelf({ onPrint }: { onPrint: (ids?: string[]) => void }) {
  const [list, setList] = useState<SavedDrawing[] | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => {
    void listDrawings().then(setList);
  }, []);
  const toggle = (id: string) => setSel((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  return (
    <section className="sketch-card" style={{ marginTop: '1.4rem', width: 'min(52rem, 94%)', padding: '0.8rem 1rem', display: 'grid', gap: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>いままでの え（{list?.length ?? 0}）</strong>
        <span style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>おして えらぶと かんバッジに できるよ</span>
        <div style={{ flex: 1 }} />
        {sel.length > 0 && (
          <button className="crayon-btn" style={{ fontSize: '0.85rem', padding: '0.15em 0.8em' }} onClick={() => setSel([])}>
            えらびを はずす
          </button>
        )}
        <button className={`crayon-btn${sel.length ? ' primary' : ''}`} style={{ fontSize: '0.95rem', padding: '0.2em 1em' }} onClick={() => onPrint(sel)}>
          {sel.length ? `${sel.length}まいを かんバッジに する` : 'かんバッジを いんさつ'}
        </button>
      </div>

      {list === null ? (
        <p style={{ fontSize: '0.85rem', margin: 0 }}>よみこみちゅう…</p>
      ) : list.length === 0 ? (
        <p style={{ fontSize: '0.85rem', margin: 0, color: 'var(--ink-soft)' }}>まだ ないよ。えを とりこんで「けってい」すると ここに たまっていくよ。</p>
      ) : (
        <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', padding: '0.3rem 0.2rem 0.6rem' }}>
          {list.map((d) => {
            const on = sel.includes(d.id);
            const color = ATTRIBUTE_META[d.attribute]?.color ?? '#e8503a';
            return (
              <button
                key={d.id}
                onClick={() => toggle(d.id)}
                aria-pressed={on}
                title={d.name}
                style={{
                  flex: '0 0 auto',
                  width: '6.4rem',
                  display: 'grid',
                  gap: 2,
                  justifyItems: 'center',
                  padding: '0.35rem 0.3rem',
                  borderRadius: 14,
                  cursor: 'pointer',
                  background: on ? '#fff3c4' : '#fffdf5',
                  border: `3px solid ${on ? 'var(--crayon-red)' : 'var(--ink)'}`,
                  boxShadow: on ? '0 0 0 3px #e8503a44' : '2px 2px 0 rgba(0,0,0,.15)',
                  position: 'relative',
                  transform: on ? 'translateY(-2px)' : undefined,
                }}
              >
                <span style={{ width: '5.2rem', height: '5.2rem', borderRadius: '50%', background: `radial-gradient(#fff, ${color}33)`, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                  <img src={d.image} alt="" loading="lazy" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
                </span>
                <span style={{ fontSize: '0.78rem', fontWeight: 900, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                {on && (
                  <span style={{ position: 'absolute', top: 2, right: 4, background: 'var(--crayon-red)', color: '#fff', borderRadius: 99, fontSize: '0.75rem', fontWeight: 900, padding: '0 0.45em' }}>
                    {sel.indexOf(d.id) + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
