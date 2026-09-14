import type { VercelReq, VercelRes } from '../_types.ts';
import { createSession } from '../../server/scanSession.ts';

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed' });
    return;
  }
  try {
    const { code } = await createSession();
    res.status(200).json({ ok: true, code });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}
