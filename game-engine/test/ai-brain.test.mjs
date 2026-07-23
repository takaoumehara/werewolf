import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTrust, decideVote, decideNightAction } from "../src/ai-brain.mjs";

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

test("占い師は『人狼』と占った相手に投票する", () => {
  const out = decideVote({
    ...base, roleId: "prophet",
    divineResults: [{ targetId: "p3", result: "werewolf" }],
    personality: { logic: 100, aggression: 50 }, // logic高=ノイズ無しで確実
  });
  assert.equal(out.targetId, "p3");
});

test("狼は仲間には絶対投票しない", () => {
  for (let seed = 0; seed < 50; seed++) {
    const out = decideVote({
      ...base, roleId: "werewolf", team: "werewolf", allyIds: ["p2"], seed,
    });
    assert.notEqual(out.targetId, "p2");
    assert.notEqual(out.targetId, "p1"); // 自分にも投票しない
  }
});

test("同じ入力・同じseedなら決定は再現する（決定論）", () => {
  const a = decideVote({ ...base, seed: 7 });
  const b = decideVote({ ...base, seed: 7 });
  assert.equal(a.targetId, b.targetId);
});

test("投票可能な生存者がいなければ targetId は null", () => {
  const out = decideVote({ ...base, alivePlayerIds: ["p1"] });
  assert.equal(out.targetId, null);
});

test("村人は夜行動を持たない（null）", () => {
  assert.equal(decideNightAction(base), null);
});

test("人狼の襲撃先は仲間・自分を含まない生存者", () => {
  const out = decideNightAction({
    ...base, roleId: "werewolf", team: "werewolf", allyIds: ["p2"],
  });
  assert.equal(out.kind, "attack");
  assert.ok(["p3", "p4"].includes(out.targetId));
});

test("占い師の占い先は自分・既占い者を除く生存者", () => {
  const out = decideNightAction({
    ...base, roleId: "prophet",
    divineResults: [{ targetId: "p2", result: "human" }],
  });
  assert.equal(out.kind, "divine");
  assert.ok(["p3", "p4"].includes(out.targetId)); // p2は既占いなので除外
});

test("夜行動は同seedで再現する", () => {
  const a = decideNightAction({ ...base, roleId: "werewolf", team: "werewolf", allyIds: ["p2"], seed: 3 });
  const b = decideNightAction({ ...base, roleId: "werewolf", team: "werewolf", allyIds: ["p2"], seed: 3 });
  assert.deepEqual(a, b);
});
