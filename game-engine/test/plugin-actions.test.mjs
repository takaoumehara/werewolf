import test from "node:test";
import assert from "node:assert/strict";
import { createGame, dispatch } from "../src/engine.mjs";

const players = [
  { id: "p1", displayName: "A" }, { id: "p2", displayName: "B" },
  { id: "p3", displayName: "C" }, { id: "p4", displayName: "D" },
];

function command(state, actorId, type, payload = {}, now = 6_000 + state.revision) {
  return { id: `${state.revision + 1}-${actorId}-${type}`, actorId, type, payload,
    expectedRevision: state.revision, now };
}

function startedNight(roleIds, options = {}) {
  let state = createGame({ gameId: "g-plugin", players, seed: 1, roleIds, ...options });
  ({ state } = dispatch(state, command(state, state.hostId, "START_GAME")));
  ({ state } = dispatch(state, command(state, state.hostId, "BEGIN_NIGHT")));
  return state;
}

test("罠師の罠は同じ対象への人狼襲撃を相打ちにする", () => {
  let state = startedNight(["trapper", "werewolf", "citizen", "citizen"]);
  const trapper = Object.values(state.players).find((player) => player.roleId === "trapper");
  const wolf = Object.values(state.players).find((player) => player.roleId === "werewolf");
  const target = Object.values(state.players).find((player) => player.id !== trapper.id && player.id !== wolf.id);
  ({ state } = dispatch(state, command(state, trapper.id, "SUBMIT_NIGHT_ACTION",
    { kind: "trap", targetId: target.id })));
  ({ state } = dispatch(state, command(state, wolf.id, "SUBMIT_NIGHT_ACTION",
    { kind: "attack", targetId: target.id })));
  ({ state } = dispatch(state, command(state, state.hostId, "RESOLVE_NIGHT")));
  assert.equal(state.players[target.id].alive, false);
  assert.equal(state.players[wolf.id].alive, false);
  assert.equal(state.players[wolf.id].death.cause, "trap_counterattack");
});

test("奇術師の役職交換は対象二人の役職と陣営を交換する", () => {
  let state = startedNight(["magician", "werewolf", "citizen", "citizen"]);
  const magician = Object.values(state.players).find((player) => player.roleId === "magician");
  const wolf = Object.values(state.players).find((player) => player.roleId === "werewolf");
  const citizen = Object.values(state.players).find((player) => player.roleId === "citizen");
  ({ state } = dispatch(state, command(state, magician.id, "SUBMIT_NIGHT_ACTION",
    { kind: "swap", targetId: wolf.id, secondTargetId: citizen.id })));
  ({ state } = dispatch(state, command(state, state.hostId, "RESOLVE_NIGHT")));
  assert.equal(state.players[wolf.id].roleId, "citizen");
  assert.equal(state.players[citizen.id].roleId, "werewolf");
  assert.equal(state.players[citizen.id].team, "werewolf");
});

test("人間GMは期限後に夜を強制解決できる", () => {
  let state = startedNight(["citizen", "werewolf", "citizen", "citizen"], {
    gmMode: "human_observer", phaseDurations: { night: 10 },
  });
  assert.equal(state.phase, "night");
  ({ state } = dispatch(state, command(state, state.hostId, "FORCE_ADVANCE", {}, state.deadlineAt + 1)));
  assert.equal(state.phase, "day");
});
