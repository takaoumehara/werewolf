import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveBrainInput } from "./context.mjs";

const authoritative = {
  players: {
    p1: { id: "p1", roleId: "prophet", team: "citizen", alive: true },
    ai1: { id: "ai1", roleId: "werewolf", team: "werewolf", alive: true },
    ai2: { id: "ai2", roleId: "werewolf", team: "werewolf", alive: true },
    ai3: { id: "ai3", roleId: "citizen", team: "citizen", alive: true },
    ai4: { id: "ai4", roleId: "citizen", team: "citizen", alive: false },
  },
  pendingVotes: { p1: "ai1" },
  roleState: { privateResults: { p1: [{ type: "divine", targetId: "ai1", result: "werewolf" }] } },
};

test("狼のallyIdsは他の狼だけ（自分・村人・死者を除く）", () => {
  const input = deriveBrainInput(authoritative, "ai1", 5);
  assert.deepEqual(input.allyIds.sort(), ["ai2"]);
  assert.equal(input.roleId, "werewolf");
  assert.equal(input.team, "werewolf");
});

test("alivePlayerIdsは生存者のみ（死者ai4を含まない）", () => {
  const input = deriveBrainInput(authoritative, "ai1", 5);
  assert.ok(!input.alivePlayerIds.includes("ai4"));
  assert.ok(input.alivePlayerIds.includes("ai1"));
});

test("占い師の privateResults が divineResults に変換される", () => {
  const input = deriveBrainInput(authoritative, "p1", 5);
  assert.deepEqual(input.divineResults, [{ targetId: "ai1", result: "werewolf" }]);
});

test("pendingVotes と seed をそのまま渡す", () => {
  const input = deriveBrainInput(authoritative, "ai1", 5);
  assert.deepEqual(input.pendingVotes, { p1: "ai1" });
  assert.equal(input.seed, 5);
});
