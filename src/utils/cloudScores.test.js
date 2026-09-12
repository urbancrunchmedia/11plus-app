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

import { prepareLocalForUser } from "./cloudScores";
import { addWeeklyPoints, getWeeklyPoints } from "./weekly";

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
});
