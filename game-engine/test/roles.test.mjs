import test from "node:test";
import assert from "node:assert/strict";
import { ROLE_DEFINITIONS, ROLE_IDS, createRoleRegistry, getRoleDefinition } from "../src/roles.mjs";

test("カードの全役職IDにルール定義がある", () => {
  assert.equal(ROLE_IDS.length, 25);
  for (const roleId of ROLE_IDS) {
    assert.equal(getRoleDefinition(roleId).id, roleId);
    assert.ok(["citizen", "werewolf", "fox"].includes(ROLE_DEFINITIONS[roleId].team));
  }
});

test("奇術師Cは奇術師と同じルールを参照する", () => {
  assert.equal(ROLE_DEFINITIONS.magician_c.ruleId, "magician");
});

test("役職プラグインを既存レジストリへ追加できる", () => {
  const registry = createRoleRegistry({
    archivist: { id: "archivist", team: "citizen", actions: ["archive"], ruleId: "archivist" },
  });
  assert.equal(registry.get("archivist").actions[0], "archive");
  assert.throws(() => registry.register({ id: "archivist", team: "citizen", actions: [] }), /duplicate/i);
});
