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
    case "auth/too-many-requests":      return "Too many attempts. Please try again later.";
    case "auth/operation-not-allowed":  return "Email/Password sign-in is not enabled. Please enable it in Firebase Console → Authentication → Sign-in method.";
    case "auth/popup-blocked":         return "Popup was blocked — please allow popups for this site.";
    case "auth/popup-closed-by-user":  return "Sign-in window was closed. Please try again.";
    case "auth/unauthorized-domain":   return "This domain isn't authorised in Firebase. Add it in Firebase Console → Authentication → Settings → Authorised domains.";
    case "auth/cancelled-popup-request": return null; // user opened another popup, ignore
    default:                           return message || "Something went wrong. Please try again.";
  }
}

export default function LoginScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, redirectError } = useAuth();

  const [mode, setMode]         = useState("signin"); // "signin" | "signup"
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUpWithEmail(email, password, name);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      console.error("Auth error:", err.code, err.message);
      const msg = friendlyError(err.code, err.message);
      if (msg) setError(msg);
    }
    setLoading(false);
  }

  async function handleGoogle() {
    setError("");
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("Google sign-in error:", err.code, err.message);
      const msg = friendlyError(err.code, err.message);
      if (msg) setError(msg);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">

        <div className="login-header">
          <span className="login-logo">🎓</span>
          <h1 className="login-title">11+ Prep</h1>
          <p className="login-subtitle">
            {mode === "signin" ? "Welcome back! Sign in to continue." : "Create your account to get started."}
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="login-field">
              <label>Child Name</label>
              <input
                type="text"
                placeholder="Child's name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          )}

          <div className="login-field">
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          {(error || redirectError) && (
            <div className="login-error">
              {error || friendlyError(redirectError) || `Sign-in error: ${redirectError}`}
            </div>
          )}

          <button className="login-submit-btn" type="submit" disabled={loading}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="login-divider"><span>or</span></div>

        <button className="google-signin-btn google-signin-full" onClick={handleGoogle} disabled={loading}>
          <GoogleIcon />
          Continue with Google
        </button>

        <p className="login-toggle">
          {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
          <button
            className="login-toggle-btn"
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </p>

      </div>
    </div>
  );
}
