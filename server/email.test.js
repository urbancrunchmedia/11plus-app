import { describe, it, expect, beforeAll } from "vitest";
import { unsubToken, checkUnsubToken, announcementEmail, inactivityEmail, welcomeEmail, firstRoundEmail } from "./email.js";

beforeAll(() => { process.env.EMAIL_UNSUB_SECRET = "test-secret"; });

describe("unsubscribe tokens", () => {
  it("accepts the token for the same uid", () => {
    expect(checkUnsubToken("abc", unsubToken("abc"))).toBe(true);
  });
  it("rejects another uid's token, junk and missing values", () => {
    expect(checkUnsubToken("abc", unsubToken("xyz"))).toBe(false);
    expect(checkUnsubToken("abc", "nope")).toBe(false);
    expect(checkUnsubToken("abc", undefined)).toBe(false);
    expect(checkUnsubToken(undefined, unsubToken("abc"))).toBe(false);
  });
});

describe("templates", () => {
  it("puts an unsubscribe link only in marketing emails", () => {
    expect(welcomeEmail({ name: "Ada" }).html).not.toContain("unsubscribe");
    expect(inactivityEmail({ uid: "u1", name: "Ada", days: 6 }).html).toContain("/api/email/unsubscribe?u=u1");
    expect(firstRoundEmail({ uid: "u2" }).html).toContain("/api/email/unsubscribe?u=u2");
  });
  it("escapes announcement text and splits paragraphs on blank lines", () => {
    const { html } = announcementEmail({ uid: "u1", subject: "Hi", text: "One <b>\n\nTwo" });
    expect(html).toContain("One &lt;b&gt;");
    expect(html.match(/<p style="margin:0 0 16px/g)).toHaveLength(2);
  });
});
