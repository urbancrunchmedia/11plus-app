import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { checkDisplayName } from "../utils/nameCheck";

// One stable object: the real provider hands down a stable value, and a fresh
// one per call would re-fire the loader effect forever.
const AUTH = {
  user: { uid: "u1", displayName: "Ava" },
  // Mirrors the real context, which validates the name and throws the reason.
  updateDisplayName: vi.fn(async (n) => {
    const c = checkDisplayName(n);
    if (!c.ok) throw new Error(c.reason);
  }),
};
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => AUTH }));
vi.mock("../utils/cloudScores", () => ({
  syncProfile: vi.fn(async () => {}),
  getProfile: vi.fn(async () => ({ code: "WM-7H2K9", displayName: "Ava" })),
  getLeaderboard: vi.fn(async () => [
    // Sam has the bigger all-time total but a quieter week, so Ava leads.
    { uid: "u1", displayName: "Ava", points: 120, weekPoints: 40, isMe: true },
    { uid: "u2", displayName: "Sam", points: 900, weekPoints: 12 },
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
    expect(el.querySelector(".board-addbtn")).toBeTruthy();
  });

  it("opens the add-a-friend sheet with your code in it", async () => {
    const el = await render();
    expect(document.querySelector(".board-codeval")).toBeNull();
    await act(async () => { el.querySelector(".board-addbtn").click(); });
    expect(document.querySelector(".board-codeval").textContent).toBe("WM-7H2K9");
    expect(document.querySelector(".board-sheet-input")).toBeTruthy();
  });

  it("reveals remove buttons only while managing, each naming its friend", async () => {
    const el = await render();
    expect(el.querySelector(".board-remove")).toBeNull();
    await act(async () => { el.querySelector(".board-manage").click(); });
    const remove = el.querySelector(".board-remove");
    expect(remove.getAttribute("aria-label")).toBe("Remove Sam");
    // Your own row is renamed, never removed.
    expect(el.querySelectorAll(".board-remove").length).toBe(1);
    expect(el.querySelector(".board-rename")).toBeTruthy();
  });

  it("says out loud that the code was copied", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const el = await render();
    await act(async () => { el.querySelector(".board-addbtn").click(); });
    // Icon-only, so the accessible name is the only label it has.
    const btn = document.querySelector(".board-copybtn");
    expect(btn.textContent.trim()).toBe("");
    expect(btn.getAttribute("aria-label")).toBe("Copy your code");
    await act(async () => { btn.click(); });
    expect(writeText).toHaveBeenCalledWith("WM-7H2K9");
    expect(document.querySelector(".set-toast").textContent).toContain("Code copied");
    expect(document.querySelector(".board-copybtn").getAttribute("aria-label")).toBe("Code copied");
  });

  it("clears the toast on its own", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(async () => {}) }, configurable: true });
    const el = await render();
    await act(async () => { el.querySelector(".board-addbtn").click(); });
    await act(async () => { document.querySelector(".board-copybtn").click(); });
    expect(document.querySelector(".set-toast")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(document.querySelector(".set-toast")).toBeNull();
    vi.useRealTimers();
  });

  it("shows the code to type out when the clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const el = await render();
    await act(async () => { el.querySelector(".board-addbtn").click(); });
    await act(async () => { document.querySelector(".board-copybtn").click(); });
    expect(document.querySelector(".board-msg.err").textContent).toContain("WM-7H2K9");
  });

  it("ranks on this week and says when the week turns over", async () => {
    const el = await render();
    expect(el.querySelector(".board-sub").textContent).toMatch(/resets in \d+[dhm]/);
    const names = [...el.querySelectorAll(".board-name")].map((n) => n.textContent);
    expect(names[0]).toContain("Ava");   // 40 this week beats Sam's 12…
    expect(names[1]).toContain("Sam");   // …despite Sam's larger all-time total
    const points = [...el.querySelectorAll(".board-pts")].map((n) => n.textContent);
    expect(points).toEqual(["40", "12"]);
    expect(el.textContent).toContain("You're top of the board");
  });

  it("refuses an unacceptable name and keeps the dialog open to fix it", async () => {
    const el = await render();
    await act(async () => { el.querySelector(".board-rename").click(); });
    const input = document.querySelector(".board-sheet-input");
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, "fuck");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { document.querySelector(".set-sheet-confirm").click(); });

    expect(document.querySelector(".board-msg.err").textContent).toMatch(/isn't allowed/);
    expect(document.querySelector(".board-sheet-input")).toBeTruthy(); // still open
    expect(document.querySelector(".set-toast")).toBeNull();           // nothing claimed saved
  });
});
