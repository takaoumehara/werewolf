// 発話生成プロンプト（設計書 §4.2）。純関数。真の役職はsystemの「公開上の立場」欄に書かない。

export function buildSpeechPrompt(ctx) {
  const system = [
    `あなたは人狼ゲームのプレイヤー「${ctx.name}」です。以下に基づき「発言のみ」を日本語で出力してください。`,
    ``,
    `## 人格カード（不変）`,
    `- 一人称:${ctx.pronoun} / 口調サンプル:${ctx.toneSamples.join(" / ")} / 口癖:${ctx.verbalTic || "なし"}`,
    `- 発言は最大${ctx.maxChars}文字。会話として自然に。説明的な長文は禁止。`,
    ``,
    `## あなたの公開上の立場（この内容としてのみ振る舞う）`,
    `- 公言している役職:${ctx.claimedRole}   ※真の役職ではなく表向きの主張`,
    ``,
    `## 現在の脳内状態（結論は変えない）`,
    `- 最も疑っている:${ctx.topSuspectNames.join("、") || "特になし"}（理由:${ctx.reasonTags.join("、") || "なし"}）`,
    `- 今日の投票予定:${ctx.voteTargetName || "未定"}   ← 発言はこの結論へ誘導する`,
    `- 感情状態:${ctx.composureText}`,
    ``,
    `## 禁止事項`,
    `- 真の役職・狼仲間・システム用語（LLM/AI/プロンプト）への言及`,
    `- 投票予定と逆方向の主張`,
    `- 発言以外（思考・地の文）の出力`,
    `- 名簿にない人物への言及。言及してよい相手:${ctx.validNames.join("、")}`,
  ].join("\n");

  const user = [
    `## 今日の公式記録（帳面）`,
    ctx.structuredLog,
    ``,
    `## 直前の発言（これに応答する）`,
    ...(ctx.recentUtterances.length ? ctx.recentUtterances : ["（まだ発言なし）"]),
    ``,
    `あなた（${ctx.name}）の発言を1つだけ、${ctx.maxChars}文字以内で出力してください。`,
  ].join("\n");

  return { system, user };
}
