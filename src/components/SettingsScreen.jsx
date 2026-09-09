import React, { useState } from "react";
import { getSettings, setSetting } from "../utils/leaderboard";
import { getStats } from "../utils/gamify";
import { useAuth } from "../contexts/AuthContext";
import { usePremium } from "../contexts/PremiumContext";
import { openBillingPortal } from "../utils/subscription";
import LegalModal, { CONTACT } from "./LegalModal";
import Icon from "./Icon";
import { formatDate } from "./SubscriptionSuccess";
import { exportMyData, downloadMyData, deleteMyAccount } from "../utils/dataRights";

const GOALS = [3, 5, 10];
const DIFFS = [
  { id: "A", label: "Level A" },
  { id: "B", label: "Level B" },
  { id: "C", label: "Level C" },
];
const LEARN_TOGGLES = [
  { key: "sound",         label: "Sounds and cheers",   sub: "Ticks, streak fanfare and combo sounds" },
  { key: "showTimer",     label: "Show the timer",      sub: "Hide it if racing the clock feels stressful" },
  { key: "revisitMisses", label: "Bring back missed words", sub: "Words you slip on return in a later round" },
];
const PARENT_TOGGLES = [
  { key: "parentPinLock", label: "PIN-protect grown-up settings", sub: "Ask for the Child PIN before opening Settings", needsPin: true },
];

function initial(name) { return name ? name.trim().charAt(0).toUpperCase() : "A"; }

export default function SettingsScreen({ onOpenReport }) {
  const { user, signOut, updateDisplayName } = useAuth();
  const { isPremium, subscription, openPaywall, loading: subLoading } = usePremium();
  const stats = getStats();
  const [portalBusy, setPortalBusy] = useState(false);

  async function manageBilling() {
    if (portalBusy) return;
    setPortalBusy(true);
    try { await openBillingPortal(); }
    catch { setPortalBusy(false); }
  }
  const [s, setS] = useState(getSettings);
  const [sheet, setSheet] = useState(false);
  const [editingPin, setEditingPin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [nameSheet, setNameSheet] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmPinOff, setConfirmPinOff] = useState(false);
  const [legal, setLegal] = useState(null); // "privacy" | "terms" | null
  const [exportBusy, setExportBusy] = useState(false);
  const [deleteSheet, setDeleteSheet] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleExport() {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      downloadMyData(await exportMyData(user));
      setToast("Your data file has downloaded");
    } catch {
      setToast("Couldn't prepare your data — please try again");
    }
    setExportBusy(false);
    setTimeout(() => setToast(null), 2200);
  }

  async function handleDeleteAccount() {
    if (deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteMyAccount(user);
      // Auth state flips to signed-out on its own; AuthProvider/App.jsx
      // already route an unauthenticated user to the login screen.
    } catch (e) {
      setDeleteError(e.message || "Couldn't delete your account — please try again.");
      setDeleteBusy(false);
    }
  }

  function update(key, value) {
    setSetting(key, value);
    setS((prev) => ({ ...prev, [key]: value }));
  }
  const toggle = (key) => update(key, !s[key]);

  const name = user?.displayName || "Player";

  function openNameSheet() { setNameDraft(user?.displayName || ""); setNameSheet(true); }
  async function saveName() {
    const n = nameDraft.trim();
    if (!n || savingName) return;
    setSavingName(true);
    try {
      await updateDisplayName(n);
      setNameSheet(false);
      setToast(`Name updated to ${n} ✓`);
    } catch (e) {
      // Say what was wrong with the name, and leave the sheet open to fix it.
      setToast(e.message || "Couldn't save name — please try again");
    }
    setSavingName(false);
    setTimeout(() => setToast(null), 2200);
  }

  const isComp     = subscription?.status === "comp";
  const endingSoon = isPremium && !!subscription?.cancelAtPeriodEnd;
  const endsOn     = formatDate(subscription?.currentPeriodEnd);
  const [now]      = useState(() => Date.now()); // one clock reading per mount, not per render
  // During a trial the card must say a charge is coming, and when.
  const onTrial    = subscription?.status === "trialing";
  const trialEnds  = formatDate(subscription?.trialEnd);
  const trialPrice = subscription?.interval === "year" ? "£34.99" : "£4.99";
  const renewsOn   = isComp ? null : formatDate(subscription?.currentPeriodEnd);
  const daysLeft   = subscription?.currentPeriodEnd
    ? Math.max(0, Math.ceil((subscription.currentPeriodEnd - now) / 86400000))
    : null;

  return (
    <div className="settings">
      <div className="set-head">
        <div className="set-avatar">{initial(name)}</div>
        <div className="set-head-txt">
          <div className="set-name">{name}</div>
          <div className="set-sub">Level {stats.level} · {stats.title} · {stats.xp.toLocaleString()} XP · 🔥 {stats.streak} day streak</div>
        </div>
        <button className="set-editname" onClick={openNameSheet}>Edit name</button>
      </div>

      {/* Plan: free / full access / cancelling (ends on a date). Skip the card
          entirely while the real answer is still loading — `sub` starts out
          as free on every mount, so painting it early flashes the wrong plan
          (and a cancelled trial the wrong colour) for whoever refreshes. */}
      {subLoading ? (
        <div className="set-plan set-plan--loading" aria-busy="true">
          <div className="set-plan-txt">
            <div className="set-plan-badge">CHECKING YOUR PLAN…</div>
            <div className="set-plan-title">One moment</div>
          </div>
        </div>
      ) : (
      <div className={`set-plan ${isPremium ? (endingSoon ? "ending" : "premium") : ""}`}>
        <div className="set-plan-txt">
          <div className="set-plan-badge">
            {!isPremium ? "FREE PLAN" : endingSoon ? "CANCELLED" : isComp ? "FULL ACCESS · COMPLIMENTARY" : onTrial ? "FREE TRIAL" : "FULL ACCESS"}
          </div>
          <div className="set-plan-title">
            {!isPremium
              ? "Unlock every level & unlimited play"
              : endingSoon
                ? "Your subscription is cancelled"
                : "You have Full Access"}
          </div>
          <div className="set-plan-sub">
            {!isPremium
              ? "Free is Level A with a daily limit. Full Access opens Levels B & C, unlimited rounds and the parent report."
              : endingSoon
                ? `You still have Full Access${daysLeft != null ? ` for ${daysLeft} more ${daysLeft === 1 ? "day" : "days"}` : ""}${endsOn ? ` — until ${endsOn}` : ""}. Resubscribe any time to keep it.`
                : onTrial
                  ? `All levels, unlimited rounds and the progress report are on.${trialEnds ? ` Your free trial ends on ${trialEnds}, when the first payment of ${trialPrice} is taken.` : ""} Cancel any time before then and you won't be charged.`
                  : renewsOn
                    ? `All levels, unlimited rounds and the progress report are on. Renews ${renewsOn}.`
                    : "All levels, unlimited rounds and the progress report are on."}
          </div>
        </div>
        {!isPremium ? (
          <button className="set-plan-cta" onClick={() => openPaywall("feature")}>Upgrade</button>
        ) : endingSoon ? (
          <div className="set-plan-actions">
            <button className="set-plan-cta" onClick={() => openPaywall("feature")}>Resubscribe</button>
            <button className="set-plan-cta ghost" onClick={manageBilling} disabled={portalBusy}>
              {portalBusy ? "Opening…" : "Manage billing"}
            </button>
          </div>
        ) : isComp ? null : (
          <button className="set-plan-cta ghost" onClick={manageBilling} disabled={portalBusy}>
            {portalBusy ? "Opening…" : "Manage billing"}
          </button>
        )}
      </div>
      )}

      {/* Your learning */}
      <div className="set-card">
        <div className="set-card-title">Your learning</div>

        <div className="set-row">
          <div className="set-row-txt"><div className="set-row-label">Daily goal</div><div className="set-row-sub">How many rounds keep your streak alive</div></div>
          <div className="set-seg">
            {GOALS.map((g) => (
              <button key={g} className={`set-seg-btn ${s.dailyGoal === g ? "active" : ""}`} onClick={() => update("dailyGoal", g)}>{g}</button>
            ))}
          </div>
        </div>
        <div className="set-divider" />

        <div className="set-row">
          <div className="set-row-txt"><div className="set-row-label">Default difficulty</div><div className="set-row-sub">{isPremium ? "New rounds start at this level" : "Levels B and C need Full Access"}</div></div>
          <div className="set-seg">
            {DIFFS.map((d) => {
              const locked = !isPremium && d.id !== "A";
              return (
                <button
                  key={d.id}
                  className={`set-seg-btn ${s.defaultDifficulty === d.id ? "active" : ""} ${locked ? "locked" : ""}`}
                  onClick={() => (locked ? openPaywall("level") : update("defaultDifficulty", d.id))}
                >
                  {d.id}
                  {locked && <Icon name="lock" size={10} stroke="currentColor" strokeWidth={2.4} />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="set-divider" />

        {LEARN_TOGGLES.map((t, i) => (
          <React.Fragment key={t.key}>
            {i > 0 && <div className="set-divider" />}
            <div className="set-row">
              <div className="set-row-txt"><div className="set-row-label">{t.label}</div><div className="set-row-sub">{t.sub}</div></div>
              <button className={`set-switch ${s[t.key] ? "on" : ""}`} onClick={() => toggle(t.key)} aria-pressed={!!s[t.key]}><span className="set-knob" /></button>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Grown-ups */}
      <div className="set-card">
        <div className="set-card-title">Grown-ups</div>
        <div className="set-row">
          <div className="set-row-txt"><div className="set-row-label">Progress report</div><div className="set-row-sub">See accuracy by skill and the words to revise next</div></div>
          <button className="set-ghost" onClick={onOpenReport}>View {!isPremium && <Icon className="inline-ico" name="lock" size={12} stroke="currentColor" strokeWidth={2.2} />}</button>
        </div>
        <div className="set-divider" />
        {PARENT_TOGGLES.map((t, i) => (
          <React.Fragment key={t.key}>
            {i > 0 && <div className="set-divider" />}
            <div className="set-row">
              <div className="set-row-txt"><div className="set-row-label">{t.label}</div><div className="set-row-sub">{t.needsPin && !s.childPin ? "Set a Child PIN below to use this" : t.sub}</div></div>
              <button
                className={`set-switch ${s[t.key] ? "on" : ""}`}
                onClick={() => toggle(t.key)}
                disabled={t.needsPin && !s.childPin}
                aria-pressed={!!s[t.key]}
              ><span className="set-knob" /></button>
            </div>
          </React.Fragment>
        ))}
        <div className="set-divider" />
        <div className="set-row">
          <div className="set-row-txt"><div className="set-row-label">Contact support</div><div className="set-row-sub">Questions, problems or billing — we'll reply by email</div></div>
          <a
            className="set-ghost"
            href={`mailto:${CONTACT}?subject=${encodeURIComponent("11 Plus Lab — support")}&body=${encodeURIComponent(`\n\n---\nAccount: ${user?.email || "(not signed in)"}\nPlan: ${isPremium ? "Full Access" : "Free"}`)}`}
          >Email us</a>
        </div>
        <div className="set-divider" />
        <div className="set-row">
          <div className="set-row-txt"><div className="set-row-label">Download your data</div><div className="set-row-sub">Everything we hold about this account, as a file you keep</div></div>
          <button className="set-ghost" onClick={handleExport} disabled={exportBusy}>{exportBusy ? "Preparing…" : "Download"}</button>
        </div>
        <div className="set-divider" />
        <div className="set-row">
          <div className="set-row-txt"><div className="set-row-label">Delete your account</div><div className="set-row-sub">Permanently removes your progress, friends and login</div></div>
          <button className="set-ghost set-danger-text" onClick={() => { setDeleteConfirmText(""); setDeleteError(""); setDeleteSheet(true); }}>Delete</button>
        </div>
        <div className="set-divider" />
        <div className="set-row">
          <div className="set-row-txt"><div className="set-row-label">Child PIN</div><div className="set-row-sub">A 4-digit PIN to start a session (soft lock)</div></div>
          {!editingPin ? (
            <div className="set-pin-actions">
              {s.childPin ? (
                <>
                  <button className="set-ghost" onClick={() => { setPinInput(""); setEditingPin(true); }}>Change</button>
                  <button className="set-ghost" onClick={() => setConfirmPinOff(true)}>Turn off</button>
                </>
              ) : (
                <button className="set-ghost" onClick={() => { setPinInput(""); setEditingPin(true); }}>Set PIN</button>
              )}
            </div>
          ) : (
            <div className="set-pin-actions">
              <input className="set-pin-input" inputMode="numeric" maxLength={4} value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="0000" autoFocus />
              <button className="set-ghost" disabled={pinInput.length !== 4} onClick={() => { update("childPin", pinInput); setEditingPin(false); }}>Save</button>
              <button className="set-ghost" onClick={() => setEditingPin(false)}>Cancel</button>
            </div>
          )}
        </div>

      </div>

      {/* Account */}
      <div className="set-card set-account">
        <div className="set-row-txt">
          <div className="set-row-label">Signed in as {name}</div>
          {user?.email && <div className="set-row-email">{user.email}</div>}
          <div className="set-row-sub">Logging out keeps your XP, badges and streak safe.</div>
        </div>
        <button className="set-logout" onClick={() => setSheet(true)}>Log out</button>
      </div>

      <div className="set-foot">
        11 Plus Lab ·{" "}
        <a href="#" onClick={(e) => { e.preventDefault(); setLegal("privacy"); }}>Privacy</a> ·{" "}
        <a href="#" onClick={(e) => { e.preventDefault(); setLegal("terms"); }}>Terms</a>
      </div>

      {legal && <LegalModal doc={legal} onClose={() => setLegal(null)} />}

      {deleteSheet && (
        <div className="set-sheet-overlay" onClick={() => !deleteBusy && setDeleteSheet(false)}>
          <div className="set-sheet board-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="set-sheet-title">Delete your account?</div>
            <div className="set-sheet-sub">
              This permanently removes your progress, XP, streak, friends and login for {user?.email || "this account"}.
              It can't be undone — there's no "keep for later". Downloading your data first is a good idea.
            </div>
            <div className="board-fieldlbl">Type DELETE to confirm</div>
            <input
              className="board-sheet-input"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              autoFocus
            />
            {deleteError && <div className="board-msg err">{deleteError}</div>}
            <button
              className="set-sheet-confirm board-danger"
              disabled={deleteConfirmText.trim().toUpperCase() !== "DELETE" || deleteBusy}
              onClick={handleDeleteAccount}
            >
              {deleteBusy ? "Deleting…" : "Delete my account"}
            </button>
            <button className="set-sheet-cancel" onClick={() => setDeleteSheet(false)} disabled={deleteBusy}>Keep my account</button>
          </div>
        </div>
      )}

      {confirmPinOff && (
        <div className="set-sheet-overlay" onClick={() => setConfirmPinOff(false)}>
          <div className="set-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="set-sheet-title">Turn off the Child PIN?</div>
            <div className="set-sheet-sub">
              The app will open without a PIN, and any lock that relies on it will switch off too.
            </div>
            <button className="set-sheet-confirm" onClick={() => { update("childPin", ""); update("parentPinLock", false); setConfirmPinOff(false); setToast("Child PIN turned off"); }}>Turn it off</button>
            <button className="set-sheet-cancel" onClick={() => setConfirmPinOff(false)}>Keep the PIN</button>
          </div>
        </div>
      )}

      {toast && <div className="set-toast">{toast}</div>}

      {sheet && (
        <div className="set-sheet-overlay" onClick={() => setSheet(false)}>
          <div className="set-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="set-sheet-title">Log out?</div>
            <div className="set-sheet-sub">Your progress is saved. You can sign back in any time.</div>
            <button className="set-sheet-confirm" onClick={() => { setSheet(false); signOut(); }}>Yes, log out</button>
            <button className="set-sheet-cancel" onClick={() => setSheet(false)}>Cancel</button>
          </div>
        </div>
      )}

      {nameSheet && (
        <div className="set-sheet-overlay" onClick={() => setNameSheet(false)}>
          <div className="set-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="set-sheet-title">Learner's name</div>
            <div className="set-sheet-sub">This shows on the leaderboard and at the end of every round.</div>
            <input
              className="set-name-input"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="e.g. Amu"
              maxLength={20}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
            />
            <button className="set-sheet-confirm" onClick={saveName} disabled={!nameDraft.trim() || savingName}>
              {savingName ? "Saving…" : "Save name"}
            </button>
            <button className="set-sheet-cancel" onClick={() => setNameSheet(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
