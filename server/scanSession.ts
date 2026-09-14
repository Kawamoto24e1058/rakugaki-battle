/**
 * スマホ読み取り（QR連携）用の一時セッション。
 * PC が発行したコードを スマホがアップロード先として使う、ただの受け渡し箱。
 *
 * 2つの実行環境で使う：
 *  - ローカル開発（`vite dev`/`vite preview`）… プロセスがずっと生きているので
 *    プロセス内 Map で十分。
 *  - Vercel Serverless Functions（本番デプロイ）… 呼び出しごとに別インスタンスに
 *    なりうるので Map だと共有できない。Upstash Redis（無料枠あり・REST API）に
 *    UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN が設定されていればそちらを使う。
 * 環境変数が無ければ自動的に Map にフォールバックする（＝ローカルはセットアップ不要）。
 */
import { Redis } from '@upstash/redis';

interface ScanSession {
  status: 'waiting' | 'ready';
  imageDataUrl?: string;
  cornersFound?: boolean;
  createdAt: number;
}

const TTL_SEC = 15 * 60; // 15分で自動失効
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい 0/O・1/I は除く
const KEY_PREFIX = 'rakugaki:scan:';

function randomCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

// コピペ時の末尾改行/空白が紛れ込んでも大丈夫なよう trim しておく。
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redis: Redis | null = upstashUrl && upstashToken ? new Redis({ url: upstashUrl, token: upstashToken }) : null;

// --- ローカル開発用フォールバック（プロセス内メモリ） ---
const MEMORY = new Map<string, ScanSession>();
function memCleanup(): void {
  const now = Date.now();
  for (const [code, s] of MEMORY) {
    if (now - s.createdAt > TTL_SEC * 1000) MEMORY.delete(code);
  }
}

export async function createSession(): Promise<{ code: string }> {
  const session: ScanSession = { status: 'waiting', createdAt: Date.now() };
  if (redis) {
    let code = randomCode();
    // 衝突はごく稀。1回だけ空きを確認（TTLも短いので実害はほぼ無い）。
    for (let i = 0; i < 3 && (await redis.exists(KEY_PREFIX + code)); i++) code = randomCode();
    await redis.set(KEY_PREFIX + code, JSON.stringify(session), { ex: TTL_SEC });
    return { code };
  }
  memCleanup();
  let code = randomCode();
  while (MEMORY.has(code)) code = randomCode();
  MEMORY.set(code, session);
  return { code };
}

export async function getSession(code: string): Promise<ScanSession | null> {
  if (redis) {
    const raw = await redis.get<ScanSession | string>(KEY_PREFIX + code);
    if (!raw) return null;
    return typeof raw === 'string' ? (JSON.parse(raw) as ScanSession) : raw;
  }
  return MEMORY.get(code) ?? null;
}

export async function uploadToSession(code: string, imageDataUrl: string, cornersFound: boolean): Promise<boolean> {
  const existing = await getSession(code);
  if (!existing) return false;
  const next: ScanSession = { ...existing, status: 'ready', imageDataUrl, cornersFound };
  if (redis) {
    await redis.set(KEY_PREFIX + code, JSON.stringify(next), { ex: TTL_SEC });
  } else {
    MEMORY.set(code, next);
  }
  return true;
}

export async function clearSession(code: string): Promise<void> {
  if (redis) {
    await redis.del(KEY_PREFIX + code);
  } else {
    MEMORY.delete(code);
  }
}
