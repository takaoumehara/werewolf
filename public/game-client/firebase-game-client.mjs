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
  push,
  connectDatabaseEmulator,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-functions.js";

const SUBSCRIPTION_KINDS = ["meta", "players", "public", "self", "chat"];

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
    case "chat":
      return `rooms/${roomId}/game/chat`;
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
  const seatAiPlayersFn = httpsCallable(fns, "seatAiPlayers");
  const advanceAiTurnFn = httpsCallable(fns, "advanceAiTurn");
  const resumeRoomFn = httpsCallable(fns, "resumeRoom");

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
    chat: new Map(),
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

  // 途中復帰のための控え。合言葉ではなく roomId を持つ — 合言葉には寿命があるが、
  // 席そのもの(roomMembers の uid)には寿命が無いため、こちらの方が確実に戻れる。
  // 匿名認証の uid は Firebase Auth がローカルに保存するので、再読み込みしても同じ人のまま。
  const RESUME_KEY = "jinro.lastRoom";
  const RESUME_MAX_AGE_MS = 12 * 60 * 60 * 1000;

  function saveResumePoint(roomId) {
    try {
      if (roomId) localStorage.setItem(RESUME_KEY, JSON.stringify({ roomId, at: Date.now() }));
    } catch (e) { /* プライベート閲覧では保存できない。復帰できないだけで遊べる */ }
  }

  function readResumePoint() {
    try {
      const raw = localStorage.getItem(RESUME_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (!saved || !saved.roomId) return null;
      // 古すぎる控えは出さない。「戻る」を押して失敗するより、最初から出ない方がよい。
      if (Date.now() - (saved.at || 0) > RESUME_MAX_AGE_MS) return null;
      return saved;
    } catch (e) { return null; }
  }

  function clearResumePoint() {
    try { localStorage.removeItem(RESUME_KEY); } catch (e) { /* 消せなくても害はない */ }
  }

  function setRoomId(roomId) {
    currentRoomId = roomId;
    saveResumePoint(roomId);
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

  async function seatAiPlayers({ count } = {}) {
    await ready;
    if (!currentRoomId) throw new Error("roomId is not set yet");
    const r = await seatAiPlayersFn({ roomId: currentRoomId, count });
    return r.data;
  }

  async function advanceAiTurn({ phase, wave } = {}) {
    await ready;
    if (!currentRoomId) throw new Error("roomId is not set yet");
    const r = await advanceAiTurnFn({ roomId: currentRoomId, phase, wave: wave || 1 });
    return r.data;
  }

  /**
   * 前に入った卓へ戻る。合言葉は要らない(寿命があり、しかも卓が始まると使えない)。
   * サーバーは roomMembers/{roomId}/{uid} だけを見る。
   * 戻れなかったときは控えを消す — 押すたびに同じ失敗を繰り返させないため。
   */
  async function resumeRoom({ roomId } = {}) {
    await ready;
    const target = roomId || readResumePoint()?.roomId;
    if (!target) throw new Error("no room to resume");
    try {
      const r = await resumeRoomFn({ roomId: target });
      setRoomId(target);
      return r.data;
    } catch (error) {
      clearResumePoint();
      throw error;
    }
  }

  async function postChat(text) {
    await ready;
    if (!currentRoomId) throw new Error("roomId is not set yet");
    const clean = String(text ?? "").trim().slice(0, 200);
    if (!clean) return;
    await push(ref(db, `rooms/${currentRoomId}/game/chat`), {
      authorId: currentUid, authorName: "あなた", text: clean, kind: "human", at: Date.now(),
    });
  }

  return {
    ready,
    createRoom,
    joinRoom,
    startGame,
    send,
    renameSelf,
    seatAiPlayers,
    advanceAiTurn,
    resumeRoom,
    getResumePoint: readResumePoint,
    clearResumePoint,
    postChat,
    onMeta: (cb) => subscribe("meta", cb),
    onPlayers: (cb) => subscribe("players", cb),
    onPublic: (cb) => subscribe("public", cb),
    onSelf: (cb) => subscribe("self", cb),
    onChat: (cb) => subscribe("chat", cb),
    get uid() {
      return currentUid;
    },
    get roomId() {
      return currentRoomId;
    },
  };
}
