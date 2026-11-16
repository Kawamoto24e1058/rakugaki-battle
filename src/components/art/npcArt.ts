/**
 * CPU（NPC）の 絵。子どもが クレヨンで 描いたような 絵を SVG で 描いて、画像（data URL）として つかう。
 * 撮影した キャラと おなじく 背景は とうめい（白い ふちは 表示がわで つく）。
 *  ・線は すこし ゆらす（feTurbulence＋feDisplacementMap）
 *  ・ぬりは クレヨンの ざらざら（ノイズで ところどころ うすく）
 */

const INK = '#3a2f28';

/** クレヨンの フィルター（線の ゆれ＋ぬりの ざらつき）。 */
const DEFS = `
<defs>
  <filter id="wob" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="crayon" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="8" result="grain"/>
    <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.2" result="mask"/>
    <feComposite in="d" in2="mask" operator="in"/>
  </filter>
</defs>`;

/** ぬり（ざらざら）＋ 線（ゆれ）の 2まいがさね。 */
const shape = (d: string, fill: string, sw = 4.5) =>
  `<g filter="url(#crayon)">${d.replace(/\/>$/, ` fill="${fill}"/>`).replace(/<(\w+) /, '<$1 stroke="none" ')}</g>` +
  `<g filter="url(#wob)">${d.replace(/\/>$/, ` fill="none" stroke="${INK}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`)}</g>`;
/** 線だけ。 */
const line = (d: string, sw = 4, color = INK) => `<g filter="url(#wob)"><path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
/** ぬりだけ（目の 白い 光 など）。 */
const dot = (cx: number, cy: number, r: number, fill: string) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="400" height="400">${DEFS}${body}</svg>`;

/** ポチころ：ちゃいろの いぬ。たれた みみ・あかい くびわ・ベロ。 */
const POCHI = svg(
  [
    shape('<path d="M150,140 q26,-6 22,-30 q-2,-10 -10,-6 q4,16 -16,22 z"/>', '#e7a35a'), // しっぽ
    shape('<ellipse cx="100" cy="140" rx="54" ry="38"/>', '#e7a35a'), // からだ
    shape('<ellipse cx="68" cy="174" rx="13" ry="10"/>', '#e7a35a'),
    shape('<ellipse cx="132" cy="174" rx="13" ry="10"/>', '#e7a35a'),
    shape('<ellipse cx="100" cy="148" rx="26" ry="20"/>', '#f6d8b0', 3), // おなか
    shape('<circle cx="100" cy="80" r="44"/>', '#e7a35a'), // あたま
    shape('<path d="M64,52 q-30,6 -24,50 q10,10 22,-4 q-2,-26 10,-40 z"/>', '#9a5b2a'), // みみ
    shape('<path d="M136,52 q30,6 24,50 q-10,10 -22,-4 q2,-26 -10,-40 z"/>', '#9a5b2a'),
    shape('<ellipse cx="100" cy="98" rx="24" ry="17"/>', '#f6d8b0', 3), // くち まわり
    shape('<path d="M70,118 q30,14 60,0 l0,9 q-30,14 -60,0 z"/>', '#e8503a', 3.5), // くびわ
    shape('<circle cx="100" cy="132" r="7"/>', '#f2c230', 3),
    dot(84, 76, 6.5, INK),
    dot(116, 76, 6.5, INK),
    dot(86, 74, 2.2, '#fff'),
    dot(118, 74, 2.2, '#fff'),
    shape('<ellipse cx="100" cy="91" rx="8" ry="5.5"/>', INK, 2),
    line('M100,96 v6 M88,103 q12,8 24,0'),
    shape('<path d="M95,105 q5,12 10,0 z"/>', '#f08aa0', 2.5), // ベロ
    line('M70,66 q6,-5 12,-2 M118,64 q6,-3 12,2', 3), // まゆ
  ].join(''),
);

/** ガシャンこぞう：あおい ロボット。アンテナ・しかくい 目・むねの ボタン。 */
const MECHA = svg(
  [
    line('M100,40 v-18', 4.5),
    shape('<circle cx="100" cy="18" r="8"/>', '#e8503a', 3.5),
    shape('<rect x="40" y="112" width="20" height="42" rx="6"/>', '#7fa6e6'), // うで
    shape('<rect x="140" y="112" width="20" height="42" rx="6"/>', '#7fa6e6'),
    shape('<circle cx="50" cy="160" r="10"/>', '#b8c4d6'),
    shape('<circle cx="150" cy="160" r="10"/>', '#b8c4d6'),
    shape('<rect x="70" y="160" width="22" height="26" rx="4"/>', '#7fa6e6'), // あし
    shape('<rect x="108" y="160" width="22" height="26" rx="4"/>', '#7fa6e6'),
    shape('<rect x="64" y="180" width="32" height="12" rx="5"/>', '#4a5568'),
    shape('<rect x="104" y="180" width="32" height="12" rx="5"/>', '#4a5568'),
    shape('<rect x="58" y="104" width="84" height="62" rx="10"/>', '#4d7fd6'), // からだ
    shape('<rect x="74" y="116" width="52" height="34" rx="6"/>', '#dbe6f5', 3),
    shape('<circle cx="88" cy="133" r="6"/>', '#e8503a', 2.5),
    shape('<circle cx="104" cy="133" r="6"/>', '#f2c230', 2.5),
    shape('<circle cx="119" cy="133" r="5"/>', '#1f9d63', 2.5),
    shape('<rect x="54" y="40" width="92" height="66" rx="12"/>', '#4d7fd6'), // あたま
    shape('<circle cx="52" cy="72" r="8"/>', '#b8c4d6', 3), // ボルト
    shape('<circle cx="148" cy="72" r="8"/>', '#b8c4d6', 3),
    shape('<rect x="68" y="56" width="24" height="20" rx="3"/>', '#f2c230', 3), // 目
    shape('<rect x="108" y="56" width="24" height="20" rx="3"/>', '#f2c230', 3),
    dot(82, 67, 5, INK),
    dot(122, 67, 5, INK),
    shape('<rect x="78" y="84" width="44" height="12" rx="3"/>', '#dbe6f5', 3), // くち
    line('M89,85 v10 M100,85 v10 M111,85 v10', 2.5),
  ].join(''),
);

/** ビュンどり：きいろい とり。おおきな つばさ・するどい 目・オレンジの くちばし。 */
const TORI = svg(
  [
    line('M18,92 h24 M10,112 h30 M20,132 h22', 4, '#9aa3b0'), // スピードの せん
    shape('<path d="M58,120 l-24,-14 l6,18 l-16,6 l20,8 z"/>', '#f29b30'), // しっぽ
    line('M92,158 l-6,24 m6,-24 l8,22 M118,156 l-2,26 m2,-26 l10,20', 4.5, '#e07a10'), // あし
    shape('<ellipse cx="104" cy="118" rx="50" ry="42"/>', '#f4c430'), // からだ
    shape('<ellipse cx="112" cy="132" rx="26" ry="20"/>', '#fbe7a1', 3), // おなか
    shape('<path d="M88,104 q-40,-50 -64,-46 q14,18 10,30 q-14,0 -22,6 q26,12 40,28 q18,4 36,-18 z"/>', '#f29b30'), // つばさ
    line('M44,74 q12,10 18,22 M30,92 q16,6 26,16', 3),
    shape('<circle cx="138" cy="84" r="32"/>', '#f4c430'), // あたま
    shape('<path d="M164,80 l30,8 l-30,12 z"/>', '#f2802a', 3.5), // くちばし
    shape('<ellipse cx="146" cy="78" rx="9" ry="10"/>', '#fff', 3),
    dot(149, 79, 5, INK),
    dot(150, 77, 1.8, '#fff'),
    line('M134,64 l20,6', 4.5), // するどい まゆ
    line('M128,58 q4,-16 14,-18 M138,56 q8,-12 18,-10', 3.5), // あたまの はね
  ].join(''),
);

/** ドカドカおに：むらさきの おに。2本の つの・キバ・トラもようの パンツ・かなぼう。 */
const ONI = svg(
  [
    shape('<path d="M158,168 l8,-2 l-4,-56 l-10,2 z"/>', '#8a6a4a'), // かなぼう（にぎり）
    shape('<path d="M146,116 l22,-4 l10,-70 q-12,-12 -26,-4 z"/>', '#5b5f6b'), // かなぼう（トゲの ぼう）
    dot(158, 62, 2.8, '#d9d9d9'),
    dot(166, 76, 2.8, '#d9d9d9'),
    dot(156, 86, 2.8, '#d9d9d9'),
    dot(164, 98, 2.8, '#d9d9d9'),
    shape('<rect x="66" y="160" width="24" height="26" rx="6"/>', '#b05cc4'), // あし
    shape('<rect x="110" y="160" width="24" height="26" rx="6"/>', '#b05cc4'),
    shape('<ellipse cx="100" cy="132" rx="50" ry="40"/>', '#b05cc4'), // からだ
    shape('<path d="M54,140 q46,22 92,0 l-4,26 q-42,12 -84,0 z"/>', '#f2c230', 4), // パンツ
    line('M72,150 l6,14 M92,154 l4,14 M112,154 l-2,14 M130,150 l-6,14', 4),
    shape('<ellipse cx="150" cy="118" rx="12" ry="20" transform="rotate(-20 150 118)"/>', '#b05cc4'), // うで
    shape('<ellipse cx="50" cy="122" rx="12" ry="20" transform="rotate(20 50 122)"/>', '#b05cc4'),
    shape('<circle cx="100" cy="74" r="44"/>', '#c46fd4'), // あたま
    shape('<path d="M66,44 l-10,-34 l24,24 z"/>', '#fbe7a1', 3.5), // つの
    shape('<path d="M134,44 l10,-34 l-24,24 z"/>', '#fbe7a1', 3.5),
    shape('<path d="M60,58 q40,-36 80,0 q-10,-8 -20,-4 q-10,-10 -20,-2 q-10,-8 -20,2 q-10,-4 -20,4 z"/>', '#3a2f28', 3), // かみ
    shape('<ellipse cx="84" cy="72" rx="9" ry="8"/>', '#fff', 3),
    shape('<ellipse cx="116" cy="72" rx="9" ry="8"/>', '#fff', 3),
    dot(86, 73, 4.5, INK),
    dot(114, 73, 4.5, INK),
    line('M72,58 l22,8 M128,58 l-22,8', 5), // おこった まゆ
    shape('<path d="M78,94 q22,18 44,0 q-22,8 -44,0 z"/>', '#7a1f2b', 3.5), // くち
    shape('<path d="M84,96 l4,9 l4,-8 z"/>', '#fff', 2),
    shape('<path d="M108,96 l4,8 l4,-9 z"/>', '#fff', 2),
  ].join(''),
);

const url = (s: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`;

/** CPU の id → 絵（data URL）。 */
export const NPC_ART: Record<string, string> = {
  'dummy-pochi': url(POCHI),
  'dummy-mecha': url(MECHA),
  'dummy-tori': url(TORI),
  'dummy-oni': url(ONI),
};

export const npcImage = (id: string): string | null => NPC_ART[id] ?? null;
