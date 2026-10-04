import React, { useState } from "react";
import { saveIfBest, saveRun, formatTime } from "../utils/leaderboard";
import { xpToRunReward, getLevelInfo, getStreak, getStats } from "../utils/gamify";
import { getBadges, BADGE_VISUAL } from "../utils/badges";
import { RANK_TIERS } from "../utils/rank";
import { pushToCloud } from "../utils/cloudScores";
import { addWeeklyPoints } from "../utils/weekly";
import { useAuth } from "../contexts/AuthContext";
import Icon from "./Icon";
import CelebrationModal from "./CelebrationModal";

export default function GameComplete({ results, totalWrong, timeTaken, onPlayAgain, onPracticeMisses, onHome, level, gameType, totalQuestions }) {
  const totalStars = results.reduce((sum, r) => sum + r.stars, 0);
  // Correct = answers that earned stars (in one-shot games a wrong answer is 0).
  const correctCount = results.filter((r) => r.stars > 0).length;
  const maxStars   = totalQuestions * 3;
  const pct        = maxStars ? Math.round((totalStars / maxStars) * 100) : 0;

  const { user } = useAuth();
  const firstName = (user?.displayName || "").trim().split(/\s+/)[0] || "you";

  // Snapshot BEFORE this round's save, so we can tell what's genuinely new.
  const [before] = useState(() => {
    const s = getStats();
    return { badgeIds: new Set(getBadges(s).filter((b) => b.earned).map((b) => b.id)), rankId: s.rank.id };
  });

  const [isNewBest] = useState(() => {
    saveRun(level, gameType, totalQuestions, totalStars, totalWrong, timeTaken, user?.displayName);
    const newBest = saveIfBest(level, gameType, totalQuestions, totalStars, totalWrong, timeTaken);
    // Every round counts towards this week, whether or not it beat a best.
    addWeeklyPoints(totalStars);
    if (user) pushToCloud(user);
    return newBest;
  });

  // Read AFTER the run is saved so XP/level/streak reflect it.
  const xpEarned = xpToRunReward(totalStars);
  const [payout] = useState(() => ({ level: getLevelInfo(), streak: getStreak() }));

  // Anything newly unlocked by this round, queued one at a time. A rank
  // *drop* never celebrates — only promotions do.
  const [celebrations] = useState(() => {
    const after = getStats();
    const queue = getBadges(after)
      .filter((b) => b.earned && !before.badgeIds.has(b.id))
      .map((b) => {
        const visual = BADGE_VISUAL[b.id] || {};
        return {
          title: `${b.name} unlocked!`,
          subtitle: `Nice one, ${firstName}!`,
          gem: { facetCount: visual.facets || 3, colors: visual.colors || ["#e2e5e9", "#b8c0c9", "#8f99a3"], icon: visual.icon },
        };
      });
    const beforeIdx = RANK_TIERS.findIndex((t) => t.id === before.rankId);
    const afterIdx  = RANK_TIERS.findIndex((t) => t.id === after.rank.id);
    if (afterIdx > beforeIdx) {
      const tier = RANK_TIERS[afterIdx];
      queue.push({
        title: `You're a ${tier.label} now!`,
        subtitle: `Nice one, ${firstName} — ${tier.label} Rank unlocked this week.`,
        gem: { facetCount: tier.facets, colors: tier.colors, icon: null },
      });
    }
    return queue;
  });
  const [celebrateIdx, setCelebrateIdx] = useState(0);
  const activeCelebration = celebrations[celebrateIdx] || null;

  const resultIcon = pct === 100 ? "trophy" : pct >= 70 ? "star" : "target";
  const title  = pct === 100 ? `Flawless, ${firstName}!` : pct >= 70 ? `Nice one, ${firstName}!` : `Good effort, ${firstName}`;
  const badge  = isNewBest ? "NEW PERSONAL BEST" : pct >= 70 ? "GREAT ROUND" : "KEEP GOING";

  // Words they didn't get first-time (stars < 3) are worth a second look.
  const watch = results.filter((r) => r.stars < 3).map((r) => r.word);

  return (
    <div className="gc-screen">
      <div className="gc-inner">
        <div className="gc-emoji"><Icon name={resultIcon} size={52} stroke="var(--accent)" strokeWidth={1.9} /></div>
        <div className="gc-title">{title}</div>
        <div className="gc-badge">{badge}</div>

        <div className="gc-tiles">
          <div className="gc-tile"><div className="gc-tile-val">{correctCount}<span className="gc-tile-of">/{totalQuestions}</span></div><div className="gc-tile-lbl">correct</div></div>
          <div className="gc-tile"><div className="gc-tile-val">{totalWrong}</div><div className="gc-tile-lbl">wrong</div></div>
          <div className="gc-tile"><div className="gc-tile-val">{formatTime(timeTaken)}</div><div className="gc-tile-lbl">time</div></div>
          <div className="gc-tile gc-tile--lime"><div className="gc-tile-val"><Icon className="inline-ico" name="star" size={15} stroke="var(--ink)" strokeWidth={2} /> {totalStars}</div><div className="gc-tile-lbl">stars</div></div>
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
            <span className="gc-watch-ic"><Icon name="target" size={18} stroke="currentColor" strokeWidth={2} /></span>
            <span className="gc-watch-txt">Worth another look: <strong>{watch.slice(0, 4).join(", ")}</strong>{watch.length > 4 ? "…" : ""}</span>
            {onPracticeMisses && (
              <button className="gc-watch-cta" onClick={onPracticeMisses}>Fix these {watch.length}</button>
            )}
          </div>
        )}

        <div className="gc-actions">
          <button className="gc-again" onClick={onPlayAgain}>Play again</button>
          <button className="gc-back" onClick={onHome}>Back home</button>
        </div>
      </div>

      {activeCelebration && (
        <CelebrationModal
          title={activeCelebration.title}
          subtitle={activeCelebration.subtitle}
          gem={activeCelebration.gem}
          onDismiss={() => setCelebrateIdx((i) => i + 1)}
        />
      )}
    </div>
  );
}
