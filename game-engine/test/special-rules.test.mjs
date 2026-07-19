import test from "node:test";
import assert from "node:assert/strict";
import { createGame, dispatch } from "../src/engine.mjs";

const names = ["A", "B", "C", "D", "E"];

function makePlayers(count) {
  return names.slice(0, count).map((displayName, index) => ({ id: `p${index + 1}`, displayName }));
}

function command(state, actorId, type, payload = {}) {
  return { id: `${state.revision + 1}-${actorId}-${type}`, actorId, type, payload,
    expectedRevision: state.revision, now: 4_000 + state.revision };
}

function nightState(roleIds) {
  const players = makePlayers(roleIds.length);
  let state = createGame({ gameId: "g-special", players, seed: 19, roleIds });
  ({ state } = dispatch(state, command(state, "p1", "START_GAME")));
  ({ state } = dispatch(state, command(state, "p1", "BEGIN_NIGHT")));
  return state;
}

test("タフガイは襲撃された夜には死亡せず、次の夜に死亡する", () => {
  let state = nightState(["tough_guy", "werewolf", "citizen", "citizen"]);
  const tough = Object.values(state.players).find((player) => player.roleId === "tough_guy");
  const wolf = Object.values(state.players).find((player) => player.roleId === "werewolf");
  ({ state } = dispatch(state, command(state, wolf.id, "SUBMIT_NIGHT_ACTION",
    { kind: "attack", targetId: tough.id })));
  ({ state } = dispatch(state, command(state, "p1", "RESOLVE_NIGHT")));
  assert.equal(state.players[tough.id].alive, true);
  assert.equal(state.players[tough.id].flags.injured, true);
  ({ state } = dispatch(state, command(state, "p1", "BEGIN_NIGHT")));
  ({ state } = dispatch(state, command(state, "p1", "RESOLVE_NIGHT")));
  assert.equal(state.players[tough.id].alive, false);
});

test("妖狐は予言者に占われると呪殺される", () => {
  let state = nightState(["mysterious_fox", "prophet", "werewolf", "citizen"]);
  const fox = Object.values(state.players).find((player) => player.roleId === "mysterious_fox");
  const prophet = Object.values(state.players).find((player) => player.roleId === "prophet");
  ({ state } = dispatch(state, command(state, prophet.id, "SUBMIT_NIGHT_ACTION",
    { kind: "divine", targetId: fox.id })));
  ({ state } = dispatch(state, command(state, "p1", "RESOLVE_NIGHT")));
  assert.equal(state.players[fox.id].alive, false);
  assert.equal(state.players[fox.id].death.cause, "prophet_curse");
});

test("恋人は片方が死亡するともう片方も死亡する", () => {
  let state = nightState(["lovers", "lovers", "werewolf", "citizen"]);
  const lovers = Object.values(state.players).filter((player) => player.roleId === "lovers");
  const wolf = Object.values(state.players).find((player) => player.roleId === "werewolf");
  ({ state } = dispatch(state, command(state, wolf.id, "SUBMIT_NIGHT_ACTION",
    { kind: "attack", targetId: lovers[0].id })));
  ({ state } = dispatch(state, command(state, "p1", "RESOLVE_NIGHT")));
  assert.equal(state.players[lovers[0].id].alive, false);
  assert.equal(state.players[lovers[1].id].alive, false);
  assert.equal(state.players[lovers[1].id].death.cause, "lover_grief");
});

test("独裁者は正体を公開して一度だけ処刑対象を決められる", () => {
  let state = nightState(["dictator", "werewolf", "citizen", "citizen"]);
  const dictator = Object.values(state.players).find((player) => player.roleId === "dictator");
  const wolf = Object.values(state.players).find((player) => player.roleId === "werewolf");
  ({ state } = dispatch(state, command(state, "p1", "RESOLVE_NIGHT")));
  ({ state } = dispatch(state, command(state, "p1", "START_VOTE")));
  ({ state } = dispatch(state, command(state, "p1", "REVEAL_DICTATOR", { targetId: wolf.id })));
  assert.equal(state.players[dictator.id].flags.dictatorRevealed, true);
  assert.equal(state.players[wolf.id].alive, false);
  assert.deepEqual(state.winner.teams, ["citizen"]);
  assert.throws(() => dispatch(state, command(state, dictator.id, "REVEAL_DICTATOR",
    { targetId: "p3" })), /finished|once|phase/i);
});

test("アンドロイドだけが最後に生き残ると単独勝利する", () => {
  let state = nightState(["android", "citizen"]);
  const android = Object.values(state.players).find((player) => player.roleId === "android");
  const citizen = Object.values(state.players).find((player) => player.roleId === "citizen");
  ({ state } = dispatch(state, command(state, "p1", "RESOLVE_NIGHT")));
  ({ state } = dispatch(state, command(state, "p1", "START_VOTE")));
  ({ state } = dispatch(state, command(state, android.id, "CAST_VOTE", { targetId: citizen.id })));
  ({ state } = dispatch(state, command(state, citizen.id, "CAST_VOTE", { targetId: null })));
  ({ state } = dispatch(state, command(state, "p1", "RESOLVE_VOTE")));
  assert.deepEqual(state.winner.teams, ["android"]);
});
