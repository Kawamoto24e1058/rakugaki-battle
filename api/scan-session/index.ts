import type { VercelReq, VercelRes } from '../_types.ts';
import { createSession } from '../../server/scanSession.ts';

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed' });
    return;
  }
  const { code } = await createSession();
  res.status(200).json({ ok: true, code });
}
