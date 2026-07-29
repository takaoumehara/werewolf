export const DEFAULT_POSITION = Object.freeze({ scale: 1, x: 0, y: 0 });

const round = value => Math.round(value * 100) / 100;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function normalize(position) {
  return {
    scale: round(clamp(Number(position.scale), 0.5, 2.5)),
    x: round(clamp(Number(position.x), -100, 100)),
    y: round(clamp(Number(position.y), -100, 100))
  };
}

export function createPositionMap(roleIds) {
  return Object.fromEntries(
    roleIds.map(roleId => [roleId, { ...DEFAULT_POSITION }])
  );
}

export function updatePosition(map, roleId, patch) {
  if (!map[roleId]) {
    throw new Error(`Unknown role: ${roleId}`);
  }

  return {
    ...map,
    [roleId]: normalize({ ...map[roleId], ...patch })
  };
}

export function resetPosition(map, roleId) {
  return updatePosition(map, roleId, DEFAULT_POSITION);
}

export function serializePositions(map, roleIds) {
  const lines = roleIds.map(roleId => {
    if (!map[roleId]) {
      throw new Error(`Unknown role: ${roleId}`);
    }

    const value = normalize(map[roleId]);
    return `  ${JSON.stringify(roleId)}: { "scale": ${value.scale}, "x": ${value.x}, "y": ${value.y} }`;
  });

  return `{\n${lines.join(',\n')}\n}`;
}
