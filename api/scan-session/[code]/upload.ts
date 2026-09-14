import type { VercelReq, VercelRes } from '../../_types.js';
import { uploadToSession } from '../../../server/scanSession.js';

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed' });
    return;
  }
  const raw = req.query.code;
  const code = String(Array.isArray(raw) ? raw[0] : (raw ?? '')).toUpperCase();
  const body = (req.body ?? {}) as { imageDataUrl?: unknown; cornersFound?: unknown };
  try {
    const ok = typeof body.imageDataUrl === 'string' && (await uploadToSession(code, body.imageDataUrl, !!body.cornersFound));
    res.status(ok ? 200 : 404).json({ ok });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}
