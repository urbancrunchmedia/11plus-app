import React, { useState, useEffect } from "react";
import AppNav from "./components/AppNav";
import HomeDashboard from "./components/HomeDashboard";
import MeScreen from "./components/MeScreen";
import HomeScreen from "./components/HomeScreen";
import GameScreen from "./components/GameScreen";
import CompoundGame from "./components/CompoundGame";
import WorksheetGame from "./components/WorksheetGame";
import { makeCompoundQuestions, makeSynonymQuestions, makeAntonymQuestions } from "./utils/worksheet";
import PunctuationScreen from "./components/PunctuationScreen";
import PunctuationGame from "./components/PunctuationGame";
import DetectiveScreen from "./components/DetectiveScreen";
import FillInBlanksGame from "./components/FillInBlanksGame";
import FlashcardScreen from "./components/FlashcardScreen";
import ComingSoon from "./components/ComingSoon";
import WordListScreen from "./components/WordListScreen";
import LeaderboardScreen from "./components/LeaderboardScreen";
import LoginScreen from "./components/LoginScreen";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import "./App.css";

// Worksheet-format metadata per skill (baseType). Drives the exam-style
// "two groups of three" screen for Word Match (synonyms/antonyms) and Compound Words.
const WORKSHEET_META = {
  synonyms: {
    makeQuestions: makeSynonymQuestions,
    instruction: "Pick the word on the left and the word on the right that have a similar meaning.",
    example: <>Example: (<b>Happy</b> · Run · Cold) = (Big · <b>Joyful</b> · Jump) → <b>Happy</b> means <b>Joyful</b></>,
    connector: "=",
    typeLabel: "Synonyms",
  },
  antonyms: {
    makeQuestions: makeAntonymQuestions,
    instruction: "Pick the word on the left and the word on the right that have opposite meanings.",
    example: <>Example: (<b>Happy</b> · Run · Cold) ↔ (Big · <b>Sad</b> · Jump) → <b>Happy</b> is the opposite of <b>Sad</b></>,
    connector: "↔",
    typeLabel: "Antonyms",
  },
  compoundWords: {
    makeQuestions: makeCompoundQuestions,
    instruction: "Pick one word from each group that join together to make a new word.",
    example: <>Example: (<b>Water</b> · Suggest · Disc) + (<b>Fall</b> · Hard · Ton) → the word is <b>Waterfall</b></>,
    connector: "+",
    typeLabel: "Compound Words",
  },
};

function WorksheetFor({ baseType, config, playKey, onHome }) {
  const meta = WORKSHEET_META[baseType];
  return (
    <WorksheetGame
      key={playKey}
      level={config.level}
      gameType={config.gameType}
      totalQuestions={config.totalQuestions}
      makeQuestions={(count) => meta.makeQuestions(config.level, count)}
      instruction={meta.instruction}
      example={meta.example}
      typeLabel={meta.typeLabel}
      connector={meta.connector}
      onHome={onHome}
    />
  );
}

function AppInner() {
  const { user } = useAuth();

  // All hooks must run on every render (before any early return) — otherwise
  // the hook count changes when auth flips logged-out → logged-in and React
  // crashes the tree to a blank screen (only a refresh recovered it).
  const VALID_SCREENS = [
    "home", "me", "wordMatch", "compoundWords",
    "punctuation", "fillInBlanks", "wordList", "leaderboard",
  ];
  const [selectedGame, setSelectedGame] = useState(() => {
    try {
      const last = localStorage.getItem("11plus_last_screen");
      return VALID_SCREENS.includes(last) ? last : "home";
    } catch { return "home"; }
  });
  // Remember the current section so a refresh stays on the same page
  useEffect(() => {
    try { localStorage.setItem("11plus_last_screen", selectedGame); } catch {}
  }, [selectedGame]);

  const [screen, setScreen] = useState("home");
  const [config, setConfig] = useState(null);
  const [playKey, setPlayKey] = useState(0);
  const [lastPunctConfig, setLastPunctConfig] = useState(null);

  if (user === undefined) {
    return (
      <div className="app-loading">
        <span className="app-loading-logo">🎓</span>
        <p>Loading…</p>
      </div>
    );
  }

  if (user === null) return <LoginScreen />;

  function handleSelectGame(id) {
    setSelectedGame(id);
    setScreen("home");
  }

  function handlePlay(cfg) {
    if (selectedGame === "punctuation") setLastPunctConfig(cfg);
    setConfig(cfg);
    setPlayKey((k) => k + 1);
    setScreen("game");
  }

  function handleHome() {
    setScreen("home");
  }

  function handleLearn() {
    setScreen("learn");
  }

  const isDashboard      = selectedGame === "home";
  const isMe             = selectedGame === "me";
  const isWordMatch      = selectedGame === "wordMatch";
  const isCompoundWords  = selectedGame === "compoundWords";
  const isPunctuation    = selectedGame === "punctuation";
  const isFillInBlanks   = selectedGame === "fillInBlanks";
  const isWordList       = selectedGame === "wordList";
  const isLeaderboard    = selectedGame === "leaderboard";
  const isKnown =
    isDashboard || isMe || isWordMatch || isCompoundWords ||
    isPunctuation || isFillInBlanks || isWordList || isLeaderboard;

  return (
    <div className="app-layout">
      <AppNav active={selectedGame} onNavigate={handleSelectGame} />

      <div className="main-area">
        <div className="main-content">
          {/* Home dashboard */}
          {isDashboard && (
            <HomeDashboard
              onPlaySkill={(id) => handleSelectGame(id)}
              onOpenBoard={() => handleSelectGame("leaderboard")}
            />
          )}

          {/* Me — profile */}
          {isMe && <MeScreen />}

          {/* Word Match — synonyms/antonyms, in Match or Worksheet format */}
          {isWordMatch && screen === "home" && (
            <HomeScreen gameType="wordMatch" onPlay={handlePlay} initialConfig={config} />
          )}
          {isWordMatch && screen === "game" && config && (
            config.format === "worksheet" ? (
              <WorksheetFor baseType={config.baseType} config={config} playKey={playKey} onHome={handleHome} />
            ) : (
              <GameScreen
                key={playKey}
                level={config.level}
                gameType={config.gameType}
                totalQuestions={config.totalQuestions}
                onHome={handleHome}
              />
            )
          )}

          {/* Compound Words — join two words, in Match or Worksheet format */}
          {isCompoundWords && screen === "home" && (
            <HomeScreen gameType="compoundWords" onPlay={handlePlay} initialConfig={config} />
          )}
          {isCompoundWords && screen === "game" && config && (
            <CompoundGame
              key={playKey}
              level={config.level}
              totalQuestions={config.totalQuestions}
              onHome={handleHome}
            />
          )}

          {/* Punctuation */}
          {isPunctuation && screen === "home" && (
            <PunctuationScreen onPlay={handlePlay} initialConfig={lastPunctConfig} />
          )}
          {isPunctuation && screen === "game" && config && (
            <PunctuationGame
              key={playKey}
              level={config.level}
              totalQuestions={config.totalQuestions}
              onHome={handleHome}
            />
          )}

          {/* Word Detective (fill in the blanks) */}
          {isFillInBlanks && screen === "home" && (
            <DetectiveScreen onPlay={handlePlay} onLearn={handleLearn} />
          )}
          {isFillInBlanks && screen === "learn" && (
            <FlashcardScreen
              onHome={handleHome}
              onPlay={() => handlePlay({ level: "all", totalQuestions: 20 })}
            />
          )}
          {isFillInBlanks && screen === "game" && config && (
            <FillInBlanksGame
              key={playKey}
              level={config.level}
              totalQuestions={config.totalQuestions}
              onHome={handleHome}
            />
          )}

          {isWordList && <WordListScreen />}

          {isLeaderboard && <LeaderboardScreen onPlay={() => handleSelectGame("wordMatch")} />}

          {!isKnown && <ComingSoon gameId={selectedGame} />}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
