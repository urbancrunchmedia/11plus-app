import { describe, it, expect, beforeEach, vi } from "vitest";

// Stand-in for the signed-in account: only its creation time matters here.
const fakeAuth = vi.hoisted(() => ({ currentUser: null }));
vi.mock("../firebase", () => ({ auth: fakeAuth }));

import {
  isLevelFree,
  roundsToday,
  bumpRoundsToday,
  roundsLeftToday,
  dailyRoundLimit,
  starterLimit,
  isLegacyFree,
  tasterLeftToday,
  spendTasterRound,
  canPickLevel,
  STARTER_CUTOFF,
  STARTER_WORDS,
  STARTER_SENTENCES,
  FREE_DAILY_ROUNDS,
  LEGACY_DAILY_ROUNDS,
} from "./entitlement";

// Seam: the free-tier rules. These decide what the paywall gates, so the
// behaviour here is the spec.
const signedUp = (ms) => { fakeAuth.currentUser = { metadata: { creationTime: new Date(ms).toUTCString() } }; };
const newAccount = () => signedUp(STARTER_CUTOFF + 60_000);
const existingAccount = () => signedUp(STARTER_CUTOFF - 24 * 60 * 60 * 1000);

beforeEach(() => { localStorage.clear(); newAccount(); });

describe("isLevelFree", () => {
  it("treats only Level A as free", () => {
    expect(isLevelFree("A")).toBe(true);
    expect(isLevelFree("B")).toBe(false);
    expect(isLevelFree("C")).toBe(false);
    expect(isLevelFree("all")).toBe(false);
  });
});

describe("starter set", () => {
  it("limits new accounts to a starter set: words for word games, fewer questions for sentence games", () => {
    expect(isLegacyFree()).toBe(false);
    expect(starterLimit("synonyms")).toBe(STARTER_WORDS);
    expect(starterLimit("fillInBlanks")).toBe(STARTER_WORDS);
    expect(starterLimit("punctuation")).toBe(STARTER_SENTENCES);
    expect(starterLimit("wordClass")).toBe(STARTER_SENTENCES);
  });

  it("keeps the old free tier for accounts created before the cut-off", () => {
    existingAccount();
    expect(isLegacyFree()).toBe(true);
    expect(starterLimit("synonyms")).toBe(null);
    expect(dailyRoundLimit()).toBe(LEGACY_DAILY_ROUNDS);
  });

  it("treats an unknown account as new, never as legacy", () => {
    fakeAuth.currentUser = null;
    expect(isLegacyFree()).toBe(false);
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
