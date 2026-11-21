import React from "react";

// Simple in-app Privacy Policy / Terms. Plain, honest, UK-oriented. All real
// company details filled in; have a solicitor review before marketing to children at scale.
export const CONTACT = "hello@11pluslab.com"; // live mailbox (Hostinger)
const APP = "11 PlusLab";
const ENTITY = "Urban Crunch Media Limited";
const COMPANY_NUMBER = "15899109";
const REGISTERED_IN = "England and Wales";
const REGISTERED_OFFICE = "16 Hoylake Road, Sale, England, M33 2XH";
const UPDATED = "November 2026";

// Children's Code: a short version a 7–11-year-old can read, before the full policy.
const FOR_KIDS = [
  "This is a word-games app to help you get ready for the 11+.",
  "We only keep your first name (or a nickname), your scores, and which words you find tricky. That's so the app can remember your progress.",
  "Your grown-up made your account and can see how you're doing.",
  "Friends only see your name and your points. Nobody can message you.",
  "If your grown-up connects a tutor, that tutor can see your scores too.",
  "We never sell your information and there are no adverts.",
  "If anything worries you, tell your grown-up. They can delete everything at any time.",
];

const PRIVACY = [
  ["Who we are", `${APP} is an educational word-game app to help children practise for the 11+, operated by ${ENTITY}. This policy explains what we collect and why. Questions: ${CONTACT}.`],
  ["Company details", `${ENTITY} is registered in ${REGISTERED_IN}, company number ${COMPANY_NUMBER}. Registered office: ${REGISTERED_OFFICE}.`],
  ["Who uses the app", "Accounts are created and managed by a parent or guardian. The app is designed to be used by a child under adult supervision. We ask parents not to enter more personal information about a child than the first name/nickname shown in the app."],
  ["What we collect", "• The account email address you sign in with (via Google or email/password).\n• The learner's display name you choose (shown on the leaderboard and results).\n• Gameplay data (scores, progress, streaks and which questions were answered) to save progress and show your stats.\n• If you subscribe, payment is handled by Stripe. We never see or store your card details."],
  ["How we use it", "To run the app, save and sync progress across your devices, show a friends leaderboard (only with friends who have accepted a friend request), and manage subscriptions. We do not sell your data or use it for advertising."],
  ["Tutors", "A parent can choose to connect their child's account to a tutor or tuition centre by entering the tutor's join code in Settings → Tutors, for up to 3 tutors. Before connecting, we show exactly what will be shared, and we email the account address each time a tutor is connected.\n• A connected tutor can see the learner's display name and their practice: games played, scores, accuracy, the words they find tricky, and when and how long they practise.\n• Tutors never see the parent's email address or name, billing details, or anything else on the account, and can't change anything.\n• Either the parent or the tutor can end the connection at any time in the app, and the tutor's access stops immediately.\n• We check every tutor before they can be connected, and we can suspend a tutor's access at any time."],
  ["Emails we send", "We email the account address about the account itself: a welcome email when you sign up, and a reminder before a free trial ends. We may also send occasional updates about the app and a reminder if your child hasn't practised for a while. Every update or reminder has an unsubscribe link, and you can also reply to ask us to stop."],
  ["Who processes data for us", "• Google Firebase: sign-in and data storage.\n• Stripe: subscription payments.\n• Vercel: website hosting.\n• Resend: sending our emails.\n• Sentry: error reports, so we can fix crashes. These don't include names or email addresses.\nEach only processes what's needed to provide their part of the service."],
  ["Storage & security", "Progress is kept in your browser and in Firebase. Data is sent over encrypted connections (HTTPS). No system is perfectly secure, but we take reasonable steps to protect your information."],
  ["Your choices", `You can edit or clear the learner's name in Settings, remove friends or tutors at any time, and log out. You can download a copy of your data from Settings → Download your data, and delete your account and its data at any time from Settings → Delete your account. If you can't sign in, email ${CONTACT} and we'll do it for you once we've checked it's you.`],
  ["Children's privacy", "We aim to collect the minimum needed to run the app. If you believe a child has provided us more information than intended, contact us and we'll delete it."],
  ["Changes", `We may update this policy; we'll change the date below when we do. Last updated: ${UPDATED}.`],
];

const TERMS = [
  ["Agreement", `${APP} is operated by ${ENTITY}. By using the app you agree to these terms. If you don't agree, please don't use the app. A parent or guardian accepts these terms on behalf of the child using the app.`],
  ["Company details", `${ENTITY} is registered in ${REGISTERED_IN}, company number ${COMPANY_NUMBER}. Registered office: ${REGISTERED_OFFICE}.`],
  ["The service", "The app provides educational games to practise 11+ vocabulary, spelling and punctuation. It's a study aid. It does not guarantee any particular exam result."],
  ["Accounts", "You're responsible for your account and for supervising the child who uses it. Keep your login details secure."],
  ["Subscriptions & billing", "Full Access is available as a subscription: £4.99/month or £34.99/year, each starting with a 7-day free trial. The free trial is available once per customer. After the trial it renews automatically until cancelled. You can cancel any time from Settings → Manage billing; access continues to the end of the paid period. Payments are processed by Stripe. Tax is calculated automatically at checkout based on your billing address, where applicable."],
  ["Cancellations & refunds", "Cancel any time to stop future charges. As the service is digital and available immediately, part-period refunds aren't generally given, except where required by law (e.g. UK consumer rights). Contact us if something's wrong and we'll try to help."],
  ["Acceptable use", "Please don't misuse the app: no attempting to break, copy, resell or disrupt it, and no uploading offensive names to the leaderboard."],
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
          {isPrivacy && (
            <div className="legal-kids" data-testid="privacy-for-kids">
              <h3 className="legal-h">For kids: the short version</h3>
              <ul>{FOR_KIDS.map((line) => <li key={line}>{line}</li>)}</ul>
              <p className="legal-p">The full policy for grown-ups is below.</p>
            </div>
          )}
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
