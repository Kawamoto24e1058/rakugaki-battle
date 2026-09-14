/**
 * スマホ読み取り（QR連携）用の一時セッション。
 * PC が発行したコードを スマホがアップロード先として使う、ただの in-memory 受け渡し箱。
 * 展示の単一端末・一度に1人が前提なので、DB等は不要。
 */

interface ScanSession {
  status: 'waiting' | 'ready';
  imageDataUrl?: string;
  cornersFound?: boolean;
  createdAt: number;
}

const SESSIONS = new Map<string, ScanSession>();
const TTL_MS = 15 * 60 * 1000; // 15分で自動失効
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい 0/O・1/I は除く

function cleanup(): void {
  const now = Date.now();
  for (const [code, s] of SESSIONS) {
    if (now - s.createdAt > TTL_MS) SESSIONS.delete(code);
  }
}

function randomCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export function createSession(): { code: string } {
  cleanup();
  let code = randomCode();
  while (SESSIONS.has(code)) code = randomCode();
  SESSIONS.set(code, { status: 'waiting', createdAt: Date.now() });
  return { code };
}

export function getSession(code: string): ScanSession | null {
  return SESSIONS.get(code) ?? null;
}

export function uploadToSession(code: string, imageDataUrl: string, cornersFound: boolean): boolean {
  const s = SESSIONS.get(code);
  if (!s) return false;
  s.status = 'ready';
  s.imageDataUrl = imageDataUrl;
  s.cornersFound = cornersFound;
  return true;
}

export function clearSession(code: string): void {
  SESSIONS.delete(code);
}
