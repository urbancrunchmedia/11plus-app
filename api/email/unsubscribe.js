// GET  /api/email/unsubscribe?u=<uid>&t=<token>  -> confirmation page
// POST (same URL) -> one-click unsubscribe from Gmail/Apple Mail (RFC 8058)
// The token is an HMAC of the uid, so nobody can unsubscribe someone else.
// ?o=<email>&t=<token> is the opt-out from tuition-centre outreach (no account).
import { adminDb } from "../../server/firebaseAdmin.js";
import { checkUnsubToken, checkOutreachToken, outreachKey, SITE } from "../../server/email.js";

function page(title, message) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#F4F9FF;font-family:Helvetica,Arial,sans-serif;color:#0E1116">
<div style="max-width:480px;margin:60px auto;padding:28px;background:#fff;border-radius:20px">
<h1 style="font-size:22px;margin:0 0 12px">${title}</h1><p style="line-height:1.55">${message}</p>
<p><a href="${SITE}" style="color:#12A5FF;font-weight:700">Back to 11 Plus Lab</a></p></div></body></html>`;
}

async function outreachOptOut(req, res, email, token) {
  if (!checkOutreachToken(email, token)) {
    res.status(400).setHeader("Content-Type", "text/html");
    return res.send(page("Link not valid", "This link isn't valid. Reply to the email and we'll remove you by hand."));
  }
  try {
    const at = new Date().toISOString();
    const db = adminDb();
    await db.collection("outreachOptOut").doc(outreachKey(email)).set({ email: String(email).toLowerCase(), at });
    await db.collection("outreach").doc(outreachKey(email)).set({ status: "optedOut", optedOutAt: at }, { merge: true });
  } catch (e) {
    console.error("outreach opt-out:", e.message);
    res.status(500).setHeader("Content-Type", "text/html");
    return res.send(page("Something went wrong", "Please try the link again, or reply \"no thanks\" to the email."));
  }
  if (req.method === "POST") return res.status(200).send("ok");
  res.status(200).setHeader("Content-Type", "text/html");
  res.send(page("You won't hear from us again", "Thanks for letting us know. We've removed you from our list."));
}

export default async function handler(req, res) {
  const { u, t, o } = req.query || {};
  if (o) return outreachOptOut(req, res, o, t);
  if (!checkUnsubToken(u, t)) {
    res.status(400).setHeader("Content-Type", "text/html");
    return res.send(page("Link not valid", "This unsubscribe link isn't valid. Reply to any of our emails and we'll remove you by hand."));
  }
  try {
    await adminDb().collection("emailState").doc(String(u)).set(
      { unsubscribed: true, unsubscribedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (e) {
    console.error("unsubscribe:", e.message);
    res.status(500).setHeader("Content-Type", "text/html");
    return res.send(page("Something went wrong", "Please try the link again, or reply to any of our emails and we'll remove you."));
  }
  if (req.method === "POST") return res.status(200).send("ok");
  res.status(200).setHeader("Content-Type", "text/html");
  res.send(page("You're unsubscribed", "You won't get any more updates or practice reminders. You'll still get emails about your account, like a free trial ending."));
}
