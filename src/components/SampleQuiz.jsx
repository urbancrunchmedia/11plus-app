import React, { useState } from "react";

// A free, interactive "try one" card (matches the prototype's sample cards).
// Pick an answer → wrong options fade and feedback shows → an explicit "Next"
// button advances. items: [{ sentence, options:[str], answer:index, teach? }]
export default function SampleQuiz({ label, items, blank = "_____", hint, nextLabel = "Next" }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);

  if (!items || items.length === 0) return null;
  const q = items[idx % items.length];
  const revealed = picked !== null;
  const correct = revealed && picked === q.answer;

  function pick(i) { if (picked === null) setPicked(i); }
  function next() { setIdx((v) => v + 1); setPicked(null); }

  const [before, after = ""] = q.sentence.split(blank);

  return (
    <div className="samp">
      <div className="samp-top">
        <span className="samp-label">{label}</span>
        <span className="samp-counter">{(idx % items.length) + 1} of {items.length}</span>
      </div>
      <div className="samp-sentence">
        {before}
        <span className="samp-blank">{revealed ? q.options[q.answer] : "   "}</span>
        {after}
      </div>
      <div className="samp-options">
        {q.options.map((o, i) => {
          let cls = "samp-opt";
          if (revealed) {
            if (i === q.answer) cls += " correct";
            else if (i === picked) cls += " wrong";
            else cls += " faded";
          }
          return (
            <button key={i} className={cls} onClick={() => pick(i)} disabled={revealed}>{o}</button>
          );
        })}
      </div>
      <div className="samp-fbrow">
        <div className={`samp-fb ${revealed ? (correct ? "ok" : "no") : ""}`}>
          {!revealed
            ? (hint || "Free practice — pick an answer, no streak risk.")
            : correct
              ? `Correct — it's ${q.options[q.answer]}.`
              : `Not quite — it's ${q.options[q.answer]}.${q.teach ? " " + q.teach : ""}`}
        </div>
        {revealed && (
          <button className="samp-next" onClick={next}>
            {nextLabel}<span className="samp-next-arrow">→</span>
          </button>
        )}
      </div>
    </div>
  );
}
