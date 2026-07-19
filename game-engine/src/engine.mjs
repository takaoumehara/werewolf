import { seededShuffle } from "./random.mjs";
import { ROLE_DEFINITIONS, ROLE_IDS, getRoleDefinition, isKillingWerewolf } from "./roles.mjs";

const PHASES = new Set(["lobby", "role_reveal", "night", "day", "vote", "finished"]);
const NIGHT_ACTIONS = new Set(["attack", "protect", "divine", "medium"]);

export class InvalidCommandError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidCommandError";
  }
}

function assert(condition, message) {
  if (!condition) throw new InvalidCommandError(message);
}

function clone(value) {
  return structuredClone(value);
}

function event(state, type, payload, now) {
  return { id: `${state.revision + 1}:${type}`, type, payload, at: now };
}

function alivePlayers(state) {
  return Object.values(state.players).filter((player) => player.alive);
}

function playerById(state, playerId) {
  const player = state.players[playerId];
  assert(player, `Unknown player: ${playerId}`);
  return player;
}

function assertHostActor(state, actorId) {
  const firstPlayer = Object.keys(state.players).sort()[0];
  assert(actorId === firstPlayer, "Only the room host may advance the game");
}

function kill(state, playerId, cause, events, now) {
  const player = playerById(state, playerId);
  if (!player.alive) return;
  player.alive = false;
  player.death = { cause, round: state.round };
  if (player.roleId === "lovers") {
    const partnerId = state.roleState.lovers?.[playerId];
    if (partnerId) kill(state, partnerId, "lover_grief", events, now);
  }
  events.push(event(state, "PLAYER_DIED", { playerId, cause }, now));
}

function winners(state) {
  const alive = alivePlayers(state);
  const foxAlive = alive.some((player) => player.team === "fox");
  const wolves = alive.filter(isKillingWerewolf);
  const citizens = alive.filter((player) => player.team === "citizen");
  const teams = [];
  if (wolves.length === 0) teams.push("citizen");
  if (wolves.length > 0 && wolves.length >= citizens.length) teams.push("werewolf");
  if (teams.length === 0 && alive.length === 1 && alive[0].roleId === "android") teams.push("android");
  if (teams.length > 0 && foxAlive) teams.push("fox");
  return teams;
}

function checkWin(state, events, now) {
  const teams = winners(state);
  if (teams.length === 0) return;
  state.phase = "finished";
  state.deadlineAt = null;
  state.winner = { teams, reason: "win_condition" };
  events.push(event(state, "GAME_WON", { teams }, now));
}

function validateTarget(state, actorId, targetId) {
  const target = playerById(state, targetId);
  assert(target.alive, "Target must be alive");
  assert(targetId !== actorId, "Self-targeting is not allowed");
  return target;
}

function applyNight(state, events, now) {
  const actions = Object.values(state.pendingActions).sort((a, b) => a.actorId.localeCompare(b.actorId));
  const protectIds = new Set(actions.filter((a) => a.kind === "protect").map((a) => a.targetId));
  const attacks = actions.filter((a) => a.kind === "attack");
  const attack = attacks[0];
  if (attack && !protectIds.has(attack.targetId)) {
    kill(state, attack.targetId, "werewolf_attack", events, now);
    state.lastAttack = { targetId: attack.targetId, protected: false };
  } else if (attack) {
    state.lastAttack = { targetId: attack.targetId, protected: true };
    events.push(event(state, "ATTACK_BLOCKED", { targetId: attack.targetId }, now));
  }
  for (const action of actions.filter((candidate) => candidate.kind === "divine")) {
    const target = state.players[action.targetId];
    state.roleState.privateResults[action.actorId] ??= [];
    state.roleState.privateResults[action.actorId].push({
      type: "divine", targetId: target.id, result: target.team === "werewolf" ? "werewolf" : "human",
    });
    events.push(event(state, "PRIVATE_RESULT", { playerId: action.actorId, type: "divine" }, now));
  }
  for (const action of actions.filter((candidate) => candidate.kind === "medium")) {
    const execution = state.roleState.lastExecution;
    const target = execution ? state.players[execution.playerId] : null;
    state.roleState.privateResults[action.actorId] ??= [];
    state.roleState.privateResults[action.actorId].push({
      type: "medium", targetId: target?.id ?? null, result: target?.team === "werewolf" ? "werewolf" : target ? "human" : "none",
    });
  }
  state.pendingActions = {};
  state.phase = "day";
  state.deadlineAt = null;
  events.push(event(state, "DAY_STARTED", { round: state.round, attack: state.lastAttack ?? null }, now));
  checkWin(state, events, now);
}

export function createGame({ gameId, players, seed = 1, roleIds = [], gmMode = "computer" }) {
  assert(Array.isArray(players) && players.length > 0, "At least one player is required");
  assert(new Set(players.map((player) => player.id)).size === players.length, "Player IDs must be unique");
  const selectedRoles = roleIds.length > 0 ? roleIds : players.map(() => "citizen");
  assert(selectedRoles.length === players.length, "Role count must match player count");
  selectedRoles.forEach((roleId) => getRoleDefinition(roleId));
  assert(["computer", "human_player", "human_observer"].includes(gmMode), "Unknown GM mode");
  const shuffledRoles = seededShuffle(selectedRoles, seed);
  const playerRecords = Object.fromEntries(players.map((player, index) => {
    const roleId = shuffledRoles[index];
    const role = getRoleDefinition(roleId);
    return [player.id, {
      id: player.id, displayName: player.displayName, roleId, team: role.team, alive: true,
      joinedAt: player.joinedAt ?? 0, death: null, flags: {},
    }];
  }));
  return {
    gameId, revision: 0, seed, gmMode, phase: "lobby", round: 0, deadlineAt: null,
    players: playerRecords, roleState: { privateResults: {}, lovers: {}, lastExecution: null },
    pendingActions: {}, pendingVotes: {}, winner: null, history: [], lastAttack: null,
  };
}

export function dispatch(inputState, command) {
  const state = clone(inputState);
  assert(PHASES.has(state.phase), "Invalid game phase");
  assert(command.expectedRevision === state.revision, `revision mismatch: expected ${state.revision}`);
  playerById(state, command.actorId);
  const events = [];
  const now = command.now ?? Date.now();

  switch (command.type) {
    case "START_GAME":
      assertHostActor(state, command.actorId);
      assert(state.phase === "lobby", "Game has already started");
      state.phase = "role_reveal";
      events.push(event(state, "GAME_STARTED", { gmMode: state.gmMode }, now));
      break;
    case "BEGIN_NIGHT":
      assertHostActor(state, command.actorId);
      assert(state.phase === "role_reveal" || state.phase === "day", "Night cannot begin now");
      state.phase = "night";
      state.round += 1;
      state.pendingActions = {};
      state.lastAttack = null;
      events.push(event(state, "NIGHT_STARTED", { round: state.round }, now));
      break;
    case "SUBMIT_NIGHT_ACTION": {
      assert(state.phase === "night", "Night action is closed");
      const actor = playerById(state, command.actorId);
      assert(actor.alive, "Dead players cannot act");
      const { kind, targetId } = command.payload ?? {};
      assert(NIGHT_ACTIONS.has(kind), "Unknown night action");
      const role = getRoleDefinition(actor.roleId);
      assert(role.actions.includes(kind), "Role cannot perform this action");
      validateTarget(state, command.actorId, targetId);
      state.pendingActions[command.actorId] = { actorId: command.actorId, kind, targetId };
      events.push(event(state, "NIGHT_ACTION_SUBMITTED", { playerId: command.actorId, kind }, now));
      break;
    }
    case "RESOLVE_NIGHT":
      assertHostActor(state, command.actorId);
      assert(state.phase === "night", "Night is not active");
      applyNight(state, events, now);
      break;
    case "START_VOTE":
      assertHostActor(state, command.actorId);
      assert(state.phase === "day", "Voting cannot begin now");
      state.phase = "vote";
      state.pendingVotes = {};
      events.push(event(state, "VOTE_STARTED", { round: state.round }, now));
      break;
    case "CAST_VOTE": {
      assert(state.phase === "vote", "Voting is closed");
      const actor = playerById(state, command.actorId);
      assert(actor.alive, "Dead players cannot vote");
      const targetId = command.payload?.targetId ?? null;
      if (targetId !== null) validateTarget(state, command.actorId, targetId);
      state.pendingVotes[command.actorId] = targetId;
      events.push(event(state, "VOTE_CAST", { playerId: command.actorId }, now));
      break;
    }
    case "RESOLVE_VOTE": {
      assertHostActor(state, command.actorId);
      assert(state.phase === "vote", "Voting is not active");
      const counts = {};
      for (const targetId of Object.values(state.pendingVotes)) {
        if (targetId) counts[targetId] = (counts[targetId] ?? 0) + 1;
      }
      const ordered = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      const tied = ordered.length > 1 && ordered[0][1] === ordered[1][1];
      if (ordered.length > 0 && !tied) {
        const [targetId] = ordered[0];
        kill(state, targetId, "execution", events, now);
        state.roleState.lastExecution = { playerId: targetId, round: state.round };
      }
      state.pendingVotes = {};
      state.phase = "day";
      events.push(event(state, "VOTE_RESOLVED", { executedPlayerId: tied || ordered.length === 0 ? null : ordered[0][0] }, now));
      checkWin(state, events, now);
      break;
    }
    case "END_DAY":
      assertHostActor(state, command.actorId);
      assert(state.phase === "day", "Day is not active");
      assert(!state.winner, "Game has ended");
      state.phase = "night";
      state.round += 1;
      state.pendingActions = {};
      state.lastAttack = null;
      events.push(event(state, "NIGHT_STARTED", { round: state.round }, now));
      break;
    default:
      throw new InvalidCommandError(`Unknown command: ${command.type}`);
  }

  state.revision += 1;
  state.history.push(...events);
  return { state, events };
}

export function toPublicView(state) {
  return {
    gameId: state.gameId, revision: state.revision, gmMode: state.gmMode,
    phase: state.phase, round: state.round, deadlineAt: state.deadlineAt,
    players: Object.fromEntries(Object.entries(state.players).map(([id, player]) => [id, {
      id, displayName: player.displayName, alive: player.alive, death: player.death,
    }])),
    pendingVoteCount: Object.keys(state.pendingVotes).length,
    winner: state.winner,
  };
}

export function toPlayerView(state, playerId) {
  const self = playerById(state, playerId);
  const view = toPublicView(state);
  view.self = {
    id: self.id, displayName: self.displayName, roleId: self.roleId, team: self.team,
    alive: self.alive, death: self.death,
    privateResults: clone(state.roleState.privateResults[playerId] ?? []),
  };
  return view;
}

export { ROLE_DEFINITIONS, ROLE_IDS };
