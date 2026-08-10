import React, { useState, useEffect } from "react";
import { punctuationData } from "../data/punctuation";
import { getPrefs, savePrefs, getBest, getTopRuns, formatTime, formatDate } from "../utils/leaderboard";
import { getSkillMastery, getXp } from "../utils/gamify";
import SampleQuiz from "./SampleQuiz";
import Icon, { SKILL_ICON } from "./Icon";

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
        <div className="landing-icon" style={{ background: SKILL_ICON.punctuation.bg }}><Icon name="punct" stroke={SKILL_ICON.punctuation.stroke} size={26} /></div>
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
          <div className="hero-select-wrap">
            <select className="hero-select" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Set">
              <option value="A">Level A · easiest</option>
              <option value="B">Level B · intermediate</option>
              <option value="C">Level C · hardest</option>
              <option value="all">All levels · mixed</option>
            </select>
            <span className="hero-select-chev">▾</span>
          </div>
          <div className="hero-select-wrap">
            <select className="hero-select" value={totalQuestions} onChange={(e) => setTotal(Number(e.target.value))} aria-label="Length">
              {Q_OPTIONS.map((q) => <option key={q} value={q}>{q} questions</option>)}
            </select>
            <span className="hero-select-chev">▾</span>
          </div>
        </div>
      </div>

    </div>
  );
}
