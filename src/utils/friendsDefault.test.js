import { describe, it, expect, beforeEach, vi } from "vitest";

const fakeAuth = vi.hoisted(() => ({ currentUser: null }));
vi.mock("../firebase", () => ({ auth: fakeAuth, db: {} }));

import { getSettings, needsFriendsChoice, saveFriendsChoice, setSetting } from "./leaderboard";

const account = (uid, created) => { fakeAuth.currentUser = { uid, metadata: { creationTime: new Date(created).toUTCString() } }; };

describe("friends start off for new accounts (Children's Code)", () => {
  beforeEach(() => localStorage.clear());

  it("keeps friends on for accounts created before the change", () => {
    account("old", "2026-11-01T10:00:00Z");
    expect(needsFriendsChoice()).toBe(false);
    expect(getSettings().allowFriends).toBe(true);
  });

  it("starts a new account with friends off until a grown-up chooses", () => {
    account("new", "2026-11-22T10:00:00Z");
    expect(needsFriendsChoice()).toBe(true);
    expect(getSettings().allowFriends).toBe(false);
    saveFriendsChoice(true);
    expect(needsFriendsChoice()).toBe(false);
    expect(getSettings().allowFriends).toBe(true);
  });

  it("doesn't let a new sibling account inherit another account's yes", () => {
    account("first", "2026-11-22T10:00:00Z");
    saveFriendsChoice(true);
    account("sibling", "2026-11-23T10:00:00Z");
    expect(needsFriendsChoice()).toBe(true);
    expect(getSettings().allowFriends).toBe(false);
  });

  it("an old setting on the device can't switch friends on for a new account", () => {
    setSetting("allowFriends", true);
    account("new2", "2026-11-22T10:00:00Z");
    expect(getSettings().allowFriends).toBe(false);
  });
});
