import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({ doc: vi.fn(), getDoc: vi.fn() }));

import { captureInviteFromUrl, getPendingInvite, clearPendingInvite, inviteLink, shareInvite } from "./invite";

const at = (path) => window.history.replaceState(null, "", path);

beforeEach(() => { localStorage.clear(); at("/"); });

describe("invite links", () => {
  it("remembers ?friend=CODE and removes it from the address bar", () => {
    at("/?friend=wm-7h2k9&x=1");
    captureInviteFromUrl();
    expect(getPendingInvite()).toBe("WM-7H2K9");
    expect(window.location.search).toBe("?x=1");
  });

  it("ignores anything that isn't a friend code", () => {
    at("/?friend=<script>alert(1)</script>");
    captureInviteFromUrl();
    expect(getPendingInvite()).toBe(null);
  });

  it("clears a handled invite", () => {
    at("/?friend=WM-7H2K9");
    captureInviteFromUrl();
    clearPendingInvite();
    expect(getPendingInvite()).toBe(null);
  });

  it("builds a link back to the site", () => {
    expect(inviteLink("WM-7H2K9")).toBe(`${window.location.origin}/?friend=WM-7H2K9`);
  });

  it("copies the invite when there's no share sheet", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    expect(await shareInvite("WM-7H2K9", "Sophie")).toBe("copied");
    expect(writeText.mock.calls[0][0]).toContain("Sophie has invited you to 11 PlusLab");
    expect(writeText.mock.calls[0][0]).toContain("?friend=WM-7H2K9");
  });

  it("uses the share sheet when there is one, and treats closing it as cancelled", async () => {
    Object.defineProperty(navigator, "share", { value: vi.fn(async () => {}), configurable: true });
    expect(await shareInvite("WM-7H2K9", "Sophie")).toBe("shared");
    Object.defineProperty(navigator, "share", { value: vi.fn(async () => { throw Object.assign(new Error("x"), { name: "AbortError" }); }), configurable: true });
    expect(await shareInvite("WM-7H2K9", "Sophie")).toBe("cancelled");
  });
});
