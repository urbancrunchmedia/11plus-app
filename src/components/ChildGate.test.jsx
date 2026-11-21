import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

const auth = { confirmGrownUp: vi.fn(), usesPassword: () => true };
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => auth }));
import ChildGate from "./ChildGate";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
async function mount(props) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  await act(async () => { createRoot(el).render(<ChildGate name="Amu" pin="1234" onUnlock={() => {}} {...props} />); });
  return el;
}
const button = (text) => [...document.querySelectorAll("button")].find((b) => b.textContent === text);
async function type(input, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => { document.body.innerHTML = ""; auth.confirmGrownUp.mockReset(); });

describe("ChildGate: Forgot the PIN?", () => {
  it("needs the account password before turning the lock off", async () => {
    const onReset = vi.fn();
    await mount({ onReset });
    await act(async () => { button("Forgot the PIN?").click(); });
    expect(button("Confirm and turn the lock off").disabled).toBe(true);
    await type(document.querySelector("input[type=password]"), "secret");
    await act(async () => { button("Confirm and turn the lock off").click(); });
    expect(auth.confirmGrownUp).toHaveBeenCalledWith("secret");
    expect(onReset).toHaveBeenCalled();
  });

  it("keeps the lock on when the password is wrong", async () => {
    const onReset = vi.fn();
    auth.confirmGrownUp.mockRejectedValueOnce(new Error("That password isn't right."));
    await mount({ onReset });
    await act(async () => { button("Forgot the PIN?").click(); });
    await type(document.querySelector("input[type=password]"), "guess");
    await act(async () => { button("Confirm and turn the lock off").click(); });
    expect(onReset).not.toHaveBeenCalled();
    expect(document.querySelector("[role=alert]").textContent).toContain("That password isn't right.");
  });
});
