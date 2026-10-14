import React, { useState, useEffect } from "react";
import { getPrefs, savePrefs, getSetting } from "../utils/leaderboard";
import { getSkillMastery } from "../utils/gamify";
import { usePremium } from "../contexts/PremiumContext";
import { isLevelFree } from "../utils/entitlement";
import Icon, { SKILL_ICON } from "./Icon";
import PracticeButton from "./PracticeButton";
import Dropdown from "./Dropdown";

const Q_OPTIONS = [5, 10, 20];

const SETS = [
  { id: "A",   emoji: "🌱", label: "Easy", topics: "Noun · Verb · Adjective" },
  { id: "B",   emoji: "⚡", label: "Medium", topics: "+ Pronoun · Adverb · Preposition" },
  { id: "C",   emoji: "🔥", label: "Hard", topics: "+ Helping Verb · Conjunction · Interjection" },
  { id: "all", emoji: "🎲", label: "Mixed", topics: "Exam-style mix of every category, shuffled" },
];

export default function WordClassScreen({ onPlay, onExit }) {
  const [level, setLevel] = useState(() => {
    const s = getPrefs("wordClass");
    return ["A", "B", "C", "all"].includes(s?.level) ? s.level : getSetting("defaultDifficulty", "A");
  });
  const [totalQuestions, setTotal] = useState(() => {
    const s = getPrefs("wordClass");
    return Q_OPTIONS.includes(s?.totalQuestions) ? s.totalQuestions : 10;
  });
  useEffect(() => { savePrefs("wordClass", { level, totalQuestions }); }, [level, totalQuestions]);

  const { isPremium, openPaywall } = usePremium();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- level is the source of truth fed to buildQuestions()/savePrefs(); this corrects real state, not a display value.
    if (!isPremium && !isLevelFree(level)) setLevel("A");
  }, [isPremium, level]);

  function handleLevelChange(v) {
    if (!isPremium && !isLevelFree(v)) { openPaywall("level"); return; }
    setLevel(v);
  }

  const skillM     = getSkillMastery().find((m) => m.id === "wordClass") || {};
  const masteryPct = skillM.pct ?? 0;
  const setLabel   = (SETS.find((s) => s.id === level) || SETS[3]).label;

  return (
    <div className="landing">
      {onExit && <button className="round-back-btn round-back-btn--standalone" onClick={onExit} aria-label="Back to all games">←</button>}
      <div className="landing-head">
        <div className="landing-icon" style={{ background: SKILL_ICON.wordClass.bg }}><Icon name={SKILL_ICON.wordClass.name} stroke={SKILL_ICON.wordClass.stroke} size={26} /></div>
        <div className="landing-head-txt">
          <h1 className="landing-h1">Parts of Speech</h1>
          <div className="landing-sub">Spot the noun, verb or adjective{skillM.attempted ? ` · ${masteryPct}% accuracy` : ""}</div>
        </div>
      </div>

      <div className="landing-hero landing-hero--row">
        <div className="landing-hero-body">
          <div className="landing-hero-title">{setLabel} · {totalQuestions} questions</div>
          <div className="landing-hero-blurb">{(SETS.find((s) => s.id === level) || SETS[3]).topics}</div>
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
            <PracticeButton skill="wordClass" onPractice={() => onPlay({ practice: true, level, totalQuestions })} />
          </div>
        </div>
      </div>
    </div>
  );
}
