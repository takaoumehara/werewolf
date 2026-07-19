import test from "node:test";
import assert from "node:assert/strict";
import { startGameSession, applyGameSessionCommand } from "../src/game-session-service.mjs";

const players = {
  p1: { id: "p1", name: "A" }, p2: { id: "p2", name: "B" },
  p3: { id: "p3", name: "C" }, p4: { id: "p4", name: "D" },
};

function startDefaultGame() {
  return startGameSession({
    roomId: "r1", callerUid: "p1", roomMeta: { hostId: "p1", status: "waiting" },
    players, roleIds: ["citizen", "citizen", "citizen", "werewolf"],
    gmMode: "computer", seed: 7, now: 100,
  });
}

function assertNoUndefined(value, path = "game") {
  assert.notEqual(value, undefined, `${path} must not be undefined`);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoUndefined(entry, `${path}[${index}]`));
  } else if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      assertNoUndefined(entry, `${path}.${key}`);
    }
  }
}

test("hostだけがgame sessionを開始できる", () => {
  assert.throws(() => startGameSession({
    roomId: "r1", callerUid: "p2", roomMeta: { hostId: "p1", status: "waiting" },
    players, roleIds: ["citizen", "citizen", "citizen", "werewolf"],
    gmMode: "computer", seed: 7, now: 100,
  }), /host/i);
});

test("waiting以外のroomとrole数不一致を拒否する", () => {
  const input = {
    roomId: "r1", callerUid: "p1", players,
    roleIds: ["citizen", "citizen", "citizen", "werewolf"],
    gmMode: "computer", seed: 7, now: 100,
  };
  assert.throws(() => startGameSession({
    ...input, roomMeta: { hostId: "p1", status: "playing" },
  }), /waiting/i);
  assert.throws(() => startGameSession({
    ...input, roomMeta: { hostId: "p1", status: "waiting" },
    roleIds: ["citizen", "citizen", "werewolf"],
  }), /role|player|match/i);
});

test("公開patchへ役職を漏らさず本人viewへだけ保存する", () => {
  const game = startGameSession({
    roomId: "r1", callerUid: "p1", roomMeta: { hostId: "p1", status: "waiting" },
    players, roleIds: ["citizen", "citizen", "citizen", "werewolf"],
    gmMode: "computer", seed: 7, now: 100,
  });
  assert.equal(JSON.stringify(game.public).includes("werewolf"), false);
  assert.equal(JSON.stringify(game.publicEvents).includes("werewolf"), false);
  assert.equal(typeof game.privateViews.p1.self.roleId, "string");
});

test("memberでないcallerと不正command IDと古いrevisionを拒否する", () => {
  const started = startGameSession({
    roomId: "r1", callerUid: "p1", roomMeta: { hostId: "p1", status: "waiting" },
    players, roleIds: ["citizen", "citizen", "citizen", "werewolf"],
    gmMode: "computer", seed: 7, now: 100,
  });
  const baseRequest = { commandId: "c1", type: "BEGIN_NIGHT", payload: {},
    expectedRevision: started.authoritative.revision };
  assert.throws(() => applyGameSessionCommand({
    game: started, callerUid: "outsider", request: baseRequest, now: 101,
  }), /member/i);
  assert.throws(() => applyGameSessionCommand({
    game: started, callerUid: "p1", request: { ...baseRequest, commandId: "bad.id" }, now: 101,
  }), /command ID/i);
  assert.throws(() => applyGameSessionCommand({
    game: started, callerUid: "p1",
    request: { ...baseRequest, expectedRevision: started.authoritative.revision - 1 }, now: 101,
  }), /revision/i);
});

test("同じcommand idは一度だけ適用される", () => {
  const started = startGameSession({
    roomId: "r1", callerUid: "p1", roomMeta: { hostId: "p1", status: "waiting" },
    players, roleIds: ["citizen", "citizen", "citizen", "werewolf"],
    gmMode: "computer", seed: 7, now: 100,
  });
  const request = { commandId: "c1", type: "BEGIN_NIGHT", payload: {},
    expectedRevision: started.authoritative.revision };
  const first = applyGameSessionCommand({ game: started, callerUid: "p1", request, now: 101 });
  const second = applyGameSessionCommand({ game: first.game, callerUid: "p1", request, now: 102 });
  assert.equal(second.game.authoritative.revision, first.game.authoritative.revision);
  assert.deepEqual(second.commandResult, first.commandResult);
  assert.deepEqual(first.game.processedCommands.c1, first.commandResult);
  assert.deepEqual(Object.keys(first.game.processedCommands.c1).sort(), ["phase", "revision"]);
  assert.equal(second.duplicate, true);
});

test("後続command後に古いcommandを再送しても現在状態を巻き戻さない", () => {
  const started = startGameSession({
    roomId: "r1", callerUid: "p1", roomMeta: { hostId: "p1", status: "waiting" },
    players, roleIds: ["citizen", "citizen", "citizen", "werewolf"],
    gmMode: "computer", seed: 7, now: 100,
  });
  const firstRequest = { commandId: "c1", type: "BEGIN_NIGHT", payload: {},
    expectedRevision: started.authoritative.revision };
  const first = applyGameSessionCommand({
    game: started, callerUid: "p1", request: firstRequest, now: 101,
  });
  const advanced = applyGameSessionCommand({
    game: first.game, callerUid: "p1",
    request: { commandId: "c2", type: "RESOLVE_NIGHT", payload: {},
      expectedRevision: first.game.authoritative.revision },
    now: 102,
  });
  const retry = applyGameSessionCommand({
    game: advanced.game, callerUid: "p1", request: firstRequest, now: 103,
  });
  assert.equal(retry.game.authoritative.revision, advanced.game.authoritative.revision);
  assert.equal(retry.game.public.phase, advanced.game.public.phase);
  assert.deepEqual(retry.commandResult, first.commandResult);
  assert.equal(retry.duplicate, true);
});

test("start直後とpending night actionを含むgameは再帰的にundefinedを含まない", () => {
  const started = startDefaultGame();
  assertNoUndefined(started);

  const night = applyGameSessionCommand({
    game: started, callerUid: "p1",
    request: { commandId: "json-night", type: "BEGIN_NIGHT", payload: {},
      expectedRevision: started.authoritative.revision },
    now: 101,
  });
  const werewolfId = Object.values(night.game.privateViews)
    .find((view) => view.self.roleId === "werewolf").self.id;
  const targetId = Object.keys(players).find((id) => id !== werewolfId);
  const pending = applyGameSessionCommand({
    game: night.game, callerUid: werewolfId,
    request: { commandId: "json-action", type: "SUBMIT_NIGHT_ACTION",
      payload: { kind: "attack", targetId },
      expectedRevision: night.game.authoritative.revision },
    now: 102,
  });

  assertNoUndefined(pending.game);
  assert.equal(Object.hasOwn(pending.game.authoritative.pendingActions[werewolfId], "secondTargetId"), false);
});

test("保存境界はundefinedをJSON互換値へ正規化し入力を変更しない", () => {
  const started = startDefaultGame();
  const first = applyGameSessionCommand({
    game: started, callerUid: "p1",
    request: { commandId: "json-retry", type: "BEGIN_NIGHT", payload: {},
      expectedRevision: started.authoritative.revision },
    now: 101,
  });
  const replayInput = structuredClone(first.game);
  replayInput.metadata = { omitted: undefined, values: ["kept", undefined] };

  const retry = applyGameSessionCommand({
    game: replayInput, callerUid: "p1",
    request: { commandId: "json-retry", type: "BEGIN_NIGHT", payload: {},
      expectedRevision: started.authoritative.revision },
    now: 102,
  });

  assert.equal(Object.hasOwn(retry.game.metadata, "omitted"), false);
  assert.deepEqual(retry.game.metadata.values, ["kept", null]);
  assert.equal(Object.hasOwn(replayInput.metadata, "omitted"), true);
  assert.equal(replayInput.metadata.values[1], undefined);
  assertNoUndefined(retry.game);
});

test("保存境界は非有限numberと非対応型を明示的に拒否する", () => {
  const started = startDefaultGame();
  const first = applyGameSessionCommand({
    game: started, callerUid: "p1",
    request: { commandId: "bad-json", type: "BEGIN_NIGHT", payload: {},
      expectedRevision: started.authoritative.revision },
    now: 101,
  });
  const request = { commandId: "bad-json", type: "BEGIN_NIGHT", payload: {},
    expectedRevision: started.authoritative.revision };

  for (const unsupported of [Number.NaN, Number.POSITIVE_INFINITY, 1n, new Date(0)]) {
    const replayInput = structuredClone(first.game);
    replayInput.unsupported = unsupported;
    assert.throws(
      () => applyGameSessionCommand({ game: replayInput, callerUid: "p1", request, now: 102 }),
      /JSON-compatible/i,
    );
    assert.strictEqual(replayInput.unsupported, unsupported);
  }
});

test("eventsとpublicEventsはevent ID recordへ追記し既存logを変更しない", () => {
  const started = startDefaultGame();
  const startEvents = structuredClone(started.events);
  const startPublicEvents = structuredClone(started.publicEvents);
  const startEventIds = Object.keys(started.events);
  const night = applyGameSessionCommand({
    game: started, callerUid: "p1",
    request: { commandId: "log-night", type: "BEGIN_NIGHT", payload: {},
      expectedRevision: started.authoritative.revision },
    now: 101,
  });
  const day = applyGameSessionCommand({
    game: night.game, callerUid: "p1",
    request: { commandId: "log-day", type: "RESOLVE_NIGHT", payload: {},
      expectedRevision: night.game.authoritative.revision },
    now: 102,
  });

  assert.equal(Array.isArray(day.game.events), false);
  assert.equal(Array.isArray(day.game.publicEvents), false);
  for (const eventId of startEventIds) {
    assert.deepEqual(day.game.events[eventId], started.events[eventId]);
    assert.deepEqual(day.game.publicEvents[eventId], started.publicEvents[eventId]);
  }
  assert.equal(Object.keys(day.game.events).length > startEventIds.length, true);
  assert.equal(Object.keys(day.game.events).length, new Set(Object.keys(day.game.events)).size);
  for (const eventId of Object.keys(day.game.events)) {
    assert.doesNotMatch(eventId, /[.#$\[\]\/\u0000-\u001f\u007f]/u);
    assert.equal(day.game.events[eventId].id, eventId);
  }
  assert.deepEqual(started.events, startEvents);
  assert.deepEqual(started.publicEvents, startPublicEvents);
});

test("Firebase keyに使えないevent IDを拒否して入力logを変更しない", () => {
  for (const eventId of ["bad/id", "x".repeat(769)]) {
    const started = startDefaultGame();
    started.events[eventId] = { id: eventId, type: "TEST", payload: {}, at: 100 };
    const snapshot = structuredClone(started.events);

    assert.throws(() => applyGameSessionCommand({
      game: started, callerUid: "p1",
      request: { commandId: "unsafe-event", type: "BEGIN_NIGHT", payload: {},
        expectedRevision: started.authoritative.revision },
      now: 101,
    }), /event ID/i);
    assert.deepEqual(started.events, snapshot);
  }
});

test("prototype由来のUIDをgame memberとして扱わない", () => {
  const started = startDefaultGame();
  const request = { commandId: "prototype-member", type: "BEGIN_NIGHT", payload: {},
    expectedRevision: started.authoritative.revision };

  for (const callerUid of ["toString", "constructor"]) {
    assert.throws(
      () => applyGameSessionCommand({ game: started, callerUid, request, now: 101 }),
      /member/i,
    );
  }
});

test("duplicate応答と全receiptをcompact化しlegacy payloadを再保存しない", () => {
  const started = startDefaultGame();
  const first = applyGameSessionCommand({
    game: started, callerUid: "p1",
    request: { commandId: "legacy-retry", type: "BEGIN_NIGHT", payload: {},
      expectedRevision: started.authoritative.revision },
    now: 101,
  });
  const replayInput = structuredClone(first.game);
  replayInput.processedCommands["legacy-retry"] = {
    ...first.commandResult, state: { secret: "full-state" }, events: [{ secret: "full-event" }],
  };
  replayInput.processedCommands.other = {
    revision: 99, phase: "legacy", authoritative: { secret: "other-state" },
  };

  const retry = applyGameSessionCommand({
    game: replayInput, callerUid: "p1",
    request: { commandId: "legacy-retry", type: "BEGIN_NIGHT", payload: {},
      expectedRevision: started.authoritative.revision },
    now: 102,
  });

  assert.deepEqual(retry.commandResult, first.commandResult);
  assert.deepEqual(retry.game.processedCommands, {
    "legacy-retry": first.commandResult,
    other: { revision: 99, phase: "legacy" },
  });
  assert.equal(JSON.stringify(retry.game.processedCommands).includes("full-state"), false);
  assert.equal(JSON.stringify(retry.game.processedCommands).includes("full-event"), false);
  assert.equal(replayInput.processedCommands["legacy-retry"].state.secret, "full-state");
});

test("attack解決後も公開event logへ夜襲対象を漏らさない", () => {
  const started = startDefaultGame();
  const night = applyGameSessionCommand({
    game: started, callerUid: "p1",
    request: { commandId: "attack-night", type: "BEGIN_NIGHT", payload: {},
      expectedRevision: started.authoritative.revision },
    now: 101,
  });
  const werewolfId = Object.values(night.game.privateViews)
    .find((view) => view.self.roleId === "werewolf").self.id;
  const targetId = Object.keys(players).find((id) => id !== werewolfId);
  const action = applyGameSessionCommand({
    game: night.game, callerUid: werewolfId,
    request: { commandId: "attack-action", type: "SUBMIT_NIGHT_ACTION",
      payload: { kind: "attack", targetId },
      expectedRevision: night.game.authoritative.revision },
    now: 102,
  });
  const resolved = applyGameSessionCommand({
    game: action.game, callerUid: "p1",
    request: { commandId: "attack-resolve", type: "RESOLVE_NIGHT", payload: {},
      expectedRevision: action.game.authoritative.revision },
    now: 103,
  });
  const serverDayEvent = Object.values(resolved.game.events)
    .find((event) => event.type === "DAY_STARTED");
  const publicDayEvent = Object.values(resolved.game.publicEvents)
    .find((event) => event.type === "DAY_STARTED");

  assert.equal(serverDayEvent.payload.attack.targetId, targetId);
  assert.equal(resolved.game.authoritative.lastAttack.targetId, targetId);
  assert.deepEqual(publicDayEvent.payload, { round: 1 });
  assert.equal(JSON.stringify(publicDayEvent).includes(targetId), false);
  assert.equal(JSON.stringify(resolved.game.publicEvents).includes("protected"), false);
});
