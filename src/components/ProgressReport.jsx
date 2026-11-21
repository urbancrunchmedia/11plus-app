import React, { useState } from "react";
import { getWeakWords, getSkillAccuracy, getProgressSummary, SKILL_LABEL } from "../utils/progress";
import { usePremium } from "../contexts/PremiumContext";
import { useAuth } from "../contexts/AuthContext";
import Icon from "./Icon";

// Skills with a live game a "Practice" button can jump straight into.
// "wordMatch" is frozen historical data from before Word Match split into
// Synonyms/Antonyms — there's no game by that name to launch any more.
const PRACTISABLE_SKILLS = new Set([
  "synonyms", "antonyms", "compoundWords", "fillInBlanks", "punctuation", "spelling", "wordClass",
]);

// Groups an already-sorted (hardest-first) weak-word list by skill, keeping
// each group in that same hardest-first order, and preserving the order
// skills first appear in (so the worst skill overall leads).
function groupBySkill(words) {
  const order = [];
  const groups = new Map();
  for (const w of words) {
    if (!groups.has(w.skill)) { groups.set(w.skill, []); order.push(w.skill); }
    groups.get(w.skill).push(w);
  }
  return order.map((skill) => ({ skill, words: groups.get(skill) }));
}

// A parent-facing snapshot: where the child is strong, and exactly which words
// to revise next. Premium — free users see a blurred teaser + upgrade.
// What the report looks like once a child has played: shown faded, before any rounds.
const EXAMPLE = {
  tiles: [["86", "questions answered"], ["5", "words to review"], ["3", "words turned around"]],
  skills: [["Spelling", 58], ["Antonyms", 74], ["Synonyms", 88], ["Compound Words", 92]],
  words: [["Meticulous", "Very careful about details"], ["Reluctant", "Not willing"], ["necessary", ""]],
};
const barColour = (pct) => (pct >= 80 ? "#1b8f3a" : pct >= 55 ? "var(--brand)" : "#e8a33d");

export default function ProgressReport({ onBack, onChooseGame, onPractise, onPracticeSkill }) {
  const { isPremium, openPaywall, subscription } = usePremium();
  const { user } = useAuth() || {};
  const childName = user?.displayName && user.displayName !== "Player" ? user.displayName : "your child";
  // A trial is once per customer: don't promise one to someone who's had it.
  const trialEligible = subscription?.trialEligible !== false;
  const unlockLabel = trialEligible ? "Start your 7-day free trial" : "Upgrade to Full Access";
  const [summary]  = useState(getProgressSummary);
  const [skills]   = useState(getSkillAccuracy);
  const [weak]     = useState(() => getWeakWords(30));

  const empty = summary.attempts === 0;
  const visibleWeak = isPremium ? weak : weak.slice(0, 4);
  const weakGroups = groupBySkill(visibleWeak);

  return (
    <div className="report">
      <div className="report-head">
        <button className="round-back-btn" onClick={onBack} aria-label="Back">←</button>
        <div>
          <h1 className="report-title">Progress report</h1>
          <div className="report-sub">What to revise next (for grown-ups)</div>
        </div>
      </div>

      {empty ? (
        <div className="report-empty" data-testid="report-empty">
          <div className="report-empty-title">No rounds played yet</div>
          <div className="report-empty-sub">Once {childName} plays a few rounds, this report shows their accuracy in each game and the exact words to revise. Here's an example:</div>
          <div className="report-example" aria-hidden="true">
            <span className="report-example-tag">Example</span>
            <div className="report-tiles">
              {EXAMPLE.tiles.map(([v, l]) => <div key={l} className="report-tile"><div className="report-tile-val">{v}</div><div className="report-tile-lbl">{l}</div></div>)}
            </div>
            <div className="report-card">
              <div className="report-card-title">Accuracy by skill</div>
              {EXAMPLE.skills.map(([label, pct]) => (
                <div key={label} className="report-bar-row">
                  <div className="report-bar-lbl">{label}</div>
                  <div className="report-bar-track"><div className="report-bar-fill" style={{ width: `${pct}%`, background: barColour(pct) }} /></div>
                  <div className="report-bar-pct">{pct}%</div>
                </div>
              ))}
            </div>
            <div className="report-card">
              <div className="report-card-title">Words to review</div>
              <ul className="report-words">
                {EXAMPLE.words.map(([w, m]) => <li key={w} className="report-word"><div className="report-word-main"><span className="report-word-txt">{w}</span></div>{m && <div className="report-word-meaning">{m}</div>}</li>)}
              </ul>
            </div>
          </div>
          {(onChooseGame || onPractise) && <button className="report-cta" onClick={onChooseGame || onPractise}>Choose a game</button>}
          {!isPremium && <div className="report-empty-note">The full report is part of Full Access{trialEligible ? ", with a 7-day free trial" : ""}.</div>}
        </div>
      ) : (
        <>
          {!isPremium && (
            <div className="report-preview-banner" data-testid="report-preview-banner">
              <div>
                <b>You're seeing a preview.</b> Full Access shows every word {childName} needs to revise, with Practice buttons to work on them.
              </div>
              <button className="report-cta" onClick={() => openPaywall("report")}>{unlockLabel}</button>
            </div>
          )}

          {/* Summary tiles */}
          <div className="report-tiles">
            <div className="report-tile">
              <div className="report-tile-val">{summary.attempts}</div>
              <div className="report-tile-lbl">questions answered</div>
            </div>
            <div className="report-tile">
              <div className="report-tile-val">{summary.toReview}</div>
              <div className="report-tile-lbl">words to review</div>
            </div>
            <div className="report-tile">
              <div className="report-tile-val">{summary.mastered}</div>
              <div className="report-tile-lbl">words turned around</div>
            </div>
          </div>

          {/* Accuracy by skill */}
          <div className="report-card">
            <div className="report-card-title">Accuracy by skill</div>
            {skills.map((s) => (
              <div key={s.skill} className="report-bar-row">
                <div className="report-bar-lbl">{s.label}</div>
                <div className="report-bar-track">
                  <div
                    className="report-bar-fill"
                    style={{ width: `${s.pct}%`, background: barColour(s.pct) }}
                  />
                </div>
                <div className="report-bar-pct">{s.pct}%</div>
              </div>
            ))}
          </div>

          {/* Words to review — the paid payload */}
          <div className={`report-card ${!isPremium ? "report-locked" : ""}`}>
            <div className="report-card-title">
              Words to review
              {!isPremium && <span className="report-lock-badge"><Icon className="inline-ico" name="lock" size={12} stroke="currentColor" strokeWidth={2.2} /> Full Access</span>}
            </div>

            {weak.length === 0 ? (
              <div className="report-none">No weak words right now. Nice!</div>
            ) : (
              weakGroups.map((g) => (
                <div key={g.skill} className="report-skill-group">
                  <div className="report-skill-head">
                    <span className="report-skill-head-lbl">{SKILL_LABEL[g.skill] || g.skill}</span>
                    {PRACTISABLE_SKILLS.has(g.skill) && (
                      <button
                        className="report-skill-cta"
                        // Practice quietly delivers the same spaced-repetition
                        // benefit this report is selling (selectWithReview
                        // isn't premium-gated) — so acting on it needs Full
                        // Access too, not just seeing the word list.
                        onClick={() => (isPremium ? onPracticeSkill?.(g.skill) : openPaywall("report"))}
                      >
                        Practice →
                      </button>
                    )}
                  </div>
                  <div className={!isPremium ? "report-blur" : ""}>
                    <ul className="report-words">
                      {g.words.map((w) => (
                        <li key={`${w.skill}:${w.word}`} className="report-word">
                          <div className="report-word-main">
                            <span className="report-word-txt">{w.word}</span>
                          </div>
                          {w.meaning && <div className="report-word-meaning">{w.meaning}</div>}
                          <span className="report-word-misses">missed {w.misses}×</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))
            )}

            {!isPremium && weak.length > 0 && (
              <div className="report-unlock">
                <div className="report-unlock-txt">See every word to revise and track it over time.</div>
                <button className="report-cta" onClick={() => openPaywall("report")}>{unlockLabel}</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
