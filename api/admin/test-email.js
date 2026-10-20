// POST /api/admin/test-email   Authorization: Bearer <ADMIN_SECRET>
// Body: { to, template: "welcome" | "trial" | "inactivity" | "announcement" | "support" }
// Sends one sample of a template, subject prefixed "[TEST]", to check how it looks.
import {
  sendEmail, welcomeEmail, trialEndingEmail, inactivityEmail, announcementEmail, supportRequestEmail,
} from "../../server/email.js";

const SAMPLES = {
  welcome: () => welcomeEmail({ name: "" }),
  trial: () => trialEndingEmail({ trialEnd: Date.now() + 3 * 24 * 60 * 60 * 1000 }),
  inactivity: () => inactivityEmail({ uid: "test", name: "", days: 6 }),
  support: () => supportRequestEmail({
    uid: "test", email: "parent@example.com", displayName: "Sample learner", categoryLabel: "Billing or subscription",
    message: "This is a sample support request from the in-app form.\n\nReplying to this email would go to the parent.",
    createdAt: new Date().toISOString(), id: "test",
  }),
  announcement: () => announcementEmail({
    uid: "test",
    subject: "New on 11 Plus Lab",
    text: "This is a sample announcement.\n\nYour real message goes here, split into paragraphs by blank lines.",
    ctaLabel: "Open 11 Plus Lab",
  }),
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const secret = (process.env.ADMIN_SECRET || "").trim();
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { to, template } = req.body || {};
  if (!to || !SAMPLES[template]) return res.status(400).json({ error: "Need to and a known template" });
  try {
    const email = SAMPLES[template]();
    const data = await sendEmail({ to, uid: "test", email: { ...email, subject: `[TEST] ${email.subject}` } });
    res.status(200).json({ sent: true, id: data?.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
