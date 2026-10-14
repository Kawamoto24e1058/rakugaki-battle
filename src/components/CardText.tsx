import type { ReactNode } from 'react';

/**
 * カードの 説明文（Slay the Spire ふう）：ふつうの 文の なかで、数字と キーワードだけ 色を つける。
 *  数字・％・〜ばい → こい色の 太字 ／ じょうたい（やけど 等）→ その色 ／ 先に うごく → 金
 */
const KEYWORDS: [RegExp, string][] = [
  [/やけど/, '#c2361c'],
  [/こおり/, '#1c6aa8'],
  [/どく/, '#7a3fc0'],
  [/まひ/, '#a07400'],
  [/こんらん/, '#b0307e'],
  [/ねむ(り|らせる)/, '#4a5a80'],
  [/ひるみ/, '#6a655a'],
  [/(かならず )?先に うごく/, '#a07400'],
  [/かいふく/, '#1b7a47'],
  [/ぼうぎょ(を )?(むし|無視)/, '#7a3fc0'],
  [/ため(て|技)/, '#7b5cf0'],
];
const NUM = /(\d+(?:\.\d+)?\s*(?:%|ばい|かい|ターン|わり)?|×\d+(?:\.\d+)?)/;

export function CardText({ text }: { text: string }) {
  // キーワードと 数字を 見つけて、のこりは そのまま
  // キーワードは ことばの はじめ だけ（「するどく」の「どく」を まちがえて ひろわない）
  const pattern = new RegExp([...KEYWORDS.map(([r]) => `(?<=^|[\\s「、。（])${r.source}`), NUM.source].map((s) => `(?:${s})`).join('|'), 'g');
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = pattern.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const word = m[0];
    const kw = KEYWORDS.find(([r]) => new RegExp(`^(?:${r.source})$`).test(word));
    out.push(
      <b key={k++} style={{ color: kw ? kw[1] : 'var(--ink)', fontWeight: 900 }}>
        {word}
      </b>,
    );
    last = m.index + word.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
