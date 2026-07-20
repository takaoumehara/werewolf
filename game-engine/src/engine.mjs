import { seededShuffle } from "./random.mjs";
import { ROLE_DEFINITIONS, ROLE_IDS, getRoleDefinition, isKillingWerewolf } from "./roles.mjs";

const PHASES = new Set(["lobby", "role_reveal", "night", "day", "vote", "finished"]);
const NIGHT_ACTIONS = new Set(["attack", "protect", "divine", "medium", "trap", "swap", "calm", "oracle", "choose_copy", "relay"]);

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
  state.eventSequence = (state.eventSequence ?? 0) + 1;
  return { id: `${state.revision + 1}:${state.eventSequence}:${type}`, type, payload, at: now };
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
  assert(actorId === state.hostId, "Only the room host may advance the game");
  assert(state.players[actorId]?.alive, "A dead host cannot advance the game");
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
  // Android has an independent, single-survivor victory condition.  It must
  // be checked before the ordinary citizen/fox team conditions: otherwise a
  // lone android would also satisfy "no werewolves" and be reported as a
  // citizen/fox win.
  if (alive.length === 1 && alive[0].roleId === "android") return ["android"];

  const androidAlive = alive.some((player) => player.roleId === "android");
  const foxAlive = alive.some((player) => player.roleId === "mysterious_fox");
  const wolves = alive.filter(isKillingWerewolf);
  const citizens = alive.filter((player) => player.team === "citizen");
  const teams = [];
  // An android is not part of the citizen team and needs the game to remain
  // active while it pursues its solo objective.  In particular, an
  // android+citizen setup must reach the vote phase instead of ending during
  // the first quiet night.
  if (wolves.length === 0 && !androidAlive) teams.push("citizen");
  if (wolves.length > 0 && wolves.length >= citizens.length) teams.push("werewolf");
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

function setDeadline(state, phase, now) {
  const duration = state.phaseDurations?.[phase];
  state.deadlineAt = Number.isFinite(duration) && duration > 0 ? now + duration : null;
}

function validateTarget(state, actorId, targetId) {
  const target = playerById(state, targetId);
  assert(target.alive, "Target must be alive");
  assert(targetId !== actorId, "Self-targeting is not allowed");
  return target;
}

function applyNight(state, events, now) {
  // Tough guys survive the attack that marks them, then die when the next
  // night is resolved.  Resolve this delayed death before the new night’s
  // actions so it is deterministic even when no one submits an action.
  for (const player of alivePlayers(state).filter((candidate) => candidate.flags.injured)) {
    kill(state, player.id, "tough_guy_wounds", events, now);
  }

  const actions = Object.values(state.pendingActions).sort((a, b) => a.actorId.localeCompare(b.actorId));
  for (const action of actions.filter((candidate) => candidate.kind === "swap")) {
    const first = playerById(state, action.targetId);
    const second = playerById(state, action.secondTargetId);
    [first.roleId, second.roleId] = [second.roleId, first.roleId];
    [first.team, second.team] = [second.team, first.team];
    events.push(event(state, "ROLES_SWAPPED", { playerId: action.actorId }, now));
  }
  for (const action of actions.filter((candidate) => candidate.kind === "choose_copy")) {
    const actor = playerById(state, action.actorId);
    const target = playerById(state, action.targetId);
    actor.roleId = target.roleId;
    actor.team = target.team;
    actor.flags.copiedRole = true;
    events.push(event(state, "ROLE_COPIED", { playerId: actor.id }, now));
  }
  for (const action of actions.filter((candidate) => candidate.kind === "trap")) {
    state.roleState.traps[action.targetId] = action.actorId;
  }
  for (const action of actions.filter((candidate) => candidate.kind === "calm")) {
    state.players[action.targetId].flags.calmed = true;
  }
  const protectIds = new Set(actions.filter((a) => a.kind === "protect").map((a) => a.targetId));
  const attacks = actions.filter((a) => a.kind === "attack");
  const attack = attacks[0];
  if (attack && !protectIds.has(attack.targetId)) {
    const target = playerById(state, attack.targetId);
    const trapperId = state.roleState.traps[attack.targetId];
    if (trapperId) {
      kill(state, attack.targetId, "trap_counterattack", events, now);
      const attacker = state.players[attack.actorId];
      if (attacker?.alive) kill(state, attacker.id, "trap_counterattack", events, now);
      delete state.roleState.traps[attack.targetId];
    } else if (target.roleId === "tough_guy") {
      target.flags.injured = true;
      events.push(event(state, "TOUGH_GUY_INJURED", { playerId: target.id }, now));
    } else {
      kill(state, attack.targetId, "werewolf_attack", events, now);
    }
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
    if (target.roleId === "mysterious_fox" && target.alive) {
      kill(state, target.id, "prophet_curse", events, now);
    }
  }
  for (const action of actions.filter((candidate) => candidate.kind === "medium")) {
    const execution = state.roleState.lastExecution;
    const target = execution ? state.players[execution.playerId] : null;
    state.roleState.privateResults[action.actorId] ??= [];
    state.roleState.privateResults[action.actorId].push({
      type: "medium", targetId: target?.id ?? null, result: target?.team === "werewolf" ? "werewolf" : target ? "human" : "none",
    });
  }
  for (const action of actions.filter((candidate) => candidate.kind === "oracle")) {
    state.roleState.privateResults[action.actorId] ??= [];
    state.roleState.privateResults[action.actorId].push({
      type: "oracle", targetId: state.lastAttack?.targetId ?? null,
    });
  }
  state.pendingActions = {};
  state.phase = "day";
  setDeadline(state, "day", now);
  events.push(event(state, "DAY_STARTED", { round: state.round, attack: state.lastAttack ?? null }, now));
  checkWin(state, events, now);
}

export function createGame({ gameId, players, seed = 1, roleIds = [], gmMode = "computer", hostId = players?.[0]?.id, phaseDurations = {} }) {
  assert(Array.isArray(players) && players.length > 0, "At least one player is required");
  assert(new Set(players.map((player) => player.id)).size === players.length, "Player IDs must be unique");
  assert(typeof hostId === "string" && players.some((player) => player.id === hostId), "Host must be a player");
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
  const lovers = {};
  const loverIds = Object.values(playerRecords)
    .filter((player) => player.roleId === "lovers")
    .map((player) => player.id)
    .sort();
  for (let index = 0; index + 1 < loverIds.length; index += 2) {
    lovers[loverIds[index]] = loverIds[index + 1];
    lovers[loverIds[index + 1]] = loverIds[index];
  }
  const pairMap = (roleId) => {
    const ids = Object.values(playerRecords).filter((player) => player.roleId === roleId)
      .map((player) => player.id).sort();
    const result = {};
    for (let index = 0; index + 1 < ids.length; index += 2) {
      result[ids[index]] = ids[index + 1];
      result[ids[index + 1]] = ids[index];
    }
    return result;
  };
  return {
    gameId, revision: 0, seed, gmMode, hostId, phase: "lobby", round: 0, deadlineAt: null,
    phaseDurations: { night: 90_000, day: 180_000, vote: 60_000, ...phaseDurations },
    players: playerRecords,
    roleState: { privateResults: {}, lovers, twins: pairMap("twins"), betrayalTwins: pairMap("betrayal_twin"), traps: {}, lastExecution: null },
    pendingActions: {}, pendingVotes: {}, winner: null, history: [], lastAttack: null, eventSequence: 0,
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
      setDeadline(state, "night", now);
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
      let secondTargetId = command.payload?.secondTargetId;
      if (kind === "swap") {
        assert(typeof secondTargetId === "string", "swap requires secondTargetId");
        assert(secondTargetId !== targetId, "swap targets must be different");
        validateTarget(state, command.actorId, secondTargetId);
      }
      state.pendingActions[command.actorId] = { actorId: command.actorId, kind, targetId, secondTargetId };
      events.push(event(state, "NIGHT_ACTION_SUBMITTED", { playerId: command.actorId, kind }, now));
      break;
    }
    case "REVEAL_DICTATOR": {
      const actor = playerById(state, command.actorId);
      assert(actor.roleId === "dictator", "Only the dictator may use this ability");
      assert(actor.alive, "Dead players cannot use the dictator ability");
      assert(["day", "vote"].includes(state.phase), "Dictator ability is not available in this phase");
      assert(!actor.flags.dictatorRevealed, "The dictator ability can only be used once");
      const targetId = command.payload?.targetId;
      validateTarget(state, command.actorId, targetId);
      actor.flags.dictatorRevealed = true;
      state.revealedRoles ??= {};
      state.revealedRoles[actor.id] = actor.roleId;
      events.push(event(state, "DICTATOR_REVEALED", {
        playerId: actor.id, targetId,
      }, now));
      kill(state, targetId, "dictator_execution", events, now);
      state.roleState.lastExecution = { playerId: targetId, round: state.round };
      // If invoked during a vote, the dictator's decision supersedes pending
      // votes and returns the room to the normal day-resolution boundary.
      if (state.phase === "vote") {
        state.pendingVotes = {};
        state.phase = "day";
      }
      checkWin(state, events, now);
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
      setDeadline(state, "vote", now);
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
      let executedPlayerId = null;
      if (ordered.length > 0 && !tied) {
        [executedPlayerId] = ordered[0];
      }
      if (executedPlayerId) {
        const targetId = executedPlayerId;
        kill(state, targetId, "execution", events, now);
        state.roleState.lastExecution = { playerId: targetId, round: state.round };
      }
      state.pendingVotes = {};
      state.phase = "day";
      events.push(event(state, "VOTE_RESOLVED", { executedPlayerId }, now));
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
      setDeadline(state, "night", now);
      events.push(event(state, "NIGHT_STARTED", { round: state.round }, now));
      break;
    case "FORCE_ADVANCE":
      assertHostActor(state, command.actorId);
      assert(state.gmMode !== "computer", "Computer GM advances automatically");
      assert(state.deadlineAt !== null && now >= state.deadlineAt, "Phase deadline has not passed");
      if (state.phase === "night") {
        applyNight(state, events, now);
      } else if (state.phase === "day") {
        state.phase = "night";
        state.round += 1;
        state.pendingActions = {};
        state.lastAttack = null;
        setDeadline(state, "night", now);
        events.push(event(state, "NIGHT_STARTED", { round: state.round }, now));
      } else {
        throw new InvalidCommandError(`Cannot force advance from ${state.phase}`);
      }
      break;
    default:
      throw new InvalidCommandError(`Unknown command: ${command.type}`);
  }

  state.revision += 1;
  state.history.push(...events);
  return { state, events };
}

function publicDeath(death) {
  if (!death) return null;
  const cause = ["execution", "dictator_execution"].includes(death.cause)
    ? "execution"
    : ["werewolf_attack", "tough_guy_wounds"].includes(death.cause)
      ? "night_attack"
      : "other";
  return { cause, round: death.round };
}

export function toPublicView(state) {
  return {
    gameId: state.gameId, revision: state.revision, gmMode: state.gmMode,
    phase: state.phase, round: state.round, deadlineAt: state.deadlineAt,
    players: Object.fromEntries(Object.entries(state.players).map(([id, player]) => [id, {
      id, displayName: player.displayName, alive: player.alive, death: publicDeath(player.death),
      revealedRoleId: state.phase === "finished" ? player.roleId : (state.revealedRoles?.[id] ?? null),
    }])),
    pendingVoteCount: Object.keys(state.pendingVotes).length,
    winner: state.winner,
  };
}

export function toPlayerView(state, playerId) {
  const self = playerById(state, playerId);
  const view = toPublicView(state);
  let allyIds = [];
  if (self.roleId === "twins" && state.roleState.twins?.[playerId]) {
    allyIds = [state.roleState.twins[playerId]];
  } else if (self.roleId === "betrayal_twin" && state.roleState.betrayalTwins?.[playerId]) {
    allyIds = [state.roleState.betrayalTwins[playerId]];
  } else if (["werewolf", "werewolf_child"].includes(self.roleId)) {
    allyIds = Object.values(state.players)
      .filter((player) => player.id !== playerId && ["werewolf", "werewolf_child"].includes(player.roleId))
      .map((player) => player.id).sort();
  }
  view.self = {
    id: self.id, displayName: self.displayName, roleId: self.roleId, team: self.team,
    alive: self.alive, death: self.death,
    privateResults: clone(state.roleState.privateResults[playerId] ?? []),
    pendingAction: clone(state.pendingActions[playerId] ?? null),
    allies: allyIds.map((allyId) => {
      const ally = state.players[allyId];
      return { id: ally.id, displayName: ally.displayName, roleId: ally.roleId, team: ally.team, alive: ally.alive };
    }),
  };
  return view;
}

export { ROLE_DEFINITIONS, ROLE_IDS };
