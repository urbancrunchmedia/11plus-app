// Numbers for the private owner dashboard (/owner). Built from data the app
// already stores: Firebase Auth accounts, each account's synced game history
// (users/{uid}), public profiles (child display names), Stripe subscriptions,
// email preferences and the tuition-centre outreach queue.
// Aggregates and children's display names only: no parent emails leave here.
import { adminAuth, adminDb } from "./firebaseAdmin.js";
import { getStripe } from "./stripe.js";

const DAY = 24 * 60 * 60 * 1000;
// Same as STARTER_CUTOFF in src/utils/entitlement.js (that file imports the
// client Firebase SDK, so it can't be loaded here).
const STARTER_CUTOFF = Date.parse("2026-10-23T09:21:00Z");
// Same as COMP_EMAILS in src/contexts/PremiumContext.jsx.
const COMP_EMAILS = new Set(["reuben.dongre@gmail.com", "charlotte_dcunha@hotmail.com"]);

const GAME_NAMES = {
  synonyms: "Synonyms", antonyms: "Antonyms", compoundWords: "Compound Words", fillInBlanks: "Word Detective",
  punctuation: "Punctuation", spelling: "Spelling", wordClass: "Parts of Speech",
};

// Dates in UK local time, as the app writes them ("dd/mm/yyyy", en-GB).
const ukDay = (ms) => new Date(ms).toLocaleDateString("en-GB", { timeZone: "Europe/London" });
function parseRunDate(str) {
  const [d, m, y] = String(str || "").split("/").map(Number);
  return y ? Date.UTC(y, m - 1, d, 12) : null; // midday, so day maths ignores DST
}

async function allAuthUsers() {
  const out = [];
  let token;
  do {
    const page = await adminAuth().listUsers(1000, token);
    out.push(...page.users);
    token = page.pageToken;
  } while (token);
  return out;
}

async function subscriptionsByUid(stripe) {
  const map = new Map();
  for await (const sub of stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.customer"] })) {
    const uid = sub.customer?.metadata?.firebaseUID;
    if (!uid) continue;
    (map.get(uid) || map.set(uid, []).get(uid)).push(sub);
  }
  return map;
}

function planOf(user, subs) {
  if (COMP_EMAILS.has((user.email || "").toLowerCase())) return "Complimentary";
  const live = subs.find((s) => ["active", "trialing", "past_due"].includes(s.status));
  if (live) {
    if (live.status === "trialing") return "Free trial";
    if (live.status === "past_due") return "Payment failed";
    return live.cancel_at_period_end ? "Paying (cancelling)" : "Paying";
  }
  if (subs.length) return "Cancelled";
  return Date.parse(user.metadata.creationTime) < STARTER_CUTOFF ? "Free (original plan)" : "Free (starter set)";
}

export async function ownerStats() {
  const db = adminDb();
  const stripe = getStripe();
  const now = Date.now();
  const today = Date.parse(new Date(ukDay(now).split("/").reverse().join("-") + "T12:00:00Z"));

  const [users, histories, profiles, subsMap, emailStates, outreach, codes] = await Promise.all([
    allAuthUsers(),
    db.collection("users").get(),
    db.collection("profiles").get(),
    subscriptionsByUid(stripe),
    db.collection("emailState").get(),
    db.collection("outreach").get(),
    stripe.promotionCodes.list({ coupon: "tuition-centre-first-month", limit: 100 }),
  ]);

  const historyOf = new Map(histories.docs.map((d) => [d.id, d.data()]));
  const nameOf = new Map(profiles.docs.map((d) => [d.id, d.get("displayName")]));

  const rounds = { today: 0, week: 0, month: 0 };
  const active = { today: 0, week: 0, month: 0 };
  const byGame = {};
  const plans = {};
  const players = [];
  const signupsByDay = {};
  for (let i = 13; i >= 0; i--) signupsByDay[ukDay(now - i * DAY)] = 0;

  for (const u of users) {
    if (u.disabled) continue;
    const created = Date.parse(u.metadata.creationTime);
    if (ukDay(created) in signupsByDay) signupsByDay[ukDay(created)]++;
    const plan = planOf(u, subsMap.get(u.uid) || []);
    plans[plan] = (plans[plan] || 0) + 1;

    const h = historyOf.get(u.uid)?.history || {};
    let last = 0;
    const counts = { today: 0, week: 0, month: 0 };
    for (const [key, runs] of Object.entries(h)) {
      const game = (key.split("-")[1] || "").replace(/Ws$/, "");
      for (const r of Array.isArray(runs) ? runs : []) {
        const t = parseRunDate(r.date);
        if (!t) continue;
        last = Math.max(last, t);
        const age = Math.round((today - t) / DAY);
        if (age === 0) counts.today++;
        if (age < 7) { counts.week++; byGame[game] = byGame[game] || { week: 0, month: 0 }; byGame[game].week++; }
        if (age < 30) { counts.month++; byGame[game] = byGame[game] || { week: 0, month: 0 }; byGame[game].month++; }
      }
    }
    for (const k of Object.keys(counts)) {
      rounds[k] += counts[k];
      if (counts[k]) active[k]++;
    }
    players.push({
      name: nameOf.get(u.uid) || u.displayName || "(no name yet)",
      plan,
      signedUp: created,
      lastPlayed: last || null,
      roundsWeek: counts.week,
      roundsMonth: counts.month,
    });
  }

  const quiet = players.filter((p) => p.lastPlayed && today - p.lastPlayed >= 5 * DAY && today - p.lastPlayed <= 30 * DAY);
  const neverPlayed = players.filter((p) => !p.lastPlayed).length;

  // Trial outcomes: subscriptions whose trial has finished.
  let converted = 0, droppedAfterTrial = 0;
  for (const subs of subsMap.values()) {
    for (const s of subs) {
      if (!s.trial_end || s.trial_end * 1000 > now) continue;
      if (["active", "past_due"].includes(s.status)) converted++;
      else if (s.status === "canceled" && (!s.canceled_at || s.canceled_at <= s.trial_end + DAY / 1000)) droppedAfterTrial++;
      else if (s.status === "canceled") converted++; // paid at least once, cancelled later
    }
  }

  const outreachCounts = {};
  for (const d of outreach.docs) outreachCounts[d.get("status")] = (outreachCounts[d.get("status")] || 0) + 1;

  return {
    generatedAt: new Date(now).toISOString(),
    accounts: {
      total: players.length,
      newToday: signupsByDay[ukDay(now)] || 0,
      newWeek: users.filter((u) => now - Date.parse(u.metadata.creationTime) < 7 * DAY).length,
      newMonth: users.filter((u) => now - Date.parse(u.metadata.creationTime) < 30 * DAY).length,
      signupsByDay: Object.entries(signupsByDay).map(([day, n]) => ({ day, n })),
    },
    activity: { rounds, active, neverPlayed, quietCount: quiet.length },
    games: Object.entries(byGame)
      .map(([id, v]) => ({ game: GAME_NAMES[id] || id, ...v }))
      .sort((a, b) => b.month - a.month),
    plans,
    trials: { converted, droppedAfterTrial },
    players: players.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0) || b.signedUp - a.signedUp),
    quiet: quiet.sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 20),
    emails: { unsubscribed: emailStates.docs.filter((d) => d.get("unsubscribed")).length },
    outreach: {
      counts: outreachCounts,
      redeemed: codes.data.filter((c) => c.times_redeemed > 0)
        .map((c) => ({ code: c.code, centre: c.metadata?.centre || "", times: c.times_redeemed }))
        .sort((a, b) => b.times - a.times),
    },
  };
}
