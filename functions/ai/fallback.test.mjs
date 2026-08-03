import { test } from "node:test";
import assert from "node:assert/strict";
import { localUtterance } from "./fallback.mjs";
import { validateUtterance } from "./validate.mjs";

const base = {
  name: "虎鉄", pronoun: "儂", verbalTic: "…のう", maxChars: 100,
  voteTargetName: "凛", topSuspectNames: ["凛"], reasonTags: ["言動が不自然"],
  validNames: ["凛", "あなた"], personality: { logic: 80, aggression: 30 },
};

test("ローカル発話は必ず validateUtterance を通る", () => {
  for (let seed = 0; seed < 200; seed += 1) {
    const text = localUtterance(base, seed);
    const v = validateUtterance(text, { maxChars: 100, validNames: base.validNames });
    assert.ok(v.ok, `seed=${seed} で不合格: ${text}`);
  }
});

test("同じ入力・同じ seed なら同じ文（決定論）", () => {
  assert.equal(localUtterance(base, 7), localUtterance(base, 7));
});

test("投票予定の相手を必ず名指しする（decideVote と結論がずれない）", () => {
  for (let seed = 0; seed < 50; seed += 1) {
    assert.ok(localUtterance(base, seed).includes("凛"), `seed=${seed}`);
  }
});

test("投票先が未定なら誰も名指ししない", () => {
  const ctx = { ...base, voteTargetName: null, topSuspectNames: [] };
  for (let seed = 0; seed < 50; seed += 1) {
    const text = localUtterance(ctx, seed);
    assert.ok(!text.includes("凛"), `未定なのに名指ししている: ${text}`);
  }
});

test("名簿にない相手には返事をしない", () => {
  const ctx = { ...base, replyTo: { name: "幽霊", text: "…" } };
  for (let seed = 0; seed < 50; seed += 1) {
    assert.ok(!localUtterance(ctx, seed).includes("幽霊"), `seed=${seed}`);
  }
});

test("名簿にいる相手の発言には名前を出して返す", () => {
  const ctx = { ...base, replyTo: { name: "あなた", text: "虎鉄が怪しい" } };
  for (let seed = 0; seed < 50; seed += 1) {
    assert.ok(localUtterance(ctx, seed).includes("あなた"), `seed=${seed}`);
  }
});

test("maxChars を超えない", () => {
  const ctx = { ...base, maxChars: 30, replyTo: { name: "あなた", text: "長い話" } };
  for (let seed = 0; seed < 100; seed += 1) {
    assert.ok(localUtterance(ctx, seed).length <= 30, `seed=${seed}`);
  }
});

test("人格で口調が分かれる（攻撃的・論理的・弱気が同じ文にならない）", () => {
  const aggressive = localUtterance({ ...base, personality: { logic: 40, aggression: 90 } }, 3);
  const analytic = localUtterance({ ...base, personality: { logic: 90, aggression: 20 } }, 3);
  const soft = localUtterance({ ...base, personality: { logic: 40, aggression: 20 } }, 3);
  assert.notEqual(aggressive, analytic);
  assert.notEqual(analytic, soft);
  assert.notEqual(aggressive, soft);
});
