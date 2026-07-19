import { createGame, dispatch, toPublicView, toPlayerView }
  from "../../game-engine/src/engine.mjs";
import { createCommandEnvelope, buildPersistencePatch }
  from "../../game-engine/src/firebase-adapter-contract.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  return { ...patch, processedCommands: {} };
}

export function applyGameSessionCommand({ game, callerUid, request, now }) {
  assert(game.privateViews?.[callerUid], "Caller is not a game member");
  const command = createCommandEnvelope({
    id: request.commandId, actorId: callerUid, type: request.type,
    payload: request.payload ?? {}, expectedRevision: request.expectedRevision, now,
  });
  assert(/^[A-Za-z0-9_-]{1,128}$/.test(command.id), "Invalid command ID");
  const processedCommands = structuredClone(game.processedCommands ?? {});
  if (Object.hasOwn(processedCommands, command.id)) {
    const commandResult = structuredClone(processedCommands[command.id]);
    assert(Number.isSafeInteger(commandResult?.revision), "Invalid command receipt");
    assert(typeof commandResult?.phase === "string", "Invalid command receipt");
    return { game: structuredClone(game), commandResult, duplicate: true };
  }
  const result = dispatch(game.authoritative, command);
  const patch = buildPersistencePatch({ state: result.state, events: result.events,
    toPublicView, toPlayerView });
  const commandResult = { revision: patch.public.revision, phase: patch.public.phase };
  Object.defineProperty(processedCommands, command.id, {
    value: structuredClone(commandResult), enumerable: true,
    configurable: true, writable: true,
  });
  return {
    game: { ...patch, processedCommands },
    commandResult: structuredClone(commandResult),
    duplicate: false,
  };
}
