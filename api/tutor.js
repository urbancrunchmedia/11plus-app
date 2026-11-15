// POST /api/tutor  { action, ... }  — tutors and the children connected to them.
//
// Signed-in user actions (Authorization: Bearer <Firebase ID token>):
//   { action: "apply", name, business, website?, phone? }   ask to become a tutor
//   { action: "lookup", code }     who a join code belongs to (before confirming)
//   { action: "connect", code }    connect this (child's) account to that tutor
//   { action: "newCode" }          an active tutor replaces their join code
// Owner actions (owner account or ADMIN_SECRET, see server/ownerAuth.js):
//   { action: "adminList" }                       every tutor, with pupil counts
//   { action: "approve" | "suspend" | "decline", uid }
//
// tutors/{uid}, tutorCodes/{code}, tutorLinks/{tutorUid}__{childUid} and the
// tutorLimits counters are written only here; firestore.rules lets the client
// read its own records and delete a link, nothing more.
import { createHash, randomInt } from "crypto";
import { verifyToken } from "../server/verifyToken.js";
import { checkOwner } from "../server/ownerAuth.js";
import { adminAuth, adminDb } from "../server/firebaseAdmin.js";
import {
  sendEmail, SUPPORT_INBOX, tutorApplicationEmail, tutorApprovedEmail, tutorConnectedParentEmail, tutorNewPupilEmail,
} from "../server/email.js";

const MAX_TUTORS_PER_CHILD = 3;
const HOUR = 60 * 60 * 1000;
const LIMITS = { user: 20, ip: 60 }; // code lookups + connects per hour
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O, 1/I/L
const CODE_RE = /^TUT-[2-9A-HJKMNP-Z]{8}$/;
const NOT_FOUND = "We couldn't find a tutor with that code. Check it and try again.";

const clean = (v, max) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const normaliseCode = (v) => {
  const s = String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `TUT-${s.startsWith("TUT") ? s.slice(3) : s}`;
};
const linkId = (tutorUid, childUid) => `${tutorUid}__${childUid}`;
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 32);

function newCode() {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `TUT-${s}`;
}

// A unique code, claimed in a transaction so two tutors can never share one.
async function assignCode(db, tutorUid) {
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const ref = db.collection("tutorCodes").doc(code);
    const ok = await db.runTransaction(async (tx) => {
      if ((await tx.get(ref)).exists) return false;
      tx.set(ref, { tutorUid, createdAt: new Date().toISOString() });
      return true;
    });
    if (ok) return code;
  }
  throw new Error("Couldn't create a join code. Please try again.");
}

// Per-account and per-IP limits on code guesses, so codes can't be brute-forced.
async function withinLimits(db, uid, req) {
  const ip = String(req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const buckets = [[`u-${hash(uid)}`, LIMITS.user], [`ip-${hash(ip)}`, LIMITS.ip]];
  return db.runTransaction(async (tx) => {
    const refs = buckets.map(([id]) => db.collection("tutorLimits").doc(id));
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));
    const now = Date.now();
    const next = snaps.map((snap, i) => {
      const { windowStart = 0, count = 0 } = snap.exists ? snap.data() : {};
      const fresh = now - windowStart > HOUR;
      return { fresh, windowStart: fresh ? now : windowStart, count: fresh ? 1 : count + 1, max: buckets[i][1] };
    });
    if (next.some((n) => !n.fresh && n.count > n.max)) return false;
    next.forEach((n, i) => tx.set(refs[i], { windowStart: n.windowStart, count: n.count }));
    return true;
  });
}

// The active tutor a code belongs to, or null.
async function tutorForCode(db, code) {
  if (!CODE_RE.test(code)) return null;
  const codeSnap = await db.collection("tutorCodes").doc(code).get();
  if (!codeSnap.exists) return null;
  const tutorUid = codeSnap.get("tutorUid");
  const tutor = await db.collection("tutors").doc(tutorUid).get();
  if (!tutor.exists || tutor.get("status") !== "active" || tutor.get("code") !== code) return null;
  return { uid: tutorUid, ...tutor.data() };
}

async function apply(db, who, body) {
  const name = clean(body.name, 60);
  const business = clean(body.business, 80);
  const website = clean(body.website, 120);
  const phone = clean(body.phone, 30);
  if (name.length < 2) return [400, { error: "Please enter your name." }];
  if (!body.confirm) return [400, { error: "Please confirm you're a tutor." }];
  if (!who.email) return [400, { error: "Your account needs an email address." }];
  const ref = db.collection("tutors").doc(who.uid);
  const existing = await ref.get();
  if (existing.exists) return [200, { status: existing.get("status") }];
  // A child's account can't also be a tutor: use a separate account.
  const asChild = await db.collection("tutorLinks").where("childUid", "==", who.uid).limit(1).get();
  if (!asChild.empty) return [400, { error: "This account is connected to a tutor as a pupil. Please create a separate account for tutoring." }];
  await ref.set({ status: "pending", name, business, website, phone, email: who.email, appliedAt: new Date().toISOString() });
  await sendEmail({ to: SUPPORT_INBOX, email: tutorApplicationEmail({ name, business, email: who.email, website, phone }) })
    .catch((e) => console.error("tutor application email:", e.message));
  return [200, { status: "pending" }];
}

async function lookup(db, who, body, req) {
  if (!(await withinLimits(db, who.uid, req))) return [429, { error: "Too many tries. Please wait an hour and try again." }];
  const tutor = await tutorForCode(db, normaliseCode(body.code));
  if (!tutor || tutor.uid === who.uid) return [404, { error: NOT_FOUND }];
  return [200, { tutorName: tutor.name, business: tutor.business || "" }];
}

async function connect(db, who, body, req) {
  if (!(await withinLimits(db, who.uid, req))) return [429, { error: "Too many tries. Please wait an hour and try again." }];
  const tutor = await tutorForCode(db, normaliseCode(body.code));
  if (!tutor || tutor.uid === who.uid) return [404, { error: NOT_FOUND }];
  if ((await db.collection("tutors").doc(who.uid).get()).exists) {
    return [400, { error: "Tutor accounts can't be connected to a tutor." }];
  }
  const profile = await db.collection("profiles").doc(who.uid).get();
  const childName = clean(profile.get("displayName"), 20) || "Your pupil";
  const ref = db.collection("tutorLinks").doc(linkId(tutor.uid, who.uid));
  const result = await db.runTransaction(async (tx) => {
    const mine = await tx.get(db.collection("tutorLinks").where("childUid", "==", who.uid));
    if (mine.docs.some((d) => d.id === ref.id)) return "already";
    if (mine.size >= MAX_TUTORS_PER_CHILD) return "full";
    tx.set(ref, {
      tutorUid: tutor.uid, childUid: who.uid, tutorName: tutor.name, business: tutor.business || "",
      childName, createdAt: new Date().toISOString(),
    });
    return "ok";
  });
  if (result === "already") return [200, { connected: true, already: true, tutorName: tutor.name }];
  if (result === "full") return [400, { error: `A child can be connected to up to ${MAX_TUTORS_PER_CHILD} tutors. Disconnect one first.` }];
  const parent = await adminAuth().getUser(who.uid);
  await Promise.all([
    parent.email && sendEmail({ to: parent.email, email: tutorConnectedParentEmail({ childName, tutorName: tutor.name, business: tutor.business }) }),
    tutor.email && sendEmail({ to: tutor.email, email: tutorNewPupilEmail({ tutorName: tutor.name, childName }) }),
  ].filter(Boolean)).catch((e) => console.error("tutor connect email:", e.message));
  return [200, { connected: true, tutorName: tutor.name }];
}

async function replaceCode(db, who) {
  const ref = db.collection("tutors").doc(who.uid);
  const tutor = await ref.get();
  if (!tutor.exists || tutor.get("status") !== "active") return [403, { error: "Only approved tutors have a join code." }];
  const code = await assignCode(db, who.uid);
  const old = tutor.get("code");
  await ref.update({ code });
  if (old) await db.collection("tutorCodes").doc(old).delete();
  return [200, { code }];
}

async function adminList(db) {
  const [tutors, links] = await Promise.all([db.collection("tutors").get(), db.collection("tutorLinks").get()]);
  const pupils = {};
  links.forEach((d) => { const t = d.get("tutorUid"); pupils[t] = (pupils[t] || 0) + 1; });
  return [200, {
    tutors: tutors.docs
      .map((d) => ({ uid: d.id, ...d.data(), pupils: pupils[d.id] || 0 }))
      .sort((a, b) => String(b.appliedAt).localeCompare(String(a.appliedAt))),
  }];
}

async function setStatus(db, action, uid) {
  if (!uid || typeof uid !== "string") return [400, { error: "Missing uid" }];
  const ref = db.collection("tutors").doc(uid);
  const tutor = await ref.get();
  if (!tutor.exists) return [404, { error: "No such tutor" }];
  if (action === "decline") {
    if (tutor.get("status") !== "pending") return [400, { error: "Only pending applications can be declined." }];
    await ref.delete();
    return [200, { declined: true }];
  }
  if (action === "suspend") {
    await ref.update({ status: "suspended", suspendedAt: new Date().toISOString() });
    return [200, { status: "suspended" }];
  }
  // approve (also reactivates a suspended tutor)
  const firstTime = !tutor.get("approvedAt");
  const code = tutor.get("code") || await assignCode(db, uid);
  await ref.update({ status: "active", code, approvedAt: tutor.get("approvedAt") || new Date().toISOString() });
  // A tutor (an adult) must not stay friends with any child from before.
  const friends = await db.collection("friendships").where("uids", "array-contains", uid).get();
  await Promise.all(friends.docs.map((d) => d.ref.delete()));
  if (firstTime && tutor.get("email")) {
    await sendEmail({ to: tutor.get("email"), email: tutorApprovedEmail({ name: tutor.get("name"), code }) })
      .catch((e) => console.error("tutor approved email:", e.message));
  }
  return [200, { status: "active", code }];
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const body = req.body || {};
  const send = ([status, data]) => res.status(status).json(data);
  try {
    const db = adminDb();
    if (["adminList", "approve", "suspend", "decline"].includes(body.action)) {
      const auth = await checkOwner(req);
      if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
      return send(body.action === "adminList" ? await adminList(db) : await setStatus(db, body.action, body.uid));
    }
    let who;
    try { who = await verifyToken(req); } catch { return res.status(401).json({ error: "Please sign in first." }); }
    switch (body.action) {
      case "apply": return send(await apply(db, who, body));
      case "lookup": return send(await lookup(db, who, body, req));
      case "connect": return send(await connect(db, who, body, req));
      case "newCode": return send(await replaceCode(db, who));
      default: return res.status(400).json({ error: "Unknown action" });
    }
  } catch (e) {
    console.error("tutor:", e.message);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
