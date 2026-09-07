import React, { useState } from "react";

// Soft PIN gate shown after sign-in when a child PIN is set. Friendly, not
// security — a grown-up reset is always available so no one gets locked out.
export default function ChildGate({
  name, pin, onUnlock, onReset, onCancel,
  title = "Who's learning today?",
  prompt = "Enter your PIN to start",
  resetLabel = "Forgot your PIN? Grown-up reset",
}) {
  const [entry, setEntry] = useState("");
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

        <button className="cgate-reset" onClick={onReset}>{resetLabel}</button>
        {onCancel && <button className="cgate-reset" onClick={onCancel}>Back</button>}
      </div>
    </div>
  );
}
