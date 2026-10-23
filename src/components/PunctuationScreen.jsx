import React, { useState, useEffect } from "react";
import { getPrefs, savePrefs, getSetting } from "../utils/leaderboard";
import { getSkillMastery } from "../utils/gamify";
import { usePremium } from "../contexts/PremiumContext";
import { canPickLevel } from "../utils/entitlement";
import Icon, { SKILL_ICON } from "./Icon";
import PracticeButton from "./PracticeButton";
import Dropdown from "./Dropdown";
import FreePlanNote from "./FreePlanNote";

const Q_OPTIONS = [5, 10, 20, 30];

const SETS = [
  { id: "A",   emoji: "🌱", label: "Easy", topics: "Full stops · question marks · commas in lists · contractions" },
  { id: "B",   emoji: "⚡", label: "Medium", topics: "Possessive apostrophes · colons · semi-colons" },
  { id: "C",   emoji: "🔥", label: "Hard", topics: "Fronted adverbials · dashes · brackets · tricky possessives" },
  { id: "all", emoji: "🎲", label: "Mixed", topics: "Exam-style mix of every set, shuffled" },
];

export default function PunctuationScreen({ onPlay, onExit }) {
  const [level, setLevel] = useState(() => {
    const s = getPrefs("punctuation");
    return ["A", "B", "C", "all"].includes(s?.level) ? s.level : getSetting("defaultDifficulty", "A");
  });
  const [totalQuestions, setTotal] = useState(() => {
    const s = getPrefs("punctuation");
    return Q_OPTIONS.includes(s?.totalQuestions) ? s.totalQuestions : 10;
  });
  useEffect(() => { savePrefs("punctuation", { level, totalQuestions }); }, [level, totalQuestions]);

  const { isPremium, openPaywall } = usePremium();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- level is the source of truth fed to buildQuestions()/savePrefs(); this corrects real state, not a display value.
    if (!canPickLevel(level, isPremium)) setLevel("A");
  }, [isPremium, level]);

  function handleLevelChange(v) {
    if (!canPickLevel(v, isPremium)) { openPaywall("taster"); return; }
    setLevel(v);
  }

  const skillM     = getSkillMastery().find((m) => m.id === "punctuation") || {};
  const masteryPct = skillM.pct ?? 0;
  const setLabel   = (SETS.find((s) => s.id === level) || SETS[3]).label;

  return (
    <div className="landing">
      {onExit && <button className="round-back-btn round-back-btn--standalone" onClick={onExit} aria-label="Back to all games">←</button>}
      <div className="landing-head">
        <div className="landing-icon" style={{ background: SKILL_ICON.punctuation.bg }}><Icon name="punct" stroke={SKILL_ICON.punctuation.stroke} size={26} /></div>
        <div className="landing-head-txt">
          <h1 className="landing-h1">Punctuation</h1>
          <div className="landing-sub">Spot the punctuation mistake{skillM.attempted ? ` · ${masteryPct}% accuracy` : ""}</div>
        </div>
      </div>

      <div className="landing-hero">
        <div className="landing-hero-body">
          <div className="landing-hero-title">{setLabel} · {totalQuestions} questions</div>
          <div className="landing-hero-blurb">Find the section with the punctuation or capital-letter mistake, or spot when there's none.</div>
        </div>
        <div className="landing-hero-actions">
          <div className="hero-selects">
            <Dropdown
              ariaLabel="Set"
              value={level}
              onChange={handleLevelChange}
              options={[
                { value: "A", label: "Easy" },
                { value: "B", label: "Medium", locked: !isPremium },
                { value: "C", label: "Hard", locked: !isPremium },
                { value: "all", label: "Mixed", locked: !isPremium },
              ]}
            />
            <Dropdown
              ariaLabel="Length"
              value={totalQuestions}
              onChange={(v) => setTotal(Number(v))}
              options={Q_OPTIONS.map((q) => ({ value: q, label: `${q} questions` }))}
            />
          </div>
          <button className="landing-start" onClick={() => onPlay({ level, totalQuestions })}>
            <span>Start round</span><span className="dash-hero-arrow">→</span>
          </button>
          <div className="hero-secondary">
            <PracticeButton skill="punctuation" onPractice={() => onPlay({ practice: true, level, totalQuestions })} />
          </div>
        </div>
      </div>
      <FreePlanNote game="punctuation" />
    </div>
  );
}
