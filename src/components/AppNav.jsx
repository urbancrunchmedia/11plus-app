import React from "react";
import Icon from "./Icon";
import { getStreak } from "../utils/gamify";
import { useAuth } from "../contexts/AuthContext";

// Primary navigation, matching the design prototype: a dark icon-rail on desktop
// (logo top, streak + avatar at the bottom) and a bottom tab bar on mobile.
// Slim rail per the design: games are reached from the Home dashboard cards.
const ITEMS = [
  { id: "home",         label: "Home",   icon: "home" },
  { id: "wordList",     label: "Words",  icon: "book" },
  { id: "leaderboard",  label: "Board",  icon: "board" },
];

export default function AppNav({ active, onNavigate }) {
  const { user } = useAuth();
  const streak = getStreak();
  const initial = user?.displayName ? user.displayName.trim().charAt(0).toUpperCase() : "A";

  return (
    <nav className="appnav">
      <div className="appnav-logo" aria-hidden>11</div>

      <div className="appnav-items">
        {ITEMS.map((it) => (
          <button
            key={it.id}
            className={`appnav-item ${active === it.id ? "active" : ""}`}
            onClick={() => onNavigate(it.id)}
            aria-label={it.label}
          >
            <span className="appnav-icon"><Icon name={it.icon} size={22} /></span>
            <span className="appnav-label">{it.label}</span>
          </button>
        ))}
      </div>

      <div className="appnav-foot">
        <div className="appnav-streak">🔥 {streak}</div>
        <button
          className={`appnav-avatar ${active === "me" ? "active" : ""}`}
          onClick={() => onNavigate("me")}
          aria-label="Me"
        >
          {initial}
        </button>
      </div>
    </nav>
  );
}
