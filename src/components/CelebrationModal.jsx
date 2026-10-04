import React from "react";
import Gem from "./Gem";

const CONFETTI = [
  { top: "8%",  left: "10%", color: "#d4f520", rotate: 18,  shape: "bar" },
  { top: "13%", left: "80%", color: "#12a5ff", rotate: 0,   shape: "dot" },
  { top: "18%", left: "65%", color: "#e0507a", rotate: -24, shape: "bar" },
  { top: "9%",  left: "52%", color: "#d4a017", rotate: 40,  shape: "bar" },
  { top: "21%", left: "16%", color: "#8b5cf6", rotate: 0,   shape: "dot" },
  { top: "82%", left: "86%", color: "#16a34a", rotate: -12, shape: "bar" },
  { top: "86%", left: "8%",  color: "#12a5ff", rotate: 22,  shape: "bar" },
  { top: "80%", left: "52%", color: "#d4f520", rotate: 0,   shape: "dot" },
];

// A kid unlocking a badge or getting promoted needs it to feel like an
// event, not a detail buried in the results screen. Purely presentational —
// the caller (GameComplete) decides what unlocked and supplies the copy +
// gem, and queues more than one of these if several things unlocked at once.
export default function CelebrationModal({ title, subtitle, gem, onDismiss }) {
  return (
    <div className="celebrate-overlay" role="dialog" aria-modal="true">
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className={`celebrate-confetti celebrate-confetti--${c.shape}`}
          style={{ top: c.top, left: c.left, background: c.color, transform: `rotate(${c.rotate}deg)` }}
        />
      ))}
      <div className="celebrate-card">
        <div className="celebrate-gem">
          <Gem
            size={100}
            facetCount={gem.facetCount}
            colorLight={gem.colors[0]}
            colorMid={gem.colors[1]}
            colorDark={gem.colors[2]}
            icon={gem.icon}
          />
        </div>
        <div className="celebrate-title">{title}</div>
        <div className="celebrate-subtitle">{subtitle}</div>
        <button className="celebrate-btn" onClick={onDismiss}>Nice!</button>
      </div>
    </div>
  );
}
