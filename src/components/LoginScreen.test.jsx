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

describe("LoginScreen", () => {
  beforeEach(() => { document.body.innerHTML = ""; AUTH.signInWithEmail.mockReset(); });

  it("reveals and re-hides the password", async () => {
    const el = await render();
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
    el.querySelector('input[type="email"]').value = "a@b.com";
    await act(async () => { el.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(el.querySelector(".login2-error").textContent).toMatch(/Google/);
    await act(async () => { el.querySelector(".login2-error-cta").click(); });
    expect(AUTH.signInWithGoogle).toHaveBeenCalled();
  });
});
