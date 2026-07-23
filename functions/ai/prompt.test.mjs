import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSpeechPrompt } from "./prompt.mjs";

const ctx = {
  name: "虎鉄", pronoun: "儂", toneSamples: ["ふむ、妙じゃな。"], verbalTic: "…のう",
  maxChars: 100, claimedRole: "村人",
  topSuspectNames: ["紗奈"], reasonTags: ["自分に投票してきた"],
  voteTargetName: "紗奈", composureText: "落ち着いている",
  structuredLog: "CO: なし / 前日投票: なし / 死亡: なし",
  recentUtterances: ["紗奈: 虎鉄が怪しい"], validNames: ["紗奈", "凛", "ゴン"],
};

test("systemに名前・口調・禁止事項・文字数上限が含まれる", () => {
  const { system } = buildSpeechPrompt(ctx);
  assert.match(system, /虎鉄/);
  assert.match(system, /儂/);
  assert.match(system, /100文字/);
  assert.match(system, /禁止/);
  assert.match(system, /LLM|AI|プロンプト/); // システム用語への言及禁止が明記される
});

test("真の役職名（人狼/占い師の内部知識）はsystemにそのまま出さない", () => {
  const { system } = buildSpeechPrompt({ ...ctx, claimedRole: "村人" });
  // claimedRole=村人 のときは "人狼です" のような真role断定を含めない
  assert.doesNotMatch(system, /あなたの真の役職は人狼/);
});

test("投票予定と最重要容疑者がuserに反映される", () => {
  const { user } = buildSpeechPrompt(ctx);
  assert.match(user, /紗奈/);
});
