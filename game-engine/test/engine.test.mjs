import test from "node:test";
import assert from "node:assert/strict";
import { createGame, dispatch, toPublicView, toPlayerView } from "../src/engine.mjs";

const players = [
  { id: "p1", displayName: "A" },
  { id: "p2", displayName: "B" },
  { id: "p3", displayName: "C" },
  { id: "p4", displayName: "D" },
  { id: "p5", displayName: "E" },
  { id: "p6", displayName: "F" },
];

function command(state, actorId, type, payload = {}) {
  return {
    id: `${state.revision + 1}-${actorId}-${type}`,
    actorId,
    type,
    payload,
    expectedRevision: state.revision,
    now: 1_000 + state.revision,
  };
}

const roleIds = ["citizen", "werewolf", "prophet", "knights", "necromancer", "twins"];

test("同じseedと役職束は同じ役職配布になる", () => {
  const a = createGame({ gameId: "g1", players, seed: 42, roleIds });
  const b = createGame({ gameId: "g1", players, seed: 42, roleIds });
  assert.deepEqual(a.players, b.players);
});

test("ゲーム開始から夜行動、襲撃、防御、朝まで進められる", () => {
  let state = createGame({ gameId: "g1", players, seed: 42, roleIds });
  ({ state } = dispatch(state, command(state, "p1", "START_GAME")));
  assert.equal(state.phase, "role_reveal");
  ({ state } = dispatch(state, command(state, "p1", "BEGIN_NIGHT")));
  assert.equal(state.phase, "night");

  const wolf = Object.values(state.players).find((p) => p.roleId === "werewolf");
  const guard = Object.values(state.players).find((p) => p.roleId === "knights");
  const target = Object.values(state.players).find((p) => p.id !== wolf.id && p.id !== guard.id);
  ({ state } = dispatch(state, command(state, wolf.id, "SUBMIT_NIGHT_ACTION", {
    kind: "attack", targetId: target.id,
  })));
  ({ state } = dispatch(state, command(state, guard.id, "SUBMIT_NIGHT_ACTION", {
    kind: "protect", targetId: target.id,
  })));
  ({ state } = dispatch(state, command(state, "p1", "RESOLVE_NIGHT")));
  assert.equal(state.phase, "day");
  assert.equal(state.players[target.id].alive, true);
});

test("秘密ビューは自分の役職を含むが他人の役職を漏らさない", () => {
  const state = createGame({ gameId: "g1", players, seed: 42, roleIds });
  const view = toPlayerView(state, "p1");
  assert.equal(view.self.roleId, state.players.p1.roleId);
  assert.equal(view.players.p2.roleId, undefined);
  assert.equal(toPublicView(state).players.p1.roleId, undefined);
});

test("共有者と人狼は自分に許可された仲間情報だけを受け取る", () => {
  const twinState = createGame({ gameId: "g-twin", players, seed: 1,
    roleIds: ["twins", "twins", "citizen", "citizen", "citizen", "citizen"] });
  const twin = Object.values(twinState.players).find((player) => player.roleId === "twins");
  const twinView = toPlayerView(twinState, twin.id);
  assert.equal(twinView.self.allies.length, 1);
  assert.equal(twinView.self.allies[0].roleId, "twins");

  const wolfState = createGame({ gameId: "g-wolf", players, seed: 1,
    roleIds: ["werewolf", "werewolf", "citizen", "citizen", "traitor", "citizen"] });
  const wolf = Object.values(wolfState.players).find((player) => player.roleId === "werewolf");
  const wolfView = toPlayerView(wolfState, wolf.id);
  assert.equal(wolfView.self.allies.some((ally) => ally.roleId === "werewolf"), true);
  assert.equal(wolfView.self.allies.some((ally) => ally.roleId === "citizen"), false);
});

test("古いrevisionのコマンドは状態を変更しない", () => {
  const state = createGame({ gameId: "g1", players, seed: 42, roleIds });
  assert.throws(() => dispatch(state, {
    id: "x", actorId: "p1", type: "START_GAME", payload: {}, expectedRevision: 99, now: 1_000,
  }), /revision/i);
});
