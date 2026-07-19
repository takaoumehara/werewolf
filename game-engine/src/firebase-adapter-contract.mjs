/**
 * Firebase の Cloud Function とドメインエンジンの境界に置く契約です。
 *
 * このファイルは Firebase SDK に依存しません。Firebase 側の処理は、ここで
 * 作った plain object を Realtime Database の transaction/update に渡します。
 */

export class AdapterContractError extends TypeError {
  constructor(message) {
    super(message);
    this.name = "AdapterContractError";
  }
}

function assert(condition, message) {
  if (!condition) throw new AdapterContractError(message);
}

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function assertNonEmptyString(value, field) {
  assert(typeof value === "string" && value.trim().length > 0, `${field} must be a non-empty string`);
}

function validateCommand(command) {
  assert(isRecord(command), "command must be an object");
  assertNonEmptyString(command.id, "command.id");
  assertNonEmptyString(command.actorId, "command.actorId");
  assertNonEmptyString(command.type, "command.type");
  assert(Number.isSafeInteger(command.expectedRevision) && command.expectedRevision >= 0,
    "command.expectedRevision must be a non-negative integer");
  assert(Number.isSafeInteger(command.now) && command.now >= 0,
    "command.now must be a non-negative integer timestamp");
  assert(isRecord(command.payload), "command.payload must be an object");
}

/**
 * クライアントから受けた値を、サーバーで検証して保存可能なコマンドへする。
 * payload は省略時に空のオブジェクトへ正規化する。時刻はクライアント値を
 * 信頼せず、呼び出し側（通常はCloud Function）がサーバー時刻を渡す。
 */
export function createCommandEnvelope({
  id,
  actorId,
  type,
  payload = {},
  expectedRevision,
  now,
} = {}) {
  const command = { id, actorId, type, payload, expectedRevision, now };
  validateCommand(command);
  return clone(command);
}

function assertProcessedCommandsStore(processedCommands) {
  assert(processedCommands instanceof Map || isRecord(processedCommands),
    "processedCommands must be a Map or an object record");
}

function hasProcessedCommand(processedCommands, commandId) {
  if (processedCommands instanceof Map) return processedCommands.has(commandId);
  return Object.prototype.hasOwnProperty.call(processedCommands, commandId);
}

function readProcessedCommand(processedCommands, commandId) {
  return processedCommands instanceof Map
    ? processedCommands.get(commandId)
    : processedCommands[commandId];
}

function writeProcessedCommand(processedCommands, commandId, result) {
  if (processedCommands instanceof Map) {
    processedCommands.set(commandId, result);
  } else {
    // Object.prototype に由来するキーを上書きしないため、代入ではなくdefineを使う。
    Object.defineProperty(processedCommands, commandId, {
      value: result,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
}

function validateDispatchResult(result) {
  assert(isRecord(result), "dispatch must return an object");
  assert(isRecord(result.state), "dispatch result.state must be an object");
  assert(Array.isArray(result.events), "dispatch result.events must be an array");
}

function publicCause(cause) {
  if (["execution", "dictator_execution"].includes(cause)) return "execution";
  if (["werewolf_attack", "tough_guy_wounds"].includes(cause)) return "night_attack";
  return "other";
}

function toPublicEvent(entry) {
  const payload = entry?.payload ?? {};
  let safePayload = {};
  switch (entry?.type) {
    case "GAME_STARTED":
    case "NIGHT_STARTED":
    case "VOTE_STARTED":
    case "GAME_WON":
      safePayload = { ...payload };
      break;
    case "DAY_STARTED":
      safePayload = { round: payload.round };
      break;
    case "PLAYER_DIED":
      safePayload = { playerId: payload.playerId, cause: publicCause(payload.cause) };
      break;
    case "VOTE_RESOLVED":
      safePayload = { executedPlayerId: payload.executedPlayerId ?? null };
      break;
    default:
      safePayload = {};
  }
  return { id: entry.id, type: entry.type, payload: safePayload, at: entry.at };
}

/**
 * コマンドを一度だけ適用する。processedCommands は transaction の中で読み書き
 * できる台帳（MapまたはJSON化可能なrecord）を想定する。
 *
 * 再送された command.id は dispatch を呼ばず、最初に保存した結果を返す。その
 * 結果もcloneして返すため、呼び出し側が返却値を変更しても台帳が汚染されない。
 */
export function applyCommandOnce({ state, command, dispatch, processedCommands = new Map() } = {}) {
  assert(isRecord(state), "state must be an object");
  validateCommand(command);
  assert(typeof dispatch === "function", "dispatch must be a function");
  assertProcessedCommandsStore(processedCommands);

  if (hasProcessedCommand(processedCommands, command.id)) {
    const previous = readProcessedCommand(processedCommands, command.id);
    // 「処理済み」フラグだけを保存した台帳では結果を再現できず、安全に再送を
    // 処理できないため、resultまで保存することを契約にする。
    validateDispatchResult(previous);
    return clone(previous);
  }

  const result = dispatch(state, command);
  validateDispatchResult(result);
  const persistedResult = clone(result);
  writeProcessedCommand(processedCommands, command.id, persistedResult);
  return clone(persistedResult);
}

/**
 * Firebase の multi-location update に渡す値を組み立てる。
 *
 * - public: 全員に見せるビュー
 * - privateViews: playerIdごとの秘密ビュー
 * - authoritative: サーバー専用の完全状態
 * - events: 今回の遷移で追加されたイベント
 */
export function buildPersistencePatch({
  state,
  events,
  toPublicView,
  toPlayerView,
} = {}) {
  assert(isRecord(state), "state must be an object");
  assert(Array.isArray(events), "events must be an array");
  assert(typeof toPublicView === "function", "toPublicView must be a function");
  assert(typeof toPlayerView === "function", "toPlayerView must be a function");

  const players = state.players ?? {};
  assert(isRecord(players), "state.players must be an object");

  const privateViews = {};
  for (const playerId of Object.keys(players).sort()) {
    privateViews[playerId] = clone(toPlayerView(state, playerId));
  }

  return {
    public: clone(toPublicView(state)),
    privateViews,
    authoritative: clone(state),
    events: clone(events),
    // `events` is server-only. Only this filtered stream may be published to
    // a room-wide subscription.
    publicEvents: clone(events.map(toPublicEvent)),
  };
}
