import React, { useState, useRef, useEffect } from "react";
import { punctuationData } from "../data/punctuation";
import GameComplete from "./GameComplete";
import { playCorrect, playWrong } from "../utils/feedback";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function prepareQuestions(level, count) {
  const pool = level === "all"
    ? [...punctuationData.A, ...punctuationData.B, ...punctuationData.C]
    : [...punctuationData[level]];
  shuffle(pool);
  return Array.from({ length: count }, (_, i) => {
    const base = pool[i % pool.length];
    const correct = base.options[base.answer];
    const opts = shuffle([...base.options]);
    return { ...base, options: opts, answer: opts.indexOf(correct) };
  });
}

function getStars(wrong) {
  if (wrong === 0) return 3;
  if (wrong === 1) return 2;
  return 1;
}

function SentenceDisplay({ sentence }) {
  const parts = sentence.split("___");
  if (parts.length === 1) return <span className="punct-sentence">{sentence}</span>;
  return (
    <span className="punct-sentence">
      {parts[0]}<span className="punct-blank">___</span>{parts[1]}
    </span>
  );
}

export default function PunctuationGame({ level, totalQuestions = 20, onHome, muted: mutedProp }) {
  const questions = useRef(prepareQuestions(level, totalQuestions));

  const [current, setCurrent]     = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [results, setResults]     = useState([]);
  const [totalWrong, setTotalWrong] = useState(0);
  const [flash, setFlash]         = useState(null); // { idx, type: "correct"|"wrong" }
  const [gameComplete, setGameComplete] = useState(false);
  const [muted, setMuted]         = useState(mutedProp ?? false);
  const [elapsed, setElapsed]     = useState(0);
  const startTimeRef              = useRef(Date.now());

  useEffect(() => {
    if (gameComplete) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [gameComplete]);

  function handlePlayAgain() {
    onHome();
  }

  function handleAnswer(idx) {
    if (flash !== null) return;
    const q = questions.current[current];
    const correct = idx === q.answer;

    if (correct) {
      if (!muted) playCorrect();
      const stars = getStars(wrongCount);
      const label = q.type === "choice"
        ? q.options[q.answer].slice(0, 40) + (q.options[q.answer].length > 40 ? "…" : "")
        : q.sentence.replace("___", q.options[q.answer]);

      const newResults = [...results, { word: label, match: "", stars }];
      setFlash({ idx, type: "correct" });

      setTimeout(() => {
        setFlash(null);
        if (newResults.length >= totalQuestions) {
          setResults(newResults);
          setGameComplete(true);
        } else {
          setResults(newResults);
          setCurrent((c) => c + 1);
          setWrongCount(0);
        }
      }, 600);
    } else {
      if (!muted) playWrong();
      setWrongCount((w) => w + 1);
      setTotalWrong((w) => w + 1);
      setFlash({ idx, type: "wrong" });
      setTimeout(() => setFlash(null), 500);
    }
  }

  if (gameComplete) {
    return (
      <GameComplete
        results={results}
        totalWrong={totalWrong}
        timeTaken={elapsed}
        onPlayAgain={handlePlayAgain}
        onHome={onHome}
        level={level}
        gameType="punctuation"
        totalQuestions={totalQuestions}
      />
    );
  }

  const q        = questions.current[current];
  const progress = (results.length / totalQuestions) * 100;

  return (
    <div className="game-screen">
      <div className="game-header">
        <button className="back-btn" onClick={onHome}>← Home</button>
        <span className="type-badge">✏️ Punctuation</span>
        <span className="correct-badge">✓ {results.length}</span>
        <span className="wrong-badge">✗ {totalWrong}</span>
        <span className="timer-badge">⏱ {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
        <button className="mute-btn" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      <div className="progress-wrap">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="punct-game">
        <p className="punct-prompt">
          {q.type === "choice" ? q.prompt : "Choose the correct punctuation for the blank:"}
        </p>

        {q.type !== "choice" && (
          <div className="punct-sentence-box">
            <SentenceDisplay sentence={q.sentence} />
          </div>
        )}

        <div className={`punct-options ${q.type === "choice" ? "punct-options--choice" : ""}`}>
          {q.options.map((opt, i) => {
            const isCorrectFlash = flash?.type === "correct" && flash.idx === i;
            const isWrongFlash   = flash?.type === "wrong"   && flash.idx === i;
            return (
              <button
                key={i}
                className={`punct-opt ${isCorrectFlash ? "correct" : ""} ${isWrongFlash ? "wrong" : ""}`}
                onClick={() => handleAnswer(i)}
                disabled={flash !== null}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
