import React from "react";
import { missCount } from "../utils/misses";
import Icon from "./Icon";

// Shown inside the start banner on every game landing: replays only the
// questions the child has missed, looping each until it's answered correctly.
// Disabled when there are none left.
export default function PracticeButton({ skill, onPractice }) {
  const n = missCount(skill);
  return (
    <button className="landing-practice" disabled={!n} onClick={() => n && onPractice()}>
      <Icon name="refresh" size={16} stroke="currentColor" strokeWidth={2.1} />
      {n ? <span>Practice <b>{n}</b> to fix</span> : <span>Nothing to practice</span>}
    </button>
  );
}
