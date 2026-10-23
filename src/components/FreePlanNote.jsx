import React from "react";
import { usePremium } from "../contexts/PremiumContext";
import { starterLimit, tasterLeftToday, roundsLeftToday, dailyRoundLimit } from "../utils/entitlement";

// Shown under a game's setup card for free players: what the free plan covers
// in this game, what's left today, and a way to unlock the rest. Hidden for
// Full Access.
export default function FreePlanNote({ game }) {
  const { isPremium, openPaywall } = usePremium();
  if (isPremium) return null;
  const limit = starterLimit(game);
  const unit = game === "punctuation" || game === "spelling" || game === "wordClass" ? "questions" : "words";
  const levelled = game !== "fillInBlanks";
  const rounds = roundsLeftToday();
  return (
    <div className="free-note">
      <div className="free-note-txt">
        <div className="free-note-title">Free plan</div>
        <ul className="free-note-list">
          <li>{limit ? `Starter set: ${limit} Level A ${unit}` : levelled ? "All of Level A" : "Every word"}</li>
          {levelled && <li>{tasterLeftToday() > 0 ? "1 free round of Level B or C today" : "Today's Level B or C taster is used"}</li>}
          <li>{rounds} of {dailyRoundLimit()} rounds left today</li>
        </ul>
      </div>
      <button className="free-note-btn" onClick={() => openPaywall("starter")}>Unlock all words</button>
    </div>
  );
}
