import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTutor } from "../contexts/TutorContext";
import QRCode from "qrcode";
import { tutorApi, getPupils, removePupil, joinMessage } from "../utils/tutor";
import { tutorJoinLink } from "../utils/tutorJoin";
import { pupilSummary, classSummary, sortPupils, SORTS, GAME_ORDER } from "../utils/tutorMetrics";
import { demoPupils } from "../utils/tutorDemo";
import { SKILL_LABEL } from "../utils/progress";

// /tutor — everything a tutor needs: apply, wait for approval, then a
// dashboard of the pupils whose parents connected them with the join code.

// From pupilSummary's daysSinceActive (calendar days, not hours).
const ago = (days) => {
  if (days == null) return "Not yet";
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
};
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const pctText = (n) => (n == null ? "–" : `${n}%`);

function Trend({ value }) {
  if (value == null || Math.abs(value) < 3) return null;
  const up = value > 0;
  return <span className={`tut-trend ${up ? "up" : "down"}`} title={`${up ? "Up" : "Down"} ${Math.abs(value)} points on earlier weeks`}>{up ? "▲" : "▼"} {Math.abs(value)}</span>;
}

function Tile({ label, value, sub }) {
  return (
    <div className="tut-tile">
      <div className="tut-tile-label">{label}</div>
      <div className="tut-tile-value">{value}</div>
      {sub && <div className="tut-tile-sub">{sub}</div>}
    </div>
  );
}

function Header({ title }) {
  const { signOut } = useAuth();
  return (
    <header className="tut-head">
      <a href="/" className="tut-brand" aria-label="11 PlusLab home"><img src="/logo-mark-simple.svg" alt="" width="40" height="40" /></a>
      <div className="tut-head-txt">
        <div className="tut-eyebrow">11 PlusLab for tutors</div>
        <h1 className="tut-title">{title}</h1>
      </div>
      <div className="tut-head-actions">
        <a className="tut-btn ghost" href="/">Play the games</a>
        <button className="tut-btn ghost" onClick={signOut}>Sign out</button>
      </div>
    </header>
  );
}

function Apply({ onDone }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", business: "", website: "", phone: "", confirm: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try { await tutorApi("apply", form); await onDone(); }
    catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <div className="tut-page">
      <Header title="Become an 11 PlusLab tutor" />
      <div className="tut-grid2">
        <form className="tut-card tut-form" onSubmit={submit}>
          <h2 className="tut-h2">Your details</h2>
          <label className="tut-field">Your name<input value={form.name} onChange={set("name")} maxLength={60} required autoComplete="name" /></label>
          <label className="tut-field">Tutoring business or centre <span>(optional)</span><input value={form.business} onChange={set("business")} maxLength={80} autoComplete="organization" /></label>
          <label className="tut-field">Website <span>(optional, helps us approve you faster)</span><input value={form.website} onChange={set("website")} maxLength={120} inputMode="url" /></label>
          <label className="tut-field">Phone <span>(optional)</span><input value={form.phone} onChange={set("phone")} maxLength={30} inputMode="tel" autoComplete="tel" /></label>
          <label className="tut-check">
            <input type="checkbox" checked={form.confirm} onChange={set("confirm")} />
            <span>I'm a tutor or work at a tuition centre, and I'll only use pupils' progress to support their learning.</span>
          </label>
          {error && <div className="board-msg err" role="alert">{error}</div>}
          <button className="tut-btn primary" type="submit" disabled={busy || form.name.trim().length < 2 || !form.confirm}>
            {busy ? "Sending…" : "Apply for a free tutor account"}
          </button>
          <p className="tut-small">Signed in as {user?.email}. Please use a separate account from any child's account.</p>
        </form>
        <div className="tut-card tut-how">
          <h2 className="tut-h2">How it works</h2>
          <ol>
            <li><strong>Apply</strong> here. We check every tutor, usually within one working day.</li>
            <li>Once approved you get a <strong>join code</strong>. Give it to your pupils' parents.</li>
            <li>Parents enter it in <strong>Settings → Tutors</strong>. They can disconnect at any time.</li>
            <li>See each pupil's practice, accuracy by game and the words they find tricky.</li>
          </ol>
          <p className="tut-small">Tutor accounts are free and include Full Access, so you can try every game and level.</p>
        </div>
      </div>
    </div>
  );
}

function Paused() {
  return (
    <div className="tut-page">
      <Header title="Your tutor account is paused" />
      <div className="tut-card tut-status">
        <p>Your tutor dashboard is switched off at the moment. If you think this is a mistake, email <a href="mailto:hello@11pluslab.com">hello@11pluslab.com</a>.</p>
      </div>
    </div>
  );
}

// Not approved yet: share the link straight away; progress unlocks on approval.
function Pending({ tutor, refreshTutor }) {
  const [pupils, setPupils] = useState(null);
  const [poster, setPoster] = useState(false);
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    let live = true;
    tutorApi("summary").then((r) => { if (live) setPupils(r.pupils); }).catch(() => {});
    return () => { live = false; };
  }, []);
  async function newCode() { await tutorApi("newCode"); await refreshTutor(); }
  if (poster) return <Poster tutor={tutor} onClose={() => setPoster(false)} />;
  if (demo) return <DemoClass onExit={() => setDemo(false)} />;
  return (
    <div className="tut-page">
      <Header title="Your link is ready" />
      <div className="tut-card tut-status tut-pending" data-testid="tutor-pending">
        <p><b>Start inviting families now.</b> We check every tutor before they can see children's progress, usually the same day. We'll email {tutor.email} as soon as you're approved.</p>
        {pupils != null && (
          <p data-testid="pending-count">{pupils === 0 ? "No families have connected yet." : `${pupils} ${pupils === 1 ? "family has" : "families have"} connected. You'll see their progress once you're approved.`}</p>
        )}
      </div>
      <CodeCard tutor={tutor} onNewCode={newCode} onPoster={() => setPoster(true)} />
      {pupils === 0 ? <FirstPupils tutor={tutor} onPoster={() => setPoster(true)} onDemo={() => setDemo(true)} /> : (
        <div className="tut-card tut-demo-cta">
          <div><b>See what you'll get once approved.</b> Explore an example dashboard with 12 made-up pupils.</div>
          <button className="tut-btn ghost" onClick={() => setDemo(true)} data-testid="see-example">See an example class</button>
        </div>
      )}
    </div>
  );
}

// Share text for WhatsApp/email, and the poster's QR code.
function useJoin(tutor) {
  const link = tutorJoinLink(tutor.code);
  return { link, message: joinMessage(tutor.code, tutor.business || tutor.name, link) };
}

function CodeCard({ tutor, onNewCode, onPoster }) {
  const { link, message } = useJoin(tutor);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const flash = (t) => { setNote(t); setTimeout(() => setNote(""), 2500); };

  async function copy(text, done) {
    try { await navigator.clipboard.writeText(text); flash(done); }
    catch { flash(`Your link is ${link}`); }
  }
  async function share() {
    if (navigator.share) {
      try { await navigator.share({ text: message }); return; } catch (e) { if (e?.name === "AbortError") return; }
    }
    copy(message, "Message copied. Paste it into an email or WhatsApp to parents.");
  }
  async function regenerate() {
    setBusy(true);
    try { await onNewCode(); setConfirm(false); flash("New link ready. The old link and code no longer work."); }
    catch (e) { flash(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="tut-card tut-code">
      <div className="tut-code-main">
        <div className="tut-tile-label">Your join link</div>
        <div className="tut-code-link" data-testid="tutor-link">{link.replace(/^https?:\/\//, "")}</div>
        <div className="tut-small">Code for parents already using 11 PlusLab (Settings → Tutors): <b data-testid="tutor-code">{tutor.code}</b></div>
      </div>
      <div className="tut-code-actions">
        <button className="tut-btn primary" onClick={share}>Send to parents</button>
        <a className="tut-btn ghost" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <button className="tut-btn ghost" onClick={() => copy(link, "Link copied")}>Copy link</button>
        <button className="tut-btn ghost" onClick={onPoster}>QR poster</button>
        {confirm ? (
          <span className="tut-confirm">
            Old link stops working. <button className="tut-link" onClick={regenerate} disabled={busy}>{busy ? "Making…" : "Yes, new link"}</button>
            {" · "}<button className="tut-link" onClick={() => setConfirm(false)}>Cancel</button>
          </span>
        ) : (
          <button className="tut-link" onClick={() => setConfirm(true)}>Get a new link</button>
        )}
      </div>
      {note && <div className="tut-note" role="status">{note}</div>}
    </div>
  );
}

// "Get your first pupils": shown until the first family connects.
function FirstPupils({ tutor, onPoster, onDemo }) {
  const { link, message } = useJoin(tutor);
  const subject = `Follow your child's 11+ practice with ${tutor.business || tutor.name}`;
  return (
    <div className="tut-card tut-first" data-testid="first-pupils">
      <h2 className="tut-h2">Get your first pupils</h2>
      <ol className="tut-steps">
        <li><b>Send your link to parents</b> by WhatsApp or email. Use <i>Send to parents</i> above, or <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">open WhatsApp</a>.</li>
        <li><b>Email it to everyone at once:</b> <a href={`mailto:?bcc=&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}>open a ready-written email</a> (add parents in BCC).</li>
        <li><b>Teaching in person?</b> <button className="tut-link" onClick={onPoster}>Print the QR poster</button>. Parents scan it with their phone camera.</li>
        <li>When a parent confirms, their child appears here. You'll get an email too.</li>
      </ol>
      <div className="tut-small">Your link: {link}</div>
      {onDemo && (
        <div className="tut-demo-cta">
          <div><b>Want to see it with a full class?</b> Explore an example dashboard with 12 made-up pupils.</div>
          <button className="tut-btn ghost" onClick={onDemo} data-testid="see-example">See an example class</button>
        </div>
      )}
    </div>
  );
}

// A4 poster with a QR code to the tutor's join link. Printed from the browser.
function Poster({ tutor, onClose }) {
  const { link } = useJoin(tutor);
  const [qr, setQr] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(link, { width: 640, margin: 1, color: { dark: "#0E1116", light: "#FFFFFF" } })
      .then((url) => { if (live) setQr(url); }).catch(() => {});
    return () => { live = false; };
  }, [link]);
  return (
    <div className="tut-poster-wrap" role="dialog" aria-modal="true" aria-label="QR poster">
      <div className="tut-poster-bar">
        <button className="tut-btn primary" onClick={() => window.print()}>Print poster</button>
        <button className="tut-btn ghost" onClick={onClose}>Close</button>
      </div>
      <div className="tut-poster" data-testid="tutor-poster">
        <img src="/logo-lockup.svg" alt="11 PlusLab" className="tut-poster-logo" />
        <h1 className="tut-poster-title">Practise for the 11+ at home</h1>
        <p className="tut-poster-sub">{tutor.business || tutor.name} uses 11 PlusLab: fun vocabulary and English games for ages 8–11.</p>
        {qr ? <img src={qr} alt={`QR code for ${link}`} className="tut-poster-qr" /> : <div className="tut-poster-qr" />}
        <p className="tut-poster-scan">Scan with your phone camera to connect your child</p>
        <p className="tut-poster-link">{link.replace(/^https?:\/\//, "")}</p>
        <p className="tut-poster-small">Free to start · Parents confirm before anything is shared · Disconnect any time</p>
      </div>
    </div>
  );
}

function PupilRow({ p, onOpen }) {
  const s = p.summary;
  return (
    <button className="tut-row" onClick={onOpen} data-testid="pupil-row">
      <span className="tut-avatar">{p.name.slice(0, 1).toUpperCase()}</span>
      <span className="tut-row-main">
        <span className="tut-row-name">{p.name}</span>
        <span className="tut-row-sub">Last played {ago(s.daysSinceActive).toLowerCase()}</span>
        {s.flags.length > 0 && (
          <span className="tut-flags">{s.flags.map((f) => <span key={f.id} className="tut-flag">{f.label}</span>)}</span>
        )}
      </span>
      <span className="tut-row-stat"><b>{s.roundsWeek}</b><small>rounds this week</small></span>
      <span className="tut-row-stat"><b>{s.minutesWeek}</b><small>minutes</small></span>
      <span className="tut-row-stat"><b>{pctText(s.accuracy)} <Trend value={s.trend} /></b><small>accuracy</small></span>
      <span className="tut-row-stat"><b>{s.weakest ? s.weakest.label : "–"}</b><small>weakest game</small></span>
      <span className="tut-row-stat"><b>{s.weakWordCount}</b><small>words to review</small></span>
    </button>
  );
}

function Bars({ rows, empty }) {
  if (!rows.length) return <div className="tut-empty-small">{empty}</div>;
  return (
    <div className="tut-bars">
      {rows.map((r) => (
        <div className="tut-bar-row" key={r.key}>
          <div className="tut-bar-label">{r.label}</div>
          <div className="tut-bar-track"><div className={`tut-bar-fill ${r.pct < 70 ? "low" : ""}`} style={{ width: `${r.pct}%` }} /></div>
          <div className="tut-bar-value">{r.pct}%{r.sub ? <small> {r.sub}</small> : null}</div>
        </div>
      ))}
    </div>
  );
}

function PupilDetail({ p, onBack, onRemove }) {
  const canRemove = !p.demo;
  const s = p.summary;
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="tut-detail">
      <div className="tut-detail-head">
        <button className="tut-btn ghost" onClick={onBack}>← All pupils</button>
        <div className="tut-detail-actions">
          <button className="tut-btn ghost" onClick={() => window.print()}>Print summary</button>
          {!canRemove ? null : confirm ? (
            <span className="tut-confirm">
              Remove {p.name}? <button className="tut-link danger" disabled={busy} onClick={async () => { setBusy(true); await onRemove(); }}>{busy ? "Removing…" : "Yes, remove"}</button>
              {" · "}<button className="tut-link" onClick={() => setConfirm(false)}>Cancel</button>
            </span>
          ) : <button className="tut-link danger" onClick={() => setConfirm(true)}>Remove pupil</button>}
        </div>
      </div>
      <h2 className="tut-pupil-name">{p.name}</h2>
      <div className="tut-small">Connected {fmtDate(p.connectedAt)} · last played {ago(s.daysSinceActive).toLowerCase()}</div>
      {s.flags.length > 0 && <div className="tut-flags tut-flags--big">{s.flags.map((f) => <span key={f.id} className="tut-flag">{f.label}</span>)}</div>}

      <div className="tut-tiles">
        <Tile label="Rounds" value={s.roundsWeek} sub={`this week · ${s.roundsMonth} in 30 days`} />
        <Tile label="Practice time" value={`${s.minutesWeek} min`} sub={`this week · ${s.minutesMonth} min in 30 days`} />
        <Tile label="Accuracy" value={<>{pctText(s.accuracy)} <Trend value={s.trend} /></>} sub={s.answers ? `${s.answers} answers in total` : "No answers yet"} />
        <Tile label="Streak" value={`${s.streak} ${s.streak === 1 ? "day" : "days"}`} sub={`${s.daysActiveMonth} days practised in 30`} />
      </div>

      <div className="tut-grid2">
        <section className="tut-card">
          <h3 className="tut-h3">Accuracy by game</h3>
          <Bars rows={s.skills.map((k) => ({ key: k.skill, label: k.label, pct: k.pct, sub: `(${k.total})` }))} empty="No answers yet." />
          <div className="tut-small">Weakest first. Bars under 70% are highlighted. Numbers in brackets are answers given.</div>
        </section>
        <section className="tut-card">
          <h3 className="tut-h3">Last 4 weeks</h3>
          <div className="tut-cal" aria-label={`${s.daysActiveMonth} days practised in the last 30 days`}>
            {s.calendar.map((d) => (
              <span key={d.day} className={`tut-cal-day ${d.played ? "on" : ""}`} title={`${new Date(d.day).toLocaleDateString("en-GB")}: ${d.played ? "practised" : "no practice"}`} />
            ))}
          </div>
          <h3 className="tut-h3">Games played (30 days)</h3>
          <div className="tut-chips">
            {GAME_ORDER.map((g) => <span key={g} className={`tut-chip ${s.gameCounts[g] ? "" : "zero"}`}>{SKILL_LABEL[g]} <b>{s.gameCounts[g]}</b></span>)}
          </div>
          {Object.keys(s.levelCounts).length > 0 && (
            <div className="tut-small">Levels: {Object.entries(s.levelCounts).map(([l, n]) => `${l} ${n}`).join(" · ")}</div>
          )}
        </section>
      </div>

      <section className="tut-card">
        <h3 className="tut-h3">Words to review <span className="tut-count">{s.weakWordCount}</span></h3>
        <div className="tut-small">Words {p.name} has missed and not yet got right twice in a row. They come back in {p.name}'s games until they stick. {s.turnedAround > 0 && <>{s.turnedAround} tricky {s.turnedAround === 1 ? "word has" : "words have"} already been turned around.</>}</div>
        {s.weakWords.length ? (
          <table className="tut-table">
            <thead><tr><th>Word</th><th>Game</th><th>Meaning</th><th>Missed</th></tr></thead>
            <tbody>{s.weakWords.map((w) => (
              <tr key={`${w.skill}:${w.word}`}><td><b>{w.word}</b></td><td>{SKILL_LABEL[w.skill] || w.skill}</td><td>{w.meaning || "–"}</td><td>{w.misses}×</td></tr>
            ))}</tbody>
          </table>
        ) : <div className="tut-empty-small">Nothing to review right now.</div>}
      </section>

      <section className="tut-card">
        <h3 className="tut-h3">Recent rounds</h3>
        {s.recentRounds.length ? (
          <table className="tut-table">
            <thead><tr><th>Date</th><th>Game</th><th>Level</th><th>Score</th><th>Time</th></tr></thead>
            <tbody>{s.recentRounds.map((r, i) => (
              <tr key={i}>
                <td>{new Date(r.day).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
                <td>{r.gameLabel}</td><td>{r.levelLabel}</td>
                <td>{r.questions} questions · {r.wrong} wrong{r.accuracy != null ? ` (${r.accuracy}%)` : ""}</td>
                <td>{Math.max(1, Math.round(r.seconds / 60))} min</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <div className="tut-empty-small">{p.name} hasn't played a round yet.</div>}
      </section>
    </div>
  );
}

// The class overview: tiles, the sortable pupil list, and group insights.
// Shared by the real dashboard and the example class.
function ClassView({ rows, cls, sort, onSort, onOpen, onRefresh }) {
  const top = cls.topPractiser;
  return (
    <>
      <div className="tut-tiles tut-tiles--5">
        <Tile label="Pupils" value={cls.pupils} />
        <Tile label="Active this week" value={`${cls.activeWeek} of ${cls.pupils}`} />
        <Tile label="Rounds this week" value={cls.roundsWeek} />
        <Tile label="Average accuracy" value={pctText(cls.averageAccuracy)} sub={cls.needsAttention ? `${cls.needsAttention} need${cls.needsAttention === 1 ? "s" : ""} attention` : "Everyone on track"} />
        <Tile label="Most practice this week" value={top ? top.name : "–"} sub={top ? `${top.minutes} min · ${top.rounds} ${top.rounds === 1 ? "round" : "rounds"}` : "Nobody yet this week"} />
      </div>
      <section className="tut-card tut-list">
        <div className="tut-list-head">
          <h2 className="tut-h2">Your pupils</h2>
          <div className="tut-list-tools">
            <label className="tut-sort">Sort by{" "}
              <select value={sort} onChange={(e) => onSort(e.target.value)} data-testid="pupil-sort">
                {Object.entries(SORTS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
              </select>
            </label>
            {onRefresh && <button className="tut-link" onClick={onRefresh}>Refresh</button>}
          </div>
        </div>
        {rows.map((p) => <PupilRow key={p.uid} p={p} onOpen={() => onOpen(p.uid)} />)}
      </section>
      <div className="tut-grid2">
        <section className="tut-card">
          <h3 className="tut-h3">Words the group keeps missing</h3>
          {cls.commonWeakWords.length ? (
            <table className="tut-table">
              <thead><tr><th>Word</th><th>Game</th><th>Pupils</th></tr></thead>
              <tbody>{cls.commonWeakWords.map((w) => (
                <tr key={`${w.skill}:${w.word}`}><td><b>{w.word}</b>{w.meaning ? <small> · {w.meaning}</small> : null}</td><td>{w.skillLabel}</td><td>{w.pupils}</td></tr>
              ))}</tbody>
            </table>
          ) : <div className="tut-empty-small">No shared tricky words yet.</div>}
        </section>
        <section className="tut-card">
          <h3 className="tut-h3">Accuracy by game (group average)</h3>
          <Bars rows={cls.skillAverages.map((k) => ({ key: k.skill, label: k.label, pct: k.pct, sub: `(${k.pupils})` }))} empty="No answers yet." />
          <div className="tut-small">Numbers in brackets are how many pupils have played that game.</div>
        </section>
      </div>
    </>
  );
}

function useClass(pupils, sort) {
  const summarised = useMemo(() => (pupils ? pupils.map((p) => ({ ...p, summary: pupilSummary(p.data) })) : null), [pupils]);
  const rows = useMemo(() => (summarised ? sortPupils(summarised, sort) : null), [summarised, sort]);
  const cls = useMemo(() => (summarised ? classSummary(summarised) : null), [summarised]);
  return { rows, cls };
}

// "See an example class": made-up pupils, generated on this device only.
function DemoClass({ onExit }) {
  const [pupils] = useState(() => demoPupils());
  const [sort, setSort] = useState("attention");
  const [openUid, setOpenUid] = useState(null);
  const { rows, cls } = useClass(pupils, sort);
  const open = rows.find((p) => p.uid === openUid);
  return (
    <div className="tut-page">
      <Header title={open ? "Pupil progress" : "Example class"} />
      <div className="tut-demo-banner" data-testid="demo-banner">
        <span><b>Example class with 12 made-up pupils.</b> Your real pupils appear on your dashboard once parents connect.</span>
        <button className="tut-btn ghost" onClick={onExit}>Back to my dashboard</button>
      </div>
      {open
        ? <PupilDetail p={open} onBack={() => setOpenUid(null)} />
        : <ClassView rows={rows} cls={cls} sort={sort} onSort={setSort} onOpen={(uid) => { setOpenUid(uid); window.scrollTo(0, 0); }} />}
    </div>
  );
}

function Dashboard({ tutor, refreshTutor }) {
  const [pupils, setPupils] = useState(null);
  const [error, setError] = useState("");
  const [openUid, setOpenUid] = useState(null);
  const [toast, setToast] = useState("");
  const [poster, setPoster] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try { setPupils(await getPupils(tutor.uid)); }
    catch { setError("Couldn't load your pupils. Check your connection and try again."); setPupils([]); }
  }, [tutor.uid]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading the tutor's pupils from Firestore.
    load();
  }, [load]);

  const [sort, setSort] = useState("attention");
  const [demo, setDemo] = useState(false);
  const { rows, cls } = useClass(pupils, sort);
  const open = rows?.find((p) => p.uid === openUid);

  async function newCode() {
    await tutorApi("newCode");
    await refreshTutor();
  }

  async function remove(p) {
    await removePupil(tutor.uid, p.uid);
    setOpenUid(null);
    setToast(`${p.name} removed`);
    setTimeout(() => setToast(""), 2500);
    await load();
  }

  if (poster) return <Poster tutor={tutor} onClose={() => setPoster(false)} />;
  if (demo) return <DemoClass onExit={() => setDemo(false)} />;
  return (
    <div className="tut-page">
      <Header title={open ? "Pupil progress" : `Hi ${tutor.name}`} />
      {open ? (
        <PupilDetail p={open} onBack={() => setOpenUid(null)} onRemove={() => remove(open)} />
      ) : (
        <>
          <CodeCard tutor={tutor} onNewCode={newCode} onPoster={() => setPoster(true)} />
          {rows === null ? (
            <div className="tut-card tut-empty">Loading your pupils…</div>
          ) : error ? (
            <div className="tut-card tut-empty">{error} <button className="tut-link" onClick={load}>Try again</button></div>
          ) : rows.length === 0 ? (
            <div data-testid="no-pupils"><FirstPupils tutor={tutor} onPoster={() => setPoster(true)} onDemo={() => setDemo(true)} /></div>
          ) : (
            <ClassView rows={rows} cls={cls} sort={sort} onSort={setSort} onRefresh={load} onOpen={(uid) => { setOpenUid(uid); window.scrollTo(0, 0); }} />
          )}
        </>
      )}
      {toast && <div className="set-toast">{toast}</div>}
    </div>
  );
}

export default function TutorScreen() {
  const { tutor, loading, refresh } = useTutor();
  useEffect(() => { document.title = "Tutor dashboard · 11 PlusLab"; }, []);
  if (loading) return <div className="app-loading"><p>Loading…</p></div>;
  if (!tutor) return <Apply onDone={refresh} />;
  if (tutor.status === "pending") return <Pending tutor={tutor} refreshTutor={refresh} />;
  if (tutor.status !== "active") return <Paused />;
  return <Dashboard tutor={tutor} refreshTutor={refresh} />;
}
