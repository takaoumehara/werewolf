import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSpeech } from "./llm.mjs";

test("Messages APIのレスポンスからテキストを取り出す", async () => {
  let captured = null;
  const fakeFetch = async (url, opts) => {
    captured = { url, opts };
    return {
      ok: true,
      json: async () => ({ content: [{ type: "text", text: "紗奈が怪しいのう" }] }),
    };
  };
  const out = await generateSpeech({
    system: "sys", user: "usr", apiKey: "sk-test", fetchImpl: fakeFetch,
  });
  assert.equal(out, "紗奈が怪しいのう");
  assert.match(captured.url, /api\.anthropic\.com\/v1\/messages/);
  const body = JSON.parse(captured.opts.body);
  assert.equal(body.model, "claude-haiku-4-5-20251001");
  assert.equal(captured.opts.headers["x-api-key"], "sk-test");
  assert.equal(captured.opts.headers["anthropic-version"], "2023-06-01");
});

test("APIエラー時は例外を投げる", async () => {
  const fakeFetch = async () => ({ ok: false, status: 500, text: async () => "boom" });
  await assert.rejects(
    () => generateSpeech({ system: "s", user: "u", apiKey: "k", fetchImpl: fakeFetch }),
    /500/,
  );
});
