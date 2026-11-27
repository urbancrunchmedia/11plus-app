import { describe, it, expect, beforeEach, vi } from "vitest";

// Stripe stand-in: each test sets the customer's existing subscriptions.
const stripeState = vi.hoisted(() => ({ subs: [], created: 0, updated: [] }));
vi.mock("../server/stripe.js", () => ({
  getStripe: () => ({
    subscriptions: {
      list: async () => ({ data: stripeState.subs }),
      update: async (id, patch) => { stripeState.updated.push({ id, patch }); return {}; },
    },
    checkout: { sessions: { create: async () => { stripeState.created++; return { url: "https://checkout.stripe.test/s" }; } } },
  }),
  findOrCreateCustomer: async () => ({ id: "cus_1" }),
}));

import handler from "../api/checkout.js";
import { call, makeUser, resetEmulators } from "./helpers.js";

process.env.VITE_STRIPE_PRICE_ANNUAL = "price_annual";
process.env.VITE_STRIPE_PRICE_MONTHLY = "price_monthly";
const buy = (token) => call(handler, { token, body: { priceId: "price_annual" } });

describe("checkout never creates a second subscription", () => {
  let fam;
  beforeEach(async () => {
    await resetEmulators();
    Object.assign(stripeState, { subs: [], created: 0, updated: [] });
    fam = await makeUser("buyer1", "buyer@family.test", "Bea");
  });

  it("a new family gets a checkout page", async () => {
    const r = await buy(fam.token);
    expect(r.status).toBe(200);
    expect(r.data.url).toContain("checkout");
    expect(stripeState.created).toBe(1);
  });

  it("refuses while a subscription is running, including during the free trial", async () => {
    for (const status of ["trialing", "active", "past_due"]) {
      stripeState.subs = [{ id: "sub_1", status, cancel_at_period_end: false }];
      const r = await buy(fam.token);
      expect(r.status).toBe(409);
      expect(r.data.error).toBe("already_subscribed");
    }
    expect(stripeState.created).toBe(0);
  });

  it("switches a cancelled plan's renewal back on instead of charging again", async () => {
    stripeState.subs = [{ id: "sub_2", status: "active", cancel_at_period_end: true }];
    const r = await buy(fam.token);
    expect(r.data).toEqual({ resumed: true });
    expect(stripeState.updated).toEqual([{ id: "sub_2", patch: { cancel_at_period_end: false } }]);
    expect(stripeState.created).toBe(0);
  });
});
