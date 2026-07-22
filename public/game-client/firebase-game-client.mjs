// 人狼ゲーム — ブラウザ用 GameClient(Firebase Web SDK v10 modular / CDN)
//
// mobile_app.html から <script type="module"> 経由で読み込む。
// サーバー権威の原則を守るため、actorId はクライアントから一切送らない
// (dispatchWerewolfCommand はサーバー側で auth.uid を actorId として使う)。
//
// 購読パス:
//   meta    -> rooms/{roomId}/meta
//   players -> rooms/{roomId}/players
//   public  -> rooms/{roomId}/game/public
//   self    -> rooms/{roomId}/game/privateViews/{uid}
//
// roomId は createRoom / joinRoom が解決するまで未確定。onMeta 等を先に呼んでも
// 構わないように、購読は「登録」と「実バインド」を分離し、roomId が決まった
// 時点で既存の登録をすべて実パスへ再バインドする(= 遅延登録・再購読に対応)。

import {
  initializeApp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  connectAuthEmulator,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getDatabase,
  ref,
  onValue,
  update,
  connectDatabaseEmulator,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-functions.js";

const SUBSCRIPTION_KINDS = ["meta", "players", "public", "self"];

function pathForKind(kind, roomId, uid) {
  if (!roomId) return null;
  switch (kind) {
    case "meta":
      return `rooms/${roomId}/meta`;
    case "players":
      return `rooms/${roomId}/players`;
    case "public":
      return `rooms/${roomId}/game/public`;
    case "self":
      return uid ? `rooms/${roomId}/game/privateViews/${uid}` : null;
    default:
      return null;
  }
}

/**
 * createGameClient({ config, useEmulator }) -> GameClient
 *
 * GameClient:
 *   ready: Promise<{ uid }>                         匿名サインインの完了
 *   createRoom({ displayName, maxPlayers })          -> { roomId, code, expiresAt }
 *   joinRoom({ code, displayName })                  -> { roomId }
 *   startGame({ roleIds, seed })                     -> { ok, revision }
 *   send({ type, payload })                          -> { revision } (commandId はここで生成)
 *   renameSelf(displayName)                          自分の表示名を後から更新(部屋作成直後は
 *                                                     表示名が未確定なため。RTDB ルールが
 *                                                     players/$uid/name の自己書き込みのみを許可)
 *   onMeta(cb) / onPlayers(cb) / onPublic(cb) / onSelf(cb) -> unsubscribe
 *   uid, roomId (getters)
 */
export function createGameClient({ config, useEmulator = false } = {}) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getDatabase(app, config.databaseURL);
  const fns = getFunctions(app, "us-central1");

  if (useEmulator) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectDatabaseEmulator(db, "127.0.0.1", 9000);
    connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  }

  const createSnapRoomFn = httpsCallable(fns, "createSnapRoom");
  const joinSnapRoomFn = httpsCallable(fns, "joinSnapRoom");
  const startWerewolfGameFn = httpsCallable(fns, "startWerewolfGame");
  const dispatchWerewolfCommandFn = httpsCallable(fns, "dispatchWerewolfCommand");

  let currentUid = null;
  let currentRoomId = null;
  let commandCounter = 0;

  const ready = new Promise((resolve, reject) => {
    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          currentUid = user.uid;
          unsubscribeAuth();
          resolve({ uid: user.uid });
        }
      },
      reject,
    );
    signInAnonymously(auth).catch(reject);
  });

  // kind -> Map<callback, unsubscribeFnOrNull>
  const listeners = {
    meta: new Map(),
    players: new Map(),
    public: new Map(),
    self: new Map(),
  };

  function rebind(kind) {
    const path = pathForKind(kind, currentRoomId, currentUid);
    for (const [cb, previousUnsubscribe] of listeners[kind].entries()) {
      if (previousUnsubscribe) previousUnsubscribe();
      if (path) {
        const dbRef = ref(db, path);
        const stop = onValue(dbRef, (snapshot) => cb(snapshot.val()));
        listeners[kind].set(cb, stop);
      } else {
        listeners[kind].set(cb, null);
      }
    }
  }

  function rebindAll() {
    for (const kind of SUBSCRIPTION_KINDS) rebind(kind);
  }

  function subscribe(kind, cb) {
    listeners[kind].set(cb, null);
    rebind(kind);
    return function unsubscribe() {
      const stop = listeners[kind].get(cb);
      if (stop) stop();
      listeners[kind].delete(cb);
    };
  }

  function setRoomId(roomId) {
    currentRoomId = roomId;
    rebindAll();
  }

  function nextCommandId(type) {
    commandCounter += 1;
    return `${currentUid}:${type}:${Date.now()}:${commandCounter}`;
  }

  async function createRoom({ displayName, maxPlayers } = {}) {
    await ready;
    const result = await createSnapRoomFn({ displayName, maxPlayers });
    setRoomId(result.data.roomId);
    return result.data;
  }

  async function joinRoom({ code, displayName } = {}) {
    await ready;
    const result = await joinSnapRoomFn({ code, displayName });
    setRoomId(result.data.roomId);
    return result.data;
  }

  async function startGame({ roleIds, seed } = {}) {
    await ready;
    if (!currentRoomId) throw new Error("roomId is not set yet (create or join a room first)");
    const result = await startWerewolfGameFn({ roomId: currentRoomId, roleIds, seed });
    return result.data;
  }

  // actorId は絶対に送らない。サーバーが auth.uid を actorId として使う。
  async function send({ type, payload } = {}) {
    await ready;
    if (!currentRoomId) throw new Error("roomId is not set yet (create or join a room first)");
    const commandId = nextCommandId(type);
    const result = await dispatchWerewolfCommandFn({
      roomId: currentRoomId,
      commandId,
      type,
      payload: payload || {},
    });
    return result.data;
  }

  async function renameSelf(displayName) {
    await ready;
    if (!currentRoomId) throw new Error("roomId is not set yet (create or join a room first)");
    await update(ref(db, `rooms/${currentRoomId}/players/${currentUid}`), { name: displayName });
  }

  return {
    ready,
    createRoom,
    joinRoom,
    startGame,
    send,
    renameSelf,
    onMeta: (cb) => subscribe("meta", cb),
    onPlayers: (cb) => subscribe("players", cb),
    onPublic: (cb) => subscribe("public", cb),
    onSelf: (cb) => subscribe("self", cb),
    get uid() {
      return currentUid;
    },
    get roomId() {
      return currentRoomId;
    },
  };
}
