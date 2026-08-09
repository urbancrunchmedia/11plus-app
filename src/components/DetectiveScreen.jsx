import React, { useState } from "react";
import { fillInBlanksData } from "../data/fillInBlanks";
import { getBest, getTopRuns, formatTime, formatDate, getPrefs, savePrefs } from "../utils/leaderboard";
import { getSkillMastery, getXp } from "../utils/gamify";
import SampleQuiz from "./SampleQuiz";

const Q_OPTIONS = [5, 10, 20, 30];

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }

// Build a few free sample clues from the real Word Detective data.
function buildSamples() {
  const all = [...(fillInBlanksData.A || []), ...(fillInBlanksData.B || []), ...(fillInBlanksData.C || [])];
  return shuffle(all).slice(0, 5).map((c) => {
    const decoys = shuffle(all.filter((x) => x.word !== c.word)).slice(0, 3).map((x) => x.word);
    const options = shuffle([c.word, ...decoys]);
    return { sentence: c.sentence, options, answer: options.indexOf(c.word), teach: c.definition };
  });
}

export default function DetectiveScreen({ onPlay, onLearn }) {
  const [samples] = useState(buildSamples);
  const [totalQuestions, setTotal] = useState(() => {
    const saved = getPrefs("fillInBlanks");
    return Q_OPTIONS.includes(saved?.totalQuestions) ? saved.totalQuestions : 10;
  });
  React.useEffect(() => { savePrefs("fillInBlanks", { totalQuestions }); }, [totalQuestions]);

  const maxStars   = totalQuestions * 3;
  const best       = getBest("all", "fillInBlanks", totalQuestions);
  const topRuns    = getTopRuns("all", "fillInBlanks", totalQuestions, 5);
  const masteryPct = (getSkillMastery().find((m) => m.id === "fillInBlanks") || {}).pct ?? 0;
  const estMin     = Math.max(1, Math.round(totalQuestions * 0.35));

  return (
    <div className="landing">
      <div className="landing-head">
        <div className="landing-icon" style={{ background: "#f3fbd4" }}>🕵️</div>
        <div className="landing-head-txt">
          <h1 className="landing-h1">Word Detective</h1>
          <div className="landing-sub">Work out the missing word from clues · {masteryPct}% mastered</div>
        </div>
        <span className="landing-xp">{getXp().toLocaleString()} XP</span>
      </div>

      <div className="samp-card">
        <SampleQuiz label="TRY A CLUE — FREE, NO STREAK RISK" items={samples} blank="_____" hint="Every clue teaches the word in a real sentence." nextLabel="Next clue" />
      </div>

      <div className="landing-hero landing-hero--row">
        <div className="landing-hero-body">
          <div className="landing-hero-title">{totalQuestions} clues · ~{estMin} min</div>
          <div className="landing-hero-blurb">Work out each word from its clue. Words you miss come back another day.</div>
        </div>
        <div className="landing-hero-actions">
          <button className="landing-start" onClick={() => onPlay({ level: "all", totalQuestions })}>
            <span>Start round</span><span className="dash-hero-arrow">→</span>
          </button>
          {onLearn && <button className="landing-learn" onClick={onLearn}>Learn first</button>}
        </div>
      </div>

      <div className="landing-lenrow">
        <span className="landing-lenlabel">Length</span>
        <div className="q-bar">
          {Q_OPTIONS.map((q, i) => {
            const activeIdx = Q_OPTIONS.indexOf(totalQuestions);
            return (
              <button key={q} className={`q-segment ${i <= activeIdx ? "filled" : ""} ${q === totalQuestions ? "selected" : ""}`} onClick={() => setTotal(q)}>{q}</button>
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
              <thead><tr><th>#</th><th>Stars</th><th>Time</th><th>Date</th></tr></thead>
              <tbody>
                {topRuns.map((r, i) => (
                  <tr key={i} className={i === 0 ? "lb-row lb-top" : "lb-row"}>
                    <td className="lb-rank">{i + 1}</td><td>⭐ {r.stars}/{maxStars}</td><td>{formatTime(r.time ?? 0)}</td><td className="lb-date">{formatDate(r.date)}</td>
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
