import test from "node:test";
import assert from "node:assert/strict";

import { FakeRtdb } from "./fake-rtdb.mjs";

test("RTDBで禁止されたpath segmentとdata keyを拒否する", async () => {
  const database = new FakeRtdb();

  for (const path of ["rooms/a.b", "rooms/a#b", "rooms/a\u0001b"]) {
    assert.throws(() => database.ref(path), /invalid.*(?:path|key)/i);
  }
  await assert.rejects(database.ref().update({
    valid: { nested: true },
    invalid: { "bad/key": true },
  }), /invalid.*key/i);
  await assert.rejects(database.ref("rooms/room-1").transaction(() => ({
    valid: true,
    "bad.key": true,
  })), /invalid.*key/i);
});

test("snapshotはnullとempty object/arrayをRTDBと同じくpruneする", async () => {
  const database = new FakeRtdb({
    value: {
      emptyObject: {},
      emptyArray: [],
      missing: null,
      kept: true,
      array: [null, {}, 1],
    },
  });

  assert.deepEqual((await database.ref("value").get()).val(), {
    kept: true,
    array: [null, null, 1],
  });

  const deletion = await database.ref("value").transaction(() => ({}));
  assert.equal(deletion.committed, true);
  assert.equal(deletion.snapshot.exists(), false);
  assert.equal((await database.ref("value").get()).val(), null);
});

test("multi-location updateは全path/dataを事前検証して失敗時に部分適用しない", async () => {
  const database = new FakeRtdb({ safe: { value: 1 } });

  await assert.rejects(database.ref().update({
    "safe/value": 2,
    other: { "bad.key": 3 },
  }), /invalid.*key/i);

  assert.deepEqual(database.state, { safe: { value: 1 } });
  assert.equal(database.updateCalls.length, 0);
});

test("multi-location updateのparent/child overlapping pathは全体をno-opにする", async () => {
  const database = new FakeRtdb({ safe: { value: 1 } });

  await assert.rejects(database.ref().update({
    safe: { value: 2 },
    "safe/child": true,
  }), /overlapping/i);

  assert.deepEqual(database.state, { safe: { value: 1 } });
  assert.equal(database.updateCalls.length, 0);
});

test("validなrepository形式のmulti-location dataはatomicに保存しempty childだけpruneする", async () => {
  const database = new FakeRtdb();

  await database.ref().update({
    "rooms/room-1": {
      meta: { hostId: "p1", participantCount: 1 },
      players: { p1: { id: "p1", flags: {} } },
      game: { processedCommands: {}, revision: 1 },
    },
    "roomMembers/room-1/p1": true,
  });

  assert.deepEqual(database.state, {
    rooms: { "room-1": {
      meta: { hostId: "p1", participantCount: 1 },
      players: { p1: { id: "p1" } },
      game: { revision: 1 },
    } },
    roomMembers: { "room-1": { p1: true } },
  });
});
