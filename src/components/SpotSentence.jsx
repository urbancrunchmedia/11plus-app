import React from "react";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const N_INDEX = 4; // data convention: answer 4 === "no mistake"

// "Spot the mistake" — the sentence reads as ONE natural line (tight word
// spacing, each section lightly underlined with an A/B/C letter beneath), and a
// dedicated answer row (A/B/C… + N) sits below. Tapping a section OR its answer
// button picks it. `classFor(i)` returns "" | "correct" | "wrong".
export default function SpotSentence({ segments, classFor, onPick, disabled }) {
  return (
    <div className="spot">
      {/* The sentence is read-only — only the answer buttons below are clickable. */}
      <div className="spot-line">
        {segments.map((seg, i) => (
          <span key={i} className={`spot-part ${classFor(i)}`}>
            <span className="spot-part-text">{seg}</span>
            <span className="spot-part-tag">{LETTERS[i]}</span>
          </span>
        ))}
      </div>

      <div className="spot-answers">
        {segments.map((_, i) => (
          <button key={i} type="button" className={`spot-ans ${classFor(i)}`} onClick={() => onPick(i)} disabled={disabled}>
            {LETTERS[i]}
          </button>
        ))}
        <button type="button" className={`spot-ans ${classFor(N_INDEX)}`} onClick={() => onPick(N_INDEX)} disabled={disabled}>
          N
        </button>
      </div>
      <div className="spot-ncap">N = no mistake</div>
    </div>
  );
}
