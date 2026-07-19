import { signInAnonymously } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import {
  onDisconnect,
  onValue,
  ref,
  serverTimestamp,
  update,
} from "firebase/database";

const FIREBASE_SDK = Object.freeze({
  signInAnonymously,
  httpsCallable,
  ref,
  onValue,
  onDisconnect,
  update,
  serverTimestamp,
});

const INVALID_RTDB_KEY_CHARACTER = /[.#$\[\]\/\u0000-\u001f\u007f]/u;

function assertRtdbSafeKey(value, label) {
  if (typeof value !== "string" || value.length === 0 || INVALID_RTDB_KEY_CHARACTER.test(value)) {
    throw new TypeError(`${label} must be a non-empty RTDB-safe key`);
  }
  return value;
}

function copyAllowedFields(input, allowedFields) {
  const copy = {};
  if (input === null || (typeof input !== "object" && typeof input !== "function")) return copy;
  for (const field of allowedFields) {
    if (Object.hasOwn(input, field)) copy[field] = input[field];
  }
  return copy;
}

function throwCleanupErrors(errors, message) {
  if (errors.length > 0) throw new AggregateError(errors, message);
}

export function createFirebaseGameClient({
  app,
  auth,
  database,
  functions,
  sdk = FIREBASE_SDK,
}) {
  void app;
  const roomSubscriptions = new Set();
  const presenceHooks = new Map();
  const presenceQueues = new Map();
  let signInPromise = null;
  let disposed = false;

  function disposedError() {
    return new Error("Firebase game client has been disposed");
  }

  async function ensureAnonymousAuth() {
    if (auth?.currentUser) return auth.currentUser;
    if (!signInPromise) {
      signInPromise = sdk.signInAnonymously(auth).then(({ user }) => user);
      signInPromise.then(
        () => {
          signInPromise = null;
        },
        () => {
          signInPromise = null;
        },
      );
    }
    return signInPromise;
  }

  function currentUid() {
    const uid = auth?.currentUser?.uid;
    if (!uid) throw new Error("Authenticate anonymously before subscribing or setting presence");
    return assertRtdbSafeKey(uid, "current user ID");
  }

  async function invoke(name, input, allowedFields) {
    await ensureAnonymousAuth();
    const callable = sdk.httpsCallable(functions, name);
    const response = await callable(copyAllowedFields(input, allowedFields));
    return response.data;
  }

  function subscribeRoom(roomId, callbacks = {}) {
    const safeRoomId = assertRtdbSafeKey(roomId, "room ID");
    const uid = currentUid();
    const definitions = [
      ["meta", callbacks.onMeta, callbacks.onMetaError],
      ["players", callbacks.onPlayers, callbacks.onPlayersError],
      ["game/public", callbacks.onPublic, callbacks.onPublicError],
      ["game/publicEvents", callbacks.onPublicEvents, callbacks.onPublicEventsError],
      [`game/privateViews/${uid}`, callbacks.onPrivate, callbacks.onPrivateError],
    ];
    const record = { active: true, unsubscribers: [] };

    try {
      for (const [suffix, onSnapshot, onError] of definitions) {
        const reference = sdk.ref(database, `rooms/${safeRoomId}/${suffix}`);
        const unsubscribe = sdk.onValue(
          reference,
          (snapshot) => onSnapshot?.(snapshot.val()),
          (error) => onError?.(error),
        );
        record.unsubscribers.push(unsubscribe);
      }
    } catch (setupError) {
      record.active = false;
      const errors = [setupError];
      for (const unsubscribe of record.unsubscribers) {
        try {
          unsubscribe();
        } catch (rollbackError) {
          errors.push(rollbackError);
        }
      }
      if (errors.length === 1) throw setupError;
      throw new AggregateError(errors, "Room subscription setup and rollback failed");
    }
    roomSubscriptions.add(record);

    return function unsubscribeRoom() {
      if (!record.active) return;
      record.active = false;
      roomSubscriptions.delete(record);
      const errors = [];
      for (const unsubscribe of record.unsubscribers) {
        try {
          unsubscribe();
        } catch (error) {
          errors.push(error);
        }
      }
      throwCleanupErrors(errors, "One or more room subscriptions could not be removed");
    };
  }

  async function cancelPresenceHook(roomId) {
    const record = presenceHooks.get(roomId);
    if (!record) return;
    await record.hook.cancel();
    if (presenceHooks.get(roomId) === record) presenceHooks.delete(roomId);
  }

  function enqueuePresence(roomId, operation) {
    const previous = presenceQueues.get(roomId) ?? Promise.resolve();
    const result = previous.catch(() => {}).then(operation);
    const tail = result.catch(() => {});
    presenceQueues.set(roomId, tail);
    tail.then(() => {
      if (presenceQueues.get(roomId) === tail) presenceQueues.delete(roomId);
    });
    return result;
  }

  async function updatePresence(safeRoomId, connected) {
    if (disposed) throw disposedError();
    await ensureAnonymousAuth();
    if (disposed) throw disposedError();
    const uid = currentUid();
    const reference = sdk.ref(database, `rooms/${safeRoomId}/players/${uid}`);

    if (!connected) {
      const record = presenceHooks.get(safeRoomId);
      await sdk.update(reference, {
        connected: false,
        lastSeenAt: sdk.serverTimestamp(),
      });
      if (record && presenceHooks.get(safeRoomId) === record) {
        await record.hook.cancel();
        if (presenceHooks.get(safeRoomId) === record) presenceHooks.delete(safeRoomId);
      }
      return;
    }

    await cancelPresenceHook(safeRoomId);

    const hook = sdk.onDisconnect(reference);
    try {
      await hook.update({
        connected: false,
        lastSeenAt: sdk.serverTimestamp(),
      });
    } catch (registrationError) {
      try {
        await hook.cancel();
      } catch {
        // Preserve the registration failure while still attempting partial-hook cleanup.
      }
      throw registrationError;
    }

    if (disposed) {
      try {
        await hook.cancel();
      } catch (cancelError) {
        throw new AggregateError(
          [disposedError(), cancelError],
          "Presence registration completed after disposal and could not be cancelled",
        );
      }
      throw disposedError();
    }

    const record = { hook, reference };
    presenceHooks.set(safeRoomId, record);
    try {
      await sdk.update(reference, {
        connected: true,
        lastSeenAt: sdk.serverTimestamp(),
      });
    } catch (writeError) {
      if (presenceHooks.get(safeRoomId) !== record) throw writeError;
      presenceHooks.delete(safeRoomId);
      try {
        await hook.cancel();
      } catch (cancelError) {
        throw new AggregateError(
          [writeError, cancelError],
          "Online presence failed and its disconnect hook could not be cancelled",
        );
      }
      throw writeError;
    }
  }

  async function setPresence({ roomId, connected } = {}) {
    const safeRoomId = assertRtdbSafeKey(roomId, "room ID");
    if (typeof connected !== "boolean") throw new TypeError("connected must be a boolean");
    if (disposed) throw disposedError();
    return enqueuePresence(safeRoomId, () => updatePresence(safeRoomId, connected));
  }

  async function dispose() {
    disposed = true;
    const errors = [];
    const subscriptionRecords = [...roomSubscriptions];
    roomSubscriptions.clear();
    for (const record of subscriptionRecords) {
      if (!record.active) continue;
      record.active = false;
      for (const unsubscribe of record.unsubscribers) {
        try {
          unsubscribe();
        } catch (error) {
          errors.push(error);
        }
      }
    }

    const pendingPresence = [...presenceQueues.values()];
    await Promise.allSettled(pendingPresence);

    const hooks = [...presenceHooks.entries()];
    for (const [roomId, record] of hooks) {
      if (presenceHooks.get(roomId) !== record) continue;
      try {
        await sdk.update(record.reference, {
          connected: false,
          lastSeenAt: sdk.serverTimestamp(),
        });
      } catch (offlineError) {
        errors.push(offlineError);
        continue;
      }

      if (presenceHooks.get(roomId) === record) presenceHooks.delete(roomId);
      try {
        await record.hook.cancel();
      } catch (cancelError) {
        errors.push(cancelError);
      }
    }
    throwCleanupErrors(errors, "One or more Firebase client resources could not be cleaned up");
  }

  return {
    ensureAnonymousAuth,
    createRoom: (input) => invoke("createSnapRoom", input, ["name", "maxPlayers"]),
    joinRoom: (input) => invoke("joinSnapRoom", input, ["code", "name"]),
    subscribeRoom,
    startGame: (input) => invoke("startWerewolfGame", input, ["roomId", "roleIds", "gmMode"]),
    dispatchCommand: (input) =>
      invoke("dispatchWerewolfCommand", input, [
        "roomId",
        "commandId",
        "type",
        "payload",
        "expectedRevision",
      ]),
    setPresence,
    dispose,
  };
}
