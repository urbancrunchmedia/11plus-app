import React, { useState, useRef, useEffect } from "react";
import LeaveRoundConfirm from "./LeaveRoundConfirm";
import { fillInBlanksData } from "../data/fillInBlanks";
import GameComplete from "./GameComplete";
import Icon from "./Icon";
import { playCorrect, playWrong } from "../utils/feedback";
import { recordAttempt, selectWithReview } from "../utils/progress";
import { getSetting } from "../utils/leaderboard";
import { addMiss, clearMiss, getMisses } from "../utils/misses";

const SKILL = "fillInBlanks";

function getStars(wrong) { return wrong === 0 ? 3 : wrong === 1 ? 2 : 1; }

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestions(level, totalQuestions, practice) {
  const full = [...(fillInBlanksData.A || []), ...(fillInBlanksData.B || []), ...(fillInBlanksData.C || [])];
  const levelPool = level === "all" ? full : (fillInBlanksData[level] || []);
  // Practice = only the words you've missed; otherwise select by level (with
  // previously-missed words mixed in when the setting is on).
  const base = practice
    ? getMisses(SKILL)
    : selectWithReview(levelPool, totalQuestions, (it) => it.word, SKILL, getSetting("revisitMisses", true));
  const decoyPool = practice ? full : levelPool;
  return base.map((item) => {
    const others = decoyPool.filter((p) => p.word !== item.word);
    const wrong = shuffle(others).slice(0, 3).map((p) => p.word);
    const options = shuffle([item.word, ...wrong]);
    return { word: item.word, sentence: item.sentence, definition: item.definition, options };
  });
}

export default function FillInBlanksGame({ level, totalQuestions = 20, onHome, muted: mutedProp, practice = false }) {
  const [questions, setQuestions] = useState(() => buildQuestions(level, totalQuestions, practice));
  const total = questions.length;
  const [current, setCurrent]       = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [results, setResults]       = useState([]);
  const [totalWrong, setTotalWrong] = useState(0);
  const [streak, setStreak]         = useState(0);
  const [flash, setFlash]           = useState(null); // { idx, type }
  const [gameComplete, setGameComplete] = useState(false);
  const [muted, setMuted]           = useState(mutedProp ?? false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [elapsed, setElapsed]       = useState(0);
  const [startTime, setStartTime] = useState(() => Date.now());

  useEffect(() => {
    if (gameComplete) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(id);
  }, [gameComplete, startTime]);

  function handleAnswer(idx) {
    if (flash !== null) return;
    const q = questions[current];
    const correct = q.options[idx] === q.word;
    const id = q.word.toLowerCase();
    if (correct) {
      recordAttempt({ skill: SKILL, word: q.word, correct: wrongCount === 0, meaning: q.definition });
      if (wrongCount === 0) clearMiss(SKILL, id);
      if (!muted) playCorrect();
      const stars = getStars(wrongCount);
      const newResults = [...results, { word: q.word, match: "", stars }];
      setStreak((v) => (wrongCount === 0 ? v + 1 : 0));
      setFlash({ idx, type: "correct" });
      setTimeout(() => {
        setFlash(null);
        setResults(newResults);
        if (newResults.length >= total) setGameComplete(true);
        else { setCurrent((c) => c + 1); setWrongCount(0); }
      }, 700);
    } else {
      addMiss(SKILL, id, { word: q.word, sentence: q.sentence, definition: q.definition });
      if (!muted) playWrong();
      setWrongCount((w) => w + 1);
      setTotalWrong((w) => w + 1);
      setStreak(0);
      setFlash({ idx, type: "wrong" });
      setTimeout(() => setFlash(null), 500);
    }
  }

  function handlePlayAgain() {
    const next = buildQuestions(level, totalQuestions, practice);
    // In practice mode the queue can be empty once everything's fixed.
    if (!next.length) { onHome(); return; }
    setQuestions(next);
    setStartTime(Date.now());
    setCurrent(0);
    setWrongCount(0);
    setResults([]);
    setTotalWrong(0);
    setStreak(0);
    setFlash(null);
    setElapsed(0);
    setGameComplete(false);
  }

  // "Practice these" on the results screen — replay just this round's misses.
  // `results` has one entry per question in order, so it lines up with `questions`.
  function handlePracticeMisses() {
    const missed = questions.filter((_, i) => results[i]?.stars < 3);
    if (!missed.length) return;
    setQuestions(missed);
    setStartTime(Date.now());
    setCurrent(0);
    setWrongCount(0);
    setResults([]);
    setTotalWrong(0);
    setStreak(0);
    setFlash(null);
    setElapsed(0);
    setGameComplete(false);
  }

  if (gameComplete) {
    return (
      <GameComplete results={results} totalWrong={totalWrong} timeTaken={elapsed}
        onPlayAgain={handlePlayAgain} onPracticeMisses={handlePracticeMisses} onHome={onHome} level={level} gameType="fillInBlanks" totalQuestions={total} />
    );
  }

  const q = questions[current];
  const flashCls = (i) => `${flash?.type === "correct" && flash.idx === i ? "correct" : ""} ${flash?.type === "wrong" && flash.idx === i ? "wrong" : ""}`;
  const parts = q.sentence.split("_____");
  // Reveal the word in the sentence on a correct answer.
  const revealed = flash?.type === "correct";

  function requestExit() {
    if (results.length > 0 || wrongCount > 0) setConfirmLeave(true);
    else onHome();
  }

  return (
    <div className="game-screen">
      {confirmLeave && <LeaveRoundConfirm onLeave={onHome} onStay={() => setConfirmLeave(false)} />}
      <div className="ig-top">
        <button className="ig-back" onClick={requestExit} aria-label="Home">←</button>
        <div className="ig-pips">
          {questions.map((_, i) => <span key={i} className={`ig-pip ${i < results.length ? "done" : ""}`} />)}
        </div>
        <button className="ig-mute" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"}><Icon name={muted ? "bellOff" : "bell"} size={18} stroke="currentColor" strokeWidth={2} /></button>
      </div>

      <div className="ig-hud">
        <div className="ig-card ig-card--combo"><div className="ig-card-val">×{streak}</div><div className="ig-card-lbl">combo</div></div>
        <div className="ig-card"><div className="ig-card-val">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</div><div className="ig-card-lbl">time</div></div>
        <div className="ig-card"><div className="ig-card-val ig-card-val--correct">✓ {results.length}</div><div className="ig-card-lbl">correct</div></div>
        <div className="ig-card"><div className="ig-card-val ig-card-val--wrong">{totalWrong}</div><div className="ig-card-lbl">wrong</div></div>
      </div>

      <div className="play-card">
        <p className="game-instruction">Read the clue and choose the missing word</p>

        <div className="fib-sentence-plain">
          <p className="fib-sentence">
            {parts[0]}
            <span className={`fib-blank ${revealed ? "fib-blank--correct" : "fib-blank--empty"}`}>{revealed ? q.word : "_ _ _ _ _"}</span>
            {parts[1]}
          </p>
          <p className="fib-hint">🔍 Clue: {q.definition}</p>
        </div>

        <div className="cg-grid">
          {q.options.map((opt, i) => (
            <button key={i} className={`cg-opt ${flashCls(i)}`} onClick={() => handleAnswer(i)} disabled={flash !== null}>
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
