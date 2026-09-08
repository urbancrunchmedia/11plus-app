import React, { useState, useRef, useEffect } from "react";
import LeaveRoundConfirm from "./LeaveRoundConfirm";
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

function prepareQuestions(level, count, practice) {
  if (practice) return getMisses(SKILL).map((b) => ({ segments: b.segments, answer: b.answer, why: b.why }));
  const pick = (obj) => (level === "all"
    ? [...(obj.A || []), ...(obj.B || []), ...(obj.C || [])]
    : [...(obj[level] || [])]);
  const spot = pick(punctuationSpot).map((b) => ({ segments: b.segments, answer: b.answer, why: b.why }));
  const pool = shuffle(spot);
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]);
}

export default function PunctuationGame({ level, totalQuestions = 20, onHome, muted: mutedProp, practice = false }) {
  const [questions, setQuestions] = useState(() => prepareQuestions(level, totalQuestions, practice));
  const total = questions.length;
  const [current, setCurrent]       = useState(0);
  const [answered, setAnswered]     = useState(null); // chosen index, or null
  const [results, setResults]       = useState([]);
  const [totalWrong, setTotalWrong] = useState(0);
  const [correctCount, setCorrect]  = useState(0);
  const [streak, setStreak]         = useState(0);
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

  const q = questions[current];
  const isLast    = current >= total - 1;
  const isCorrect = answered !== null && answered === q.answer;

  function handleAnswer(idx) {
    if (answered !== null) return; // one shot — locked after the first answer
    const correct = idx === q.answer;
    const id = q.segments.join("|");
    setAnswered(idx);
    recordAttempt({ skill: SKILL, correct });
    if (correct) {
      if (!muted) playCorrect();
      clearMiss(SKILL, id);
      setStreak((v) => v + 1);
      setCorrect((c) => c + 1);
    } else {
      if (!muted) playWrong();
      addMiss(SKILL, id, { segments: q.segments, answer: q.answer, why: q.why });
      setStreak(0);
      setTotalWrong((w) => w + 1);
    }
    setResults((r) => [...r, { word: q.segments.join(" "), match: "", stars: correct ? 3 : 0 }]);
  }

  function handleNext() {
    if (isLast) setGameComplete(true);
    else { setCurrent((c) => c + 1); setAnswered(null); }
  }

  function handlePlayAgain() {
    const next = prepareQuestions(level, totalQuestions, practice);
    // In practice mode the queue can be empty once everything's fixed.
    if (!next.length) { onHome(); return; }
    setQuestions(next);
    setStartTime(Date.now());
    setCurrent(0);
    setAnswered(null);
    setResults([]);
    setTotalWrong(0);
    setCorrect(0);
    setStreak(0);
    setElapsed(0);
    setGameComplete(false);
  }

  if (gameComplete) {
    return (
      <GameComplete results={results} totalWrong={totalWrong} timeTaken={elapsed}
        onPlayAgain={handlePlayAgain} onHome={onHome} level={level} gameType="punctuation" totalQuestions={total} />
    );
  }

  const classFor = (i) => (answered === null ? "" : i === q.answer ? "correct" : i === answered ? "wrong" : "");

  function requestExit() {
    if (results.length > 0) setConfirmLeave(true);
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
        <button className="ig-mute" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"}><Icon name={muted ? "volumeOff" : "volumeOn"} size={18} stroke="currentColor" strokeWidth={2} /></button>
      </div>

      <div className="ig-hud">
        <div className="ig-card ig-card--combo"><div className="ig-card-val">×{streak}</div><div className="ig-card-lbl">combo</div></div>
        <div className="ig-card"><div className="ig-card-val">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</div><div className="ig-card-lbl">time</div></div>
        <div className="ig-card"><div className="ig-card-val ig-card-val--correct">✓ {correctCount}</div><div className="ig-card-lbl">correct</div></div>
        <div className="ig-card"><div className="ig-card-val ig-card-val--wrong">{totalWrong}</div><div className="ig-card-lbl">wrong</div></div>
      </div>

      <div className="punct-game play-card">
        <p className="punct-prompt">Which section has the mistake?</p>
        <SpotSentence segments={q.segments} classFor={classFor} onPick={handleAnswer} disabled={answered !== null} />

        {answered !== null && (
          <div className="spot-feedback">
            <div className={`spot-fb-verdict ${isCorrect ? "ok" : "no"}`}>{isCorrect ? "Correct!" : "Not quite."}</div>
            <div className="spot-fb-why">{q.why}</div>
            <button className="spot-next" onClick={handleNext}>{isLast ? "See results" : "Next"} →</button>
          </div>
        )}
      </div>
    </div>
  );
}
