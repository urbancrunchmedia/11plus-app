import { describe, it, expect, beforeEach } from "vitest";
import { captureTutorJoinFromUrl, getPendingTutorJoin, clearPendingTutorJoin, tutorJoinLink } from "./tutorJoin";

const at = (p) => window.history.replaceState(null, "", p);
beforeEach(() => { localStorage.clear(); at("/"); });

describe("tutor join links", () => {
  it("remembers /join/<code> and returns the address bar to the home page", () => {
    at("/join/tut-7k3m9qx2?utm_source=whatsapp");
    captureTutorJoinFromUrl();
    expect(getPendingTutorJoin()).toBe("TUT-7K3M9QX2");
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("?utm_source=whatsapp");
  });
  it("ignores anything that isn't a tutor code, but still leaves /join", () => {
    at("/join/<script>");
    captureTutorJoinFromUrl();
    expect(getPendingTutorJoin()).toBe(null);
    expect(window.location.pathname).toBe("/");
  });
  it("does nothing on other pages", () => {
    at("/tutor");
    captureTutorJoinFromUrl();
    expect(window.location.pathname).toBe("/tutor");
  });
  it("clears a handled join and builds links", () => {
    at("/join/TUT-7K3M9QX2");
    captureTutorJoinFromUrl();
    clearPendingTutorJoin();
    expect(getPendingTutorJoin()).toBe(null);
    expect(tutorJoinLink("TUT-7K3M9QX2")).toBe(`${window.location.origin}/join/TUT-7K3M9QX2`);
  });
});
