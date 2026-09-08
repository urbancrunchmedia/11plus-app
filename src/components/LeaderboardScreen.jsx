import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getProfile, getLeaderboard, addFriendByCode, removeFriend, syncProfile } from "../utils/cloudScores";
import Icon from "./Icon";
import { msUntilReset, formatResetIn } from "../utils/weekly";

function initials(name) {
  return (name || "?").trim().slice(0, 1).toUpperCase();
}

// Codes look like "WM-7H2K9". Auto-insert the hyphen after the 2-letter prefix
// so users never type it themselves.
function formatCode(raw) {
  const s = (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  return s.length > 2 ? `${s.slice(0, 2)}-${s.slice(2)}` : s;
}

export default function LeaderboardScreen({ onPlay }) {
  const { user, updateDisplayName } = useAuth();
  const [me, setMe]           = useState(null);
  const [people, setPeople]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [managing, setManaging]       = useState(false);
  const [addSheet, setAddSheet]       = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [code, setCode]       = useState("");
  const [adding, setAdding]   = useState(false);
  const [msg, setMsg]         = useState(null);
  const [copied, setCopied]   = useState(false);
  const [nameSheet, setNameSheet]     = useState(false);
  const [nameInput, setNameInput]     = useState("");
  const [nameError, setNameError]     = useState("");
  const [toast, setToast]             = useState(null);
  const toastTimer                    = useRef(null);

  const myName = me?.displayName || user?.displayName || "Player";
  const codeChars = code.replace(/[^A-Z0-9]/g, "").length; // a full code is 7, e.g. WM-7H2K9
  const [resetsIn] = useState(() => formatResetIn(msUntilReset()));

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    await syncProfile(user);
    const [profile, board] = await Promise.all([getProfile(user.uid), getLeaderboard(user.uid)]);
    setMe(profile);
    setPeople(board);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Successes announce themselves and get out of the way; errors stay put next
  // to the field you have to fix.
  const showToast = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const rows = [...people].sort((a, b) => (b.weekPoints || 0) - (a.weekPoints || 0) || (b.points || 0) - (a.points || 0));
  const myIdx = rows.findIndex((p) => p.isMe);
  const gapLine =
    myIdx <= 0
      ? "You're top of the board — hold it!"
      : `${((rows[myIdx - 1].weekPoints || 0) - (rows[myIdx].weekPoints || 0)).toLocaleString()} points behind ${rows[myIdx - 1].displayName || "them"}`;

  async function handleAdd(e) {
    e.preventDefault();
    if (!user || adding) return;
    setMsg(null); setAdding(true);
    const res = await addFriendByCode(user.uid, code);
    setAdding(false);
    if (res.ok) { showToast(`Added ${res.friend.displayName}`); setCode(""); setAddSheet(false); load(); }
    else setMsg({ type: "err", text: res.error });
  }

  async function confirmRemove() {
    if (!user || !removeTarget) return;
    const t = removeTarget;
    setRemoveTarget(null);
    await removeFriend(user.uid, t.uid);
    load();
  }

  async function saveName() {
    const n = nameInput.trim();
    if (!n) return;
    setNameError("");
    try {
      await updateDisplayName(n);
    } catch (e) {
      setNameError(e.message || "Please choose a different name.");
      return; // keep the sheet open so they can fix it
    }
    setNameSheet(false);
    showToast(`Name changed to ${n}`);
    load();
  }

  async function copyCode() {
    if (!me?.code) return;
    try {
      await navigator.clipboard.writeText(me.code);
      setCopied(true);
      showToast("Code copied — send it to your friend");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // No clipboard (older browser, or not on https) — show the code to type out.
      setMsg({ type: "err", text: `Couldn't copy automatically — your code is ${me.code}` });
    }
  }

  return (
    <div className="board">
      <div className="board-head">
        <div className="board-head-left">
          <div className="board-icon"><Icon name="trophy" size={22} stroke="currentColor" strokeWidth={2} /></div>
          <div>
            <h1 className="board-title">Leaderboard</h1>
            <div className="board-sub">Friends · resets in {resetsIn}</div>
          </div>
        </div>
        <div className="board-head-actions">
          {!loading && rows.length > 1 && (
            <button className={`board-manage ${managing ? "on" : ""}`} onClick={() => setManaging((v) => !v)}>
              {managing ? "Done" : "Manage"}
            </button>
          )}
          <button className="board-addbtn" onClick={() => { setMsg(null); setAddSheet(true); }}>+ Add friend</button>
        </div>
      </div>

      {loading ? (
        <div className="board-empty">Loading leaderboard…</div>
      ) : (
        <div className="board-rows">
          {rows.map((p, i) => (
            <div key={p.uid} className={`board-row ${p.isMe ? "me" : ""}`}>
              <span className={`board-rank ${i < 3 ? `board-rank--${i + 1}` : ""}`}>{i + 1}</span>
              <span className={`board-avatar ${p.isMe ? "me" : ""}`}>{initials(p.displayName)}</span>
              <span className="board-name">
                {p.displayName || "Player"}{p.isMe && <span className="board-you"> (you)</span>}
              </span>
              {p.isMe && (
                <button className="board-rename" onClick={() => { setNameInput(myName); setNameError(""); setNameSheet(true); }}>Rename</button>
              )}
              <span className="board-pts">{(p.weekPoints || 0).toLocaleString()}</span>
              {!p.isMe && managing && (
                <button className="board-remove" onClick={() => setRemoveTarget(p)} aria-label={`Remove ${p.displayName || "friend"}`} title={`Remove ${p.displayName || "friend"}`}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && rows.length <= 1 && (
        <div className="board-empty">
          <div className="board-empty-title">No friends yet</div>
          <div className="board-empty-sub">Swap codes with a friend to see each other on the leaderboard.</div>
        </div>
      )}

      {!loading && rows.length > 1 && (
        <div className="board-foot">
          <div>
            <div className="board-foot-title">{gapLine}</div>
            <div className="board-foot-sub">Every round you play counts towards this week</div>
          </div>
          {onPlay && <button className="board-foot-cta" onClick={onPlay}>Play a round</button>}
        </div>
      )}

      {addSheet && (
        <div className="set-sheet-overlay" onClick={() => setAddSheet(false)}>
          <div className="set-sheet board-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="set-sheet-title">Add a friend</div>
            <div className="set-sheet-sub">Swap codes with a friend to see each other on the leaderboard.</div>

            <div className="board-fieldlbl">Your code</div>
            <div className="board-codebox">
              <span className="board-codeval">{me?.code || "…"}</span>
              <button className={`board-copybtn ${copied ? "copied" : ""}`} onClick={copyCode} disabled={!me?.code} aria-label={copied ? "Code copied" : "Copy your code"} title={copied ? "Copied!" : "Copy code"}>
                <Icon name={copied ? "check" : "copy"} size={18} stroke="currentColor" strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleAdd}>
              <div className="board-fieldlbl">Friend's code</div>
              <input
                className="board-sheet-input board-sheet-input--code"
                placeholder="e.g. WM-7H2K9"
                value={code}
                onChange={(e) => setCode(formatCode(e.target.value))}
                inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                autoFocus
              />
              {msg?.type === "err" && <div className="board-msg err">{msg.text}</div>}
              <button className="set-sheet-confirm" type="submit" disabled={adding || codeChars < 7}>
                {adding ? "Adding…" : "Add friend"}
              </button>
            </form>
            <button className="set-sheet-cancel" onClick={() => setAddSheet(false)}>Close</button>
          </div>
        </div>
      )}

      {toast && <div className="set-toast">{toast}</div>}

      {nameSheet && (
        <div className="set-sheet-overlay" onClick={() => setNameSheet(false)}>
          <div className="set-sheet board-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="set-sheet-title">Change name</div>
            <div className="set-sheet-sub">This is the name friends see on the leaderboard and at the end of a round.</div>
            <input
              className="board-sheet-input"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Amu"
              maxLength={20}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
            />
            {nameError && <div className="board-msg err">{nameError}</div>}
            <button className="set-sheet-confirm" onClick={saveName} disabled={!nameInput.trim()}>Save name</button>
            <button className="set-sheet-cancel" onClick={() => setNameSheet(false)}>Cancel</button>
          </div>
        </div>
      )}

      {removeTarget && (
        <div className="set-sheet-overlay" onClick={() => setRemoveTarget(null)}>
          <div className="set-sheet board-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="set-sheet-title">Remove {removeTarget.displayName || "this friend"}?</div>
            <div className="set-sheet-sub">They'll disappear from your leaderboard. You can add them back later with their code.</div>
            <button className="set-sheet-confirm board-danger" onClick={confirmRemove}>Remove friend</button>
            <button className="set-sheet-cancel" onClick={() => setRemoveTarget(null)}>Keep them</button>
          </div>
        </div>
      )}
    </div>
  );
}
