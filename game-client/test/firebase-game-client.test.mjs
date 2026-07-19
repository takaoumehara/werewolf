import test from "node:test";
import assert from "node:assert/strict";

import { createFirebaseGameClient } from "../firebase-game-client.mjs";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createHarness(overrides = {}) {
  const currentUser = Object.hasOwn(overrides, "currentUser")
    ? overrides.currentUser
    : { uid: "player-1" };
  const auth = { currentUser };
  const database = { service: "database" };
  const functions = { service: "functions" };
  const calls = [];
  const subscriptions = [];
  const presenceCalls = [];
  let timestampIndex = 0;

  const sdk = {
    async signInAnonymously(receivedAuth) {
      calls.push({ operation: "signInAnonymously", auth: receivedAuth });
      const user = { uid: "signed-in-player" };
      auth.currentUser = user;
      return { user };
    },
    httpsCallable(receivedFunctions, name) {
      calls.push({ operation: "httpsCallable", functions: receivedFunctions, name });
      return async (data) => {
        calls.push({ operation: "call", name, data });
        return { data: { name, accepted: true } };
      };
    },
    ref(receivedDatabase, path) {
      return { database: receivedDatabase, path };
    },
    onValue(reference, onValue, onError) {
      const subscription = {
        reference,
        onValue,
        onError,
        unsubscribeCount: 0,
      };
      subscriptions.push(subscription);
      return () => {
        subscription.unsubscribeCount += 1;
      };
    },
    onDisconnect(reference) {
      const hook = {
        reference,
        cancelCount: 0,
        async update(value) {
          presenceCalls.push({ operation: "disconnect-update", reference, value, hook });
        },
        async cancel() {
          hook.cancelCount += 1;
          presenceCalls.push({ operation: "disconnect-cancel", reference, hook });
        },
      };
      presenceCalls.push({ operation: "onDisconnect", reference, hook });
      return hook;
    },
    async update(reference, value) {
      presenceCalls.push({ operation: "update", reference, value });
    },
    serverTimestamp() {
      timestampIndex += 1;
      return { ".sv": "timestamp", index: timestampIndex };
    },
    ...overrides.sdk,
  };

  const client = createFirebaseGameClient({
    app: { service: "app" },
    auth,
    database,
    functions,
    sdk,
  });

  return { auth, database, functions, sdk, client, calls, subscriptions, presenceCalls };
}

test("ensureAnonymousAuth reuses the current anonymous user", async () => {
  const currentUser = { uid: "existing-player", isAnonymous: true };
  const { client, calls } = createHarness({ currentUser });

  assert.equal(await client.ensureAnonymousAuth(), currentUser);
  assert.equal(calls.some(({ operation }) => operation === "signInAnonymously"), false);
});

test("ensureAnonymousAuth deduplicates concurrent anonymous sign-in", async () => {
  const signIn = deferred();
  let signInCount = 0;
  const { auth, client } = createHarness({
    currentUser: null,
    sdk: {
      signInAnonymously(receivedAuth) {
        signInCount += 1;
        return signIn.promise.then((credential) => {
          receivedAuth.currentUser = credential.user;
          return credential;
        });
      },
    },
  });

  const first = client.ensureAnonymousAuth();
  const second = client.ensureAnonymousAuth();
  assert.equal(signInCount, 1);

  const user = { uid: "new-player" };
  signIn.resolve({ user });
  assert.deepEqual(await Promise.all([first, second]), [user, user]);
  assert.equal(auth.currentUser, user);
});

test("ensureAnonymousAuth clears a failed sign-in so the next call can retry", async () => {
  const expectedError = new Error("auth unavailable");
  let attempts = 0;
  const { client } = createHarness({
    currentUser: null,
    sdk: {
      async signInAnonymously(auth) {
        attempts += 1;
        if (attempts === 1) throw expectedError;
        const user = { uid: "retried-player" };
        auth.currentUser = user;
        return { user };
      },
    },
  });

  await assert.rejects(client.ensureAnonymousAuth(), (error) => error === expectedError);
  assert.deepEqual(await client.ensureAnonymousAuth(), { uid: "retried-player" });
  assert.equal(attempts, 2);
});

test("the four public operations use only their fixed callable names and unwrap data", async () => {
  const { client, calls } = createHarness();

  const responses = await Promise.all([
    client.createRoom({ name: "Host", maxPlayers: 8 }),
    client.joinRoom({ code: "ABC234", name: "Guest" }),
    client.startGame({ roomId: "room-1", roleIds: ["wolf"], gmMode: false }),
    client.dispatchCommand({
      roomId: "room-1",
      commandId: "command-1",
      type: "CAST_VOTE",
      payload: { targetId: "player-2" },
      expectedRevision: 3,
    }),
  ]);

  assert.deepEqual(
    calls.filter(({ operation }) => operation === "httpsCallable").map(({ name }) => name),
    ["createSnapRoom", "joinSnapRoom", "startWerewolfGame", "dispatchWerewolfCommand"],
  );
  assert.deepEqual(responses, [
    { name: "createSnapRoom", accepted: true },
    { name: "joinSnapRoom", accepted: true },
    { name: "startWerewolfGame", accepted: true },
    { name: "dispatchWerewolfCommand", accepted: true },
  ]);
});

test("callables receive fresh plain objects containing only allowed own fields", async () => {
  const { client, calls } = createHarness();
  const createInput = Object.assign(Object.create({ maxPlayers: 30 }), {
    name: "Host",
    ignored: "secret",
  });
  const joinInput = { code: "ABC234", name: "Guest", uid: "forged" };
  const startInput = {
    roomId: "room-1",
    roleIds: ["wolf"],
    gmMode: true,
    serverTime: 123,
  };
  const dispatchInput = {
    roomId: "room-1",
    commandId: "command-1",
    type: "CAST_VOTE",
    payload: { targetId: "player-2" },
    expectedRevision: 2,
    actorId: "forged-actor",
    uid: "forged-uid",
    at: 456,
  };

  await client.createRoom(createInput);
  await client.joinRoom(joinInput);
  await client.startGame(startInput);
  await client.dispatchCommand(dispatchInput);

  const payloads = calls.filter(({ operation }) => operation === "call").map(({ data }) => data);
  assert.deepEqual(payloads, [
    { name: "Host" },
    { code: "ABC234", name: "Guest" },
    { roomId: "room-1", roleIds: ["wolf"], gmMode: true },
    {
      roomId: "room-1",
      commandId: "command-1",
      type: "CAST_VOTE",
      payload: { targetId: "player-2" },
      expectedRevision: 2,
    },
  ]);
  for (const payload of payloads) assert.equal(Object.getPrototypeOf(payload), Object.prototype);
  assert.notEqual(payloads[0], createInput);
  assert.notEqual(payloads[3], dispatchInput);
});

test("a callable error is propagated unchanged", async () => {
  const expectedError = new Error("functions unavailable");
  const { client } = createHarness({
    sdk: {
      httpsCallable() {
        return async () => {
          throw expectedError;
        };
      },
    },
  });

  await assert.rejects(
    client.createRoom({ name: "Host", maxPlayers: 8 }),
    (error) => error === expectedError,
  );
});

test("the public API does not expose generic calls, writers, or subscribers", () => {
  const { client } = createHarness();

  assert.deepEqual(Object.keys(client).sort(), [
    "createRoom",
    "dispatchCommand",
    "dispose",
    "ensureAnonymousAuth",
    "joinRoom",
    "setPresence",
    "startGame",
    "subscribeRoom",
  ]);
  assert.equal(client.call, undefined);
  assert.equal(client.subscribe, undefined);
  assert.equal(client.update, undefined);
  assert.equal(client.write, undefined);
});

test("subscribeRoom subscribes to exactly the five allowed self-scoped paths", () => {
  const { client, subscriptions } = createHarness();

  client.subscribeRoom("room-1", {});

  assert.deepEqual(subscriptions.map(({ reference }) => reference.path), [
    "rooms/room-1/meta",
    "rooms/room-1/players",
    "rooms/room-1/game/public",
    "rooms/room-1/game/publicEvents",
    "rooms/room-1/game/privateViews/player-1",
  ]);
  for (const forbidden of [
    "rooms/room-1",
    "rooms/room-1/game",
    "rooms/room-1/game/authoritative",
    "rooms/room-1/game/events",
    "rooms/room-1/game/processedCommands",
    "rooms/room-1/joinState",
    "roomMembers/room-1",
  ]) {
    assert.equal(subscriptions.some(({ reference }) => reference.path === forbidden), false);
  }
});

test("subscription callbacks receive snapshot values and path-specific errors", () => {
  const receivedValues = [];
  const receivedErrors = [];
  const callbacks = {
    onMeta: (value) => receivedValues.push(["meta", value]),
    onPlayers: (value) => receivedValues.push(["players", value]),
    onPublic: (value) => receivedValues.push(["public", value]),
    onPublicEvents: (value) => receivedValues.push(["publicEvents", value]),
    onPrivate: (value) => receivedValues.push(["private", value]),
    onMetaError: (error) => receivedErrors.push(["meta", error]),
    onPlayersError: (error) => receivedErrors.push(["players", error]),
    onPublicError: (error) => receivedErrors.push(["public", error]),
    onPublicEventsError: (error) => receivedErrors.push(["publicEvents", error]),
    onPrivateError: (error) => receivedErrors.push(["private", error]),
  };
  const { client, subscriptions } = createHarness();
  client.subscribeRoom("room-1", callbacks);

  subscriptions.forEach((subscription, index) => {
    subscription.onValue({ val: () => ({ index }) });
    subscription.onError(new Error(`read-${index}`));
  });

  assert.deepEqual(receivedValues, [
    ["meta", { index: 0 }],
    ["players", { index: 1 }],
    ["public", { index: 2 }],
    ["publicEvents", { index: 3 }],
    ["private", { index: 4 }],
  ]);
  assert.deepEqual(receivedErrors.map(([name, error]) => [name, error.message]), [
    ["meta", "read-0"],
    ["players", "read-1"],
    ["public", "read-2"],
    ["publicEvents", "read-3"],
    ["private", "read-4"],
  ]);
});

test("subscribeRoom rolls back earlier subscriptions when the third ref throws", async () => {
  const setupError = new Error("third ref failed");
  const unsubscribeAttempts = [];
  let refCount = 0;
  let subscriptionCount = 0;
  const { client } = createHarness({
    sdk: {
      ref(database, path) {
        refCount += 1;
        if (refCount === 3) throw setupError;
        return { database, path };
      },
      onValue() {
        const index = subscriptionCount++;
        return () => unsubscribeAttempts.push(index);
      },
    },
  });

  assert.throws(() => client.subscribeRoom("room-1", {}), (error) => error === setupError);
  assert.deepEqual(unsubscribeAttempts, [0, 1]);
  await client.dispose();
  assert.deepEqual(unsubscribeAttempts, [0, 1]);
});

test("subscribeRoom aggregates a third onValue failure with rollback failures", async () => {
  const setupError = new Error("third onValue failed");
  const rollbackError = new Error("first rollback failed");
  const unsubscribeAttempts = [];
  let subscriptionCount = 0;
  const { client } = createHarness({
    sdk: {
      onValue() {
        const index = subscriptionCount++;
        if (index === 2) throw setupError;
        return () => {
          unsubscribeAttempts.push(index);
          if (index === 0) throw rollbackError;
        };
      },
    },
  });

  assert.throws(
    () => client.subscribeRoom("room-1", {}),
    (error) =>
      error instanceof AggregateError &&
      error.errors[0] === setupError &&
      error.errors[1] === rollbackError,
  );
  assert.deepEqual(unsubscribeAttempts, [0, 1]);
  await client.dispose();
  assert.deepEqual(unsubscribeAttempts, [0, 1]);
});

test("room-local unsubscribe is idempotent and does not affect another subscription", () => {
  const { client, subscriptions } = createHarness();
  const unsubscribeFirst = client.subscribeRoom("room-1", {});
  client.subscribeRoom("room-2", {});

  unsubscribeFirst();
  unsubscribeFirst();

  assert.deepEqual(subscriptions.slice(0, 5).map(({ unsubscribeCount }) => unsubscribeCount), [1, 1, 1, 1, 1]);
  assert.deepEqual(subscriptions.slice(5).map(({ unsubscribeCount }) => unsubscribeCount), [0, 0, 0, 0, 0]);
});

test("room-local unsubscribe continues after one unsubscribe throws", () => {
  const expectedError = new Error("unsubscribe failed");
  const attempted = [];
  let index = 0;
  const { client } = createHarness({
    sdk: {
      onValue() {
        const ownIndex = index++;
        return () => {
          attempted.push(ownIndex);
          if (ownIndex === 1) throw expectedError;
        };
      },
    },
  });
  const unsubscribe = client.subscribeRoom("room-1", {});

  assert.throws(unsubscribe, (error) => error instanceof AggregateError && error.errors[0] === expectedError);
  assert.deepEqual(attempted, [0, 1, 2, 3, 4]);
  assert.doesNotThrow(unsubscribe);
});

test("dispose unsubscribes all remaining rooms once and is idempotent", async () => {
  const { client, subscriptions } = createHarness();
  const unsubscribeFirst = client.subscribeRoom("room-1", {});
  client.subscribeRoom("room-2", {});
  unsubscribeFirst();

  await client.dispose();
  await client.dispose();

  assert.deepEqual(subscriptions.map(({ unsubscribeCount }) => unsubscribeCount), Array(10).fill(1));
});

test("subscription paths reject unsafe room IDs and unsafe current user IDs", () => {
  for (const roomId of ["", "room/child", "room.child", "room#1", "room$1", "room[1]", "room]1", "room\u0000x"]) {
    const { client, subscriptions } = createHarness();
    assert.throws(() => client.subscribeRoom(roomId, {}), /RTDB-safe/);
    assert.equal(subscriptions.length, 0);
  }

  const { client, subscriptions } = createHarness({ currentUser: { uid: "other/player" } });
  assert.throws(() => client.subscribeRoom("room-1", {}), /RTDB-safe/);
  assert.equal(subscriptions.length, 0);
});

test("subscribeRoom requires an authenticated current user before constructing paths", () => {
  const { client, subscriptions } = createHarness({ currentUser: null });

  assert.throws(() => client.subscribeRoom("room-1", {}), /authenticate/i);
  assert.equal(subscriptions.length, 0);
});

test("online presence registers onDisconnect before writing the online state", async () => {
  const { client, presenceCalls } = createHarness();

  await client.setPresence({ roomId: "room-1", connected: true, uid: "other-player" });

  assert.deepEqual(presenceCalls.map(({ operation }) => operation), [
    "onDisconnect",
    "disconnect-update",
    "update",
  ]);
  assert.deepEqual(presenceCalls[0].reference.path, "rooms/room-1/players/player-1");
  assert.deepEqual(presenceCalls[1].value, {
    connected: false,
    lastSeenAt: { ".sv": "timestamp", index: 1 },
  });
  assert.deepEqual(presenceCalls[2].value, {
    connected: true,
    lastSeenAt: { ".sv": "timestamp", index: 2 },
  });
  assert.equal(JSON.stringify(presenceCalls).includes("other-player"), false);
});

test("online presence does not write online when disconnect registration fails", async () => {
  const expectedError = new Error("disconnect registration failed");
  const directWrites = [];
  const { client } = createHarness({
    sdk: {
      onDisconnect() {
        return {
          async update() {
            throw expectedError;
          },
          async cancel() {},
        };
      },
      async update(reference, value) {
        directWrites.push({ reference, value });
      },
    },
  });

  await assert.rejects(
    client.setPresence({ roomId: "room-1", connected: true }),
    (error) => error === expectedError,
  );
  assert.deepEqual(directWrites, []);
});

test("online write failure cancels its registered disconnect hook", async () => {
  const expectedError = new Error("online write failed");
  let hook;
  const { client } = createHarness({
    sdk: {
      onDisconnect(reference) {
        hook = {
          reference,
          updateCount: 0,
          cancelCount: 0,
          async update() {
            hook.updateCount += 1;
          },
          async cancel() {
            hook.cancelCount += 1;
          },
        };
        return hook;
      },
      async update() {
        throw expectedError;
      },
    },
  });

  await assert.rejects(
    client.setPresence({ roomId: "room-1", connected: true }),
    (error) => error === expectedError,
  );
  assert.equal(hook.updateCount, 1);
  assert.equal(hook.cancelCount, 1);
  await client.dispose();
  assert.equal(hook.cancelCount, 1);
});

test("re-registering presence in one room cancels only that room's old hook", async () => {
  const { client, presenceCalls } = createHarness();
  await client.setPresence({ roomId: "room-1", connected: true });
  await client.setPresence({ roomId: "room-2", connected: true });
  const roomOneFirstHook = presenceCalls.find(
    ({ operation, reference }) => operation === "onDisconnect" && reference.path.includes("room-1"),
  ).hook;
  const roomTwoHook = presenceCalls.find(
    ({ operation, reference }) => operation === "onDisconnect" && reference.path.includes("room-2"),
  ).hook;

  await client.setPresence({ roomId: "room-1", connected: true });

  assert.equal(roomOneFirstHook.cancelCount, 1);
  assert.equal(roomTwoHook.cancelCount, 0);
  assert.equal(presenceCalls.filter(({ operation }) => operation === "onDisconnect").length, 3);
});

test("same-room presence waits for an earlier registration before applying a later offline request", async () => {
  const registration = deferred();
  const registrationStarted = deferred();
  const directWrites = [];
  let hook;
  const { client } = createHarness({
    sdk: {
      onDisconnect(reference) {
        registrationStarted.resolve();
        hook = {
          reference,
          cancelCount: 0,
          update() {
            return registration.promise;
          },
          async cancel() {
            hook.cancelCount += 1;
          },
        };
        return hook;
      },
      async update(reference, value) {
        directWrites.push({ reference, value });
      },
    },
  });

  const online = client.setPresence({ roomId: "room-1", connected: true });
  await registrationStarted.promise;
  assert.ok(hook);
  const offline = client.setPresence({ roomId: "room-1", connected: false });
  await Promise.resolve();
  const writesBeforeRegistration = [...directWrites];

  registration.resolve();
  await Promise.all([online, offline]);

  assert.deepEqual(writesBeforeRegistration, []);
  assert.deepEqual(directWrites.map(({ value }) => value.connected), [true, false]);
  assert.equal(hook.cancelCount, 1);
});

test("a failed presence write cannot delete or cancel a later same-room hook", async () => {
  const firstWrite = deferred();
  const firstWriteStarted = deferred();
  const writeError = new Error("first online write failed");
  const hooks = [];
  let directWriteCount = 0;
  const { client } = createHarness({
    sdk: {
      onDisconnect(reference) {
        const hook = {
          reference,
          cancelCount: 0,
          async update() {},
          async cancel() {
            hook.cancelCount += 1;
          },
        };
        hooks.push(hook);
        return hook;
      },
      async update() {
        directWriteCount += 1;
        if (directWriteCount === 1) {
          firstWriteStarted.resolve();
          return firstWrite.promise;
        }
      },
    },
  });

  const first = client.setPresence({ roomId: "room-1", connected: true });
  const firstRejected = assert.rejects(first, (error) => error === writeError);
  await firstWriteStarted.promise;
  const second = client.setPresence({ roomId: "room-1", connected: true });
  await Promise.resolve();
  const hooksBeforeFirstSettles = hooks.length;

  firstWrite.reject(writeError);
  await firstRejected;
  await second;

  assert.equal(hooksBeforeFirstSettles, 1);
  assert.equal(hooks.length, 2);
  assert.deepEqual(hooks.map(({ cancelCount }) => cancelCount), [1, 0]);
  await client.dispose();
  assert.deepEqual(hooks.map(({ cancelCount }) => cancelCount), [1, 1]);
});

test("manual offline cancels the room hook and writes only connected and server lastSeenAt", async () => {
  const { client, presenceCalls } = createHarness();
  await client.setPresence({ roomId: "room-1", connected: true });
  const hook = presenceCalls.find(({ operation }) => operation === "onDisconnect").hook;

  await client.setPresence({ roomId: "room-1", connected: false, uid: "other-player" });

  assert.equal(hook.cancelCount, 1);
  const finalWrite = presenceCalls.at(-2);
  assert.equal(finalWrite.operation, "update");
  assert.equal(presenceCalls.at(-1).operation, "disconnect-cancel");
  assert.equal(finalWrite.reference.path, "rooms/room-1/players/player-1");
  assert.deepEqual(finalWrite.value, {
    connected: false,
    lastSeenAt: { ".sv": "timestamp", index: 3 },
  });
  assert.deepEqual(Object.keys(finalWrite.value).sort(), ["connected", "lastSeenAt"]);
});

test("manual offline write failure preserves the current disconnect hook for retry", async () => {
  const offlineError = new Error("offline write failed");
  let failOffline = true;
  const { client, presenceCalls } = createHarness({
    sdk: {
      async update(reference, value) {
        presenceCalls.push({ operation: "update", reference, value });
        if (!value.connected && failOffline) throw offlineError;
      },
    },
  });
  await client.setPresence({ roomId: "room-1", connected: true });
  const hook = presenceCalls.find(({ operation }) => operation === "onDisconnect").hook;

  await assert.rejects(
    client.setPresence({ roomId: "room-1", connected: false }),
    (error) => error === offlineError,
  );
  assert.equal(hook.cancelCount, 0);

  failOffline = false;
  await client.setPresence({ roomId: "room-1", connected: false });
  assert.equal(hook.cancelCount, 1);
  assert.equal(presenceCalls.filter(({ operation }) => operation === "onDisconnect").length, 1);
});

test("presence rejects unsafe keys and non-boolean connected values before writing", async () => {
  for (const input of [
    { roomId: "room/child", connected: true },
    { roomId: "room-1", connected: "yes" },
  ]) {
    const { client, presenceCalls } = createHarness();
    await assert.rejects(client.setPresence(input));
    assert.deepEqual(presenceCalls, []);
  }

  const { client, presenceCalls } = createHarness({ currentUser: { uid: "other/player" } });
  await assert.rejects(client.setPresence({ roomId: "room-1", connected: true }), /RTDB-safe/);
  assert.deepEqual(presenceCalls, []);
});

test("dispose waits for a pending disconnect registration and prevents an online write", async () => {
  const registration = deferred();
  const registrationStarted = deferred();
  const directWrites = [];
  let hook;
  const { client } = createHarness({
    sdk: {
      onDisconnect(reference) {
        hook = {
          reference,
          cancelCount: 0,
          update() {
            registrationStarted.resolve();
            return registration.promise;
          },
          async cancel() {
            hook.cancelCount += 1;
          },
        };
        return hook;
      },
      async update(reference, value) {
        directWrites.push({ reference, value });
      },
    },
  });

  const presence = client.setPresence({ roomId: "room-1", connected: true });
  await registrationStarted.promise;
  let disposeSettled = false;
  const disposing = client.dispose().then(() => {
    disposeSettled = true;
  });
  await Promise.resolve();
  assert.equal(disposeSettled, false);

  registration.resolve();
  await assert.rejects(presence, /disposed/i);
  await disposing;

  assert.deepEqual(directWrites, []);
  assert.equal(hook.cancelCount, 1);
});

test("dispose waits for an in-flight online write then writes offline before cancelling", async () => {
  const onlineWrite = deferred();
  const onlineWriteStarted = deferred();
  const directWrites = [];
  let hook;
  const { client } = createHarness({
    sdk: {
      onDisconnect(reference) {
        hook = {
          reference,
          cancelCount: 0,
          async update() {},
          async cancel() {
            hook.cancelCount += 1;
          },
        };
        return hook;
      },
      async update(reference, value) {
        directWrites.push({ reference, value });
        if (value.connected) {
          onlineWriteStarted.resolve();
          return onlineWrite.promise;
        }
      },
    },
  });

  const presence = client.setPresence({ roomId: "room-1", connected: true });
  await onlineWriteStarted.promise;
  let disposeSettled = false;
  const disposing = client.dispose().then(() => {
    disposeSettled = true;
  });
  await Promise.resolve();
  assert.equal(disposeSettled, false);

  onlineWrite.resolve();
  await presence;
  await disposing;

  assert.deepEqual(directWrites.map(({ value }) => value.connected), [true, false]);
  assert.deepEqual(directWrites[1].value.lastSeenAt, { ".sv": "timestamp", index: 3 });
  assert.equal(hook.cancelCount, 1);
});

test("setPresence rejects new operations after dispose starts", async () => {
  const { client, presenceCalls } = createHarness();
  await client.dispose();

  await assert.rejects(
    client.setPresence({ roomId: "room-1", connected: true }),
    /disposed/i,
  );
  assert.deepEqual(presenceCalls, []);
});

test("dispose cancels all active presence hooks and continues after cleanup failures", async () => {
  const expectedUnsubscribeError = new Error("unsubscribe failed");
  const expectedCancelError = new Error("cancel failed");
  const unsubscribeAttempts = [];
  const cancelAttempts = [];
  let subscriptionIndex = 0;
  let hookIndex = 0;
  const { client } = createHarness({
    sdk: {
      onValue() {
        const index = subscriptionIndex++;
        return () => {
          unsubscribeAttempts.push(index);
          if (index === 1) throw expectedUnsubscribeError;
        };
      },
      onDisconnect() {
        const index = hookIndex++;
        return {
          async update() {},
          async cancel() {
            cancelAttempts.push(index);
            if (index === 0) throw expectedCancelError;
          },
        };
      },
    },
  });
  client.subscribeRoom("room-1", {});
  await client.setPresence({ roomId: "room-1", connected: true });
  await client.setPresence({ roomId: "room-2", connected: true });

  await assert.rejects(
    client.dispose(),
    (error) =>
      error instanceof AggregateError &&
      error.errors.includes(expectedUnsubscribeError) &&
      error.errors.includes(expectedCancelError),
  );
  assert.deepEqual(unsubscribeAttempts, [0, 1, 2, 3, 4]);
  assert.deepEqual(cancelAttempts, [0, 1]);
  await assert.doesNotReject(client.dispose());
  assert.deepEqual(unsubscribeAttempts, [0, 1, 2, 3, 4]);
  assert.deepEqual(cancelAttempts, [0, 1]);
});
