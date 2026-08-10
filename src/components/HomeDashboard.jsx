import React, { useState, useEffect } from "react";
import { getStats } from "../utils/gamify";
import { getLeaderboard } from "../utils/cloudScores";
import { useAuth } from "../contexts/AuthContext";
import Icon, { SKILL_ICON } from "./Icon";

const SKILL_BAR = {
  wordMatch:     "var(--brand)",
  fillInBlanks:  "var(--accent)",
  punctuation:   "var(--ink)",
  compoundWords: "#ff6b4a",
};

function initial(name) {
  return name ? name.trim().charAt(0).toUpperCase() : "?";
}

export default function HomeDashboard({ onPlaySkill, onOpenBoard }) {
  const { user } = useAuth();
  const stats = getStats();
  const name  = user?.displayName || "there";
  const daily = stats.daily;
  const ringPct = Math.round((daily.done / daily.target) * 100);

  const [friends, setFriends] = useState(null); // null = loading
  useEffect(() => {
    let ok = true;
    if (user) {
      getLeaderboard(user.uid).then((b) => ok && setFriends(b)).catch(() => ok && setFriends([]));
    } else {
      setFriends([]);
    }
    return () => { ok = false; };
  }, [user]);

  const topFriends = (friends || []).slice(0, 4);
  const hasFriends = (friends || []).length > 1;

  return (
    <div className="dash">
      {/* Header */}
      <div className="dash-head">
        <div>
          <div className="dash-name">Hi, {name}</div>
          <div className="dash-sub">Level {stats.level} · {stats.title} · {stats.xp.toLocaleString()} XP</div>
        </div>
        <div className="dash-head-pills">
          <span className="dash-pill dash-pill--dark">🔥 {stats.streak} day streak</span>
          <span className="dash-pill">{stats.badges} badges</span>
        </div>
      </div>

      {/* Hero + friends */}
      <div className="dash-grid">
        <div className="dash-hero">
          <div className="dash-hero-body">
            <span className="dash-chip">TODAY'S CHALLENGE</span>
            <div className="dash-hero-title">{daily.done} of {daily.target} rounds done</div>
            <div className="dash-hero-note">
              {daily.complete
                ? "Challenge complete — nice work!"
                : `One more keeps your ${stats.streak}-day streak alive.`}
            </div>
            <button className="dash-hero-cta" onClick={() => onPlaySkill("wordMatch")}>
              <span>Play a round</span>
              <span className="dash-hero-arrow">→</span>
            </button>
          </div>
          <div className="dash-ring" style={{ "--pct": `${ringPct}%` }}>
            <div className="dash-ring-mid">{ringPct}%</div>
          </div>
        </div>

        <div className="dash-side">
          <div className="dash-side-title">Friends this week</div>
          <div className="dash-friends">
            {friends === null && <div className="dash-friend-empty">Loading…</div>}
            {friends !== null && !hasFriends && (
              <div className="dash-friend-empty">Add friends to compete — tap below.</div>
            )}
            {friends !== null && hasFriends && topFriends.map((f, i) => (
              <div key={f.uid} className={`dash-friend ${f.isMe ? "me" : ""}`}>
                <span className="dash-friend-rank">{i + 1}</span>
                <span className={`dash-friend-av ${i === 0 ? "gold" : ""} ${f.isMe ? "me" : ""}`}>{initial(f.displayName)}</span>
                <span className="dash-friend-name">{f.displayName || "Player"}{f.isMe ? " (you)" : ""}</span>
                <span className="dash-friend-pts">{(f.points || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <button className="dash-side-cta" onClick={onOpenBoard}>Open leaderboard</button>
        </div>
      </div>

      {/* Jump back in */}
      <div className="dash-jump-head">Jump back in</div>
      <div className="dash-jump">
        {stats.mastery.map((s) => {
          const ic = SKILL_ICON[s.id] || SKILL_ICON.wordMatch;
          return (
            <button key={s.id} className="jumpcard" onClick={() => onPlaySkill(s.id)}>
              <div className="jumpcard-icon" style={{ background: ic.bg }}><Icon name={ic.name} stroke={ic.stroke} size={24} /></div>
              <div className="jumpcard-title">{s.label}</div>
              <div className="jumpcard-sub">{s.pct}% mastered</div>
              <div className="dash-bar"><div className="dash-bar-fill" style={{ width: `${s.pct}%`, background: SKILL_BAR[s.id] || "var(--brand)" }} /></div>
            </button>
          );
        })}
        <button className="jumpcard" onClick={() => onPlaySkill("wordList")}>
          <div className="jumpcard-icon" style={{ background: SKILL_ICON.wordList.bg }}><Icon name={SKILL_ICON.wordList.name} stroke={SKILL_ICON.wordList.stroke} size={24} /></div>
          <div className="jumpcard-title">Word List</div>
          <div className="jumpcard-sub">Look up every word</div>
          <div className="jumpcard-link">Browse words →</div>
        </button>
      </div>
    </div>
  );
}
