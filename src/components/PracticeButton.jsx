import React from "react";
import { missCount } from "../utils/misses";
import Icon from "./Icon";

// Shown inside the start banner on every game landing: replays only the
// questions the child has missed, looping each until it's answered correctly.
// Hidden rather than disabled when there's nothing to review — a button that
// can never be pressed is just clutter.
export default function PracticeButton({ skill, onPractice }) {
  const n = missCount(skill);
  if (!n) return null;
  return (
    <button className="landing-practice" onClick={onPractice}>
      <Icon name="refresh" size={16} stroke="currentColor" strokeWidth={2.1} />
      <span>Practice <b>{n}</b> to fix</span>
    </button>
  );
}
