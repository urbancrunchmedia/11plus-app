import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { addMiss } from "../utils/misses";
import PracticeButton from "./PracticeButton";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function render(props) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => { createRoot(container).render(<PracticeButton {...props} />); });
  return container;
}

describe("PracticeButton", () => {
  beforeEach(() => { document.body.innerHTML = ""; localStorage.clear(); });

  // Regression: a permanently-disabled "Nothing to practice" button was just
  // clutter — nothing a child could ever act on, so it's hidden instead.
  it("renders nothing when there's nothing to practice", async () => {
    const el = await render({ skill: "spelling", onPractice: vi.fn() });
    expect(el.querySelector(".landing-practice")).toBeNull();
  });

  it("shows the miss count and fires onPractice once there's something to fix", async () => {
    addMiss("spelling", "q1", {});
    addMiss("spelling", "q2", {});
    const onPractice = vi.fn();
    const el = await render({ skill: "spelling", onPractice });
    const btn = el.querySelector(".landing-practice");
    expect(btn.textContent).toContain("2");
    await act(async () => { btn.click(); });
    expect(onPractice).toHaveBeenCalled();
  });
});
