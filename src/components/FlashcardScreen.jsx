import React, { useState } from "react";
import { fillInBlanksData } from "../data/fillInBlanks";

const ALL_CARDS = [
  ...(fillInBlanksData.A || []),
  ...(fillInBlanksData.B || []),
  ...(fillInBlanksData.C || []),
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

export default function FlashcardScreen({ onHome, onPlay }) {
  const [deck]                = useState(() => shuffle(ALL_CARDS));
  const [index, setIndex]     = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card  = deck[index];
  const total = deck.length;

  // Example sentence with the word filled in (capitalised already in data)
  const exampleSentence = card.sentence.replace("_____", card.word);

  function go(delta) {
    const next = index + delta;
    if (next < 0 || next >= total) return;
    setFlipped(false);
    setIndex(next);
  }

  return (
    <div className="home-screen">
      <div className="home-card">

        <div className="home-title">
          <span className="home-emoji">📖</span>
          <h1>Learn the Words</h1>
          <p className="home-subtitle">Tap the card to see what it means</p>
        </div>

        {/* Progress */}
        <div className="progress-wrap">
          <div className="progress-fill" style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>

        {/* Flashcard */}
        <div
          className={`flashcard ${flipped ? "flipped" : ""}`}
          onClick={() => setFlipped((f) => !f)}
        >
          <div className="flashcard-inner">
            {/* Front — the word */}
            <div className="flashcard-face flashcard-front">
              <button
                className="fib-speak flashcard-speak"
                onClick={(e) => { e.stopPropagation(); speak(card.word); }}
                aria-label={`Hear the word ${card.word}`}
              >
                🔊
              </button>
              <span className="flashcard-word">{card.word}</span>
              <span className="flashcard-flip-hint">tap to flip 👆</span>
            </div>

            {/* Back — meaning + example */}
            <div className="flashcard-face flashcard-back">
              <span className="flashcard-back-word">{card.word}</span>
              <span className="flashcard-meaning-label">Meaning</span>
              <span className="flashcard-meaning">{card.definition}</span>
              <span className="flashcard-meaning-label">Example</span>
              <span className="flashcard-sentence">{exampleSentence}</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flashcard-nav">
          <button
            className="secondary-btn"
            onClick={() => go(-1)}
            disabled={index === 0}
          >
            ← Back
          </button>
          {index < total - 1 ? (
            <button className="play-btn" onClick={() => go(1)}>
              Next →
            </button>
          ) : (
            <button className="play-btn" onClick={onPlay}>
              Quiz Me! 🎮
            </button>
          )}
        </div>

        <button className="secondary-btn" onClick={onHome} style={{ marginTop: 4 }}>
          ← Home
        </button>

      </div>
    </div>
  );
}
