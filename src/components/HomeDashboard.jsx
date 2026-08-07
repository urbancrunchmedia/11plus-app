import React from "react";
import { getStats } from "../utils/gamify";
import { useAuth } from "../contexts/AuthContext";

function initials(name) {
  if (!name) return "🙂";
  return name.trim().charAt(0).toUpperCase();
}

export default function HomeDashboard({ onQuickPlay, onPlaySkill, onOpenBoard }) {
  const { user } = useAuth();
  const stats = getStats();
  const name  = user?.displayName || "there";
  const daily = stats.daily;

  return (
    <div className="dash">
      {/* Greeting */}
      <div className="dash-top">
        <div className="dash-avatar">{initials(user?.displayName)}</div>
        <div className="dash-hi">
          <div className="dash-name">Hi, {name}</div>
          <div className="dash-sub">Level {stats.level} · {stats.title}</div>
        </div>
        <div className="dash-streak">🔥 {stats.streak}</div>
      </div>

      {/* Today's challenge hero */}
      <div className="dash-hero">
        <div className="dash-hero-body">
          <span className="dash-chip">TODAY'S CHALLENGE</span>
          <div className="dash-hero-title">
            {daily.done} of {daily.target} rounds done
          </div>
          <div className="dash-hero-note">
            {daily.complete ? "Challenge complete — nice work!" : "Play a round to keep your streak"}
          </div>
        </div>
        <div
          className="dash-ring"
          style={{ "--pct": `${(daily.done / daily.target) * 100}%` }}
        >
          <div className="dash-ring-mid">{Math.round((daily.done / daily.target) * 100)}%</div>
        </div>
        <button className="dash-hero-cta" onClick={onQuickPlay}>
          <span>{daily.complete ? "Play more" : "Play a round"}</span>
          <span className="dash-hero-arrow">→</span>
        </button>
      </div>

      {/* Stat tiles */}
      <div className="dash-stats">
        <div className="dash-stat">
          <div className="dash-stat-val">{stats.xp.toLocaleString()}</div>
          <div className="dash-stat-label">XP total</div>
        </div>
        <div className="dash-stat">
          <div className="dash-stat-val">{stats.badges}</div>
          <div className="dash-stat-label">Badges</div>
        </div>
        <div className="dash-stat dash-stat--dark">
          <div className="dash-stat-val">⭐ {stats.stars}</div>
          <div className="dash-stat-label">Stars won</div>
        </div>
      </div>

      {/* Skills mastery */}
      <div className="dash-section-head">
        <span>Your skills</span>
        <button className="dash-seeall" onClick={onOpenBoard}>Leaderboard →</button>
      </div>
      <div className="dash-skills">
        {stats.mastery.map((s) => (
          <button key={s.id} className="dash-skill" onClick={() => onPlaySkill(s.id)}>
            <div className="dash-skill-icon">{s.icon}</div>
            <div className="dash-skill-body">
              <div className="dash-skill-row">
                <span className="dash-skill-name">{s.label}</span>
                <span className="dash-skill-pct">{s.pct}%</span>
              </div>
              <div className="dash-bar"><div className="dash-bar-fill" style={{ width: `${s.pct}%` }} /></div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
