import { randomInt as cryptoRandomInt } from "node:crypto";

export const PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizePairingCode(raw) {
  const code = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 6) throw new TypeError("Pairing code must be 6 characters");
  return code;
}

export async function createPairingCode({
  randomInt = cryptoRandomInt,
  isTaken,
  attempts = 8,
}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const code = Array.from({ length: 6 }, () =>
      PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)]).join("");
    if (!(await isTaken(code))) return code;
  }
  throw new Error("Unable to allocate pairing code");
}

export function joinLedger(current, { uid, maxPlayers }) {
  const ledger = current ?? { count: 0, members: {} };
  if (ledger.members?.[uid]) return structuredClone(ledger);
  if (ledger.count >= maxPlayers) throw new Error("Room is full");
  return { count: ledger.count + 1, members: { ...ledger.members, [uid]: true } };
}

export function buildRoomRecords({ roomId, code, uid, name, maxPlayers, now, expiresAt }) {
  return {
    roomId,
    code,
    room: {
      meta: { hostId: uid, status: "waiting", createdAt: now, updatedAt: now,
        participantCount: 1, maxPlayers },
      players: { [uid]: { id: uid, name, role: "host", connected: true,
        joinedAt: now, lastSeenAt: now } },
      joinState: { count: 1, members: { [uid]: true } },
    },
    pairing: { roomId, hostId: uid, createdAt: now, expiresAt, maxPlayers },
  };
}
