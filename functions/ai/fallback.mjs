// 鍵なし／生成失敗のときの発話（ローカル生成）。純関数・決定論。
//
// なぜ要るか: 昼の発話だけが `ANTHROPIC_API_KEY` に依存していて、鍵が無いと
// 卓が丸ごと無言になる。夜行動と投票はローカルの ai-brain で動くので、
// 「AIは行動しているのに一言も喋らない」という最悪の見え方になっていた。
//
// これは症状を隠す fallback ではない。出力は必ず `source:"local"` を付けて
// chat に残し、advanceAiTurn の戻り値 `speechMode` にも出る。画面はそれを見て
// 「いまは簡易モードです」と明示する。何が起きているかは常に読み取れる。
//
// 生成物は buildSpeechPrompt が LLM に課しているのと同じ制約を守る:
//   - 投票予定と逆の主張をしない（結論は decideVote と一致する）
//   - 名簿(validNames)にない人物に言及しない
//   - maxChars 以内
//   - validateUtterance の禁止語を含まない

/** seed から決定論的に1つ選ぶ。Math.random は使わない（再現性のため）。 */
function pick(list, seed) {
  return list[Math.abs(seed) % list.length];
}

function hash(str, seed) {
  let h = (seed >>> 0) ^ 2166136261;
  for (let i = 0; i < str.length; i += 1) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

const PRESSING = [
  (t, r, p) => `${t}に入れる。${r}のが引っかかる。違うなら今のうちに言って。`,
  (t, r, p) => `${p}は${t}を推す。${r}。ここで決めないと押し切られる。`,
  (t, r, p) => `${t}、さっきから話がずれてる。${r}だと思う。`,
];

const ANALYTIC = [
  (t, r, p) => `整理すると、${t}が一番説明できていない。${r}。`,
  (t, r, p) => `${p}は${t}を疑っている。根拠は${r}。`,
  (t, r, p) => `${t}について確認したい。${r}のはなぜ。`,
];

const SOFT = [
  (t, r, p) => `${t}が気になる…かな。${r}だし。みんなはどう思う？`,
  (t, r, p) => `${p}は今のところ${t}に寄せておく。${r}。`,
  (t, r, p) => `迷ってるけど、${t}かも。${r}のが気になって。`,
];

const NO_TARGET = [
  (p) => `まだ判断がつかない。もう少し話を聞きたい。`,
  (p) => `${p}は保留にする。決めるには材料が足りない。`,
  (p) => `誰か、根拠のある話を出してほしい。`,
];

const REPLY_OPENERS = [
  (who) => `${who}の話だけど、`,
  (who) => `${who}、それは違うと思う。`,
  (who) => `${who}の言い分は分かった。ただ、`,
];

const REASON_TEXT = {
  "占い結果が黒": "占いで黒が出ている",
  "言動が不自然": "言っていることが噛み合わない",
};

/**
 * localUtterance(ctx, seed) -> string
 *
 * ctx は buildSpeechPrompt と同じ形。追加で personality（logic/aggression）と、
 * 任意で replyTo（{ name, text }）を見る。replyTo があると「直前の発言への返し」
 * になり、無ければ第一声になる。
 */
export function localUtterance(ctx, seed = 0) {
  const maxChars = ctx.maxChars ?? 100;
  const pronoun = ctx.pronoun || "私";
  const target = ctx.voteTargetName || ctx.topSuspectNames?.[0] || null;
  const rawReason = ctx.reasonTags?.[0] ?? "";
  const reason = REASON_TEXT[rawReason] ?? "言動が読めない";
  const aggression = ctx.personality?.aggression ?? 50;
  const logic = ctx.personality?.logic ?? 50;
  const s = hash(`${ctx.name}|${target ?? ""}|${ctx.replyTo?.text ?? ""}`, seed);

  let body;
  if (!target) {
    body = pick(NO_TARGET, s)(pronoun);
  } else if (aggression >= 60) {
    body = pick(PRESSING, s)(target, reason, pronoun);
  } else if (logic >= 70) {
    body = pick(ANALYTIC, s)(target, reason, pronoun);
  } else {
    body = pick(SOFT, s)(target, reason, pronoun);
  }

  // 名簿にない相手には返さない（死亡者・退室者への呼びかけを防ぐ）。
  const replyName = ctx.replyTo?.name;
  const canReply = replyName && (ctx.validNames ?? []).includes(replyName);
  if (canReply) {
    const opener = pick(REPLY_OPENERS, s >>> 3)(replyName);
    // 「〜だけど、」で終わる開き方のときだけ本文を小文字始まりのまま繋ぐ。
    body = opener.endsWith("、") ? opener + body : `${opener} ${body}`;
  }

  // 口癖は入る余地があるときだけ足す。押し込んで文が壊れる方が不自然。
  if (ctx.verbalTic && s % 3 === 0) {
    const withTic = body.replace(/[。！？]$/, "") + ctx.verbalTic;
    if (withTic.length <= maxChars) body = withTic;
  }

  return body.length > maxChars ? body.slice(0, maxChars) : body;
}
