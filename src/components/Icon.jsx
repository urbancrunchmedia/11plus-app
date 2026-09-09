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
  volumeOn: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a8.5 8.5 0 0 1 0 12"/>',
  volumeOff:'<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M22 9l-5 5"/><path d="M17 9l5 5"/>',
  // Sound-effects mute toggle (bell), kept visually distinct from `volumeOn` —
  // that one means "read this aloud" (FlashcardScreen's text-to-speech).
  bell:     '<path d="M7 16V11a5 5 0 0 1 10 0v5l1.5 2H5.5z"/><path d="M10 19.5a2 2 0 0 0 4 0"/>',
  bellOff:  '<path d="M7 16V11a5 5 0 0 1 10 0v5l1.5 2H5.5z"/><path d="M10 19.5a2 2 0 0 0 4 0"/><path d="M22 9l-5 5"/><path d="M17 9l5 5"/>',
  star:     '<path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 17l-5.25 2.6 1-5.8L3.5 9.7l5.9-.9z"/>',
  flame:    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  trophy:   '<path d="M7 5h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.4A3.6 3.6 0 0 0 7.6 11"/><path d="M17 6h3v1.4A3.6 3.6 0 0 1 16.4 11"/><path d="M12 14v3"/><path d="M8.5 20h7"/><path d="M9.5 20l.5-3h4l.5 3"/>',
  target:   '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  medal:    '<circle cx="12" cy="14.5" r="5.5"/><path d="M8.5 3.5 12 9l3.5-5.5"/>',
  copy:     '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5.8 15H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v.8"/>',
  check:    '<path d="M5 12.5l4.5 4.5L19 7"/>',
  trash:    '<path d="M4.5 7h15"/><path d="M9.5 7V4.8h5V7"/><path d="M6.6 7l1 12.2h8.8L17.4 7"/>',
  chart:    '<path d="M4 4v16h16"/><rect x="7.5" y="11" width="3" height="6" rx="1"/><rect x="12.5" y="7" width="3" height="10" rx="1"/><rect x="17.5" y="13" width="3" height="4" rx="1"/>',
};

// Per-skill icon name + stroke + tile background, matching the design.
// eslint-disable-next-line react-refresh/only-export-components -- a lookup table, not a component; not worth a separate file for a dev-only warning.
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
