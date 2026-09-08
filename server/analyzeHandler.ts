/**
 * 画像 → AI Vision（Google Gemini）→ 構造化した特徴（AiFeatures の生 JSON）。
 * いまは Vite のミドルウェアから呼ばれる。将来 Rails API に移すときもこのファイルごと移せる。
 *
 * 環境変数:
 *   GEMINI_API_KEY      … 必須（ANTHROPIC_API_KEY も後方互換で見る）。'mock' で擬似データ
 *   RAKUGAKI_AI_MODEL   … 省略時 'gemini-2.5-flash'
 *   RAKUGAKI_AI_MOCK=1  … 擬似データを強制
 */
import { AI_SYSTEM_PROMPT, GEMINI_RESPONSE_SCHEMA, looksLikeAiFeatures } from './aiContract.ts';

export interface AnalyzeRequest {
  /** data: プレフィックス無しの base64。 */
  imageBase64: string;
  mediaType: string;
  hints?: { attribute?: string; weapon?: string };
}
export interface AnalyzeResponse {
  ok: boolean;
  /** AiFeatures の生 JSON（クライアントが coerce してキャラ化）。 */
  ai?: unknown;
  error?: string;
  /** true のときクライアントはローカルのピクセル解析にフォールバックする。 */
  fallback?: boolean;
  via?: 'ai' | 'mock';
}

function apiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.ANTHROPIC_API_KEY;
}

function hintText(hints?: AnalyzeRequest['hints']): string {
  const parts: string[] = [];
  if (hints?.attribute && hints.attribute !== 'auto') parts.push(`用紙のチェック欄：属性は「${hints.attribute}」`);
  if (hints?.weapon && hints.weapon !== 'auto') parts.push(`用紙のチェック欄：持ち物は「${hints.weapon}」`);
  const base = 'この絵のキャラクターの特徴を JSON で報告してください。';
  return parts.length ? `${base}\n${parts.join('\n')}` : base;
}

function mockFeatures(req: AnalyzeRequest): Record<string, unknown> {
  let h = 2166136261;
  for (let i = 0; i < req.imageBase64.length; i += 97) {
    h = Math.imul(h ^ req.imageBase64.charCodeAt(i), 16777619) >>> 0;
  }
  const r = (n: number) => ((h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0) % n) / n;
  const attrs = ['fire', 'water', 'wood', 'bolt', 'dark'];
  const attribute =
    req.hints?.attribute && req.hints.attribute !== 'auto' ? req.hints.attribute : attrs[Math.floor(r(5) * 5)];
  return {
    attribute,
    attributeReason: '(mock) いろの かんじ から',
    weapon: req.hints?.weapon && req.hints.weapon !== 'auto' ? req.hints.weapon : 'none',
    aspectRatio: 0.6 + r(10) * 0.9,
    coverage: 0.2 + r(10) * 0.6,
    spikiness: r(10),
    symmetry: 0.3 + r(10) * 0.6,
    fillDensity: 0.3 + r(10) * 0.6,
    saturation: 0.3 + r(10) * 0.6,
    brightness: 0.35 + r(10) * 0.55,
    colorCount: 1 + Math.floor(r(5) * 5),
    eyeCount: Math.floor(r(4) * 4),
    temperament: r(2) < 1 ? 'aggressive' : 'calm',
    name: `モック${Math.floor(r(1000) * 1000)}`,
    flavor: '(mock) てすとよう の キャラ。',
    revealNotes: [
      { step: 'attribute', text: `(mock) ${attribute} っぽい いろ！` },
      { step: 'power', text: '(mock) しっかり かきこんである' },
      { step: 'name', text: '(mock) なまえが きまった！' },
    ],
  };
}

function stripFences(s: string): string {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (m ? m[1] : s).trim();
}

async function callGemini(req: AnalyzeRequest, key: string, repairHint?: string): Promise<unknown> {
  const model = process.env.RAKUGAKI_AI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: AI_SYSTEM_PROMPT }] },
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: req.mediaType, data: req.imageBase64 } },
            {
              text: hintText(req.hints) + (repairHint ? `\n\n（前回エラー：${repairHint}。今度は必ず有効な値で）` : ''),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: GEMINI_RESPONSE_SCHEMA,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 240)}`);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  if (json.promptFeedback?.blockReason) throw new Error(`Gemini blocked: ${json.promptFeedback.blockReason}`);
  const cand = json.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  if (!text) throw new Error(`Gemini 空レスポンス (finishReason=${cand?.finishReason ?? '?'})`);
  return JSON.parse(stripFences(text));
}

export async function analyzeImage(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  if (!req?.imageBase64 || !req?.mediaType) {
    return { ok: false, error: 'imageBase64 / mediaType が必要', fallback: true };
  }
  const key = apiKey();

  if (key === 'mock' || process.env.RAKUGAKI_AI_MOCK === '1') {
    return { ok: true, ai: mockFeatures(req), via: 'mock' };
  }
  if (!key) {
    return { ok: false, error: 'GEMINI_API_KEY 未設定', fallback: true };
  }

  try {
    let raw: unknown = null;
    try {
      raw = await callGemini(req, key);
    } catch (e) {
      // JSON 解析失敗や一時エラーは1回だけリトライ
      raw = await callGemini(req, key, e instanceof Error ? e.message.slice(0, 80) : '出力が不正');
    }
    if (!looksLikeAiFeatures(raw)) {
      raw = await callGemini(req, key, '必須項目が欠けている / 値が不正');
    }
    if (!looksLikeAiFeatures(raw)) {
      return { ok: false, error: 'AI の出力を解釈できなかった', fallback: true };
    }
    return { ok: true, ai: raw, via: 'ai' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), fallback: true };
  }
}
