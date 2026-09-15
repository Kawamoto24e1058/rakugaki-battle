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
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
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
      <div
        className="no-print sketch-card"
        style={{ maxWidth: '26rem', padding: '0.6rem 1rem', fontSize: '0.82rem', color: 'var(--ink-soft)', textAlign: 'left' }}
      >
        いんさつ画面で ⚠️ この2つを かくにんしてね：
        <br />
        ・「背景のグラフィック」を ON（黒い四角が消えるのを ふせぐ）
        <br />
        ・「ヘッダーとフッター」を OFF（URLなどの よぶんな もじを けす）
      </div>
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
              ① 4つの かどの めじるしの なかに じゆうに かいてね
              <br />
              ② くろい ■ の うえは かかないでね
            </div>
          </div>

          {/*
            描画エリア（160mm四方、中央）の目印。以前は四辺ぜんぶに実線のわくを
            引いていたが、撮影後の切り抜き処理が「わく線のインク」と「際に描いた
            子どもの絵」を位置だけでは区別できず、絵ごと切ってしまう事故が実写で
            起きた。かといって薄すぎる目印は子どもに見えにくい（ユーザー指摘）。
            なので「辺には何も引かず、角だけに目立つ色のL字目印を置く」形に。
            角だけなら切り抜き側も安全に処理でき（マーカーと同じく角の処理だけで
            対応可）、辺の途中の絵を巻き込む心配が構造的に無くなる。
          */}
          {(
            [
              { cx: 15, cy: 40, hEdge: 'top' as const, vEdge: 'left' as const },
              { cx: 175, cy: 40, hEdge: 'top' as const, vEdge: 'right' as const },
              { cx: 15, cy: 200, hEdge: 'bottom' as const, vEdge: 'left' as const },
              { cx: 175, cy: 200, hEdge: 'bottom' as const, vEdge: 'right' as const },
            ] as const
          ).map((b, i) => {
            const arm = 12; // mm
            const svgLeft = b.vEdge === 'left' ? b.cx : b.cx - arm;
            const svgTop = b.hEdge === 'top' ? b.cy : b.cy - arm;
            const thFrac = 12; // 100分率での太さ
            return (
              <svg
                key={i}
                width={`${arm}mm`}
                height={`${arm}mm`}
                viewBox="0 0 100 100"
                style={{ position: 'absolute', left: `${svgLeft}mm`, top: `${svgTop}mm` }}
              >
                <rect x={0} y={b.hEdge === 'top' ? 0 : 100 - thFrac} width={100} height={thFrac} fill="#e8b32a" />
                <rect x={b.vEdge === 'left' ? 0 : 100 - thFrac} y={0} width={thFrac} height={100} fill="#e8b32a" />
              </svg>
            );
          })}
          {[
            { left: '15mm', top: '40mm' }, // top-left
            { left: '175mm', top: '40mm' }, // top-right
            { left: '15mm', top: '200mm' }, // bottom-left
            { left: '175mm', top: '200mm' }, // bottom-right
          ].map((pos, i) => (
            // 「背景のグラフィック」OFFでも消えないよう、背景色ではなくSVGの塗りで描く
            <svg
              key={i}
              width="12mm"
              height="12mm"
              viewBox="0 0 10 10"
              style={{ position: 'absolute', left: `calc(${pos.left} - 6mm)`, top: `calc(${pos.top} - 6mm)` }}
            >
              <rect x="0" y="0" width="10" height="10" fill="#000" />
            </svg>
          ))}

          <div style={{ position: 'absolute', left: 0, right: 0, top: '208mm', textAlign: 'center', fontSize: '3.6mm', color: '#999' }}>
            ラクガキバトル
          </div>
        </div>
      </div>
    </div>
  );
}
