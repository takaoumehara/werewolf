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
  let signInPromise = null;

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

    for (const [suffix, onSnapshot, onError] of definitions) {
      const reference = sdk.ref(database, `rooms/${safeRoomId}/${suffix}`);
      const unsubscribe = sdk.onValue(
        reference,
        (snapshot) => onSnapshot?.(snapshot.val()),
        (error) => onError?.(error),
      );
      record.unsubscribers.push(unsubscribe);
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
    const hook = presenceHooks.get(roomId);
    if (!hook) return;
    await hook.cancel();
    presenceHooks.delete(roomId);
  }

  async function setPresence({ roomId, connected } = {}) {
    const safeRoomId = assertRtdbSafeKey(roomId, "room ID");
    if (typeof connected !== "boolean") throw new TypeError("connected must be a boolean");
    await ensureAnonymousAuth();
    const uid = currentUid();
    const reference = sdk.ref(database, `rooms/${safeRoomId}/players/${uid}`);

    await cancelPresenceHook(safeRoomId);

    if (!connected) {
      await sdk.update(reference, {
        connected: false,
        lastSeenAt: sdk.serverTimestamp(),
      });
      return;
    }

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

    presenceHooks.set(safeRoomId, hook);
    try {
      await sdk.update(reference, {
        connected: true,
        lastSeenAt: sdk.serverTimestamp(),
      });
    } catch (writeError) {
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

  async function dispose() {
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

    const hooks = [...presenceHooks.values()];
    presenceHooks.clear();
    for (const hook of hooks) {
      try {
        await hook.cancel();
      } catch (error) {
        errors.push(error);
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
