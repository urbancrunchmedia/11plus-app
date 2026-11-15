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

  it("creates a pending application and emails the owner", async () => {
    const u = await makeUser("t", "t@tutors.test");
    const res = await call(handler, { token: u.token, body: { action: "apply", name: "  Ms   Patel ", business: "Patel Tuition", confirm: true } });
    expect(res).toEqual({ status: 200, data: { status: "pending" } });
    const doc = (await adminDb().doc("tutors/t").get()).data();
    expect(doc).toMatchObject({ status: "pending", name: "Ms Patel", email: "t@tutors.test" });
    expect(doc.code).toBeUndefined();
    expect(outbox().map((m) => m.to)).toEqual(["hello@11pluslab.com"]);
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
    expect(look).toEqual({ status: 200, data: { tutorName: "Ms Patel", business: "Patel Tuition" } });

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

  it("doesn't let a pending tutor be found", async () => {
    const u = await makeUser("t", "t@tutors.test");
    await call(handler, { token: u.token, body: { action: "apply", name: "Ms Patel", confirm: true } });
    await adminDb().doc("tutorCodes/TUT-ABCDEFGH").set({ tutorUid: "t" });
    const kid = await makeUser("kid1", "p@family.test", "Amu");
    expect((await call(handler, { token: kid.token, body: { action: "lookup", code: "TUT-ABCDEFGH" } })).status).toBe(404);
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

