import React, { useState, useEffect } from "react";
import { getPrefs, savePrefs, getBest, getTopRuns, formatTime, formatDate } from "../utils/leaderboard";
import { getSkillMastery } from "../utils/gamify";

const Q_OPTIONS = [5, 10, 20, 30];

export default function PunctuationScreen({ onPlay, initialConfig }) {
  const [totalQuestions, setTotal] = useState(() => {
    const saved = getPrefs("punctuation");
    if (Q_OPTIONS.includes(saved?.totalQuestions)) return saved.totalQuestions;
    return Q_OPTIONS.includes(initialConfig?.totalQuestions) ? initialConfig.totalQuestions : 10;
  });

  useEffect(() => {
    savePrefs("punctuation", { totalQuestions });
  }, [totalQuestions]);

  const maxStars   = totalQuestions * 3;
  const best       = getBest("all", "punctuation", totalQuestions);
  const topRuns    = getTopRuns("all", "punctuation", totalQuestions, 5);
  const masteryPct = (getSkillMastery().find((m) => m.id === "punctuation") || {}).pct ?? 0;
  const estMin     = Math.max(1, Math.round(totalQuestions * 0.3));

  return (
    <div className="landing">
      <div className="landing-head">
        <div className="landing-icon" style={{ background: "#f0f2f5" }}>✏️</div>
        <div className="landing-head-txt">
          <h1 className="landing-h1">Punctuation</h1>
          <div className="landing-sub">Add the right punctuation · {masteryPct}% mastered</div>
        </div>
      </div>

      <div className="landing-hero">
        <span className="dash-chip">PICKED FOR YOU</span>
        <div className="landing-hero-title">{totalQuestions} questions</div>
        <div className="landing-hero-blurb">
          Commas, full stops, apostrophes, question marks and more — pick the punctuation that makes each sentence correct.
        </div>
        <div className="landing-tags">
          <span className="landing-tag">⏱ ~{estMin} min</span>
          <span className="landing-tag">🔥 keeps streak</span>
        </div>
        <div className="landing-hero-actions">
          <button className="landing-start" onClick={() => onPlay({ level: "all", totalQuestions })}>
            <span>Start round</span><span className="dash-hero-arrow">→</span>
          </button>
        </div>
      </div>

      <div className="landing-or"><span>Or choose your own</span></div>

      <div className="landing-lenrow">
        <span className="landing-lenlabel">Length</span>
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
      </div>

      <div className="landing-best">
        <div className="section-label">🏆 Personal best</div>
        {best ? (
          <div className="home-best">
            <span className="home-best-score">⭐ {best.stars}/{maxStars}</span>
            <span className="home-best-detail">{best.wrong} wrong · ⏱ {formatTime(best.time ?? 0)} · {formatDate(best.date)}</span>
          </div>
        ) : (
          <div className="home-best home-best--empty">No score yet — be the first! 🎯</div>
        )}

        {topRuns.length > 0 && (
          <>
            <div className="section-label">Your best runs</div>
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
          </>
        )}
      </div>
    </div>
  );
}
