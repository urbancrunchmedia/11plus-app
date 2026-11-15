import { describe, it, expect, beforeEach } from "vitest";
import handler from "../api/tutor.js";
import { adminDb } from "../server/firebaseAdmin.js";
import { call, makeUser, resetEmulators, tokenFor } from "./helpers.js";

const ADMIN = { authorization: `Bearer ${process.env.ADMIN_SECRET}` };
function resCapture() {
  const r = { data: null, setHeader() {} };
  r.status = function (s) { r._status = s; return r; };
  r.json = function (d) { r.data = d; return r; };
  return r;
}
async function asAdmin(body) {
  const res = resCapture();
  await handler({ method: "POST", body, headers: ADMIN }, res);
  return { status: res._status || 200, data: res.data };
}
const outbox = () => globalThis.__emailOutbox || [];

// An approved tutor with a join code.
async function approvedTutor(uid = "tutor1", name = "Ms Patel") {
  const t = await makeUser(uid, `${uid}@tutors.test`);
  await call(handler, { token: t.token, body: { action: "apply", name, business: "Patel Tuition", confirm: true } });
  const { data } = await asAdmin({ action: "approve", uid });
  return { ...t, code: data.code };
}

beforeEach(resetEmulators);

describe("applying to be a tutor", () => {
  it("needs a sign-in, a name and the confirmation box", async () => {
    expect((await call(handler, { body: { action: "apply", name: "X" } })).status).toBe(401);
    const u = await makeUser("t", "t@tutors.test");
    expect((await call(handler, { token: u.token, body: { action: "apply", name: "Al", confirm: false } })).status).toBe(400);
    expect((await call(handler, { token: u.token, body: { action: "apply", name: "A", confirm: true } })).status).toBe(400);
  });

  it("creates a pending application with a join code to share straight away", async () => {
    const u = await makeUser("t", "t@tutors.test");
    const res = await call(handler, { token: u.token, body: { action: "apply", name: "  Ms   Patel ", business: "Patel Tuition", confirm: true } });
    expect(res.data).toMatchObject({ status: "pending", code: expect.stringMatching(/^TUT-/) });
    const doc = (await adminDb().doc("tutors/t").get()).data();
    expect(doc).toMatchObject({ status: "pending", name: "Ms Patel", email: "t@tutors.test", code: res.data.code });
    expect(doc.autoApproved).toBeUndefined();
    const owner = outbox().find((m) => m.to === "hello@11pluslab.com");
    expect(owner.subject).toMatch(/New tutor to approve/);
    expect(owner.html).toMatch(/\/api\/tutor\?approve=t&amp;exp=\d+&amp;t=|\/api\/tutor\?approve=t&exp=\d+&t=/);
    expect(outbox().find((m) => m.to === "t@tutors.test").subject).toMatch(/link is ready/);
  });

  it("approves straight away someone on the outreach list (same email or same business domain)", async () => {
    await adminDb().doc("outreach/a").set({ email: "lorenzo@lorenzostutoring.co.uk", business: "Lorenzo's Tutoring" });
    for (const [uid, email] of [["t1", "lorenzo@lorenzostutoring.co.uk"], ["t2", "admin@lorenzostutoring.co.uk"]]) {
      const u = await makeUser(uid, email);
      const res = await call(handler, { token: u.token, body: { action: "apply", name: "Lorenzo", confirm: true } });
      expect(res.data.status).toBe("active");
      expect((await adminDb().doc(`tutors/${uid}`).get()).data()).toMatchObject({ autoApproved: true, business: "Lorenzo's Tutoring" });
    }
    expect(outbox().some((m) => m.to === "lorenzo@lorenzostutoring.co.uk" && /approved/i.test(m.subject))).toBe(true);
    expect(outbox().find((m) => m.to === "hello@11pluslab.com").subject).toMatch(/pre-approved/);
  });

  it("never treats a shared email provider as a business match", async () => {
    await adminDb().doc("outreach/a").set({ email: "sam.tutor@gmail.com", business: "Sam Tutors" });
    const u = await makeUser("t", "someone.else@gmail.com");
    const res = await call(handler, { token: u.token, body: { action: "apply", name: "Someone", confirm: true } });
    expect(res.data.status).toBe("pending");
  });

  it("can't be used to change an existing tutor's status", async () => {
    const t = await approvedTutor();
    const res = await call(handler, { token: t.token, body: { action: "apply", name: "New name", confirm: true } });
    expect(res.data).toEqual({ status: "active" });
    expect((await adminDb().doc("tutors/tutor1").get()).get("name")).toBe("Ms Patel");
  });
});

describe("owner approval", () => {
  it("is owner-only", async () => {
    const u = await makeUser("t", "t@tutors.test");
    await call(handler, { token: u.token, body: { action: "apply", name: "Ms Patel", confirm: true } });
    expect((await call(handler, { token: u.token, body: { action: "approve", uid: "t" } })).status).toBe(403);
    expect((await call(handler, { token: u.token, body: { action: "adminList" } })).status).toBe(403);
    // An owner's email address that hasn't been verified doesn't count.
    const fake = tokenFor("x", "reuben.dongre@gmail.com", false);
    expect((await call(handler, { token: fake, body: { action: "approve", uid: "t" } })).status).toBe(403);
  });

  it("gives the tutor a join code, emails them, and lists them with pupil counts", async () => {
    const t = await approvedTutor();
    expect(t.code).toMatch(/^TUT-[2-9A-HJKMNP-Z]{8}$/);
    expect(outbox().some((m) => m.to === "tutor1@tutors.test" && /approved/i.test(m.subject))).toBe(true);
    const { data } = await asAdmin({ action: "adminList" });
    expect(data.tutors).toEqual([expect.objectContaining({ uid: "tutor1", status: "active", pupils: 0, code: t.code })]);
  });

  it("removes any friendships the tutor had before approval", async () => {
    const u = await makeUser("t", "t@tutors.test");
    await adminDb().doc("friendships/kid__t").set({ uids: ["kid", "t"] });
    await call(handler, { token: u.token, body: { action: "apply", name: "Ms Patel", confirm: true } });
    await asAdmin({ action: "approve", uid: "t" });
    expect((await adminDb().doc("friendships/kid__t").get()).exists).toBe(false);
  });

  it("declines only pending applications", async () => {
    const t = await approvedTutor();
    expect((await asAdmin({ action: "decline", uid: t.uid })).status).toBe(400);
  });
});

describe("connecting a child with the join code", () => {
  it("shows who the code belongs to, then connects and emails parent and tutor", async () => {
    const t = await approvedTutor();
    const kid = await makeUser("kid1", "parent1@family.test", "Amu");
    const look = await call(handler, { token: kid.token, body: { action: "lookup", code: t.code.toLowerCase().replace("-", " ") } });
    expect(look).toEqual({ status: 200, data: { tutorName: "Ms Patel", business: "Patel Tuition", pending: false } });

    globalThis.__emailOutbox = [];
    const res = await call(handler, { token: kid.token, body: { action: "connect", code: t.code } });
    expect(res.data).toMatchObject({ connected: true, tutorName: "Ms Patel" });
    const link = (await adminDb().doc(`tutorLinks/tutor1__kid1`).get()).data();
    expect(link).toMatchObject({ tutorUid: "tutor1", childUid: "kid1", childName: "Amu", tutorName: "Ms Patel" });
    expect(outbox().map((m) => m.to).sort()).toEqual(["parent1@family.test", "tutor1@tutors.test"]);
    // The tutor's email never includes the parent's address.
    expect(outbox().find((m) => m.to === "tutor1@tutors.test").html).not.toContain("parent1@family.test");
  });

  it("is idempotent", async () => {
    const t = await approvedTutor();
    const kid = await makeUser("kid1", "p@family.test", "Amu");
    await call(handler, { token: kid.token, body: { action: "connect", code: t.code } });
    const again = await call(handler, { token: kid.token, body: { action: "connect", code: t.code } });
    expect(again.data).toMatchObject({ connected: true, already: true });
  });

  it("allows up to 3 tutors per child", async () => {
    const kid = await makeUser("kid1", "p@family.test", "Amu");
    for (let i = 1; i <= 3; i++) {
      const t = await approvedTutor(`tutor${i}`);
      expect((await call(handler, { token: kid.token, body: { action: "connect", code: t.code } })).status).toBe(200);
    }
    const fourth = await approvedTutor("tutor4");
    const res = await call(handler, { token: kid.token, body: { action: "connect", code: fourth.code } });
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/up to 3/);
  });

  it("rejects unknown, malformed, replaced and suspended tutors' codes the same way", async () => {
    const t = await approvedTutor();
    const kid = await makeUser("kid1", "p@family.test", "Amu");
    for (const code of ["TUT-AAAAAAAA", "hello", ""]) {
      expect((await call(handler, { token: kid.token, body: { action: "lookup", code } })).status).toBe(404);
    }
    const { data: fresh } = await call(handler, { token: t.token, body: { action: "newCode" } });
    expect(fresh.code).not.toBe(t.code);
    expect((await call(handler, { token: kid.token, body: { action: "connect", code: t.code } })).status).toBe(404);
    await asAdmin({ action: "suspend", uid: t.uid });
    expect((await call(handler, { token: kid.token, body: { action: "connect", code: fresh.code } })).status).toBe(404);
  });

  it("lets families connect to a pending tutor, saying progress unlocks on approval", async () => {
    const u = await makeUser("t", "t@tutors.test");
    const { data } = await call(handler, { token: u.token, body: { action: "apply", name: "Ms Patel", confirm: true } });
    const kid = await makeUser("kid1", "p@family.test", "Amu");
    expect((await call(handler, { token: kid.token, body: { action: "lookup", code: data.code } })).data).toMatchObject({ pending: true });
    globalThis.__emailOutbox = [];
    const res = await call(handler, { token: kid.token, body: { action: "connect", code: data.code, via: "link" } });
    expect(res.data).toMatchObject({ connected: true, pending: true });
    expect(outbox().find((m) => m.to === "p@family.test").html).toMatch(/Once we've checked their tutor account/);
    expect((await call(handler, { token: u.token, body: { action: "summary" } })).data).toEqual({ status: "pending", pupils: 1 });
    // A family that signed up just now through the link counts as one the tutor brought in.
    expect((await adminDb().doc("tutorLinks/t__kid1").get()).data()).toMatchObject({ via: "link", newFamily: true });
  });

  it("declining a pending tutor disconnects any families and removes the code", async () => {
    const u = await makeUser("t", "t@tutors.test");
    const { data } = await call(handler, { token: u.token, body: { action: "apply", name: "Ms Patel", confirm: true } });
    const kid = await makeUser("kid1", "p@family.test", "Amu");
    await call(handler, { token: kid.token, body: { action: "connect", code: data.code } });
    expect((await asAdmin({ action: "decline", uid: "t" })).data).toEqual({ declined: true, disconnected: 1 });
    expect((await adminDb().doc("tutorLinks/t__kid1").get()).exists).toBe(false);
    expect((await adminDb().doc(`tutorCodes/${data.code}`).get()).exists).toBe(false);
    expect((await call(handler, { token: kid.token, body: { action: "lookup", code: data.code } })).status).toBe(404);
  });

  it("stops tutors connecting to tutors, or to themselves", async () => {
    const t = await approvedTutor();
    const t2 = await approvedTutor("tutor2");
    expect((await call(handler, { token: t2.token, body: { action: "connect", code: t.code } })).status).toBe(400);
    expect((await call(handler, { token: t.token, body: { action: "connect", code: t.code } })).status).toBe(404);
  });

  it("stops a connected child's account from becoming a tutor", async () => {
    const t = await approvedTutor();
    const kid = await makeUser("kid1", "p@family.test", "Amu");
    await call(handler, { token: kid.token, body: { action: "connect", code: t.code } });
    const res = await call(handler, { token: kid.token, body: { action: "apply", name: "Amu", confirm: true } });
    expect(res.status).toBe(400);
  });

  it("rate-limits code guessing per account and per network address", async () => {
    const kid = await makeUser("kid1", "p@family.test", "Amu");
    for (let i = 0; i < 20; i++) await call(handler, { token: kid.token, body: { action: "lookup", code: "TUT-AAAAAAAA" }, ip: `10.0.0.${i}` });
    expect((await call(handler, { token: kid.token, body: { action: "lookup", code: "TUT-AAAAAAAA" }, ip: "10.0.1.1" })).status).toBe(429);

    // Many accounts from one address.
    await resetEmulators();
    const users = await Promise.all(Array.from({ length: 61 }, (_, i) => makeUser(`k${i}`, `k${i}@family.test`)));
    let last;
    for (const u of users) last = await call(handler, { token: u.token, body: { action: "lookup", code: "TUT-AAAAAAAA" }, ip: "9.9.9.9" });
    expect(last.status).toBe(429);
  });
});

describe("join codes", () => {
  it("only an active tutor can get a new code, and the old code stops working", async () => {
    const kid = await makeUser("kid1", "p@family.test", "Amu");
    expect((await call(handler, { token: kid.token, body: { action: "newCode" } })).status).toBe(403);
    const t = await approvedTutor();
    const { data } = await call(handler, { token: t.token, body: { action: "newCode" } });
    expect((await adminDb().doc(`tutorCodes/${t.code}`).get()).exists).toBe(false);
    expect((await adminDb().doc(`tutorCodes/${data.code}`).get()).get("tutorUid")).toBe("tutor1");
  });
});


describe("public lookup for the /join page", () => {
  it("needs no sign-in and returns only the tutor's name and business", async () => {
    const t = await approvedTutor();
    const res = await call(handler, { body: { action: "publicLookup", code: t.code } });
    expect(res).toEqual({ status: 200, data: { tutorName: "Ms Patel", business: "Patel Tuition" } });
    expect((await call(handler, { body: { action: "publicLookup", code: "TUT-AAAAAAAA" } })).status).toBe(404);
  });

  it("is rate-limited per network address", async () => {
    let last;
    for (let i = 0; i < 61; i++) last = await call(handler, { body: { action: "publicLookup", code: "TUT-AAAAAAAA" }, ip: "7.7.7.7" });
    expect(last.status).toBe(429);
  });
});

describe("one-tap approve link from the owner's email", () => {
  // A response helper that captures HTML pages too.
  async function raw(req) {
    const res = { headers: {}, statusCode: 200, body: "", setHeader(k, v) { this.headers[k] = v; }, status(s) { this.statusCode = s; return this; }, json(d) { this.body = JSON.stringify(d); return this; }, end(b) { this.body = b; } };
    await handler({ headers: {}, ...req }, res);
    return res;
  }
  async function pendingWithLink() {
    const u = await makeUser("t", "t@tutors.test");
    await call(handler, { token: u.token, body: { action: "apply", name: "Ms Patel", confirm: true } });
    const html = outbox().find((m) => m.to === "hello@11pluslab.com").html.replace(/&amp;/g, "&");
    const url = new URL(html.match(/https:\/\/11pluslab\.com\/api\/tutor\?approve=[^"]+/)[0]);
    return Object.fromEntries(url.searchParams);
  }

  it("opening the link only shows a confirm page (link scanners can't approve)", async () => {
    const q = await pendingWithLink();
    const page = await raw({ method: "GET", query: q });
    expect(page.body).toContain("Approve Ms Patel?");
    expect((await adminDb().doc("tutors/t").get()).get("status")).toBe("pending");
  });

  it("pressing Approve approves the tutor and emails them", async () => {
    const q = await pendingWithLink();
    globalThis.__emailOutbox = [];
    const res = await raw({ method: "POST", body: { action: "approveLink", uid: q.approve, exp: q.exp, t: q.t } });
    expect(res.body).toContain("Approved");
    expect((await adminDb().doc("tutors/t").get()).get("status")).toBe("active");
    expect(outbox().some((m) => m.to === "t@tutors.test" && /approved/i.test(m.subject))).toBe(true);
  });

  it("rejects a tampered, wrong-tutor or expired link", async () => {
    const q = await pendingWithLink();
    for (const body of [
      { action: "approveLink", uid: q.approve, exp: q.exp, t: q.t.slice(0, -2) + "xx" },
      { action: "approveLink", uid: "someone-else", exp: q.exp, t: q.t },
      { action: "approveLink", uid: q.approve, exp: String(Date.now() - 1000), t: q.t },
    ]) {
      const res = await raw({ method: "POST", body });
      expect(res.statusCode).toBe(400);
    }
    expect((await adminDb().doc("tutors/t").get()).get("status")).toBe("pending");
  });
});
