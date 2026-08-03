import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AI_TABLE_PHASE_DURATIONS,
  AI_TURN_CLAIM_TTL_MS,
  MAX_DAY_WAVES,
  claimKey,
  normalizeWave,
  claimDecision,
  phaseDurationsFor,
} from "./turn-policy.mjs";

test("AIが居ない卓ではエンジンの既定フェーズ長を使う", () => {
  assert.deepEqual(phaseDurationsFor(0), {});
});

test("AI卓では夜/昼/投票とも既定より短いフェーズ長を渡す", () => {
  const durations = phaseDurationsFor(3);
  assert.deepEqual(durations, AI_TABLE_PHASE_DURATIONS);
  // エンジン既定(夜90秒/昼180秒/投票60秒)より必ず短いこと
  assert.ok(durations.night < 90_000);
  assert.ok(durations.day < 180_000);
  assert.ok(durations.vote < 60_000);
});

test("返すオブジェクトは毎回コピーで、呼び出し側が定数を壊せない", () => {
  const durations = phaseDurationsFor(1);
  durations.night = 1;
  assert.equal(AI_TABLE_PHASE_DURATIONS.night, 30_000);
});

test("未実行の (round, phase) は最初の1回だけ通す", () => {
  assert.deepEqual(claimDecision(null, 1000), { grant: true, reason: "first" });
  assert.deepEqual(claimDecision(undefined, 1000), { grant: true, reason: "first" });
});

test("完了済みの (round, phase) は二度と通さない", () => {
  const claim = { startedAt: 0, done: true, doneAt: 500 };
  assert.equal(claimDecision(claim, 1000).grant, false);
  // TTL を過ぎても完了済みは通さない(投票解決後の day で再発火させない)
  assert.equal(claimDecision(claim, 1000 + AI_TURN_CLAIM_TTL_MS * 10).grant, false);
});

test("実行中の (round, phase) は TTL の間は通さない", () => {
  const claim = { startedAt: 1000, done: false };
  assert.equal(claimDecision(claim, 1000).grant, false);
  assert.equal(claimDecision(claim, 1000 + AI_TURN_CLAIM_TTL_MS - 1).grant, false);
});

test("TTL を過ぎた未完了の claim は再試行を通す", () => {
  const claim = { startedAt: 1000, done: false };
  const decision = claimDecision(claim, 1000 + AI_TURN_CLAIM_TTL_MS);
  assert.equal(decision.grant, true);
  assert.equal(decision.reason, "stale");
});

test("startedAt が欠けた壊れた claim も TTL 判定で詰まらない", () => {
  assert.equal(claimDecision({ done: false }, AI_TURN_CLAIM_TTL_MS).grant, true);
});

test("発話の波は昼だけ。夜と投票は常に1回", () => {
  assert.equal(normalizeWave("night", 3), 1);
  assert.equal(normalizeWave("vote", 2), 1);
  assert.equal(normalizeWave("day", 2), 2);
});

test("波の数には上限がある（人間が書くたびに無制限に生成させない）", () => {
  assert.equal(normalizeWave("day", 99), MAX_DAY_WAVES);
  assert.equal(normalizeWave("day", 0), 1);
  assert.equal(normalizeWave("day", "あ"), 1);
  assert.equal(normalizeWave("day", undefined), 1);
});

test("1波目の claim キーは従来と同じ（進行中の卓を壊さない）", () => {
  assert.equal(claimKey(2, "day", 1), "2_day");
  assert.equal(claimKey(2, "day"), "2_day");
  assert.notEqual(claimKey(2, "day", 2), claimKey(2, "day", 1));
});
