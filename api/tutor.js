// /api/tutor — tutors and the children connected to them.
//
// POST { action, ... } as a signed-in user (Authorization: Bearer <Firebase ID token>):
//   { action: "apply", name, business, website?, phone?, confirm }   become a tutor
//   { action: "lookup", code }          who a join code belongs to (before confirming)
//   { action: "connect", code, via? }   connect this (child's) account to that tutor
//   { action: "newCode" }               a tutor replaces their join code
//   { action: "summary" }               a tutor's own pupil count (works while pending)
// POST without sign-in:
//   { action: "publicLookup", code }    tutor's name for the /join/<code> page
//   { action: "approveLink", uid, exp, t }   the owner's one-tap approve (from email)
// GET ?approve=<uid>&exp=&t=            confirm page for that one-tap approve
// Owner actions (owner account or ADMIN_SECRET, see server/ownerAuth.js):
//   { action: "adminList" }             every tutor, with pupil counts
//   { action: "approve" | "suspend" | "decline", uid }
//
// Approval: a tutor whose email (or business email domain) is on the owner's
// outreach list is approved straight away. Anyone else is "pending": they get
// their join link at once and families can connect, but firestore.rules shows
// no child's progress until the owner approves them.
//
// tutors/{uid}, tutorCodes/{code}, tutorLinks/{tutorUid}__{childUid} and the
// tutorLimits counters are written only here; firestore.rules lets the client
// read its own records and delete a link, nothing more.
import { createHash, createHmac, randomInt, timingSafeEqual } from "crypto";
import { verifyToken } from "../server/verifyToken.js";
import { checkOwner } from "../server/ownerAuth.js";
import { adminAuth, adminDb } from "../server/firebaseAdmin.js";
import {
  sendEmail, SITE, SUPPORT_INBOX, tutorApplicationEmail, tutorApprovedEmail, tutorReceivedEmail,
  tutorConnectedParentEmail, tutorNewPupilEmail,
} from "../server/email.js";

const MAX_TUTORS_PER_CHILD = 3;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const LIMITS = { user: 20, ip: 60 }; // code lookups + connects per hour
const APPROVE_LINK_DAYS = 14;
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O, 1/I/L
const CODE_RE = /^TUT-[2-9A-HJKMNP-Z]{8}$/;
const NOT_FOUND = "We couldn't find a tutor with that code. Check it and try again.";
// A shared email provider says nothing about who someone works for.
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com", "live.co.uk", "msn.com",
  "yahoo.com", "yahoo.co.uk", "icloud.com", "me.com", "mac.com", "aol.com", "btinternet.com", "sky.com",
  "virginmedia.com", "talktalk.net", "protonmail.com", "proton.me", "gmx.com", "mail.com", "ymail.com",
]);

const clean = (v, max) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const normaliseCode = (v) => {
  const s = String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `TUT-${s.startsWith("TUT") ? s.slice(3) : s}`;
};
const linkId = (tutorUid, childUid) => `${tutorUid}__${childUid}`;
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 32);
const domainOf = (email) => String(email || "").toLowerCase().split("@")[1] || "";
export const joinUrl = (code) => `${SITE}/join/${code}`;
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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

const clientIp = (req) => String(req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";

// Limits on code guesses, so codes can't be brute-forced: per account (when
// signed in) and per IP.
async function withinLimits(db, uid, req) {
  const buckets = [[`ip-${hash(clientIp(req))}`, LIMITS.ip]];
  if (uid) buckets.push([`u-${hash(uid)}`, LIMITS.user]);
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
const TOO_MANY = [429, { error: "Too many tries. Please wait an hour and try again." }];

// The tutor a code belongs to (active, or pending approval), or null.
async function tutorForCode(db, code) {
  if (!CODE_RE.test(code)) return null;
  const codeSnap = await db.collection("tutorCodes").doc(code).get();
  if (!codeSnap.exists) return null;
  const tutorUid = codeSnap.get("tutorUid");
  const tutor = await db.collection("tutors").doc(tutorUid).get();
  if (!tutor.exists || !["active", "pending"].includes(tutor.get("status")) || tutor.get("code") !== code) return null;
  return { uid: tutorUid, ...tutor.data() };
}

// Is this applicant someone the owner already contacted (outreach list)?
async function knownTutor(db, email) {
  const all = await db.collection("outreach").get();
  const mine = String(email).toLowerCase();
  const domain = domainOf(mine);
  const match = all.docs.find((d) => {
    const e = String(d.get("email") || "").toLowerCase();
    return e === mine || (domain && !FREE_MAIL.has(domain) && domainOf(e) === domain);
  });
  return match ? { business: match.get("business") || "", outreachEmail: match.get("email") } : null;
}

// ---- One-tap approve link in the owner's email ----
function approveToken(uid, exp) {
  const key = (process.env.ADMIN_SECRET || "").trim();
  if (!key) throw new Error("ADMIN_SECRET is not set");
  return createHmac("sha256", key).update(`approve-tutor:${uid}:${exp}`).digest("base64url");
}
function approveLink(uid) {
  const exp = Date.now() + APPROVE_LINK_DAYS * DAY;
  return `${SITE}/api/tutor?approve=${encodeURIComponent(uid)}&exp=${exp}&t=${approveToken(uid, exp)}`;
}
function validApproveToken(uid, exp, t) {
  if (!uid || !t || !(Number(exp) > Date.now())) return false;
  const a = Buffer.from(approveToken(String(uid), String(exp)));
  const b = Buffer.from(String(t));
  return a.length === b.length && timingSafeEqual(a, b);
}
function page(res, status, title, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title>
<style>body{font-family:-apple-system,Helvetica,Arial,sans-serif;background:#eef6ff;color:#0e1116;margin:0;padding:40px 20px}main{max-width:440px;margin:0 auto;background:#fff;border-radius:22px;padding:28px;text-align:center}h1{font-size:1.4rem}button,a.btn{display:inline-block;border:0;background:#d4f520;color:#0e1116;font-weight:800;font-size:1rem;padding:14px 26px;border-radius:999px;cursor:pointer;text-decoration:none;margin-top:8px}p{line-height:1.5;color:#3e4a58}</style></head><body><main>${body}</main></body></html>`);
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

  // Rounds this account has played as a learner: shown to the owner when
  // approving (a hint it might be a child's account). Not a blocker.
  const history = (await db.collection("users").doc(who.uid).get()).get("history") || {};
  const learnerRounds = Object.values(history).reduce((n, runs) => n + (Array.isArray(runs) ? runs.length : 0), 0);
  const known = await knownTutor(db, who.email);
  const now = new Date().toISOString();
  const code = await assignCode(db, who.uid);
  const status = known ? "active" : "pending";
  await ref.set({
    status, name, business: business || known?.business || "", website, phone, email: who.email, code, appliedAt: now, learnerRounds,
    ...(known ? { approvedAt: now, autoApproved: true, matchedOutreach: known.outreachEmail } : {}),
  });
  if (known) await removeFriendships(db, who.uid);
  await Promise.all([
    sendEmail({ to: SUPPORT_INBOX, email: tutorApplicationEmail({
      name, business, email: who.email, website, phone, learnerRounds, autoApproved: !!known, approveUrl: known ? null : approveLink(who.uid),
    }) }),
    sendEmail({ to: who.email, email: known ? tutorApprovedEmail({ name, code, link: joinUrl(code) }) : tutorReceivedEmail({ name, code, link: joinUrl(code) }) }),
  ]).catch((e) => console.error("tutor apply email:", e.message));
  return [200, { status, code }];
}

async function lookup(db, uid, body, req) {
  if (!(await withinLimits(db, uid, req))) return TOO_MANY;
  const tutor = await tutorForCode(db, normaliseCode(body.code));
  if (!tutor || tutor.uid === uid) return [404, { error: NOT_FOUND }];
  return [200, { tutorName: tutor.name, business: tutor.business || "", pending: tutor.status === "pending" }];
}

async function connect(db, who, body, req) {
  if (!(await withinLimits(db, who.uid, req))) return TOO_MANY;
  const tutor = await tutorForCode(db, normaliseCode(body.code));
  if (!tutor || tutor.uid === who.uid) return [404, { error: NOT_FOUND }];
  if ((await db.collection("tutors").doc(who.uid).get()).exists) {
    return [400, { error: "Tutor accounts can't be connected to a tutor." }];
  }
  const [profile, account] = await Promise.all([db.collection("profiles").doc(who.uid).get(), adminAuth().getUser(who.uid)]);
  const childName = clean(profile.get("displayName"), 20) || clean(account.displayName, 20) || "Your pupil";
  // Joined through the tutor's link soon after signing up: a family the tutor brought in.
  const newFamily = Date.now() - Date.parse(account.metadata.creationTime) < 2 * DAY;
  const ref = db.collection("tutorLinks").doc(linkId(tutor.uid, who.uid));
  const result = await db.runTransaction(async (tx) => {
    const mine = await tx.get(db.collection("tutorLinks").where("childUid", "==", who.uid));
    if (mine.docs.some((d) => d.id === ref.id)) return "already";
    if (mine.size >= MAX_TUTORS_PER_CHILD) return "full";
    tx.set(ref, {
      tutorUid: tutor.uid, childUid: who.uid, tutorName: tutor.name, business: tutor.business || "",
      childName, createdAt: new Date().toISOString(), via: body.via === "link" ? "link" : "code", newFamily,
    });
    return "ok";
  });
  const pending = tutor.status === "pending";
  if (result === "already") return [200, { connected: true, already: true, tutorName: tutor.name, pending }];
  if (result === "full") return [400, { error: `A child can be connected to up to ${MAX_TUTORS_PER_CHILD} tutors. Disconnect one first.` }];
  await Promise.all([
    account.email && sendEmail({ to: account.email, email: tutorConnectedParentEmail({ childName, tutorName: tutor.name, business: tutor.business, pending }) }),
    tutor.email && sendEmail({ to: tutor.email, email: tutorNewPupilEmail({ tutorName: tutor.name, childName, pending }) }),
  ].filter(Boolean)).catch((e) => console.error("tutor connect email:", e.message));
  return [200, { connected: true, tutorName: tutor.name, pending }];
}

async function replaceCode(db, who) {
  const ref = db.collection("tutors").doc(who.uid);
  const tutor = await ref.get();
  if (!tutor.exists || !["active", "pending"].includes(tutor.get("status"))) return [403, { error: "Only tutors have a join code." }];
  const code = await assignCode(db, who.uid);
  const old = tutor.get("code");
  await ref.update({ code });
  if (old) await db.collection("tutorCodes").doc(old).delete();
  return [200, { code }];
}

// While pending, a tutor can't read link docs (they hold children's names),
// so the dashboard gets just the count from here.
async function summary(db, who) {
  const tutor = await db.collection("tutors").doc(who.uid).get();
  if (!tutor.exists) return [404, { error: "Not a tutor" }];
  const links = await db.collection("tutorLinks").where("tutorUid", "==", who.uid).count().get();
  return [200, { status: tutor.get("status"), pupils: links.data().count }];
}

async function adminList(db) {
  const [tutors, links] = await Promise.all([db.collection("tutors").get(), db.collection("tutorLinks").get()]);
  const stats = {};
  links.forEach((d) => {
    const s = (stats[d.get("tutorUid")] ||= { pupils: 0, viaLink: 0, newFamilies: 0 });
    s.pupils++;
    if (d.get("via") === "link") s.viaLink++;
    if (d.get("newFamily")) s.newFamilies++;
  });
  return [200, {
    tutors: tutors.docs
      .map((d) => ({ uid: d.id, ...d.data(), pupils: 0, viaLink: 0, newFamilies: 0, ...stats[d.id] }))
      .sort((a, b) => String(b.appliedAt).localeCompare(String(a.appliedAt))),
  }];
}

async function removeFriendships(db, uid) {
  // A tutor (an adult) must not stay friends with any child from before.
  const [friends, sent, received] = await Promise.all([
    db.collection("friendships").where("uids", "array-contains", uid).get(),
    db.collection("friendRequests").where("from", "==", uid).get(),
    db.collection("friendRequests").where("to", "==", uid).get(),
  ]);
  await Promise.all([...friends.docs, ...sent.docs, ...received.docs].map((d) => d.ref.delete()));
}

async function setStatus(db, action, uid) {
  if (!uid || typeof uid !== "string") return [400, { error: "Missing uid" }];
  const ref = db.collection("tutors").doc(uid);
  const tutor = await ref.get();
  if (!tutor.exists) return [404, { error: "No such tutor" }];
  if (action === "decline") {
    if (tutor.get("status") !== "pending") return [400, { error: "Only pending applications can be declined." }];
    // Families who connected while it was pending are disconnected.
    const links = await db.collection("tutorLinks").where("tutorUid", "==", uid).get();
    await Promise.all([
      ...links.docs.map((d) => d.ref.delete()),
      tutor.get("code") ? db.collection("tutorCodes").doc(tutor.get("code")).delete() : null,
      ref.delete(),
    ]);
    return [200, { declined: true, disconnected: links.size }];
  }
  if (action === "suspend") {
    await ref.update({ status: "suspended", suspendedAt: new Date().toISOString() });
    return [200, { status: "suspended" }];
  }
  // approve (also reactivates a suspended tutor)
  const firstTime = !tutor.get("approvedAt");
  const code = tutor.get("code") || await assignCode(db, uid);
  await ref.update({ status: "active", code, approvedAt: tutor.get("approvedAt") || new Date().toISOString() });
  await removeFriendships(db, uid);
  if (firstTime && tutor.get("email")) {
    await sendEmail({ to: tutor.get("email"), email: tutorApprovedEmail({ name: tutor.get("name"), code, link: joinUrl(code) }) })
      .catch((e) => console.error("tutor approved email:", e.message));
  }
  return [200, { status: "active", code }];
}

// GET: a confirm page only. Email link scanners open links on their own, so
// the approval itself needs the button press (a POST).
async function approvePage(req, res) {
  const { approve: uid, exp, t } = req.query || {};
  if (!validApproveToken(uid, exp, t)) return page(res, 400, "Link expired", "<h1>This link has expired</h1><p>Approve the tutor from your owner dashboard instead.</p><a class=\"btn\" href=\"/owner\">Open the dashboard</a>");
  const tutor = await adminDb().collection("tutors").doc(String(uid)).get();
  if (!tutor.exists) return page(res, 404, "Not found", "<h1>No such tutor</h1><p>They may have been declined already.</p>");
  if (tutor.get("status") === "active") return page(res, 200, "Already approved", `<h1>${escapeHtml(tutor.get("name"))} is already approved ✓</h1>`);
  const t2 = escapeHtml(t);
  return page(res, 200, "Approve tutor", `<h1>Approve ${escapeHtml(tutor.get("name"))}?</h1>
<p>${escapeHtml(tutor.get("business") || "")}<br>${escapeHtml(tutor.get("email") || "")}${tutor.get("website") ? `<br>${escapeHtml(tutor.get("website"))}` : ""}</p>
<form method="post" action="/api/tutor"><input type="hidden" name="action" value="approveLink"><input type="hidden" name="uid" value="${escapeHtml(uid)}"><input type="hidden" name="exp" value="${escapeHtml(exp)}"><input type="hidden" name="t" value="${t2}"><button type="submit">Approve</button></form>`);
}

async function approveFromLink(req, res, body) {
  if (!validApproveToken(body.uid, body.exp, body.t)) return page(res, 400, "Link expired", "<h1>This link has expired</h1><p>Approve the tutor from your owner dashboard instead.</p>");
  const [status, data] = await setStatus(adminDb(), "approve", String(body.uid));
  if (status !== 200) return page(res, status, "Couldn't approve", `<h1>Couldn't approve</h1><p>${escapeHtml(data.error || "")}</p>`);
  return page(res, 200, "Approved", "<h1>Approved ✓</h1><p>They've been emailed, and can now see the progress of pupils who connect.</p><a class=\"btn\" href=\"/owner\">Open the dashboard</a>");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET" && req.query?.approve) return approvePage(req, res);
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const body = req.body || {};
    const send = ([status, data]) => res.status(status).json(data);
    const db = adminDb();

    if (body.action === "approveLink") return approveFromLink(req, res, body);
    if (body.action === "publicLookup") {
      const [status, data] = await lookup(db, null, body, req);
      return res.status(status).json(status === 200 ? { tutorName: data.tutorName, business: data.business } : data);
    }
    if (["adminList", "approve", "suspend", "decline"].includes(body.action)) {
      const auth = await checkOwner(req);
      if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
      return send(body.action === "adminList" ? await adminList(db) : await setStatus(db, body.action, body.uid));
    }
    let who;
    try { who = await verifyToken(req); } catch { return res.status(401).json({ error: "Please sign in first." }); }
    switch (body.action) {
      case "apply": return send(await apply(db, who, body));
      case "lookup": return send(await lookup(db, who.uid, body, req));
      case "connect": return send(await connect(db, who, body, req));
      case "newCode": return send(await replaceCode(db, who));
      case "summary": return send(await summary(db, who));
      default: return res.status(400).json({ error: "Unknown action" });
    }
  } catch (e) {
    console.error("tutor:", e.message);
    if (!res.headersSent) res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
