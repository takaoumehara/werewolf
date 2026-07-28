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

/* --------------------------------------------------------------------------
   AIが知ってよい情報は、同じ役職の人間プレイヤーが toPlayerView で受け取る
   範囲と一致していなければならない。広いとAIだけが有利になる。
   -------------------------------------------------------------------------- */

const mixedTable = {
  players: {
    p1: { id: "p1", roleId: "twins", team: "citizen", alive: true },
    p2: { id: "p2", roleId: "twins", team: "citizen", alive: true },
    w1: { id: "w1", roleId: "werewolf", team: "werewolf", alive: true },
    w2: { id: "w2", roleId: "werewolf_child", team: "werewolf", alive: true },
    t1: { id: "t1", roleId: "traitor", team: "werewolf", alive: true },
    s1: { id: "s1", roleId: "spy", team: "werewolf", alive: true },
    l1: { id: "l1", roleId: "lone_wolf", team: "werewolf", alive: true },
    b1: { id: "b1", roleId: "betrayal_twin", team: "werewolf", alive: true },
    b2: { id: "b2", roleId: "betrayal_twin", team: "werewolf", alive: true },
  },
  pendingVotes: {},
  roleState: { privateResults: {}, twins: { p1: "p2", p2: "p1" }, betrayalTwins: { b1: "b2", b2: "b1" } },
};

test("人狼と人狼の子どもは互いを仲間として認識する", () => {
  assert.deepEqual(deriveBrainInput(mixedTable, "w1", 1).allyIds, ["w2"]);
  assert.deepEqual(deriveBrainInput(mixedTable, "w2", 1).allyIds, ["w1"]);
});

test("内通者・スパイ・一匹狼は人狼陣営でも仲間を知らない", () => {
  for (const id of ["t1", "s1", "l1"]) {
    assert.deepEqual(deriveBrainInput(mixedTable, id, 1).allyIds, [], `${id} が仲間を知っている`);
  }
});

test("共有者と裏切りの共有者は相方だけを知る", () => {
  assert.deepEqual(deriveBrainInput(mixedTable, "p1", 1).allyIds, ["p2"]);
  assert.deepEqual(deriveBrainInput(mixedTable, "b1", 1).allyIds, ["b2"]);
});

test("死んだ仲間は allyIds に残らない", () => {
  const withDeadWolf = {
    ...mixedTable,
    players: { ...mixedTable.players, w2: { ...mixedTable.players.w2, alive: false } },
  };
  assert.deepEqual(deriveBrainInput(withDeadWolf, "w1", 1).allyIds, []);
});
