import { describe, it, expect, beforeEach } from "vitest";
import { hasBearer } from "./bearer.js";

const req = (authorization) => ({ headers: authorization ? { authorization } : {} });
beforeEach(() => { process.env.TEST_SECRET = "s3cret-value\n"; });

describe("hasBearer", () => {
  it("accepts the exact secret (ignoring a stray newline in the env var)", () => {
    expect(hasBearer(req("Bearer s3cret-value"), "TEST_SECRET")).toBe(true);
  });
  it("rejects wrong, partial, missing or non-Bearer values", () => {
    for (const h of ["Bearer s3cret-valu", "Bearer s3cret-value2", "s3cret-value", "Basic s3cret-value", undefined]) {
      expect(hasBearer(req(h), "TEST_SECRET")).toBe(false);
    }
  });
  it("is always false when the secret isn't configured", () => {
    delete process.env.TEST_SECRET;
    expect(hasBearer(req("Bearer "), "TEST_SECRET")).toBe(false);
    expect(hasBearer(req("Bearer undefined"), "TEST_SECRET")).toBe(false);
  });
});
