import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ user: { displayName: "Ava" } }) }));
vi.mock("../utils/gamify", () => ({ getStreak: () => 3 }));

import AppNav from "./AppNav";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function render(onNavigate) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => { createRoot(container).render(<AppNav active="leaderboard" onNavigate={onNavigate} />); });
  return container;
}

describe("AppNav", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  // Regression: the "11" logo was a plain non-interactive div — visually it
  // echoes the nav's selected-pill shape, so tapping it and having nothing
  // happen read as broken rather than as a label.
  it("takes you home when the logo is tapped", async () => {
    const onNavigate = vi.fn();
    const el = await render(onNavigate);
    const logo = el.querySelector(".appnav-logo");
    expect(logo.tagName).toBe("BUTTON");
    await act(async () => { logo.click(); });
    expect(onNavigate).toHaveBeenCalledWith("home");
  });
});
