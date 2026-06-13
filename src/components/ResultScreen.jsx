import React from "react";

export default function ResultScreen({ score, total, level, gameType, onPlayAgain, onHome }) {
  const typeLabel = gameType === "synonyms" ? "Synonyms" : "Antonyms";

  return (
    <div className="result-screen">
      <div className="result-card">
        <div className="result-emoji">🎉</div>
        <h1 className="result-title">Well Done!</h1>
        <p className="result-subtitle">You matched all {total} pairs!</p>

        <div className="stars">
          {[0, 1, 2].map((i) => (
            <span key={i} className="star" style={{ animationDelay: `${i * 0.15}s` }}>
              ⭐
            </span>
          ))}
        </div>

        <div className="result-stats">
          <div className="stat">
            <span className="stat-value">{score}</span>
            <span className="stat-label">Correct</span>
          </div>
          <div className="stat">
            <span className="stat-value">Level {level}</span>
            <span className="stat-label">Difficulty</span>
          </div>
          <div className="stat">
            <span className="stat-value">{typeLabel}</span>
            <span className="stat-label">Game</span>
          </div>
        </div>

        <div className="result-buttons">
          <button className="play-btn" onClick={onPlayAgain}>
            Play Again
          </button>
          <button className="secondary-btn" onClick={onHome}>
            Change Level
          </button>
        </div>
      </div>
    </div>
  );
}
