import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db, ...parts) => ({ path: parts.join("/") }),
  collection: (_db, name) => ({ path: name }),
  query: (...args) => args,
  where: (...args) => args,
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
}));

import { getDoc } from "firebase/firestore";
import { prepareLocalForUser, mergeFromCloud } from "./cloudScores";
import { addWeeklyPoints, getWeeklyPoints } from "./weekly";
import { recordAttempt, getSkillAccuracy, getWeakWords } from "./progress";
import { getSetting, setSetting } from "./leaderboard";

describe("prepareLocalForUser", () => {
  beforeEach(() => localStorage.clear());

  // Regression: switching accounts on a shared device wiped bests/history but
  // left the OTHER kid's weekly points sitting in localStorage — the next
  // sync stamped their leftover total onto the new account's leaderboard row.
  it("clears the previous account's weekly points on an account switch", () => {
    prepareLocalForUser("kid-a");
    addWeeklyPoints(50);
    expect(getWeeklyPoints()).toBe(50);

    prepareLocalForUser("kid-b");
    expect(getWeeklyPoints()).toBe(0);
  });

  it("leaves weekly points alone when the same account reloads the app", () => {
    prepareLocalForUser("kid-a");
    addWeeklyPoints(50);

    prepareLocalForUser("kid-a");
    expect(getWeeklyPoints()).toBe(50);
  });

  // Regression: "onboarded" is per-account (has THIS kid set their name up?),
  // not a device-wide preference like sound/dailyGoal. Without this, a new
  // sibling on a device where someone else already onboarded skipped name
  // setup entirely and got published to the leaderboard as "Player".
  it("clears the previous account's onboarded flag on an account switch", () => {
    prepareLocalForUser("kid-a");
    setSetting("onboarded", true);

    prepareLocalForUser("kid-b");
    expect(getSetting("onboarded", false)).toBe(false);
  });

  it("leaves the onboarded flag alone when the same account reloads the app", () => {
    prepareLocalForUser("kid-a");
    setSetting("onboarded", true);

    prepareLocalForUser("kid-a");
    expect(getSetting("onboarded", false)).toBe(true);
  });
});

describe("mergeFromCloud — per-skill accuracy and weak words", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // Regression: this device's "Not started yet" only ever reflected its own
  // localStorage — a child who'd played plenty on a different device still
  // showed a blank slate here. Progress now merges in from the cloud, just
  // like bests/history already did.
  it("pulls in a skill this device has never seen", async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ progress: { skills: { spelling: { hits: 8, misses: 2 } }, words: {} } }),
    });
    prepareLocalForUser("u1");
    await mergeFromCloud("u1");
    const spelling = getSkillAccuracy().find((s) => s.skill === "spelling");
    expect(spelling.total).toBe(10);
    expect(spelling.pct).toBe(80);
  });

  it("keeps whichever side has racked up more reps for a skill, per skill", async () => {
    recordAttempt({ skill: "punctuation", correct: true }); // 1 attempt locally
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        progress: {
          skills: {
            punctuation: { hits: 1, misses: 4 }, // cloud: 5 attempts, further along
            spelling: { hits: 1, misses: 0 },     // cloud: 1 attempt, behind local's... (none locally, so cloud wins)
          },
          words: {},
        },
      }),
    });
    prepareLocalForUser("u1");
    await mergeFromCloud("u1");
    const bySkill = Object.fromEntries(getSkillAccuracy().map((s) => [s.skill, s]));
    expect(bySkill.punctuation.total).toBe(5);  // cloud (5) beat local (1)
    expect(bySkill.spelling.total).toBe(1);     // only cloud had this skill at all
  });

  it("adds a cloud-only weak word without dropping a local-only one", async () => {
    recordAttempt({ skill: "fillInBlanks", word: "onlyhere", correct: false });
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        progress: {
          skills: {},
          words: { "fillinblanks:cloudword": { word: "cloudword", skill: "fillInBlanks", misses: 1, hitsSinceMiss: 0 } },
        },
      }),
    });
    prepareLocalForUser("u1");
    await mergeFromCloud("u1");
    const words = getWeakWords().map((w) => w.word);
    expect(words).toContain("onlyhere");
    expect(words).toContain("cloudword");
  });

  // Regression: on a shared device, signing in as kid B while kid A's
  // mergeFromCloud("A") fetch was still in flight let A's cloud data land in
  // localStorage AFTER prepareLocalForUser("B") had already reset it for the
  // new account — permanently contaminating B's real progress/scores.
  it("abandons the merge if a different account signed in while the fetch was in flight", async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ progress: { skills: { spelling: { hits: 8, misses: 2 } }, words: {} } }),
    });
    prepareLocalForUser("kid-a");
    const merging = mergeFromCloud("kid-a"); // fetch in flight...
    prepareLocalForUser("kid-b");            // ...device switches accounts before it resolves
    await merging;

    expect(getSkillAccuracy().find((s) => s.skill === "spelling")).toBeUndefined();
  });
});
