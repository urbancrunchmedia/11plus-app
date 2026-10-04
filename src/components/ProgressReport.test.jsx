import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { recordAttempt } from "../utils/progress";

let premium = { isPremium: false, openPaywall: vi.fn() };
vi.mock("../contexts/PremiumContext", () => ({ usePremium: () => premium }));

import ProgressReport from "./ProgressReport";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mount(onPractise = () => {}, onPracticeSkill = () => {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => { createRoot(container).render(<ProgressReport onBack={() => {}} onPractise={onPractise} onPracticeSkill={onPracticeSkill} />); });
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

  it("groups weak words by skill, each with its own Practice button", async () => {
    premium = { isPremium: true, openPaywall: vi.fn() };
    recordAttempt({ skill: "fillInBlanks", word: "abundant", correct: false, meaning: "x" });
    recordAttempt({ skill: "spelling", word: "necessary", correct: false, meaning: "y" });
    const el = await mount();
    const groups = el.querySelectorAll(".report-skill-group");
    expect(groups.length).toBe(2);
    expect(el.querySelectorAll(".report-skill-cta").length).toBe(2);
  });

  it("calls onPracticeSkill with the skill id when its Practice button is clicked, for a paying account", async () => {
    premium = { isPremium: true, openPaywall: vi.fn() };
    recordAttempt({ skill: "spelling", word: "necessary", correct: false, meaning: "x" });
    const onPracticeSkill = vi.fn();
    const el = await mount(() => {}, onPracticeSkill);
    await act(async () => { el.querySelector(".report-skill-cta").click(); });
    expect(onPracticeSkill).toHaveBeenCalledWith("spelling");
    expect(premium.openPaywall).not.toHaveBeenCalled();
  });

  it("excludes the frozen legacy 'wordMatch' skill from words to review entirely (nothing can ever re-master it)", async () => {
    premium = { isPremium: true, openPaywall: vi.fn() };
    recordAttempt({ skill: "wordMatch", word: "old-word", correct: false, meaning: "x" });
    const el = await mount();
    expect(el.querySelector(".report-skill-group")).toBeNull();
    expect(el.textContent).toContain("No weak words right now");
  });

  it("sends a free account to the paywall when Practice is clicked, instead of launching the game", async () => {
    // Practice would otherwise deliver the same spaced-repetition benefit
    // the report is selling for free (selectWithReview isn't premium-gated),
    // so the action itself needs Full Access, not just the word list.
    recordAttempt({ skill: "fillInBlanks", word: "abundant", correct: false, meaning: "x" });
    const onPracticeSkill = vi.fn();
    const el = await mount(() => {}, onPracticeSkill);
    const cta = el.querySelector(".report-skill-cta");
    expect(cta).toBeTruthy();
    expect(cta.closest(".report-blur")).toBeNull(); // still visible, not hidden away
    await act(async () => { cta.click(); });
    expect(premium.openPaywall).toHaveBeenCalledWith("report");
    expect(onPracticeSkill).not.toHaveBeenCalled();
  });
});
