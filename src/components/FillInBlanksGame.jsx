import React, { useState, useEffect, useRef, useCallback } from "react";
import { fillInBlanksData } from "../data/fillInBlanks";
import { saveRun, saveIfBest } from "../utils/leaderboard";
import { pushToCloud } from "../utils/cloudScores";
import { useAuth } from "../contexts/AuthContext";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function buildQuestions(level, totalQuestions) {
  const pool = level === "all"
    ? [...(fillInBlanksData.A || []), ...(fillInBlanksData.B || []), ...(fillInBlanksData.C || [])]
    : (fillInBlanksData[level] || []);
  const selected = shuffle(pool).slice(0, totalQuestions);

  return selected.map((item) => {
    // Pick 3 wrong options from the rest of the pool
    const others = pool.filter((p) => p.word !== item.word);
    const wrong = shuffle(others).slice(0, 3).map((p) => p.word);
    const options = shuffle([item.word, ...wrong]);
    return { ...item, options };
  });
}

export default function FillInBlanksGame({ level, totalQuestions, onHome }) {
  const { user } = useAuth();
  const [questions, setQuestions]     = useState(() => buildQuestions(level, totalQuestions));
  const [current, setCurrent]         = useState(0);
  const [correct, setCorrect]         = useState(0);
  const [wrong, setWrong]             = useState(0);
  const [chosen, setChosen]           = useState(null);   // word user clicked
  const [elapsed, setElapsed]         = useState(0);
  const [done, setDone]               = useState(false);

  const timerRef = useRef(null);

  // Save the run to the leaderboard. Each correct answer = 3 stars (first-try
  // perfect, no retry), matching the other games' stars-out-of-N*3 convention.
  function recordScore(correctCount, wrongCount, time) {
    const stars = correctCount * 3;
    saveRun(level, "fillInBlanks", totalQuestions, stars, wrongCount, time, user?.displayName);
    saveIfBest(level, "fillInBlanks", totalQuestions, stars, wrongCount, time);
    if (user) pushToCloud(user.uid);
  }

  // Start/restart timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const handleChoice = useCallback(
    (word) => {
      if (chosen !== null) return; // already answered
      setChosen(word);

      const isCorrect = word === questions[current].word;
      if (isCorrect) setCorrect((c) => c + 1);
      else setWrong((w) => w + 1);
    },
    [chosen, current, questions]
  );

  function handleNext() {
    const next = current + 1;
    if (next >= questions.length) {
      clearInterval(timerRef.current);
      recordScore(correct, wrong, elapsed);
      setDone(true);
    } else {
      setCurrent(next);
      setChosen(null);
    }
  }

  function handlePlayAgain() {
    setQuestions(buildQuestions(level, totalQuestions));
    setCurrent(0);
    setCorrect(0);
    setWrong(0);
    setChosen(null);
    setElapsed(0);
    setDone(false);

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
  }

  // ── Results screen ─────────────────────────────────────────────────────────
  if (done) {
    const total     = questions.length;
    const pct       = (correct / total) * 100;
    const stars     = wrong === 0 ? 3 : wrong <= 2 ? 2 : 1;
    const emoji     = pct > 70 ? "🎉" : pct > 40 ? "😊" : "😅";
    const title     = pct > 70 ? "Well Done!" : pct > 40 ? "Good Try!" : "Keep Practising!";
    const subtitle  = pct > 70 ? "Fantastic vocabulary skills!" : pct > 40 ? "You're getting there — keep going!" : "Every mistake helps you learn!";

    return (
      <div className="result-screen">
        <div className="result-card">
          <div className="result-emoji">{emoji}</div>
          <h2 className="result-title">{title}</h2>
          <p className="result-subtitle">{subtitle}</p>

          <div className="stars">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className="star"
                style={{
                  animationDelay: `${(s - 1) * 0.12}s`,
                  filter: s <= stars ? "none" : "grayscale(1) opacity(0.3)",
                }}
              >
                ⭐
              </span>
            ))}
          </div>

          <div className="result-stats">
            <div className="stat">
              <span className="stat-value" style={{ color: "var(--correct)" }}>{correct}</span>
              <span className="stat-label">Correct</span>
            </div>
            <div className="stat">
              <span className="stat-value" style={{ color: "var(--wrong)" }}>{wrong}</span>
              <span className="stat-label">Wrong</span>
            </div>
            <div className="stat">
              <span className="stat-value">{formatTime(elapsed)}</span>
              <span className="stat-label">Time</span>
            </div>
          </div>

          <div className="result-buttons">
            <button className="play-btn" onClick={handlePlayAgain}>
              Play Again
            </button>
            <button className="secondary-btn" onClick={onHome}>
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Game screen ────────────────────────────────────────────────────────────
  const q        = questions[current];
  const answered = chosen !== null;
  const isRight  = chosen === q.word;
  const isLast   = current === questions.length - 1;
  const progress = (current / questions.length) * 100;

  // Build sentence display: replace _____ with a styled span.
  // After answering we always show the CORRECT word so the child reads the
  // complete, correct sentence — the key learning moment.
  const parts = q.sentence.split("_____");
  const blankClass = !answered
    ? "fib-blank fib-blank--empty"
    : "fib-blank fib-blank--correct";
  const blankText = !answered ? "_ _ _ _ _" : q.word;

  return (
    <div className="game-screen">
      {/* Header */}
      <div className="game-header">
        <button className="back-btn" onClick={onHome}>Home</button>
        <span className="type-badge">🕵️ Word Detective</span>
        <span className="correct-badge">✓ {correct}</span>
        <span className="wrong-badge">✗ {wrong}</span>
        <span className="timer-badge">⏱ {formatTime(elapsed)}</span>
      </div>

      {/* Progress */}
      <div className="progress-wrap">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Sentence card */}
      <div className="fib-sentence-card">
        <p className="fib-sentence">
          {parts[0]}
          <span className={blankClass}>{blankText}</span>
          {parts[1]}
        </p>
        <p className="fib-hint">🔍 Clue: {q.definition}</p>
      </div>

      {/* Options — stay on the page; turn green/red after answering */}
      <div className="fib-options">
        {q.options.map((opt) => {
          let cls = "fib-option";
          if (answered) {
            if (opt === q.word) cls += " correct";
            else if (opt === chosen) cls += " wrong";
          }
          return (
            <button
              key={opt}
              className={cls}
              onClick={() => handleChoice(opt)}
              disabled={answered}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {/* Inline feedback bar — same page, no popup */}
      {answered && (
        <div className={`fib-feedback ${isRight ? "fib-feedback--correct" : "fib-feedback--wrong"}`}>
          <span className="fib-feedback-text">
            {isRight ? "✓ Correct!" : `✗ The answer is “${q.word}”`}
          </span>
          <button
            className="fib-speak"
            onClick={() => speak(q.word)}
            aria-label={`Hear the word ${q.word}`}
          >
            🔊
          </button>
          <button className="fib-next-btn" onClick={handleNext}>
            {isLast ? "See Results" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}

function speak(word) {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = "en-GB";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch (e) {
    /* speech not supported — silently ignore */
  }
}
