import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTrust } from "../src/ai-brain.mjs";

const base = {
  selfId: "p1",
  roleId: "citizen",
  team: "citizen",
  allyIds: [],
  divineResults: [],
  alivePlayerIds: ["p1", "p2", "p3", "p4"],
  pendingVotes: {},
  personality: { logic: 50, aggression: 50 },
  seed: 1,
};

test("占い師が『人狼』と占った相手の信頼度は最小(-100)になる", () => {
  const trust = computeTrust({
    ...base, roleId: "prophet",
    divineResults: [{ targetId: "p3", result: "werewolf" }],
  });
  assert.equal(trust.p3, -100);
});

test("占い師が『人間』と占った相手は信頼が上がる(+40)", () => {
  const trust = computeTrust({
    ...base, roleId: "prophet",
    divineResults: [{ targetId: "p2", result: "human" }],
  });
  assert.equal(trust.p2, 40);
});

test("狼から見た仲間の狼は信頼度が最大(+100)で守られる", () => {
  const trust = computeTrust({
    ...base, roleId: "werewolf", team: "werewolf", allyIds: ["p2"],
  });
  assert.equal(trust.p2, 100);
});

test("自分に投票してきた相手への疑いが上がる(aggressionで増幅)", () => {
  const calm = computeTrust({ ...base, personality: { logic: 50, aggression: 0 },
    pendingVotes: { p2: "p1" } });
  const fierce = computeTrust({ ...base, personality: { logic: 50, aggression: 100 },
    pendingVotes: { p2: "p1" } });
  assert.ok(fierce.p2 < calm.p2, "aggression高の方が疑いが強い");
  assert.ok(calm.p2 < 0, "投票された相手は疑いがマイナス方向");
});

test("自分自身は信頼度マップに含めない", () => {
  const trust = computeTrust(base);
  assert.equal(trust.p1, undefined);
});
