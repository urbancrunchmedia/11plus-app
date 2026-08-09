import React, { useState } from "react";
import { getSettings, setSetting } from "../utils/leaderboard";
import { getStats } from "../utils/gamify";
import { useAuth } from "../contexts/AuthContext";

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

export default function SettingsScreen({ onHome }) {
  const { user, signOut } = useAuth();
  const stats = getStats();
  const [s, setS] = useState(getSettings);
  const [sheet, setSheet] = useState(false);

  function update(key, value) {
    setSetting(key, value);
    setS((prev) => ({ ...prev, [key]: value }));
  }
  const toggle = (key) => update(key, !s[key]);

  const name = user?.displayName || "Player";

  return (
    <div className="settings">
      <div className="set-head">
        <div className="set-avatar">{initial(name)}</div>
        <div className="set-head-txt">
          <div className="set-name">{name}</div>
          <div className="set-sub">Level {stats.level} · {stats.title} · {stats.xp.toLocaleString()} XP · 🔥 {stats.streak} day streak</div>
        </div>
        <button className="set-done" onClick={onHome}>Done</button>
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
          <div className="set-row-txt"><div className="set-row-label">Weekly progress report</div><div className="set-row-sub">Emailed summary of what was learned</div></div>
          <button className="set-ghost" disabled title="Coming soon">Send now</button>
        </div>
      </div>

      {/* Account */}
      <div className="set-card set-account">
        <div className="set-row-txt">
          <div className="set-row-label">Signed in as {name}</div>
          <div className="set-row-sub">Logging out keeps your XP, badges and streak safe.</div>
        </div>
        <button className="set-logout" onClick={() => setSheet(true)}>Log out</button>
      </div>

      <div className="set-foot">11 Plus Study · <a href="#" onClick={(e) => e.preventDefault()}>Privacy</a></div>

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
    </div>
  );
}
