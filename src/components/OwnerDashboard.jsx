import React, { useCallback, useEffect, useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { auth } from "../firebase";

// Private dashboard at /owner for the app's owners (checked server-side in
// /api/admin/owner). Phone-first: headline numbers, then the detail.

const ago = (ms) => {
  if (!ms) return "Never played";
  const days = Math.round((Date.now() - ms) / 86400000);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
};
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "–");

const PLAN_ORDER = ["Paying", "Paying (cancelling)", "Free trial", "Payment failed", "Complimentary", "Free (starter set)", "Free (original plan)", "Cancelled"];
const PLAN_TONE = {
  Paying: "good", "Paying (cancelling)": "warn", "Free trial": "brand", "Payment failed": "bad",
  Complimentary: "muted", Cancelled: "muted", "Free (starter set)": "muted", "Free (original plan)": "muted",
};

function Tile({ label, value, sub }) {
  return (
    <div className="own-tile">
      <div className="own-tile-label">{label}</div>
      <div className="own-tile-value">{value}</div>
      {sub && <div className="own-tile-sub">{sub}</div>}
    </div>
  );
}

// One-series horizontal bars: label, bar, value. Single colour, no legend needed.
function Bars({ rows, max }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="own-bars" role="table">
      {rows.map((r) => (
        <div className="own-bar-row" role="row" key={r.label} title={`${r.label}: ${r.value}`}>
          <div className="own-bar-label" role="cell">{r.label}</div>
          <div className="own-bar-track" role="cell">
            <div className="own-bar-fill" style={{ width: `${(r.value / top) * 100}%` }} />
          </div>
          <div className="own-bar-value" role="cell">{r.value}</div>
        </div>
      ))}
    </div>
  );
}

async function fetchStats(forceRefreshToken) {
  const user = auth.currentUser;
  if (forceRefreshToken) await user.reload(); // picks up a just-verified email
  const token = await user.getIdToken(forceRefreshToken);
  const res = await fetch("/api/admin/owner", { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || "error"), { code: body.error });
  return body;
}

export default function OwnerDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  // Called from button taps; the first load is the effect below.
  const load = useCallback(async (forceRefreshToken = false) => {
    setBusy(true);
    setError(null);
    try {
      setData(await fetchStats(forceRefreshToken));
    } catch (e) {
      setError(e.code || e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let live = true;
    fetchStats(false)
      .then((d) => { if (live) setData(d); })
      .catch((e) => { if (live) setError(e.code || e.message); });
    return () => { live = false; };
  }, []);

  const header = (
    <header className="own-head">
      <img src="/logo-mark-simple.svg" alt="" width="40" height="40" className="own-logo" />
      <div className="own-head-txt">
        <h1>Owner dashboard</h1>
        <div className="own-muted">{data ? `Updated ${new Date(data.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "11 PlusLab"}</div>
      </div>
      <button className="own-btn" onClick={() => load()} disabled={busy}>{busy ? "Loading…" : "Refresh"}</button>
    </header>
  );

  if (error === "forbidden") {
    return <div className="own">{header}<div className="own-card"><p>This page is only for the 11 PlusLab owners. You're signed in as {auth.currentUser?.email}.</p><a className="own-link" href="/">Back to the app</a></div></div>;
  }
  if (error === "verify") {
    return (
      <div className="own">{header}
        <div className="own-card">
          <h2>Verify your email first</h2>
          <p>For security, the dashboard only opens once {auth.currentUser?.email} is verified.</p>
          {sent
            ? <p>We've sent a link to your inbox. Click it, then come back and tap “I've verified”.</p>
            : <button className="own-btn own-btn-primary" onClick={async () => { await sendEmailVerification(auth.currentUser); setSent(true); }}>Send verification email</button>}
          <button className="own-btn" onClick={() => load(true)} style={{ marginTop: 10 }}>I've verified</button>
        </div>
      </div>
    );
  }
  if (error) {
    return <div className="own">{header}<div className="own-card"><p>Couldn't load the numbers. Please tap Refresh.</p></div></div>;
  }
  if (!data) return <div className="own">{header}<div className="own-card"><p className="own-muted">Loading the numbers…</p></div></div>;

  const { accounts, activity, games, plans, trials, players, quiet, emails, outreach } = data;
  const paying = (plans.Paying || 0) + (plans["Paying (cancelling)"] || 0);
  const trialsDone = trials.converted + trials.droppedAfterTrial;
  const maxSignup = Math.max(1, ...accounts.signupsByDay.map((d) => d.n));

  return (
    <div className="own">
      {header}

      <section>
        <h2>Today and this week</h2>
        <div className="own-tiles">
          <Tile label="Played today" value={activity.active.today} sub={`${activity.rounds.today} rounds`} />
          <Tile label="Played this week" value={activity.active.week} sub={`${activity.rounds.week} rounds`} />
          <Tile label="New sign-ups" value={accounts.newWeek} sub={`this week · ${accounts.newToday} today`} />
          <Tile label="Paying" value={paying} sub={`${plans["Free trial"] || 0} in free trial`} />
        </div>
      </section>

      <section className="own-card">
        <h2>Sign-ups, last 14 days</h2>
        <p className="own-muted">{accounts.total} accounts in total · {accounts.newMonth} in the last 30 days</p>
        <div className="own-cols" role="img" aria-label={accounts.signupsByDay.map((d) => `${d.day}: ${d.n}`).join(", ")}>
          {accounts.signupsByDay.map((d, i) => (
            <div className="own-col" key={d.day} title={`${d.day}: ${d.n} sign-up${d.n === 1 ? "" : "s"}`}>
              <div className="own-col-val">{d.n || ""}</div>
              <div className="own-col-bar" style={{ height: `${(d.n / maxSignup) * 100}%` }} />
              <div className="own-col-day">{i % 2 === 1 ? d.day.slice(0, 5) : ""}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="own-card">
        <h2>Free to paid</h2>
        <div className="own-plans">
          {PLAN_ORDER.filter((p) => plans[p]).map((p) => (
            <div className="own-plan" key={p}><span className={`own-pill own-pill-${PLAN_TONE[p]}`}>{p}</span><strong>{plans[p]}</strong></div>
          ))}
        </div>
        <p className="own-muted" style={{ marginTop: 12 }}>
          Trials finished: {trialsDone} · became paying: {trials.converted} ({pct(trials.converted, trialsDone)})
        </p>
      </section>

      <section className="own-card">
        <h2>Games played</h2>
        <p className="own-muted">Rounds in the last 30 days ({activity.rounds.month} in total)</p>
        {games.length ? <Bars rows={games.map((g) => ({ label: g.game, value: g.month }))} /> : <p className="own-muted">No rounds yet.</p>}
      </section>

      <section className="own-card">
        <h2>Gone quiet</h2>
        <p className="own-muted">{activity.quietCount} haven't played for 5–30 days (these get the reminder email) · {activity.neverPlayed} signed up but never played</p>
        {quiet.length > 0 && (
          <ul className="own-list">
            {quiet.map((p, i) => <li key={i}><span>{p.name}</span><span className="own-muted">{ago(p.lastPlayed)}</span></li>)}
          </ul>
        )}
      </section>

      <section className="own-card">
        <h2>Players</h2>
        <p className="own-muted">Most recently active first · {emails.unsubscribed} unsubscribed from reminders</p>
        <ul className="own-list own-players">
          {players.slice(0, 40).map((p, i) => (
            <li key={i}>
              <div>
                <div className="own-player-name">{p.name}</div>
                <div className="own-muted">{ago(p.lastPlayed)} · {p.roundsWeek} rounds this week</div>
              </div>
              <span className={`own-pill own-pill-${PLAN_TONE[p.plan]}`}>{p.plan}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="own-card">
        <h2>Tuition-centre outreach</h2>
        <div className="own-tiles own-tiles-3">
          <Tile label="Sent" value={outreach.counts.sent || 0} />
          <Tile label="Waiting" value={outreach.counts.queued || 0} />
          <Tile label="Opted out" value={outreach.counts.optedOut || 0} sub={outreach.counts.failed ? `${outreach.counts.failed} failed` : null} />
        </div>
        <h3>Codes used</h3>
        {outreach.redeemed.length
          ? <Bars rows={outreach.redeemed.map((r) => ({ label: `${r.code} · ${r.centre}`, value: r.times }))} />
          : <p className="own-muted">No centre codes used yet.</p>}
      </section>

      <p className="own-foot"><a className="own-link" href="/">Back to the app</a></p>
    </div>
  );
}
