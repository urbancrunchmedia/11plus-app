import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import { fetchSubscription } from "../utils/subscription";
import Paywall from "../components/Paywall";

const PremiumContext = createContext(null);

// Set localStorage.11plus_dev_premium = "1" in the console to preview the
// premium experience without a live Stripe subscription (dev/testing only).
const DEV_KEY = "11plus_dev_premium";

// Comp accounts: these emails always get Full Access, no subscription needed
// (owner/testing). Client-side grant — real paid access comes from Stripe.
const COMP_EMAILS = new Set([
  "reuben.dongre@gmail.com",
]);

const FREE = { isPremium: false, status: "none" };
const COMP = { isPremium: true, status: "comp" };

export function PremiumProvider({ children }) {
  const { user } = useAuth();
  const [sub, setSub]         = useState(FREE);
  const [loading, setLoading] = useState(true);
  const [paywall, setPaywall] = useState(null); // null | reason string
  const granted = useRef(false); // comp/dev override — skip network refreshes

  const load = useCallback(async () => {
    if (granted.current) return;
    const next = await fetchSubscription();
    setSub(next);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    granted.current = false;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a real external source of truth (localStorage / auth user change), not derived from props.
      if (localStorage.getItem(DEV_KEY) === "1") { granted.current = true; setSub(COMP); setLoading(false); return; }
    } catch { /* ignore */ }

    if (!user) { setSub(FREE); setLoading(false); return; }
    if (user.email && COMP_EMAILS.has(user.email.toLowerCase())) {
      granted.current = true; setSub(COMP); setLoading(false); return;
    }
    setLoading(true);
    let cancelled = false;
    fetchSubscription().then((next) => { if (!cancelled) { setSub(next); setLoading(false); } });
    return () => { cancelled = true; };
  }, [user]);

  // Re-check whenever the tab regains focus — covers coming back from Stripe
  // Checkout or the billing portal, where the plan may have just changed.
  useEffect(() => {
    if (!user || granted.current) return;
    const onFocus = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [user, load]);

  // After checkout, Stripe can take a moment to finish creating the
  // subscription — poll briefly so the UI flips to Full Access on its own.
  const refreshUntilPremium = useCallback(async (tries = 6) => {
    for (let i = 0; i < tries; i++) {
      const next = await load();
      if (next?.isPremium) return next;
      await new Promise((r) => setTimeout(r, 1200));
    }
    return load();
  }, [load]);

  const openPaywall  = useCallback((reason = "feature") => setPaywall(reason), []);
  const closePaywall = useCallback(() => setPaywall(null), []);

  const value = {
    isPremium: sub.isPremium,
    subscription: sub,
    loading,
    refresh: load,
    refreshUntilPremium,
    openPaywall,
    closePaywall,
  };

  return (
    <PremiumContext.Provider value={value}>
      {children}
      {/* Suppress only when there is truly nothing to sell — fully premium and
          not on a cancelled/trial track. Resubscribing during the paid-out
          tail of a cancelled plan is exactly the case this must NOT block. */}
      {paywall && (!sub.isPremium || sub.cancelAtPeriodEnd || sub.status === "trialing") &&
        <Paywall reason={paywall} onClose={closePaywall} />}
    </PremiumContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- same pattern as AuthContext: the useX() hook belongs beside its Provider.
export function usePremium() {
  return useContext(PremiumContext) || {
    isPremium: false, subscription: FREE, loading: false,
    refresh: () => {}, refreshUntilPremium: () => {},
    openPaywall: () => {}, closePaywall: () => {},
  };
}
