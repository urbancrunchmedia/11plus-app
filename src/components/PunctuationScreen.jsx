import React, { useState, useEffect } from "react";
import { punctuationData } from "../data/punctuation";
import { getPrefs, savePrefs, getBest, getTopRuns, formatTime, formatDate } from "../utils/leaderboard";
import { getSkillMastery, getXp } from "../utils/gamify";
import SampleQuiz from "./SampleQuiz";

const Q_OPTIONS = [5, 10, 20, 30];

const SETS = [
  { id: "A",   emoji: "🌱", label: "Level A", topics: "Full stops · question marks · commas in lists · contractions" },
  { id: "B",   emoji: "⚡", label: "Level B", topics: "Possessive apostrophes · colons · semi-colons" },
  { id: "C",   emoji: "🔥", label: "Level C", topics: "Fronted adverbials · dashes · brackets · tricky possessives" },
  { id: "all", emoji: "🎲", label: "All levels", topics: "Exam-style mix of every set, shuffled" },
];

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }

function buildSamples() {
  const all = [...(punctuationData.A || []), ...(punctuationData.B || []), ...(punctuationData.C || [])];
  return shuffle(all).slice(0, 5).map((q) => ({ sentence: q.sentence, options: q.options, answer: q.answer }));
}

export default function PunctuationScreen({ onPlay }) {
  const [samples] = useState(buildSamples);
  const [level, setLevel] = useState(() => {
    const s = getPrefs("punctuation");
    return ["A", "B", "C", "all"].includes(s?.level) ? s.level : "all";
  });
  const [totalQuestions, setTotal] = useState(() => {
    const s = getPrefs("punctuation");
    return Q_OPTIONS.includes(s?.totalQuestions) ? s.totalQuestions : 10;
  });
  useEffect(() => { savePrefs("punctuation", { level, totalQuestions }); }, [level, totalQuestions]);

  const maxStars   = totalQuestions * 3;
  const best       = getBest(level, "punctuation", totalQuestions);
  const topRuns    = getTopRuns(level, "punctuation", totalQuestions, 5);
  const masteryPct = (getSkillMastery().find((m) => m.id === "punctuation") || {}).pct ?? 0;
  const estMin     = Math.max(1, Math.round(totalQuestions * 0.3));
  const setLabel   = (SETS.find((s) => s.id === level) || SETS[3]).label;

  return (
    <div className="landing">
      <div className="landing-head">
        <div className="landing-icon" style={{ background: "#f0f2f5" }}>✏️</div>
        <div className="landing-head-txt">
          <h1 className="landing-h1">Punctuation</h1>
          <div className="landing-sub">Add the right punctuation · {masteryPct}% mastered</div>
        </div>
        <span className="landing-xp">{getXp().toLocaleString()} XP</span>
      </div>

      <div className="samp-card">
        <SampleQuiz label="TRY A QUESTION — FREE" items={samples} blank="___" hint="Pick the punctuation that makes the sentence correct." nextLabel="Next question" />
      </div>

      <div className="landing-hero landing-hero--row">
        <div className="landing-hero-body">
          <span className="dash-chip">PICKED FOR YOU</span>
          <div className="landing-hero-title">{setLabel} · {totalQuestions} questions</div>
          <div className="landing-hero-blurb">Commas, full stops, apostrophes, colons and more.</div>
        </div>
        <div className="landing-hero-actions">
          <button className="landing-start" onClick={() => onPlay({ level, totalQuestions })}>
            <span>Start round</span><span className="dash-hero-arrow">→</span>
          </button>
        </div>
      </div>

      <div className="landing-or"><span>Choose a set</span></div>
      <div className="punct-sets">
        {SETS.map((s) => {
          const b = getBest(s.id, "punctuation", totalQuestions);
          return (
            <button key={s.id} className={`punct-set ${level === s.id ? "active" : ""}`} onClick={() => setLevel(s.id)}>
              <div className="punct-set-top">
                <span className="punct-set-emoji">{s.emoji}</span>
                {b ? <span className="punct-set-best">⭐ {b.stars}/{maxStars}</span> : <span className="punct-set-new">Not tried</span>}
              </div>
              <div className="punct-set-label">{s.label}</div>
              <div className="punct-set-topics">{s.topics}</div>
            </button>
          );
        })}
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
        <div className="section-label">🏆 Personal best · {setLabel}</div>
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
