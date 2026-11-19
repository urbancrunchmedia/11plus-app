import { describe, it, expect, beforeEach } from "vitest";
import { shouldOpenTutorDashboard } from "./tutorNav";

beforeEach(() => sessionStorage.clear());

describe("tutor landing", () => {
  it("sends a tutor opening the app to their dashboard", () => {
    expect(shouldOpenTutorDashboard({ isTutor: true, path: "/" })).toBe(true);
  });
  it("leaves families, and other pages, alone", () => {
    expect(shouldOpenTutorDashboard({ isTutor: false, path: "/" })).toBe(false);
    expect(shouldOpenTutorDashboard({ isTutor: true, path: "/owner" })).toBe(false);
  });
  it("stays in the games after 'Back to games' for the rest of the visit", () => {
    sessionStorage.setItem("11plus_tutor_playing", "1");
    expect(shouldOpenTutorDashboard({ isTutor: true, path: "/" })).toBe(false);
  });
});
