import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import Icon, { SKILL_ICON } from "./Icon";

// What the app actually contains, shown before anyone signs in.
const GAME_STRIP = [
  { skill: "wordMatch",     label: "Word Match",     hook: "Pair words with the same or opposite meaning" },
  { skill: "fillInBlanks",  label: "Word Detective", hook: "Crack the clue to find the missing word" },
  { skill: "punctuation",   label: "Punctuation",    hook: "Spot the punctuation mistake" },
  { skill: "spelling",      label: "Spelling",       hook: "Spot the misspelled section" },
  { skill: "compoundWords", label: "Compound Words", hook: "Join two words into one" },
];

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function EyeIcon({ off }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3.2" />
      {off && <path d="M4 20 20 4" />}
    </svg>
  );
}

function friendlyError(code, message) {
  switch (code) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      // Accounts created with Google have no password at all, so a saved
      // password from the browser will always be rejected here.
      return "That email and password didn't match. If you normally use Google, sign in with the button below — accounts created with Google don't have a password.";
    case "auth/email-already-in-use":  return "An account with this email already exists.";
    case "auth/weak-password":         return "Password must be at least 6 characters.";
    case "auth/invalid-email":         return "Please enter a valid email address.";
    case "auth/too-many-requests":     return "Too many attempts. Please try again later.";
    case "auth/operation-not-allowed": return "Email/Password sign-in is not enabled in Firebase.";
    case "auth/popup-blocked":         return "Popup was blocked — please allow popups for this site.";
    case "auth/popup-closed-by-user":  return "Sign-in window was closed. Please try again.";
    case "auth/unauthorized-domain":   return "This domain isn't authorised in Firebase.";
    case "auth/cancelled-popup-request": return null;
    default:                           return message || "Something went wrong. Please try again.";
  }
}

export default function LoginScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword, redirectError } = useAuth();

  const [tab, setTab]           = useState("parent"); // "child" | "parent"
  const [mode, setMode]         = useState("signin");  // "signin" | "signup"
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [notice, setNotice]     = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [credFail, setCredFail] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setNotice(""); setLoading(true);
    try {
      if (mode === "signup") await signUpWithEmail(email, password, name);
      else await signInWithEmail(email, password);
    } catch (err) {
      const msg = friendlyError(err.code, err.message);
      setCredFail(["auth/user-not-found", "auth/wrong-password", "auth/invalid-credential"].includes(err.code));
      if (msg) setError(msg);
    }
    setLoading(false);
  }

  async function handleForgot() {
    setError(""); setNotice("");
    if (!email.trim()) { setError("Enter your email above, then tap 'Forgot password?'."); return; }
    try {
      await resetPassword(email);
      setNotice(`Password reset link sent to ${email.trim()}. Check your inbox (and spam).`);
    } catch (err) {
      setError(friendlyError(err.code, err.message) || "Couldn't send the reset email.");
    }
  }

  async function handleGoogle() {
    setError(""); setCredFail(false);
    try { await signInWithGoogle(); }
    catch (err) { const msg = friendlyError(err.code, err.message); if (msg) setError(msg); }
  }

  return (
    <div className="login2">
      {/* Left: brand hero */}
      <div className="login2-hero">
        <div className="login2-hero-bg1" />
        <div className="login2-hero-bg2" />
        <div className="login2-logo">11</div>
        <div className="login2-hero-mid">
          <div className="login2-tagline">Master the words. Ace the 11+.</div>
        </div>
        <div className="login2-games">
          {GAME_STRIP.map((g, i) => {
            const ic = SKILL_ICON[g.skill];
            const last = i === GAME_STRIP.length - 1 && GAME_STRIP.length % 2 === 1;
            return (
              <div className={`login2-game${last ? " login2-game--wide" : ""}`} key={g.skill}>
                <div className="login2-game-ic" style={{ background: ic.bg }}>
                  <Icon name={ic.name} stroke={ic.stroke} size={17} strokeWidth={2} />
                </div>
                <div className="login2-game-text">
                  <div className="login2-game-name">{g.label}</div>
                  <div className="login2-game-hook">{g.hook}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: sign-in */}
      <div className="login2-panel">
        <div className="login2-card">
          <div className="login2-tabs">
            <button className={`login2-tab ${tab === "child" ? "active" : ""}`} onClick={() => setTab("child")}>I'm learning</button>
            <button className={`login2-tab ${tab === "parent" ? "active" : ""}`} onClick={() => setTab("parent")}>Grown-up</button>
          </div>

          {tab === "child" ? (
            <div className="login2-child">
              <div className="login2-child-emoji">👋</div>
              <div className="login2-h">Welcome!</div>
              <div className="login2-p">A grown-up needs to sign in once to set things up. After that, you'll pick your name and PIN right here.</div>
              <button className="login2-submit" onClick={() => setTab("parent")}>Grown-up sign in →</button>
            </div>
          ) : (
            <>
              <div className="login2-h">{mode === "signin" ? "Grown-up sign in" : "Create a family account"}</div>
              <div className="login2-p">See progress, set daily goals and manage profiles.</div>

              <form className="login2-form" onSubmit={handleSubmit}>
                {mode === "signup" && (
                  <label className="login2-field">
                    <span>CHILD NAME</span>
                    <input type="text" placeholder="Your child's name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
                  </label>
                )}
                <label className="login2-field">
                  <span>EMAIL</span>
                  <input type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                </label>
                <label className="login2-field">
                  <span>PASSWORD</span>
                  <span className="login2-pw">
                    <input
                      type={showPw ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    />
                    <button
                      type="button"
                      className="login2-eye"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      title={showPw ? "Hide password" : "Show password"}
                    >
                      <EyeIcon off={showPw} />
                    </button>
                  </span>
                </label>

                {mode === "signin" && (
                  <button type="button" className="login2-forgot" onClick={handleForgot}>Forgot password?</button>
                )}

                {(error || redirectError) && (
                  <div className="login2-error">
                    {error || friendlyError(redirectError) || "Sign-in error"}
                    {credFail && (
                      <button type="button" className="login2-error-cta" onClick={handleGoogle}>
                        <GoogleIcon /> Continue with Google
                      </button>
                    )}
                  </div>
                )}
                {notice && <div className="login2-notice">{notice}</div>}

                <button className="login2-submit" type="submit" disabled={loading}>
                  {loading ? "Please wait…" : mode === "signin" ? "Log in" : "Create account"}
                </button>
              </form>

              <div className="login2-divider"><span>or</span></div>
              <button className="login2-google" onClick={handleGoogle} disabled={loading}>
                <GoogleIcon /> Continue with Google
              </button>

              <div className="login2-toggle">
                {mode === "signin" ? "New here? " : "Already have an account? "}
                <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}>
                  {mode === "signin" ? "Create a family account" : "Log in"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
