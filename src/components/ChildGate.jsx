import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

// PIN gate for the grown-up area. "Forgot the PIN?" never locks anyone out,
// but it asks for the account's password (or Google sign-in) first, so a
// child can't simply tap past the lock.
export default function ChildGate({
  name, pin, onUnlock, onReset, onCancel,
  title = "Who's learning today?",
  prompt = "Enter your PIN to start",
  resetLabel = "Forgot the PIN?",
}) {
  const { confirmGrownUp, usesPassword } = useAuth() || {};
  const [entry, setEntry] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [password, setPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  const needsPassword = usesPassword ? usesPassword() : true;

  async function reset() {
    setResetBusy(true); setResetError("");
    try {
      if (confirmGrownUp) await confirmGrownUp(password);
      onReset();
    } catch (e) {
      setResetError(e.code === "auth/popup-closed-by-user" ? "" : (e.message || "Couldn't check that. Please try again."));
      setResetBusy(false);
    }
  }
  const [shake, setShake] = useState(false);
  const initial = name ? name.trim().charAt(0).toUpperCase() : "A";
  const len = pin.length || 4;

  function press(d) {
    if (entry.length >= len) return;
    const next = entry + d;
    setEntry(next);
    if (next.length === len) {
      if (next === pin) setTimeout(onUnlock, 150);
      else setTimeout(() => { setShake(true); setEntry(""); setTimeout(() => setShake(false), 400); }, 150);
    }
  }
  function del() { setEntry((e) => e.slice(0, -1)); }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <div className="cgate">
      <div className="cgate-card">
        <div className="cgate-title">{title}</div>
        <div className="cgate-profile">
          <div className="cgate-avatar">{initial}</div>
          <div className="cgate-name">{name || "Player"}</div>
        </div>

        <div className="cgate-prompt">{prompt}</div>
        <div className={`cgate-dots ${shake ? "shake" : ""}`}>
          {Array.from({ length: len }, (_, i) => (
            <span key={i} className={`cgate-dot ${i < entry.length ? "filled" : ""}`} />
          ))}
        </div>

        <div className="cgate-pad">
          {keys.map((k, i) =>
            k === "" ? <span key={i} /> : (
              <button key={i} className="cgate-key" onClick={() => (k === "⌫" ? del() : press(k))}>{k}</button>
            )
          )}
        </div>

        {onCancel && <button className="cgate-back" onClick={onCancel}>Back</button>}
        <button className="cgate-reset" onClick={() => setConfirmReset(true)}>{resetLabel}</button>
      </div>

      {confirmReset && (
        <div className="set-sheet-overlay" onClick={() => !resetBusy && setConfirmReset(false)}>
          <div className="set-sheet" role="dialog" aria-modal="true" aria-labelledby="pin-reset-title" onClick={(e) => e.stopPropagation()}>
            <div className="set-sheet-title" id="pin-reset-title">Forgot the PIN?</div>
            <div className="set-sheet-sub">
              {needsPassword
                ? "Enter the password for this account to turn the PIN lock off. You can set a new PIN in Settings."
                : "Sign in with Google again to turn the PIN lock off. You can set a new PIN in Settings."}
            </div>
            {needsPassword && (
              <input
                className="set-name-input" type="password" autoComplete="current-password" autoFocus
                placeholder="Account password" aria-label="Account password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && password) reset(); }}
              />
            )}
            {resetError && <div className="board-msg err" role="alert">{resetError}</div>}
            <button className="set-sheet-confirm" onClick={reset} disabled={resetBusy || (needsPassword && !password)}>
              {resetBusy ? "Checking…" : needsPassword ? "Confirm and turn the lock off" : "Continue with Google"}
            </button>
            <button className="set-sheet-cancel" onClick={() => setConfirmReset(false)} disabled={resetBusy}>Keep it on</button>
          </div>
        </div>
      )}
    </div>
  );
}
