/**
 * AI（Gemini Vision）に投げるスキーマ / システムプロンプト。
 * サーバー専用。依存ゼロ（エンジンを import しない）。
 * クライアント側の型・変換は src/engine/analyze/aiFeatures.ts。
 */

export const AI_ATTRIBUTES = ['fire', 'water', 'wood', 'bolt', 'dark'] as const;
export const AI_WEAPONS = ['sword', 'wand', 'shield', 'wing', 'none'] as const;

const ALL_FIELDS = [
  'attribute', 'attributeReason', 'weapon', 'aspectRatio', 'coverage', 'spikiness',
  'symmetry', 'fillDensity', 'saturation', 'brightness', 'colorCount', 'eyeCount',
  'temperament', 'name', 'flavor', 'revealNotes',
]

/** Gemini generationConfig.responseSchema（OpenAPI 3.0 サブセット・型は大文字）。min/max は無視されるので説明文で伝える。 */
export const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    attribute: { type: 'STRING', enum: AI_ATTRIBUTES as unknown as string[], description: 'メインカラーと雰囲気。赤〜橙=fire、青=water、緑=wood、黄=bolt、紫や暗い色=dark' },
    attributeReason: { type: 'STRING', description: '属性をそう判断した理由（子ども向け・一文）' },
    weapon: { type: 'STRING', enum: AI_WEAPONS as unknown as string[], description: 'ツメ/牙/剣=sword、まるい体/杖=wand、横長/盾=shield、細長い/翼=wing、なし=none' },
    aspectRatio: { type: 'NUMBER', description: '横幅÷高さ。0.3〜2.0。1で正方形、0.5で縦長、1.8で横長' },
    coverage: { type: 'NUMBER', description: '0〜1。紙に対する絵の大きさ・塗りの量' },
    spikiness: { type: 'NUMBER', description: '0〜1。輪郭のトゲトゲ具合。0=まんまる、1=トゲだらけ' },
    symmetry: { type: 'NUMBER', description: '0〜1。左右対称性' },
    fillDensity: { type: 'NUMBER', description: '0〜1。塗りの詰まり。0=線だけ、1=ぎっしり' },
    saturation: { type: 'NUMBER', description: '0〜1。色の鮮やかさ。えんぴつ/グレー=0付近' },
    brightness: { type: 'NUMBER', description: '0〜1。全体の明るさ。真っ黒=0付近' },
    colorCount: { type: 'INTEGER', description: '1〜6。目立つ色の数' },
    eyeCount: { type: 'INTEGER', description: '0〜6。はっきり描かれた目の数' },
    temperament: { type: 'STRING', enum: ['aggressive', 'calm'], description: '見た目の性格' },
    name: { type: 'STRING', description: 'キャラの名前（カタカナ中心・4〜7字）' },
    flavor: { type: 'STRING', description: '図鑑の紹介文（子ども向け・一文）' },
    revealNotes: {
      type: 'ARRAY',
      description: 'なぜそのキャラになったか。属性→ステータスの型→わざ→名前 の順で4〜6個',
      items: {
        type: 'OBJECT',
        properties: {
          step: { type: 'STRING' },
          text: { type: 'STRING', description: '子ども向けの一言（例：「赤いほのお色 …… 火属性！」）' },
        },
        required: ['step', 'text'],
      },
    },
  },
  required: ALL_FIELDS,
  propertyOrdering: ALL_FIELDS,
} as const;

export const AI_SYSTEM_PROMPT = `あなたは子ども向けの「お絵かきバトルゲーム」の解析エンジンです。
子どもが紙に描いた1体のキャラクターの写真を見て、指定のスキーマで見た目の特徴を JSON で報告してください。

ルール:
- ステータスの数値（こうげき等）は決めない。あなたは「絵をどう見たか」を報告するだけ。
- どんな落書き・簡単な絵でも必ず推定する。拒否しない。抽象的な絵でも形・色から数値を出す。
- スコア（0〜1）は素直に。トゲが多ければ spikiness を高く、線だけなら fillDensity を低く。
- attribute は紙のメインカラーと雰囲気で。えんぴつ・グレー・真っ黒の絵は dark。
- name は毎回ユニークで、そのキャラらしいカタカナ名。
- flavor と revealNotes は子ども向けのやさしい日本語で。
- 用紙のチェック欄（ヒント）が渡されたら、それを優先して合わせる。`;

/** 出力が最低限の形をしているか（詳細な clamp はクライアント側 coerceAiFeatures）。 */
export function looksLikeAiFeatures(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return (AI_ATTRIBUTES as readonly string[]).includes(o.attribute as string) && typeof o.name === 'string';
}
