import { describe, it, expect, beforeEach } from "vitest";
import { BADGE_DEFS, getBadges } from "./badges";

function mockStats(overrides = {}) {
  return {
    rounds: 0,
    streak: 0,
    perfect: false,
    mastery: [],
    rankEverReached: () => false,
    ...overrides,
  };
}

describe("badges", () => {
  beforeEach(() => localStorage.clear());

  it("every badge is locked against a totally fresh account", () => {
    const badges = getBadges(mockStats());
    expect(badges.every((b) => !b.earned)).toBe(true);
    expect(badges.length).toBe(BADGE_DEFS.length);
  });

  it("round-count badges unlock at their thresholds", () => {
    const at = (rounds) => getBadges(mockStats({ rounds })).find((b) => b.id === "rounds-50");
    expect(at(49).earned).toBe(false);
    expect(at(50).earned).toBe(true);
  });

  it("streak badges unlock at their thresholds", () => {
    const badges = getBadges(mockStats({ streak: 7 }));
    expect(badges.find((b) => b.id === "streak-3").earned).toBe(true);
    expect(badges.find((b) => b.id === "streak-7").earned).toBe(true);
    expect(badges.find((b) => b.id === "streak-30").earned).toBe(false);
  });

  it("flawless round badge tracks the perfect flag directly", () => {
    expect(getBadges(mockStats({ perfect: true })).find((b) => b.id === "flawless").earned).toBe(true);
    expect(getBadges(mockStats({ perfect: false })).find((b) => b.id === "flawless").earned).toBe(false);
  });

  it("skill-specialist needs just one skill at 80%, not all of them", () => {
    const mastery = [{ pct: 10 }, { pct: 85 }, { pct: 0 }];
    expect(getBadges(mockStats({ mastery })).find((b) => b.id === "specialist").earned).toBe(true);
  });

  it("well-rounded and grand-master need every skill above their bar", () => {
    const weak = [{ pct: 60 }, { pct: 40 }]; // one skill below 50
    const solid = [{ pct: 60 }, { pct: 55 }]; // every skill at/above 50, none above 80
    expect(getBadges(mockStats({ mastery: weak })).find((b) => b.id === "well-rounded").earned).toBe(false);
    expect(getBadges(mockStats({ mastery: solid })).find((b) => b.id === "well-rounded").earned).toBe(true);
    expect(getBadges(mockStats({ mastery: solid })).find((b) => b.id === "grand-master").earned).toBe(false);
  });

  it("well-rounded/grand-master aren't vacuously true with zero skills attempted", () => {
    const badges = getBadges(mockStats({ mastery: [] }));
    expect(badges.find((b) => b.id === "well-rounded").earned).toBe(false);
    expect(badges.find((b) => b.id === "grand-master").earned).toBe(false);
  });

  it("rank badges ask rankEverReached, not the live tier", () => {
    const stats = mockStats({ rankEverReached: (id) => id === "gold" });
    const badges = getBadges(stats);
    expect(badges.find((b) => b.id === "rank-gold").earned).toBe(true);
    expect(badges.find((b) => b.id === "rank-diamond").earned).toBe(false);
  });

  it("progress pairs count up towards the next threshold", () => {
    const badges = getBadges(mockStats({ rounds: 6 }));
    expect(badges.find((b) => b.id === "rounds-10").progress(mockStats({ rounds: 6 }))).toEqual([6, 10]);
  });

  it("stamps today's date the first time a badge is earned, then keeps it stable", () => {
    const today = new Date().toISOString().slice(0, 10);
    const first = getBadges(mockStats({ rounds: 1 })).find((b) => b.id === "first-round");
    expect(first.earnedDate).toBe(today);
    // Re-checking later (stats unchanged) must not move the date.
    const again = getBadges(mockStats({ rounds: 1 })).find((b) => b.id === "first-round");
    expect(again.earnedDate).toBe(today);
  });

  it("locked badges carry no earned date", () => {
    const badge = getBadges(mockStats()).find((b) => b.id === "first-round");
    expect(badge.earnedDate).toBeNull();
  });

  it("every badge has a unique id and a name", () => {
    const ids = BADGE_DEFS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of BADGE_DEFS) expect(b.name).toBeTruthy();
  });
});
