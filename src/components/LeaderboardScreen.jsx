import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getProfile, getLeaderboard, addFriendByCode, removeFriend, syncProfile } from "../utils/cloudScores";

const MEDALS = ["🥇", "🥈", "🥉"];

const CATEGORIES = [
  { id: "all",          label: "Overall" },
  { id: "wordMatch",    label: "Word Match" },
  { id: "fillInBlanks", label: "Word Detective" },
  { id: "punctuation",  label: "Punctuation" },
];

function metricOf(p, cat) {
  if (cat === "all") return p.points || 0;
  return (p.byGame && p.byGame[cat]) || 0;
}

function initials(name) {
  return (name || "?").trim().slice(0, 1).toUpperCase();
}

export default function LeaderboardScreen() {
  const { user, updateDisplayName } = useAuth();
  const [me, setMe]           = useState(null);
  const [people, setPeople]   = useState([]);   // unsorted profiles (me + friends)
  const [loading, setLoading] = useState(true);
  const [cat, setCat]         = useState("all");
  const [code, setCode]       = useState("");
  const [adding, setAdding]   = useState(false);
  const [msg, setMsg]         = useState(null);
  const [copied, setCopied]   = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput]     = useState("");

  const myName = me?.displayName || user?.displayName || "Player";

  async function saveName(e) {
    e.preventDefault();
    const n = nameInput.trim();
    if (!n) return;
    setEditingName(false);
    await updateDisplayName(n);
    load();
  }

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    await syncProfile(user);
    const [profile, board] = await Promise.all([
      getProfile(user.uid),
      getLeaderboard(user.uid),
    ]);
    setMe(profile);
    setPeople(board);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const rows = [...people].sort((a, b) => metricOf(b, cat) - metricOf(a, cat));

  async function handleAdd(e) {
    e.preventDefault();
    if (!user || adding) return;
    setMsg(null);
    setAdding(true);
    const res = await addFriendByCode(user.uid, code);
    setAdding(false);
    if (res.ok) {
      setMsg({ type: "ok", text: `Added ${res.friend.displayName}! 🎉` });
      setCode("");
      load();
    } else {
      setMsg({ type: "err", text: res.error });
    }
  }

  async function handleRemove(friend) {
    if (!user) return;
    if (!window.confirm(`Remove ${friend.displayName || "this friend"} from your leaderboard?`)) return;
    await removeFriend(user.uid, friend.uid);
    load();
  }

  function copyCode() {
    if (!me?.code || !navigator.clipboard) return;
    navigator.clipboard.writeText(me.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="home-screen">
      <div className="home-card">

        <div className="home-title">
          <span className="home-emoji">🏆</span>
          <h1>Leaderboard</h1>
          <p className="home-subtitle">Add friends and race to the top!</p>
        </div>

        {/* Display name (the child name shown to friends) */}
        <div className="lb-name-card">
          {!editingName ? (
            <>
              <div className="lb-name-info">
                <span className="lb-code-label">Playing as</span>
                <span className="lb-name-value">{myName}</span>
              </div>
              <button
                className="lb-copy-btn"
                onClick={() => { setNameInput(myName); setEditingName(true); }}
              >
                Edit name
              </button>
            </>
          ) : (
            <form className="lb-name-edit" onSubmit={saveName}>
              <input
                className="wl-search"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Child's name"
                maxLength={20}
                autoFocus
              />
              <button className="play-btn lb-name-save" type="submit">Save</button>
              <button className="secondary-btn lb-name-cancel" type="button" onClick={() => setEditingName(false)}>Cancel</button>
            </form>
          )}
        </div>

        {/* My friend code */}
        <div className="lb-code-card">
          <span className="lb-code-label">Your friend code</span>
          <div className="lb-code-row">
            <span className="lb-code">{me?.code || "…"}</span>
            <button className="lb-copy-btn" onClick={copyCode} disabled={!me?.code}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <span className="lb-code-hint">Share this with a friend so they can add you.</span>
        </div>

        {/* Add a friend */}
        <form className="lb-add-form" onSubmit={handleAdd}>
          <div className="section-label">Add a friend by code</div>
          <div className="lb-add-row">
            <input
              className="wl-search lb-add-input"
              placeholder="e.g. WM-7H2K9"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <button className="play-btn lb-add-btn" type="submit" disabled={adding}>
              {adding ? "Adding…" : "Add"}
            </button>
          </div>
          {msg && (
            <div className={msg.type === "ok" ? "lb-msg lb-msg--ok" : "lb-msg lb-msg--err"}>
              {msg.text}
            </div>
          )}
        </form>

        {/* Category filter + refresh */}
        <div className="lb-board-head">
          <div className="wl-filter-row lb-cat-row">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={`wl-filter-btn ${cat === c.id ? "active" : ""}`}
                onClick={() => setCat(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <button className="lb-refresh-btn" onClick={load} disabled={loading} title="Refresh">
            {loading ? "…" : "↻ Refresh"}
          </button>
        </div>

        {/* The board */}
        {loading ? (
          <div className="home-best home-best--empty">Loading leaderboard…</div>
        ) : people.length <= 1 ? (
          <div className="home-best home-best--empty">
            Add a friend with their code to start competing! 🎯
          </div>
        ) : (
          <div className="lb-board">
            {rows.map((p, i) => (
              <div key={p.uid} className={`lb-board-row ${p.isMe ? "lb-board-row--me" : ""}`}>
                <span className="lb-board-rank">{MEDALS[i] || i + 1}</span>
                <span className="lb-board-avatar lb-board-avatar--initial">{initials(p.displayName)}</span>
                <span className="lb-board-name">
                  {p.displayName || "Player"}{p.isMe && <span className="lb-board-you"> (you)</span>}
                </span>
                <span className="lb-board-points">⭐ {metricOf(p, cat)}</span>
                {!p.isMe && (
                  <button
                    className="lb-remove-btn"
                    onClick={() => handleRemove(p)}
                    aria-label={`Remove ${p.displayName || "friend"}`}
                    title="Remove friend"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
