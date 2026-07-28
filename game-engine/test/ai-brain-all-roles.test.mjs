// AIが全役職の夜行動を出せることの確認。
// ここが欠けている役職は「AIに配れない役職」になり、ソロ卓から締め出される。
import { test } from "node:test";
import assert from "node:assert/strict";
import { decideNightAction, NIGHT_ACTION_BY_ROLE } from "../src/ai-brain.mjs";
import { ROLE_DEFINITIONS, ROLE_IDS } from "../src/roles.mjs";

const base = {
  selfId: "p1",
  roleId: "citizen",
  team: "citizen",
  allyIds: [],
  divineResults: [],
  alivePlayerIds: ["p1", "p2", "p3", "p4"],
  pendingVotes: {},
  // logic を上限にしてノイズ（難易度スライダー）を切り、選択そのものを検証する。
  personality: { logic: 100, aggression: 50 },
  seed: 7,
};

/** その役職がエンジン上で持つ夜行動（REVEAL_DICTATOR のような昼の能力は含まない）。 */
const NIGHT_KINDS = new Set([
  "attack", "protect", "divine", "medium", "trap", "swap", "calm", "oracle", "choose_copy", "relay", "death_shot",
]);
const rolesWithNightAction = ROLE_IDS.filter((id) =>
  ROLE_DEFINITIONS[id].actions.some((action) => NIGHT_KINDS.has(action)));

test("夜行動を持つ役職はすべてAIが行動を返す", () => {
  const silent = [];
  for (const roleId of rolesWithNightAction) {
    const team = ROLE_DEFINITIONS[roleId].team;
    const act = decideNightAction({ ...base, roleId, team });
    if (!act) silent.push(roleId);
  }
  assert.deepEqual(silent, [], `AIが夜に何もしない役職が残っている: ${silent.join(", ")}`);
});

test("AIが返す行動の種別は、その役職がエンジン上で許可されたものと一致する", () => {
  for (const roleId of rolesWithNightAction) {
    const team = ROLE_DEFINITIONS[roleId].team;
    const act = decideNightAction({ ...base, roleId, team });
    assert.ok(
      ROLE_DEFINITIONS[roleId].actions.includes(act.kind),
      `${roleId} が許可されていない行動 ${act.kind} を返した`,
    );
  }
});

test("AIが選ぶ対象は必ず生存者で、自分自身ではない", () => {
  for (const roleId of rolesWithNightAction) {
    const team = ROLE_DEFINITIONS[roleId].team;
    const act = decideNightAction({ ...base, roleId, team });
    assert.ok(base.alivePlayerIds.includes(act.targetId), `${roleId} が生存者以外を選んだ`);
    assert.notEqual(act.targetId, base.selfId, `${roleId} が自分を選んだ`);
  }
});

test("夜行動を持たない役職はこれまでどおり null を返す", () => {
  for (const roleId of ROLE_IDS.filter((id) => !rolesWithNightAction.includes(id))) {
    const team = ROLE_DEFINITIONS[roleId].team;
    assert.equal(decideNightAction({ ...base, roleId, team }), null, `${roleId} が行動を返した`);
  }
});

test("奇術師は入れ替える2人を返し、2人は互いに異なる", () => {
  for (const roleId of ["magician", "magician_c"]) {
    const act = decideNightAction({ ...base, roleId });
    assert.equal(act.kind, "swap");
    assert.equal(typeof act.secondTargetId, "string");
    assert.notEqual(act.secondTargetId, act.targetId);
    assert.notEqual(act.secondTargetId, base.selfId);
    assert.ok(base.alivePlayerIds.includes(act.secondTargetId));
  }
});

test("奇術師は入れ替える相手が1人しか居なければ行動しない", () => {
  const act = decideNightAction({ ...base, roleId: "magician", alivePlayerIds: ["p1", "p2"] });
  assert.equal(act, null);
});

test("人狼は仲間を襲撃しない", () => {
  for (const roleId of ["werewolf", "werewolf_child", "lone_wolf"]) {
    const act = decideNightAction({ ...base, roleId, team: "werewolf", allyIds: ["p2", "p3"] });
    assert.equal(act.kind, "attack");
    assert.ok(!["p2", "p3"].includes(act.targetId), `${roleId} が仲間を襲撃した`);
  }
});

test("騎士団は『人間』と確定した相手を優先して守る", () => {
  const act = decideNightAction({
    ...base, roleId: "knights",
    divineResults: [{ targetId: "p3", result: "human" }],
  });
  assert.equal(act.kind, "protect");
  assert.equal(act.targetId, "p3");
});

test("予言者は一度占った相手を占い直さない(既存仕様の確認)", () => {
  const act = decideNightAction({
    ...base, roleId: "prophet",
    divineResults: [{ targetId: "p2", result: "human" }, { targetId: "p3", result: "human" }],
  });
  assert.equal(act.targetId, "p4");
});

test("生存者が自分だけなら、どの役職も行動しない", () => {
  for (const roleId of rolesWithNightAction) {
    const act = decideNightAction({ ...base, roleId, alivePlayerIds: ["p1"] });
    assert.equal(act, null, `${roleId} が対象不在でも行動した`);
  }
});

test("同じ入力からは常に同じ行動が返る(決定論)", () => {
  for (const roleId of rolesWithNightAction) {
    const team = ROLE_DEFINITIONS[roleId].team;
    const first = decideNightAction({ ...base, roleId, team });
    const second = decideNightAction({ ...base, roleId, team });
    assert.deepEqual(second, first, `${roleId} の判断が揺れている`);
  }
});

test("logic が低くノイズが乗っても、返る対象は常に有効なまま", () => {
  for (const roleId of rolesWithNightAction) {
    const team = ROLE_DEFINITIONS[roleId].team;
    for (let seed = 1; seed <= 40; seed += 1) {
      const act = decideNightAction({ ...base, roleId, team, seed, personality: { logic: 0, aggression: 50 } });
      assert.ok(act, `${roleId} が seed=${seed} で行動しなかった`);
      assert.ok(base.alivePlayerIds.includes(act.targetId), `${roleId} が seed=${seed} で無効な対象を選んだ`);
      assert.notEqual(act.targetId, base.selfId);
      if (act.kind === "swap") assert.notEqual(act.secondTargetId, act.targetId);
    }
  }
});

test("NIGHT_ACTION_BY_ROLE はエンジンの役職定義と食い違わない", () => {
  for (const [roleId, kind] of Object.entries(NIGHT_ACTION_BY_ROLE)) {
    assert.ok(ROLE_DEFINITIONS[roleId], `未知の役職 ${roleId}`);
    assert.ok(ROLE_DEFINITIONS[roleId].actions.includes(kind), `${roleId} に ${kind} は許可されていない`);
  }
});
