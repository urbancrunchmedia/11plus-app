import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { recordAttempt } from "../utils/progress";

let premium = { isPremium: false, openPaywall: vi.fn() };
vi.mock("../contexts/PremiumContext", () => ({ usePremium: () => premium }));

import ProgressReport from "./ProgressReport";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mount(onPractise = () => {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => { createRoot(container).render(<ProgressReport onBack={() => {}} onPractise={onPractise} />); });
  return container;
}

describe("ProgressReport", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    premium = { isPremium: false, openPaywall: vi.fn() };
  });

  it("mounts with no history at all", async () => {
    const el = await mount();
    expect(el.textContent.length).toBeGreaterThan(0);
  });

  it("mounts once there is history to report", async () => {
    recordAttempt({ skill: "fillInBlanks", word: "abundant", correct: false, meaning: "plentiful" });
    recordAttempt({ skill: "spelling", correct: true });
    const el = await mount();
    expect(el.textContent).toContain("abundant");
  });

  it("holds the full word list behind the paywall for free accounts", async () => {
    for (const w of ["abundant", "brittle", "candid", "dormant", "elusive"]) {
      recordAttempt({ skill: "fillInBlanks", word: w, correct: false, meaning: "x" });
    }
    const el = await mount();
    expect(el.querySelector(".report-locked")).toBeTruthy();
    await act(async () => { el.querySelector(".report-cta").click(); });
    expect(premium.openPaywall).toHaveBeenCalledWith("report");
  });

  it("shows the whole list to a paying account", async () => {
    for (const w of ["abundant", "brittle", "candid", "dormant", "elusive"]) {
      recordAttempt({ skill: "fillInBlanks", word: w, correct: false, meaning: "x" });
    }
    premium = { isPremium: true, openPaywall: vi.fn() };
    const el = await mount();
    expect(el.querySelector(".report-locked")).toBeNull();
    expect(el.textContent).toContain("elusive");
  });
});
