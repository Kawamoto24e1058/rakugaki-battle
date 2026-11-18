import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../store/gameStore';
import { deleteDrawing, listDrawings, saveDrawing, type SavedDrawing } from '../store/drawings';
import { ATTRIBUTE_META } from '../engine/attributes';
import { stickerOf } from '../components/sticker';

/**
 * 缶バッジの 印刷。
 *  取りこんだ 絵を えらぶ → A4 に 缶バッジ用の 円（きりとり線つき）で ならべる → 実際の サイズで 印刷。
 *  ・きる 直径（紙を 切る 円）と みえる 直径（バッジの 表）を mm で あわせられる
 *  ・1まいずつ 絵の 大きさ・位置を ちょうせい できる
 *  ・おなじ 絵を 何こ でも ならべられる
 */

type Bg = 'attr' | 'pastel' | 'white';
interface Settings {
  cut: number;
  face: number;
  bg: Bg;
  name: boolean;
  outline: boolean;
  guide: boolean;
}
interface Pick {
  copies: number;
  zoom: number;
  dx: number;
  dy: number;
}

const DEFAULTS: Settings = { cut: 44, face: 32, bg: 'pastel', name: true, outline: true, guide: true };
const SKEY = 'rakugaki.badge.settings.v1';
const PAGE_W = 190; // mm（A4 − ふち 10mm×2）
const PAGE_H = 274; // 277mm だと プリンターに よって 2まいめに はみでるので すこし ゆとり
const FOOT = 12; // 下の ものさし の ぶん
const GAP = 3;

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SKEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* つかえなくても 続ける */
  }
  return DEFAULTS;
}

/** 色を 白と まぜる（t=1 で 白）。 */
function mix(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * t));
  return `rgb(${c.join(',')})`;
}

export function layoutOf(cut: number) {
  const cols = Math.max(1, Math.floor((PAGE_W + GAP) / (cut + GAP)));
  const rows = Math.max(1, Math.floor((PAGE_H - FOOT + GAP) / (cut + GAP)));
  return { cols, rows, perPage: cols * rows };
}

/** 缶バッジ 1こ（mm で 描く SVG）。 */
function Badge({ d, s, p, image, uid, screenPx }: { d: SavedDrawing; s: Settings; p: Pick; image: string; uid: string; screenPx?: number }) {
  const R = s.cut / 2;
  const F = Math.min(s.face, s.cut) / 2;
  const color = ATTRIBUTE_META[d.attribute]?.color ?? '#e8503a';
  const nameOn = s.name && d.name;
  // 絵は みえる 円に おさまる 大きさが 100%
  const size = F * 2 * (nameOn ? 0.8 : 0.92) * p.zoom;
  const cy = (nameOn ? -F * 0.1 : 0) + p.dy;
  const fontSize = Math.min(F * 0.3, (F * 1.5) / Math.max(3, [...d.name].length));
  const w = screenPx ? `${screenPx}px` : `${s.cut}mm`;
  return (
    <svg width={w} height={w} viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`} style={{ display: 'block' }}>
      <defs>
        <clipPath id={`clip-${uid}`}>
          <circle r={R} />
        </clipPath>
        <radialGradient id={`bg-${uid}`}>
          <stop offset="0%" stopColor={mix(color, 0.85)} />
          <stop offset="100%" stopColor={mix(color, 0.45)} />
        </radialGradient>
      </defs>
      <g clipPath={`url(#clip-${uid})`}>
        <rect x={-R} y={-R} width={R * 2} height={R * 2} fill={s.bg === 'white' ? '#fff' : s.bg === 'attr' ? color : `url(#bg-${uid})`} />
        {s.bg === 'attr' && <circle r={F * 0.92} fill={mix(color, 0.82)} />}
        <image href={image} x={-size / 2 + p.dx} y={cy - size / 2} width={size} height={size} preserveAspectRatio="xMidYMid meet" />
        {nameOn && (
          <text
            x={0}
            y={F * 0.78}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize}
            fontWeight={900}
            fill="#33302b"
            stroke="#fff"
            strokeWidth={fontSize * 0.22}
            paintOrder="stroke"
            style={{ fontFamily: 'var(--font-display), sans-serif' }}
          >
            {d.name}
          </text>
        )}
      </g>
      {/* きりとり線 */}
      <circle r={R - 0.1} fill="none" stroke="#9a948b" strokeWidth={0.2} />
      {/* みえる はんい（画面だけ） */}
      {s.guide && <circle className="badge-guide" r={F} fill="none" stroke="#e8503a" strokeWidth={0.25} strokeDasharray="1 0.8" />}
    </svg>
  );
}

function Num({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'grid', gridTemplateColumns: '7.5em 1fr 5.2em', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
          }}
          style={{ width: '3.6em', fontSize: '0.9rem' }}
        />
        {unit}
      </span>
    </label>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map(([v, l]) => (
        <button key={v} className={`crayon-btn${value === v ? ' primary' : ''}`} style={{ fontSize: '0.8rem', padding: '0.15em 0.8em' }} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

const newPick = (): Pick => ({ copies: 1, zoom: 1, dx: 0, dy: 0 });

export function BadgePrintScene() {
  const reset = useGame((s) => s.reset);
  const [drawings, setDrawings] = useState<SavedDrawing[] | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [s, setS] = useState<Settings>(loadSettings);
  const [stickers, setStickers] = useState<Record<string, string>>({});

  const reload = () => void listDrawings().then(setDrawings);
  useEffect(reload, []);
  useEffect(() => {
    try {
      localStorage.setItem(SKEY, JSON.stringify(s));
    } catch {
      /* ほぞん できなくても 続ける */
    }
  }, [s]);

  const byId = useMemo(() => new Map((drawings ?? []).map((d) => [d.id, d])), [drawings]);
  // 白い ふちつきの 画像（えらんだ ものだけ つくる）
  useEffect(() => {
    for (const id of order) {
      const d = byId.get(id);
      if (!d || stickers[d.id]) continue;
      void stickerOf(d.image).then((u) => setStickers((m) => ({ ...m, [d.id]: u })));
    }
  }, [order, byId, stickers]);

  const set = (patch: Partial<Settings>) => setS((o) => ({ ...o, ...patch }));
  const toggle = (id: string) => {
    if (picks[id]) {
      setOrder((o) => o.filter((x) => x !== id));
      setPicks(({ [id]: _, ...rest }) => rest);
      if (editing === id) setEditing(null);
    } else {
      setOrder((o) => [...o, id]);
      setPicks((m) => ({ ...m, [id]: newPick() }));
    }
  };
  const patchPick = (id: string, patch: Partial<Pick>) => setPicks((m) => ({ ...m, [id]: { ...m[id], ...patch } }));

  const imageOf = (d: SavedDrawing) => (s.outline ? (stickers[d.id] ?? d.image) : d.image);

  // ならべる
  const { cols, perPage } = layoutOf(s.cut);
  const items = order.flatMap((id) => {
    const d = byId.get(id);
    const p = picks[id];
    return d && p ? Array.from({ length: p.copies }, (_, k) => ({ d, p, key: `${id}-${k}` })) : [];
  });
  const pages: (typeof items)[] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));

  async function addFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      const url = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.readAsDataURL(f);
      });
      await saveDrawing({ id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: f.name.replace(/\.[^.]+$/, '').slice(0, 12), attribute: 'fire', image: url, createdAt: Date.now() });
    }
    reload();
  }

  const editD = editing ? byId.get(editing) : undefined;
  const editP = editing ? picks[editing] : undefined;

  return (
    <div className="scene" style={{ justifyContent: 'flex-start', gap: '1rem', paddingTop: '1.2rem' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .badge-guide { display: none !important; }
          html, body, #root, .scene { background: #fff !important; padding: 0 !important; margin: 0 !important; min-height: 0 !important; }
          .badge-pages { gap: 0 !important; padding: 0 !important; background: none !important; border: none !important; box-shadow: none !important; }
          .badge-sheet { box-shadow: none !important; outline: none !important; break-after: page; }
          .badge-sheet:last-child { break-after: auto; }
        }
        @page { size: A4; margin: 10mm; }
        .badge-sheet {
          position: relative;
          width: ${PAGE_W}mm;
          height: ${PAGE_H}mm;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          overflow: hidden;
        }
        @media screen {
          .badge-pages { zoom: 0.42; }
          .badge-sheet { outline: 1px solid #ccc; box-shadow: 0 4px 14px rgba(0,0,0,.12); }
        }
      `}</style>

      <h2 className="no-print" style={{ fontSize: '1.6rem' }}>
        かんバッジを いんさつ
      </h2>

      <div className="no-print" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: '72rem', alignItems: 'flex-start' }}>
        {/* 左：えらぶ・ちょうせい */}
        <div style={{ flex: '1 1 26rem', display: 'grid', gap: '0.8rem', minWidth: 0 }}>
          <div className="sketch-card" style={{ padding: '0.8rem 1rem', display: 'grid', gap: '0.6rem' }}>
            <strong style={{ fontFamily: 'var(--font-display)' }}>1. 絵を えらぶ（{order.length}しゅるい・{items.length}こ）</strong>
            {drawings === null ? (
              <p style={{ fontSize: '0.85rem' }}>よみこみちゅう…</p>
            ) : drawings.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>まだ 絵が ないよ。あそんで 絵を とりこむと ここに ならぶよ（ファイルからも くわえられます）。</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(6.5rem, 1fr))', gap: '0.5rem', maxHeight: '22rem', overflowY: 'auto', padding: 2 }}>
                {drawings.map((d) => {
                  const p = picks[d.id];
                  return (
                    <div key={d.id} style={{ border: `3px solid ${p ? 'var(--crayon-red)' : 'var(--border)'}`, borderRadius: 10, padding: 4, background: p ? '#fff3ee' : '#fff', display: 'grid', gap: 3, textAlign: 'center' }}>
                      <button onClick={() => toggle(d.id)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} aria-pressed={!!p}>
                        <img src={d.image} alt={d.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'contain' }} />
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                      </button>
                      {p ? (
                        <div style={{ display: 'grid', gap: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: '0.8rem' }}>
                            <button className="crayon-btn" style={{ padding: '0 0.5em', fontSize: '0.8rem' }} onClick={() => patchPick(d.id, { copies: Math.max(1, p.copies - 1) })}>
                              −
                            </button>
                            {p.copies}こ
                            <button className="crayon-btn" style={{ padding: '0 0.5em', fontSize: '0.8rem' }} onClick={() => patchPick(d.id, { copies: Math.min(60, p.copies + 1) })}>
                              ＋
                            </button>
                          </div>
                          <button className={`crayon-btn${editing === d.id ? ' primary' : ''}`} style={{ padding: '0 0.4em', fontSize: '0.75rem' }} onClick={() => setEditing(editing === d.id ? null : d.id)}>
                            ちょうせい
                          </button>
                        </div>
                      ) : (
                        <button
                          style={{ fontSize: '0.65rem', border: 'none', background: 'none', color: 'var(--ink-soft)', cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={async () => {
                            if (!window.confirm(`「${d.name}」の 絵を けしますか？（もとに もどせません）`)) return;
                            await deleteDrawing(d.id);
                            reload();
                          }}
                        >
                          けす
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {drawings && drawings.length > 0 && (
                <>
                  <button className="crayon-btn" style={{ fontSize: '0.8rem', padding: '0.15em 0.8em' }} onClick={() => { setOrder(drawings.map((d) => d.id)); setPicks(Object.fromEntries(drawings.map((d) => [d.id, picks[d.id] ?? newPick()]))); }}>
                    ぜんぶ えらぶ
                  </button>
                  <button className="crayon-btn" style={{ fontSize: '0.8rem', padding: '0.15em 0.8em' }} onClick={() => { setOrder([]); setPicks({}); setEditing(null); }}>
                    えらびを はずす
                  </button>
                </>
              )}
              <label className="crayon-btn" style={{ fontSize: '0.8rem', padding: '0.15em 0.8em', cursor: 'pointer' }}>
                ファイルから くわえる
                <input type="file" accept="image/*" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
              </label>
            </div>
          </div>

          {editD && editP && (
            <div className="sketch-card" style={{ padding: '0.8rem 1rem', display: 'grid', gap: '0.5rem' }}>
              <strong style={{ fontFamily: 'var(--font-display)' }}>「{editD.name}」を ちょうせい</strong>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 auto' }}>
                  <Badge d={editD} s={{ ...s, guide: true }} p={editP} image={imageOf(editD)} uid="edit" screenPx={190} />
                  <div style={{ fontSize: '0.7rem', color: 'var(--ink-soft)', textAlign: 'center', marginTop: 2 }}>赤い 点線の 内がわが バッジの 表</div>
                </div>
                <div style={{ flex: '1 1 14rem', display: 'grid', gap: '0.4rem' }}>
                  <Num label="おおきさ" value={Math.round(editP.zoom * 100)} min={40} max={180} step={1} unit="%" onChange={(v) => patchPick(editD.id, { zoom: v / 100 })} />
                  <Num label="よこ" value={editP.dx} min={-15} max={15} step={0.5} unit="mm" onChange={(v) => patchPick(editD.id, { dx: v })} />
                  <Num label="たて" value={editP.dy} min={-15} max={15} step={0.5} unit="mm" onChange={(v) => patchPick(editD.id, { dy: v })} />
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="crayon-btn" style={{ fontSize: '0.8rem', padding: '0.15em 0.8em' }} onClick={() => patchPick(editD.id, { zoom: 1, dx: 0, dy: 0 })}>
                      もとに もどす
                    </button>
                    <button
                      className="crayon-btn"
                      style={{ fontSize: '0.8rem', padding: '0.15em 0.8em' }}
                      onClick={() => setPicks((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { ...v, zoom: editP.zoom }])))}
                    >
                      この おおきさを ぜんぶに
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="sketch-card" style={{ padding: '0.8rem 1rem', display: 'grid', gap: '0.5rem' }}>
            <strong style={{ fontFamily: 'var(--font-display)' }}>2. サイズを あわせる</strong>
            <Num label="紙を きる 直径" value={s.cut} min={25} max={80} step={0.5} unit="mm" onChange={(v) => set({ cut: v, face: Math.min(s.face, v) })} />
            <Num label="バッジの 表" value={s.face} min={20} max={80} step={0.5} unit="mm" onChange={(v) => set({ face: Math.min(v, s.cut) })} />
            <div style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>
              キットの 説明書や テンプレートの 数字に あわせてね（32mm の バッジなら 表 32mm・紙は 44mm 前後が おおい）。1まいに {perPage}こ（よこ {cols}こ）ならびます。
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '7.5em 1fr', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              <span>うしろの いろ</span>
              <Seg value={s.bg} options={[['pastel', 'うすい ぞくせい色'], ['attr', 'ぞくせい色'], ['white', 'しろ']]} onChange={(v) => set({ bg: v })} />
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.9rem' }}>
              <label><input type="checkbox" checked={s.name} onChange={(e) => set({ name: e.target.checked })} /> なまえを 入れる</label>
              <label><input type="checkbox" checked={s.outline} onChange={(e) => set({ outline: e.target.checked })} /> 白い ふち</label>
              <label><input type="checkbox" checked={s.guide} onChange={(e) => set({ guide: e.target.checked })} /> 表の はんいを 見せる（画面だけ）</label>
            </div>
            <button className="crayon-btn" style={{ fontSize: '0.8rem', padding: '0.15em 0.8em', justifySelf: 'start' }} onClick={() => setS(DEFAULTS)}>
              サイズを はじめに もどす
            </button>
          </div>

          <div className="sketch-card" style={{ padding: '0.8rem 1rem', display: 'grid', gap: '0.5rem', fontSize: '0.82rem' }}>
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>3. いんさつ</strong>
            <div style={{ color: 'var(--ink-soft)', lineHeight: 1.6 }}>
              いんさつ画面で：
              <br />・倍率は「100%」または「実際のサイズ」（「用紙に合わせる」は ×）
              <br />・「背景のグラフィック」を ON、「ヘッダーとフッター」を OFF
              <br />・紙は ふつうの 紙か うすい 光沢紙が おすすめ（あつい 写真用紙は はさまりにくい）
              <br />・刷ったら 下の ものさしが ちょうど 5cm か たしかめてね
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button className="crayon-btn primary big" disabled={items.length === 0} onClick={() => window.print()}>
                いんさつする（{pages.length}まい）
              </button>
              <button className="crayon-btn" onClick={reset}>
                もどる
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 印刷する 紙（画面では ちいさく 見せる） */}
      {items.length > 0 && (
        <div className="badge-pages" style={{ display: 'grid', gap: '10mm', justifyItems: 'center' }}>
          {pages.map((pg, pi) => (
            <div key={pi} className="badge-sheet">
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${s.cut}mm)`, gap: `${GAP}mm`, justifyContent: 'center', paddingTop: '1mm' }}>
                {pg.map((it, i) => (
                  <Badge key={it.key} d={it.d} s={s} p={it.p} image={imageOf(it.d)} uid={`${pi}-${i}`} />
                ))}
              </div>
              {/* ものさし（5cm） */}
              <div style={{ position: 'absolute', left: '5mm', bottom: '3mm', display: 'flex', alignItems: 'center', gap: '3mm', fontSize: '3mm', color: '#777' }}>
                <svg width="50mm" height="4mm" viewBox="0 0 50 4" style={{ display: 'block' }}>
                  <line x1="0" y1="2" x2="50" y2="2" stroke="#555" strokeWidth="0.3" />
                  {Array.from({ length: 11 }, (_, k) => (
                    <line key={k} x1={k * 5} y1={k % 2 === 0 ? 0 : 1} x2={k * 5} y2={k % 2 === 0 ? 4 : 3} stroke="#555" strokeWidth="0.3" />
                  ))}
                </svg>
                この線が 5cm なら 正しい 大きさ（きる 直径 {s.cut}mm・表 {s.face}mm）　{pi + 1}/{pages.length}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
