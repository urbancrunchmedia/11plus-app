import React from "react";
import { getStats, SKILLS } from "../utils/gamify";
import { useAuth } from "../contexts/AuthContext";

// Icon + card colour per skill, matching the prototype's "Jump back in" cards.
const SKILL_CARD = {
  wordMatch:     { bg: "#E4F6FF", bar: "var(--brand)" },
  fillInBlanks:  { bg: "#F3FBD4", bar: "var(--accent)" },
  punctuation:   { bg: "#F0F2F5", bar: "var(--ink)" },
};
const WORDLIST_CARD = { id: "wordList", label: "Word List", icon: "📖", bg: "#EAF4FC" };

export default function HomeDashboard({ onPlaySkill, onOpenBoard }) {
  const { user } = useAuth();
  const stats = getStats();
  const name  = user?.displayName || "there";
  const daily = stats.daily;
  const ringPct = Math.round((daily.done / daily.target) * 100);

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

      {/* Hero + progress */}
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
              <span>{daily.complete ? "Play more" : "Play a round"}</span>
              <span className="dash-hero-arrow">→</span>
            </button>
          </div>
          <div className="dash-ring" style={{ "--pct": `${ringPct}%` }}>
            <div className="dash-ring-mid">{ringPct}%</div>
          </div>
        </div>

        <div className="dash-side">
          <div className="dash-side-title">Your progress</div>
          <div className="dash-side-rows">
            <div className="dash-side-row"><span>XP total</span><b>{stats.xp.toLocaleString()}</b></div>
            <div className="dash-side-row"><span>Day streak</span><b>🔥 {stats.streak}</b></div>
            <div className="dash-side-row"><span>Stars won</span><b>⭐ {stats.stars}</b></div>
            <div className="dash-side-row"><span>Rounds played</span><b>{stats.rounds}</b></div>
          </div>
          <button className="dash-side-cta" onClick={onOpenBoard}>Open leaderboard</button>
        </div>
      </div>

      {/* Jump back in */}
      <div className="dash-jump-head">Jump back in</div>
      <div className="dash-jump">
        {stats.mastery.map((s) => {
          const c = SKILL_CARD[s.id] || { bg: "#E4F6FF", bar: "var(--brand)" };
          return (
            <button key={s.id} className="jumpcard" onClick={() => onPlaySkill(s.id)}>
              <div className="jumpcard-icon" style={{ background: c.bg }}>{s.icon}</div>
              <div className="jumpcard-title">{s.label}</div>
              <div className="jumpcard-sub">{s.pct}% mastered</div>
              <div className="dash-bar"><div className="dash-bar-fill" style={{ width: `${s.pct}%`, background: c.bar }} /></div>
            </button>
          );
        })}
        <button className="jumpcard jumpcard--dashed" onClick={() => onPlaySkill("wordList")}>
          <div className="jumpcard-icon" style={{ background: WORDLIST_CARD.bg }}>{WORDLIST_CARD.icon}</div>
          <div className="jumpcard-title">{WORDLIST_CARD.label}</div>
          <div className="jumpcard-sub">Look up every word</div>
          <div className="jumpcard-link">Browse words →</div>
        </button>
      </div>
    </div>
  );
}
