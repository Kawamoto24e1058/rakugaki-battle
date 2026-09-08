/**
 * AI Vision（Groq / Gemini など）に投げるスキーマ / システムプロンプト。
 * サーバー専用。依存ゼロ（エンジンを import しない）。
 * クライアント側の型・変換は src/engine/analyze/aiFeatures.ts。
 */

export const AI_ATTRIBUTES = ['fire', 'water', 'wood', 'bolt', 'dark'] as const;
export const AI_WEAPONS = ['sword', 'wand', 'shield', 'wing', 'none'] as const;

const ALL_FIELDS = [
  'attribute', 'attributeReason', 'weapon', 'aspectRatio', 'coverage', 'spikiness',
  'symmetry', 'fillDensity', 'saturation', 'brightness', 'colorCount', 'eyeCount',
  'temperament',
  'bodyType',
  'powerLook', 'powerReason',
  'toughnessLook', 'toughnessReason',
  'speedLook', 'speedReason',
  'hpLook', 'hpReason',
  'name', 'flavor', 'revealNotes',
]

/** プロンプトで JSON を強制する用（Groq など responseSchema が使えない/弱いプロバイダ）。 */
export const AI_JSON_INSTRUCTION = `出力は次のキーだけを持つ JSON オブジェクトのみ（前後に文章やコードフェンスを付けない）:
- attribute: "fire" | "water" | "wood" | "bolt" | "dark"
- attributeReason: string（属性の理由・一文）
- weapon: "sword" | "wand" | "shield" | "wing" | "none"
- aspectRatio: number 0.3〜2.0（横幅÷高さ）
- coverage, spikiness, symmetry, fillDensity, saturation, brightness: number 0〜1
- colorCount: integer 1〜6
- eyeCount: integer 0〜6
- temperament: "aggressive" | "calm"
- bodyType: string（体つきを一言で。例「戦車のようにゴツい」「小さくて身軽」「大きなスライム」）
- powerLook, toughnessLook, speedLook, hpLook: number 0〜1（見た目の印象。4つが同値・全部0.5にならないよう、強い所は0.75+/弱い所は0.35-）
- powerReason, toughnessReason, speedReason, hpReason: string（その数値にした理由。絵の中の"具体物"を挙げた子ども向けの一言。例「するどいツメがある → こうげき つよい」）
- name: string（カタカナ中心 4〜7字・毎回ユニーク）
- flavor: string（図鑑の一文）
- revealNotes: [{ "step": string, "text": string }] を4〜6個（属性→ステータスの型→わざ→名前 の順）`

const REASON_PROP = (jp: string) => ({
  type: 'STRING',
  description: `${jp}の数値にした理由。絵の中の具体物を1つ挙げた、子ども向けの短い一言（15〜25字・文末は「〜」で軽く）。高い理由でも低い理由でもよい。例「するどいツメがあるので こうげき つよめ」「ぶきがないので こうげき ひかえめ」`,
});

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
    bodyType: { type: 'STRING', description: 'この生き物の体つきを一言で（例：「戦車のようにゴツい」「小さくて身軽」「大きくてやわらかい」）' },
    powerLook: { type: 'NUMBER', description: '0〜1。こうげき の見た目。するどいツメ・牙・角・武器・大きな口・怒り顔・攻撃ポーズ・トゲ ほど高い。武器なし/やさしい姿は低い' },
    powerReason: REASON_PROP('こうげき'),
    toughnessLook: { type: 'NUMBER', description: '0〜1。ぼうぎょ の見た目。鎧・甲羅・盾・分厚い体・硬い殻・岩や鉄の質感・どっしり四角い体 ほど高い。ヒョロヒョロは低い' },
    toughnessReason: REASON_PROP('ぼうぎょ'),
    speedLook: { type: 'NUMBER', description: '0〜1。すばやさ の見た目。翼・羽・ジェット・車輪・細い体・長い脚・流線型・小さく身軽・走る姿 ほど高い。重装甲・ずんぐりは低い' },
    speedReason: REASON_PROP('すばやさ'),
    hpLook: { type: 'NUMBER', description: '0〜1。たいりょく の見た目。体が大きい・ずんぐり・太い・ふくよか・丸い ほど高い。小さい・細いは低い' },
    hpReason: REASON_PROP('たいりょく'),
    name: { type: 'STRING', description: 'キャラの名前（カタカナ中心・4〜7字・毎回ユニーク）' },
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

export const AI_SYSTEM_PROMPT = `あなたは子ども向け「お絵かきバトル」の解析エンジンです。
子どもが紙に描いた1体のキャラの写真を見て、スキーマ通りの JSON だけを返します（前後に文章を付けない）。

■ 最重要：ステータス4つを「絵の中の具体的なもの」から見積もる
こうげき(powerLook)・ぼうぎょ(toughnessLook)・すばやさ(speedLook)・たいりょく(hpLook) を各 0〜1。
- 4つが全部同じ・全部0.5 にならないよう、必ずメリハリをつける（強い所は 0.75 以上、弱い所は 0.35 以下が目安）。
- それぞれ powerReason などに、根拠にした具体物を1つ挙げた子ども向けの短い一言（15〜25字）を書く。低い理由でもよい。長い説明文にしない。

■ 何を見て上げ下げするか
- こうげき↑：するどいツメ/牙/角、剣・槍・銃などの武器、大きな口、燃える手、怒った顔、攻撃ポーズ、体のトゲ
- ぼうぎょ↑：鎧・甲羅・盾、分厚い体、硬そうな殻、岩や鉄の質感、どっしり四角い体
- すばやさ↑：翼・羽、ジェット、車輪、細い体、長い脚、流線型、小さくて身軽、走っている姿
- たいりょく↑：体が大きい、ずんぐり、太い、ふくよか、まんまる
- 下げる根拠も同様に：武器なし→こうげき低め、ヒョロヒョロ→ぼうぎょ低め、重装甲・鈍そう→すばやさ低め、小さい・細い→たいりょく低め

■ 組み合わせの例（そのまま使わず、絵に合わせて調整する）
- 剣を持った騎士：こうげき0.8 ぼうぎょ0.7 すばやさ0.4 たいりょく0.55
- 戦車・戦車ロボ：こうげき0.85 ぼうぎょ0.9 すばやさ0.2 たいりょく0.8（重いので遅い）
- 小さい鳥・妖精：すばやさ0.9 こうげき0.35 ぼうぎょ0.25 たいりょく0.3
- 大きなスライム・おばけ：たいりょく0.85 ぼうぎょ0.55 こうげき0.4 すばやさ0.3
- トゲトゲのモンスター：こうげき0.85 すばやさ0.5 ぼうぎょ0.45 たいりょく0.6
- 岩ゴーレム：ぼうぎょ0.9 たいりょく0.8 こうげき0.6 すばやさ0.15
bodyType には体つきの一言（「戦車のようにゴツい」など）を書く。

■ その他
- attribute：紙のメインカラーと雰囲気。赤〜橙=fire、青=water、緑=wood、黄=bolt、紫・暗い色・えんぴつ/グレー・真っ黒=dark。
- weapon：ツメ/牙/剣=sword、まるい体/杖=wand、横長/盾=shield、細長い/翼=wing、なし=none。
- spikiness / symmetry / fillDensity / saturation / brightness / coverage / aspectRatio / colorCount / eyeCount：見たまま素直に。
- name は毎回ユニークで、そのキャラらしいカタカナ名。
- flavor と revealNotes は子ども向けのやさしい日本語。revealNotes には「なぜ こうげきが高い/すばやい のか」も具体物つきで入れる。
- どんな落書き・簡単な絵・抽象的な絵でも必ず推定する。拒否しない。
- 用紙のチェック欄（ヒント）が渡されたら、それを優先して合わせる。`;

/** 出力が最低限の形をしているか（詳細な clamp はクライアント側 coerceAiFeatures）。 */
export function looksLikeAiFeatures(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return (AI_ATTRIBUTES as readonly string[]).includes(o.attribute as string) && typeof o.name === 'string';
}
