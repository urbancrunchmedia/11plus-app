import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { PRICES, stripeConfigured, startCheckout } from "../utils/subscription";

// Headline changes with what the child bumped into, so the ask feels relevant.
const REASONS = {
  level:   { title: "Unlock Levels B & C",            sub: "Level A is free forever. Full Access opens the harder levels and the full 11+ challenge." },
  limit:   { title: "That's today's free rounds done", sub: "Free play resets tomorrow — or go unlimited with Full Access." },
  report:  { title: "See what to revise",             sub: "The parent progress report and 'words to review' come with Full Access." },
  feature: { title: "Unlock Full Access",             sub: "Every level, unlimited rounds, and the parent progress report." },
};

const BENEFITS = [
  "All difficulty levels — A, B & C",
  "Unlimited rounds, every day",
  "Parent progress report — spot weak words",
  "Every game · all 776 words",
  "7-day free trial · cancel anytime",
];

export default function Paywall({ reason = "feature", onClose }) {
  const { user } = useAuth();
  const [plan, setPlan] = useState("annual");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);
  const r = REASONS[reason] || REASONS.feature;

  async function unlock() {
    setErr(null);
    if (!user) { setErr("Please sign in first."); return; }
    const priceId = plan === "annual" ? PRICES.annual : PRICES.monthly;
    if (!priceId) { setErr("Billing isn't switched on yet — please check back soon."); return; }
    setBusy(true);
    try {
      await startCheckout(priceId);
      // On success the browser redirects to Stripe; keep the spinner until then.
    } catch (e) {
      setErr(e.message || "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="pw-overlay" onClick={onClose}>
      <div className="pw" onClick={(e) => e.stopPropagation()}>
        <button className="pw-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="pw-badge">FULL ACCESS</div>
        <h2 className="pw-title">{r.title}</h2>
        <p className="pw-sub">{r.sub}</p>

        <ul className="pw-benefits">
          {BENEFITS.map((b) => <li key={b}><span className="pw-tick">✓</span>{b}</li>)}
        </ul>

        <div className="pw-plans">
          <button className={`pw-plan ${plan === "annual" ? "active" : ""}`} onClick={() => setPlan("annual")}>
            <span className="pw-plan-tag">BEST VALUE · SAVE 40%</span>
            <span className="pw-plan-price">£34.99<small>/year</small></span>
            <span className="pw-plan-note">Just £2.92 a month</span>
          </button>
          <button className={`pw-plan ${plan === "monthly" ? "active" : ""}`} onClick={() => setPlan("monthly")}>
            <span className="pw-plan-price">£4.99<small>/month</small></span>
            <span className="pw-plan-note">Cancel anytime</span>
          </button>
        </div>

        {err && <div className="pw-err">{err}</div>}

        <button className="pw-cta" onClick={unlock} disabled={busy}>
          {busy ? "Opening secure checkout…" : "Start 7-day free trial"}
        </button>
        <button className="pw-later" onClick={onClose}>Maybe later</button>
        <div className="pw-foot">
          A grown-up will need a card. You won't be charged during the free trial.
          {!stripeConfigured && " (Billing setup pending.)"}
        </div>
      </div>
    </div>
  );
}
