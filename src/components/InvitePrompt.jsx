import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { addFriendByCode } from "../utils/cloudScores";
import { getSetting } from "../utils/leaderboard";
import { getPendingInvite, clearPendingInvite, lookupInvite } from "../utils/invite";

// Shown once a signed-in player has a pending invite link. Nobody becomes
// friends without tapping "Add friend" here, and nothing happens at all if a
// grown-up has switched friends off in Settings.
export default function InvitePrompt({ onOpenBoard }) {
  const { user } = useAuth();
  const [invite, setInvite] = useState(null); // { code, displayName }
  const [state, setState] = useState("idle"); // idle | ask | blocked | adding | added | error
  const [error, setError] = useState("");

  useEffect(() => {
    const code = getPendingInvite();
    if (!code || !user?.uid) return;
    let live = true;
    lookupInvite(code)
      .then((found) => {
        if (!live) return;
        // Unknown code or your own link: nothing to ask.
        if (!found || found.uid === user.uid) { clearPendingInvite(); return; }
        setInvite({ code, displayName: found.displayName });
        setState(getSetting("allowFriends", true) ? "ask" : "blocked");
      })
      .catch(() => { /* offline: try again next time the app opens */ });
    return () => { live = false; };
  }, [user?.uid]);

  if (!invite || state === "idle") return null;

  const close = () => { clearPendingInvite(); setInvite(null); setState("idle"); };

  async function accept() {
    setState("adding");
    const res = await addFriendByCode(user.uid, invite.code);
    if (res.ok) { clearPendingInvite(); setState("added"); }
    else { setError(res.error); setState("error"); }
  }

  const name = invite.displayName;
  return (
    <div className="set-sheet-overlay" onClick={state === "adding" ? undefined : close}>
      <div className="set-sheet board-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="invite-title">
        {state === "blocked" ? (
          <>
            <div className="set-sheet-title" id="invite-title">{name} invited you</div>
            <div className="set-sheet-sub">Friends are switched off in grown-up settings on this device, so this invite can't be added.</div>
            <button className="set-sheet-confirm" onClick={close}>OK</button>
          </>
        ) : state === "added" ? (
          <>
            <div className="set-sheet-title" id="invite-title">You're friends with {name}! 🎉</div>
            <div className="set-sheet-sub">You'll both see each other on the leaderboard. Every round you play this week counts.</div>
            <button className="set-sheet-confirm" onClick={() => { close(); onOpenBoard?.(); }}>See the leaderboard</button>
            <button className="set-sheet-cancel" onClick={close}>Later</button>
          </>
        ) : (
          <>
            <div className="set-sheet-title" id="invite-title">{name} invited you!</div>
            <div className="set-sheet-sub">Add {name} as a friend to see each other on the weekly leaderboard.</div>
            {state === "error" && <div className="board-msg err">{error}</div>}
            <button className="set-sheet-confirm" onClick={accept} disabled={state === "adding"}>
              {state === "adding" ? "Adding…" : `Add ${name} as a friend`}
            </button>
            <button className="set-sheet-cancel" onClick={close} disabled={state === "adding"}>Not now</button>
          </>
        )}
      </div>
    </div>
  );
}
