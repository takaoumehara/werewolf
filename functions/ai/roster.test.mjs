import { test } from "node:test";
import assert from "node:assert/strict";
import { AI_ROSTER, pickRoster } from "./roster.mjs";

test("ロスターは最低4体、各キャラは必須フィールドを持つ", () => {
  assert.ok(AI_ROSTER.length >= 4);
  for (const c of AI_ROSTER) {
    assert.equal(typeof c.name, "string");
    assert.equal(typeof c.pronoun, "string");
    assert.ok(Array.isArray(c.toneSamples) && c.toneSamples.length >= 1);
    assert.ok(c.personality.logic >= 0 && c.personality.logic <= 100);
    assert.ok(c.personality.aggression >= 0 && c.personality.aggression <= 100);
  }
});

test("pickRosterは要求数ぴったり返す（超過要求は名前を変えて複製）", () => {
  assert.equal(pickRoster(3).length, 3);
  const many = pickRoster(AI_ROSTER.length + 2);
  assert.equal(many.length, AI_ROSTER.length + 2);
  const names = many.map((c) => c.name);
  assert.equal(new Set(names).size, names.length, "名前は一意");
});
