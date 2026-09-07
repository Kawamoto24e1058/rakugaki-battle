/**
 * AI（Claude Vision）に投げる tool スキーマ / システムプロンプト。
 * サーバー専用。依存ゼロ（エンジンを import しない）＝ 将来 Rails へそのまま持っていける。
 * クライアント側の型・変換は src/engine/analyze/aiFeatures.ts。
 */

export const AI_ATTRIBUTES = ['fire', 'water', 'wood', 'bolt', 'dark'] as const;
export const AI_WEAPONS = ['sword', 'wand', 'shield', 'wing', 'none'] as const;

export const AI_FEATURES_TOOL = {
  name: 'report_drawing',
  description:
    '子どもが紙に描いた1体のキャラクターの絵を見て、見た目の特徴を報告する。ステータスの数値は決めない。',
  input_schema: {
    type: 'object',
    required: [
      'attribute', 'attributeReason', 'weapon', 'aspectRatio', 'coverage', 'spikiness',
      'symmetry', 'fillDensity', 'saturation', 'brightness', 'colorCount', 'eyeCount',
      'temperament', 'name', 'flavor', 'revealNotes',
    ],
    properties: {
      attribute: { type: 'string', enum: AI_ATTRIBUTES, description: 'メインカラーと雰囲気。赤〜橙=fire、青=water、緑=wood、黄=bolt、紫や暗い色=dark' },
      attributeReason: { type: 'string', description: '属性をそう判断した理由（子ども向け・一文）' },
      weapon: { type: 'string', enum: AI_WEAPONS, description: 'ツメ/牙/剣=sword、まるい体/杖=wand、横長/盾=shield、細長い/翼=wing、なし=none' },
      aspectRatio: { type: 'number', minimum: 0.3, maximum: 2, description: '横幅÷高さ。1で正方形、0.5で縦長、1.8で横長' },
      coverage: { type: 'number', minimum: 0, maximum: 1, description: '紙に対する絵の大きさ・塗りの量' },
      spikiness: { type: 'number', minimum: 0, maximum: 1, description: '輪郭のトゲトゲ具合。0=まんまる、1=トゲだらけ' },
      symmetry: { type: 'number', minimum: 0, maximum: 1, description: '左右対称性' },
      fillDensity: { type: 'number', minimum: 0, maximum: 1, description: '塗りの詰まり。0=線だけ、1=ぎっしり' },
      saturation: { type: 'number', minimum: 0, maximum: 1, description: '色の鮮やかさ。えんぴつ/グレー=0付近' },
      brightness: { type: 'number', minimum: 0, maximum: 1, description: '全体の明るさ。真っ黒=0付近' },
      colorCount: { type: 'integer', minimum: 1, maximum: 6, description: '目立つ色の数' },
      eyeCount: { type: 'integer', minimum: 0, maximum: 6, description: 'はっきり描かれた目の数' },
      temperament: { type: 'string', enum: ['aggressive', 'calm'], description: '見た目の性格' },
      name: { type: 'string', description: 'キャラの名前（カタカナ中心・4〜7字）' },
      flavor: { type: 'string', description: '図鑑の紹介文（子ども向け・一文）' },
      revealNotes: {
        type: 'array',
        description: 'なぜそのキャラになったか。属性→ステータスの型→わざ→名前 の順で4〜6個',
        items: {
          type: 'object',
          required: ['step', 'text'],
          properties: {
            step: { type: 'string' },
            text: { type: 'string', description: '子ども向けの一言（例：「赤いほのお色 …… 火属性！」）' },
          },
        },
      },
    },
  },
} as const;

export const AI_SYSTEM_PROMPT = `あなたは子ども向けの「お絵かきバトルゲーム」の解析エンジンです。
子どもが紙に描いた1体のキャラクターの写真を見て、report_drawing ツールで見た目の特徴を報告してください。

ルール:
- ステータスの数値（こうげき等）は決めない。あなたは「絵をどう見たか」を報告するだけ。
- どんな落書き・簡単な絵でも必ず推定する。拒否しない。抽象的な絵でも形・色から数値を出す。
- スコアは素直に。トゲが多ければ spikiness を高く、線だけなら fillDensity を低く。
- attribute は紙のメインカラーと雰囲気で。えんぴつ・グレー・真っ黒の絵は dark。
- name は毎回ユニークで、そのキャラらしいカタカナ名。
- flavor と revealNotes は子ども向けのやさしい日本語で。
- 用紙のチェック欄（ヒント）が渡されたら、それを優先して合わせる。`;

/** tool の入力が最低限の形をしているか（詳細な clamp はクライアント側）。 */
export function looksLikeAiFeatures(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return (AI_ATTRIBUTES as readonly string[]).includes(o.attribute as string) && typeof o.name === 'string';
}
