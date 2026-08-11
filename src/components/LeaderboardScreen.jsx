import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getProfile, getLeaderboard, addFriendByCode, removeFriend, syncProfile } from "../utils/cloudScores";

const MEDALS = ["🥇", "🥈", "🥉"];

function initials(name) {
  return (name || "?").trim().slice(0, 1).toUpperCase();
}

export default function LeaderboardScreen({ onPlay }) {
  const { user, updateDisplayName } = useAuth();
  const [me, setMe]           = useState(null);
  const [people, setPeople]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [managing, setManaging]     = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [code, setCode]       = useState("");
  const [adding, setAdding]   = useState(false);
  const [msg, setMsg]         = useState(null);
  const [copied, setCopied]   = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput]     = useState("");

  const myName = me?.displayName || user?.displayName || "Player";

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

  const rows = [...people].sort((a, b) => (b.points || 0) - (a.points || 0));
  const myIdx = rows.findIndex((p) => p.isMe);
  const gapLine =
    myIdx <= 0
      ? "You're top of the board — hold it! 🏆"
      : `${((rows[myIdx - 1].points || 0) - (rows[myIdx].points || 0)).toLocaleString()} points behind ${rows[myIdx - 1].displayName || "them"}`;

  async function handleAdd(e) {
    e.preventDefault();
    if (!user || adding) return;
    setMsg(null); setAdding(true);
    const res = await addFriendByCode(user.uid, code);
    setAdding(false);
    if (res.ok) { setMsg({ type: "ok", text: `Added ${res.friend.displayName}! 🎉` }); setCode(""); load(); }
    else setMsg({ type: "err", text: res.error });
  }

  async function confirmRemove() {
    if (!user || !removeTarget) return;
    const t = removeTarget;
    setRemoveTarget(null);
    await removeFriend(user.uid, t.uid);
    load();
  }

  async function saveName(e) {
    e.preventDefault();
    const n = nameInput.trim();
    if (!n) return;
    setEditingName(false);
    await updateDisplayName(n);
    load();
  }

  function copyCode() {
    if (!me?.code || !navigator.clipboard) return;
    navigator.clipboard.writeText(me.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  return (
    <div className="board">
      <div className="board-head">
        <div className="board-head-left">
          <div className="board-icon">🏆</div>
          <div>
            <h1 className="board-title">Leaderboard</h1>
            <div className="board-sub">Friends · compete with your friends</div>
          </div>
        </div>
        <button className="board-add" onClick={() => setShowAdd((s) => !s)}>+ Add friend</button>
      </div>

      {showAdd && (
        <div className="board-addpanel">
          <div className="board-addrow">
            <span className="board-code-lbl">Your code</span>
            <span className="board-code">{me?.code || "…"}</span>
            <button className="board-mini-btn" onClick={copyCode} disabled={!me?.code}>{copied ? "Copied!" : "Copy"}</button>
          </div>
          <form className="board-addrow" onSubmit={handleAdd}>
            <input
              className="board-input"
              placeholder="Friend code e.g. WM-7H2K9"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoCapitalize="characters" autoCorrect="off" spellCheck={false}
            />
            <button className="board-mini-btn board-mini-btn--go" type="submit" disabled={adding}>{adding ? "…" : "Add"}</button>
          </form>
          {msg && <div className={msg.type === "ok" ? "board-msg ok" : "board-msg err"}>{msg.text}</div>}
          {!editingName ? (
            <button className="board-editname" onClick={() => { setNameInput(myName); setEditingName(true); }}>
              Playing as <b>{myName}</b> — edit
            </button>
          ) : (
            <form className="board-addrow" onSubmit={saveName}>
              <input className="board-input" value={nameInput} onChange={(e) => setNameInput(e.target.value)} maxLength={20} placeholder="Child's name" autoFocus />
              <button className="board-mini-btn board-mini-btn--go" type="submit">Save</button>
            </form>
          )}
        </div>
      )}

      {!loading && rows.length > 1 && (
        <div className="board-managebar">
          <button className="board-manage" onClick={() => setManaging((m) => !m)}>
            {managing ? "Done" : "Manage friends"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="board-empty">Loading leaderboard…</div>
      ) : (
        <div className="board-rows">
          {rows.map((p, i) => (
            <div key={p.uid} className={`board-row ${p.isMe ? "me" : ""}`}>
              <span className="board-rank">{MEDALS[i] || i + 1}</span>
              <span className={`board-avatar ${p.isMe ? "me" : ""}`}>{initials(p.displayName)}</span>
              <span className="board-name">
                {p.displayName || "Player"}{p.isMe && <span className="board-you"> (you)</span>}
              </span>
              {!(managing && !p.isMe) && <span className="board-pts">{(p.points || 0).toLocaleString()}</span>}
              {!p.isMe && managing && (
                <button className="board-remove" onClick={() => setRemoveTarget(p)} aria-label={`Remove ${p.displayName || "friend"}`}>Remove</button>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && rows.length <= 1 && (
        <div className="board-empty">
          <div className="board-empty-title">No friends yet</div>
          <div className="board-empty-sub">Add a friend with their code to start comparing scores.</div>
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
