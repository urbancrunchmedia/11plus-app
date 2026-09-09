import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

let mockSub = { isPremium: false, status: "none" };
// One stable object: a fresh one per call re-fires the [user] effect on every
// render, since it's a new reference each time — infinite loop, not a hang.
const AUTH = { user: { uid: "u1", email: "a@b.com" } };
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => AUTH }));
vi.mock("../utils/subscription", () => ({
  fetchSubscription: vi.fn(async () => mockSub),
  PRICES: { monthly: "price_month", annual: "price_year" },
  stripeConfigured: true,
  startCheckout: vi.fn(),
}));

import { PremiumProvider, usePremium } from "./PremiumContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  const { openPaywall } = usePremium();
  return <button className="probe-open" onClick={() => openPaywall("feature")}>open</button>;
}

async function mount() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(<PremiumProvider><Probe /></PremiumProvider>);
  });
  // let the fetchSubscription() effect resolve
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  return container;
}

describe("PremiumContext paywall gating", () => {
  beforeEach(() => { document.body.innerHTML = ""; localStorage.clear(); });

  // The actual bug: cancelled-but-still-in-paid-period reports isPremium:true,
  // so the old `!sub.isPremium` guard silently ate the Resubscribe click.
  it("opens the paywall for a cancelled account still inside its paid period", async () => {
    mockSub = { isPremium: true, status: "active", cancelAtPeriodEnd: true };
    const el = await mount();
    await act(async () => { el.querySelector(".probe-open").click(); });
    expect(document.querySelector(".pw")).toBeTruthy();
  });

  it("opens the paywall for a trial account too", async () => {
    mockSub = { isPremium: true, status: "trialing" };
    const el = await mount();
    await act(async () => { el.querySelector(".probe-open").click(); });
    expect(document.querySelector(".pw")).toBeTruthy();
  });

  it("still suppresses it for a fully paid, non-cancelling account", async () => {
    mockSub = { isPremium: true, status: "active", cancelAtPeriodEnd: false };
    const el = await mount();
    await act(async () => { el.querySelector(".probe-open").click(); });
    expect(document.querySelector(".pw")).toBeNull();
  });

  it("opens it for a free account", async () => {
    mockSub = { isPremium: false, status: "none" };
    const el = await mount();
    await act(async () => { el.querySelector(".probe-open").click(); });
    expect(document.querySelector(".pw")).toBeTruthy();
  });
});
