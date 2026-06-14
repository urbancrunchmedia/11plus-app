import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import HomeScreen from "./components/HomeScreen";
import GameScreen from "./components/GameScreen";
import PunctuationScreen from "./components/PunctuationScreen";
import PunctuationGame from "./components/PunctuationGame";
import FillInBlanksGame from "./components/FillInBlanksGame";
import FlashcardScreen from "./components/FlashcardScreen";
import ComingSoon from "./components/ComingSoon";
import WordListScreen from "./components/WordListScreen";
import LeaderboardScreen from "./components/LeaderboardScreen";
import AuthButton from "./components/AuthButton";
import LoginScreen from "./components/LoginScreen";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import "./App.css";

function AppInner() {
  const { user } = useAuth();

  // All hooks must run on every render (before any early return) — otherwise
  // the hook count changes when auth flips logged-out → logged-in and React
  // crashes the tree to a blank screen (only a refresh recovered it).
  const VALID_GAMES = ["wordMatch", "punctuation", "fillInBlanks", "wordList", "leaderboard"];
  const [selectedGame, setSelectedGame] = useState(() => {
    try {
      const last = localStorage.getItem("11plus_last_screen");
      return VALID_GAMES.includes(last) ? last : "wordMatch";
    } catch { return "wordMatch"; }
  });
  // Remember the current section so a refresh stays on the same page
  useEffect(() => {
    try { localStorage.setItem("11plus_last_screen", selectedGame); } catch {}
  }, [selectedGame]);

  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  const isWordMatch     = selectedGame === "wordMatch";
  const isPunctuation   = selectedGame === "punctuation";
  const isFillInBlanks  = selectedGame === "fillInBlanks";
  const isWordList      = selectedGame === "wordList";
  const isLeaderboard   = selectedGame === "leaderboard";
  const isKnownGame     = isWordMatch || isPunctuation || isFillInBlanks || isWordList || isLeaderboard;

  return (
    <div className="app-layout">
      <Sidebar
        selectedGame={selectedGame}
        onSelectGame={handleSelectGame}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />

      <div className="main-area">
        <button
          className="hamburger"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          ☰
        </button>

        <div className="main-content">
          {/* Word Match (synonyms + antonyms combined) */}
          {isWordMatch && screen === "home" && (
            <HomeScreen gameType="wordMatch" onPlay={handlePlay} initialConfig={config} />
          )}
          {isWordMatch && screen === "game" && config && (
            <GameScreen
              key={playKey}
              level={config.level}
              gameType={config.gameType}
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

          {/* Fill in the Blanks */}
          {isFillInBlanks && screen === "home" && (
            <HomeScreen gameType="fillInBlanks" onPlay={handlePlay} onLearn={handleLearn} initialConfig={config} />
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

          {isLeaderboard && <LeaderboardScreen />}

          {!isKnownGame && (
            <ComingSoon gameId={selectedGame} />
          )}
        </div>

        <div className="auth-bar">
          <AuthButton />
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
