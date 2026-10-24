import React, { useState, useEffect, useRef } from "react";
import { chooseStartScreen } from "./utils/startScreen";
import AppNav from "./components/AppNav";
import HomeDashboard from "./components/HomeDashboard";
import SettingsScreen from "./components/SettingsScreen";
import HomeScreen from "./components/HomeScreen";
import GameScreen from "./components/GameScreen";
import CompoundGame from "./components/CompoundGame";
import PunctuationScreen from "./components/PunctuationScreen";
import PunctuationGame from "./components/PunctuationGame";
import SpellingScreen from "./components/SpellingScreen";
import SpellingGame from "./components/SpellingGame";
import WordClassScreen from "./components/WordClassScreen";
import WordClassGame from "./components/WordClassGame";
import DetectiveScreen from "./components/DetectiveScreen";
import FillInBlanksGame from "./components/FillInBlanksGame";
import FlashcardScreen from "./components/FlashcardScreen";
import OwnerDashboard from "./components/OwnerDashboard";
import ComingSoon from "./components/ComingSoon";
import WordListScreen from "./components/WordListScreen";
import LeaderboardScreen from "./components/LeaderboardScreen";
import BadgesScreen from "./components/BadgesScreen";
import ProgressReport from "./components/ProgressReport";
import SubscriptionSuccess, { formatDate } from "./components/SubscriptionSuccess";
import LoginScreen from "./components/LoginScreen";
import ChildGate from "./components/ChildGate";
import OnboardingScreen from "./components/OnboardingScreen";
import { getSetting, setSetting } from "./utils/leaderboard";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { PremiumProvider, usePremium } from "./contexts/PremiumContext";
import { roundsToday, bumpRoundsToday, dailyRoundLimit, isLevelFree, tasterLeftToday, spendTasterRound, starterLimit } from "./utils/entitlement";
import "./App.css";

function AppInner() {
  const { user } = useAuth();
  const { isPremium, openPaywall, refresh, refreshUntilPremium } = usePremium();

  // All hooks must run on every render (before any early return) — otherwise
  // the hook count changes when auth flips logged-out → logged-in and React
  // crashes the tree to a blank screen (only a refresh recovered it).
  const [selectedGame, setSelectedGame] = useState(() => {
    try {
      return chooseStartScreen(sessionStorage.getItem("11plus_screen"), localStorage.getItem("11plus_last_screen"));
    } catch { return "home"; }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem("11plus_screen", selectedGame);   // this visit
      localStorage.setItem("11plus_last_screen", selectedGame); // later visits
    } catch { /* private mode */ }
  }, [selectedGame]);

  // There's no router — every screen is just `selectedGame` changing — so the
  // browser's own back button had no history entries of ours to step through
  // and exited the site instead. Give each top-level screen a real entry:
  // one push per navigation, restoring `selectedGame` on back/forward instead
  // of letting the browser leave the page.
  const skipNextPush = useRef(true);  // the resolved start screen already IS the baseline — don't push it again on mount
  const isPopping     = useRef(false); // a change driven by popstate, not a fresh navigation — don't re-push it
  useEffect(() => {
    try { window.history.replaceState({ selectedGame }, ""); } catch { /* private mode */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- baseline entry for whatever screen we resolved to on mount, deliberately once
  }, []);
  useEffect(() => {
    if (skipNextPush.current) { skipNextPush.current = false; return; }
    if (isPopping.current) { isPopping.current = false; return; }
    try { window.history.pushState({ selectedGame }, ""); } catch { /* private mode */ }
  }, [selectedGame]);
  useEffect(() => {
    function onPopState(e) {
      isPopping.current = true;
      setSelectedGame(e.state?.selectedGame || "home");
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Signing out doesn't unmount this component (see the hooks-order note
  // above), so `selectedGame` — and the sessionStorage a reload restores it
  // from — would otherwise still say "me" from the account that just left.
  // Sign back in in the same tab and chooseStartScreen trusts a same-tab
  // "reload" completely (that's the point of it — a Settings refresh has to
  // stay put), so it would inherit the previous person's grown-up screen.
  // Only fire on a genuine sign-out (was signed in, now isn't) — not on the
  // very first render, before anyone has signed in at all.
  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (user) { wasSignedIn.current = true; return; }
    if (!wasSignedIn.current) return;
    wasSignedIn.current = false;
    try { sessionStorage.removeItem("11plus_screen"); } catch { /* private mode */ }
    setSelectedGame("home");
  }, [user]);

  // The mirror image: an actual sign-in (typing credentials on the login
  // screen) should always land on Home, even if a game screen was left open
  // the last time someone used this device — that's a deliberate new session,
  // not the same "keep me where I was" reload chooseStartScreen exists for.
  // `user` only passes through `null` when the LoginScreen was genuinely
  // shown; restoring an already-signed-in session on a fresh page load goes
  // straight from `undefined` to a user and never sets this, so a reload
  // still resumes wherever it left off.
  const wasLoggedOut = useRef(false);
  useEffect(() => {
    if (user === null) { wasLoggedOut.current = true; return; }
    if (!user) return;
    if (wasLoggedOut.current) {
      wasLoggedOut.current = false;
      setSelectedGame("home");
    }
  }, [user]);

  const [screen, setScreen] = useState("home");
  const [config, setConfig] = useState(null);
  const [playKey, setPlayKey] = useState(0);
  const [lastPunctConfig, setLastPunctConfig] = useState(null);
  const [parentUnlocked, setParentUnlocked] = useState(false);
  // Badges is reachable from both Home (the rank crest) and Settings — its
  // back button needs to return wherever it was actually opened from, not
  // always Home.
  const [badgesReturnTo, setBadgesReturnTo] = useState("home");
  function openBadges(from) { setBadgesReturnTo(from); handleSelectGame("badges"); }
  // Returning from Stripe: ?checkout=success | ?checkout=cancel | ?billing=return
  const [billingEvent, setBillingEvent] = useState(null);
  const [billingNote, setBillingNote] = useState(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const billing  = params.get("billing");
    if (!checkout && !billing) return;
    // Clear the params so a refresh doesn't replay the celebration.
    window.history.replaceState({}, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time reaction to the Stripe redirect landing on this URL, not derived state.
    if (checkout === "success") { setBillingEvent("success"); refreshUntilPremium(); }
    else if (checkout === "cancel") setBillingNote("Checkout cancelled — no payment was taken.");
    else if (billing === "return") {
      refresh().then((next) => {
        if (!next) return;
        if (next.cancelAtPeriodEnd) {
          const until = formatDate(next.currentPeriodEnd);
          setBillingNote(until ? `Subscription cancelled — Full Access until ${until}.` : "Subscription cancelled.");
        } else if (!next.isPremium) {
          setBillingNote("Your subscription has ended. You're back on the free plan.");
        }
      });
    }
  }, [refresh, refreshUntilPremium]);
  useEffect(() => {
    if (!billingNote) return;
    const t = setTimeout(() => setBillingNote(null), 6000);
    return () => clearTimeout(t);
  }, [billingNote]);
  const [onboarded, setOnboarded] = useState(() => getSetting("onboarded", false));
  // Re-read on every account change (not just first mount) — a shared-device
  // account switch clears the previous kid's "onboarded" flag, and this
  // state needs to pick that up without a full page reload.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a real external source of truth (localStorage, cleared by prepareLocalForUser on account switch), not derived from props.
    setOnboarded(getSetting("onboarded", false));
  }, [user?.uid]);

  if (user === undefined) {
    return (
      <div className="app-loading">
        <img className="app-loading-mark" src="/logo-mark-simple.svg" alt="" width="72" height="72" />
        <p>Loading…</p>
      </div>
    );
  }

  if (user === null) return <LoginScreen />;

  // Private owner dashboard (access is checked server-side).
  if (window.location.pathname.startsWith("/owner")) return <OwnerDashboard />;

  const childPin = getSetting("childPin", "");
  // A whole-app "who's learning today?" PIN gate used to sit here on every
  // open. Removed: it implied profile-switching this app doesn't actually
  // have (there's one profile per account), so it was just an extra tap on
  // every launch with no real protection beyond what "PIN-protect grown-up
  // settings" below already provides on its own. That one's kept — it's the
  // part with genuine value (keeping a kid out of Settings). Logic and
  // ChildGate itself are untouched, just not invoked here; easy to restore.

  // First-run "set up a learner" step — only when no proper name is set yet.
  const needsOnboarding = !onboarded && (!user.displayName || user.displayName === "Player");
  if (needsOnboarding) {
    return <OnboardingScreen onDone={() => { setSetting("onboarded", true); setOnboarded(true); }} />;
  }

  function handleSelectGame(id) {
    // Re-lock only when leaving the grown-up area (Settings + Report) entirely.
    // Badges is excluded too — reached from Settings as much as Home, so
    // stepping into it and back shouldn't force a parent to re-enter the PIN.
    if (id !== "me" && id !== "report" && id !== "badges") setParentUnlocked(false);
    setSelectedGame(id);
    setScreen("home");
  }

  // Paywall choke point for every free round, from "Start round" and from a
  // game's own "Play again" alike. Practice (replaying your own misses) is
  // always free. Returns the config to play with, or null if the paywall was
  // shown instead. Level A rounds are limited to the starter set; a harder
  // level is allowed once a day as a taster round.
  function admitRound(cfg) {
    if (cfg.practice || isPremium) return cfg;
    const harder = selectedGame !== "fillInBlanks" && cfg.level && !isLevelFree(cfg.level);
    if (harder && tasterLeftToday() <= 0) { openPaywall("taster"); return null; }
    if (roundsToday() >= dailyRoundLimit()) { openPaywall("limit"); return null; }
    bumpRoundsToday();
    if (harder) { spendTasterRound(); return cfg; }
    return { ...cfg, poolLimit: starterLimit(selectedGame) };
  }
  const admitReplay = () => !!admitRound(config);

  function handlePlay(start) {
    const cfg = admitRound(start);
    if (!cfg) return;
    if (selectedGame === "punctuation") setLastPunctConfig(start);
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
  const isReport         = selectedGame === "report";
  const needsParentPin   = (isMe || isReport) && !!childPin && getSetting("parentPinLock", false) && !parentUnlocked;
  const isSynonyms       = selectedGame === "synonyms";
  const isAntonyms       = selectedGame === "antonyms";
  const isCompoundWords  = selectedGame === "compoundWords";
  const isPunctuation    = selectedGame === "punctuation";
  const isSpelling       = selectedGame === "spelling";
  const isWordClass      = selectedGame === "wordClass";
  const isFillInBlanks   = selectedGame === "fillInBlanks";
  const isWordList       = selectedGame === "wordList";
  const isLeaderboard    = selectedGame === "leaderboard";
  const isBadges         = selectedGame === "badges";
  const isKnown =
    isDashboard || isMe || isSynonyms || isAntonyms || isCompoundWords ||
    isPunctuation || isSpelling || isWordClass || isFillInBlanks || isWordList ||
    isLeaderboard || isReport || isBadges;

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
              onOpenBadges={() => openBadges("home")}
            />
          )}

          {/* Grown-up area — Settings and the progress report share one PIN gate,
              so a reload straight into the report can't slip past the lock. */}
          {(isMe || isReport) && (
            needsParentPin ? (
              <ChildGate
                name={user.displayName}
                pin={childPin}
                title="Grown-ups only"
                prompt={isMe ? "Enter the PIN to open Settings" : "Enter the PIN to open the progress report"}
                resetLabel="Forgot the PIN? Turn the lock off"
                onUnlock={() => setParentUnlocked(true)}
                onReset={() => { setSetting("parentPinLock", false); setParentUnlocked(true); }}
                onCancel={() => handleSelectGame("home")}
              />
            ) : isMe ? (
              <SettingsScreen
                onHome={() => handleSelectGame("home")}
                onOpenReport={() => handleSelectGame("report")}
                onOpenBadges={() => openBadges("me")}
              />
            ) : (
              <ProgressReport
                onBack={() => handleSelectGame("me")}
                onPractise={() => handleSelectGame("fillInBlanks")}
                onPracticeSkill={(skill) => handleSelectGame(skill)}
              />
            )
          )}

          {/* Synonyms — straight in, no "what are we matching" toggle */}
          {isSynonyms && screen === "home" && (
            <HomeScreen gameType="synonyms" onPlay={handlePlay} initialConfig={config} onExit={() => handleSelectGame("home")} />
          )}
          {isSynonyms && screen === "game" && config && (
            <GameScreen
              key={playKey}
              level={config.level}
              gameType={config.gameType}
              totalQuestions={config.totalQuestions}
              onHome={handleHome}
              practice={config.practice}
              poolLimit={config.poolLimit}
              onReplay={admitReplay}
            />
          )}

          {/* Antonyms — straight in, no "what are we matching" toggle */}
          {isAntonyms && screen === "home" && (
            <HomeScreen gameType="antonyms" onPlay={handlePlay} initialConfig={config} onExit={() => handleSelectGame("home")} />
          )}
          {isAntonyms && screen === "game" && config && (
            <GameScreen
              key={playKey}
              level={config.level}
              gameType={config.gameType}
              totalQuestions={config.totalQuestions}
              onHome={handleHome}
              practice={config.practice}
              poolLimit={config.poolLimit}
              onReplay={admitReplay}
            />
          )}

          {/* Compound Words — join two words, in Match or Worksheet format */}
          {isCompoundWords && screen === "home" && (
            <HomeScreen gameType="compoundWords" onPlay={handlePlay} initialConfig={config} onExit={() => handleSelectGame("home")} />
          )}
          {isCompoundWords && screen === "game" && config && (
            <CompoundGame
              key={playKey}
              level={config.level}
              totalQuestions={config.totalQuestions}
              onHome={handleHome}
              practice={config.practice}
              poolLimit={config.poolLimit}
              onReplay={admitReplay}
            />
          )}

          {/* Punctuation */}
          {isPunctuation && screen === "home" && (
            <PunctuationScreen onPlay={handlePlay} initialConfig={lastPunctConfig} onExit={() => handleSelectGame("home")} />
          )}
          {isPunctuation && screen === "game" && config && (
            <PunctuationGame
              key={playKey}
              level={config.level}
              totalQuestions={config.totalQuestions}
              onHome={handleHome}
              practice={config.practice}
              poolLimit={config.poolLimit}
              onReplay={admitReplay}
            />
          )}

          {/* Spelling — spot the misspelled section */}
          {isSpelling && screen === "home" && (
            <SpellingScreen onPlay={handlePlay} onExit={() => handleSelectGame("home")} />
          )}
          {isSpelling && screen === "game" && config && (
            <SpellingGame
              key={playKey}
              level={config.level}
              totalQuestions={config.totalQuestions}
              onHome={handleHome}
              practice={config.practice}
              poolLimit={config.poolLimit}
              onReplay={admitReplay}
            />
          )}

          {/* Parts of Speech — spot the noun/verb/adjective/etc. */}
          {isWordClass && screen === "home" && (
            <WordClassScreen onPlay={handlePlay} onExit={() => handleSelectGame("home")} />
          )}
          {isWordClass && screen === "game" && config && (
            <WordClassGame
              key={playKey}
              level={config.level}
              totalQuestions={config.totalQuestions}
              onHome={handleHome}
              practice={config.practice}
              poolLimit={config.poolLimit}
              onReplay={admitReplay}
            />
          )}

          {/* Word Detective (fill in the blanks) */}
          {isFillInBlanks && screen === "home" && (
            <DetectiveScreen onPlay={handlePlay} onLearn={handleLearn} onExit={() => handleSelectGame("home")} />
          )}
          {isFillInBlanks && screen === "learn" && (
            <FlashcardScreen
              onHome={handleHome}
              poolLimit={isPremium ? null : starterLimit("fillInBlanks")}
              onPlay={() => handlePlay({ level: "all", totalQuestions: 20 })}
            />
          )}
          {isFillInBlanks && screen === "game" && config && (
            <FillInBlanksGame
              key={playKey}
              level={config.level}
              totalQuestions={config.totalQuestions}
              onHome={handleHome}
              practice={config.practice}
              poolLimit={config.poolLimit}
              onReplay={admitReplay}
            />
          )}

          {isWordList && <WordListScreen onExit={() => handleSelectGame("home")} />}

          {isLeaderboard && <LeaderboardScreen onPlay={() => handleSelectGame("synonyms")} onExit={() => handleSelectGame("home")} />}

          {isBadges && <BadgesScreen onExit={() => handleSelectGame(badgesReturnTo)} />}

          {!isKnown && <ComingSoon gameId={selectedGame} />}
        </div>
      </div>

      {billingEvent === "success" && (
        <SubscriptionSuccess onStart={() => { setBillingEvent(null); handleSelectGame("home"); }} />
      )}
      {billingNote && <div className="set-toast">{billingNote}</div>}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PremiumProvider>
        <AppInner />
      </PremiumProvider>
    </AuthProvider>
  );
}
