import React, { useState, useRef, useEffect } from "react";
import GameComplete from "./GameComplete";
import { playCorrect, playWrong } from "../utils/feedback";

// Worksheet-style game (CGP/GL "two groups of three" format). All questions are
// shown at once; the player picks one word from the left group and one from the
// right group of each question, then presses Check. Correct = 3 stars, so it
// plugs straight into the shared GameComplete / leaderboard.
export default function WorksheetGame({
  level,
  gameType,
  totalQuestions = 5,
  onHome,
  makeQuestions,   // (count) => [{ left, right, answerLeft, answerRight, display }]
  instruction,
  example,         // optional JSX/string shown under the instruction
  typeLabel,
  connector = "→", // shown between the two chosen words in the results screen
}) {
  const [questions, setQuestions] = useState(() => makeQuestions(totalQuestions));
  const [answers, setAnswers]     = useState({}); // qIdx -> { left, right }
  const [checked, setChecked]     = useState(false);
  const [muted, setMuted]         = useState(false);
  const [elapsed, setElapsed]     = useState(0);
  const [done, setDone]           = useState(false);
  const startTimeRef              = useRef(Date.now());

  useEffect(() => {
    if (done) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [done]);

  function pick(qIdx, side, word) {
    if (checked) return;
    setAnswers((prev) => ({ ...prev, [qIdx]: { ...prev[qIdx], [side]: word } }));
  }

  const allAnswered = questions.every((_, i) => answers[i]?.left && answers[i]?.right);

  function isCorrect(i) {
    const a = answers[i];
    return a && a.left === questions[i].answerLeft && a.right === questions[i].answerRight;
  }

  function handleCheck() {
    if (!checked && !allAnswered) return;
    setChecked(true);
    const correct = questions.filter((_, i) => isCorrect(i)).length;
    if (!muted) (correct === questions.length ? playCorrect() : playWrong());
  }

  function handleFinish() {
    setDone(true);
  }

  function handlePlayAgain() {
    startTimeRef.current = Date.now();
    setElapsed(0);
    setQuestions(makeQuestions(totalQuestions));
    setAnswers({});
    setChecked(false);
    setDone(false);
  }

  const correctCount = questions.filter((_, i) => isCorrect(i)).length;
  const wrongCount   = checked ? questions.length - correctCount : 0;

  if (done) {
    const results = questions.map((q, i) => ({
      word:  q.display.word,
      match: q.display.match,
      stars: isCorrect(i) ? 3 : 0,
    }));
    return (
      <GameComplete
        results={results}
        totalWrong={wrongCount}
        timeTaken={elapsed}
        onPlayAgain={handlePlayAgain}
        onHome={onHome}
        level={level}
        gameType={gameType}
        totalQuestions={questions.length}
      />
    );
  }

  return (
    <div className="game-screen">
      <div className="ig-top">
        <button className="ig-back" onClick={onHome} aria-label="Home">←</button>
        <div className="ws-head-title">
          <span className="ws-head-name">{typeLabel}</span>
          {level !== "all" && <span className="ws-head-level">Level {level}</span>}
        </div>
        {checked && <span className="ig-card-val--correct ws-head-stat">✓ {correctCount}</span>}
        {checked && <span className="ig-card-val--wrong ws-head-stat">✗ {wrongCount}</span>}
        <span className="ws-head-time">⏱ {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
        <button className="ig-mute" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      <p className="game-instruction">{instruction}</p>
      {example && <p className="ws-example">{example}</p>}

      <div className="ws-list">
        {questions.map((q, i) => {
          const a        = answers[i] || {};
          const rowState = checked ? (isCorrect(i) ? "correct" : "incorrect") : "";
          return (
            <div key={i} className={`ws-row ${rowState}`}>
              <span className="ws-num">{i + 1}</span>

              <div className="ws-groups">
                <WsGroup
                  words={q.left}
                  chosen={a.left}
                  answer={q.answerLeft}
                  checked={checked}
                  onPick={(w) => pick(i, "left", w)}
                />
                <span className="ws-plus">{connector}</span>
                <WsGroup
                  words={q.right}
                  chosen={a.right}
                  answer={q.answerRight}
                  checked={checked}
                  onPick={(w) => pick(i, "right", w)}
                />
              </div>

              {checked && (
                <span className="ws-mark">{isCorrect(i) ? "✓" : "✗"}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="ws-actions">
        {!checked ? (
          <button className="play-btn" onClick={handleCheck} disabled={!allAnswered}>
            {allAnswered ? "Check Answers" : "Answer every question first"}
          </button>
        ) : (
          <button className="play-btn" onClick={handleFinish}>See Score</button>
        )}
      </div>
    </div>
  );
}

function WsGroup({ words, chosen, answer, checked, onPick }) {
  return (
    <div className="ws-group">
      {words.map((w) => {
        const isChosen  = chosen === w;
        const isAnswer  = w === answer;
        let cls = "ws-word";
        if (checked) {
          if (isAnswer) cls += " correct";                 // always highlight the right answer
          else if (isChosen) cls += " incorrect";          // chosen but wrong
        } else if (isChosen) {
          cls += " selected";
        }
        return (
          <button
            key={w}
            className={cls}
            onClick={() => onPick(w)}
            disabled={checked}
          >
            {w}
          </button>
        );
      })}
    </div>
  );
}
