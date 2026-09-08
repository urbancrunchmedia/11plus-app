import { describe, it, expect } from "vitest";
import { checkDisplayName } from "./nameCheck";

describe("checkDisplayName", () => {
  it("accepts the names children actually have", () => {
    for (const n of ["Amaira", "Rhema", "Amu", "Mary-Jane", "O'Neill", "Zoë", "Ravi Kumar"]) {
      expect(checkDisplayName(n), n).toMatchObject({ ok: true });
    }
  });

  it("tidies whitespace rather than rejecting it", () => {
    expect(checkDisplayName("  Amaira   D  ")).toEqual({ ok: true, value: "Amaira D" });
  });

  it("rejects profanity, including obfuscated spellings", () => {
    for (const n of ["fuck", "Fuck", "f*ck", "fvck", "sh1t", "bitch", "Amu the shit"]) {
      expect(checkDisplayName(n).ok, n).toBe(false);
    }
  });

  // A name is a hiding place for contact details on a shared leaderboard.
  it("rejects links, emails and phone numbers", () => {
    for (const n of ["www.evil.com", "me@mail.com", "call 07700900123", "https://x.co"]) {
      expect(checkDisplayName(n).ok, n).toBe(false);
    }
  });

  it("rejects lengths and shapes that aren't names", () => {
    expect(checkDisplayName("A").ok).toBe(false);
    expect(checkDisplayName("x".repeat(21)).ok).toBe(false);
    expect(checkDisplayName("<script>").ok).toBe(false);
    expect(checkDisplayName("").ok).toBe(false);
    expect(checkDisplayName(null).ok).toBe(false);
  });

  it("explains itself, so the message can go straight on screen", () => {
    expect(checkDisplayName("A").reason).toMatch(/2 letters/);
    expect(checkDisplayName("me@mail.com").reason).toMatch(/links, emails/);
  });
});
