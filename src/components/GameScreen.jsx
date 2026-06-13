import React, { useState, useRef, useEffect } from "react";
import { wordData } from "../data/words";
import { bookletWordData } from "../data/bookletWords";
import GameComplete from "./GameComplete";
import { playCorrect, playWrong } from "../utils/feedback";

const BOARD_SIZE = 5;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getStars(wrongCount) {
  if (wrongCount === 0) return 3;
  if (wrongCount === 1) return 2;
  return 1;
}

// Weak words (low stars) come first
function buildPrioritisedList(allPairs, performance) {
  const t1 = shuffle(allPairs.filter((p) => performance[p.word] === 1));
  const t2 = shuffle(allPairs.filter((p) => performance[p.word] === 2));
  const t3 = shuffle(allPairs.filter((p) => !performance[p.word] || performance[p.word] >= 3));
  return [...t1, ...t2, ...t3];
}

let _uid = 0;
function makeItem(pair) {
  return { uid: _uid++, word: pair.word, match: pair.match, wrongCount: 0 };
}

export default function GameScreen({ level, gameType, totalQuestions = 20, onHome }) {
  const allPairs = [
    ...(wordData[level]?.[gameType] ?? []),
    ...(bookletWordData[level]?.[gameType] ?? []),
  ];
  const performance  = useRef({});  // word → last stars, persists across replays

  function buildGame() {
    const list = buildPrioritisedList(allPairs, performance.current);
    // Cycle list if fewer words than totalQuestions
    const full = Array.from({ length: totalQuestions }, (_, i) => list[i % list.length]);
    return {
      board:      full.slice(0, BOARD_SIZE).map(makeItem),
      queue:      full.slice(BOARD_SIZE),          // 14 pairs waiting
      rightOrder: shuffle([0, 1, 2, 3, 4]),          // independent right-column order
    };
  }

  const [game, setGame]               = useState(() => buildGame());
  const [results, setResults]         = useState([]);
  const [selectedLeft, setSelectedLeft] = useState(null);   // item uid
  const [justMatched, setJustMatched] = useState(null);     // { uid, rightIdx, stars }
  const [wrongFlash, setWrongFlash]   = useState(null);     // { leftIdx, rightIdx }
  const [streak, setStreak]           = useState(0);
  const [totalWrong, setTotalWrong]   = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [muted, setMuted]             = useState(false);
  const [elapsed, setElapsed]         = useState(0);
  const startTimeRef                  = useRef(Date.now());

  useEffect(() => {
    if (gameComplete) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [gameComplete]);

  const { board, queue, rightOrder } = game;

  function handleLeftTap(leftIdx) {
    if (wrongFlash !== null) return;
    if (justMatched?.uid === board[leftIdx]?.uid) return; // can't tap the one currently animating
    setSelectedLeft(board[leftIdx].uid);
  }

  function handleRightTap(rightIdx) {
    if (selectedLeft === null || justMatched !== null || wrongFlash !== null) return;

    const leftIdx = board.findIndex((b) => b.uid === selectedLeft);
    if (leftIdx === -1) return;

    const boardIdxForRight = rightOrder[rightIdx];
    const isCorrect       = leftIdx === boardIdxForRight;

    if (isCorrect) {
      const item      = board[leftIdx];
      const stars     = getStars(item.wrongCount);
      const newResult = { word: item.word, match: item.match, stars };
      const newResults = [...results, newResult];
      const newStreak = item.wrongCount === 0 ? streak + 1 : 0;

      performance.current[item.word] = stars;
      if (!muted) playCorrect();
      setResults(newResults);
      setStreak(newStreak);
      setSelectedLeft(null);
      setJustMatched({ uid: item.uid, rightIdx, stars });

      setTimeout(() => {
        if (newResults.length >= totalQuestions) {
          setGameComplete(true);
          setJustMatched(null);
          return;
        }

        if (queue.length > 0) {
          // Replace matched slot with next from queue
          const nextPair = queue[0];
          const newBoard = board.map((slot, i) =>
            i === leftIdx ? makeItem(nextPair) : slot
          );
          setGame({ board: newBoard, queue: queue.slice(1), rightOrder });
        } else {
          // Queue exhausted — shrink the board for the final matches
          const newBoard      = board.filter((_, i) => i !== leftIdx);
          const newRightOrder = rightOrder
            .filter((idx) => idx !== leftIdx)
            .map((idx) => (idx > leftIdx ? idx - 1 : idx));
          setGame({ board: newBoard, queue: [], rightOrder: newRightOrder });
        }

        setJustMatched(null);
      }, 700);

    } else {
      // Wrong — increment wrongCount for this slot
      setGame((prev) => ({
        ...prev,
        board: prev.board.map((slot, i) =>
          i === leftIdx ? { ...slot, wrongCount: slot.wrongCount + 1 } : slot
        ),
      }));
      if (!muted) playWrong();
      setTotalWrong((w) => w + 1);
      setStreak(0);
      setWrongFlash({ leftIdx, rightIdx });
      setTimeout(() => {
        setWrongFlash(null);
        setSelectedLeft(null);
      }, 600);
    }
  }

  function handlePlayAgain() {
    startTimeRef.current = Date.now();
    setElapsed(0);
    setGame(buildGame());
    setResults([]);
    setSelectedLeft(null);
    setJustMatched(null);
    setWrongFlash(null);
    setStreak(0);
    setTotalWrong(0);
    setGameComplete(false);
  }

  const typeLabel = gameType === "synonyms" ? "Synonyms" : "Antonyms";
  const progress  = (results.length / totalQuestions) * 100;

  if (gameComplete) {
    return (
      <GameComplete
        results={results}
        totalWrong={totalWrong}
        timeTaken={elapsed}
        onPlayAgain={handlePlayAgain}
        onHome={onHome}
        level={level}
        gameType={gameType}
        totalQuestions={totalQuestions}
      />
    );
  }

  return (
    <div className="game-screen">
      <div className="game-header">
        <button className="back-btn" onClick={onHome}>← Home</button>
        {level !== "all" && <span className="level-badge">Level {level}</span>}
        <span className="type-badge">{typeLabel}</span>
        {streak > 0 && <span className="streak-badge">🔥 {streak}</span>}
        <span className="correct-badge">✓ {results.length}</span>
        <span className="wrong-badge">✗ {totalWrong}</span>
        <span className="timer-badge">⏱ {Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,"0")}</span>
        <button className="mute-btn" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* Progress bar */}
      <div className="progress-wrap">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <p className="game-instruction">
        {gameType === "synonyms"
          ? "Match each word with its synonym (same meaning)"
          : "Match each word with its antonym (opposite meaning)"}
      </p>

      <div className="columns">
        <div className="column">
          {board.map((item, leftIdx) => {
            const isMatched  = justMatched?.uid === item.uid;
            const isWrong    = wrongFlash?.leftIdx === leftIdx;
            const isSelected = selectedLeft === item.uid;
            return (
              <button
                key={leftIdx}
                className={`word-card left-card ${isMatched ? "matched" : ""} ${isSelected ? "selected" : ""} ${isWrong ? "wrong" : ""}`}
                onClick={() => handleLeftTap(leftIdx)}
                disabled={isMatched}
              >
                <span>{item.word}</span>
                {isMatched && (
                  <span className="card-stars">{"⭐".repeat(justMatched.stars)}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="column-divider">
          {board.map((_, i) => <div key={i} className="divider-dot" />)}
        </div>

        <div className="column">
          {rightOrder.map((boardIdx, rightIdx) => {
            const item      = board[boardIdx];
            const isMatched = justMatched?.rightIdx === rightIdx;
            const isWrong   = wrongFlash?.rightIdx === rightIdx;
            return (
              <button
                key={rightIdx}
                className={`word-card right-card ${isMatched ? "matched" : ""} ${isWrong ? "wrong" : ""}`}
                onClick={() => handleRightTap(rightIdx)}
                disabled={isMatched}
              >
                {item.match}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
