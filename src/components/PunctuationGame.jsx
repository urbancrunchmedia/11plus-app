import React, { useState, useRef, useEffect } from "react";
import { punctuationData } from "../data/punctuation";
import { punctuationSpot } from "../data/punctuationSpot";
import GameComplete from "./GameComplete";
import { playCorrect, playWrong } from "../utils/feedback";

const ABCD = ["A", "B", "C", "D"];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function getStars(wrong) { return wrong === 0 ? 3 : wrong === 1 ? 2 : 1; }

function prepareQuestions(level, count) {
  const pick = (obj) => (level === "all"
    ? [...(obj.A || []), ...(obj.B || []), ...(obj.C || [])]
    : [...(obj[level] || [])]);

  const fill = pick(punctuationData).map((b) => {
    const correct = b.options[b.answer];
    const opts = shuffle([...b.options]);
    return { kind: b.type === "choice" ? "choice" : "fill", prompt: b.prompt, sentence: b.sentence, options: opts, answer: opts.indexOf(correct) };
  });
  const spot = pick(punctuationSpot).map((b) => ({ kind: "spot", segments: b.segments, answer: b.answer, why: b.why }));

  const pool = shuffle([...fill, ...spot]);
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]);
}

function SentenceDisplay({ sentence }) {
  const parts = sentence.split("___");
  if (parts.length === 1) return <span className="punct-sentence">{sentence}</span>;
  return <span className="punct-sentence">{parts[0]}<span className="punct-blank">___</span>{parts[1]}</span>;
}

export default function PunctuationGame({ level, totalQuestions = 20, onHome, muted: mutedProp }) {
  const questions = useRef(prepareQuestions(level, totalQuestions));
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
    if (idx === q.answer) {
      if (!muted) playCorrect();
      const stars = getStars(wrongCount);
      const label = q.kind === "spot"
        ? q.segments.join(" ")
        : q.kind === "choice"
          ? q.options[q.answer].slice(0, 40)
          : q.sentence.replace("___", q.options[q.answer]);
      const newResults = [...results, { word: label, match: "", stars }];
      setStreak((v) => (wrongCount === 0 ? v + 1 : 0));
      setFlash({ idx, type: "correct" });
      setTimeout(() => {
        setFlash(null);
        setResults(newResults);
        if (newResults.length >= totalQuestions) setGameComplete(true);
        else { setCurrent((c) => c + 1); setWrongCount(0); }
      }, 600);
    } else {
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
        onPlayAgain={onHome} onHome={onHome} level={level} gameType="punctuation" totalQuestions={totalQuestions} />
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
        <button className="ig-mute" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"}>{muted ? "🔇" : "🔊"}</button>
      </div>

      <div className="ig-hud">
        <div className="ig-card ig-card--combo"><div className="ig-card-val">×{streak}</div><div className="ig-card-lbl">combo</div></div>
        <div className="ig-card"><div className="ig-card-val">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</div><div className="ig-card-lbl">time</div></div>
        <div className="ig-card"><div className="ig-card-val ig-card-val--correct">✓ {results.length}</div><div className="ig-card-lbl">correct</div></div>
        <div className="ig-card"><div className="ig-card-val ig-card-val--wrong">{totalWrong}</div><div className="ig-card-lbl">wrong</div></div>
      </div>

      <div className="punct-game">
        {q.kind === "spot" ? (
          <>
            <p className="punct-prompt">Which section has the punctuation mistake?</p>
            <div className="punct-segs">
              {q.segments.map((seg, i) => (
                <button key={i} className={`punct-seg ${flashCls(i)}`} onClick={() => handleAnswer(i)} disabled={flash !== null}>
                  <span className="punct-seg-text">{seg}</span>
                  <span className="punct-seg-letter">{ABCD[i]}</span>
                </button>
              ))}
            </div>
            <button className={`punct-nomistake ${flashCls(4)}`} onClick={() => handleAnswer(4)} disabled={flash !== null}>
              N · No mistake
            </button>
          </>
        ) : (
          <>
            <p className="punct-prompt">{q.kind === "choice" ? q.prompt : "Choose the correct punctuation for the blank"}</p>
            {q.kind !== "choice" && <div className="punct-sentence-box"><SentenceDisplay sentence={q.sentence} /></div>}
            <div className={`punct-options ${q.kind === "choice" ? "punct-options--choice" : ""}`}>
              {q.options.map((opt, i) => (
                <button key={i} className={`punct-opt ${flashCls(i)}`} onClick={() => handleAnswer(i)} disabled={flash !== null}>{opt}</button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
