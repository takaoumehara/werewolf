import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCommandOnce,
  buildPersistencePatch,
  createCommandEnvelope,
} from "../src/firebase-adapter-contract.mjs";

test("createCommandEnvelope は保存可能なコマンド契約を検証して返す", () => {
  const command = createCommandEnvelope({
    id: "cmd-1",
    actorId: "player-1",
    type: "START_GAME",
    payload: { source: "mobile" },
    expectedRevision: 0,
    now: 1_700_000_000_000,
  });

  assert.deepEqual(command, {
    id: "cmd-1",
    actorId: "player-1",
    type: "START_GAME",
    payload: { source: "mobile" },
    expectedRevision: 0,
    now: 1_700_000_000_000,
  });
});

test("createCommandEnvelope は必須値とrevision・時刻を検証する", () => {
  const invalidCommands = [
    {},
    { id: "", actorId: "p1", type: "X", expectedRevision: 0, now: 1 },
    { id: "c", actorId: "", type: "X", expectedRevision: 0, now: 1 },
    { id: "c", actorId: "p1", type: "", expectedRevision: 0, now: 1 },
    { id: "c", actorId: "p1", type: "X", expectedRevision: -1, now: 1 },
    { id: "c", actorId: "p1", type: "X", expectedRevision: 0.5, now: 1 },
    { id: "c", actorId: "p1", type: "X", expectedRevision: 0, now: 1.5 },
  ];

  for (const input of invalidCommands) {
    assert.throws(() => createCommandEnvelope(input), /command|id|actor|type|revision|now/i);
  }

  assert.deepEqual(createCommandEnvelope({
    id: "c", actorId: "p1", type: "X", expectedRevision: 0, now: 1,
  }).payload, {});
  assert.equal(createCommandEnvelope({
    id: "c-zero", actorId: "p1", type: "X", expectedRevision: 0, now: 0,
  }).now, 0);
  assert.throws(() => createCommandEnvelope({
    id: "c", actorId: "p1", type: "X", expectedRevision: 0, now: 1, payload: null,
  }), /payload/i);
});

test("applyCommandOnce は同じcommandIdを二度適用せず、同じ結果を返す", () => {
  const initialState = { revision: 0, count: 0 };
  const command = createCommandEnvelope({
    id: "cmd-once", actorId: "p1", type: "INCREMENT", payload: { amount: 1 },
    expectedRevision: 0, now: 1,
  });
  const dispatch = (state, receivedCommand) => ({
    state: { ...state, revision: state.revision + 1, count: state.count + receivedCommand.payload.amount },
    events: [{ id: "event-1", type: "INCREMENTED", payload: { amount: 1 }, at: receivedCommand.now }],
  });
  const processedCommands = new Map();

  const first = applyCommandOnce({ state: initialState, command, dispatch, processedCommands });
  const second = applyCommandOnce({ state: first.state, command, dispatch, processedCommands });

  assert.equal(first.state.count, 1);
  assert.equal(second.state.count, 1);
  assert.deepEqual(second, first);
  assert.equal(processedCommands.size, 1);
});

test("applyCommandOnce は処理済みIDの結果をMap・オブジェクトのどちらからも復元できる", () => {
  const state = { revision: 2, phase: "day" };
  const command = createCommandEnvelope({
    id: "cmd-replay", actorId: "p1", type: "NOOP", payload: {}, expectedRevision: 2, now: 3,
  });
  const result = { state: { ...state, revision: 3 }, events: [] };
  let calls = 0;
  const dispatch = () => {
    calls += 1;
    return result;
  };

  const objectProcessed = { "cmd-replay": result };
  assert.deepEqual(applyCommandOnce({ state, command, dispatch, processedCommands: objectProcessed }), result);
  assert.equal(calls, 0);

  const setProcessed = new Set(["cmd-replay"]);
  assert.throws(() => applyCommandOnce({ state, command, dispatch, processedCommands: setProcessed }), /result|processed/i);
});

test("buildPersistencePatch は公開・個人・完全状態・イベントを分離する", () => {
  const state = {
    gameId: "room-1",
    revision: 4,
    phase: "night",
    players: {
      p1: { id: "p1", roleId: "werewolf", alive: true },
      p2: { id: "p2", roleId: "citizen", alive: true },
    },
    roleState: { secret: "must-not-be-public" },
  };
  const events = [{ id: "4:TEST", type: "TEST", payload: {}, at: 4 }];
  const patch = buildPersistencePatch({
    state,
    events,
    toPublicView: (current) => ({ gameId: current.gameId, revision: current.revision, phase: current.phase }),
    toPlayerView: (current, playerId) => ({ playerId, roleId: current.players[playerId].roleId }),
  });

  assert.deepEqual(patch.public, { gameId: "room-1", revision: 4, phase: "night" });
  assert.deepEqual(patch.privateViews, {
    p1: { playerId: "p1", roleId: "werewolf" },
    p2: { playerId: "p2", roleId: "citizen" },
  });
  assert.deepEqual(patch.authoritative, state);
  assert.deepEqual(patch.events, events);
  assert.equal(patch.public.players, undefined);
  assert.equal(JSON.stringify(patch.public).includes("werewolf"), false);
  assert.notStrictEqual(patch.authoritative, state);
  assert.notStrictEqual(patch.events, events);
});

test("buildPersistencePatch はview関数やstate/eventsの不正入力を拒否する", () => {
  const state = { gameId: "room-1", revision: 0, players: {} };
  const view = () => ({});
  assert.throws(() => buildPersistencePatch({ state: null, events: [], toPublicView: view, toPlayerView: view }), /state/i);
  assert.throws(() => buildPersistencePatch({ state, events: null, toPublicView: view, toPlayerView: view }), /events/i);
  assert.throws(() => buildPersistencePatch({ state, events: [], toPublicView: null, toPlayerView: view }), /public|view/i);
  assert.throws(() => buildPersistencePatch({ state, events: [], toPublicView: view, toPlayerView: null }), /player|view/i);
});

test("buildPersistencePatch のpublicEventsは秘密のイベントpayloadを含めない", () => {
  const state = {
    gameId: "room-1", revision: 2, phase: "day",
    players: { p1: { id: "p1", roleId: "prophet", alive: true } },
  };
  const events = [
    { id: "2:1:NIGHT_ACTION_SUBMITTED", type: "NIGHT_ACTION_SUBMITTED",
      payload: { playerId: "p1", kind: "divine", targetId: "secret-target" }, at: 2 },
    { id: "2:2:PLAYER_DIED", type: "PLAYER_DIED",
      payload: { playerId: "p1", cause: "lover_grief" }, at: 2 },
  ];
  const patch = buildPersistencePatch({
    state, events, toPublicView: () => ({}), toPlayerView: () => ({}),
  });
  assert.equal(patch.events[0].payload.targetId, "secret-target");
  assert.equal(patch.publicEvents[0].payload.targetId, undefined);
  assert.equal(patch.publicEvents[0].payload.kind, undefined);
  assert.equal(patch.publicEvents[1].payload.cause, "other");
});

test("DAY_STARTEDのpublic eventは夜襲対象と防御結果を漏らさない", () => {
  const state = {
    gameId: "room-1", revision: 3, phase: "day",
    players: { p1: { id: "p1", roleId: "werewolf", alive: true } },
  };
  const events = [{
    id: "3:1:DAY_STARTED", type: "DAY_STARTED",
    payload: { round: 1, attack: { targetId: "secret-target", protected: true } }, at: 3,
  }];

  const patch = buildPersistencePatch({
    state, events, toPublicView: () => ({}), toPlayerView: () => ({}),
  });

  assert.deepEqual(patch.publicEvents[0].payload, { round: 1 });
  assert.equal(JSON.stringify(patch.publicEvents[0]).includes("secret-target"), false);
  assert.equal(JSON.stringify(patch.publicEvents[0]).includes("protected"), false);
  assert.deepEqual(patch.events[0].payload.attack, {
    targetId: "secret-target", protected: true,
  });
});
