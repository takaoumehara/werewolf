import { test } from "node:test";
import assert from "node:assert/strict";
import { validateUtterance } from "./validate.mjs";

const ctx = { maxChars: 100, validNames: ["紗奈", "凛", "ゴン"] };

test("システム用語を含む発話は不合格", () => {
  assert.equal(validateUtterance("これはAIだから信用できない", ctx).ok, false);
  assert.equal(validateUtterance("プロンプト的に怪しい", ctx).ok, false);
});

test("普通の発話は合格", () => {
  const r = validateUtterance("紗奈が怪しいと思うんだよね", ctx);
  assert.equal(r.ok, true);
});

test("文字数超過は末尾トリムしてcleanedを返す", () => {
  const long = "あ".repeat(150);
  const r = validateUtterance(long, ctx);
  assert.equal(r.ok, true);
  assert.ok(r.cleaned.length <= ctx.maxChars);
});

test("空文字・地の文だけは不合格", () => {
  assert.equal(validateUtterance("", ctx).ok, false);
  assert.equal(validateUtterance("（黙っている）", ctx).ok, false);
});
