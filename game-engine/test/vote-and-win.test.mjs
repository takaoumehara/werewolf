import test from "node:test";
import assert from "node:assert/strict";
import { createGame, dispatch } from "../src/engine.mjs";

const players = [
  { id: "p1", displayName: "A" }, { id: "p2", displayName: "B" },
  { id: "p3", displayName: "C" }, { id: "p4", displayName: "D" },
];

function command(state, actorId, type, payload = {}) {
  return { id: `${state.revision + 1}-${actorId}-${type}`, actorId, type, payload,
    expectedRevision: state.revision, now: 3_000 + state.revision };
}

function atVote(roleIds) {
  let state = createGame({ gameId: "g1", players, seed: 7, roleIds });
  ({ state } = dispatch(state, command(state, "p1", "START_GAME")));
  ({ state } = dispatch(state, command(state, "p1", "BEGIN_NIGHT")));
  ({ state } = dispatch(state, command(state, "p1", "RESOLVE_NIGHT")));
  ({ state } = dispatch(state, command(state, "p1", "START_VOTE")));
  return state;
}

test("投票で人狼が処刑されると市民陣営が勝利する", () => {
  let state = atVote(["citizen", "citizen", "citizen", "werewolf"]);
  const wolf = Object.values(state.players).find((player) => player.roleId === "werewolf");
  for (const voter of Object.values(state.players).filter((player) => player.id !== wolf.id)) {
    ({ state } = dispatch(state, command(state, voter.id, "CAST_VOTE", { targetId: wolf.id })));
  }
  ({ state } = dispatch(state, command(state, "p1", "RESOLVE_VOTE")));
  assert.equal(state.players[wolf.id].alive, false);
  assert.deepEqual(state.winner.teams, ["citizen"]);
  assert.equal(state.phase, "finished");
});

test("同票では処刑されずゲームが継続する", () => {
  let state = atVote(["citizen", "citizen", "citizen", "werewolf"]);
  const alive = Object.values(state.players);
  const first = alive[0].id;
  const second = alive[1].id;
  ({ state } = dispatch(state, command(state, alive[0].id, "CAST_VOTE", { targetId: alive[1].id })));
  ({ state } = dispatch(state, command(state, alive[1].id, "CAST_VOTE", { targetId: alive[2].id })));
  ({ state } = dispatch(state, command(state, alive[2].id, "CAST_VOTE", { targetId: alive[1].id })));
  ({ state } = dispatch(state, command(state, alive[3].id, "CAST_VOTE", { targetId: alive[2].id })));
  ({ state } = dispatch(state, command(state, "p1", "RESOLVE_VOTE")));
  assert.equal(state.players[first].alive, true);
  assert.equal(state.players[second].alive, true);
  assert.equal(state.phase, "day");
  assert.equal(state.winner, null);
});

test("nullまたは省略した投票先はdurableな棄権として数え、誰も処刑しない", () => {
  let state = atVote(["citizen", "citizen", "citizen", "werewolf"]);
  ({ state } = dispatch(state, command(state, "p1", "CAST_VOTE", { targetId: null })));
  ({ state } = dispatch(state, command(state, "p2", "CAST_VOTE")));

  assert.equal(state.pendingVotes.p1, "");
  assert.equal(state.pendingVotes.p2, "");
  assert.equal(Object.keys(state.pendingVotes).length, 2);

  let events;
  ({ state, events } = dispatch(state, command(state, "p1", "RESOLVE_VOTE")));
  assert.equal(Object.values(state.players).every((player) => player.alive), true);
  assert.equal(state.phase, "day");
  assert.equal(state.winner, null);
  assert.deepEqual(events.find((event) => event.type === "VOTE_RESOLVED").payload,
    { executedPlayerId: null });
});
