import React from "react";

function Stars({ count }) {
  return (
    <span className="stars-row">
      {[1, 2, 3].map((i) => (
        <span key={i} className={`star-icon ${i <= count ? "lit" : "dim"}`}>★</span>
      ))}
    </span>
  );
}

export default function RoundSummary({ roundNum, results, streak, onNext, onHome }) {
  const totalStars = results.reduce((sum, r) => sum + r.stars, 0);
  const maxStars = results.length * 3;
  const allPerfect = results.every((r) => r.stars === 3);

  return (
    <div className="summary-overlay">
      <div className="summary-card">
        <p className="summary-round-label">Round {roundNum}</p>
        <h2 className="summary-title">{allPerfect ? "🌟 Perfect Round!" : "✅ Round Complete!"}</h2>

        {streak >= 3 && (
          <div className="streak-banner">🔥 {streak} correct in a row!</div>
        )}

        <div className="summary-results">
          {results.map((r, i) => (
            <div key={i} className="summary-row">
              <span className="summary-pair">{r.word} → {r.match}</span>
              <Stars count={r.stars} />
            </div>
          ))}
        </div>

        <div className="summary-score">{totalStars} / {maxStars} stars</div>

        <div className="summary-buttons">
          <button className="play-btn" onClick={onNext}>Next Round</button>
          <button className="secondary-btn" onClick={onHome}>Home</button>
        </div>
      </div>
    </div>
  );
}
