import { describe, it, expect, vi } from "vitest";
import { findCustomer, findOrCreateCustomer } from "./stripe.js";

function fakeStripe(overrides = {}) {
  return {
    customers: {
      list: vi.fn(async () => ({ data: [], has_more: false })),
      search: vi.fn(async () => ({ data: [] })),
      create: vi.fn(async (args) => ({ id: "new_cust", ...args })),
      update: vi.fn(async (id, args) => ({ id, ...args })),
      ...overrides,
    },
  };
}

describe("findCustomer", () => {
  it("finds a match via the strongly-consistent email lookup", async () => {
    const cust = { id: "cust_1", metadata: { firebaseUID: "u1" } };
    const stripe = fakeStripe({ list: vi.fn(async () => ({ data: [cust], has_more: false })) });

    const found = await findCustomer(stripe, "u1", "a@b.com");
    expect(found).toBe(cust);
    expect(stripe.customers.search).not.toHaveBeenCalled();
  });

  it("falls back to the search index when the email lookup misses", async () => {
    const cust = { id: "cust_2", metadata: { firebaseUID: "u1" } };
    const stripe = fakeStripe({ search: vi.fn(async () => ({ data: [cust] })) });

    const found = await findCustomer(stripe, "u1", "a@b.com");
    expect(found).toBe(cust);
  });

  // Regression: a real paying customer whose Firebase email no longer matches
  // Stripe's on-file email (changed email, switched provider) misses the
  // email lookup. If the search index is ALSO down/erroring at that exact
  // moment, the old code silently swallowed the error and returned null —
  // looking unsubscribed, and checkout would hand them a second free trial
  // on a disconnected new customer. It must fall back to a full scan instead.
  it("falls back to a full customer scan when the search index errors", async () => {
    const cust = { id: "cust_3", metadata: { firebaseUID: "u1" } };
    const stripe = fakeStripe({
      search: vi.fn(async () => { throw new Error("search temporarily unavailable"); }),
      list: vi.fn(async () => ({ data: [{ id: "other" }, cust], has_more: false })),
    });

    const found = await findCustomer(stripe, "u1", "stale@old.com");
    expect(found).toBe(cust);
  });

  it("pages through the scan looking for a match", async () => {
    // No email, so the only customers.list calls are the scan's own pages.
    const cust = { id: "cust_4", metadata: { firebaseUID: "u1" } };
    const stripe = fakeStripe({
      search: vi.fn(async () => { throw new Error("down"); }),
      list: vi.fn()
        .mockResolvedValueOnce({ data: [{ id: "a" }], has_more: true })
        .mockResolvedValueOnce({ data: [cust], has_more: true }),
    });

    const found = await findCustomer(stripe, "u1", null);
    expect(found).toBe(cust);
    expect(stripe.customers.list).toHaveBeenCalledTimes(2);
  });

  it("gives up after 5 pages rather than scanning an entire large customer base", async () => {
    const stripe = fakeStripe({
      search: vi.fn(async () => { throw new Error("down"); }),
      list: vi.fn(async () => ({ data: [{ id: "no-match" }], has_more: true })),
    });

    const found = await findCustomer(stripe, "u1", "stale@old.com");
    expect(found).toBeNull();
    // 1 email-lookup call + 5 scan pages.
    expect(stripe.customers.list).toHaveBeenCalledTimes(6);
  });

  it("returns null when no email, no search hit, and the scan comes up empty", async () => {
    const stripe = fakeStripe();
    const found = await findCustomer(stripe, "u1", null);
    expect(found).toBeNull();
  });
});

describe("findOrCreateCustomer", () => {
  it("creates a brand-new customer when none is found", async () => {
    const stripe = fakeStripe();
    const created = await findOrCreateCustomer(stripe, "u1", "a@b.com");
    expect(stripe.customers.create).toHaveBeenCalledWith({
      email: "a@b.com",
      metadata: { firebaseUID: "u1" },
    });
    expect(created.id).toBe("new_cust");
  });

  it("updates a found customer's email if it's drifted from the signed-in account", async () => {
    const cust = { id: "cust_1", email: "old@b.com", metadata: { firebaseUID: "u1" } };
    const stripe = fakeStripe({ list: vi.fn(async () => ({ data: [cust], has_more: false })) });

    await findOrCreateCustomer(stripe, "u1", "new@b.com");
    expect(stripe.customers.update).toHaveBeenCalledWith("cust_1", { email: "new@b.com" });
  });

  it("leaves a found customer alone when the email already matches", async () => {
    const cust = { id: "cust_1", email: "a@b.com", metadata: { firebaseUID: "u1" } };
    const stripe = fakeStripe({ list: vi.fn(async () => ({ data: [cust], has_more: false })) });

    const result = await findOrCreateCustomer(stripe, "u1", "a@b.com");
    expect(stripe.customers.update).not.toHaveBeenCalled();
    expect(result).toBe(cust);
  });
});
