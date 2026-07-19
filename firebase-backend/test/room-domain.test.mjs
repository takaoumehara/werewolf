import test from "node:test";
import assert from "node:assert/strict";
import { normalizePairingCode, createPairingCode, buildRoomRecords, joinLedger }
  from "../src/room-domain.mjs";

test("pairing codeを安全な6文字へ正規化する", () => {
  assert.equal(normalizePairingCode(" ab-cd23 "), "ABCD23");
  assert.throws(() => normalizePairingCode("ABC"), /6 characters/i);
});

test("衝突時にcodeを再生成する", async () => {
  const values = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1];
  const code = await createPairingCode({
    randomInt: () => values.shift(),
    isTaken: async (candidate) => candidate === "AAAAAA",
    attempts: 2,
  });
  assert.equal(code, "BBBBBB");
});

test("同じuidの再参加はcountを増やさない", () => {
  const first = joinLedger({ count: 1, members: { host: true } }, { uid: "p2", maxPlayers: 3 });
  const second = joinLedger(first, { uid: "p2", maxPlayers: 3 });
  assert.equal(first.count, 2);
  assert.equal(second.count, 2);
});

test("hostを含むroomとpairingの初期レコードを構築する", () => {
  const records = buildRoomRecords({
    roomId: "room-1",
    code: "ABC234",
    uid: "host",
    name: "Alice",
    maxPlayers: 8,
    now: 100,
    expiresAt: 200,
  });

  assert.deepEqual(records, {
    roomId: "room-1",
    code: "ABC234",
    room: {
      meta: {
        hostId: "host",
        status: "waiting",
        createdAt: 100,
        updatedAt: 100,
        participantCount: 1,
        maxPlayers: 8,
      },
      players: {
        host: {
          id: "host",
          name: "Alice",
          role: "host",
          connected: true,
          joinedAt: 100,
          lastSeenAt: 100,
        },
      },
      joinState: { count: 1, members: { host: true } },
    },
    pairing: {
      roomId: "room-1",
      hostId: "host",
      createdAt: 100,
      expiresAt: 200,
      maxPlayers: 8,
    },
  });
});
