import React from "react";

// Line-icon set ported verbatim from the design (Web Prototype.dc.html).
// 24×24 viewBox, 1.9 stroke, round caps — stroke colour is set per use.
const ICONS = {
  home:     '<path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 9.5V20h11V9.5"/><path d="M10 20v-5h4v5"/>',
  book:     '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17h14"/><path d="M9 8h6"/><path d="M9 11.5h4"/>',
  board:    '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5.5H5V7a3.5 3.5 0 0 0 3.3 3.5"/><path d="M16 5.5h3V7a3.5 3.5 0 0 1-3.3 3.5"/><path d="M12 13v3.5"/><path d="M9 20h6"/><path d="M10 20l.4-3.5h3.2L14 20"/>',
  match:    '<path d="M4 8h13"/><path d="M14 5l3 3-3 3"/><path d="M20 16H7"/><path d="M10 13l-3 3 3 3"/>',
  detect:   '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/><path d="M9 11h4"/>',
  punct:    '<circle cx="7" cy="11" r="2.2"/><path d="M7 13.2c0 2.4-1 3.9-2.6 4.8"/><circle cx="17" cy="16" r="2.2"/>',
  compound: '<rect x="3" y="4" width="8" height="8" rx="2.5"/><rect x="13" y="12" width="8" height="8" rx="2.5"/><path d="M11 8h3a2 2 0 0 1 2 2v2"/>',
  spelling: '<path d="M4 18l4.5-11 4.5 11"/><path d="M5.6 14h5.8"/><path d="M20 8v10"/><path d="M20 11.5a3 3 0 1 0 0 6"/>',
  refresh:  '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/>',
  lock:     '<rect x="5" y="11" width="14" height="9" rx="2.2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
};

// Per-skill icon name + stroke + tile background, matching the design.
export const SKILL_ICON = {
  wordMatch:     { name: "match",    stroke: "#12a5ff", bg: "#e4f6ff" },
  fillInBlanks:  { name: "detect",   stroke: "#7fa30c", bg: "#f3fbd4" },
  punctuation:   { name: "punct",    stroke: "#0e1116", bg: "#f0f2f5" },
  compoundWords: { name: "compound", stroke: "#ff6b4a", bg: "#ffe9e3" },
  spelling:      { name: "spelling", stroke: "#8b5cf6", bg: "#f1ecfe" },
  wordList:      { name: "book",     stroke: "#12a5ff", bg: "#eaf4fc" },
};

export default function Icon({ name, size = 24, stroke = "currentColor", strokeWidth = 1.9, className }) {
  const inner = ICONS[name];
  if (!inner) return null;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
