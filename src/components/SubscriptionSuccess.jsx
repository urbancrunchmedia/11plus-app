import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { usePremium } from "../contexts/PremiumContext";
import Icon from "./Icon";

// eslint-disable-next-line react-refresh/only-export-components -- a plain formatting helper used only by this screen; not worth a separate file for a dev-only warning.
export function formatDate(ms) {
  if (!ms) return null;
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const PERKS = [
  "All difficulty levels — A, B & C",
  "Unlimited rounds, every day",
  "Parent progress report",
];

// Shown once, right after Stripe Checkout succeeds.
export default function SubscriptionSuccess({ onStart }) {
  const { user } = useAuth();
  const { subscription, loading } = usePremium();
  const firstName = (user?.displayName || "").trim().split(/\s+/)[0] || "there";
  const trialEnds = formatDate(subscription?.trialEnd);
  const renews    = formatDate(subscription?.currentPeriodEnd);

  return (
    <div className="subok-overlay">
      <div className="subok">
        <div className="subok-badge">FULL ACCESS UNLOCKED</div>
        <div className="subok-ic"><Icon name="trophy" size={54} stroke="var(--accent)" strokeWidth={1.9} /></div>
        <h2 className="subok-title">You're in, {firstName}!</h2>
        <p className="subok-sub">
          {loading
            ? "Setting up your account…"
            : trialEnds
              ? `Your 7-day free trial has started — you won't be charged until ${trialEnds}.`
              : renews
                ? `Your subscription is active. Next payment ${renews}.`
                : "Your subscription is active."}
        </p>

        <ul className="subok-perks">
          {PERKS.map((p) => (
            <li key={p}><span className="subok-tick">✓</span>{p}</li>
          ))}
        </ul>

        <button className="subok-cta" onClick={onStart}>
          <span>Start playing</span><span className="dash-hero-arrow">→</span>
        </button>
        <div className="subok-foot">You can cancel any time from Settings → Manage billing.</div>
      </div>
    </div>
  );
}
