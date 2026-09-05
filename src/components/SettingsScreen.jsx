import React, { useState } from "react";
import { getSettings, setSetting } from "../utils/leaderboard";
import { getStats } from "../utils/gamify";
import { useAuth } from "../contexts/AuthContext";
import { usePremium } from "../contexts/PremiumContext";
import { openBillingPortal } from "../utils/subscription";
import LegalModal from "./LegalModal";

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
  { key: "parentPinLock", label: "PIN-protect grown-up settings", sub: "Stops goals being changed mid-revision" },
  { key: "weeklyEmail",   label: "Email me a weekly summary",     sub: "Sent every Monday morning (coming soon)" },
];

function initial(name) { return name ? name.trim().charAt(0).toUpperCase() : "A"; }

export default function SettingsScreen({ onOpenReport }) {
  const { user, signOut, updateDisplayName } = useAuth();
  const { isPremium, openPaywall } = usePremium();
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
  const [legal, setLegal] = useState(null); // "privacy" | "terms" | null

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
    setNameSheet(false); // close immediately — the update is optimistic
    try { await updateDisplayName(n); setToast(`Name updated to ${n} ✓`); }
    catch { setToast("Couldn't save name — please try again"); }
    setSavingName(false);
    setTimeout(() => setToast(null), 2200);
  }

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

      {/* Plan / Full Access */}
      <div className={`set-plan ${isPremium ? "premium" : ""}`}>
        <div className="set-plan-txt">
          <div className="set-plan-badge">{isPremium ? "FULL ACCESS" : "FREE PLAN"}</div>
          <div className="set-plan-title">
            {isPremium ? "You have Full Access 🎉" : "Unlock every level & unlimited play"}
          </div>
          <div className="set-plan-sub">
            {isPremium
              ? "All levels, unlimited rounds and the progress report are on."
              : "Free is Level A with a daily limit. Full Access opens Levels B & C, unlimited rounds and the parent report."}
          </div>
        </div>
        {isPremium ? (
          <button className="set-plan-cta ghost" onClick={manageBilling} disabled={portalBusy}>
            {portalBusy ? "Opening…" : "Manage billing"}
          </button>
        ) : (
          <button className="set-plan-cta" onClick={() => openPaywall("feature")}>Upgrade</button>
        )}
      </div>

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
          <div className="set-row-txt"><div className="set-row-label">Default difficulty</div><div className="set-row-sub">New rounds start at this level</div></div>
          <div className="set-seg">
            {DIFFS.map((d) => (
              <button key={d.id} className={`set-seg-btn ${s.defaultDifficulty === d.id ? "active" : ""}`} onClick={() => update("defaultDifficulty", d.id)}>{d.id}</button>
            ))}
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
          <button className="set-ghost" onClick={onOpenReport}>View{!isPremium && " 🔒"}</button>
        </div>
        <div className="set-divider" />
        {PARENT_TOGGLES.map((t, i) => (
          <React.Fragment key={t.key}>
            {i > 0 && <div className="set-divider" />}
            <div className="set-row">
              <div className="set-row-txt"><div className="set-row-label">{t.label}</div><div className="set-row-sub">{t.sub}</div></div>
              <button className={`set-switch ${s[t.key] ? "on" : ""}`} onClick={() => toggle(t.key)} aria-pressed={!!s[t.key]}><span className="set-knob" /></button>
            </div>
          </React.Fragment>
        ))}
        <div className="set-divider" />
        <div className="set-row">
          <div className="set-row-txt"><div className="set-row-label">Child PIN</div><div className="set-row-sub">A 4-digit PIN to start a session (soft lock)</div></div>
          {!editingPin ? (
            <div className="set-pin-actions">
              {s.childPin ? (
                <>
                  <button className="set-ghost" onClick={() => { setPinInput(""); setEditingPin(true); }}>Change</button>
                  <button className="set-ghost" onClick={() => update("childPin", "")}>Turn off</button>
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
        <div className="set-divider" />
        <div className="set-row">
          <div className="set-row-txt"><div className="set-row-label">Weekly progress report</div><div className="set-row-sub">Emailed summary of what was learned</div></div>
          <button className="set-ghost" disabled title="Coming soon">Send now</button>
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
