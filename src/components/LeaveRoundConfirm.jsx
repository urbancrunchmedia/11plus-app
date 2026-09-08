import React from "react";

// Shown when a child taps ← mid-round with answers already given: leaving
// throws that round away, so it's worth one tap of friction.
export default function LeaveRoundConfirm({ onLeave, onStay }) {
  return (
    <div className="set-sheet-overlay" onClick={onStay}>
      <div className="set-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="set-sheet-title">Leave this round?</div>
        <div className="set-sheet-sub">
          You're partway through. If you leave now, this round won't be saved and you'll start a fresh one next time.
        </div>
        <button className="set-sheet-confirm" onClick={onLeave}>Leave round</button>
        <button className="set-sheet-cancel" onClick={onStay}>Keep playing</button>
      </div>
    </div>
  );
}
