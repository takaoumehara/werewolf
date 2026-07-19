const definition = (id, team, actions = [], ruleId = id) => ({
  id, team, actions, ruleId,
});

export const ROLE_IDS = [
  "dictator", "knights", "double", "counselor", "necromancer", "trapper",
  "citizen", "prophet", "bodyguard", "twins", "magician", "magician_c",
  "hunter", "tough_guy", "spy", "betrayal_twin", "werewolf", "traitor",
  "betrayer", "werewolf_child", "android", "lone_wolf", "god", "lovers",
  "mysterious_fox",
];

export const ROLE_DEFINITIONS = Object.freeze({
  dictator: definition("dictator", "citizen", ["dictate"]),
  knights: definition("knights", "citizen", ["protect"]),
  double: definition("double", "citizen", ["choose_copy"]),
  counselor: definition("counselor", "citizen", ["calm"]),
  necromancer: definition("necromancer", "citizen", ["medium"]),
  trapper: definition("trapper", "citizen", ["trap"]),
  citizen: definition("citizen", "citizen"),
  prophet: definition("prophet", "citizen", ["divine"]),
  bodyguard: definition("bodyguard", "citizen", ["protect"]),
  twins: definition("twins", "citizen"),
  magician: definition("magician", "citizen", ["swap"]),
  magician_c: definition("magician_c", "citizen", ["swap"], "magician"),
  hunter: definition("hunter", "citizen", ["death_shot"]),
  tough_guy: definition("tough_guy", "citizen"),
  spy: definition("spy", "werewolf", ["relay" ]),
  betrayal_twin: definition("betrayal_twin", "werewolf"),
  werewolf: definition("werewolf", "werewolf", ["attack"]),
  traitor: definition("traitor", "werewolf"),
  betrayer: definition("betrayer", "werewolf"),
  werewolf_child: definition("werewolf_child", "werewolf", ["attack"]),
  android: definition("android", "fox"),
  lone_wolf: definition("lone_wolf", "werewolf", ["attack"]),
  god: definition("god", "citizen", ["oracle"]),
  lovers: definition("lovers", "citizen"),
  mysterious_fox: definition("mysterious_fox", "fox"),
});

export function getRoleDefinition(roleId) {
  const role = ROLE_DEFINITIONS[roleId];
  if (!role) throw new Error(`Unknown role: ${roleId}`);
  return role;
}

export function isKillingWerewolf(player) {
  return ["werewolf", "werewolf_child", "lone_wolf"].includes(player.roleId);
}
