// Sending email through Resend, plus the templates and the unsubscribe links.
//
// Two kinds of email:
//  - transactional (welcome, trial ending): about the account itself, always sent.
//  - marketing (announcements, inactivity nudges): carry an unsubscribe link and
//    are skipped for anyone in emailState/{uid}.unsubscribed. UK PECR requires
//    that opt-out on every marketing email.
import { Resend } from "resend";
import { createHmac, timingSafeEqual } from "crypto";

const FROM = "11 Plus Lab <hello@11pluslab.com>";
const REPLY_TO = "hello@11pluslab.com";
export const SITE = "https://11pluslab.com";

// Resend's free plan allows 100 emails a day; every bulk sender stays under this.
export const DAILY_CAP = 90;

let _resend;
function resend() {
  if (!_resend) _resend = new Resend((process.env.RESEND_API_KEY || "").trim());
  return _resend;
}

const secret = () => (process.env.EMAIL_UNSUB_SECRET || "").trim();

export function unsubToken(uid) {
  return createHmac("sha256", secret()).update(`unsub:${uid}`).digest("base64url");
}

export function checkUnsubToken(uid, token) {
  if (!uid || !token || !secret()) return false;
  const a = Buffer.from(unsubToken(uid));
  const b = Buffer.from(String(token));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unsubUrl(uid) {
  return `${SITE}/api/email/unsubscribe?u=${encodeURIComponent(uid)}&t=${unsubToken(uid)}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// One shared layout so every email looks like the app (EduCore blue/lime/ink).
function layout({ heading, paragraphs, cta, footerUid }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#0E1116">${p}</p>`).join("");
  const button = cta
    ? `<p style="margin:24px 0"><a href="${cta.url}" style="display:inline-block;background:#D4F520;color:#0E1116;font-weight:800;text-decoration:none;padding:14px 26px;border-radius:14px;border-bottom:4px solid #A8C400">${escapeHtml(cta.label)}</a></p>`
    : "";
  const unsub = footerUid
    ? `<br><a href="${unsubUrl(footerUid)}" style="color:#5B6675">Unsubscribe from updates and reminders</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F4F9FF;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F9FF;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="background:#12A5FF;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:800">11 Plus Lab</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#0E1116">${escapeHtml(heading)}</h1>
${body}${button}
</td></tr></table>
<p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#5B6675">
Urban Crunch Media Limited · 16 Hoylake Road, Sale, M33 2XH · Questions? Just reply to this email.${unsub}
</p></td></tr></table></body></html>`;
}

// ---- Templates. Each returns { subject, html, marketing } ----

export function welcomeEmail({ name }) {
  const learner = name ? escapeHtml(name) : "your child";
  return {
    marketing: false,
    subject: "Welcome to 11 Plus Lab",
    html: layout({
      heading: "Welcome to 11 Plus Lab!",
      paragraphs: [
        `Thanks for signing up. ${learner === "your child" ? "Your child" : learner} can start practising straight away: synonyms, antonyms, spelling, punctuation and more, all as quick games.`,
        "A few minutes a day works better than one long session. The app picks the words they find hardest and brings them back until they stick.",
      ],
      cta: { label: "Start practising", url: SITE },
    }),
  };
}

export function trialEndingEmail({ trialEnd }) {
  const when = new Date(trialEnd).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return {
    marketing: false,
    subject: `Your free trial ends on ${when}`,
    html: layout({
      heading: "Your free trial is ending soon",
      paragraphs: [
        `Your 11 Plus Lab free trial ends on <strong>${escapeHtml(when)}</strong>. After that, your subscription starts and your card will be charged automatically.`,
        "Nothing to do if you'd like to carry on. If you don't want to continue, you can cancel any time before then from Settings → Manage subscription in the app.",
      ],
      cta: { label: "Open 11 Plus Lab", url: SITE },
    }),
  };
}

export function inactivityEmail({ uid, name, days }) {
  const learner = name ? escapeHtml(name) : "Your child";
  return {
    marketing: true,
    subject: `${name || "Your child"}'s words are waiting`,
    html: layout({
      heading: "Time for a quick practice?",
      paragraphs: [
        `${learner} hasn't practised on 11 Plus Lab for ${days} days. A short 5-minute round today helps keep the words they've learned fresh.`,
        "The app will start with the words they found trickiest last time.",
      ],
      cta: { label: "Play a quick round", url: SITE },
      footerUid: uid,
    }),
  };
}

// Announcements are written by the app owner as simple text: blank lines split paragraphs.
export function announcementEmail({ uid, subject, heading, text, ctaLabel, ctaUrl }) {
  const paragraphs = String(text).trim().split(/\n\s*\n/).map((p) => escapeHtml(p).replace(/\n/g, "<br>"));
  return {
    marketing: true,
    subject,
    html: layout({
      heading: heading || subject,
      paragraphs,
      cta: ctaLabel ? { label: ctaLabel, url: ctaUrl || SITE } : null,
      footerUid: uid,
    }),
  };
}

function headersFor(email, uid) {
  if (!email.marketing || !uid) return undefined;
  // Lets Gmail/Apple Mail show their own one-click "Unsubscribe" button.
  return {
    "List-Unsubscribe": `<${unsubUrl(uid)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

// Send one email. idempotencyKey stops Resend sending the same email twice on a retry.
export async function sendEmail({ to, uid, email, idempotencyKey }) {
  const { data, error } = await resend().emails.send(
    { from: FROM, replyTo: REPLY_TO, to, subject: email.subject, html: email.html, headers: headersFor(email, uid) },
    idempotencyKey ? { idempotencyKey } : undefined
  );
  if (error) throw new Error(`Resend: ${error.message}`);
  return data;
}

// Send up to 100 emails in one request. items: [{ to, uid, email }]
export async function sendBatch(items) {
  if (!items.length) return [];
  const { data, error } = await resend().batch.send(
    items.map(({ to, uid, email }) => ({
      from: FROM, replyTo: REPLY_TO, to, subject: email.subject, html: email.html, headers: headersFor(email, uid),
    }))
  );
  if (error) throw new Error(`Resend: ${error.message}`);
  return data;
}

// Who must never get a marketing email. emailState is server-only (no client rule).
export async function unsubscribedUids(db) {
  const snap = await db.collection("emailState").where("unsubscribed", "==", true).get();
  return new Set(snap.docs.map((d) => d.id));
}
