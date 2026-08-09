import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

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

function friendlyError(code, message) {
  switch (code) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":    return "Incorrect email or password.";
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
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, redirectError } = useAuth();

  const [tab, setTab]           = useState("parent"); // "child" | "parent"
  const [mode, setMode]         = useState("signin");  // "signin" | "signup"
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (mode === "signup") await signUpWithEmail(email, password, name);
      else await signInWithEmail(email, password);
    } catch (err) {
      const msg = friendlyError(err.code, err.message);
      if (msg) setError(msg);
    }
    setLoading(false);
  }

  async function handleGoogle() {
    setError("");
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
          <div className="login2-tagline">Ten minutes a day beats an hour on Sunday.</div>
          <div className="login2-blurb">Vocabulary, punctuation and compound words for the 11+ — as short daily rounds you'll actually want to finish.</div>
        </div>
        <div className="login2-stats">
          <div className="login2-stat">🔥 Build a daily streak</div>
          <div className="login2-stat">📚 700+ words to master</div>
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
                  <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === "signup" ? "new-password" : "current-password"} />
                </label>

                {(error || redirectError) && (
                  <div className="login2-error">{error || friendlyError(redirectError) || "Sign-in error"}</div>
                )}

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
