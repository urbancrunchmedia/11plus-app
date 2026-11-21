import React from "react";

// Shown instead of a game round when there's nothing to play: e.g. "Practise
// my misses" opened after those words were already got right (in another
// round or tab). Without this the game would try to show question 1 of 0.
export default function NothingToPractise({ onHome }) {
  return (
    <div className="game-screen">
      <div className="play-card game-empty" data-testid="nothing-to-practise">
        <div className="game-empty-icon" aria-hidden="true">🎉</div>
        <div className="board-empty-title">Nothing to practise right now</div>
        <p className="game-empty-sub">You've already got all your tricky words right here. Play a normal round to find new ones.</p>
        <button className="set-sheet-confirm" onClick={onHome}>Back</button>
      </div>
    </div>
  );
}
