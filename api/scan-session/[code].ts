import type { VercelReq, VercelRes } from '../_types.js';
import { getSession, clearSession } from '../../server/scanSession.js';

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  const raw = req.query.code;
  const code = String(Array.isArray(raw) ? raw[0] : (raw ?? '')).toUpperCase();
  if (!code) {
    res.status(400).json({ ok: false });
    return;
  }

  try {
    if (req.method === 'GET') {
      const s = await getSession(code);
      if (!s) {
        res.status(404).json({ ok: false });
        return;
      }
      res.status(200).json({
        ok: true,
        status: s.status,
        imageDataUrl: s.status === 'ready' ? s.imageDataUrl : undefined,
        cornersFound: s.status === 'ready' ? s.cornersFound : undefined,
      });
      return;
    }

    if (req.method === 'DELETE') {
      await clearSession(code);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ ok: false, error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}
