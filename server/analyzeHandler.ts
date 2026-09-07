/**
 * 画像 → AI Vision（Claude）→ 構造化した特徴（AiFeatures の生 JSON）。
 * いまは Vite のミドルウェアから呼ばれる。将来 Rails API に移すときもこのファイルごと移せる。
 *
 * 環境変数:
 *   ANTHROPIC_API_KEY  … 必須。'mock' で擬似データ（キー無しでも通しで動作確認できる）
 *   RAKUGAKI_AI_MODEL  … 省略時 'claude-sonnet-5'
 *   RAKUGAKI_AI_MOCK=1 … 擬似データを強制
 */
import { AI_FEATURES_TOOL, AI_SYSTEM_PROMPT, looksLikeAiFeatures } from './aiContract.ts';

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

const API_URL = 'https://api.anthropic.com/v1/messages';

function hintText(hints?: AnalyzeRequest['hints']): string {
  const parts: string[] = [];
  if (hints?.attribute && hints.attribute !== 'auto') parts.push(`用紙のチェック欄：属性は「${hints.attribute}」`);
  if (hints?.weapon && hints.weapon !== 'auto') parts.push(`用紙のチェック欄：持ち物は「${hints.weapon}」`);
  const base = 'この絵のキャラクターを report_drawing ツールで報告してください。';
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

async function callClaude(req: AnalyzeRequest, apiKey: string, repairHint?: string): Promise<unknown> {
  const model = process.env.RAKUGAKI_AI_MODEL || 'claude-sonnet-5';
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      temperature: 0,
      system: AI_SYSTEM_PROMPT,
      tools: [AI_FEATURES_TOOL],
      tool_choice: { type: 'tool', name: AI_FEATURES_TOOL.name },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: req.mediaType, data: req.imageBase64 } },
            {
              type: 'text',
              text: hintText(req.hints) + (repairHint ? `\n\n（前回エラー：${repairHint}。今度は必ず有効な値で）` : ''),
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AI API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { content?: { type: string; input?: unknown }[] };
  return json.content?.find((c) => c.type === 'tool_use')?.input ?? null;
}

export async function analyzeImage(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  if (!req?.imageBase64 || !req?.mediaType) {
    return { ok: false, error: 'imageBase64 / mediaType が必要', fallback: true };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey === 'mock' || process.env.RAKUGAKI_AI_MOCK === '1') {
    return { ok: true, ai: mockFeatures(req), via: 'mock' };
  }
  if (!apiKey) {
    return { ok: false, error: 'ANTHROPIC_API_KEY 未設定', fallback: true };
  }

  try {
    let raw = await callClaude(req, apiKey);
    if (!looksLikeAiFeatures(raw)) {
      raw = await callClaude(req, apiKey, '必須項目が欠けている / 値が不正');
    }
    if (!looksLikeAiFeatures(raw)) {
      return { ok: false, error: 'AI の出力を解釈できなかった', fallback: true };
    }
    return { ok: true, ai: raw, via: 'ai' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), fallback: true };
  }
}
