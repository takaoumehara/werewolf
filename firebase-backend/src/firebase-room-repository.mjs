import {
  randomInt as cryptoRandomInt,
  randomUUID as cryptoRandomUUID,
} from "node:crypto";

import { PAIRING_ALPHABET, buildRoomRecords, normalizePairingCode } from "./room-domain.mjs";
import { startGameSession, applyGameSessionCommand } from "./game-session-service.mjs";

const PAIRING_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 3;
const PAIRING_ATTEMPTS = 8;

export class RepositoryError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "RepositoryError";
    this.code = code;
  }
}

function fail(code, message, options) {
  return new RepositoryError(code, message, options);
}

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cleanName(value) {
  if (typeof value !== "string") throw fail("invalid-argument", "Player name is required");
  const name = value.trim();
  if (name.length === 0 || name.length > 30) {
    throw fail("invalid-argument", "Player name must be between 1 and 30 characters");
  }
  return name;
}

function cleanMaxPlayers(value) {
  if (!Number.isInteger(value) || value < 4 || value > 30) {
    throw fail("invalid-argument", "maxPlayers must be between 4 and 30");
  }
  return value;
}

function cleanRoomId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw fail("invalid-argument", "Invalid room ID");
  }
  return value;
}

function cleanRoleIds(value) {
  if (!Array.isArray(value) || value.length < 4 || value.length > 30
    || value.some((roleId) => typeof roleId !== "string"
      || !/^[a-z][a-z0-9_]{0,63}$/.test(roleId))) {
    throw fail("invalid-argument", "Invalid role IDs");
  }
  return value.slice();
}

function cleanGmMode(value) {
  if (!["computer", "human_player", "human_observer"].includes(value)) {
    throw fail("invalid-argument", "Invalid GM mode");
  }
  return value;
}

function pairingCode(randomInt) {
  return Array.from({ length: 6 }, () => PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)]).join("");
}

function translateError(error, fallbackCode = "internal") {
  if (error instanceof RepositoryError) return error;
  const message = error instanceof Error ? error.message : "Repository operation failed";
  const lower = message.toLowerCase();
  if (lower.includes("revision")) return fail("aborted", "Game command conflict", { cause: error });
  if (lower.includes("host") || lower.includes("member")) {
    return fail("permission-denied", "Caller is not allowed", { cause: error });
  }
  if (lower.includes("role") || lower.includes("player") || lower.includes("command")
    || lower.includes("payload") || lower.includes("json") || lower.includes("gm mode")) {
    return fail("invalid-argument", "Invalid game request", { cause: error });
  }
  if (lower.includes("phase") || lower.includes("waiting") || lower.includes("alive")
    || lower.includes("cannot") || lower.includes("may ") || lower.includes("only ")) {
    return fail("failed-precondition", "Game state does not allow this operation", { cause: error });
  }
  return fail(fallbackCode, "Repository operation failed", { cause: error });
}

function assertRoster(room, roleIds) {
  if (!isRecord(room.meta) || !isRecord(room.players) || !isRecord(room.joinState)
    || !isRecord(room.joinState.members)) {
    throw fail("failed-precondition", "Room roster is invalid");
  }
  const entries = Object.entries(room.players);
  if (entries.length < 4 || entries.length > 30) {
    throw fail("failed-precondition", "Room must have between 4 and 30 players");
  }
  if (roleIds.length !== entries.length) {
    throw fail("invalid-argument", "Role count must match player count");
  }
  if (room.joinState.count !== entries.length
    || entries.some(([uid, player]) => !Object.hasOwn(room.joinState.members, uid)
      || room.joinState.members[uid] !== true
      || !isRecord(player) || player.id !== uid || typeof player.name !== "string")) {
    throw fail("failed-precondition", "Room roster membership is inconsistent");
  }
}

async function cleanupReservation(database, code, roomId) {
  try {
    await database.ref(`pairingCodes/${code}`).transaction((current) => {
      if (!isRecord(current) || current.roomId !== roomId) return undefined;
      return null;
    });
  } catch {
    // A failed conditional cleanup is safe to leave for the short pairing-code TTL.
  }
}

export function createFirebaseRoomRepository({
  database,
  now = Date.now,
  randomInt = cryptoRandomInt,
  randomUUID = cryptoRandomUUID,
  pairingAttempts = PAIRING_ATTEMPTS,
  rateLimitWindowMs = RATE_LIMIT_WINDOW_MS,
  rateLimitMax = RATE_LIMIT_MAX,
} = {}) {
  if (!database || typeof database.ref !== "function") {
    throw new TypeError("database is required");
  }

  return {
    async createRoom({ callerUid, input }) {
      const timestamp = now();
      const roomId = randomUUID();
      const name = cleanName(input?.name);
      const maxPlayers = cleanMaxPlayers(input?.maxPlayers);
      const rateRef = database.ref(`roomCreateRateLimits/${callerUid}`);
      const rate = await rateRef.transaction((current) => {
        if (!isRecord(current) || !Number.isSafeInteger(current.windowStartedAt)
          || !Number.isSafeInteger(current.count)
          || timestamp - current.windowStartedAt >= rateLimitWindowMs) {
          return { windowStartedAt: timestamp, count: 1 };
        }
        if (current.count >= rateLimitMax) return undefined;
        return { windowStartedAt: current.windowStartedAt, count: current.count + 1 };
      });
      if (!rate.committed) throw fail("resource-exhausted", "Room creation rate limit exceeded");

      const expiresAt = timestamp + PAIRING_TTL_MS;
      let reservedCode;
      let records;
      for (let attempt = 0; attempt < pairingAttempts; attempt += 1) {
        const candidate = pairingCode(randomInt);
        const candidateRecords = buildRoomRecords({
          roomId, code: candidate, uid: callerUid, name, maxPlayers,
          now: timestamp, expiresAt,
        });
        const reservation = await database.ref(`pairingCodes/${candidate}`).transaction((current) => (
          current === null ? candidateRecords.pairing : undefined
        ));
        if (reservation.committed) {
          reservedCode = candidate;
          records = candidateRecords;
          break;
        }
      }
      if (!reservedCode) throw fail("resource-exhausted", "Unable to allocate pairing code");

      try {
        await database.ref().update({
          [`rooms/${roomId}`]: records.room,
          [`roomMembers/${roomId}/${callerUid}`]: true,
          [`pairingCodes/${reservedCode}`]: records.pairing,
        });
      } catch (error) {
        await cleanupReservation(database, reservedCode, roomId);
        throw fail("unavailable", "Unable to create room", { cause: error });
      }
      return { roomId, code: reservedCode, expiresAt };
    },

    async joinRoom({ callerUid, input }) {
      let code;
      try {
        code = normalizePairingCode(input?.code);
      } catch (error) {
        throw fail("invalid-argument", "Invalid pairing code", { cause: error });
      }
      const name = cleanName(input?.name);
      const timestamp = now();
      const pairing = (await database.ref(`pairingCodes/${code}`).get()).val();
      if (!isRecord(pairing) || typeof pairing.roomId !== "string") {
        throw fail("not-found", "Pairing code not found");
      }
      const roomId = cleanRoomId(pairing.roomId);
      const roomRef = database.ref(`rooms/${roomId}`);
      let transaction;
      try {
        transaction = await roomRef.transaction((room) => {
          if (!isRecord(room) || !isRecord(room.meta) || !isRecord(room.joinState)
            || !isRecord(room.joinState.members)) {
            throw fail("not-found", "Room not found");
          }
          if (room.meta.status !== "waiting") {
            throw fail("failed-precondition", "Room is not waiting");
          }
          if (!Number.isSafeInteger(pairing.expiresAt) || timestamp >= pairing.expiresAt) {
            throw fail("deadline-exceeded", "Pairing code expired");
          }
          const maxPlayers = cleanMaxPlayers(room.meta.maxPlayers);
          if (!Number.isSafeInteger(room.joinState.count) || room.joinState.count < 1) {
            throw fail("failed-precondition", "Room join state is invalid");
          }
          const existing = Object.hasOwn(room.joinState.members, callerUid)
            && room.joinState.members[callerUid] === true;
          if (!existing && room.joinState.count >= maxPlayers) {
            throw fail("resource-exhausted", "Room is full");
          }
          const count = existing ? room.joinState.count : room.joinState.count + 1;
          const members = existing
            ? { ...room.joinState.members }
            : { ...room.joinState.members, [callerUid]: true };
          return {
            ...room,
            meta: { ...room.meta, participantCount: count, updatedAt: timestamp },
            joinState: { ...room.joinState, count, members },
          };
        });
      } catch (error) {
        throw translateError(error, "failed-precondition");
      }
      if (!transaction.committed) throw fail("aborted", "Unable to join room");
      const committedRoom = transaction.snapshot.val();
      const count = committedRoom.joinState.count;
      const existingPlayer = isRecord(committedRoom.players?.[callerUid])
        ? committedRoom.players[callerUid] : undefined;
      const joinedAt = Number.isSafeInteger(existingPlayer?.joinedAt)
        ? existingPlayer.joinedAt : timestamp;
      try {
        await database.ref().update({
          [`roomMembers/${roomId}/${callerUid}`]: true,
          [`rooms/${roomId}/players/${callerUid}`]: {
            id: callerUid,
            name,
            role: callerUid === committedRoom.meta.hostId ? "host" : "participant",
            connected: true,
            joinedAt,
            lastSeenAt: timestamp,
          },
          [`rooms/${roomId}/meta/participantCount`]: count,
          [`rooms/${roomId}/meta/updatedAt`]: timestamp,
        });
      } catch (error) {
        throw fail("unavailable", "Unable to repair room membership", { cause: error });
      }
      return { roomId };
    },

    async startGame({ callerUid, input }) {
      const roomId = cleanRoomId(input?.roomId);
      const roleIds = cleanRoleIds(input?.roleIds);
      const gmMode = cleanGmMode(input?.gmMode);
      const timestamp = now();
      const seed = randomInt(1, 0x7fffffff);
      let transaction;
      try {
        transaction = await database.ref(`rooms/${roomId}`).transaction((room) => {
          if (!isRecord(room) || !isRecord(room.meta)) throw fail("not-found", "Room not found");
          if (room.meta.hostId !== callerUid) throw fail("permission-denied", "Only the host may start");
          if (room.meta.status !== "waiting") {
            throw fail("failed-precondition", "Room is not waiting");
          }
          assertRoster(room, roleIds);
          let game;
          try {
            game = startGameSession({
              roomId, callerUid, roomMeta: room.meta, players: room.players,
              roleIds, gmMode, seed, now: timestamp,
            });
          } catch (error) {
            throw translateError(error, "invalid-argument");
          }
          return {
            ...room,
            meta: { ...room.meta, status: "playing", updatedAt: timestamp },
            game,
          };
        });
      } catch (error) {
        throw translateError(error, "failed-precondition");
      }
      if (!transaction.committed) throw fail("aborted", "Unable to start game");
      const committed = transaction.snapshot.val();
      if (!isRecord(committed?.game?.public)) throw fail("internal", "Invalid committed game");
      return {
        roomId,
        revision: committed.game.public.revision,
        phase: committed.game.public.phase,
      };
    },

    async dispatchCommand({ callerUid, request }) {
      const roomId = cleanRoomId(request?.roomId);
      const timestamp = now();
      let transaction;
      try {
        transaction = await database.ref(`rooms/${roomId}/game`).transaction((game) => {
          if (!isRecord(game)) throw fail("not-found", "Game not found");
          try {
            return applyGameSessionCommand({ game, callerUid, request, now: timestamp }).game;
          } catch (error) {
            throw translateError(error, "failed-precondition");
          }
        });
      } catch (error) {
        throw translateError(error, "failed-precondition");
      }
      if (!transaction.committed) throw fail("aborted", "Game command conflict");
      const committed = transaction.snapshot.val();
      const receipt = committed?.processedCommands?.[request.commandId];
      if (!isRecord(receipt) || !Number.isSafeInteger(receipt.revision)
        || typeof receipt.phase !== "string") {
        throw fail("internal", "Committed command receipt is missing");
      }
      return { revision: receipt.revision, phase: receipt.phase };
    },
  };
}
