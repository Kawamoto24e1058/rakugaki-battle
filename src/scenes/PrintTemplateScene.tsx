import { useGame } from '../store/gameStore';

/**
 * 「したがき用紙」の印刷画面。
 * A4に わく＋四隅の黒マーカーを印刷 → 子どもがその中に描く → 撮影時に
 * マーカーを検出して傾き補正＋背景の透明化を行う（engine/scan）。
 */
export function PrintTemplateScene() {
  const reset = useGame((s) => s.reset);

  return (
    <div className="scene" style={{ justifyContent: 'flex-start', gap: '1rem', paddingTop: '1.2rem' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page-bg { background: #fff !important; padding: 0 !important; }
          body, .scene { background: #fff !important; }
        }
        @page { size: A4; margin: 10mm; }
        .print-sheet {
          position: relative;
          width: 190mm;
          height: 277mm;
          background: #fff;
          color: #222;
          font-family: var(--font-body), sans-serif;
        }
        @media screen {
          .print-sheet-wrap { zoom: 0.46; }
        }
      `}</style>

      <h2 className="no-print" style={{ fontSize: '1.6rem' }}>
        したがきようしを いんさつ
      </h2>
      <p className="no-print" style={{ fontSize: '0.9rem', textAlign: 'center', maxWidth: '26rem', color: 'var(--ink-soft)' }}>
        この用紙をA4で いんさつして、わくの中に かいてもらうと、しゃしんを とったときに
        きれいに まっすぐ・きりぬきで とりこめるよ。
      </p>
      <div className="no-print" style={{ display: 'flex', gap: '0.8rem' }}>
        <button className="crayon-btn primary big" onClick={() => window.print()}>
          🖨️ いんさつする
        </button>
        <button className="crayon-btn" onClick={reset}>
          もどる
        </button>
      </div>

      <div className="print-sheet-wrap sketch-card print-page-bg" style={{ padding: '0.6rem' }}>
        <div className="print-sheet">
          <div style={{ textAlign: 'center', paddingTop: '6mm' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '9mm', color: '#c0392b' }}>
              ラクガキバトル したがきようし
            </div>
            <div style={{ fontSize: '4.2mm', marginTop: '2mm' }}>
              ① きいろい わくの なかに じゆうに かいてね
              <br />
              ② くろい ■ の うえは かかないでね
            </div>
          </div>

          {/* 描画エリア（160mm四方、中央）＋四隅マーカー */}
          <div
            style={{
              position: 'absolute',
              left: '15mm',
              top: '40mm',
              width: '160mm',
              height: '160mm',
              border: '1mm solid var(--crayon-yellow, #e8b32a)',
              borderRadius: '3mm',
              boxSizing: 'border-box',
            }}
          />
          {[
            { left: '15mm', top: '40mm' }, // top-left
            { left: '175mm', top: '40mm' }, // top-right
            { left: '15mm', top: '200mm' }, // bottom-left
            { left: '175mm', top: '200mm' }, // bottom-right
          ].map((pos, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `calc(${pos.left} - 6mm)`,
                top: `calc(${pos.top} - 6mm)`,
                width: '12mm',
                height: '12mm',
                background: '#000',
              }}
            />
          ))}

          <div style={{ position: 'absolute', left: 0, right: 0, top: '208mm', textAlign: 'center', fontSize: '3.6mm', color: '#999' }}>
            ラクガキバトル
          </div>
        </div>
      </div>
    </div>
  );
}
