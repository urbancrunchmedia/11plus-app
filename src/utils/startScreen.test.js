import { describe, it, expect } from "vitest";
import { chooseStartScreen } from "./startScreen";

describe("chooseStartScreen", () => {
  it("puts a reload back exactly where it was, Settings included", () => {
    expect(chooseStartScreen("me", "home")).toBe("me");
    expect(chooseStartScreen("report", "home")).toBe("report");
    expect(chooseStartScreen("spelling", "home")).toBe("spelling");
  });

  it("resumes an ordinary section on a later visit", () => {
    expect(chooseStartScreen(null, "leaderboard")).toBe("leaderboard");
    expect(chooseStartScreen(null, "punctuation")).toBe("punctuation");
  });

  // Signing in used to drop you in Settings because that's where you left off.
  it("never opens a new visit on a grown-up section", () => {
    expect(chooseStartScreen(null, "me")).toBe("home");
    expect(chooseStartScreen(null, "report")).toBe("home");
  });

  it("falls back to home on anything unrecognised", () => {
    expect(chooseStartScreen(null, null)).toBe("home");
    expect(chooseStartScreen("nonsense", "rubbish")).toBe("home");
    expect(chooseStartScreen(undefined, undefined)).toBe("home");
  });
});
