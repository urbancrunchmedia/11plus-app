import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTutor } from "../contexts/TutorContext";
import { getMyTutors, disconnectTutor, tutorApi, MAX_TUTORS } from "../utils/tutor";

// Settings → Tutors (grown-up area). A parent connects their child to a tutor
// by entering the tutor's join code, sees exactly what will be shared before
// confirming, and can disconnect at any time. Tutor accounts see a link to
// their dashboard instead.
export default function TutorsCard({ childName, onToast }) {
  const { user } = useAuth();
  const { tutor, isActiveTutor } = useTutor();
  const [links, setLinks] = useState(null); // null = loading, "error" = couldn't load
  const [sheet, setSheet] = useState(null); // null | "code" | "confirm" | { disconnect: link }
  const [code, setCode] = useState("");
  const [found, setFound] = useState(null); // { tutorName, business }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { setLinks(await getMyTutors(user.uid)); } catch { setLinks("error"); }
  }, [user.uid]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading this account's tutor links from Firestore.
    if (!tutor) load();
  }, [tutor, load]);

  if (tutor) {
    return (
      <div className="set-card">
        <div className="set-card-title">Tutor account</div>
        <div className="set-row">
          <div className="set-row-txt">
            <div className="set-row-label">{isActiveTutor ? "Your tutor dashboard" : "Your tutor application"}</div>
            <div className="set-row-sub">{isActiveTutor ? "Your pupils' progress, practice time and tricky words" : "See where your application is up to"}</div>
          </div>
          <button className="set-ghost" onClick={() => window.location.assign("/tutor")}>Open</button>
        </div>
      </div>
    );
  }

  const close = () => { if (!busy) { setSheet(null); setError(""); } };
  const openConnect = () => { setCode(""); setFound(null); setError(""); setSheet("code"); };

  async function lookUp() {
    setBusy(true); setError("");
    try {
      setFound(await tutorApi("lookup", { code }));
      setSheet("confirm");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function connect() {
    setBusy(true); setError("");
    try {
      const res = await tutorApi("connect", { code });
      await load();
      setSheet(null);
      onToast?.(res.already ? `Already connected to ${res.tutorName}` : `Connected to ${res.tutorName}`);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function disconnect(link) {
    setBusy(true); setError("");
    try {
      await disconnectTutor(link.tutorUid, user.uid);
      await load();
      setSheet(null);
      onToast?.(`Disconnected from ${link.tutorName}`);
    } catch { setError("Couldn't disconnect. Please try again."); }
    finally { setBusy(false); }
  }

  const full = Array.isArray(links) && links.length >= MAX_TUTORS;
  const who = (l) => (l.business ? `${l.tutorName} · ${l.business}` : l.tutorName);

  return (
    <div className="set-card" data-testid="tutors-card">
      <div className="set-card-title">Tutors</div>
      {links === null ? (
        <div className="set-row"><div className="set-row-sub">Loading…</div></div>
      ) : links === "error" ? (
        <div className="set-row">
          <div className="set-row-txt"><div className="set-row-sub">Couldn't load your tutors. Check your connection.</div></div>
          <button className="set-ghost" onClick={() => { setLinks(null); load(); }}>Try again</button>
        </div>
      ) : (
        <>
          {links.map((l) => (
            <React.Fragment key={l.id}>
              <div className="set-row">
                <div className="set-row-txt">
                  <div className="set-row-label">{who(l)}</div>
                  <div className="set-row-sub">Can see {childName}'s progress · connected {new Date(l.createdAt).toLocaleDateString("en-GB")}</div>
                </div>
                <button className="set-ghost set-danger-text" onClick={() => { setError(""); setSheet({ disconnect: l }); }}>Disconnect</button>
              </div>
              <div className="set-divider" />
            </React.Fragment>
          ))}
          <div className="set-row">
            <div className="set-row-txt">
              <div className="set-row-label">Connect a tutor</div>
              <div className="set-row-sub">
                {full ? `You can connect up to ${MAX_TUTORS} tutors. Disconnect one to add another.` : "Let your child's tutor follow their practice, using the tutor's join code"}
              </div>
            </div>
            <button className="set-ghost" onClick={openConnect} disabled={full}>Connect</button>
          </div>
        </>
      )}

      {sheet === "code" && (
        <div className="set-sheet-overlay" onClick={close}>
          <div className="set-sheet" role="dialog" aria-modal="true" aria-labelledby="tutor-code-title" onClick={(e) => e.stopPropagation()}>
            <div className="set-sheet-title" id="tutor-code-title">Connect a tutor</div>
            <div className="set-sheet-sub">Enter the join code your child's tutor gave you. It starts with TUT.</div>
            <input
              className="set-name-input tutor-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 14))}
              placeholder="TUT-XXXXXXXX"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-label="Tutor's join code"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && code.trim().length >= 8) lookUp(); }}
            />
            {error && <div className="board-msg err" role="alert">{error}</div>}
            <button className="set-sheet-confirm" onClick={lookUp} disabled={busy || code.replace(/[^A-Z0-9]/g, "").length < 8}>
              {busy ? "Checking…" : "Next"}
            </button>
            <button className="set-sheet-cancel" onClick={close}>Cancel</button>
          </div>
        </div>
      )}

      {sheet === "confirm" && found && (
        <div className="set-sheet-overlay" onClick={close}>
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
            <div className="set-sheet-sub">We'll email you to confirm. You can disconnect at any time here in Settings.</div>
            {error && <div className="board-msg err" role="alert">{error}</div>}
            <button className="set-sheet-confirm" onClick={connect} disabled={busy}>{busy ? "Connecting…" : "Connect"}</button>
            <button className="set-sheet-cancel" onClick={close}>Cancel</button>
          </div>
        </div>
      )}

      {sheet?.disconnect && (
        <div className="set-sheet-overlay" onClick={close}>
          <div className="set-sheet" role="dialog" aria-modal="true" aria-labelledby="tutor-off-title" onClick={(e) => e.stopPropagation()}>
            <div className="set-sheet-title" id="tutor-off-title">Disconnect {sheet.disconnect.tutorName}?</div>
            <div className="set-sheet-sub">They'll stop seeing {childName}'s progress straight away. You can reconnect later with their code.</div>
            {error && <div className="board-msg err" role="alert">{error}</div>}
            <button className="set-sheet-confirm board-danger" onClick={() => disconnect(sheet.disconnect)} disabled={busy}>
              {busy ? "Disconnecting…" : "Disconnect"}
            </button>
            <button className="set-sheet-cancel" onClick={close}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
