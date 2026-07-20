import test from "node:test";
import assert from "node:assert/strict";
import { createGame, dispatch, toPublicView } from "../src/engine.mjs";

const players = [
  { id: "p1", displayName: "A" }, { id: "p2", displayName: "B" },
  { id: "p3", displayName: "C" }, { id: "p4", displayName: "D" },
];

function command(state, actorId, type, payload = {}) {
  return { id: `${state.revision + 1}-${actorId}-${type}`, actorId, type, payload,
    expectedRevision: state.revision, now: 5_000 + state.revision };
}

function startedNight(roleIds) {
  let state = createGame({ gameId: "g-invariant", players, seed: 23, roleIds });
  ({ state } = dispatch(state, command(state, "p1", "START_GAME")));
  ({ state } = dispatch(state, command(state, "p1", "BEGIN_NIGHT")));
  return state;
}

test("一つのdispatchが生成するイベントIDはすべて一意である", () => {
  let state = startedNight(["lovers", "lovers", "werewolf", "citizen"]);
  const lovers = Object.values(state.players).filter((player) => player.roleId === "lovers");
  const wolf = Object.values(state.players).find((player) => player.roleId === "werewolf");
  ({ state } = dispatch(state, command(state, wolf.id, "SUBMIT_NIGHT_ACTION",
    { kind: "attack", targetId: lovers[0].id })));
  const result = dispatch(state, command(state, "p1", "RESOLVE_NIGHT"));
  const ids = result.events.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("公開ビューは恋人連鎖や予言呪殺の内部死因を漏らさない", () => {
  let state = startedNight(["lovers", "lovers", "werewolf", "citizen"]);
  const lovers = Object.values(state.players).filter((player) => player.roleId === "lovers");
  const wolf = Object.values(state.players).find((player) => player.roleId === "werewolf");
  ({ state } = dispatch(state, command(state, wolf.id, "SUBMIT_NIGHT_ACTION",
    { kind: "attack", targetId: lovers[0].id })));
  ({ state } = dispatch(state, command(state, "p1", "RESOLVE_NIGHT")));
  const view = toPublicView(state);
  assert.notEqual(view.players[lovers[1].id].death?.cause, "lover_grief");
  assert.equal(view.players[lovers[1].id].death?.round, state.round);
});

test("ホストIDは作成時に固定され、別プレイヤーは進行できないが死亡ホストは進行を続けられる", () => {
  let state = createGame({ gameId: "g-host", players, hostId: "p2", seed: 1,
    roleIds: ["citizen", "werewolf", "citizen", "citizen"] });
  assert.throws(() => dispatch(state, command(state, "p1", "START_GAME")), /host/i);
  ({ state } = dispatch(state, command(state, "p2", "START_GAME")));
  ({ state } = dispatch(state, command(state, "p2", "BEGIN_NIGHT")));
  const wolf = Object.values(state.players).find((player) => player.roleId === "werewolf");
  ({ state } = dispatch(state, command(state, wolf.id, "SUBMIT_NIGHT_ACTION",
    { kind: "attack", targetId: "p2" })));
  ({ state } = dispatch(state, command(state, "p2", "RESOLVE_NIGHT")));
  assert.equal(state.players.p2.alive, false);
  // 死亡してもホスト(GM)は進行を続けられる必要がある(実対戦でホストが襲撃される想定)。
  ({ state } = dispatch(state, command(state, "p2", "START_VOTE")));
  assert.equal(state.phase, "vote");
});
