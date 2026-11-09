import { describe, it, expect } from "vitest";
import { hasCompAccess } from "./compAccess";

describe("complimentary access", () => {
  it("lasts forever for owner accounts, any capitalisation", () => {
    expect(hasCompAccess("Reuben.Dongre@gmail.com", Date.parse("2030-01-01"))).toBe(true);
  });
  it("ends after an entry's last day", () => {
    const list = { "tutor@example.com": { until: "2026-11-30" } };
    expect(hasCompAccess("tutor@example.com", Date.parse("2026-11-30T20:00:00Z"), list)).toBe(true);
    expect(hasCompAccess("tutor@example.com", Date.parse("2026-12-01T09:00:00Z"), list)).toBe(false);
  });
  it("no longer includes the Lorenzo's Tutoring trial", () => {
    expect(hasCompAccess("lorenzo@lorenzostutoring.co.uk", Date.parse("2026-11-10T12:00:00Z"))).toBe(false);
  });
  it("is false for anyone else", () => {
    expect(hasCompAccess("someone@example.com")).toBe(false);
    expect(hasCompAccess("")).toBe(false);
  });
});
