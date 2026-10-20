import React, { useState } from "react";
import { getPrefs, savePrefs } from "../utils/leaderboard";
import { getSkillMastery } from "../utils/gamify";
import PracticeButton from "./PracticeButton";
import Icon, { SKILL_ICON } from "./Icon";
import Dropdown from "./Dropdown";

const Q_OPTIONS = [5, 10, 20, 30];

export default function DetectiveScreen({ onPlay, onLearn, onExit }) {
  const [totalQuestions, setTotal] = useState(() => {
    const saved = getPrefs("fillInBlanks");
    return Q_OPTIONS.includes(saved?.totalQuestions) ? saved.totalQuestions : 10;
  });
  React.useEffect(() => { savePrefs("fillInBlanks", { totalQuestions }); }, [totalQuestions]);

  const skillM     = getSkillMastery().find((m) => m.id === "fillInBlanks") || {};
  const masteryPct = skillM.pct ?? 0;
  const estMin     = Math.max(1, Math.round(totalQuestions * 0.35));

  return (
    <div className="landing">
      {onExit && <button className="round-back-btn round-back-btn--standalone" onClick={onExit} aria-label="Back to all games">←</button>}
      <div className="landing-head">
        <div className="landing-icon" style={{ background: SKILL_ICON.fillInBlanks.bg }}><Icon name="detect" stroke={SKILL_ICON.fillInBlanks.stroke} size={26} /></div>
        <div className="landing-head-txt">
          <h1 className="landing-h1">Word Detective</h1>
          <div className="landing-sub">Words from every level, mixed together{skillM.attempted ? ` · ${masteryPct}% accuracy` : ""}</div>
        </div>
      </div>

      <div className="landing-hero">
        <div className="landing-hero-body">
          <div className="landing-hero-title">{totalQuestions} words · ~{estMin} min</div>
          <div className="landing-hero-blurb">Work out each word from its clue. Words you miss come back another day.</div>
        </div>
        <div className="landing-hero-actions">
          <div className="hero-selects hero-selects--pair">
            <Dropdown
              ariaLabel="Length"
              value={totalQuestions}
              onChange={(v) => setTotal(Number(v))}
              options={Q_OPTIONS.map((q) => ({ value: q, label: `${q} words` }))}
            />
            {onLearn && <button className="landing-learn hero-selects-btn" onClick={onLearn}>Learn first</button>}
          </div>
          <button className="landing-start" onClick={() => onPlay({ level: "all", totalQuestions })}>
            <span>Start round</span><span className="dash-hero-arrow">→</span>
          </button>
          <div className="hero-secondary">
            <PracticeButton skill="fillInBlanks" onPractice={() => onPlay({ practice: true, level: "all", totalQuestions })} />
          </div>
        </div>
      </div>
    </div>
  );
}
