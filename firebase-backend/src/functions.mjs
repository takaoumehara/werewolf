import { getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { onCall, HttpsError } from "firebase-functions/v2/https";

import { RepositoryError, createFirebaseRoomRepository }
  from "./firebase-room-repository.mjs";

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function invalid(message) {
  throw new HttpsError("invalid-argument", message);
}

function requireUid(request) {
  const uid = request?.auth?.uid;
  if (typeof uid !== "string" || uid.length === 0 || uid.length > 128) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }
  return uid;
}

function requireData(request, allowedKeys) {
  if (!isRecord(request?.data)) invalid("Request data must be a plain object");
  const data = request.data;
  for (const key of Object.keys(data)) {
    if (!allowedKeys.includes(key)) invalid(`Unexpected field: ${key}`);
  }
  return data;
}

function cleanName(value) {
  if (typeof value !== "string") invalid("name must be a string");
  const name = value.trim();
  if (name.length === 0 || name.length > 30) invalid("name must be between 1 and 30 characters");
  return name;
}

function cleanMaxPlayers(value) {
  if (!Number.isInteger(value) || value < 4 || value > 30) {
    invalid("maxPlayers must be an integer between 4 and 30");
  }
  return value;
}

function cleanRoomId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    invalid("roomId is invalid");
  }
  return value;
}

function cleanCode(value) {
  if (typeof value !== "string" || value.length > 32) invalid("code is invalid");
  const code = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z0-9]{6}$/.test(code)) invalid("code must contain 6 letters or digits");
  return code;
}

function cleanRoleIds(value) {
  if (!Array.isArray(value) || value.length < 4 || value.length > 30
    || value.some((roleId) => typeof roleId !== "string"
      || !/^[a-z][a-z0-9_]{0,63}$/.test(roleId))) {
    invalid("roleIds must contain between 4 and 30 valid role IDs");
  }
  return value.slice();
}

function cleanGmMode(value) {
  if (!["computer", "human_player", "human_observer"].includes(value)) {
    invalid("gmMode is invalid");
  }
  return value;
}

function cleanCommandId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    invalid("commandId is invalid");
  }
  return value;
}

function cleanCommandType(value) {
  if (typeof value !== "string" || !/^[A-Z][A-Z0-9_]{0,63}$/.test(value)) {
    invalid("type is invalid");
  }
  return value;
}

function cleanExpectedRevision(value) {
  if (!Number.isSafeInteger(value) || value < 0) invalid("expectedRevision is invalid");
  return value;
}

function cleanPayload(value) {
  if (!isRecord(value)) invalid("payload must be a plain object");
  let bytes = 0;
  const ancestors = new WeakSet();

  function visit(entry, depth) {
    if (depth > 8) invalid("payload is too deeply nested");
    if (entry === null || typeof entry === "boolean") return entry;
    if (typeof entry === "string") {
      bytes += new TextEncoder().encode(entry).byteLength;
      if (bytes > 16_384) invalid("payload is too large");
      return entry;
    }
    if (typeof entry === "number") {
      if (!Number.isFinite(entry)) invalid("payload numbers must be finite");
      return entry;
    }
    if (typeof entry !== "object" || entry === null || ancestors.has(entry)) {
      invalid("payload must be JSON-compatible");
    }
    ancestors.add(entry);
    let result;
    if (Array.isArray(entry)) {
      if (entry.length > 256) invalid("payload array is too large");
      result = entry.map((child) => visit(child, depth + 1));
    } else {
      if (!isRecord(entry) || Object.keys(entry).length > 128
        || Object.getOwnPropertySymbols(entry).length > 0) {
        invalid("payload must contain plain objects");
      }
      result = {};
      for (const [key, child] of Object.entries(entry)) {
        if (key.length === 0 || key.length > 128) invalid("payload key is invalid");
        bytes += new TextEncoder().encode(key).byteLength;
        Object.defineProperty(result, key, {
          value: visit(child, depth + 1),
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
    }
    ancestors.delete(entry);
    return result;
  }

  return visit(value, 0);
}

async function callService(action) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error instanceof RepositoryError) {
      throw new HttpsError(error.code, error.message);
    }
    throw new HttpsError("internal", "Internal server error");
  }
}

export function createFunctionHandlers(services) {
  return {
    async createSnapRoom(request) {
      const callerUid = requireUid(request);
      const data = requireData(request, ["name", "maxPlayers"]);
      const input = { name: cleanName(data.name), maxPlayers: cleanMaxPlayers(data.maxPlayers) };
      return callService(() => services.createRoom({ callerUid, input }));
    },

    async joinSnapRoom(request) {
      const callerUid = requireUid(request);
      const data = requireData(request, ["code", "name"]);
      const input = { code: cleanCode(data.code), name: cleanName(data.name) };
      return callService(() => services.joinRoom({ callerUid, input }));
    },

    async startWerewolfGame(request) {
      const callerUid = requireUid(request);
      const data = requireData(request, ["roomId", "roleIds", "gmMode"]);
      const input = {
        roomId: cleanRoomId(data.roomId),
        roleIds: cleanRoleIds(data.roleIds),
        gmMode: cleanGmMode(data.gmMode),
      };
      return callService(() => services.startGame({ callerUid, input }));
    },

    async dispatchWerewolfCommand(request) {
      const callerUid = requireUid(request);
      const data = requireData(request, [
        "roomId", "actorId", "commandId", "type", "payload", "expectedRevision",
      ]);
      const command = {
        roomId: cleanRoomId(data.roomId),
        commandId: cleanCommandId(data.commandId),
        type: cleanCommandType(data.type),
        payload: cleanPayload(data.payload === undefined ? {} : data.payload),
        expectedRevision: cleanExpectedRevision(data.expectedRevision),
      };
      return callService(() => services.dispatchCommand({ callerUid, request: command }));
    },
  };
}

export function createCallableFunctions({ handlers, onCall: register = onCall }) {
  return {
    createSnapRoom: register({ enforceAppCheck: true }, handlers.createSnapRoom),
    joinSnapRoom: register({ enforceAppCheck: true }, handlers.joinSnapRoom),
    startWerewolfGame: register({ enforceAppCheck: true }, handlers.startWerewolfGame),
    dispatchWerewolfCommand: register(
      { enforceAppCheck: true }, handlers.dispatchWerewolfCommand,
    ),
  };
}

let productionRepository;
function getProductionRepository() {
  if (!productionRepository) {
    const app = getApps()[0] ?? initializeApp();
    productionRepository = createFirebaseRoomRepository({ database: getDatabase(app) });
  }
  return productionRepository;
}

const productionServices = {
  createRoom: (request) => getProductionRepository().createRoom(request),
  joinRoom: (request) => getProductionRepository().joinRoom(request),
  startGame: (request) => getProductionRepository().startGame(request),
  dispatchCommand: (request) => getProductionRepository().dispatchCommand(request),
};
const callables = createCallableFunctions({ handlers: createFunctionHandlers(productionServices) });

export const createSnapRoom = callables.createSnapRoom;
export const joinSnapRoom = callables.joinSnapRoom;
export const startWerewolfGame = callables.startWerewolfGame;
export const dispatchWerewolfCommand = callables.dispatchWerewolfCommand;
