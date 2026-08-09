import React, { useState, useRef, useEffect } from "react";
import GameComplete from "./GameComplete";
import { makeCompoundBuildQuestions } from "../utils/worksheet";
import { playCorrect, playWrong } from "../utils/feedback";

const stars = (wrong) => (wrong === 0 ? 3 : wrong === 1 ? 2 : 1);

// Compound Words round (prototype style): show a stem word + four options,
// pick the word that joins on to make a real compound word.
export default function CompoundGame({ level, totalQuestions = 20, onHome }) {
  const build = () => makeCompoundBuildQuestions(level, totalQuestions);
  const [questions, setQuestions] = useState(build);
  const [idx, setIdx]         = useState(0);
  const [wrongCount, setWrong] = useState(0);   // wrong picks on the current question
  const [flash, setFlash]     = useState(null); // index flashing red
  const [justRight, setJustRight] = useState(null); // index flashing correct
  const [results, setResults] = useState([]);
  const [totalWrong, setTotalWrong] = useState(0);
  const [streak, setStreak]   = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted]     = useState(false);
  const [done, setDone]       = useState(false);
  const startRef = useRef(Date.now());
  const locked   = useRef(false);

  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [done]);

  const q = questions[idx];

  function pick(i) {
    if (locked.current || !q) return;
    if (i === q.answer) {
      locked.current = true;
      const s = stars(wrongCount);
      if (!muted) playCorrect();
      setJustRight(i);
      setStreak((v) => (wrongCount === 0 ? v + 1 : 0));
      const newResults = [...results, { word: q.first, match: q.second, stars: s }];
      setResults(newResults);
      setTimeout(() => {
        setJustRight(null);
        setWrong(0);
        locked.current = false;
        if (idx + 1 >= questions.length) setDone(true);
        else setIdx(idx + 1);
      }, 600);
    } else {
      if (!muted) playWrong();
      setWrong((w) => w + 1);
      setTotalWrong((w) => w + 1);
      setStreak(0);
      setFlash(i);
      setTimeout(() => setFlash(null), 500);
    }
  }

  function playAgain() {
    startRef.current = Date.now();
    setQuestions(build());
    setIdx(0); setWrong(0); setFlash(null); setJustRight(null);
    setResults([]); setTotalWrong(0); setStreak(0); setElapsed(0); setDone(false);
    locked.current = false;
  }

  if (done) {
    return (
      <GameComplete
        results={results}
        totalWrong={totalWrong}
        timeTaken={elapsed}
        onPlayAgain={playAgain}
        onHome={onHome}
        level={level}
        gameType="compoundWords"
        totalQuestions={questions.length}
      />
    );
  }

  return (
    <div className="game-screen">
      <div className="ig-top">
        <button className="ig-back" onClick={onHome} aria-label="Home">←</button>
        <div className="ig-pips">
          {questions.map((_, i) => (
            <span key={i} className={`ig-pip ${i < results.length ? "done" : ""}`} />
          ))}
        </div>
        <button className="ig-mute" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"}>{muted ? "🔇" : "🔊"}</button>
      </div>

      <div className="ig-hud">
        <div className="ig-card ig-card--combo"><div className="ig-card-val">×{streak}</div><div className="ig-card-lbl">combo</div></div>
        <div className="ig-card"><div className="ig-card-val">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</div><div className="ig-card-lbl">time</div></div>
        <div className="ig-card"><div className="ig-card-val ig-card-val--correct">✓ {results.length}</div><div className="ig-card-lbl">correct</div></div>
        <div className="ig-card"><div className="ig-card-val ig-card-val--wrong">{totalWrong}</div><div className="ig-card-lbl">wrong</div></div>
      </div>

      <p className="game-instruction">Pick the word that joins on to make a real compound word</p>

      <div className="cg-stem">
        <span className="cg-stem-word">{q.first}</span>
        <span className="cg-plus">+</span>
        <span className="cg-blank">?</span>
      </div>

      <div className="cg-grid">
        {q.options.map((opt, i) => {
          let cls = "cg-opt";
          if (justRight === i) cls += " correct";
          else if (flash === i) cls += " wrong";
          return (
            <button key={i} className={cls} onClick={() => pick(i)} disabled={justRight !== null}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
