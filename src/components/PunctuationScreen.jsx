import React, { useState, useEffect } from "react";
import { punctuationSpot } from "../data/punctuationSpot";
import { getPrefs, savePrefs, getBest, getTopRuns, formatTime, formatDate } from "../utils/leaderboard";
import { getSkillMastery, getXp } from "../utils/gamify";
import { usePremium } from "../contexts/PremiumContext";
import { isLevelFree } from "../utils/entitlement";
import Icon, { SKILL_ICON } from "./Icon";
import SpotSentence from "./SpotSentence";
import PracticeButton from "./PracticeButton";

const Q_OPTIONS = [5, 10, 20, 30];

// Free "spot the mistake" demo — mirrors the real game: read the sentence and
// pick the section (A–D) with the mistake, or N for no mistake.
function SpotSample({ items }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const q = items[i];
  const done = picked !== null;
  const classFor = (idx) => (done && idx === q.answer ? "correct" : done && idx === picked && picked !== q.answer ? "wrong" : "");
  return (
    <div className="spotsamp">
      <div className="samp-label">TRY ONE — FREE, NO STREAK RISK</div>
      <p className="spotsamp-q">Which section has the mistake?</p>
      <SpotSentence segments={q.segments} classFor={classFor} onPick={(idx) => !done && setPicked(idx)} disabled={done} />
      {done && (
        <div className="spotsamp-fb">
          <span className={`spotsamp-why ${picked === q.answer ? "ok" : "no"}`}>
            {picked === q.answer ? "Correct! " : "Not quite. "}{q.why}
          </span>
          <button className="spotsamp-next" onClick={() => { setI((i + 1) % items.length); setPicked(null); }}>Next →</button>
        </div>
      )}
    </div>
  );
}

const SETS = [
  { id: "A",   emoji: "🌱", label: "Level A", topics: "Full stops · question marks · commas in lists · contractions" },
  { id: "B",   emoji: "⚡", label: "Level B", topics: "Possessive apostrophes · colons · semi-colons" },
  { id: "C",   emoji: "🔥", label: "Level C", topics: "Fronted adverbials · dashes · brackets · tricky possessives" },
  { id: "all", emoji: "🎲", label: "All levels", topics: "Exam-style mix of every set, shuffled" },
];

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }

function buildSamples() {
  const all = [...(punctuationSpot.A || []), ...(punctuationSpot.B || []), ...(punctuationSpot.C || [])];
  return shuffle(all).slice(0, 6);
}

export default function PunctuationScreen({ onPlay, onExit }) {
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

  const { isPremium, openPaywall } = usePremium();
  useEffect(() => {
    if (!isPremium && !isLevelFree(level)) setLevel("A");
  }, [isPremium, level]);

  function handleLevelChange(v) {
    if (!isPremium && !isLevelFree(v)) { openPaywall("level"); return; }
    setLevel(v);
  }

  const maxStars   = totalQuestions * 3;
  const best       = getBest(level, "punctuation", totalQuestions);
  const topRuns    = getTopRuns(level, "punctuation", totalQuestions, 5);
  const skillM     = getSkillMastery().find((m) => m.id === "punctuation") || {};
  const masteryPct = skillM.pct ?? 0;
  const estMin     = Math.max(1, Math.round(totalQuestions * 0.3));
  const setLabel   = (SETS.find((s) => s.id === level) || SETS[3]).label;

  return (
    <div className="landing">
      {onExit && <button className="landing-back" onClick={onExit}>← All games</button>}
      <div className="landing-head">
        <div className="landing-icon" style={{ background: SKILL_ICON.punctuation.bg }}><Icon name="punct" stroke={SKILL_ICON.punctuation.stroke} size={26} /></div>
        <div className="landing-head-txt">
          <h1 className="landing-h1">Punctuation</h1>
          <div className="landing-sub">Spot the punctuation mistake{skillM.attempted ? ` · ${masteryPct}% accuracy` : ""}</div>
        </div>
        <span className="landing-xp">{getXp().toLocaleString()} XP</span>
      </div>

      <div className="samp-card">
        <SpotSample items={samples} />
      </div>

      <div className="landing-hero landing-hero--row">
        <div className="landing-hero-body">
          <span className="dash-chip">PICKED FOR YOU</span>
          <div className="landing-hero-title">{setLabel} · {totalQuestions} questions</div>
          <div className="landing-hero-blurb">Find the section with the punctuation or capital-letter mistake — or spot when there's none.</div>
        </div>
        <div className="landing-hero-actions">
          <button className="landing-start" onClick={() => onPlay({ level, totalQuestions })}>
            <span>Start round</span><span className="dash-hero-arrow">→</span>
          </button>
          <div className="hero-select-wrap">
            <select className="hero-select" value={level} onChange={(e) => handleLevelChange(e.target.value)} aria-label="Set">
              <option value="A">Level A · easiest</option>
              <option value="B">{isPremium ? "Level B · intermediate" : "Level B · premium"}</option>
              <option value="C">{isPremium ? "Level C · hardest" : "Level C · premium"}</option>
              <option value="all">{isPremium ? "All levels · mixed" : "All levels · premium"}</option>
            </select>
            <span className="hero-select-chev">▾</span>
          </div>
          <div className="hero-select-wrap">
            <select className="hero-select" value={totalQuestions} onChange={(e) => setTotal(Number(e.target.value))} aria-label="Length">
              {Q_OPTIONS.map((q) => <option key={q} value={q}>{q} questions</option>)}
            </select>
            <span className="hero-select-chev">▾</span>
          </div>
          <PracticeButton skill="punctuation" onPractice={() => onPlay({ practice: true, level, totalQuestions })} />
        </div>
      </div>
    </div>
  );
}
