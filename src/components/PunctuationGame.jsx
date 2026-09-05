import React, { useState, useRef, useEffect } from "react";
import { punctuationSpot } from "../data/punctuationSpot";
import GameComplete from "./GameComplete";
import Icon from "./Icon";
import { playCorrect, playWrong } from "../utils/feedback";
import { recordAttempt } from "../utils/progress";
import { addMiss, clearMiss, getMisses } from "../utils/misses";
import SpotSentence from "./SpotSentence";

const SKILL = "punctuation";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function getStars(wrong) { return wrong === 0 ? 3 : wrong === 1 ? 2 : 1; }

function prepareQuestions(level, count, practice) {
  if (practice) return getMisses(SKILL).map((b) => ({ segments: b.segments, answer: b.answer, why: b.why }));
  const pick = (obj) => (level === "all"
    ? [...(obj.A || []), ...(obj.B || []), ...(obj.C || [])]
    : [...(obj[level] || [])]);
  // Every question is "spot the mistake": the child finds which section has the
  // punctuation/capital-letter error (A–D) or picks N for no mistake.
  const spot = pick(punctuationSpot).map((b) => ({ segments: b.segments, answer: b.answer, why: b.why }));
  const pool = shuffle(spot);
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]);
}

export default function PunctuationGame({ level, totalQuestions = 20, onHome, muted: mutedProp, practice = false }) {
  const questions = useRef(prepareQuestions(level, totalQuestions, practice));
  const total = questions.current.length;
  const [current, setCurrent]       = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [results, setResults]       = useState([]);
  const [totalWrong, setTotalWrong] = useState(0);
  const [streak, setStreak]         = useState(0);
  const [flash, setFlash]           = useState(null); // { idx, type }
  const [gameComplete, setGameComplete] = useState(false);
  const [muted, setMuted]           = useState(mutedProp ?? false);
  const [elapsed, setElapsed]       = useState(0);
  const startTimeRef                = useRef(Date.now());

  useEffect(() => {
    if (gameComplete) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [gameComplete]);

  function handleAnswer(idx) {
    if (flash !== null) return;
    const q = questions.current[current];
    const id = q.segments.join("|");
    if (idx === q.answer) {
      recordAttempt({ skill: SKILL, correct: wrongCount === 0 });
      if (wrongCount === 0) clearMiss(SKILL, id);
      if (!muted) playCorrect();
      const stars = getStars(wrongCount);
      const newResults = [...results, { word: q.segments.join(" "), match: "", stars }];
      setStreak((v) => (wrongCount === 0 ? v + 1 : 0));
      setFlash({ idx, type: "correct" });
      setTimeout(() => {
        setFlash(null);
        setResults(newResults);
        if (newResults.length >= total) setGameComplete(true);
        else { setCurrent((c) => c + 1); setWrongCount(0); }
      }, 600);
    } else {
      addMiss(SKILL, id, { segments: q.segments, answer: q.answer, why: q.why });
      if (!muted) playWrong();
      setWrongCount((w) => w + 1);
      setTotalWrong((w) => w + 1);
      setStreak(0);
      setFlash({ idx, type: "wrong" });
      setTimeout(() => setFlash(null), 500);
    }
  }

  if (gameComplete) {
    return (
      <GameComplete results={results} totalWrong={totalWrong} timeTaken={elapsed}
        onPlayAgain={onHome} onHome={onHome} level={level} gameType="punctuation" totalQuestions={total} />
    );
  }

  const q = questions.current[current];
  const flashCls = (i) => `${flash?.type === "correct" && flash.idx === i ? "correct" : ""} ${flash?.type === "wrong" && flash.idx === i ? "wrong" : ""}`;

  return (
    <div className="game-screen">
      <div className="ig-top">
        <button className="ig-back" onClick={onHome} aria-label="Home">←</button>
        <div className="ig-pips">
          {questions.current.map((_, i) => <span key={i} className={`ig-pip ${i < results.length ? "done" : ""}`} />)}
        </div>
        <button className="ig-mute" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"}><Icon name={muted ? "volumeOff" : "volumeOn"} size={18} stroke="currentColor" strokeWidth={2} /></button>
      </div>

      <div className="ig-hud">
        <div className="ig-card ig-card--combo"><div className="ig-card-val">×{streak}</div><div className="ig-card-lbl">combo</div></div>
        <div className="ig-card"><div className="ig-card-val">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</div><div className="ig-card-lbl">time</div></div>
        <div className="ig-card"><div className="ig-card-val ig-card-val--correct">✓ {results.length}</div><div className="ig-card-lbl">correct</div></div>
        <div className="ig-card"><div className="ig-card-val ig-card-val--wrong">{totalWrong}</div><div className="ig-card-lbl">wrong</div></div>
      </div>

      <div className="punct-game play-card">
        <p className="punct-prompt">Which section has the mistake?</p>
        <SpotSentence segments={q.segments} classFor={flashCls} onPick={handleAnswer} disabled={flash !== null} />
      </div>
    </div>
  );
}
