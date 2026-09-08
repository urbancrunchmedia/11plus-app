import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

const AUTH = {
  user: { uid: "u1", displayName: "Ava", email: "parent@example.com" },
  signOut: vi.fn(),
  updateDisplayName: vi.fn(),
};
let premium = { isPremium: false, subscription: { status: "none" }, openPaywall: vi.fn() };
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => AUTH }));
vi.mock("../contexts/PremiumContext", () => ({ usePremium: () => premium }));
vi.mock("../utils/subscription", () => ({ openBillingPortal: vi.fn() }));

import SettingsScreen from "./SettingsScreen";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mount() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => { createRoot(container).render(<SettingsScreen onOpenReport={() => {}} onHome={() => {}} />); });
  return container;
}

describe("SettingsScreen", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    premium = { isPremium: false, subscription: { status: "none" }, openPaywall: vi.fn() };
  });

  it("mounts and shows the account", async () => {
    const el = await mount();
    expect(el.textContent).toContain("parent@example.com");
  });

  it("sends a free account to the paywall instead of setting a level it can't use", async () => {
    const el = await mount();
    // Second segmented group: the first is the daily goal.
    const [levelA, levelB] = el.querySelectorAll(".set-seg")[1].querySelectorAll(".set-seg-btn");
    expect(levelB.className).toContain("locked");
    await act(async () => { levelB.click(); });
    expect(premium.openPaywall).toHaveBeenCalledWith("level");
    // A stays selectable.
    await act(async () => { levelA.click(); });
    expect(levelA.className).toContain("active");
  });

  it("lets a paying account pick any level", async () => {
    premium = { isPremium: true, subscription: { status: "active" }, openPaywall: vi.fn() };
    const el = await mount();
    const levelC = el.querySelectorAll(".set-seg")[1].querySelectorAll(".set-seg-btn")[2];
    expect(levelC.className).not.toContain("locked");
    await act(async () => { levelC.click(); });
    expect(levelC.className).toContain("active");
    expect(premium.openPaywall).not.toHaveBeenCalled();
  });

  // Turning the PIN off is destructive — it should ask, not just do it.
  it("confirms before switching the child PIN off", async () => {
    localStorage.clear();
    const el = await mount();
    const setPin = [...el.querySelectorAll("button")].find((b) => b.textContent === "Set PIN");
    await act(async () => { setPin.click(); });
    const input = el.querySelector(".set-pin-input");
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, "1234");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { [...el.querySelectorAll("button")].find((b) => b.textContent === "Save").click(); });

    await act(async () => { [...el.querySelectorAll("button")].find((b) => b.textContent === "Turn off").click(); });
    expect(document.querySelector(".set-sheet-title").textContent).toContain("Turn off the Child PIN");
  });
});
