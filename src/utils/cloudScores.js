import {
  doc, getDoc, setDoc, deleteDoc,
  collection, query, where, getDocs, limit,
} from "firebase/firestore";
import { db } from "../firebase";

// A friendship is one shared doc both people can read, so it's mutual.
// ID is the two uids sorted + joined, so either party computes the same id.
function pairId(a, b) {
  return [a, b].sort().join("__");
}

const BEST_KEY    = "11plus_personal_bests";
const HISTORY_KEY = "11plus_history";

function localBests()   { try { return JSON.parse(localStorage.getItem(BEST_KEY))    || {}; } catch { return {}; } }
function localHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || {}; } catch { return {}; } }

// Leaderboard metrics: total stars + a per-game breakdown.
// Keys are "level-gameType-totalQuestions" (gameType has no dashes).
function computeStats() {
  const byGame = { wordMatch: 0, fillInBlanks: 0, punctuation: 0 };
  let total = 0;
  for (const [key, b] of Object.entries(localBests())) {
    const stars = (b && b.stars) || 0;
    total += stars;
    const gameType = key.split("-")[1];
    if (gameType === "synonyms" || gameType === "antonyms") byGame.wordMatch += stars;
    else if (gameType === "fillInBlanks") byGame.fillInBlanks += stars;
    else if (gameType === "punctuation") byGame.punctuation += stars;
  }
  return { total, byGame };
}

function isBetter(a, b) {
  if (!b) return true;
  return a.stars > b.stars ||
    (a.stars === b.stars && a.wrong < b.wrong) ||
    (a.stars === b.stars && a.wrong === b.wrong && (a.time ?? 0) < (b.time ?? 0));
}

// On sign-in: pull cloud data and merge into localStorage (best score wins)
export async function mergeFromCloud(userId) {
  try {
    const snap = await getDoc(doc(db, "users", userId));
    if (!snap.exists()) return;

    const { bests: cloudBests = {}, history: cloudHistory = {} } = snap.data();

    const merged = { ...localBests() };
    for (const [key, cloud] of Object.entries(cloudBests)) {
      if (isBetter(cloud, merged[key])) merged[key] = cloud;
    }
    localStorage.setItem(BEST_KEY, JSON.stringify(merged));

    const localH = localHistory();
    const mergedH = { ...cloudHistory };
    for (const [key, runs] of Object.entries(localH)) {
      if (!mergedH[key]) mergedH[key] = runs;
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(mergedH));
  } catch (e) {
    console.error("mergeFromCloud:", e);
  }
}

// ── Friends & leaderboard ────────────────────────────────────────────────

// Unambiguous alphabet (no 0/O/1/I/L) for kid-friendly codes
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function generateCode() {
  let s = "";
  for (let i = 0; i < 5; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return "WM-" + s;
}

export async function getProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "profiles", uid));
    return snap.exists() ? { uid, ...snap.data() } : null;
  } catch (e) {
    console.error("getProfile:", e);
    return null;
  }
}

// Create/refresh the public profile (name, photo, friend code, points).
export async function syncProfile(user) {
  if (!user) return null;
  const uid = user.uid;
  try {
    const existing = await getProfile(uid);
    const code = existing?.code || generateCode();
    const { total, byGame } = computeStats();
    await setDoc(doc(db, "profiles", uid), {
      displayName: user.displayName || (user.email ? user.email.split("@")[0] : "Player"),
      photoURL: user.photoURL || "",
      code,
      points: total,
      byGame,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return code;
  } catch (e) {
    console.error("syncProfile:", e);
    return null;
  }
}

// After each game: push private data, then refresh the public profile.
// Accepts a user object (preferred) or a bare uid string (back-compat).
export async function pushToCloud(user) {
  const uid = typeof user === "string" ? user : user?.uid;
  if (!uid) return;
  try {
    await setDoc(
      doc(db, "users", uid),
      { bests: localBests(), history: localHistory(), updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (e) {
    console.error("pushToCloud:", e);
  }
  if (typeof user === "object" && user) await syncProfile(user);
}

// Add a friend by their code. Returns { ok, friend } or { ok:false, error }.
export async function addFriendByCode(uid, codeRaw) {
  const code = (codeRaw || "").trim().toUpperCase();
  if (!code) return { ok: false, error: "Please enter a code." };
  try {
    const q = query(collection(db, "profiles"), where("code", "==", code), limit(1));
    const res = await getDocs(q);
    if (res.empty) return { ok: false, error: "No player found with that code." };
    const friendDoc = res.docs[0];
    if (friendDoc.id === uid) return { ok: false, error: "That's your own code!" };
    // One shared friendship doc → both sides see each other (mutual).
    await setDoc(doc(db, "friendships", pairId(uid, friendDoc.id)), {
      uids: [uid, friendDoc.id].sort(),
      createdAt: new Date().toISOString(),
    }, { merge: true });
    return { ok: true, friend: { uid: friendDoc.id, ...friendDoc.data() } };
  } catch (e) {
    console.error("addFriendByCode:", e);
    return { ok: false, error: "Couldn't add friend — please try again." };
  }
}

// Remove a friend — deletes the shared friendship doc (affects both sides).
export async function removeFriend(uid, friendUid) {
  try {
    await deleteDoc(doc(db, "friendships", pairId(uid, friendUid)));
    return true;
  } catch (e) {
    console.error("removeFriend:", e);
    return false;
  }
}

// Leaderboard = me + everyone I share a friendship with, ranked by points.
export async function getLeaderboard(uid) {
  try {
    const edges = await getDocs(
      query(collection(db, "friendships"), where("uids", "array-contains", uid))
    );
    const friendUids = new Set();
    edges.forEach((d) => (d.data().uids || []).forEach((u) => { if (u !== uid) friendUids.add(u); }));
    const uids = [uid, ...friendUids];
    const profiles = await Promise.all(uids.map((u) => getProfile(u)));
    return profiles
      .filter(Boolean)
      .map((p) => ({ ...p, isMe: p.uid === uid }))
      .sort((a, b) => (b.points || 0) - (a.points || 0));
  } catch (e) {
    console.error("getLeaderboard:", e);
    return [];
  }
}
