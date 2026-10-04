import React from "react";
import { getStats } from "../utils/gamify";
import { getBadges, BADGE_VISUAL, BADGE_GREY } from "../utils/badges";
import { getRankProgress, RANK_TIERS } from "../utils/rank";
import Gem from "./Gem";

function formatDate(iso) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function BadgesScreen({ onExit }) {
  const stats = getStats();
  const badges = getBadges(stats);
  const progress = getRankProgress();
  const tierInfo = RANK_TIERS.find((t) => t.id === progress.tier) || RANK_TIERS[0];
  const earnedCount = badges.filter((b) => b.earned).length;
  const weekTotal = progress.weekPoints + progress.toNext;
  const barPct = weekTotal > 0 ? Math.min(100, Math.round((progress.weekPoints / weekTotal) * 100)) : 100;

  return (
    <div className="badges-screen">
      {onExit && <button className="landing-back" onClick={onExit}>← Home</button>}

      <div className="badges-title">Badges</div>

      <div className="badges-rankcard">
        <div className="badges-rankcard-gem">
          <Gem
            size={54}
            facetCount={tierInfo.facets}
            colorLight={tierInfo.colors[0]}
            colorMid={tierInfo.colors[1]}
            colorDark={tierInfo.colors[2]}
          />
        </div>
        <div className="badges-rankcard-body">
          <div className="badges-rankcard-name">{progress.label} Rank</div>
          <div className="badges-rankcard-sub">
            {progress.nextLabel
              ? `${progress.weekPoints} / ${weekTotal} stars this week — ${progress.toNext} to ${progress.nextLabel}`
              : "Top rank reached this week — nice!"}
          </div>
          {progress.nextLabel && (
            <div className="badges-rankcard-bar">
              <div className="badges-rankcard-bar-fill" style={{ width: `${barPct}%`, background: tierInfo.colors[1] }} />
            </div>
          )}
        </div>
      </div>

      {progress.weakWeeks >= 1 && progress.prevLabel && (
        <div className="badges-headsup">
          <span className="badges-headsup-ic">💡</span>
          <span>
            Heads up — this week is below {progress.label}&rsquo;s bar. One more week like this
            and you&rsquo;ll settle back to {progress.prevLabel}.
          </span>
        </div>
      )}

      <div className="badges-collection">Your collection · {earnedCount} of {badges.length}</div>

      <div className="badges-grid">
        {badges.map((b) => {
          const visual = BADGE_VISUAL[b.id] || { icon: "star", colors: BADGE_GREY };
          const colors = b.earned ? visual.colors : BADGE_GREY;
          const progressPair = !b.earned && b.progress ? b.progress(stats) : null;
          return (
            <div key={b.id} className={`badges-card ${b.earned ? "earned" : "locked"}`}>
              <Gem
                size={42}
                facetCount={visual.facets || 3}
                colorLight={colors[0]}
                colorMid={colors[1]}
                colorDark={colors[2]}
                icon={visual.icon}
                iconColor={b.earned ? "#ffffff" : "#eef1f4"}
              />
              <div className="badges-card-name">{b.name}</div>
              {b.earned ? (
                <div className="badges-card-status earned">Earned {formatDate(b.earnedDate)}</div>
              ) : progressPair ? (
                <div className="badges-card-status">{progressPair[0]} / {progressPair[1]}</div>
              ) : (
                <div className="badges-card-status">Locked</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
