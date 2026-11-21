import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { getTutorRecord } from "../utils/tutor";

// Whether the signed-in account is a tutor: { tutor, isTutor, isActiveTutor, loading, refresh }.
// `tutor` is the tutors/{uid} record (any status) or null.
const TutorContext = createContext(null);

export function TutorProvider({ children }) {
  const { user } = useAuth();
  const [tutor, setTutor] = useState(null);
  const [loading, setLoading] = useState(true);
  // Which account the tutor record was last read for. Until it matches the
  // signed-in account we're still loading (avoids a render where a tutor who
  // just signed in briefly looks like a family).
  const [checkedUid, setCheckedUid] = useState(undefined);

  const refresh = useCallback(async () => {
    if (!user) { setTutor(null); setLoading(false); setCheckedUid(null); return null; }
    try {
      const t = await getTutorRecord(user.uid);
      setTutor(t);
      return t;
    } catch {
      setTutor(null); // offline or no access: treat as not a tutor
      return null;
    } finally {
      setLoading(false);
      setCheckedUid(user.uid);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-reading the tutor record whenever the signed-in account changes.
    setLoading(true);
    refresh();
  }, [refresh]);

  const value = { tutor, isTutor: !!tutor, isActiveTutor: tutor?.status === "active", loading: loading || checkedUid !== (user?.uid ?? null), refresh };
  return <TutorContext.Provider value={value}>{children}</TutorContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- same pattern as AuthContext: the useX() hook belongs beside its Provider.
export function useTutor() {
  return useContext(TutorContext) || { tutor: null, isTutor: false, isActiveTutor: false, loading: false, refresh: async () => null };
}
