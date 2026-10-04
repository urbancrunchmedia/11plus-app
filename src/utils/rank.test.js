import { describe, it, expect, beforeEach } from "vitest";
import { weekKey } from "./weekly";
import { RANK_TIERS, getRank, rankEverReached, evaluateWeeklyRank, getRankProgress, claimPendingPromotion } from "./rank";

const at = (iso) => new Date(iso);
const WEEK1 = at("2026-09-08T10:00:00Z"); // Tue, week of 7 Sep
const WEEK2 = at("2026-09-15T10:00:00Z"); // next Mon-starting week
const WEEK3 = at("2026-09-22T10:00:00Z");
const WEEK4 = at("2026-09-29T10:00:00Z");

function storeRawWeek(date, points) {
  localStorage.setItem("11plus_week_points", JSON.stringify({ key: weekKey(date), points }));
}

describe("rank", () => {
  beforeEach(() => localStorage.clear());

  it("starts everyone at Wanderer", () => {
    expect(getRank()).toEqual({ tier: "bronze", bestTier: "bronze" });
  });

  it("does nothing until a completed week exists", () => {
    expect(evaluateWeeklyRank(WEEK1)).toEqual({ changed: false, direction: null, tier: "bronze" });
    // Points recorded for the CURRENT (in-progress) week don't count yet.
    storeRawWeek(WEEK1, 9999);
    expect(evaluateWeeklyRank(WEEK1)).toEqual({ changed: false, direction: null, tier: "bronze" });
  });

  it("promotes exactly one tier at a time, never skipping ahead", () => {
    storeRawWeek(WEEK1, 1000); // Champion-level points, but only one week recorded
    const result = evaluateWeeklyRank(WEEK2);
    expect(result).toEqual({ changed: true, direction: "up", tier: "silver" });
    expect(getRank().tier).toBe("silver");
  });

  it("requires two consecutive weak weeks before demoting", () => {
    // Climb to gold first.
    storeRawWeek(WEEK1, 1000);
    evaluateWeeklyRank(WEEK2); // -> silver
    storeRawWeek(WEEK2, 1000);
    evaluateWeeklyRank(WEEK3); // -> gold
    expect(getRank().tier).toBe("gold");

    // One weak week: no visible drop yet.
    storeRawWeek(WEEK3, 0);
    const first = evaluateWeeklyRank(WEEK4);
    expect(first).toEqual({ changed: false, direction: null, tier: "gold" });
    expect(getRank().tier).toBe("gold");

    // Second weak week in a row: now it drops, exactly one step.
    const WEEK5 = at("2026-10-06T10:00:00Z");
    storeRawWeek(WEEK4, 0);
    const second = evaluateWeeklyRank(WEEK5);
    expect(second).toEqual({ changed: true, direction: "down", tier: "silver" });
  });

  it("a week that clears the bar resets the weak-week count (never cumulative across good/bad weeks)", () => {
    storeRawWeek(WEEK1, 1000);
    evaluateWeeklyRank(WEEK2); // -> silver
    storeRawWeek(WEEK2, 1000);
    evaluateWeeklyRank(WEEK3); // -> gold

    storeRawWeek(WEEK3, 0); // one weak week
    evaluateWeeklyRank(WEEK4);
    storeRawWeek(WEEK4, 300); // clears gold's bar again — resets the streak
    evaluateWeeklyRank(at("2026-10-06T10:00:00Z"));
    expect(getRank().tier).toBe("gold");

    // Only now does a single weak week start counting again, not two-in-a-row
    // from before the reset.
    storeRawWeek(at("2026-10-06T10:00:00Z"), 0);
    const result = evaluateWeeklyRank(at("2026-10-13T10:00:00Z"));
    expect(result.changed).toBe(false);
    expect(getRank().tier).toBe("gold");
  });

  it("a silent gap (no play in between) only ever scores the most recently recorded week, never cascades", () => {
    storeRawWeek(WEEK1, 1000);
    evaluateWeeklyRank(WEEK2); // -> silver

    // Weeks pass with zero play; nothing new is ever written to
    // 11plus_week_points in that gap (addWeeklyPoints is only ever called
    // from a real round). The next time they play, only that week's total
    // is evaluated — a single step, not a demotion for every silent week.
    const monthsLater = at("2027-01-05T10:00:00Z");
    storeRawWeek(monthsLater, 1000);
    const result = evaluateWeeklyRank(at("2027-01-12T10:00:00Z"));
    expect(result.direction).toBe("up");
    expect(getRank().tier).toBe("gold"); // exactly one step up from silver
  });

  it("bestTier only ever rises, even after a later demotion", () => {
    storeRawWeek(WEEK1, 1000);
    evaluateWeeklyRank(WEEK2); // -> silver
    storeRawWeek(WEEK2, 1000);
    evaluateWeeklyRank(WEEK3); // -> gold
    expect(getRank().bestTier).toBe("gold");

    storeRawWeek(WEEK3, 0);
    evaluateWeeklyRank(WEEK4);
    storeRawWeek(WEEK4, 0);
    evaluateWeeklyRank(at("2026-10-06T10:00:00Z")); // demotes to silver
    expect(getRank().tier).toBe("silver");
    expect(getRank().bestTier).toBe("gold"); // never forgotten
  });

  it("rankEverReached reflects bestTier, not the live tier", () => {
    storeRawWeek(WEEK1, 1000);
    evaluateWeeklyRank(WEEK2);
    storeRawWeek(WEEK2, 1000);
    evaluateWeeklyRank(WEEK3); // bestTier -> gold
    storeRawWeek(WEEK3, 0);
    evaluateWeeklyRank(WEEK4);
    storeRawWeek(WEEK4, 0);
    evaluateWeeklyRank(at("2026-10-06T10:00:00Z")); // live tier drops to silver

    expect(rankEverReached("gold")).toBe(true);
    expect(rankEverReached("platinum")).toBe(false);
  });

  it("never demotes below Wanderer", () => {
    storeRawWeek(WEEK1, 0);
    evaluateWeeklyRank(WEEK2);
    storeRawWeek(WEEK2, 0);
    evaluateWeeklyRank(WEEK3);
    expect(getRank().tier).toBe("bronze");
  });

  it("RANK_TIERS facet count rises with tier (Prodigy-style, more facets = harder)", () => {
    for (let i = 1; i < RANK_TIERS.length; i++) {
      expect(RANK_TIERS[i].facets).toBeGreaterThan(RANK_TIERS[i - 1].facets);
    }
  });

  it("queues a promotion for later claiming, since the flip can be detected anywhere (e.g. HomeDashboard on app open), long before a kid reaches GameComplete", () => {
    storeRawWeek(WEEK1, 1000);
    evaluateWeeklyRank(WEEK2); // promotes to silver — e.g. this ran from HomeDashboard's mount

    // Any number of other screens calling getStats()/evaluateWeeklyRank()
    // in between (Settings, BadgesScreen, Home again) must not lose it.
    evaluateWeeklyRank(WEEK2);
    evaluateWeeklyRank(WEEK2);

    // The round finishes later — GameComplete claims it exactly once.
    expect(claimPendingPromotion()).toEqual({ tier: "silver" });
    expect(claimPendingPromotion()).toBeNull(); // already claimed, not shown twice
  });

  it("never queues a demotion for celebration", () => {
    storeRawWeek(WEEK1, 1000);
    evaluateWeeklyRank(WEEK2); // -> silver
    storeRawWeek(WEEK2, 1000);
    evaluateWeeklyRank(WEEK3); // -> gold
    claimPendingPromotion(); // clear the gold promotion first

    storeRawWeek(WEEK3, 0);
    evaluateWeeklyRank(WEEK4);
    storeRawWeek(WEEK4, 0);
    evaluateWeeklyRank(at("2026-10-06T10:00:00Z")); // demotes to silver

    expect(claimPendingPromotion()).toBeNull();
  });

  it("a second promotion queues even if the first was never claimed", () => {
    storeRawWeek(WEEK1, 1000);
    evaluateWeeklyRank(WEEK2); // -> silver (never claimed)
    storeRawWeek(WEEK2, 1000);
    evaluateWeeklyRank(WEEK3); // -> gold

    // Only the latest promotion is worth showing, not a backlog of two.
    expect(claimPendingPromotion()).toEqual({ tier: "gold" });
  });

  it("getRankProgress reports distance to the next tier", () => {
    const progress = getRankProgress();
    expect(progress.tier).toBe("bronze");
    expect(progress.nextLabel).toBe("Adventurer");
    expect(progress.toNext).toBe(70);
  });
});
