import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

// Sound needs a real AudioContext, and the cloud push needs Firebase: stub both
// so these stay pure render tests of the screens themselves.
vi.mock("../utils/feedback", () => ({ playCorrect: vi.fn(), playWrong: vi.fn() }));
vi.mock("../utils/cloudScores", () => ({ pushToCloud: vi.fn(async () => {}) }));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { uid: "u1", displayName: "Ava" } }),
}));

import GameScreen from "./GameScreen";
import CompoundGame from "./CompoundGame";
import WorksheetGame from "./WorksheetGame";
import FillInBlanksGame from "./FillInBlanksGame";
import PunctuationGame from "./PunctuationGame";
import SpellingGame from "./SpellingGame";
import WordClassGame from "./WordClassGame";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mount(node) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => { createRoot(container).render(node); });
  return container;
}

const worksheetQuestions = (count) =>
  Array.from({ length: count }, (_, i) => ({
    left: [`a${i}`, `b${i}`], right: [`c${i}`, `d${i}`],
    answerLeft: `a${i}`, answerRight: `c${i}`, display: `a${i} c${i}`,
  }));

// Every playable screen, with the props App.jsx actually hands it.
const SCREENS = [
  ["Word Match",     () => <GameScreen level="A" gameType="synonyms" totalQuestions={5} onHome={() => {}} />],
  ["Compound Words", () => <CompoundGame level="A" totalQuestions={5} onHome={() => {}} />],
  ["Worksheet",      () => <WorksheetGame level="A" gameType="wordMatch" totalQuestions={3} onHome={() => {}} makeQuestions={worksheetQuestions} instruction="Match them up" typeLabel="Synonyms" />],
  ["Word Detective", () => <FillInBlanksGame level="A" totalQuestions={5} onHome={() => {}} />],
  ["Punctuation",    () => <PunctuationGame level="A" totalQuestions={5} onHome={() => {}} />],
  ["Spelling",       () => <SpellingGame level="A" totalQuestions={5} onHome={() => {}} />],
];

describe("game screens", () => {
  beforeEach(() => { document.body.innerHTML = ""; localStorage.clear(); });

  it.each(SCREENS)("%s mounts and shows a round", async (_name, render) => {
    const el = await mount(render());
    expect(el.querySelector(".game-screen")).toBeTruthy();
    expect(el.querySelector(".ig-back")).toBeTruthy();
  });

  // Regression guard for the leave-round confirm added across all six games:
  // leaving before you've answered anything should not stop to ask.
  it.each(SCREENS)("%s exits straight home when no progress is at stake", async (_name, render) => {
    const onHome = vi.fn();
    const el = await mount(React.cloneElement(render(), { onHome }));
    await act(async () => { el.querySelector(".ig-back").click(); });
    expect(onHome).toHaveBeenCalled();
    expect(document.querySelector(".set-sheet-title")).toBeNull();
  });

  // Found while writing these: an empty word list used to index into nothing and
  // throw, taking the screen to the error boundary.
  it("leaves quietly when there is no round to build", async () => {
    const onHome = vi.fn();
    const el = await mount(<GameScreen level="A" gameType="synonyms" pairs={[]} totalQuestions={5} onHome={onHome} />);
    expect(onHome).toHaveBeenCalled();
    expect(el.querySelector(".game-screen")).toBeNull();
  });

  // The question list moved from a ref into state; "Play again" has to rebuild
  // a real round rather than leaving the results on screen.
  it("Punctuation replays a fresh round from the results screen", async () => {
    const onHome = vi.fn();
    const el = await mount(<PunctuationGame level="A" totalQuestions={2} onHome={onHome} />);

    for (let i = 0; i < 2; i++) {
      await act(async () => { el.querySelector(".spot-ans").click(); });      // answer
      await act(async () => { el.querySelector(".spot-next").click(); });     // next / see results
    }
    expect(el.querySelector(".gc-again")).toBeTruthy();      // results screen
    expect(el.querySelector(".game-screen")).toBeNull();

    await act(async () => { el.querySelector(".gc-again").click(); });
    expect(el.querySelector(".game-screen")).toBeTruthy();   // playing again
    expect(el.querySelectorAll(".ig-pip.done").length).toBe(0);
    expect(onHome).not.toHaveBeenCalled();
  });
});

// Regression (Sentry, Safari): "Practise my misses" with no misses left built
// a round of zero questions, and the game crashed reading question 1
// ("undefined is not an object (evaluating 'P.first')").
describe("practice with nothing left to practise", () => {
  beforeEach(() => { document.body.innerHTML = ""; localStorage.clear(); });
  const PRACTICE = [
    ["Compound Words", (onHome) => <CompoundGame level="A" practice onHome={onHome} />],
    ["Word Detective", (onHome) => <FillInBlanksGame level="A" practice onHome={onHome} />],
    ["Punctuation", (onHome) => <PunctuationGame level="A" practice onHome={onHome} />],
    ["Spelling", (onHome) => <SpellingGame level="A" practice onHome={onHome} />],
    ["Parts of Speech", (onHome) => <WordClassGame level="A" practice onHome={onHome} />],
  ];
  for (const [name, make] of PRACTICE) {
    it(`${name} shows a friendly screen instead of crashing`, async () => {
      const onHome = vi.fn();
      const el = await mount(make(onHome));
      const empty = el.querySelector("[data-testid=nothing-to-practise]");
      expect(empty).toBeTruthy();
      await act(async () => { empty.querySelector("button").click(); });
      expect(onHome).toHaveBeenCalled();
    });
  }
});
