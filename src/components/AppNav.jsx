import React from "react";

// Primary navigation. Renders as a slim dark icon-rail on desktop and a bottom
// tab bar (with a raised centre Play button) on mobile — driven by CSS.
const ITEMS = [
  { id: "home",        label: "Home",  icon: "🏠" },
  { id: "wordList",    label: "Words", icon: "📖" },
  { id: "play",        label: "Play",  icon: "▶️", fab: true },
  { id: "leaderboard", label: "Board", icon: "🏆" },
  { id: "me",          label: "Me",    icon: "🙂" },
];

// Any specific game screen counts as being on the "Play" tab.
const PLAY_TAB = new Set(["play", "wordMatch", "compoundWords", "punctuation", "fillInBlanks"]);

export default function AppNav({ active, onNavigate }) {
  const activeTab = PLAY_TAB.has(active) ? "play" : active;

  return (
    <nav className="appnav">
      <div className="appnav-logo" aria-hidden>11</div>
      {ITEMS.map((it) => (
        <button
          key={it.id}
          className={`appnav-item ${it.fab ? "fab" : ""} ${activeTab === it.id ? "active" : ""}`}
          onClick={() => onNavigate(it.id)}
          aria-label={it.label}
        >
          <span className="appnav-icon">{it.icon}</span>
          <span className="appnav-label">{it.label}</span>
        </button>
      ))}
    </nav>
  );
}
