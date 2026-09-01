import { describe, it, expect, beforeEach } from "vitest";
import {
  isLevelFree,
  roundsToday,
  bumpRoundsToday,
  roundsLeftToday,
  FREE_DAILY_ROUNDS,
} from "./entitlement";

// Seam: the free-tier rules. These decide what the paywall gates, so the
// behaviour (A free; B/C/all paid; a daily cap that clamps) is the spec.

describe("isLevelFree", () => {
  it("treats only Level A as free", () => {
    expect(isLevelFree("A")).toBe(true);
    expect(isLevelFree("B")).toBe(false);
    expect(isLevelFree("C")).toBe(false);
    expect(isLevelFree("all")).toBe(false);
  });
});

describe("daily round counter", () => {
  beforeEach(() => localStorage.clear());

  it("starts at zero with the full allowance left", () => {
    expect(roundsToday()).toBe(0);
    expect(roundsLeftToday()).toBe(FREE_DAILY_ROUNDS);
  });

  it("counts each round played", () => {
    bumpRoundsToday();
    bumpRoundsToday();
    bumpRoundsToday();
    expect(roundsToday()).toBe(3);
  });

  it("never reports negative rounds left once the cap is passed", () => {
    for (let i = 0; i < FREE_DAILY_ROUNDS + 2; i++) bumpRoundsToday();
    expect(roundsLeftToday()).toBe(0);
  });
});
