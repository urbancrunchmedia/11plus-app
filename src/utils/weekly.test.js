import { describe, it, expect, beforeEach } from "vitest";
import {
  weekStart, weekKey, nextWeekStart, msUntilReset, formatResetIn,
  getWeeklyPoints, addWeeklyPoints, weeklyPointsOf,
} from "./weekly";

const at = (iso) => new Date(iso);

describe("weekly points", () => {
  beforeEach(() => localStorage.clear());

  it("starts the week on Monday 00:00 UTC", () => {
    // Tue 8 Sep 2026 → Mon 7 Sep. Sunday belongs to the week that began Monday.
    expect(weekStart(at("2026-09-08T21:00:00Z")).toISOString()).toBe("2026-09-07T00:00:00.000Z");
    expect(weekStart(at("2026-09-13T23:59:59Z")).toISOString()).toBe("2026-09-07T00:00:00.000Z");
    expect(weekStart(at("2026-09-14T00:00:00Z")).toISOString()).toBe("2026-09-14T00:00:00.000Z");
  });

  it("counts down to the next Monday", () => {
    expect(nextWeekStart(at("2026-09-08T00:00:00Z")).toISOString()).toBe("2026-09-14T00:00:00.000Z");
    expect(msUntilReset(at("2026-09-10T18:00:00Z"))).toBe((3 * 24 + 6) * 3600000);
    expect(formatResetIn(msUntilReset(at("2026-09-10T18:00:00Z")))).toBe("3d 6h");
    expect(formatResetIn(90 * 60000)).toBe("1h 30m");
    expect(formatResetIn(45 * 60000)).toBe("45m");
    expect(formatResetIn(0)).toBe("now");
  });

  it("accumulates within a week and reads zero in the next one", () => {
    const tue = at("2026-09-08T10:00:00Z");
    addWeeklyPoints(12, tue);
    addWeeklyPoints(9, at("2026-09-11T10:00:00Z"));
    expect(getWeeklyPoints(tue)).toBe(21);
    // Same stored bucket, new week: nothing carries over, and no job ran.
    expect(getWeeklyPoints(at("2026-09-15T10:00:00Z"))).toBe(0);
  });

  it("ignores rubbish scores", () => {
    const d = at("2026-09-08T10:00:00Z");
    addWeeklyPoints(undefined, d);
    addWeeklyPoints(-5, d);
    addWeeklyPoints(4, d);
    expect(getWeeklyPoints(d)).toBe(4);
  });

  it("credits a friend's profile only for the week it was written in", () => {
    const now = at("2026-09-08T10:00:00Z");
    expect(weeklyPointsOf({ weekKey: weekKey(now), weekPoints: 300 }, now)).toBe(300);
    expect(weeklyPointsOf({ weekKey: "2026-08-31", weekPoints: 300 }, now)).toBe(0);
    expect(weeklyPointsOf({ points: 500 }, now)).toBe(0);
    expect(weeklyPointsOf(null, now)).toBe(0);
  });
});
