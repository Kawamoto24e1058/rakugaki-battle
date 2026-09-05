import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';
import { analyzeSource, type AnalysisOverrides } from '../engine/analyze';
import type { Attribute, Weapon } from '../engine/types';
import { ATTRIBUTE_META } from '../engine/attributes';

type Stage = 'camera' | 'preview';

const WEAPON_LABEL: Record<Weapon, string> = {
  sword: 'つるぎ/ツメ',
  wand: 'つえ',
  shield: 'たて',
  wing: 'つばさ',
};

export function CaptureScene() {
  const mode = useGame((s) => s.mode);
  const pending = useGame((s) => s.pendingChallenger);
  const setCaptured = useGame((s) => s.setCaptured);
  const reset = useGame((s) => s.reset);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [stage, setStage] = useState<Stage>('camera');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [attr, setAttr] = useState<Attribute | 'auto'>('auto');
  const [weapon, setWeapon] = useState<Weapon | 'auto'>('auto');
  const [busy, setBusy] = useState(false);

  const playerLabel = mode === 'versus' ? (pending ? 'ふたりめ' : 'ひとりめ') : 'あなた';

  useEffect(() => {
    if (stage !== 'camera') return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play();
        }
      })
      .catch(() => setCameraError('カメラを つかえませんでした。したの ボタンから しゃしんを えらんでね。'));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stage]);

  function grabFromVideo() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    // ガイド枠（中央の正方形 78%）だけを切り出す
    const side = Math.min(video.videoWidth, video.videoHeight) * 0.78;
    const sx = (video.videoWidth - side) / 2;
    const sy = (video.videoHeight - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 900;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, sx, sy, side, side, 0, 0, 900, 900);
    setImageUrl(canvas.toDataURL('image/png'));
    setStage('preview');
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setStage('preview');
  }

  async function confirm() {
    if (!imageUrl || busy) return;
    setBusy(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('画像を よみこめませんでした'));
        img.src = imageUrl;
      });
      const overrides: AnalysisOverrides = {};
      if (attr !== 'auto') overrides.attribute = attr;
      if (weapon !== 'auto') overrides.weapon = weapon;
      const result = analyzeSource(img, overrides);
      setCaptured({ character: result.character, imageUrl, analysis: result });
    } catch {
      setCameraError('うまく よみとれませんでした。もういちど とってみてね。');
      setStage('camera');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scene">
      <h2 style={{ fontSize: '1.8rem' }}>{playerLabel}の えを とりこもう</h2>

      {stage === 'camera' && (
        <>
          <div
            className="sketch-card"
            style={{ position: 'relative', width: 'min(30rem, 92vw)', aspectRatio: '1', overflow: 'hidden', padding: 0 }}
          >
            {!cameraError ? (
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: '1.5rem', textAlign: 'center' }}>
                {cameraError}
              </div>
            )}
            <div
              style={{
                position: 'absolute',
                inset: '11%',
                border: '4px dashed var(--crayon-red)',
                borderRadius: 12,
                pointerEvents: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="crayon-btn primary big" onClick={grabFromVideo} disabled={!!cameraError}>
              📸 さつえい
            </button>
            <label className="crayon-btn" style={{ display: 'inline-flex', alignItems: 'center' }}>
              しゃしんを えらぶ
              <input type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
            </label>
          </div>
        </>
      )}

      {stage === 'preview' && imageUrl && (
        <>
          <div
            className="sketch-card"
            style={{ width: 'min(24rem, 80vw)', aspectRatio: '1', overflow: 'hidden', padding: 8, background: '#fff' }}
          >
            <img src={imageUrl} alt="とりこんだ え" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>

          <fieldset className="sketch-card" style={{ border: '2px solid var(--border)', width: 'min(28rem, 92vw)', padding: '0.8rem 1rem' }}>
            <legend style={{ fontFamily: 'var(--font-display)', padding: '0 0.5rem' }}>ようし の チェックらん（なくてもOK）</legend>
            <p style={{ fontSize: '0.85rem', margin: '0 0 0.3rem' }}>ぞくせい</p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <Chip active={attr === 'auto'} onClick={() => setAttr('auto')}>おまかせ</Chip>
              {(Object.keys(ATTRIBUTE_META) as Attribute[]).map((a) => (
                <Chip key={a} active={attr === a} color={ATTRIBUTE_META[a].color} onClick={() => setAttr(a)}>
                  {ATTRIBUTE_META[a].jp}
                </Chip>
              ))}
            </div>
            <p style={{ fontSize: '0.85rem', margin: '0.6rem 0 0.3rem' }}>ぶき</p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <Chip active={weapon === 'auto'} onClick={() => setWeapon('auto')}>おまかせ</Chip>
              {(Object.keys(WEAPON_LABEL) as Weapon[]).map((w) => (
                <Chip key={w} active={weapon === w} onClick={() => setWeapon(w)}>
                  {WEAPON_LABEL[w]}
                </Chip>
              ))}
            </div>
          </fieldset>

          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="crayon-btn" onClick={() => setStage('camera')} disabled={busy}>
              とりなおす
            </button>
            <button className="crayon-btn primary big" onClick={confirm} disabled={busy}>
              {busy ? 'かいせきちゅう…' : 'これで けってい！'}
            </button>
          </div>
        </>
      )}

      <button className="crayon-btn" style={{ marginTop: 'auto', fontSize: '0.9rem' }} onClick={reset}>
        タイトルに もどる
      </button>
    </div>
  );
}

function Chip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: '0.9rem',
        padding: '0.3em 0.8em',
        borderRadius: 999,
        border: '2.5px solid var(--border)',
        background: active ? (color ?? 'var(--crayon-yellow)') : '#fff',
        color: active && color ? '#fff' : 'var(--ink)',
        fontWeight: active ? 700 : 400,
      }}
    >
      {children}
    </button>
  );
}
