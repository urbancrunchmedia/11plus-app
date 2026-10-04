import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../firebase", () => ({ db: {} }));

function docRef(...parts) { return { path: parts.join("/") }; }

vi.mock("firebase/firestore", () => ({
  doc: (_db, ...parts) => docRef(...parts),
  collection: (_db, name) => ({ path: name }),
  query: (...args) => args,
  where: (...args) => args,
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  deleteDoc: vi.fn(async () => {}),
}));

vi.mock("firebase/auth", () => ({
  deleteUser: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  reauthenticateWithPopup: vi.fn(),
}));

vi.mock("./leaderboard", () => ({
  getSettings: () => ({ sound: true }),
  getAllBests: () => ({ "A-synonyms-20": { stars: 45 } }),
  getAllHistory: () => ({}),
}));

import { getDoc, getDocs, deleteDoc } from "firebase/firestore";
import { deleteUser, reauthenticateWithPopup } from "firebase/auth";
import { exportMyData, deleteMyAccount, formatAsText } from "./dataRights";

const USER = {
  uid: "u1", email: "a@b.com", displayName: "Amu",
  providerData: [{ providerId: "password" }],
  metadata: { creationTime: "2026-01-01", lastSignInTime: "2026-09-09" },
};

describe("exportMyData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("gathers the cloud profile, cloud progress, friendships and account info into one object", async () => {
    getDoc.mockImplementation((ref) =>
      ref.path === "profiles/u1"
        ? { exists: () => true, data: () => ({ displayName: "Amu", points: 40, code: "WM-ABCDE" }) }
        : { exists: () => true, data: () => ({ bests: { x: 1 } }) }
    );
    getDocs.mockResolvedValue({ docs: [{ data: () => ({ uids: ["u1", "u2"] }) }] });

    const out = await exportMyData(USER);

    expect(out.account.uid).toBe("u1");
    expect(out.account.email).toBe("a@b.com");
    expect(out.cloudProfile.points).toBe(40);
    expect(out.cloudProgress.bests.x).toBe(1);
    expect(out.friendships).toHaveLength(1);
    expect(out.onThisDeviceOnly.personalBests["A-synonyms-20"].stars).toBe(45);
  });

  it("refuses without a signed-in user", async () => {
    await expect(exportMyData(null)).rejects.toThrow(/not signed in/i);
  });
});

describe("deleteMyAccount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes the profile, users doc, every friendship, the code entry, then the login — in that order", async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ code: "WM-ABCDE" }) });
    getDocs.mockResolvedValue({ docs: [{ ref: docRef("friendships", "u1__u2") }] });
    deleteUser.mockResolvedValue();

    await deleteMyAccount(USER);

    const deletedPaths = deleteDoc.mock.calls.map((c) => c[0].path);
    expect(deletedPaths).toEqual(
      expect.arrayContaining(["friendships/u1__u2", "codes/WM-ABCDE", "profiles/u1", "users/u1"])
    );
    // The Firestore data must be gone before the login itself is removed —
    // deleting the account first would leave orphaned documents no rule
    // permits cleaning up afterwards (they'd no longer be "yours").
    const authTime = deleteUser.mock.invocationCallOrder[0];
    expect(deletedPaths.length).toBeGreaterThan(0);
    expect(Math.max(...deleteDoc.mock.invocationCallOrder)).toBeLessThan(authTime);
  });

  it("silently re-proves identity for a Google account on a stale session, then retries", async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    getDocs.mockResolvedValue({ docs: [] });
    const googleUser = { ...USER, providerData: [{ providerId: "google.com" }] };
    deleteUser
      .mockRejectedValueOnce({ code: "auth/requires-recent-login" })
      .mockResolvedValueOnce();
    reauthenticateWithPopup.mockResolvedValue();

    await deleteMyAccount(googleUser);

    expect(reauthenticateWithPopup).toHaveBeenCalled();
    expect(deleteUser).toHaveBeenCalledTimes(2);
  });

  it("gives a password account a clear next step instead of a raw Firebase error", async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    getDocs.mockResolvedValue({ docs: [] });
    deleteUser.mockRejectedValue({ code: "auth/requires-recent-login" });

    await expect(deleteMyAccount(USER)).rejects.toThrow(/sign out, sign back in/i);
  });

  it("refuses without a signed-in user", async () => {
    await expect(deleteMyAccount(null)).rejects.toThrow(/not signed in/i);
  });
});

describe("formatAsText", () => {
  // The downloadable export is plain text, not raw JSON, so a parent can
  // read it without knowing what a brace or a camelCase key means.
  it("humanises camelCase keys into readable labels", () => {
    const out = formatAsText({ displayName: "Amu", signInProviders: ["password"] });
    expect(out).toContain("Display name: Amu");
    expect(out).toContain("Sign in providers: password");
  });

  it("shows null/undefined/empty fields as 'Not set' rather than dropping them", () => {
    const out = formatAsText({ code: null, note: undefined, nickname: "" });
    expect(out).toContain("Code: Not set");
    expect(out).toContain("Note: Not set");
    expect(out).toContain("Nickname: Not set");
  });

  it("formats an ISO timestamp as a locale date/time string", () => {
    const out = formatAsText({ createdAt: "2026-01-01T10:00:00.000Z" });
    expect(out).toMatch(/Created at: \d{1,2}\/\d{1,2}\/\d{4}/);
  });

  it("indents nested objects under their own label", () => {
    const out = formatAsText({ cloudProfile: { points: 40 } });
    expect(out).toContain("Cloud profile:");
    expect(out).toContain("  Points: 40");
  });

  it("numbers array-of-object entries (e.g. friendships) without losing any", () => {
    const out = formatAsText({ friendships: [{ uids: ["a", "b"] }, { uids: ["a", "c"] }] });
    expect(out).toContain("1.");
    expect(out).toContain("2.");
    expect((out.match(/Uids:/g) || []).length).toBe(2);
  });

  it("joins a plain array of primitives on one line", () => {
    const out = formatAsText({ signInProviders: ["password", "google.com"] });
    expect(out).toContain("Sign in providers: password, google.com");
  });

  it("shows an empty object (e.g. no personal bests yet) as 'None', not a blank line", () => {
    const out = formatAsText({ personalBests: {} });
    expect(out).toContain("Personal bests: None");
  });
});
