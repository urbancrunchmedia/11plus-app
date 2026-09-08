import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

// The leaderboard talks to Firebase; stub the edges so this stays a render test.
// One stable object: the real provider hands down a stable value, and a fresh
// one per call would re-fire the loader effect forever.
const AUTH = { user: { uid: "u1", displayName: "Ava" }, updateDisplayName: vi.fn() };
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => AUTH }));
vi.mock("../utils/cloudScores", () => ({
  syncProfile: vi.fn(async () => {}),
  getProfile: vi.fn(async () => ({ code: "WM-7H2K9", displayName: "Ava" })),
  getLeaderboard: vi.fn(async () => [
    { uid: "u1", displayName: "Ava", points: 120, isMe: true },
    { uid: "u2", displayName: "Sam", points: 90 },
  ]),
  addFriendByCode: vi.fn(),
  removeFriend: vi.fn(),
}));

import LeaderboardScreen from "./LeaderboardScreen";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => { createRoot(container).render(<LeaderboardScreen onPlay={() => {}} />); });
  return container;
}

describe("LeaderboardScreen", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  // Regression: a `rows.length` dependency declared above `const rows` threw a
  // temporal-dead-zone ReferenceError on mount — invisible to build and to the
  // pure-logic tests, so opening the tab hit the error boundary.
  it("mounts and lists the board without throwing", async () => {
    const el = await render();
    expect(el.textContent).toContain("Leaderboard");
    expect(el.textContent).toContain("Sam");
    expect(el.querySelector(".board-headbtn")).toBeTruthy();
  });

  it("keeps the add panel closed when there are friends to compare against", async () => {
    const el = await render();
    expect(el.querySelector(".board-addpanel")).toBeNull();
  });
});
