import React, { useState, useRef, useEffect } from "react";
import { wordData } from "../data/words";
import { bookletWordData } from "../data/bookletWords";
import GameComplete from "./GameComplete";
import { playCorrect, playWrong } from "../utils/feedback";
import { recordAttempt } from "../utils/progress";
import { addMiss, clearMiss, getMisses } from "../utils/misses";

const SKILL = "wordMatch";
const BOARD_SIZE = 5;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Right-column ordering: a derangement of [0..n-1] (no value stays at its own
// index) so a match is NEVER on the same row as its word. Sattolo's algorithm
// produces a single-cycle permutation, which is guaranteed to have no fixed
// points. With 0 or 1 items a derangement is impossible, so fall back to identity.
function derange(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * i); // 0 <= j < i (strictly), gives a full cycle
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

// Index of the first pair in `queue` that clashes with nothing already on the
// board (same left word or same right match would create ambiguous duplicate
// cards). Falls back to 0 if the pool is too small to avoid a clash.
function pickNonColliding(queue, boardItems) {
  const words   = new Set(boardItems.map((s) => s.word.toLowerCase()));
  const matches = new Set(boardItems.map((s) => s.match.toLowerCase()));
  const idx = queue.findIndex(
    (p) => !words.has(p.word.toLowerCase()) && !matches.has(p.match.toLowerCase())
  );
  return idx === -1 ? 0 : idx;
}

export default function GameScreen({ level, gameType, totalQuestions = 20, onHome, pairs, instruction, typeLabel: typeLabelProp, practice = false }) {
  // Practice = only the pairs you've missed. Otherwise a caller can pass an
  // explicit `pairs` list, or we fall back to synonyms/antonyms by level+type.
  const allPairs = practice ? getMisses(SKILL) : (pairs ?? [
    ...(wordData[level]?.[gameType] ?? []),
    ...(bookletWordData[level]?.[gameType] ?? []),
  ]);
  // In practice, the round is exactly the missed pairs (min 1 so the board works).
  const roundLength = practice ? Math.max(1, allPairs.length) : totalQuestions;
  const performance  = useRef({});  // word → last stars, persists across replays

  function buildGame() {
    const list = buildPrioritisedList(allPairs, performance.current);
    // Cycle list if fewer words than the round length
    const full = Array.from({ length: roundLength }, (_, i) => list[i % list.length]);
    // Greedily seat a starting board whose left words AND right matches are all
    // distinct — otherwise two identical cards would make a match ambiguous
    // (common with compound words that share a half, e.g. Back-drop / Rain-drop).
    const board = [];
    const queue = [];
    const words = new Set(), matches = new Set();
    for (const p of full) {
      const w = p.word.toLowerCase(), m = p.match.toLowerCase();
      if (board.length < BOARD_SIZE && !words.has(w) && !matches.has(m)) {
        board.push(makeItem(p)); words.add(w); matches.add(m);
      } else {
        queue.push(p);
      }
    }
    // Tiny pool: top up so the board is still full even if halves must repeat.
    while (board.length < BOARD_SIZE && queue.length) board.push(makeItem(queue.shift()));
    return { board, queue, rightOrder: derange(board.length) };
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

      // Review signal: a hit only if matched first try, else a miss for this word.
      recordAttempt({ skill: SKILL, word: item.word, correct: item.wrongCount === 0, meaning: item.match });
      if (item.wrongCount === 0) clearMiss(SKILL, item.word.toLowerCase());
      performance.current[item.word] = stars;
      if (!muted) playCorrect();
      setResults(newResults);
      setStreak(newStreak);
      setSelectedLeft(null);
      setJustMatched({ uid: item.uid, rightIdx, stars });

      setTimeout(() => {
        if (newResults.length >= roundLength) {
          setGameComplete(true);
          setJustMatched(null);
          return;
        }

        if (queue.length > 0) {
          // Replace matched slot with a queued pair that won't duplicate a word
          // or match already visible on the other four cards.
          const others   = board.filter((_, i) => i !== leftIdx);
          const qi        = pickNonColliding(queue, others);
          const nextPair  = queue[qi];
          const newQueue  = queue.filter((_, i) => i !== qi);
          const newBoard = board.map((slot, i) =>
            i === leftIdx ? makeItem(nextPair) : slot
          );
          // Re-shuffle the right column so the row-to-row mapping changes every
          // turn — otherwise kids learn the fixed positions and match without reading.
          setGame({ board: newBoard, queue: newQueue, rightOrder: derange(newBoard.length) });
        } else {
          // Queue exhausted — shrink the board for the final matches
          const newBoard = board.filter((_, i) => i !== leftIdx);
          setGame({ board: newBoard, queue: [], rightOrder: derange(newBoard.length) });
        }

        setJustMatched(null);
      }, 700);

    } else {
      // Wrong — increment wrongCount for this slot and queue the word for practice.
      const missItem = board[leftIdx];
      if (missItem) addMiss(SKILL, missItem.word.toLowerCase(), { word: missItem.word, match: missItem.match });
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

  const typeLabel = typeLabelProp ?? (gameType === "synonyms" ? "Synonyms" : "Antonyms");
  const progress  = (results.length / roundLength) * 100;

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
        totalQuestions={roundLength}
      />
    );
  }

  return (
    <div className="game-screen">
      {/* Top: back · progress pips · mute */}
      <div className="ig-top">
        <button className="ig-back" onClick={onHome} aria-label="Home">←</button>
        <div className="ig-pips">
          {Array.from({ length: roundLength }, (_, i) => (
            <span key={i} className={`ig-pip ${i < results.length ? "done" : ""}`} />
          ))}
        </div>
        <button className="ig-mute" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* HUD: combo · time · wrong */}
      <div className="ig-hud">
        <div className="ig-card ig-card--combo">
          <div className="ig-card-val">×{streak}</div>
          <div className="ig-card-lbl">combo</div>
        </div>
        <div className="ig-card">
          <div className="ig-card-val">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</div>
          <div className="ig-card-lbl">time</div>
        </div>
        <div className="ig-card">
          <div className="ig-card-val ig-card-val--correct">✓ {results.length}</div>
          <div className="ig-card-lbl">correct</div>
        </div>
        <div className="ig-card">
          <div className="ig-card-val ig-card-val--wrong">{totalWrong}</div>
          <div className="ig-card-lbl">wrong</div>
        </div>
      </div>

      <div className="play-card">
      <p className="game-instruction">
        {instruction ?? (gameType === "synonyms"
          ? "Match each word with its synonym (same meaning)"
          : "Match each word with its antonym (opposite meaning)")}
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
    </div>
  );
}
