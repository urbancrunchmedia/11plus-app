import React, { useState, useEffect } from "react";
import { getPrefs, savePrefs } from "../utils/leaderboard";

const Q_OPTIONS = [5, 10, 20, 30];

export default function PunctuationScreen({ onPlay, initialConfig }) {
  const [totalQuestions, setTotal] = useState(() => {
    const saved = getPrefs("punctuation");
    if (Q_OPTIONS.includes(saved?.totalQuestions)) return saved.totalQuestions;
    return initialConfig?.totalQuestions ?? 20;
  });

  useEffect(() => {
    savePrefs("punctuation", { totalQuestions });
  }, [totalQuestions]);

  return (
    <div className="home-screen">
      <div className="home-card">

        <div className="home-title">
          <span className="home-emoji">✏️</span>
          <h1>Punctuation</h1>
        </div>

        <p className="game-type-desc">
          Learn how to use commas, full stops, apostrophes, question marks and more correctly in sentences.
        </p>

        <div className="home-col">
          <div className="section-label">Number of Questions</div>
          <div className="q-bar">
            {Q_OPTIONS.map((q, i) => {
              const activeIdx  = Q_OPTIONS.indexOf(totalQuestions);
              const isFilled   = i <= activeIdx;
              const isSelected = q === totalQuestions;
              return (
                <button
                  key={q}
                  className={`q-segment ${isFilled ? "filled" : ""} ${isSelected ? "selected" : ""}`}
                  onClick={() => setTotal(q)}
                >
                  {q}
                </button>
              );
            })}
          </div>

          <button className="play-btn" onClick={() => onPlay({ level: "all", totalQuestions })}>
            Play! 🎮
          </button>
        </div>

      </div>
    </div>
  );
}
