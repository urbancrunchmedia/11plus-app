import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

// First-run "set up a learner" step (design isOnboarding). Sets the display
// name shown on the leaderboard and results. Skippable.
export default function OnboardingScreen({ onDone }) {
  const { updateDisplayName } = useAuth();
  const [name, setName]   = useState("");
  const [saving, setSaving] = useState(false);
  const clean   = name.trim();
  const initial = clean.charAt(0).toUpperCase() || "?";

  async function create() {
    if (!clean || saving) return;
    setSaving(true);
    try { await updateDisplayName(clean); } catch { /* ignore */ }
    onDone();
  }

  return (
    <div className="onb">
      <div className="onb-card">
        <div className="onb-kicker">SET UP A LEARNER</div>
        <div className="onb-title">Who's learning?</div>
        <div className="onb-sub">
          Their first name appears on the leaderboard and at the end of every round.
          You can change it any time from Settings.
        </div>

        <label className="onb-field">
          <span>CHILD'S FIRST NAME</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amu" maxLength={20} autoFocus />
        </label>

        <div className="onb-preview">
          <div className="onb-avatar">{initial}</div>
          <div className="onb-preview-txt">On the board they'll show as <strong>{clean || "their name"}</strong></div>
        </div>

        <button className="onb-create" onClick={create} disabled={!clean || saving}>
          {saving ? "Creating…" : "Create profile"}
        </button>
        <button className="onb-skip" onClick={onDone}>Skip for now</button>
      </div>
    </div>
  );
}
