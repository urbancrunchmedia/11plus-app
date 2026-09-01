import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { watchSubscription } from "../utils/subscription";
import Paywall from "../components/Paywall";

const PremiumContext = createContext(null);

// Set localStorage.11plus_dev_premium = "1" in the console to preview the
// premium experience without a live Stripe subscription (dev/testing only).
const DEV_KEY = "11plus_dev_premium";

export function PremiumProvider({ children }) {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [paywall, setPaywall]     = useState(null); // null | reason string

  useEffect(() => {
    try {
      if (localStorage.getItem(DEV_KEY) === "1") { setIsPremium(true); setLoading(false); return; }
    } catch { /* ignore */ }

    if (!user) { setIsPremium(false); setLoading(false); return; }
    setLoading(true);
    const unsub = watchSubscription(user.uid, ({ isPremium }) => {
      setIsPremium(isPremium);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const openPaywall  = useCallback((reason = "feature") => setPaywall(reason), []);
  const closePaywall = useCallback(() => setPaywall(null), []);

  return (
    <PremiumContext.Provider value={{ isPremium, loading, openPaywall, closePaywall }}>
      {children}
      {paywall && !isPremium && <Paywall reason={paywall} onClose={closePaywall} />}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  return useContext(PremiumContext) || { isPremium: false, loading: false, openPaywall: () => {}, closePaywall: () => {} };
}
