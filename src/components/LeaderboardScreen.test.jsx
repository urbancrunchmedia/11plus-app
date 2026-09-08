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
    expect(el.querySelector(".board-invite")).toBeTruthy();
  });

  it("keeps the invite fields on screen without a toggle", async () => {
    const el = await render();
    expect(el.querySelector(".board-invite")).toBeTruthy();
    expect(el.querySelector(".board-input")).toBeTruthy();
    expect(el.querySelector(".board-code").textContent).toBe("WM-7H2K9");
  });

  // Copy and Remove are icon-only, so their accessible name is the only label
  // a screen reader — or a hovering parent — ever gets.
  it("labels its icon-only buttons", async () => {
    const el = await render();

    const copy = el.querySelector(".board-iconbtn");
    expect(copy.getAttribute("aria-label")).toMatch(/copy/i);

    const remove = el.querySelector(".board-remove");
    expect(remove.getAttribute("aria-label")).toBe("Remove Sam");
    expect(remove.textContent.trim()).toBe(""); // icon only
  });
  it("says out loud that the code was copied", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const el = await render();
    await act(async () => { el.querySelector(".board-iconbtn").click(); });
    expect(writeText).toHaveBeenCalledWith("WM-7H2K9");
    // Transient toast, not text wedged into the card.
    expect(document.querySelector(".set-toast").textContent).toContain("Code copied");
  });

  it("clears the toast on its own", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const el = await render();
    await act(async () => { el.querySelector(".board-iconbtn").click(); });
    expect(document.querySelector(".set-toast")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(document.querySelector(".set-toast")).toBeNull();
    vi.useRealTimers();
  });

  it("shows the code to type out when the clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const el = await render();
    await act(async () => { el.querySelector(".board-iconbtn").click(); });
    expect(el.textContent).toContain("WM-7H2K9");
  });
});
