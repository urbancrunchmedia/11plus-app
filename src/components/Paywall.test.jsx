import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

vi.mock("../firebase", () => ({ auth: { currentUser: null }, db: {} }));
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));
vi.mock("../contexts/PremiumContext", () => ({ usePremium: () => ({ subscription: { trialEligible: true } }) }));
const startCheckout = vi.hoisted(() => vi.fn(() => new Promise(() => {})));
vi.mock("../utils/subscription", () => ({ PRICES: { annual: "price_a", monthly: "price_m" }, stripeConfigured: true, startCheckout }));

import Paywall from "./Paywall";
import { setSetting } from "../utils/leaderboard";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let el;
function mount() {
  el = document.createElement("div"); document.body.appendChild(el);
  act(() => createRoot(el).render(<Paywall reason="level" onClose={() => {}} />));
}
const btn = (text) => [...el.querySelectorAll("button")].find((b) => b.textContent === text);
function type(value) {
  const input = el.querySelector("#pw-gate-input");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  act(() => { setter.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
  act(() => { input.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
}

describe("Paywall grown-up check", () => {
  beforeEach(() => { localStorage.clear(); document.body.innerHTML = ""; startCheckout.mockClear(); });

  it("hides prices until a grown-up passes the check, and never asks children to ask a parent", () => {
    mount();
    expect(el.textContent).not.toMatch(/£/);
    expect(el.textContent).not.toMatch(/ask a grown-up/i);
    act(() => btn("I'm a grown-up").click());
    const [, a, b] = el.textContent.match(/what is (\d+) × (\d+)/);
    type("1");
    expect(el.textContent).toMatch(/That's not right/);
    expect(el.textContent).not.toMatch(/£34\.99/);
    type(String(Number(a) * Number(b)));
    expect(el.textContent).toMatch(/Free for 7 days, then £34\.99 a year\. Renews automatically until you cancel/);
  });

  it("uses the grown-up PIN when one is set", () => {
    setSetting("childPin", "2468");
    mount();
    act(() => btn("I'm a grown-up").click());
    expect(el.textContent).toMatch(/Enter the grown-up PIN/);
    type("1111");
    expect(el.textContent).toMatch(/not the grown-up PIN/);
    type("2468");
    act(() => el.querySelectorAll(".pw-plan")[1].click()); // monthly
    expect(el.textContent).toMatch(/then £4\.99 a month/);
  });
});
