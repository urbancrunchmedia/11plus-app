import React, { useState } from "react";

// A free, interactive "try one" card used on the Detective and Punctuation
// landings (matches the prototype's sample-clue / sample-question card).
// items: [{ sentence, blank, options:[str], answer:index, teach?:string }]
// `sentence` contains `blank` (e.g. "_____") where the answer goes.
export default function SampleQuiz({ label, items, blank = "_____", hint }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);

  if (!items || items.length === 0) return null;
  const q = items[idx % items.length];
  const revealed = picked !== null;
  const correct = revealed && picked === q.answer;

  function pick(i) {
    if (revealed) { setIdx((v) => v + 1); setPicked(null); }
    else setPicked(i);
  }

  const [before, after = ""] = q.sentence.split(blank);

  return (
    <div className="samp">
      <div className="samp-top">
        <span className="samp-label">{label}</span>
        <span className="samp-counter">{(idx % items.length) + 1} of {items.length}</span>
      </div>
      <div className="samp-sentence">
        {before}
        <span className="samp-blank">{revealed ? q.options[q.answer] : "   "}</span>
        {after}
      </div>
      <div className="samp-options">
        {q.options.map((o, i) => {
          let cls = "samp-opt";
          if (revealed) { if (i === q.answer) cls += " correct"; else if (i === picked) cls += " wrong"; }
          return <button key={i} className={cls} onClick={() => pick(i)}>{o}</button>;
        })}
      </div>
      <div className={`samp-fb ${revealed ? (correct ? "ok" : "no") : ""}`}>
        {!revealed
          ? (hint || "Free practice — pick an answer, no streak risk.")
          : correct
            ? "Correct! Tap any answer for the next one."
            : `Not quite — it's ${q.options[q.answer]}.${q.teach ? " " + q.teach : ""} Tap for the next one.`}
      </div>
    </div>
  );
}
