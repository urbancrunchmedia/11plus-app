import { describe, it, expect, beforeEach } from "vitest";
import owner from "../api/admin/owner.js";
import status from "../api/status.js";
import { adminDb } from "../server/firebaseAdmin.js";
import { call, makeUser, resetEmulators } from "./helpers.js";

const ADMIN = "test-admin-secret";
const get = (token) => call(status, { token, method: "GET" });

describe("complimentary access from the owner dashboard", () => {
  beforeEach(resetEmulators);

  it("the owner can give and remove it; the family's plan follows", async () => {
    const fam = await makeUser("fam1", "parent@family.test", "Raph");
    expect((await get(fam.token)).data.status).not.toBe("comp");

    const on = await call(owner, { token: ADMIN, body: { action: "setComp", uid: "fam1", on: true } });
    expect(on.status).toBe(200);
    expect((await adminDb().doc("compAccess/fam1").get()).get("email")).toBe("parent@family.test");
    const s = await get(fam.token);
    expect(s.data).toMatchObject({ isPremium: true, status: "comp" });

    await call(owner, { token: ADMIN, body: { action: "setComp", uid: "fam1", on: false } });
    expect((await adminDb().doc("compAccess/fam1").get()).exists).toBe(false);
    expect((await get(fam.token)).data.status).not.toBe("comp");
  });

  it("nobody else can change it, and bad requests are refused", async () => {
    const fam = await makeUser("fam2", "someone@family.test", "Sam");
    const sneaky = await call(owner, { token: fam.token, body: { action: "setComp", uid: "fam2", on: true } });
    expect(sneaky.status).toBe(403);
    expect((await adminDb().doc("compAccess/fam2").get()).exists).toBe(false);
    expect((await call(owner, { token: ADMIN, body: { action: "setComp", uid: "nobody", on: true } })).status).toBe(404);
    expect((await call(owner, { token: ADMIN, body: { action: "setComp", uid: "fam2", on: "yes" } })).status).toBe(400);
  });
});
