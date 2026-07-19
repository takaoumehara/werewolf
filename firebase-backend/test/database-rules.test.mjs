import test, { after, before } from "node:test";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { get, ref, remove, set } from "firebase/database";

const ROOM_ID = "room-1";
const MEMBER_UID = "member-1";
const OTHER_MEMBER_UID = "member-2";
const NONMEMBER_UID = "nonmember-1";
const PROJECT_ID = "demo-werewolf-rules-test";
const RULES_PATH = fileURLToPath(new URL("../../database.rules.json", import.meta.url));

let environment;

function databaseFor(uid) {
  return uid === null
    ? environment.unauthenticatedContext().database()
    : environment.authenticatedContext(uid).database();
}

function memberDatabase() {
  return databaseFor(MEMBER_UID);
}

before(async () => {
  environment = await initializeTestEnvironment({
    // This suite-specific demo namespace prevents other suites from clearing this test data.
    projectId: PROJECT_ID,
    database: { rules: fs.readFileSync(RULES_PATH, "utf8") },
  });

  await environment.clearDatabase();
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.database();
    await set(ref(database), {
      pairingCodes: {
        ABC234: {
          roomId: ROOM_ID,
          hostId: MEMBER_UID,
          createdAt: 1,
          expiresAt: 2,
          maxPlayers: 8,
        },
      },
      roomMembers: {
        [ROOM_ID]: {
          [MEMBER_UID]: true,
          [OTHER_MEMBER_UID]: true,
          [NONMEMBER_UID]: false,
        },
      },
      roomCreateRateLimits: {
        [MEMBER_UID]: { windowStartedAt: 1, count: 1 },
      },
      rooms: {
        [ROOM_ID]: {
          meta: {
            hostId: MEMBER_UID,
            status: "waiting",
            createdAt: 1,
            updatedAt: 1,
            participantCount: 2,
            maxPlayers: 8,
          },
          players: {
            [MEMBER_UID]: {
              id: MEMBER_UID,
              name: "Host",
              role: "host",
              connected: true,
              joinedAt: 1,
              lastSeenAt: 1,
            },
            [OTHER_MEMBER_UID]: {
              id: OTHER_MEMBER_UID,
              name: "Guest",
              role: "participant",
              connected: true,
              joinedAt: 2,
              lastSeenAt: 2,
            },
          },
          joinState: {
            count: 2,
            members: {
              [MEMBER_UID]: true,
              [OTHER_MEMBER_UID]: true,
            },
          },
          game: {
            public: { revision: 1, phase: "night", round: 1 },
            publicEvents: {
              "event-1": { id: "event-1", type: "GAME_STARTED", at: 1 },
            },
            privateViews: {
              [MEMBER_UID]: { roleId: "werewolf" },
              [OTHER_MEMBER_UID]: { roleId: "citizen" },
              [NONMEMBER_UID]: { roleId: "seer" },
            },
            authoritative: {
              revision: 1,
              secret: { nightTargetId: OTHER_MEMBER_UID },
            },
            events: {
              "event-1": { id: "event-1", type: "GAME_STARTED", secret: true },
            },
            processedCommands: {
              "command-1": { revision: 1, phase: "night" },
            },
          },
        },
      },
    });
  });
});

after(async () => {
  if (!environment) return;
  try {
    await environment.clearDatabase();
  } finally {
    await environment.cleanup();
  }
});

for (const path of [
  `rooms/${ROOM_ID}/meta`,
  `rooms/${ROOM_ID}/players`,
  `rooms/${ROOM_ID}/game/public`,
  `rooms/${ROOM_ID}/game/publicEvents`,
]) {
  test(`member can read ${path}`, async () => {
    await assertSucceeds(get(ref(memberDatabase(), path)));
  });

  test(`nonmember cannot read ${path}`, async () => {
    await assertFails(get(ref(databaseFor(NONMEMBER_UID), path)));
  });

  test(`anonymous client cannot read ${path}`, async () => {
    await assertFails(get(ref(databaseFor(null), path)));
  });
}

for (const path of ["", "rooms", `rooms/${ROOM_ID}`, `rooms/${ROOM_ID}/game`]) {
  const label = path || "root";
  test(`member cannot read parent path ${label}`, async () => {
    const database = memberDatabase();
    const target = path ? ref(database, path) : ref(database);
    await assertFails(get(target));
  });

  test(`host client cannot write parent path ${label}`, async () => {
    const database = memberDatabase();
    const target = path ? ref(database, path) : ref(database);
    await assertFails(set(target, { clientAttempt: true }));
  });
}

test("member can read their own private view", async () => {
  await assertSucceeds(
    get(ref(memberDatabase(), `rooms/${ROOM_ID}/game/privateViews/${MEMBER_UID}`)),
  );
});

test("member cannot read another member's private view", async () => {
  await assertFails(
    get(ref(memberDatabase(), `rooms/${ROOM_ID}/game/privateViews/${OTHER_MEMBER_UID}`)),
  );
});

test("nonmember cannot read their own private view", async () => {
  await assertFails(
    get(
      ref(
        databaseFor(NONMEMBER_UID),
        `rooms/${ROOM_ID}/game/privateViews/${NONMEMBER_UID}`,
      ),
    ),
  );
});

test("anonymous client cannot read a private view", async () => {
  await assertFails(
    get(ref(databaseFor(null), `rooms/${ROOM_ID}/game/privateViews/${MEMBER_UID}`)),
  );
});

test("member cannot read the privateViews parent", async () => {
  await assertFails(get(ref(memberDatabase(), `rooms/${ROOM_ID}/game/privateViews`)));
});

const SERVER_ONLY_PATHS = [
  "pairingCodes",
  "pairingCodes/ABC234",
  "roomMembers",
  `roomMembers/${ROOM_ID}`,
  `roomMembers/${ROOM_ID}/${MEMBER_UID}`,
  "roomCreateRateLimits",
  `roomCreateRateLimits/${MEMBER_UID}`,
  `rooms/${ROOM_ID}/joinState`,
  `rooms/${ROOM_ID}/joinState/count`,
  `rooms/${ROOM_ID}/game/authoritative`,
  `rooms/${ROOM_ID}/game/authoritative/secret`,
  `rooms/${ROOM_ID}/game/events`,
  `rooms/${ROOM_ID}/game/events/event-1`,
  `rooms/${ROOM_ID}/game/processedCommands`,
  `rooms/${ROOM_ID}/game/processedCommands/command-1`,
];

for (const path of SERVER_ONLY_PATHS) {
  test(`host client cannot read server-only path ${path}`, async () => {
    await assertFails(get(ref(memberDatabase(), path)));
  });

  test(`host client cannot write server-only path ${path}`, async () => {
    await assertFails(set(ref(memberDatabase(), path), { clientAttempt: true }));
  });
}

test("member can update their own name with 1 to 30 characters", async () => {
  await assertSucceeds(
    set(ref(memberDatabase(), `rooms/${ROOM_ID}/players/${MEMBER_UID}/name`), "New Host"),
  );
});

test("member can update their own connected flag with a boolean", async () => {
  await assertSucceeds(
    set(ref(memberDatabase(), `rooms/${ROOM_ID}/players/${MEMBER_UID}/connected`), false),
  );
});

test("member can update their own lastSeenAt with a nonnegative current timestamp", async () => {
  await assertSucceeds(
    set(ref(memberDatabase(), `rooms/${ROOM_ID}/players/${MEMBER_UID}/lastSeenAt`), Date.now()),
  );
});

test("member cannot set their name to a non-string", async () => {
  await assertFails(
    set(ref(memberDatabase(), `rooms/${ROOM_ID}/players/${MEMBER_UID}/name`), 123),
  );
});

test("member cannot set their name to an empty string", async () => {
  await assertFails(
    set(ref(memberDatabase(), `rooms/${ROOM_ID}/players/${MEMBER_UID}/name`), ""),
  );
});

test("member cannot set their name longer than 30 characters", async () => {
  await assertFails(
    set(ref(memberDatabase(), `rooms/${ROOM_ID}/players/${MEMBER_UID}/name`), "x".repeat(31)),
  );
});

test("member cannot delete their name", async () => {
  await assertFails(
    remove(ref(memberDatabase(), `rooms/${ROOM_ID}/players/${MEMBER_UID}/name`)),
  );
});

test("member cannot set their connected flag to a non-boolean", async () => {
  await assertFails(
    set(ref(memberDatabase(), `rooms/${ROOM_ID}/players/${MEMBER_UID}/connected`), "true"),
  );
});

test("member cannot delete their connected flag", async () => {
  await assertFails(
    remove(ref(memberDatabase(), `rooms/${ROOM_ID}/players/${MEMBER_UID}/connected`)),
  );
});

test("member cannot set lastSeenAt to a non-number", async () => {
  await assertFails(
    set(ref(memberDatabase(), `rooms/${ROOM_ID}/players/${MEMBER_UID}/lastSeenAt`), "now"),
  );
});

test("member cannot set lastSeenAt to a negative number", async () => {
  await assertFails(
    set(ref(memberDatabase(), `rooms/${ROOM_ID}/players/${MEMBER_UID}/lastSeenAt`), -1),
  );
});

test("member cannot set lastSeenAt more than 60 seconds in the future", async () => {
  await assertFails(
    set(
      ref(memberDatabase(), `rooms/${ROOM_ID}/players/${MEMBER_UID}/lastSeenAt`),
      Date.now() + 120_000,
    ),
  );
});

test("member cannot delete lastSeenAt", async () => {
  await assertFails(
    remove(ref(memberDatabase(), `rooms/${ROOM_ID}/players/${MEMBER_UID}/lastSeenAt`)),
  );
});

test("nonmember cannot write their own name", async () => {
  await assertFails(
    set(
      ref(databaseFor(NONMEMBER_UID), `rooms/${ROOM_ID}/players/${NONMEMBER_UID}/name`),
      "Intruder",
    ),
  );
});

test("anonymous client cannot write an editable player field", async () => {
  await assertFails(
    set(ref(databaseFor(null), `rooms/${ROOM_ID}/players/${MEMBER_UID}/connected`), true),
  );
});

test("member cannot replace their whole player record", async () => {
  await assertFails(
    set(ref(memberDatabase(), `rooms/${ROOM_ID}/players/${MEMBER_UID}`), {
      id: MEMBER_UID,
      name: "Replacement",
      role: "host",
      connected: true,
      joinedAt: 1,
      lastSeenAt: Date.now(),
    }),
  );
});

test("member cannot write their id", async () => {
  await assertFails(
    set(ref(memberDatabase(), `rooms/${ROOM_ID}/players/${MEMBER_UID}/id`), "forged-id"),
  );
});

test("member cannot write their role", async () => {
  await assertFails(
    set(ref(memberDatabase(), `rooms/${ROOM_ID}/players/${MEMBER_UID}/role`), "participant"),
  );
});

test("member cannot write their joinedAt timestamp", async () => {
  await assertFails(
    set(ref(memberDatabase(), `rooms/${ROOM_ID}/players/${MEMBER_UID}/joinedAt`), 999),
  );
});

test("member cannot write an unknown player child", async () => {
  await assertFails(
    set(ref(memberDatabase(), `rooms/${ROOM_ID}/players/${MEMBER_UID}/admin`), true),
  );
});

test("member cannot write another player's editable field", async () => {
  await assertFails(
    set(
      ref(memberDatabase(), `rooms/${ROOM_ID}/players/${OTHER_MEMBER_UID}/name`),
      "Hijacked",
    ),
  );
});

test("host client cannot replace room meta", async () => {
  await assertFails(
    set(ref(memberDatabase(), `rooms/${ROOM_ID}/meta`), { status: "playing" }),
  );
});

test("host client cannot write room status", async () => {
  await assertFails(
    set(ref(memberDatabase(), `rooms/${ROOM_ID}/meta/status`), "playing"),
  );
});

test("host client cannot write public game state", async () => {
  await assertFails(
    set(ref(memberDatabase(), `rooms/${ROOM_ID}/game/public/phase`), "finished"),
  );
});

test("host client cannot write public events", async () => {
  await assertFails(
    set(ref(memberDatabase(), `rooms/${ROOM_ID}/game/publicEvents/client-event`), {
      type: "FORGED",
    }),
  );
});

test("host client cannot write their own private view", async () => {
  await assertFails(
    set(
      ref(memberDatabase(), `rooms/${ROOM_ID}/game/privateViews/${MEMBER_UID}/roleId`),
      "seer",
    ),
  );
});

test("host client cannot replace the game subtree", async () => {
  await assertFails(set(ref(memberDatabase(), `rooms/${ROOM_ID}/game`), { public: {} }));
});
