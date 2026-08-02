// functions/scripts/check-anthropic-key.mjs
//
// 「AIが喋らない」を、デプロイせずに切り分けるための確認スクリプト。
//
// 昼の発話だけが ANTHROPIC_API_KEY に依存している（夜行動と投票はローカルで動く）。
// 鍵が無くても卓は無言にならず簡易モードで回るが、簡易モードのままか本物かは
// 画面のトーストでしか分からない。ここでは鍵そのものを1回だけ試す。
//
//   ANTHROPIC_API_KEY=sk-ant-... node functions/scripts/check-anthropic-key.mjs
//
// 鍵は引数で渡さないこと（シェルの履歴とプロセス一覧に残る）。環境変数だけを見る。
// 出力に鍵は一切含めない。

import { generateSpeech } from "../ai/llm.mjs";
import { buildSpeechPrompt } from "../ai/prompt.mjs";
import { validateUtterance } from "../ai/validate.mjs";

const key = process.env.ANTHROPIC_API_KEY ?? "";

function fail(message, hint) {
  console.error(`NG: ${message}`);
  if (hint) console.error(`    → ${hint}`);
  process.exit(1);
}

if (!key) {
  fail("環境変数 ANTHROPIC_API_KEY が空です。",
    "ANTHROPIC_API_KEY=... node functions/scripts/check-anthropic-key.mjs で渡してください。");
}
if (key.startsWith("emulator-") || key.length < 20) {
  fail(`鍵がダミーのようです（${key.length}文字）。`,
    "functions/.secret.local の値ではなく、本物の鍵を渡してください。");
}

const { system, user } = buildSpeechPrompt({
  name: "虎鉄", pronoun: "儂", toneSamples: ["ふむ、妙じゃな。"], verbalTic: "…のう",
  maxChars: 100, claimedRole: "村人", topSuspectNames: ["凛"], reasonTags: ["言動が不自然"],
  voteTargetName: "凛", composureText: "落ち着いている",
  structuredLog: "生存: あなた、凛、虎鉄", recentUtterances: ["あなた: 昨夜のことを聞きたい"],
  validNames: ["あなた", "凛"],
});

try {
  const started = Date.now();
  const raw = await generateSpeech({ system, user, apiKey: key });
  const elapsed = Date.now() - started;
  const v = validateUtterance(raw, { maxChars: 100, validNames: ["あなた", "凛"] });
  console.log(`OK: Anthropic API に到達しました（${elapsed}ms）`);
  console.log(`    生成された発話: ${raw}`);
  console.log(`    発話の検証: ${v.ok ? "合格" : `不合格（${v.reason}）— たまに落ちるのは正常です`}`);
  console.log("");
  console.log("この鍵をサーバーへ登録するには:");
  console.log("  firebase functions:secrets:set ANTHROPIC_API_KEY --project jinro-bb5a5");
  console.log("  firebase deploy --only functions --project jinro-bb5a5");
} catch (error) {
  const message = String(error?.message ?? error);
  if (message.includes("401")) {
    fail("鍵が拒否されました（401）。", "無効・失効・別組織の鍵の可能性があります。");
  } else if (message.includes("429")) {
    fail("レート制限（429）。", "鍵は有効です。しばらく待って再実行してください。");
  } else if (message.includes("credit") || message.includes("400")) {
    fail(`API がリクエストを拒否しました: ${message}`, "残高（クレジット）と権限を確認してください。");
  } else {
    fail(`API に到達できませんでした: ${message}`, "ネットワークまたはプロキシの設定を確認してください。");
  }
}
