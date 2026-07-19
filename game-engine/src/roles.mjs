const definition = (id, team, actions = [], ruleId = id) => Object.freeze({
  id, team, actions: Object.freeze([...actions]), ruleId,
});

export const ROLE_IDS = Object.freeze([
  "dictator", "knights", "double", "counselor", "necromancer", "trapper",
  "citizen", "prophet", "bodyguard", "twins", "magician", "magician_c",
  "hunter", "tough_guy", "spy", "betrayal_twin", "werewolf", "traitor",
  "betrayer", "werewolf_child", "android", "lone_wolf", "god", "lovers",
  "mysterious_fox",
]);

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

function validateDefinition(role) {
  if (!role || typeof role !== "object" || typeof role.id !== "string" || role.id.length === 0) {
    throw new TypeError("Role definition must have a non-empty id");
  }
  if (!["citizen", "werewolf", "fox"].includes(role.team)) {
    throw new TypeError(`Unknown role team for ${role.id}`);
  }
  if (!Array.isArray(role.actions)) throw new TypeError(`Role actions must be an array for ${role.id}`);
}

/**
 * Creates an isolated registry for scenario-specific role plugins. The built-in
 * definitions are copied into the registry and never mutated by registration.
 */
export function createRoleRegistry(extraDefinitions = {}) {
  if (!extraDefinitions || typeof extraDefinitions !== "object" || Array.isArray(extraDefinitions)) {
    throw new TypeError("extraDefinitions must be an object");
  }
  const definitions = new Map(Object.entries(ROLE_DEFINITIONS));
  const register = (role) => {
    validateDefinition(role);
    if (definitions.has(role.id)) throw new Error(`duplicate role: ${role.id}`);
    const normalized = definition(role.id, role.team, role.actions, role.ruleId ?? role.id);
    definitions.set(normalized.id, normalized);
    return normalized;
  };
  for (const role of Object.values(extraDefinitions)) register(role);
  return Object.freeze({
    get(roleId) {
      const role = definitions.get(roleId);
      if (!role) throw new Error(`Unknown role: ${roleId}`);
      return role;
    },
    register,
    ids() {
      return [...definitions.keys()].sort();
    },
  });
}

export function isKillingWerewolf(player) {
  return ["werewolf", "werewolf_child", "lone_wolf"].includes(player.roleId);
}
