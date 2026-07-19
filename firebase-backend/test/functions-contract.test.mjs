import test from "node:test";
import assert from "node:assert/strict";

import {
  createFunctionHandlers,
  createCallableFunctions,
  createSnapRoom,
  joinSnapRoom,
  startWerewolfGame,
  dispatchWerewolfCommand,
} from "../src/functions.mjs";
import {
  RepositoryError,
  createFirebaseRoomRepository,
} from "../src/firebase-room-repository.mjs";
import { startGameSession, applyGameSessionCommand } from "../src/game-session-service.mjs";
import { FakeRtdb } from "./fake-rtdb.mjs";

const roles = ["citizen", "citizen", "citizen", "werewolf"];

function roomFixture(overrides = {}) {
  const players = Object.fromEntries(["p1", "p2", "p3", "p4"].map((id, index) => [id, {
    id, name: id.toUpperCase(), role: index === 0 ? "host" : "participant",
    connected: true, joinedAt: 10 + index, lastSeenAt: 10 + index,
  }]));
  return {
    meta: {
      hostId: "p1", status: "waiting", createdAt: 10, updatedAt: 10,
      participantCount: 4, maxPlayers: 4,
    },
    players,
    joinState: { count: 4, members: { p1: true, p2: true, p3: true, p4: true } },
    ...overrides,
  };
}

function pairingFixture(overrides = {}) {
  return {
    roomId: "room-1", hostId: "p1", createdAt: 10, expiresAt: 10_000,
    maxPlayers: 4, ...overrides,
  };
}

function sequenceRandom(values, fallback = 0) {
  const queue = values.slice();
  return () => queue.shift() ?? fallback;
}

function gameAtVote() {
  let game = startGameSession({
    roomId: "room-1", callerUid: "p1", roomMeta: roomFixture().meta,
    players: roomFixture().players, roleIds: roles, gmMode: "computer", seed: 7, now: 100,
  });
  for (const [commandId, type, now] of [
    ["to-night", "BEGIN_NIGHT", 101],
    ["to-day", "RESOLVE_NIGHT", 102],
    ["to-vote", "START_VOTE", 103],
  ]) {
    game = applyGameSessionCommand({
      game, callerUid: "p1",
      request: { commandId, type, payload: {}, expectedRevision: game.public.revision },
      now,
    }).game;
  }
  return game;
}

function assertCode(code) {
  return (error) => {
    assert.equal(error.code, code);
    return true;
  };
}

test("auth.uidをactorとしてcommand serviceへ渡す", async () => {
  const calls = [];
  const handlers = createFunctionHandlers({
    dispatchCommand: async (input) => {
      calls.push(input);
      return { revision: 2, phase: "night" };
    },
  });

  const response = await handlers.dispatchWerewolfCommand({
    auth: { uid: "server-uid" },
    data: {
      roomId: "room-1",
      actorId: "spoofed",
      commandId: "command-1",
      type: "CAST_VOTE",
      payload: { targetId: "player-2" },
      expectedRevision: 1,
    },
  });

  assert.deepEqual(response, { revision: 2, phase: "night" });
  assert.equal(calls[0].callerUid, "server-uid");
  assert.equal(calls[0].request.actorId, undefined);
});

test("4 callable exportはApp Checkを強制する", () => {
  const registrations = [];
  const handlers = {
    createSnapRoom() {}, joinSnapRoom() {}, startWerewolfGame() {}, dispatchWerewolfCommand() {},
  };
  const callables = createCallableFunctions({
    handlers,
    onCall(options, handler) {
      registrations.push({ options, handler });
      return handler;
    },
  });

  assert.deepEqual(Object.keys(callables).sort(), [
    "createSnapRoom", "dispatchWerewolfCommand", "joinSnapRoom", "startWerewolfGame",
  ]);
  assert.equal(registrations.length, 4);
  registrations.forEach(({ options }) => assert.equal(options.enforceAppCheck, true));
  for (const callable of [createSnapRoom, joinSnapRoom, startWerewolfGame, dispatchWerewolfCommand]) {
    assert.equal(typeof callable, "function");
  }
});

test("unauthenticatedとrepository errorを安定したHttpsError codeへ変換する", async () => {
  const unauthenticated = createFunctionHandlers({ createRoom: async () => ({}) });
  await assert.rejects(
    unauthenticated.createSnapRoom({ data: { name: "A", maxPlayers: 4 } }),
    assertCode("unauthenticated"),
  );

  const mapped = createFunctionHandlers({
    joinRoom: async () => { throw new RepositoryError("resource-exhausted", "Room is full"); },
  });
  await assert.rejects(
    mapped.joinSnapRoom({ auth: { uid: "p5" }, data: { code: "ABC234", name: "P5" } }),
    assertCode("resource-exhausted"),
  );
});

test("repositoryのvalidation・conflict・expired・full codeをHttpsErrorで維持する", async () => {
  for (const code of [
    "invalid-argument", "aborted", "deadline-exceeded", "resource-exhausted",
    "failed-precondition", "not-found", "permission-denied", "unavailable",
  ]) {
    const handlers = createFunctionHandlers({
      joinRoom: async () => { throw new RepositoryError(code, "stable error"); },
    });
    await assert.rejects(
      handlers.joinSnapRoom({ auth: { uid: "p5" }, data: { code: "ABC234", name: "P5" } }),
      assertCode(code),
    );
  }
});

test("RTDB key禁止文字を含むauth uidをhandler中央で拒否する", async () => {
  let called = false;
  const handlers = createFunctionHandlers({
    createRoom: async () => { called = true; return {}; },
  });

  for (const uid of ["a/b", "a.b", "a\u0001b"]) {
    await assert.rejects(handlers.createSnapRoom({
      auth: { uid }, data: { name: "A", maxPlayers: 4 },
    }), assertCode("unauthenticated"));
  }
  assert.equal(called, false);
});

test("repositoryもRTDB key禁止文字を含むcaller uidをpath構築前に拒否する", async () => {
  for (const callerUid of ["a/b", "a.b", "a\u0001b"]) {
    const database = new FakeRtdb();
    const repository = createFirebaseRoomRepository({
      database, now: () => 100, randomUUID: () => "room-new", randomInt: () => 0,
    });
    await assert.rejects(repository.createRoom({
      callerUid, input: { name: "A", maxPlayers: 4 },
    }), assertCode("invalid-argument"));
    assert.equal(database.transactionCalls.length, 0);
  }
});

test("callable境界でplain recordと入力サイズ・列挙値を検証する", async () => {
  const calls = [];
  const handlers = createFunctionHandlers({
    createRoom: async (value) => { calls.push(value); return {}; },
    joinRoom: async () => ({}),
    startGame: async () => ({}),
    dispatchCommand: async () => ({}),
  });
  const auth = { uid: "p1" };

  await handlers.createSnapRoom({ auth, data: { name: "  Alice  ", maxPlayers: 4 } });
  assert.deepEqual(calls[0].input, { name: "Alice", maxPlayers: 4 });

  const invalidCalls = [
    () => handlers.createSnapRoom({ auth, data: [] }),
    () => handlers.createSnapRoom({ auth, data: { name: "", maxPlayers: 4 } }),
    () => handlers.createSnapRoom({ auth, data: { name: "A", maxPlayers: 31 } }),
    () => handlers.joinSnapRoom({ auth, data: { code: "ABC", name: "A" } }),
    () => handlers.startWerewolfGame({ auth, data: {
      roomId: "bad/room", roleIds: roles, gmMode: "computer",
    } }),
    () => handlers.startWerewolfGame({ auth, data: {
      roomId: "room-1", roleIds: roles, gmMode: "robot",
    } }),
    () => handlers.dispatchWerewolfCommand({ auth, data: {
      roomId: "room-1", commandId: "bad.id", type: "CAST_VOTE",
      payload: {}, expectedRevision: 1,
    } }),
    () => handlers.dispatchWerewolfCommand({ auth, data: {
      roomId: "room-1", commandId: "c1", type: "lowercase",
      payload: {}, expectedRevision: 1,
    } }),
    () => handlers.dispatchWerewolfCommand({ auth, data: {
      roomId: "room-1", commandId: "c1", type: "CAST_VOTE",
      payload: new Date(), expectedRevision: 1,
    } }),
    () => handlers.dispatchWerewolfCommand({ auth, data: {
      roomId: "room-1", commandId: "c1", type: "CAST_VOTE",
      payload: {}, expectedRevision: -1,
    } }),
  ];
  for (const invoke of invalidCalls) await assert.rejects(invoke, assertCode("invalid-argument"));
});

test("payloadの特殊keyはprototypeを汚染せずown propertyのまま渡す", async () => {
  let received;
  const handlers = createFunctionHandlers({
    dispatchCommand: async (value) => { received = value; return { revision: 2, phase: "night" }; },
  });
  const payload = JSON.parse('{"__proto__":{"polluted":true}}');

  await handlers.dispatchWerewolfCommand({
    auth: { uid: "p1" },
    data: { roomId: "room-1", commandId: "c1", type: "CAST_VOTE", payload,
      expectedRevision: 1 },
  });

  assert.equal(Object.hasOwn(received.request.payload, "__proto__"), true);
  assert.equal(received.request.payload.__proto__.polluted, true);
  assert.equal({}.polluted, undefined);
});

test("省略payloadはTask 2のcommand契約どおり空recordへ正規化する", async () => {
  let received;
  const handlers = createFunctionHandlers({
    dispatchCommand: async (value) => { received = value; return { revision: 2, phase: "night" }; },
  });

  await handlers.dispatchWerewolfCommand({
    auth: { uid: "p1" },
    data: { roomId: "room-1", commandId: "c1", type: "BEGIN_NIGHT", expectedRevision: 1 },
  });

  assert.deepEqual(received.request.payload, {});
});

test("multibyteの大きなkeyを含むpayloadはJSON全体16KB制限で拒否する", async () => {
  let called = false;
  const handlers = createFunctionHandlers({
    dispatchCommand: async () => { called = true; return {}; },
  });
  const payload = Object.fromEntries(Array.from({ length: 128 }, (_, index) => [
    `界${index}${"界".repeat(98)}`,
    true,
  ]));

  await assert.rejects(handlers.dispatchWerewolfCommand({
    auth: { uid: "p1" },
    data: { roomId: "room-1", commandId: "large-keys", type: "CAST_VOTE", payload,
      expectedRevision: 1 },
  }), assertCode("invalid-argument"));
  assert.equal(called, false);
});

test("numeric・boolean・nullのhigh-fanout payloadはallocation capで拒否する", async () => {
  let called = false;
  const handlers = createFunctionHandlers({
    dispatchCommand: async () => { called = true; return {}; },
  });
  const row = Array.from({ length: 256 }, (_, index) => [index, true, null][index % 3]);
  const payload = { matrix: Array.from({ length: 256 }, () => row.slice()) };

  await assert.rejects(handlers.dispatchWerewolfCommand({
    auth: { uid: "p1" },
    data: { roomId: "room-1", commandId: "high-fanout", type: "CAST_VOTE", payload,
      expectedRevision: 1 },
  }), assertCode("invalid-argument"));
  assert.equal(called, false);
});

test("createはuid rate limitをtransactionしcode衝突を原子的に再試行する", async () => {
  const database = new FakeRtdb();
  database.retryTransaction("pairingCodes/AAAAAA", (state) => {
    state.pairingCodes = { AAAAAA: pairingFixture({ roomId: "other-room" }) };
  });
  const repository = createFirebaseRoomRepository({
    database, now: () => 100, randomUUID: () => "room-new",
    randomInt: sequenceRandom([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]),
    rateLimitMax: 1,
  });

  const created = await repository.createRoom({
    callerUid: "host", input: { name: "Host", maxPlayers: 4 },
  });

  assert.deepEqual(created, { roomId: "room-new", code: "BBBBBB", expiresAt: 300_100 });
  assert.equal(database.state.pairingCodes.AAAAAA.roomId, "other-room");
  assert.equal(database.state.pairingCodes.BBBBBB.roomId, "room-new");
  assert.equal(database.state.rooms["room-new"].joinState.count, 1);
  assert.deepEqual(database.transactionCalls.map(({ path }) => path), [
    "roomCreateRateLimits/host", "pairingCodes/AAAAAA", "pairingCodes/BBBBBB",
  ]);
  const collision = database.transactionCalls.find(({ path }) => path === "pairingCodes/AAAAAA");
  assert.equal(collision.attempts.length, 2);
  assert.equal(collision.attempts[0].proposal.roomId, "room-new");
  assert.equal(collision.attempts[1].proposal, undefined);

  await assert.rejects(
    repository.createRoom({ callerUid: "host", input: { name: "Host", maxPlayers: 4 } }),
    assertCode("resource-exhausted"),
  );
});

test("create失敗時は自分のreservationだけを条件付きcleanupする", async () => {
  const database = new FakeRtdb();
  database.failNextUpdate((state) => {
    state.pairingCodes.AAAAAA = pairingFixture({ roomId: "replacement" });
  });
  const repository = createFirebaseRoomRepository({
    database, now: () => 100, randomUUID: () => "room-new", randomInt: () => 0,
  });

  await assert.rejects(
    repository.createRoom({ callerUid: "host", input: { name: "Host", maxPlayers: 4 } }),
    assertCode("unavailable"),
  );
  assert.equal(database.state.pairingCodes.AAAAAA.roomId, "replacement");
  assert.equal(database.transactionCalls.at(-1).path, "pairingCodes/AAAAAA");
  assert.equal(database.transactionCalls.at(-1).attempts.at(-1).proposal, undefined);
});

test("createのroot update失敗時に自分がreserveしたcodeは削除する", async () => {
  const database = new FakeRtdb();
  database.failNextUpdate(() => {});
  const repository = createFirebaseRoomRepository({
    database, now: () => 100, randomUUID: () => "room-new", randomInt: () => 0,
  });

  await assert.rejects(
    repository.createRoom({ callerUid: "host", input: { name: "Host", maxPlayers: 4 } }),
    assertCode("unavailable"),
  );
  assert.equal(database.state.pairingCodes?.AAAAAA, undefined);
  assert.equal(database.state.rooms?.["room-new"], undefined);
  assert.equal(database.transactionCalls.at(-1).attempts.at(-1).proposal, null);
});

test("pairing reservationが競合上限まで続いたらroomを作らず明示失敗する", async () => {
  const database = new FakeRtdb({
    pairingCodes: { AAAAAA: pairingFixture({ roomId: "other-room" }) },
  });
  const repository = createFirebaseRoomRepository({
    database, now: () => 100, randomUUID: () => "room-new", randomInt: () => 0,
    pairingAttempts: 2,
  });

  await assert.rejects(
    repository.createRoom({ callerUid: "host", input: { name: "Host", maxPlayers: 4 } }),
    assertCode("resource-exhausted"),
  );
  assert.equal(database.state.rooms?.["room-new"], undefined);
  assert.equal(database.state.pairingCodes.AAAAAA.roomId, "other-room");
  assert.equal(database.transactionCalls.filter(({ path }) => path === "pairingCodes/AAAAAA").length, 2);
});

test("joinはroom transaction内でstatus・TTL・capacityを再検証する", async () => {
  for (const [room, pairing, expectedCode] of [
    [roomFixture({ meta: { ...roomFixture().meta, status: "finished" } }), pairingFixture(),
      "failed-precondition"],
    [roomFixture(), pairingFixture({ expiresAt: 99 }), "deadline-exceeded"],
    [roomFixture(), pairingFixture(), "resource-exhausted"],
  ]) {
    const database = new FakeRtdb({ rooms: { "room-1": room }, pairingCodes: { ABC234: pairing } });
    const repository = createFirebaseRoomRepository({ database, now: () => 100 });
    await assert.rejects(
      repository.joinRoom({ callerUid: "p5", input: { code: "ABC234", name: "P5" } }),
      assertCode(expectedCode),
    );
    assert.equal(database.updateCalls.length, 0);
  }
});

test("join transactionはretry時の満室化を検出する", async () => {
  const initialRoom = roomFixture({
    meta: { ...roomFixture().meta, participantCount: 3 },
    players: Object.fromEntries(Object.entries(roomFixture().players).slice(0, 3)),
    joinState: { count: 3, members: { p1: true, p2: true, p3: true } },
  });
  const database = new FakeRtdb({
    rooms: { "room-1": initialRoom }, pairingCodes: { ABC234: pairingFixture() },
  });
  database.retryTransaction("rooms/room-1", (state) => {
    state.rooms["room-1"] = roomFixture();
  });
  let clockReads = 0;
  const repository = createFirebaseRoomRepository({ database, now: () => { clockReads += 1; return 100; } });

  await assert.rejects(
    repository.joinRoom({ callerUid: "p5", input: { code: "ABC234", name: "P5" } }),
    assertCode("resource-exhausted"),
  );
  assert.equal(clockReads, 1);
  assert.equal(database.updateCalls.length, 0);
});

test("同じuidのrejoinはcountを増やさずplayerとroomMembersを修復する", async () => {
  const room = roomFixture();
  delete room.players.p4;
  const database = new FakeRtdb({
    rooms: { "room-1": room }, pairingCodes: { ABC234: pairingFixture() }, roomMembers: {},
  });
  const repository = createFirebaseRoomRepository({ database, now: () => 100 });

  const result = await repository.joinRoom({
    callerUid: "p4", input: { code: "abc-234", name: "Restored" },
  });

  assert.deepEqual(result, { roomId: "room-1" });
  assert.equal(database.state.rooms["room-1"].joinState.count, 4);
  assert.equal(database.state.rooms["room-1"].players.p4.name, "Restored");
  assert.equal(database.state.roomMembers["room-1"].p4, true);
});

test("遅延したjoin repairが後続joinのparticipantCountを巻き戻さない", async () => {
  const initialRoom = roomFixture({
    meta: { ...roomFixture().meta, participantCount: 1 },
    players: { p1: roomFixture().players.p1 },
    joinState: { count: 1, members: { p1: true } },
  });
  const database = new FakeRtdb({
    rooms: { "room-1": initialRoom },
    pairingCodes: { ABC234: pairingFixture() },
    roomMembers: { "room-1": { p1: true } },
  });
  let releaseRepair;
  let repairEntered;
  let delayedUpdates;
  const repairGate = new Promise((resolve) => { releaseRepair = resolve; });
  const entered = new Promise((resolve) => { repairEntered = resolve; });
  const delayedDatabase = {
    ref(path = "") {
      const reference = database.ref(path);
      if (path !== "") return reference;
      return {
        ...reference,
        async update(updates) {
          delayedUpdates = structuredClone(updates);
          repairEntered();
          await repairGate;
          return reference.update(updates);
        },
      };
    },
  };
  const firstRepository = createFirebaseRoomRepository({ database: delayedDatabase, now: () => 100 });
  const secondRepository = createFirebaseRoomRepository({ database, now: () => 101 });

  const firstJoin = firstRepository.joinRoom({
    callerUid: "p2", input: { code: "ABC234", name: "P2" },
  });
  await entered;
  await secondRepository.joinRoom({ callerUid: "p3", input: { code: "ABC234", name: "P3" } });
  releaseRepair();
  await firstJoin;

  assert.equal(database.state.rooms["room-1"].meta.participantCount, 3);
  assert.equal(Object.hasOwn(delayedUpdates, "rooms/room-1/meta/participantCount"), false);
  assert.equal(Object.hasOwn(delayedUpdates, "rooms/room-1/meta/updatedAt"), false);
});

test("startはroom transaction内でhost・waiting・roster・role数を検証する", async () => {
  const cases = [
    ["p2", roomFixture(), roles, "permission-denied"],
    ["p1", roomFixture({ meta: { ...roomFixture().meta, status: "playing" } }), roles,
      "failed-precondition"],
    ["p1", roomFixture(), roles.slice(0, 3), "invalid-argument"],
    ["p1", roomFixture({ joinState: {
      count: 4, members: { p1: true, p2: true, p3: true },
    } }), roles, "failed-precondition"],
  ];
  for (const [callerUid, room, roleIds, expectedCode] of cases) {
    const database = new FakeRtdb({ rooms: { "room-1": room } });
    const repository = createFirebaseRoomRepository({ database, now: () => 100, randomInt: () => 7 });
    await assert.rejects(
      repository.startGame({ callerUid, input: { roomId: "room-1", roleIds, gmMode: "computer" } }),
      assertCode(expectedCode),
    );
  }
});

test("startの未定義roleは文字列内容に依存せずinvalid-argumentにする", async () => {
  const database = new FakeRtdb({ rooms: { "room-1": roomFixture() } });
  const repository = createFirebaseRoomRepository({ database, now: () => 100, randomInt: () => 7 });

  await assert.rejects(repository.startGame({
    callerUid: "p1",
    input: { roomId: "room-1", roleIds: ["citizen", "citizen", "citizen", "revision"],
      gmMode: "computer" },
  }), assertCode("invalid-argument"));
});

test("startはnowとseedをtransaction外で固定しcommitted snapshotから応答する", async () => {
  const database = new FakeRtdb({ rooms: { "room-1": roomFixture() } });
  database.retryTransaction("rooms/room-1", () => {});
  let clockReads = 0;
  let randomReads = 0;
  const repository = createFirebaseRoomRepository({
    database,
    now: () => { clockReads += 1; return 100; },
    randomInt: () => { randomReads += 1; return 7; },
  });

  const response = await repository.startGame({
    callerUid: "p1", input: { roomId: "room-1", roleIds: roles, gmMode: "computer" },
  });
  const transaction = database.transactionCalls.find(({ path }) => path === "rooms/room-1");

  assert.equal(clockReads, 1);
  assert.equal(randomReads, 1);
  assert.deepEqual(transaction.attempts[0].proposal, transaction.attempts[1].proposal);
  assert.deepEqual(response, {
    roomId: "room-1",
    revision: database.state.rooms["room-1"].game.public.revision,
    phase: database.state.rooms["room-1"].game.public.phase,
  });
  assert.equal(database.state.rooms["room-1"].meta.status, "playing");
});

test("dispatchはgame pathだけをtransactionしduplicate receiptを巻き戻さない", async () => {
  const game = startGameSession({
    roomId: "room-1", callerUid: "p1", roomMeta: roomFixture().meta,
    players: roomFixture().players, roleIds: roles, gmMode: "computer", seed: 7, now: 100,
  });
  const database = new FakeRtdb({ rooms: { "room-1": { game } } });
  const request = {
    roomId: "room-1", commandId: "command-1", type: "BEGIN_NIGHT", payload: {},
    expectedRevision: game.public.revision,
  };
  database.retryTransaction("rooms/room-1/game", (state) => {
    state.rooms["room-1"].game = applyGameSessionCommand({
      game: state.rooms["room-1"].game, callerUid: "p1", request, now: 101,
    }).game;
  });
  let clockReads = 0;
  const repository = createFirebaseRoomRepository({
    database, now: () => { clockReads += 1; return 101; },
  });

  const first = await repository.dispatchCommand({ callerUid: "p1", request });
  const revisionAfterFirst = database.state.rooms["room-1"].game.public.revision;
  const duplicate = await repository.dispatchCommand({ callerUid: "p1", request });

  assert.equal(clockReads, 2);
  assert.deepEqual(first, duplicate);
  assert.equal(database.state.rooms["room-1"].game.public.revision, revisionAfterFirst);
  assert.deepEqual(database.transactionCalls.map(({ path }) => path), [
    "rooms/room-1/game", "rooms/room-1/game",
  ]);
  assert.deepEqual(Object.keys(database.state.rooms["room-1"].game.processedCommands["command-1"]).sort(),
    ["phase", "revision"]);
});

test("dispatchのengine error codeはattacker-controlled文字列に依存しない", async () => {
  for (const targetId of ["revision", "HOST"]) {
    const game = gameAtVote();
    const database = new FakeRtdb({ rooms: { "room-1": { game } } });
    const repository = createFirebaseRoomRepository({ database, now: () => 104 });

    await assert.rejects(repository.dispatchCommand({
      callerUid: "p2",
      request: { roomId: "room-1", commandId: `vote-${targetId}`, type: "CAST_VOTE",
        payload: { targetId }, expectedRevision: game.public.revision },
    }), assertCode("failed-precondition"));
  }
});

test("dispatchはcommand whitelist・member・revision・hostをengineの前に明示検証する", async () => {
  const requests = [
    ["p1", { commandId: "unknown", type: "HOST", expectedRevision: 1 }, "invalid-argument"],
    ["outsider", { commandId: "outsider", type: "BEGIN_NIGHT", expectedRevision: 1 },
      "permission-denied"],
    ["p1", { commandId: "stale", type: "BEGIN_NIGHT", expectedRevision: 0 }, "aborted"],
    ["p2", { commandId: "non-host", type: "BEGIN_NIGHT", expectedRevision: 1 },
      "permission-denied"],
  ];
  for (const [callerUid, partial, expectedCode] of requests) {
    const game = startGameSession({
      roomId: "room-1", callerUid: "p1", roomMeta: roomFixture().meta,
      players: roomFixture().players, roleIds: roles, gmMode: "computer", seed: 7, now: 100,
    });
    const database = new FakeRtdb({ rooms: { "room-1": { game } } });
    const repository = createFirebaseRoomRepository({ database, now: () => 101 });
    await assert.rejects(repository.dispatchCommand({
      callerUid,
      request: { roomId: "room-1", payload: {}, ...partial },
    }), assertCode(expectedCode));
  }
});

test("aborted transactionを安定したaborted errorにする", async () => {
  const game = startGameSession({
    roomId: "room-1", callerUid: "p1", roomMeta: roomFixture().meta,
    players: roomFixture().players, roleIds: roles, gmMode: "computer", seed: 7, now: 100,
  });
  const database = new FakeRtdb({ rooms: { "room-1": { game } } });
  database.abortTransaction("rooms/room-1/game");
  const repository = createFirebaseRoomRepository({ database, now: () => 101 });

  await assert.rejects(repository.dispatchCommand({
    callerUid: "p1",
    request: { roomId: "room-1", commandId: "c1", type: "BEGIN_NIGHT", payload: {},
      expectedRevision: game.public.revision },
  }), assertCode("aborted"));
});
