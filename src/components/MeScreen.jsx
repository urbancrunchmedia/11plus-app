import React from "react";
import { getStats } from "../utils/gamify";
import { useAuth } from "../contexts/AuthContext";
import AuthButton from "./AuthButton";

function initials(name) {
  return name ? name.trim().charAt(0).toUpperCase() : "🙂";
}

export default function MeScreen() {
  const { user } = useAuth();
  const stats = getStats();

  return (
    <div className="me-screen">
      <div className="me-card">
        <div className="me-avatar">{initials(user?.displayName)}</div>
        <div className="me-name">{user?.displayName || "Player"}</div>
        <div className="me-title">Level {stats.level} · {stats.title}</div>

        <div className="me-xpbar">
          <div className="me-xpbar-fill" style={{ width: `${stats.pct}%` }} />
        </div>
        <div className="me-xpnote">{stats.intoLevel} / 250 XP · {stats.toNext} to Level {stats.level + 1}</div>

        <div className="me-stats">
          <div className="me-stat"><div className="me-stat-val">🔥 {stats.streak}</div><div className="me-stat-label">Day streak</div></div>
          <div className="me-stat"><div className="me-stat-val">{stats.xp.toLocaleString()}</div><div className="me-stat-label">XP total</div></div>
          <div className="me-stat"><div className="me-stat-val">{stats.badges}</div><div className="me-stat-label">Badges</div></div>
          <div className="me-stat"><div className="me-stat-val">{stats.rounds}</div><div className="me-stat-label">Rounds</div></div>
        </div>
      </div>

      <div className="me-account">
        <div className="section-label">Account</div>
        <AuthButton />
      </div>
    </div>
  );
}
