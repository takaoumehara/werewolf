import test from "node:test";
import assert from "node:assert/strict";
import { createGame, dispatch } from "../src/engine.mjs";

const players = [
  { id: "p1", displayName: "A" }, { id: "p2", displayName: "B" },
  { id: "p3", displayName: "C" }, { id: "p4", displayName: "D" },
  { id: "p5", displayName: "E" }, { id: "p6", displayName: "F" },
];
const roleIds = ["citizen", "werewolf", "prophet", "knights", "necromancer", "twins"];

function command(state, actorId, type, payload = {}) {
  return { id: `${state.revision + 1}-${actorId}-${type}`, actorId, type, payload,
    expectedRevision: state.revision, now: 2_000 + state.revision };
}

function startedNight() {
  let state = createGame({ gameId: "g1", players, seed: 42, roleIds });
  ({ state } = dispatch(state, command(state, "p1", "START_GAME")));
  ({ state } = dispatch(state, command(state, "p1", "BEGIN_NIGHT")));
  return state;
}

test("予言者の占い結果は本人の秘密結果にだけ保存される", () => {
  let state = startedNight();
  const prophet = Object.values(state.players).find((player) => player.roleId === "prophet");
  const wolf = Object.values(state.players).find((player) => player.roleId === "werewolf");
  ({ state } = dispatch(state, command(state, prophet.id, "SUBMIT_NIGHT_ACTION",
    { kind: "divine", targetId: wolf.id })));
  ({ state } = dispatch(state, command(state, "p1", "RESOLVE_NIGHT")));
  assert.deepEqual(state.roleState.privateResults[prophet.id], [
    { type: "divine", targetId: wolf.id, result: "werewolf" },
  ]);
  assert.equal(state.history.some((entry) => entry.payload?.playerId === prophet.id && entry.type === "PRIVATE_RESULT"), true);
});

test("無能力の役職は夜行動を提出できない", () => {
  const state = startedNight();
  const citizen = Object.values(state.players).find((player) => player.roleId === "citizen");
  assert.throws(() => dispatch(state, command(state, citizen.id, "SUBMIT_NIGHT_ACTION",
    { kind: "attack", targetId: "p2" })), /cannot perform/i);
});
