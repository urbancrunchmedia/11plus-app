import React from "react";

// Simple in-app Privacy Policy / Terms. Plain, honest, UK-oriented. Have a
// solicitor review before scaling — placeholders marked need your real details.
const CONTACT = "hello@11pluslab.com"; // TODO: confirm your real support email
const APP = "11 Plus Lab";
const ENTITY = "Urban Crunch Media Private Limited";
const UPDATED = "September 2026";

const PRIVACY = [
  ["Who we are", `${APP} is an educational word-game app to help children practise for the 11+, operated by ${ENTITY}. This policy explains what we collect and why. Questions: ${CONTACT}.`],
  ["Who uses the app", "Accounts are created and managed by a parent or guardian. The app is designed to be used by a child under adult supervision. We ask parents not to enter more personal information about a child than the first name/nickname shown in the app."],
  ["What we collect", "• The account email address you sign in with (via Google or email/password).\n• The learner's display name you choose (shown on the leaderboard and results).\n• Gameplay data — scores, progress, streaks and which questions were answered — to save progress and show your stats.\n• If you subscribe, payment is handled by Stripe. We never see or store your card details."],
  ["How we use it", "To run the app, save and sync progress across your devices, show a friends leaderboard (only with people whose code you add), and manage subscriptions. We do not sell your data or use it for advertising."],
  ["Who processes data for us", "• Google Firebase — sign-in and data storage.\n• Stripe — subscription payments.\n• Vercel — website hosting.\nEach only processes what's needed to provide their part of the service."],
  ["Storage & security", "Progress is kept in your browser and in Firebase. Data is sent over encrypted connections (HTTPS). No system is perfectly secure, but we take reasonable steps to protect your information."],
  ["Your choices", `You can edit or clear the learner's name in Settings, remove friends at any time, and log out. To delete your account and associated data, email ${CONTACT} and we'll remove it.`],
  ["Children's privacy", "We aim to collect the minimum needed to run the app. If you believe a child has provided us more information than intended, contact us and we'll delete it."],
  ["Changes", `We may update this policy; we'll change the date below when we do. Last updated: ${UPDATED}.`],
];

const TERMS = [
  ["Agreement", `${APP} is operated by ${ENTITY}. By using the app you agree to these terms. If you don't agree, please don't use the app. A parent or guardian accepts these terms on behalf of the child using the app.`],
  ["The service", "The app provides educational games to practise 11+ vocabulary, spelling and punctuation. It's a study aid — it does not guarantee any particular exam result."],
  ["Accounts", "You're responsible for your account and for supervising the child who uses it. Keep your login details secure."],
  ["Subscriptions & billing", "Full Access is available as a subscription: £4.99/month or £34.99/year, each starting with a 7-day free trial. After the trial it renews automatically until cancelled. You can cancel any time from Settings → Manage billing; access continues to the end of the paid period. Payments are processed by Stripe. Prices include applicable tax where required."],
  ["Cancellations & refunds", "Cancel any time to stop future charges. As the service is digital and available immediately, part-period refunds aren't generally given, except where required by law (e.g. UK consumer rights). Contact us if something's wrong and we'll try to help."],
  ["Acceptable use", "Please don't misuse the app — no attempting to break, copy, resell or disrupt it, and no uploading offensive names to the leaderboard."],
  ["Our content", "The games, questions and design are owned by us and provided for personal, non-commercial study only."],
  ["No warranty & liability", "The app is provided “as is”. To the extent permitted by law we exclude implied warranties, and our liability is limited to the amount you paid us in the last 12 months. Nothing here limits liability that can't be limited by law."],
  ["Governing law", "These terms are governed by the laws of England & Wales."],
  ["Contact", `Questions about these terms: ${CONTACT}. Last updated: ${UPDATED}.`],
];

export default function LegalModal({ doc, onClose }) {
  const isPrivacy = doc === "privacy";
  const sections = isPrivacy ? PRIVACY : TERMS;
  return (
    <div className="legal-overlay" onClick={onClose}>
      <div className="legal" onClick={(e) => e.stopPropagation()}>
        <div className="legal-head">
          <h2 className="legal-title">{isPrivacy ? "Privacy Policy" : "Terms of Service"}</h2>
          <button className="legal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="legal-body">
          {sections.map(([h, body]) => (
            <div key={h} className="legal-sec">
              <h3 className="legal-h">{h}</h3>
              {body.split("\n").map((line, i) => <p key={i} className="legal-p">{line}</p>)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
