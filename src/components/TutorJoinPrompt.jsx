import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTutor } from "../contexts/TutorContext";
import { tutorApi } from "../utils/tutor";
import { getPendingTutorJoin, clearPendingTutorJoin } from "../utils/tutorJoin";
import TutorConnectSheet from "./TutorConnectSheet";

// After someone opens a tutor's /join/<code> link and signs in: offer to
// connect this child to that tutor (the same confirmation as in Settings).
export default function TutorJoinPrompt({ onOpenSettings }) {
  const { user } = useAuth();
  const { isTutor, loading: tutorLoading } = useTutor();
  const [code, setCode] = useState(null);
  const [found, setFound] = useState(null);
  const [state, setState] = useState("idle"); // idle | ask | busy | done | error
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    const pending = getPendingTutorJoin();
    if (!pending || !user?.uid || tutorLoading) return;
    // Tutor accounts can't be connected to a tutor: drop the link quietly.
    if (isTutor) { clearPendingTutorJoin(); return; }
    let live = true;
    tutorApi("lookup", { code: pending })
      .then((t) => { if (live) { setCode(pending); setFound(t); setState("ask"); } })
      .catch((e) => { if (live) { setCode(pending); setError(e.message); setState("error"); } });
    return () => { live = false; };
  }, [user?.uid, isTutor, tutorLoading]);

  if (state === "idle") return null;
  const close = () => { clearPendingTutorJoin(); setState("idle"); };
  const childName = user?.displayName || "your child";

  async function connect() {
    setState("busy"); setError("");
    try {
      setResult(await tutorApi("connect", { code, via: "link" }));
      clearPendingTutorJoin();
      setState("done");
    } catch (e) { setError(e.message); setState("ask"); }
  }

  if (state === "ask" || state === "busy") {
    return <TutorConnectSheet childName={childName} found={found} busy={state === "busy"} error={error} onConfirm={connect} onCancel={close} />;
  }
  return (
    <div className="set-sheet-overlay" onClick={close}>
      <div className="set-sheet" role="dialog" aria-modal="true" aria-labelledby="tutor-join-title" onClick={(e) => e.stopPropagation()}>
        {state === "done" ? (
          <>
            <div className="set-sheet-title" id="tutor-join-title">{result?.already ? `Already connected to ${result.tutorName}` : `Connected to ${result?.tutorName} 🎉`}</div>
            <div className="set-sheet-sub">
              {result?.pending
                ? `${result.tutorName} will see ${childName}'s progress once we've checked their tutor account. You can disconnect any time in Settings → Tutors.`
                : `${result?.tutorName} can now follow ${childName}'s practice. You can disconnect any time in Settings → Tutors.`}
            </div>
            <button className="set-sheet-confirm" onClick={close}>Start practising</button>
            <button className="set-sheet-cancel" onClick={() => { close(); onOpenSettings?.(); }}>See Settings → Tutors</button>
          </>
        ) : (
          <>
            <div className="set-sheet-title" id="tutor-join-title">Couldn't connect</div>
            <div className="set-sheet-sub">{error} You can enter a tutor's code any time in Settings → Tutors.</div>
            <button className="set-sheet-confirm" onClick={close}>OK</button>
          </>
        )}
      </div>
    </div>
  );
}
