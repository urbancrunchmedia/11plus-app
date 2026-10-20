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

// ---- Shared layout, in the style of the 11 Plus Lab print poster ----
// Soft blue header with blobs, big ink headline with a blue, lime-underlined
// key phrase, pastel icon tiles, lime pill CTA with an ink arrow.
// Tables + inline styles because that's what Gmail/Outlook render reliably;
// every image is a hosted PNG (Gmail doesn't show SVG). Plus Jakarta Sans
// loads in Apple Mail and iOS; elsewhere it falls back to Helvetica/Arial.
const C = {
  brand: "#12A5FF", lime: "#D4F520", limeDark: "#A8C400", ink: "#0E1116",
  sky: "#EEF6FF", tile: "#F7FAFF", muted: "#5E6C7C", line: "#E3ECF6",
};
const FONT = "'Plus Jakarta Sans',Helvetica,Arial,sans-serif";
const IMG = `${SITE}/email`;
// 11 Plus Lab lockup (square + "PlusLab"), dark text for the light header, 2x. Source: design/logo/.
const LOGO = `${IMG}/logo-lockup-dark.png`;

function p(html) {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.65;color:${C.ink}">${html}</p>`;
}

// Lime pill with an ink arrow circle, like the poster's "11pluslab.com →".
function button({ label, url }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px"><tr>
<td style="background:${C.lime};border-radius:999px;padding:8px 8px 8px 28px">
<a href="${url}" style="text-decoration:none;display:block"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="font-family:${FONT};font-size:18px;font-weight:800;color:${C.ink};padding-right:16px;white-space:nowrap">${escapeHtml(label)}</td>
<td><img src="${IMG}/cta-arrow.png" width="40" height="40" alt="" style="display:block;border:0"></td>
</tr></table></a></td></tr></table>`;
}

function tile({ icon, name, desc }) {
  return `<td width="50%" valign="top" style="padding:6px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.tile};border:1px solid ${C.line};border-radius:18px"><tr><td style="padding:16px">
<img src="${IMG}/icon-${icon}.png" width="44" height="44" alt="" style="display:block;border:0">
<div style="margin-top:10px;font-family:${FONT};font-size:16px;font-weight:800;color:${C.ink}">${name}</div>
<div style="margin-top:3px;font-family:${FONT};font-size:13px;line-height:1.45;color:${C.muted}">${desc}</div>
</td></tr></table></td>`;
}

const GAMES = [
  { icon: "synonyms", name: "Synonyms", desc: "Build vocabulary with similar words." },
  { icon: "antonyms", name: "Antonyms", desc: "Learn words with opposite meanings." },
  { icon: "compound", name: "Compound Words", desc: "Join two words into one." },
  { icon: "detective", name: "Word Detective", desc: "Find the right word from a clue." },
  { icon: "punctuation", name: "Punctuation", desc: "Spot the punctuation mistake." },
  { icon: "spelling", name: "Spelling", desc: "Practise tricky 11+ spellings." },
];
function gameGrid(games = GAMES) {
  const rows = [];
  for (let i = 0; i < games.length; i += 2) rows.push(`<tr>${tile(games[i])}${games[i + 1] ? tile(games[i + 1]) : "<td></td>"}</tr>`);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px">${rows.join("")}</table>`;
}

// The poster's closing row: three promises with pastel icons.
function promises() {
  const cell = (icon, label) => `<td width="33%" align="center" valign="top" style="padding:0 6px">
<img src="${IMG}/icon-${icon}.png" width="48" height="48" alt="" style="display:block;border:0;margin:0 auto">
<div style="margin-top:8px;font-family:${FONT};font-size:14px;line-height:1.3;font-weight:800;color:${C.ink}">${label}</div></td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0;border-top:1px solid ${C.line}"><tr><td style="padding-top:22px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${cell("confidence", "Build<br>confidence")}${cell("progress", "Track<br>progress")}${cell("motivated", "Stay<br>motivated")}
</tr></table></td></tr></table>`;
}

// Ink card with an icon and a big lime value: the app's dark stat tile.
function statCard({ icon, big, label }) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;background:${C.ink};border-radius:20px"><tr>
<td width="64" style="padding:20px 0 20px 20px"><img src="${IMG}/icon-${icon}.png" width="44" height="44" alt="" style="display:block;border:0"></td>
<td style="padding:20px 22px 20px 14px">
<div style="font-family:${FONT};font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#9AA8B6">${label}</div>
<div style="margin-top:4px;font-family:${FONT};font-size:26px;font-weight:800;line-height:1.2;color:${C.lime}">${big}</div>
</td></tr></table>`;
}

// heading: [before, highlight, after] — the highlight is blue with a lime underline.
function headline([before = "", highlight = "", after = ""]) {
  const hi = highlight
    ? `<span style="color:${C.brand};border-bottom:5px solid ${C.lime};white-space:nowrap">${escapeHtml(highlight)}</span>`
    : "";
  return `${escapeHtml(before)}${hi}${escapeHtml(after)}`;
}

function layout({ preheader, eyebrow, heading, lead, blocks, footerUid }) {
  const title = heading.join("");
  const unsub = footerUid
    ? `<br><a href="${unsubUrl(footerUid)}" style="color:${C.muted};text-decoration:underline">Unsubscribe from updates and reminders</a>`
    : "";
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">
<title>${escapeHtml(title)}</title>
<style>@media (max-width:600px){.px{padding-left:20px!important;padding-right:20px!important}.h1{font-size:30px!important}}</style>
</head>
<body style="margin:0;padding:0;background:${C.sky}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader || "")}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.sky}"><tr><td align="center" style="padding:20px 12px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">

<tr><td background="${IMG}/header-bg.png" bgcolor="${C.sky}" class="px" style="background:${C.sky} url('${IMG}/header-bg.png') center top / cover no-repeat;border-radius:28px 28px 0 0;padding:30px 36px 30px">
  <a href="${SITE}"><img src="${LOGO}" width="133" height="44" alt="11 Plus Lab" style="display:block;border:0;height:44px;width:133px;font-family:${FONT};font-size:20px;font-weight:800;color:${C.ink}"></a>
  <div style="margin-top:28px"><span style="display:inline-block;background:${C.ink};color:${C.lime};font-family:${FONT};font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:7px 13px;border-radius:999px">${escapeHtml(eyebrow)}</span></div>
  <h1 class="h1" style="margin:16px 0 0;font-family:${FONT};font-size:36px;line-height:1.15;font-weight:800;letter-spacing:-.025em;color:${C.ink}">${headline(heading)}</h1>
  ${lead ? `<p style="margin:14px 0 0;font-family:${FONT};font-size:17px;line-height:1.55;color:#3E4A58">${lead}</p>` : ""}
</td></tr>

<tr><td class="px" style="background:#ffffff;border-radius:0 0 28px 28px;padding:28px 36px 32px;border-bottom:4px solid ${C.line}">
${blocks.join("\n")}
</td></tr>

<tr><td style="padding:26px 20px 6px;text-align:center;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.muted}">
  <a href="${SITE}" style="color:${C.ink};font-weight:800;text-decoration:none">11pluslab.com</a> · Fun practice for 11+ success<br>
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
      preheader: "Fun, quick games to build 11+ English skills, ready when you are.",
      eyebrow: "Welcome",
      heading: ["Fun practice for ", "11+ success", ""],
      lead: `Thanks for signing up. ${who} can start straight away with short games that build confidence and key English skills.`,
      blocks: [
        gameGrid(),
        p("<strong>Our tip:</strong> 5 minutes a day beats one long session. The app spots the words they find hardest and brings them back until they stick."),
        button({ label: "Start practising", url: SITE }),
        promises(),
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
      heading: ["Your free trial ends ", "soon", ""],
      lead: "Here's what happens next, so there are no surprises.",
      blocks: [
        statCard({ icon: "clock", label: "Trial ends", big: escapeHtml(when) }),
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
      heading: ["Time for a ", "quick round", "?"],
      lead: `${who} hasn't practised for a few days. A short round today keeps the words they've learned fresh.`,
      blocks: [
        statCard({ icon: "flame", label: "Since the last practice", big: `${days} days` }),
        p("The app starts with the words they found trickiest last time, so every minute counts."),
        gameGrid(GAMES.slice(0, 4)),
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
      heading: [heading || subject, "", ""],
      blocks: [...paras, ...(ctaLabel ? [button({ label: ctaLabel, url: ctaUrl || SITE })] : []), promises()],
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
