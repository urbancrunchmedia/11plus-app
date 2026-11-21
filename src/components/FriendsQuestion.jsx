import React from "react";
import { saveFriendsChoice } from "../utils/leaderboard";

// Asked once, after sign-up, for new accounts: friends start switched off
// (Children's Code: high-privacy defaults) until a grown-up says yes.
export default function FriendsQuestion({ name, invited, onDone }) {
  const choose = (allow) => { saveFriendsChoice(allow); onDone(allow); };
  const who = name && name !== "Player" ? name : "your child";
  return (
    <div className="set-sheet-overlay">
      <div className="set-sheet" role="dialog" aria-modal="true" aria-labelledby="friends-q-title" data-testid="friends-question">
        <div className="pw-badge">FOR GROWN-UPS</div>
        <div className="set-sheet-title" id="friends-q-title">Can {who} add friends?</div>
        <div className="set-sheet-sub">
          {invited && <><strong>A friend has sent {who} an invite.</strong> </>}
          Friends see each other's first name and weekly points on a leaderboard. There's no chat or messaging,
          and every friend request has to be accepted. You can change this any time in Settings → Allow friends.
        </div>
        <button className="set-sheet-confirm" onClick={() => choose(true)}>Yes, allow friends</button>
        <button className="set-sheet-cancel" onClick={() => choose(false)}>Not now</button>
      </div>
    </div>
  );
}
