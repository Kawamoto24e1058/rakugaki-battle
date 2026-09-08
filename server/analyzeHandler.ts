/**
 * 画像 → AI Vision → 構造化した特徴（AiFeatures の生 JSON）。
 * Groq（無料枠・カード不要）を優先し、無ければ Gemini。将来 Rails へこのまま移せる。
 *
 * 環境変数:
 *   GROQ_API_KEY       … Groq（推奨）。gsk_... 。'mock' で擬似データ
 *   GEMINI_API_KEY     … Gemini。GROQ が無いときに使う
 *   RAKUGAKI_AI_MODEL  … 省略時 Groq='meta-llama/llama-4-scout-17b-16e-instruct' / Gemini='gemini-2.5-flash'
 *   RAKUGAKI_AI_MOCK=1 … 擬似データを強制
 */
import {
  AI_SYSTEM_PROMPT,
  AI_JSON_INSTRUCTION,
  GEMINI_RESPONSE_SCHEMA,
  looksLikeAiFeatures,
} from './aiContract.ts';

export interface AnalyzeRequest {
  imageBase64: string;
  mediaType: string;
  hints?: { attribute?: string; weapon?: string };
}
export interface AnalyzeResponse {
  ok: boolean;
  ai?: unknown;
  error?: string;
  fallback?: boolean;
  via?: 'groq' | 'gemini' | 'mock';
}

function hintText(hints?: AnalyzeRequest['hints']): string {
  const parts: string[] = [];
  if (hints?.attribute && hints.attribute !== 'auto') parts.push(`用紙のチェック欄：属性は「${hints.attribute}」`);
  if (hints?.weapon && hints.weapon !== 'auto') parts.push(`用紙のチェック欄：持ち物は「${hints.weapon}」`);
  const base = 'この絵のキャラクターの特徴を報告してください。';
  return parts.length ? `${base}\n${parts.join('\n')}` : base;
}

function stripFences(s: string): string {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (m ? m[1] : s).trim();
  const a = body.indexOf('{');
  const b = body.lastIndexOf('}');
  return a >= 0 && b > a ? body.slice(a, b + 1) : body;
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
    powerLook: r(10),
    toughnessLook: r(10),
    speedLook: r(10),
    hpLook: r(10),
    name: `モック${Math.floor(r(1000) * 1000)}`,
    flavor: '(mock) てすとよう の キャラ。',
    revealNotes: [
      { step: 'attribute', text: `(mock) ${attribute} っぽい いろ！` },
      { step: 'power', text: '(mock) しっかり かきこんである' },
      { step: 'name', text: '(mock) なまえが きまった！' },
    ],
  };
}

// ---------- Groq（OpenAI 互換）----------

async function callGroq(req: AnalyzeRequest, key: string, repair?: string): Promise<unknown> {
  const model = process.env.RAKUGAKI_AI_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${AI_SYSTEM_PROMPT}\n\n${AI_JSON_INSTRUCTION}` },
        {
          role: 'user',
          content: [
            { type: 'text', text: hintText(req.hints) + (repair ? `\n\n（前回エラー：${repair}）` : '') },
            { type: 'image_url', image_url: { url: `data:${req.mediaType};base64,${req.imageBase64}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status}: ${body.slice(0, 240)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('Groq 空レスポンス');
  return JSON.parse(stripFences(text));
}

// ---------- Gemini ----------

async function callGemini(req: AnalyzeRequest, key: string, repair?: string): Promise<unknown> {
  const model = process.env.RAKUGAKI_AI_MODEL || 'gemini-2.5-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: AI_SYSTEM_PROMPT }] },
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: req.mediaType, data: req.imageBase64 } },
            { text: hintText(req.hints) + (repair ? `\n\n（前回エラー：${repair}）` : '') },
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

// ---------- エントリ ----------

export async function analyzeImage(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  if (!req?.imageBase64 || !req?.mediaType) {
    return { ok: false, error: 'imageBase64 / mediaType が必要', fallback: true };
  }

  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (groqKey === 'mock' || geminiKey === 'mock' || process.env.RAKUGAKI_AI_MOCK === '1') {
    return { ok: true, ai: mockFeatures(req), via: 'mock' };
  }

  const provider: 'groq' | 'gemini' | null = groqKey ? 'groq' : geminiKey ? 'gemini' : null;
  if (!provider) return { ok: false, error: 'GROQ_API_KEY / GEMINI_API_KEY 未設定', fallback: true };
  const call = provider === 'groq' ? callGroq : callGemini;
  const key = (provider === 'groq' ? groqKey : geminiKey) as string;

  try {
    let raw: unknown;
    try {
      raw = await call(req, key);
    } catch (e) {
      raw = await call(req, key, e instanceof Error ? e.message.slice(0, 80) : '出力が不正');
    }
    if (!looksLikeAiFeatures(raw)) raw = await call(req, key, '必須項目が欠けている / 値が不正');
    if (!looksLikeAiFeatures(raw)) return { ok: false, error: 'AI の出力を解釈できなかった', fallback: true };
    return { ok: true, ai: raw, via: provider };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), fallback: true };
  }
}
