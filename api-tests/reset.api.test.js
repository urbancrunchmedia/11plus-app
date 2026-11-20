import { describe, it, expect, beforeEach } from "vitest";
import handler from "../api/email/welcome.js";
import { call, makeUser, resetEmulators } from "./helpers.js";

const outbox = () => globalThis.__emailOutbox || [];
beforeEach(resetEmulators);

describe("password reset requests", () => {
  it("always gives the same answer, and emails only real accounts", async () => {
    await makeUser("p1", "parent@family.test", "Amu");
    const real = await call(handler, { body: { type: "reset", email: "parent@family.test" } });
    const fake = await call(handler, { body: { type: "reset", email: "nobody@family.test" } });
    expect(real).toEqual(fake);
    expect(outbox().map((m) => m.to)).toEqual(["parent@family.test"]);
  });

  it("allows 3 an hour per email address", async () => {
    await makeUser("p1", "parent@family.test", "Amu");
    for (let i = 0; i < 5; i++) await call(handler, { body: { type: "reset", email: "parent@family.test" }, ip: `10.0.0.${i}` });
    expect(outbox().length).toBe(3);
  });

  it("allows 10 an hour per network address, across different emails", async () => {
    await makeUser("p1", "parent@family.test", "Amu");
    for (let i = 0; i < 10; i++) await call(handler, { body: { type: "reset", email: `someone${i}@family.test` }, ip: "9.9.9.9" });
    const res = await call(handler, { body: { type: "reset", email: "parent@family.test" }, ip: "9.9.9.9" });
    expect(res.status).toBe(200);
    expect(outbox().length).toBe(0);
  });
});
