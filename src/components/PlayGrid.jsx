import React from "react";
import { getSkillMastery } from "../utils/gamify";

const GAMES = [
  { id: "wordMatch",     label: "Word Match",     icon: "📚",  desc: "Same & opposite meanings",  bg: "#E4F6FF" },
  { id: "compoundWords", label: "Compound Words", icon: "🧩",  desc: "Join two words into one",    bg: "#F3FBD4" },
  { id: "fillInBlanks",  label: "Word Detective", icon: "🕵️", desc: "Find the word from clues",   bg: "#EAF4FC" },
  { id: "punctuation",   label: "Punctuation",    icon: "✏️", desc: "Add the right punctuation",  bg: "#F0F2F5" },
];

export default function PlayGrid({ onSelectGame }) {
  const mastery = Object.fromEntries(getSkillMastery().map((m) => [m.id, m.pct]));

  return (
    <div className="playgrid-screen">
      <h1 className="playgrid-title">Choose a game</h1>
      <p className="playgrid-sub">Pick a skill to practise.</p>
      <div className="playgrid">
        {GAMES.map((g) => (
          <button key={g.id} className="playcard" onClick={() => onSelectGame(g.id)}>
            <div className="playcard-icon" style={{ background: g.bg }}>{g.icon}</div>
            <div className="playcard-label">{g.label}</div>
            <div className="playcard-desc">{g.desc}</div>
            <div className="dash-bar"><div className="dash-bar-fill" style={{ width: `${mastery[g.id] ?? 0}%` }} /></div>
            <div className="playcard-pct">{mastery[g.id] ?? 0}% mastered</div>
          </button>
        ))}
      </div>
    </div>
  );
}
