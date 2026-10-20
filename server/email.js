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

// ---- Shared layout, built from the app's EduCore brand ----
// Tables + inline styles because that's what Gmail/Outlook render reliably.
// Plus Jakarta Sans loads in Apple Mail and iOS; elsewhere it falls back to Helvetica/Arial.
const C = {
  brand: "#12A5FF", brandDark: "#0B7FC7", lime: "#D4F520", limeDark: "#A8C400",
  ink: "#0E1116", surface: "#F4F9FF", muted: "#6B7A8C", line: "#DDE7F0",
};
const FONT = "'Plus Jakarta Sans',Helvetica,Arial,sans-serif";
// 11 Plus Lab lockup (square + "PlusLab"), white text, exported at 2x. Source: design/logo/.
const LOGO = `${SITE}/email-lockup.png`;

function p(html) {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.ink}">${html}</p>`;
}

// Chunky lime button with the app's offset bottom edge.
function button({ label, url }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px"><tr>
<td style="background:${C.lime};border-radius:16px;border-bottom:5px solid ${C.limeDark}">
<a href="${url}" style="display:inline-block;padding:16px 30px;font-family:${FONT};font-size:17px;font-weight:800;color:${C.ink};text-decoration:none">${escapeHtml(label)} &rarr;</a>
</td></tr></table>`;
}

// Three game tiles, like the login screen's game list.
function gameTiles() {
  const tile = (emoji, name, hook) => `<td width="33%" valign="top" style="padding:4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};border-radius:16px;border-bottom:3px solid ${C.line}"><tr><td style="padding:14px 12px">
<div style="font-size:24px;line-height:1">${emoji}</div>
<div style="margin-top:8px;font-family:${FONT};font-size:14px;font-weight:800;color:${C.ink}">${name}</div>
<div style="margin-top:2px;font-family:${FONT};font-size:12px;line-height:1.4;color:${C.muted}">${hook}</div>
</td></tr></table></td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px"><tr>
${tile("🔤", "Word Match", "Synonyms &amp; antonyms")}
${tile("✏️", "Spelling", "Tricky 11+ words")}
${tile("❗", "Punctuation", "Commas to colons")}
</tr></table>`;
}

// Ink card with a big lime number/date: the app's dark stat tile.
function statCard({ big, label }) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;background:${C.ink};border-radius:20px"><tr><td style="padding:20px 22px">
<div style="font-family:${FONT};font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#9AA8B6">${label}</div>
<div style="margin-top:6px;font-family:${FONT};font-size:28px;font-weight:800;line-height:1.2;color:${C.lime}">${big}</div>
</td></tr></table>`;
}

function layout({ preheader, eyebrow, heading, blocks, footerUid }) {
  const unsub = footerUid
    ? ` · <a href="${unsubUrl(footerUid)}" style="color:${C.muted};text-decoration:underline">Unsubscribe</a>`
    : "";
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">
<title>${escapeHtml(heading)}</title>
<style>@media (max-width:600px){.px{padding-left:22px!important;padding-right:22px!important}.h1{font-size:28px!important}}</style>
</head>
<body style="margin:0;padding:0;background:${C.surface}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader || "")}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px">

<tr><td style="background:${C.brand};border-radius:28px 28px 0 0;padding:28px 36px 34px" class="px">
  <a href="${SITE}"><img src="${LOGO}" width="162" height="44" alt="11 Plus Lab" style="display:block;border:0;height:44px;width:162px;color:#ffffff;font-family:${FONT};font-size:20px;font-weight:800"></a>
  <div style="margin-top:26px"><span style="display:inline-block;background:${C.lime};color:${C.ink};font-family:${FONT};font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:6px 12px;border-radius:999px">${escapeHtml(eyebrow)}</span></div>
  <h1 class="h1" style="margin:14px 0 0;font-family:${FONT};font-size:32px;line-height:1.15;font-weight:800;letter-spacing:-.02em;color:#ffffff">${escapeHtml(heading)}</h1>
</td></tr>

<tr><td style="background:#ffffff;border-radius:0 0 28px 28px;padding:32px 36px 34px;border-bottom:4px solid ${C.line}" class="px">
${blocks.join("\n")}
</td></tr>

<tr><td style="padding:24px 20px 8px;text-align:center;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted}">
  <a href="${SITE}" style="color:${C.ink};font-weight:800;text-decoration:none">11pluslab.com</a> · Vocabulary, spelling &amp; punctuation games for ages 8–11<br>
  Questions? Just reply to this email.<br>
  Urban Crunch Media Limited · 16 Hoylake Road, Sale, M33 2XH${unsub}
</td></tr>

</table></td></tr></table></body></html>`;
}

// ---- Templates. Each returns { subject, html, marketing } ----

export function welcomeEmail({ name }) {
  const who = name ? escapeHtml(name) : "Your child";
  return {
    marketing: false,
    subject: "Welcome to 11 Plus Lab",
    html: layout({
      preheader: "Quick, fun 11+ practice, ready when you are.",
      eyebrow: "Welcome",
      heading: name ? `${name} is all set!` : "You're all set!",
      blocks: [
        p(`Thanks for signing up. ${who} can start practising straight away, with short games that build 11+ vocabulary, spelling and punctuation.`),
        gameTiles(),
        p("<strong>Our tip:</strong> 5 minutes a day beats one long session. The app spots the words they find hardest and brings them back until they stick."),
        button({ label: "Start practising", url: SITE }),
      ],
    }),
  };
}

export function trialEndingEmail({ trialEnd }) {
  const when = new Date(trialEnd).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return {
    marketing: false,
    subject: `Your free trial ends on ${when}`,
    html: layout({
      preheader: `Your free trial ends on ${when}. Nothing to do if you'd like to carry on.`,
      eyebrow: "Free trial",
      heading: "Your free trial is ending soon",
      blocks: [
        statCard({ label: "Trial ends", big: escapeHtml(when) }),
        p("After that, your subscription starts and your card is charged automatically. <strong>Nothing to do</strong> if you'd like to carry on."),
        p("Don't want to continue? Cancel any time before then in the app: <strong>Settings → Manage subscription</strong>."),
        button({ label: "Open 11 Plus Lab", url: SITE }),
      ],
    }),
  };
}

export function inactivityEmail({ uid, name, days }) {
  const who = name ? escapeHtml(name) : "Your child";
  return {
    marketing: true,
    subject: `${name || "Your child"}'s words are waiting`,
    html: layout({
      preheader: "A 5-minute round keeps the words they've learned fresh.",
      eyebrow: "Practice reminder",
      heading: "Time for a quick round?",
      blocks: [
        statCard({ label: "Since the last practice", big: `${days} days` }),
        p(`${who} hasn't practised for a few days. A short 5-minute round today keeps the words they've learned fresh.`),
        p("The app starts with the words they found trickiest last time."),
        button({ label: "Play a quick round", url: SITE }),
      ],
      footerUid: uid,
    }),
  };
}

// Announcements are written by the app owner as simple text: blank lines split paragraphs.
export function announcementEmail({ uid, subject, heading, text, ctaLabel, ctaUrl }) {
  const paras = String(text).trim().split(/\n\s*\n/).map((t) => p(escapeHtml(t).replace(/\n/g, "<br>")));
  return {
    marketing: true,
    subject,
    html: layout({
      preheader: String(text).trim().split(/\n/)[0].slice(0, 120),
      eyebrow: "News",
      heading: heading || subject,
      blocks: [...paras, ...(ctaLabel ? [button({ label: ctaLabel, url: ctaUrl || SITE })] : [])],
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
