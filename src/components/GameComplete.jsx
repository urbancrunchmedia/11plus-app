import React, { useState } from "react";
import { saveIfBest, saveRun, getBest, formatTime } from "../utils/leaderboard";
import { pushToCloud } from "../utils/cloudScores";
import { useAuth } from "../contexts/AuthContext";

function Stars({ count }) {
  return (
    <span className="stars-row">
      {[1, 2, 3].map((i) => (
        <span key={i} className={`star-icon ${i <= count ? "lit" : "dim"}`}>★</span>
      ))}
    </span>
  );
}

export default function GameComplete({ results, totalWrong, timeTaken, onPlayAgain, onHome, level, gameType, totalQuestions }) {
  const totalStars = results.reduce((sum, r) => sum + r.stars, 0);
  const maxStars   = totalQuestions * 3;
  const pct        = Math.round((totalStars / maxStars) * 100);
  const title      = pct === 100 ? "🌟 Perfect!" : pct >= 70 ? "🎉 Great job!" : "✅ Done!";

  const { user } = useAuth();
  const [prevBest]  = useState(() => getBest(level, gameType, totalQuestions));
  const [isNewBest] = useState(() => {
    saveRun(level, gameType, totalQuestions, totalStars, totalWrong, timeTaken, user?.displayName);
    const newBest = saveIfBest(level, gameType, totalQuestions, totalStars, totalWrong, timeTaken);
    if (user) pushToCloud(user.uid);
    return newBest;
  });

  return (
    <div className="summary-overlay">
      <div className="summary-card">
        <h2 className="summary-title">{title}</h2>

        {isNewBest && (
          <div className="new-best-banner">🏆 New Personal Best!</div>
        )}

        {!isNewBest && prevBest && (
          <div className="prev-best-banner">
            Previous best: ⭐ {prevBest.stars}/{maxStars} · {prevBest.wrong} wrong · ⏱ {formatTime(prevBest.time)} · {prevBest.date}
          </div>
        )}

        <div className="gc-stats">
          <div className="gc-stat">
            <span className="gc-stat-value gc-correct">{results.length}</span>
            <span className="gc-stat-label">Correct</span>
          </div>
          <div className="gc-stat">
            <span className="gc-stat-value gc-wrong">{totalWrong}</span>
            <span className="gc-stat-label">Wrong</span>
          </div>
          <div className="gc-stat">
            <span className="gc-stat-value gc-stars">{totalStars}/{maxStars}</span>
            <span className="gc-stat-label">Stars</span>
          </div>
          <div className="gc-stat">
            <span className="gc-stat-value gc-time">⏱ {formatTime(timeTaken)}</span>
            <span className="gc-stat-label">Time</span>
          </div>
        </div>

        <div className="summary-results">
          {results.map((r, i) => (
            <div key={i} className="summary-row">
              <span className="summary-pair">{r.word} → {r.match}</span>
              <Stars count={r.stars} />
            </div>
          ))}
        </div>

        <div className="summary-buttons">
          <button className="play-btn" onClick={onPlayAgain}>Play Again</button>
          <button className="secondary-btn" onClick={onHome}>Home</button>
        </div>
      </div>
    </div>
  );
}
