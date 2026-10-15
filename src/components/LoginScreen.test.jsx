import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

const AUTH = {
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(async () => {}),
  resetPassword: vi.fn(),
  redirectError: null,
};
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => AUTH }));

import LoginScreen from "./LoginScreen";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => { createRoot(container).render(<LoginScreen />); });
  return container;
}

// The standard two-step flow: Google + "Sign in with email" first, the
// actual email/password fields only once that's tapped.
async function openEmailForm(el) {
  await act(async () => { el.querySelector(".login2-emailcta").click(); });
}

describe("LoginScreen", () => {
  beforeEach(() => { document.body.innerHTML = ""; AUTH.signInWithEmail.mockReset(); });

  // The choice screen is what a parent sees first — Google front and centre,
  // no email/password fields yet.
  it("shows Google and a 'sign in with email' choice before any form fields", async () => {
    const el = await render();
    expect(el.querySelector(".login2-google")).toBeTruthy();
    expect(el.querySelector(".login2-emailcta").textContent).toMatch(/sign in with email/i);
    expect(el.querySelector(".login2-pw")).toBeNull();
  });

  it("reveals the email/password form after choosing to sign in with email", async () => {
    const el = await render();
    await openEmailForm(el);
    expect(el.querySelector(".login2-pw input")).toBeTruthy();
    expect(el.querySelector('input[type="email"]')).toBeTruthy();
  });

  it("reveals and re-hides the password", async () => {
    const el = await render();
    await openEmailForm(el);
    const pw = () => el.querySelector(".login2-pw input");
    expect(pw().type).toBe("password");
    await act(async () => { el.querySelector(".login2-eye").click(); });
    expect(pw().type).toBe("text");
    await act(async () => { el.querySelector(".login2-eye").click(); });
    expect(pw().type).toBe("password");
  });

  // A saved password can never sign in to a Google-created account, so the
  // error has to point at the way in rather than just "incorrect password".
  it("points at Google when the credentials are rejected", async () => {
    AUTH.signInWithEmail.mockRejectedValue({ code: "auth/invalid-credential" });
    const el = await render();
    await openEmailForm(el);
    el.querySelector('input[type="email"]').value = "a@b.com";
    await act(async () => { el.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(el.querySelector(".login2-error").textContent).toMatch(/Google/);
    await act(async () => { el.querySelector(".login2-error-cta").click(); });
    expect(AUTH.signInWithGoogle).toHaveBeenCalled();
  });

  // A way back to the Google-first choice screen, rather than being stuck
  // once the email form is open.
  it("can step back from the email form to the Google/email choice", async () => {
    const el = await render();
    await openEmailForm(el);
    expect(el.querySelector(".login2-pw")).toBeTruthy();
    await act(async () => { el.querySelector(".round-back-btn").click(); });
    expect(el.querySelector(".login2-pw")).toBeNull();
    expect(el.querySelector(".login2-emailcta")).toBeTruthy();
  });

  // Google should always be one tap away, not just on the choice screen.
  it("still offers Google once the email form is open", async () => {
    const el = await render();
    expect(el.querySelector(".round-back-btn")).toBeNull();
    await openEmailForm(el);
    expect(el.querySelector(".round-back-btn")).toBeTruthy();
    expect(el.querySelector(".login2-google")).toBeTruthy();
    await act(async () => { el.querySelector(".login2-google").click(); });
    expect(AUTH.signInWithGoogle).toHaveBeenCalled();
  });

  // In-app browsers (WhatsApp, Instagram) often can't complete the Google
  // redirect round-trip — the fix is pointing at the escape hatch (email),
  // not leaving the parent stuck on Firebase's raw internal-state message.
  it("tells the parent to use email when Google's redirect sign-in fails", async () => {
    AUTH.redirectError = "auth/missing-initial-state";
    const el = await render();
    expect(el.querySelector(".login2-error").textContent).toMatch(/sign in with email/i);
    AUTH.redirectError = null;
  });
});
