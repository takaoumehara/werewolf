import { createGame, dispatch, toPublicView, toPlayerView }
  from "../../game-engine/src/engine.mjs";
import { createCommandEnvelope, buildPersistencePatch }
  from "../../game-engine/src/firebase-adapter-contract.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function define(target, key, value) {
  Object.defineProperty(target, key, {
    value, enumerable: true, configurable: true, writable: true,
  });
}

function toJsonCompatible(input) {
  const ancestors = new WeakSet();

  function normalize(value, path) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      assert(Number.isFinite(value), `${path} must be JSON-compatible`);
      return value;
    }
    assert(typeof value === "object" && value !== null, `${path} must be JSON-compatible`);
    assert(!ancestors.has(value), `${path} must be JSON-compatible`);
    ancestors.add(value);

    let normalized;
    if (Array.isArray(value)) {
      normalized = Array.from(value, (entry, index) => (
        entry === undefined ? null : normalize(entry, `${path}[${index}]`)
      ));
    } else {
      assert(isRecord(value), `${path} must be JSON-compatible`);
      assert(Object.getOwnPropertySymbols(value).length === 0, `${path} must be JSON-compatible`);
      normalized = {};
      for (const key of Object.keys(value)) {
        if (value[key] !== undefined) define(normalized, key, normalize(value[key], `${path}.${key}`));
      }
    }

    ancestors.delete(value);
    return normalized;
  }

  return normalize(input, "game");
}

function assertCommandId(commandId) {
  assert(/^[A-Za-z0-9_-]{1,128}$/.test(commandId), "Invalid command ID");
}

function assertEventId(eventId) {
  assert(typeof eventId === "string" && eventId.length > 0
    && new TextEncoder().encode(eventId).byteLength <= 768
    && !/[.#$\[\]\/\u0000-\u001f\u007f]/u.test(eventId), "Invalid event ID");
}

function appendEventLog(existingLog, deltaEvents) {
  const log = {};
  const append = (event, expectedId) => {
    assert(isRecord(event), "Invalid event");
    assertEventId(event.id);
    if (expectedId !== undefined) assert(event.id === expectedId, "Invalid event ID");
    assert(!Object.hasOwn(log, event.id), "Duplicate event ID");
    define(log, event.id, event);
  };

  if (existingLog !== undefined && existingLog !== null) {
    if (Array.isArray(existingLog)) {
      existingLog.forEach((event) => append(event));
    } else {
      assert(isRecord(existingLog), "Invalid event log");
      Object.entries(existingLog).forEach(([eventId, event]) => append(event, eventId));
    }
  }
  assert(Array.isArray(deltaEvents), "Invalid event delta");
  deltaEvents.forEach((event) => append(event));
  return log;
}

function compactReceipt(receipt) {
  assert(isRecord(receipt), "Invalid command receipt");
  assert(Number.isSafeInteger(receipt.revision) && receipt.revision >= 0,
    "Invalid command receipt");
  assert(typeof receipt.phase === "string" && receipt.phase.length > 0,
    "Invalid command receipt");
  return { revision: receipt.revision, phase: receipt.phase };
}

function normalizeProcessedCommands(input) {
  assert(isRecord(input), "Invalid processed commands");
  const normalized = {};
  for (const [commandId, receipt] of Object.entries(input)) {
    assertCommandId(commandId);
    define(normalized, commandId, compactReceipt(receipt));
  }
  return normalized;
}

function ownValue(record, key) {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function recordOrEmpty(value, path) {
  if (value === undefined || value === null) return {};
  assert(isRecord(value), `${path} must be an object`);
  const record = {};
  for (const [key, entry] of Object.entries(value)) define(record, key, entry);
  return record;
}

function arrayOrEmpty(value, path) {
  if (value === undefined || value === null) return [];
  assert(Array.isArray(value), `${path} must be an array`);
  return value.slice();
}

function hydrateAuthoritativeState(snapshot) {
  assert(isRecord(snapshot), "Invalid authoritative state");
  const source = toJsonCompatible(snapshot);
  const sourcePlayers = ownValue(source, "players");
  assert(isRecord(sourcePlayers), "authoritative.players must be an object");

  const players = {};
  for (const [playerId, player] of Object.entries(sourcePlayers)) {
    assert(isRecord(player), `authoritative.players.${playerId} must be an object`);
    const hydratedPlayer = {};
    for (const [key, value] of Object.entries(player)) define(hydratedPlayer, key, value);
    define(hydratedPlayer, "flags",
      recordOrEmpty(ownValue(player, "flags"), `authoritative.players.${playerId}.flags`));
    define(hydratedPlayer, "death", ownValue(player, "death") ?? null);
    define(players, playerId, hydratedPlayer);
  }

  const sourceRoleState = recordOrEmpty(ownValue(source, "roleState"),
    "authoritative.roleState");
  const roleState = {};
  for (const [key, value] of Object.entries(sourceRoleState)) define(roleState, key, value);
  for (const key of ["privateResults", "lovers", "twins", "betrayalTwins", "traps"]) {
    define(roleState, key,
      recordOrEmpty(ownValue(sourceRoleState, key), `authoritative.roleState.${key}`));
  }
  define(roleState, "lastExecution", ownValue(sourceRoleState, "lastExecution") ?? null);

  const state = {};
  for (const [key, value] of Object.entries(source)) define(state, key, value);
  define(state, "players", players);
  define(state, "pendingActions",
    recordOrEmpty(ownValue(source, "pendingActions"), "authoritative.pendingActions"));
  define(state, "pendingVotes",
    recordOrEmpty(ownValue(source, "pendingVotes"), "authoritative.pendingVotes"));
  define(state, "history", arrayOrEmpty(ownValue(source, "history"), "authoritative.history"));
  define(state, "roleState", roleState);
  for (const key of ["deadlineAt", "winner", "lastAttack"]) {
    define(state, key, ownValue(source, key) ?? null);
  }
  return state;
}

function normalizeStoredGame(game) {
  return toJsonCompatible({
    ...game,
    events: appendEventLog(game.events, []),
    publicEvents: appendEventLog(game.publicEvents, []),
    processedCommands: normalizeProcessedCommands(game.processedCommands ?? {}),
  });
}

export function startGameSession({
  roomId, callerUid, roomMeta, players, roleIds, gmMode, seed, now,
}) {
  assert(roomMeta.hostId === callerUid, "Only the host may start the game");
  assert(roomMeta.status === "waiting", "Room is not waiting");
  const roster = Object.values(players).map((player) => ({
    id: player.id, displayName: player.name, joinedAt: player.joinedAt ?? now,
  }));
  let state = createGame({ gameId: roomId, players: roster, roleIds, gmMode,
    seed, hostId: roomMeta.hostId });
  ({ state } = dispatch(state, { id: "start", actorId: callerUid, type: "START_GAME",
    payload: {}, expectedRevision: state.revision, now }));
  const patch = buildPersistencePatch({ state, events: state.history,
    toPublicView, toPlayerView });
  return normalizeStoredGame({ ...patch, processedCommands: {} });
}

export function applyGameSessionCommand({ game, callerUid, request, now }) {
  assert(Object.hasOwn(game.privateViews ?? {}, callerUid), "Caller is not a game member");
  const command = createCommandEnvelope({
    id: request.commandId, actorId: callerUid, type: request.type,
    payload: request.payload ?? {}, expectedRevision: request.expectedRevision, now,
  });
  assertCommandId(command.id);
  const authoritative = hydrateAuthoritativeState(game.authoritative);
  const processedCommands = normalizeProcessedCommands(game.processedCommands ?? {});
  if (Object.hasOwn(processedCommands, command.id)) {
    const commandResult = compactReceipt(processedCommands[command.id]);
    const currentViews = buildPersistencePatch({ state: authoritative, events: [],
      toPublicView, toPlayerView });
    return {
      game: normalizeStoredGame({
        ...game,
        public: currentViews.public,
        privateViews: currentViews.privateViews,
        authoritative,
        processedCommands,
      }),
      commandResult,
      duplicate: true,
    };
  }
  const result = dispatch(authoritative, command);
  const patch = buildPersistencePatch({ state: result.state, events: result.events,
    toPublicView, toPlayerView });
  const commandResult = { revision: patch.public.revision, phase: patch.public.phase };
  define(processedCommands, command.id, commandResult);
  return {
    game: normalizeStoredGame({
      ...patch,
      events: appendEventLog(game.events, patch.events),
      publicEvents: appendEventLog(game.publicEvents, patch.publicEvents),
      processedCommands,
    }),
    commandResult: structuredClone(commandResult),
    duplicate: false,
  };
}
