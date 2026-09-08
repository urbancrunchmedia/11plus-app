import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getProfile, getLeaderboard, addFriendByCode, removeFriend, syncProfile } from "../utils/cloudScores";
import Icon from "./Icon";

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
  const [showAdd, setShowAdd] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [code, setCode]       = useState("");
  const [adding, setAdding]   = useState(false);
  const [msg, setMsg]         = useState(null);
  const [copied, setCopied]   = useState(false);
  const [nameSheet, setNameSheet]     = useState(false);
  const [nameInput, setNameInput]     = useState("");
  const autoOpened                    = useRef(false);

  const myName = me?.displayName || user?.displayName || "Player";
  const codeChars = code.replace(/[^A-Z0-9]/g, "").length; // a full code is 7, e.g. WM-7H2K9

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

  // With nobody to compare against, adding someone IS the page. Open the panel
  // once so the code and the input are right there — they can close it again.
  useEffect(() => {
    if (loading || autoOpened.current) return;
    autoOpened.current = true;
    if (people.length <= 1) setShowAdd(true);
  }, [loading, people.length]);

  const rows = [...people].sort((a, b) => (b.points || 0) - (a.points || 0));
  const myIdx = rows.findIndex((p) => p.isMe);
  const gapLine =
    myIdx <= 0
      ? "You're top of the board — hold it!"
      : `${((rows[myIdx - 1].points || 0) - (rows[myIdx].points || 0)).toLocaleString()} points behind ${rows[myIdx - 1].displayName || "them"}`;

  async function handleAdd(e) {
    e.preventDefault();
    if (!user || adding) return;
    setMsg(null); setAdding(true);
    const res = await addFriendByCode(user.uid, code);
    setAdding(false);
    if (res.ok) { setMsg({ type: "ok", text: `Added ${res.friend.displayName}!` }); setCode(""); load(); }
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
    setNameSheet(false);
    await updateDisplayName(n);
    setMsg({ type: "ok", text: `Name changed to ${n}` });
    load();
  }

  async function copyCode() {
    if (!me?.code) return;
    try {
      await navigator.clipboard.writeText(me.code);
      setCopied(true);
      setMsg({ type: "ok", text: "Code copied — send it to your friend" });
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
            <div className="board-sub">Friends · compete with your friends</div>
          </div>
        </div>
      </div>

      <div className="board-list">
        <div className="board-listtop">
          <button className={`board-listcta ${showAdd ? "open" : ""}`} onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "Done" : "+ Add friend"}
          </button>
        </div>

        {showAdd && (
          <div className="board-addpanel">
            <div className="board-addrow">
              <span className="board-code-lbl">Your code</span>
              <span className="board-codewrap">
                <span className="board-code">{me?.code || "…"}</span>
                <button className={`board-iconbtn ${copied ? "copied" : ""}`} onClick={copyCode} disabled={!me?.code} aria-label={copied ? "Code copied" : "Copy your code"} title={copied ? "Copied!" : "Copy code"}>
                  <Icon name={copied ? "check" : "copy"} size={16} stroke="currentColor" strokeWidth={2} />
                </button>
              </span>
            </div>
            <form className="board-addrow" onSubmit={handleAdd}>
              <input
                className="board-input"
                placeholder="Friend code e.g. WM-7H2K9"
                value={code}
                onChange={(e) => setCode(formatCode(e.target.value))}
                inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
              />
              <button className="board-go" type="submit" disabled={adding || codeChars < 7}>{adding ? "…" : "Add"}</button>
            </form>
            {msg && <div className={msg.type === "ok" ? "board-msg ok" : "board-msg err"}>{msg.text}</div>}
            <button className="board-editname" onClick={() => { setNameInput(myName); setNameSheet(true); }}>
              Playing as <b>{myName}</b> — edit
            </button>
            {rows.length > 1 && (
              <div className="board-hint">While this is open you can remove anyone from your board.</div>
            )}
          </div>
        )}

        {loading ? (
          <div className="board-loading">Loading leaderboard…</div>
        ) : (
          <div className="board-rows">
          {rows.map((p, i) => (
            <div key={p.uid} className={`board-row ${p.isMe ? "me" : ""} ${i === 0 ? "board-row--first" : ""}`}>
              <span className="board-rank">{i + 1}</span>
              <span className={`board-avatar ${p.isMe ? "me" : ""}`}>{initials(p.displayName)}</span>
              <span className="board-name">
                {p.displayName || "Player"}{p.isMe && <span className="board-you"> (you)</span>}
              </span>
              <span className="board-pts">{(p.points || 0).toLocaleString()}</span>
              {!p.isMe && showAdd && (
                <button className="board-remove" onClick={() => setRemoveTarget(p)} aria-label={`Remove ${p.displayName || "friend"}`} title={`Remove ${p.displayName || "friend"}`}>
                  <Icon name="trash" size={16} stroke="currentColor" strokeWidth={2} />
                </button>
              )}
            </div>
          ))}
          </div>
        )}

        {!loading && rows.length <= 1 && (
          <div className="board-nofriends">
            It's just you so far — add a friend's code to see who's ahead each week.
          </div>
        )}

      </div>

      {!loading && rows.length > 1 && (
        <div className="board-foot">
          <div>
            <div className="board-foot-title">{gapLine}</div>
            <div className="board-foot-sub">Every round you play counts towards this week</div>
          </div>
          {onPlay && <button className="board-foot-cta" onClick={onPlay}>Play a round</button>}
        </div>
      )}

      {nameSheet && (
        <div className="set-sheet-overlay" onClick={() => setNameSheet(false)}>
          <div className="set-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="set-sheet-title">Learner's name</div>
            <div className="set-sheet-sub">This shows on the leaderboard and at the end of every round.</div>
            <input
              className="set-name-input"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Amu"
              maxLength={20}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
            />
            <button className="set-sheet-confirm" onClick={saveName} disabled={!nameInput.trim()}>Save name</button>
            <button className="set-sheet-cancel" onClick={() => setNameSheet(false)}>Cancel</button>
          </div>
        </div>
      )}

      {removeTarget && (
        <div className="set-sheet-overlay" onClick={() => setRemoveTarget(null)}>
          <div className="set-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="set-sheet-title">Remove {removeTarget.displayName || "this friend"}?</div>
            <div className="set-sheet-sub">They'll disappear from your leaderboard. You can add them back later with their code.</div>
            <button className="set-sheet-confirm" onClick={confirmRemove}>Remove friend</button>
            <button className="set-sheet-cancel" onClick={() => setRemoveTarget(null)}>Keep them</button>
          </div>
        </div>
      )}
    </div>
  );
}
