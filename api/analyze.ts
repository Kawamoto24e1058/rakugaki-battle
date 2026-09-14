import type { VercelReq, VercelRes } from './_types.js';
import { analyzeImage, type AnalyzeRequest } from '../server/analyzeHandler.js';

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed' });
    return;
  }
  try {
    const result = await analyzeImage((req.body ?? {}) as AnalyzeRequest);
    res.status(result.ok ? 200 : 502).json(result);
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : String(e), fallback: true });
  }
}
