import React, { useState } from "react";
import { getSetting } from "../utils/leaderboard";
import { useAuth } from "../contexts/AuthContext";
import { PRICES, stripeConfigured, startCheckout } from "../utils/subscription";
import { usePremium } from "../contexts/PremiumContext";

// Headline changes with what the child bumped into, so the ask feels relevant.
const REASONS = {
  level:   { title: "Unlock Levels B & C",            sub: "Full Access opens the harder levels and the full 11+ challenge." },
  taster:  { title: "That was today's free taster round", sub: "Free players get one round of Level B or C a day. Full Access unlocks every level, every day." },
  starter: { title: "Unlock the full word bank",      sub: "The free starter set is a small sample of each game. Full Access opens 1,000+ words across every level." },
  limit:   { title: "That's today's free rounds done", sub: "Free play resets tomorrow, or go unlimited with Full Access." },
  report:  { title: "See what to revise",             sub: "The parent progress report and 'words to review' come with Full Access." },
  feature: { title: "Unlock Full Access",             sub: "Every level, unlimited rounds, and the parent progress report." },
};

const BENEFITS = [
  "All difficulty levels: A, B & C",
  "Unlimited rounds, every day",
  "Parent progress report: spot weak words",
  "Every game, all 1,000+ words",
  "Cancel anytime",
];

function friendlyError(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("already_subscribed")) return "You already have Full Access on this account, so there's nothing more to pay. You can manage it in Settings → Manage billing.";
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed"))
    return "We couldn't reach the payment page. Check your connection and try again.";
  if (m.includes("sign") || m.includes("token") || m.includes("unauthor") || m.includes("401"))
    return "Your session expired. Please sign out, sign back in and try again.";
  if (m.includes("price") || m.includes("no such"))
    return "That plan isn't available right now. Please try the other plan, or come back shortly.";
  return "Something went wrong starting checkout. No payment was taken. Please try again.";
}

export default function Paywall({ reason = "feature", onClose }) {
  const { user } = useAuth();
  const { subscription, refreshUntilPremium } = usePremium();
  // The free trial is once per customer — don't promise it to a returning one.
  const trialEligible = subscription?.trialEligible !== false;
  const [plan, setPlan] = useState("annual");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);
  const r = REASONS[reason] || REASONS.feature;
  // Advertising rules: prices and the card step are for the bill-payer, so a
  // short grown-up check comes first. The grown-up PIN if one is set,
  // otherwise a sum most children can't do in their head.
  const pin = getSetting("childPin", "");
  const [sum] = useState(() => {
    const a = 13 + Math.floor(Math.random() * 7), b = 13 + Math.floor(Math.random() * 7);
    return { a, b, answer: a * b };
  });
  const [grownUp, setGrownUp] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [entry, setEntry] = useState("");
  const [gateErr, setGateErr] = useState("");
  function checkGate(e) {
    e.preventDefault();
    const ok = pin ? entry === pin : Number(entry) === sum.answer;
    if (ok) { setGrownUp(true); setGateErr(""); }
    else { setGateErr(pin ? "That's not the grown-up PIN." : "That's not right. Please try again."); setEntry(""); }
  }
  const price = plan === "annual" ? "£34.99 a year" : "£4.99 a month";

  async function unlock() {
    setErr(null);
    if (!user) { setErr("Please sign in first."); return; }
    const priceId = plan === "annual" ? PRICES.annual : PRICES.monthly;
    if (!priceId) { setErr("Billing isn't switched on yet. Please check back soon."); return; }
    setBusy(true);
    try {
      const result = await startCheckout(priceId);
      // Renewal switched back on for a cancelled plan: nothing to pay today.
      if (result?.resumed) { await refreshUntilPremium?.(); onClose(); return; }
      // Otherwise the browser redirects to Stripe; keep the spinner until then.
    } catch (e) {
      setErr(friendlyError(e.message));
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
        {!grownUp ? (
          <div className="pw-gate" data-testid="paywall-gate">
            <ul className="pw-benefits">
              {BENEFITS.map((b) => <li key={b}><span className="pw-tick">✓</span>{b}</li>)}
            </ul>
            {!gateOpen ? (
              <>
                <p className="pw-gate-note">Full Access is a subscription, so the next screen is for grown-ups.</p>
                <button className="pw-cta" onClick={() => setGateOpen(true)}>I'm a grown-up</button>
                <button className="pw-later" onClick={onClose}>Back to the free games</button>
              </>
            ) : (
              <form className="pw-gate-form" onSubmit={checkGate}>
                <label className="pw-gate-q" htmlFor="pw-gate-input">
                  {pin ? "Enter the grown-up PIN" : <>Grown-ups: what is {sum.a} × {sum.b}?</>}
                </label>
                <input
                  id="pw-gate-input" className="pw-gate-input" inputMode="numeric" autoComplete="off" autoFocus
                  type={pin ? "password" : "text"} value={entry}
                  onChange={(e) => setEntry(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                {gateErr && <div className="pw-err">{gateErr}</div>}
                <button className="pw-cta" type="submit" disabled={!entry}>Continue</button>
                <button type="button" className="pw-later" onClick={onClose}>Back to the free games</button>
              </form>
            )}
          </div>
        ) : (
        <>
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

        <p className="pw-terms" data-testid="paywall-terms">
          {trialEligible
            ? <>Free for 7 days, then <strong>{price}</strong>.</>
            : <><strong>{price}</strong>, starting today.</>}
          {" "}Renews automatically until you cancel. Cancel any time in Settings → Manage billing.
        </p>

        <button className="pw-cta" onClick={unlock} disabled={busy}>
          {busy ? "Opening secure checkout…" : trialEligible ? "Start 7-day free trial" : "Subscribe"}
        </button>
        <button className="pw-later" onClick={onClose}>Maybe later</button>
        <div className="pw-foot">
          A grown-up will need a card. {trialEligible ? "You won't be charged during the 7-day free trial." : "You've already used your free trial, so billing starts today."}
          {!stripeConfigured && " (Billing setup pending.)"}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
