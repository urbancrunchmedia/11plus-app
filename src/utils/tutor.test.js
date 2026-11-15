import { describe, it, expect, vi } from "vitest";

vi.mock("../firebase", () => ({ auth: {}, db: {} }));
vi.mock("firebase/firestore", () => ({}));

import { withTimeout, joinMessage } from "./tutor";

describe("tutor client helpers", () => {
  it("fails a read that hangs instead of waiting for ever", async () => {
    vi.useFakeTimers();
    const hung = withTimeout(new Promise(() => {}), 15000);
    vi.advanceTimersByTime(15000);
    await expect(hung).rejects.toThrow("timeout");
    vi.useRealTimers();
  });
  it("passes a normal result straight through", async () => {
    await expect(withTimeout(Promise.resolve(42))).resolves.toBe(42);
  });
  it("writes the parent message with the code and where to enter it", () => {
    const msg = joinMessage("TUT-ABCDEFGH", "Patel Tuition");
    expect(msg).toContain("TUT-ABCDEFGH");
    expect(msg).toContain("Settings → Tutors");
    expect(msg).toContain("Patel Tuition");
  });
});
