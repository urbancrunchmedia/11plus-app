import React, { useState } from "react";
import { saveIfBest, saveRun, getBest, formatTime } from "../utils/leaderboard";
import { xpToRunReward, getLevelInfo, getStreak } from "../utils/gamify";
import { pushToCloud } from "../utils/cloudScores";
import { useAuth } from "../contexts/AuthContext";

export default function GameComplete({ results, totalWrong, timeTaken, onPlayAgain, onHome, level, gameType, totalQuestions }) {
  const totalStars = results.reduce((sum, r) => sum + r.stars, 0);
  const maxStars   = totalQuestions * 3;
  const pct        = maxStars ? Math.round((totalStars / maxStars) * 100) : 0;

  const { user } = useAuth();
  const firstName = (user?.displayName || "").trim().split(/\s+/)[0] || "you";

  const [isNewBest] = useState(() => {
    saveRun(level, gameType, totalQuestions, totalStars, totalWrong, timeTaken, user?.displayName);
    const newBest = saveIfBest(level, gameType, totalQuestions, totalStars, totalWrong, timeTaken);
    if (user) pushToCloud(user);
    return newBest;
  });

  // Read AFTER the run is saved so XP/level/streak reflect it.
  const xpEarned = xpToRunReward(totalStars);
  const [payout] = useState(() => ({ level: getLevelInfo(), streak: getStreak() }));

  const emoji  = pct === 100 ? "🌟" : pct >= 70 ? "🎉" : "💪";
  const title  = pct === 100 ? `Flawless, ${firstName}!` : pct >= 70 ? `Nice one, ${firstName}!` : `Good effort, ${firstName}`;
  const badge  = isNewBest ? "NEW PERSONAL BEST" : pct >= 70 ? "GREAT ROUND" : "KEEP GOING";

  // Words they didn't get first-time (stars < 3) are worth a second look.
  const watch = results.filter((r) => r.stars < 3).map((r) => r.word);

  return (
    <div className="gc-screen">
      <div className="gc-inner">
        <div className="gc-emoji">{emoji}</div>
        <div className="gc-title">{title}</div>
        <div className="gc-badge">{badge}</div>

        <div className="gc-tiles">
          <div className="gc-tile"><div className="gc-tile-val">{results.length}<span className="gc-tile-of">/{totalQuestions}</span></div><div className="gc-tile-lbl">correct</div></div>
          <div className="gc-tile"><div className="gc-tile-val">{totalWrong}</div><div className="gc-tile-lbl">wrong</div></div>
          <div className="gc-tile"><div className="gc-tile-val">{formatTime(timeTaken)}</div><div className="gc-tile-lbl">time</div></div>
          <div className="gc-tile gc-tile--lime"><div className="gc-tile-val">⭐ {totalStars}</div><div className="gc-tile-lbl">stars</div></div>
        </div>

        <div className="gc-xpcard">
          <div className="gc-xpcard-top">
            <span className="gc-xpcard-xp">+{xpEarned} XP</span>
            <span className="gc-xpcard-lvl">Level {payout.level.level} · {payout.level.title}</span>
          </div>
          <div className="gc-xpbar2"><div className="gc-xpbar2-fill" style={{ width: `${payout.level.pct}%` }} /></div>
          <div className="gc-xpcard-note">{payout.level.toNext} XP to Level {payout.level.level + 1}</div>
          <div className="gc-streakrow">
            <div className="gc-streak-ic">🔥</div>
            <div>
              <div className="gc-streak-title">Day {payout.streak} streak</div>
              <div className="gc-streak-sub">Play again tomorrow to keep it going</div>
            </div>
          </div>
        </div>

        {watch.length > 0 && (
          <div className="gc-watch">
            <span className="gc-watch-ic">🎯</span>
            <span>Worth another look: <strong>{watch.slice(0, 4).join(", ")}</strong>{watch.length > 4 ? "…" : ""}</span>
          </div>
        )}

        <div className="gc-actions">
          <button className="gc-again" onClick={onPlayAgain}>Play again</button>
          <button className="gc-back" onClick={onHome}>Back home</button>
        </div>
      </div>
    </div>
  );
}
