import { describe, it, expect, beforeEach } from "vitest";

import {
  isLevelFree,
  roundsToday,
  bumpRoundsToday,
  roundsLeftToday,
  dailyRoundLimit,
  starterLimit,
  tasterLeftToday,
  spendTasterRound,
  canPickLevel,
  STARTER_WORDS,
  STARTER_SENTENCES,
  FREE_DAILY_ROUNDS,
} from "./entitlement";

// Seam: the free-tier rules. These decide what the paywall gates, so the
// behaviour here is the spec.
beforeEach(() => { localStorage.clear(); });

describe("isLevelFree", () => {
  it("treats only Level A as free", () => {
    expect(isLevelFree("A")).toBe(true);
    expect(isLevelFree("B")).toBe(false);
    expect(isLevelFree("C")).toBe(false);
    expect(isLevelFree("all")).toBe(false);
  });
});

describe("starter set", () => {
  it("limits every free account to a starter set: words for word games, fewer questions for sentence games", () => {
    expect(starterLimit("synonyms")).toBe(STARTER_WORDS);
    expect(starterLimit("fillInBlanks")).toBe(STARTER_WORDS);
    expect(starterLimit("punctuation")).toBe(STARTER_SENTENCES);
    expect(starterLimit("wordClass")).toBe(STARTER_SENTENCES);
    expect(dailyRoundLimit()).toBe(FREE_DAILY_ROUNDS);
  });
});

describe("daily round counter", () => {
  it("starts at zero with the full allowance left", () => {
    expect(roundsToday()).toBe(0);
    expect(roundsLeftToday()).toBe(FREE_DAILY_ROUNDS);
  });

  it("counts each round played", () => {
    bumpRoundsToday();
    bumpRoundsToday();
    expect(roundsToday()).toBe(2);
  });

  it("never reports negative rounds left once the cap is passed", () => {
    for (let i = 0; i < FREE_DAILY_ROUNDS + 2; i++) bumpRoundsToday();
    expect(roundsLeftToday()).toBe(0);
  });
});

describe("taster round", () => {
  it("allows one harder-level round a day, then only Level A", () => {
    expect(tasterLeftToday()).toBe(1);
    expect(canPickLevel("B", false)).toBe(true);
    spendTasterRound();
    expect(tasterLeftToday()).toBe(0);
    expect(canPickLevel("B", false)).toBe(false);
    expect(canPickLevel("all", false)).toBe(false);
    expect(canPickLevel("A", false)).toBe(true);
  });

  it("never limits Full Access", () => {
    spendTasterRound();
    expect(canPickLevel("C", true)).toBe(true);
  });
});
