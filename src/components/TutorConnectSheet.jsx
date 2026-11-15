import React, { useState } from "react";
import { getSetting } from "../utils/leaderboard";

// The grown-up's confirmation before a child is connected to a tutor: who the
// tutor is, exactly what they will and won't see, then Connect. Used from
// Settings → Tutors and from a tutor's /join link. When the Child PIN lock is
// on, the PIN is needed too, so a child can't connect themselves.
export default function TutorConnectSheet({ childName, found, busy, error, onConfirm, onCancel }) {
  const pin = getSetting("parentPinLock", false) ? getSetting("childPin", "") : "";
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  function confirm() {
    if (pin && pinInput !== pin) { setPinError("That PIN isn't right."); return; }
    onConfirm();
  }

  return (
    <div className="set-sheet-overlay" onClick={busy ? undefined : onCancel}>
      <div className="set-sheet" role="dialog" aria-modal="true" aria-labelledby="tutor-confirm-title" onClick={(e) => e.stopPropagation()}>
        <div className="set-sheet-title" id="tutor-confirm-title">Connect {childName} to {found.tutorName}?</div>
        {found.business && <div className="set-sheet-sub">{found.business}</div>}
        <div className="tutor-share">
          <div className="tutor-share-col">
            <div className="tutor-share-head">They'll see</div>
            <ul>
              <li>{childName}'s name on 11 PlusLab</li>
              <li>Games played, scores and accuracy</li>
              <li>Words {childName} finds tricky</li>
              <li>When and how long {childName} practises</li>
            </ul>
          </div>
          <div className="tutor-share-col tutor-share-col--no">
            <div className="tutor-share-head">They won't see</div>
            <ul>
              <li>Your email address or name</li>
              <li>Your billing or plan</li>
              <li>Anything else on this account</li>
            </ul>
          </div>
        </div>
        {found.pending && (
          <div className="set-sheet-sub" data-testid="tutor-pending-note">We're still checking {found.tutorName}'s tutor account. They'll see {childName}'s progress once that's done, usually the same day.</div>
        )}
        <div className="set-sheet-sub">We'll email you to confirm. You can disconnect at any time in Settings → Tutors.</div>
        {pin && (
          <input
            className="set-name-input tutor-code-input"
            inputMode="numeric" maxLength={4} value={pinInput}
            onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4)); setPinError(""); }}
            placeholder="Grown-up PIN" aria-label="Grown-up PIN"
          />
        )}
        {(pinError || error) && <div className="board-msg err" role="alert">{pinError || error}</div>}
        <button className="set-sheet-confirm" onClick={confirm} disabled={busy || (pin && pinInput.length !== 4)}>{busy ? "Connecting…" : "Connect"}</button>
        <button className="set-sheet-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}
