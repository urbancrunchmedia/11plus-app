import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "fs";
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from "@firebase/rules-unit-testing";

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "rules-test-11plus",
    firestore: { rules: readFileSync("../firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});

afterAll(async () => { await testEnv.cleanup(); });
beforeEach(async () => { await testEnv.clearFirestore(); });

const ME = "u_me", FRIEND = "u_friend", STRANGER = "u_stranger";
const pairId = (a, b) => [a, b].sort().join("__");

function ctx(uid) { return testEnv.authenticatedContext(uid).firestore(); }

async function seedProfile(uid, over = {}) {
  await testEnv.withSecurityRulesDisabled(async (env) => {
    const db = env.firestore();
    await db.doc(`profiles/${uid}`).set({
      displayName: "Amu", points: 10, weekPoints: 5, code: "WM-7H2K9", ...over,
    });
  });
}
async function seedCode(code, uid, displayName = "Amu") {
  await testEnv.withSecurityRulesDisabled(async (env) => {
    await env.firestore().doc(`codes/${code}`).set({ uid, displayName });
  });
}
async function seedFriendship(a, b) {
  await testEnv.withSecurityRulesDisabled(async (env) => {
    await env.firestore().doc(`friendships/${pairId(a, b)}`).set({ uids: [a, b].sort(), createdAt: "x" });
  });
}

describe("Finding 1 — profiles collection can no longer be enumerated", () => {
  it("a stranger cannot list the profiles collection", async () => {
    await seedProfile(ME);
    await assertFails(ctx(STRANGER).collection("profiles").get());
  });

  it("a stranger cannot even get() a profile they aren't friends with", async () => {
    await seedProfile(ME);
    await assertFails(ctx(STRANGER).doc(`profiles/${ME}`).get());
  });

  it("the owner can always read their own profile", async () => {
    await seedProfile(ME);
    await assertSucceeds(ctx(ME).doc(`profiles/${ME}`).get());
  });

  it("a friend can read the profile once a friendship doc exists", async () => {
    await seedProfile(ME);
    await seedFriendship(ME, FRIEND);
    await assertSucceeds(ctx(FRIEND).doc(`profiles/${ME}`).get());
  });
});

describe("Finding 2 — friendships can't be forced without going through a code", () => {
  it("addFriendByCode's new path: get the code, then create the friendship", async () => {
    await seedProfile(FRIEND);
    await seedCode("WM-ABCDE", FRIEND, "Sam");
    const snap = await assertSucceeds(ctx(ME).doc("codes/WM-ABCDE").get());
    expect(snap.data().uid).toBe(FRIEND);
    await assertSucceeds(
      ctx(ME).doc(`friendships/${pairId(ME, FRIEND)}`).set({ uids: [ME, FRIEND].sort(), createdAt: "x" })
    );
  });

  it("a stranger can no longer discover who to friend by listing profiles first", async () => {
    await seedProfile(FRIEND);
    // The old attack: query profiles for a target, then friend them blind.
    await assertFails(ctx(STRANGER).collection("profiles").get());
  });

  it("the codes collection itself is not listable", async () => {
    await seedCode("WM-ABCDE", FRIEND);
    await assertFails(ctx(STRANGER).collection("codes").get());
  });

  it("a code can be looked up directly without needing a friendship first", async () => {
    await seedCode("WM-ABCDE", FRIEND, "Sam");
    await assertSucceeds(ctx(STRANGER).doc("codes/WM-ABCDE").get());
  });
});

describe("codes/{code} — can't be claimed for someone else or hijacked", () => {
  it("you can create your own code entry", async () => {
    await assertSucceeds(ctx(ME).doc("codes/WM-MINE1").set({ uid: ME, displayName: "Amu" }));
  });

  it("you cannot create a code entry pointing at a different uid", async () => {
    await assertFails(ctx(ME).doc("codes/WM-FAKE1").set({ uid: STRANGER, displayName: "Amu" }));
  });

  it("you cannot overwrite a code that already belongs to someone else", async () => {
    await seedCode("WM-TAKEN", FRIEND, "Sam");
    await assertFails(ctx(ME).doc("codes/WM-TAKEN").set({ uid: ME, displayName: "Amu" }));
  });

  it("you can refresh your own entry (e.g. after a rename)", async () => {
    await seedCode("WM-MINE1", ME, "Amu");
    await assertSucceeds(ctx(ME).doc("codes/WM-MINE1").set({ uid: ME, displayName: "Amaira" }));
  });
});

describe("Stage 1 — field validation on profile writes", () => {
  it("rejects a profanity-shaped or malformed name at the database layer too", async () => {
    await assertFails(ctx(ME).doc(`profiles/${ME}`).set({
      displayName: "<script>", points: 0, weekPoints: 0, code: "WM-7H2K9",
    }));
  });
  it("rejects a negative points value", async () => {
    await assertFails(ctx(ME).doc(`profiles/${ME}`).set({
      displayName: "Amu", points: -5, weekPoints: 0, code: "WM-7H2K9",
    }));
  });
  it("accepts a well-formed write, including real names with an accent or apostrophe", async () => {
    await assertSucceeds(ctx(ME).doc(`profiles/${ME}`).set({
      displayName: "Zoë", points: 40, weekPoints: 12, code: "WM-7H2K9",
    }));
    await assertSucceeds(ctx(ME).doc(`profiles/${ME}`).set({
      displayName: "O'Neill", points: 40, weekPoints: 12, code: "WM-7H2K9",
    }));
  });
  it("still refuses a write to someone else's profile", async () => {
    await assertFails(ctx(STRANGER).doc(`profiles/${ME}`).set({
      displayName: "Amu", points: 0, weekPoints: 0, code: "WM-7H2K9",
    }));
  });
});

describe("Regression — existing app flows still work exactly as before", () => {
  it("the leaderboard read pattern: own profile + each friend's profile, one get() each", async () => {
    await seedProfile(ME);
    await seedProfile(FRIEND, { displayName: "Sam" });
    await seedFriendship(ME, FRIEND);
    await assertSucceeds(ctx(ME).doc(`profiles/${ME}`).get());
    await assertSucceeds(ctx(ME).doc(`profiles/${FRIEND}`).get());
  });

  it("removing a friend still works, and read access drops immediately after", async () => {
    await seedProfile(ME);
    await seedFriendship(ME, FRIEND);
    await assertSucceeds(ctx(ME).doc(`friendships/${pairId(ME, FRIEND)}`).delete());
    await assertFails(ctx(FRIEND).doc(`profiles/${ME}`).get());
  });

  it("users/{uid} is unaffected — still self-only", async () => {
    await assertSucceeds(ctx(ME).doc(`users/${ME}`).set({ bests: {}, history: {} }));
    await assertFails(ctx(STRANGER).doc(`users/${ME}`).get());
  });
});
