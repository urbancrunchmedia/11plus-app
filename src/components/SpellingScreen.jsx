import React, { useState, useEffect } from "react";
import { spellingSpot } from "../data/spellingSpot";
import { getPrefs, savePrefs } from "../utils/leaderboard";
import { getSkillMastery, getXp } from "../utils/gamify";
import { usePremium } from "../contexts/PremiumContext";
import { isLevelFree } from "../utils/entitlement";
import Icon, { SKILL_ICON } from "./Icon";
import SpotSentence from "./SpotSentence";
import PracticeButton from "./PracticeButton";

const Q_OPTIONS = [5, 10, 20, 30];

// Free "spot the mistake" demo — read the sentence and pick the section (A–D)
// with the misspelled word, or N for no mistake.
function SpotSample({ items }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const q = items[i];
  const done = picked !== null;
  const classFor = (idx) => (done && idx === q.answer ? "correct" : done && idx === picked && picked !== q.answer ? "wrong" : "");
  return (
    <div className="spotsamp">
      <div className="samp-label">TRY ONE · FREE, NO STREAK RISK</div>
      <p className="spotsamp-q">Which section has the spelling mistake?</p>
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
  { id: "A",   label: "Easy" },
  { id: "B",   label: "Medium" },
  { id: "C",   label: "Hard" },
  { id: "all", label: "Mixed" },
];

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }

function buildSamples() {
  const all = [...(spellingSpot.A || []), ...(spellingSpot.B || []), ...(spellingSpot.C || [])];
  return shuffle(all).slice(0, 6);
}

export default function SpellingScreen({ onPlay, onExit }) {
  const [samples] = useState(buildSamples);
  const [level, setLevel] = useState(() => {
    const s = getPrefs("spelling");
    return ["A", "B", "C", "all"].includes(s?.level) ? s.level : "all";
  });
  const [totalQuestions, setTotal] = useState(() => {
    const s = getPrefs("spelling");
    return Q_OPTIONS.includes(s?.totalQuestions) ? s.totalQuestions : 10;
  });
  useEffect(() => { savePrefs("spelling", { level, totalQuestions }); }, [level, totalQuestions]);

  const { isPremium, openPaywall } = usePremium();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- level is the source of truth fed to buildQuestions()/savePrefs(); this corrects real state, not a display value.
    if (!isPremium && !isLevelFree(level)) setLevel("A");
  }, [isPremium, level]);

  function handleLevelChange(v) {
    if (!isPremium && !isLevelFree(v)) { openPaywall("level"); return; }
    setLevel(v);
  }

  const skillM     = getSkillMastery().find((m) => m.id === "spelling") || {};
  const masteryPct = skillM.pct ?? 0;
  const setLabel   = (SETS.find((s) => s.id === level) || SETS[3]).label;

  return (
    <div className="landing">
      {onExit && <button className="landing-back" onClick={onExit}>← All games</button>}
      <div className="landing-head">
        <div className="landing-icon" style={{ background: SKILL_ICON.spelling.bg }}><Icon name="spelling" stroke={SKILL_ICON.spelling.stroke} size={26} /></div>
        <div className="landing-head-txt">
          <h1 className="landing-h1">Spelling</h1>
          <div className="landing-sub">Spot the spelling mistake{skillM.attempted ? ` · ${masteryPct}% accuracy` : ""}</div>
        </div>
        <span className="landing-xp">{getXp().toLocaleString()} XP</span>
      </div>

      <div className="samp-card">
        <SpotSample items={samples} />
      </div>

      <div className="landing-hero landing-hero--row">
        <div className="landing-hero-body">
          <div className="landing-hero-title">{setLabel} · {totalQuestions} questions</div>
          <div className="landing-hero-blurb">Find the section with the misspelled word, or spot when there's none.</div>
        </div>
        <div className="landing-hero-actions">
          <div className="hero-selects">
            <div className="hero-select-wrap">
              <select className="hero-select" value={level} onChange={(e) => handleLevelChange(e.target.value)} aria-label="Set">
                <option value="A">Easy</option>
                <option value="B">{isPremium ? "Medium" : "Medium · Premium"}</option>
                <option value="C">{isPremium ? "Hard" : "Hard · Premium"}</option>
                <option value="all">{isPremium ? "Mixed" : "Mixed · Premium"}</option>
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
          <button className="landing-start" onClick={() => onPlay({ level, totalQuestions })}>
            <span>Start round</span><span className="dash-hero-arrow">→</span>
          </button>
          <div className="hero-secondary">
            <PracticeButton skill="spelling" onPractice={() => onPlay({ practice: true, level, totalQuestions })} />
          </div>
        </div>
      </div>
    </div>
  );
}
