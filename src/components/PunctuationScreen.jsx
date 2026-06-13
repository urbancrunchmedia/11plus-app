import React, { useState, useEffect } from "react";
import { getPrefs, savePrefs, getBest, getTopRuns, formatTime, formatDate } from "../utils/leaderboard";

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

  const maxStars = totalQuestions * 3;
  const best     = getBest("all", "punctuation", totalQuestions);
  const topRuns  = getTopRuns("all", "punctuation", totalQuestions, 5);

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

        <div className="home-columns">

          {/* ── Left: controls ── */}
          <div className="home-col home-col-controls">
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
              Play!
            </button>
          </div>

          {/* ── Right: personal best + runs ── */}
          <div className="home-col home-col-scores">
            <div className="section-label">🏆 Personal Best</div>
            {best ? (
              <div className="home-best">
                <span className="home-best-score">⭐ {best.stars}/{maxStars}</span>
                <span className="home-best-detail">{best.wrong} wrong · ⏱ {formatTime(best.time ?? 0)} · {formatDate(best.date)}</span>
              </div>
            ) : (
              <div className="home-best home-best--empty">No score yet — be the first! 🎯</div>
            )}

            <div className="section-label">Your Best Runs</div>
            {topRuns.length > 0 ? (
              <table className="lb-table">
                <thead>
                  <tr><th>#</th><th>Stars</th><th>Time</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {topRuns.map((r, i) => (
                    <tr key={i} className={i === 0 ? "lb-row lb-top" : "lb-row"}>
                      <td className="lb-rank">{i + 1}</td>
                      <td>⭐ {r.stars}/{maxStars}</td>
                      <td>{formatTime(r.time ?? 0)}</td>
                      <td className="lb-date">{formatDate(r.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="home-best home-best--empty">Play a game to see your best runs here! 🎯</div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
