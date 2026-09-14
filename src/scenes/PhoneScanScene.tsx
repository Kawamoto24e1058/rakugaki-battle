import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { scanCapturedImage } from '../capture/scanCapturedImage';

type Stage = 'camera' | 'scanning' | 'preview' | 'sending' | 'sent' | 'error';

/**
 * PCの読み取り画面のQRから開く、スマホ専用の軽量ページ。
 * カメラ/ファイルで したがき用紙を撮る → その場で傾き補正＋背景透明化 → PCへ送る、だけをやる。
 * AI解析やキャラの詳細設定は受け取った側（PC）でやる。
 */
export function PhoneScanScene({ code }: { code: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stage, setStage] = useState<Stage>('camera');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [cornersFound, setCornersFound] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      .catch(() => setCameraError('カメラを つかえなかったよ。したから しゃしんを えらんでね。'));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stage]);

  async function runScan(rawUrl: string) {
    setStage('scanning');
    try {
      await new Promise((r) => setTimeout(r, 30));
      const { url, cornersFound: found } = await scanCapturedImage(rawUrl);
      setImageUrl(url);
      setCornersFound(found);
      setStage('preview');
    } catch {
      setImageUrl(rawUrl);
      setCornersFound(false);
      setStage('preview');
    }
  }

  function grabFromVideo() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const side = Math.min(video.videoWidth, video.videoHeight) * 0.9;
    const sx = (video.videoWidth - side) / 2;
    const sy = (video.videoHeight - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1000;
    canvas.getContext('2d')!.drawImage(video, sx, sy, side, side, 0, 0, 1000, 1000);
    void runScan(canvas.toDataURL('image/png'));
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    void runScan(URL.createObjectURL(file));
  }

  async function send() {
    if (!imageUrl) return;
    setStage('sending');
    try {
      const resp = await fetch(`/api/scan-session/${code}/upload`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: imageUrl, cornersFound }),
      });
      const j = (await resp.json()) as { ok?: boolean };
      if (!j.ok) throw new Error('送信できなかった');
      setStage('sent');
    } catch {
      setErrorMsg('おくれなかったよ。PCが おなじWi-Fiに つながっているか かくにんしてね。');
      setStage('preview');
    }
  }

  return (
    <div className="scene">
      <h2 style={{ fontSize: '1.5rem', textAlign: 'center' }}>したがきを PCに おくろう</h2>

      {stage === 'camera' && (
        <>
          <div
            className="sketch-card"
            style={{ position: 'relative', width: 'min(24rem, 90vw)', aspectRatio: '1', overflow: 'hidden', padding: 0 }}
          >
            {!cameraError ? (
              <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: '1.5rem', textAlign: 'center' }}>
                {cameraError}
              </div>
            )}
            <div style={{ position: 'absolute', inset: '6%', border: '4px dashed var(--crayon-red)', borderRadius: 12, pointerEvents: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="crayon-btn primary big" onClick={grabFromVideo} disabled={!!cameraError}>
              📸 さつえい
            </button>
            <label className="crayon-btn" style={{ display: 'inline-flex', alignItems: 'center' }}>
              しゃしんを えらぶ
              <input type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: 'none' }} />
            </label>
          </div>
        </>
      )}

      {stage === 'scanning' && (
        <div style={{ display: 'grid', placeItems: 'center', gap: '0.8rem', minHeight: '14rem' }}>
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }} style={{ fontSize: '2.4rem' }}>
            🔍
          </motion.div>
          <p style={{ fontSize: '1rem', color: 'var(--ink-soft)' }}>よみとっているよ…</p>
        </div>
      )}

      {(stage === 'preview' || stage === 'sending') && imageUrl && (
        <>
          <div
            className="sketch-card"
            style={{
              width: 'min(20rem, 84vw)',
              aspectRatio: '1',
              overflow: 'hidden',
              padding: 8,
              background: 'repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 50% / 16px 16px',
            }}
          >
            <img src={imageUrl} alt="とりこんだ え" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <p style={{ fontSize: '0.82rem', color: cornersFound ? 'var(--crayon-green)' : 'var(--ink-soft)' }}>
            {cornersFound ? '✅ マーカーを みつけたよ！' : 'ℹ️ マーカーが 見つからなかったよ'}
          </p>
          {errorMsg && <p style={{ fontSize: '0.85rem', color: 'var(--crayon-red)', textAlign: 'center' }}>{errorMsg}</p>}
          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="crayon-btn" onClick={() => setStage('camera')} disabled={stage === 'sending'}>
              とりなおす
            </button>
            <button className="crayon-btn primary big" onClick={send} disabled={stage === 'sending'}>
              {stage === 'sending' ? 'おくっているよ…' : 'これを PCに おくる！'}
            </button>
          </div>
        </>
      )}

      {stage === 'sent' && (
        <div style={{ display: 'grid', placeItems: 'center', gap: '1rem', minHeight: '14rem' }}>
          <div style={{ fontSize: '3rem' }}>✅</div>
          <p style={{ fontSize: '1.1rem', textAlign: 'center' }}>
            PCに おくったよ！
            <br />
            PCの がめんを みてね
          </p>
        </div>
      )}
    </div>
  );
}
