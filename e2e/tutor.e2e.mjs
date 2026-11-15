// End-to-end test of the tutor feature in real browsers, against the Firebase
// emulators (real security rules) and the real API functions.
//   npm run test:e2e
// Desktop Chrome runs the whole journey; iPhone Safari (WebKit) re-runs the
// parent and tutor screens at phone size. Screenshots go to e2e/screenshots/.
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createServer } from "vite";
import { startApiServer } from "./api-server.mjs";

process.env.VITE_FIREBASE_PROJECT_ID = "demo-11plus";
process.env.EMAIL_DRY_RUN = "1";
process.env.ADMIN_SECRET = "e2e-admin-secret";
const { adminAuth, adminDb } = await import("../server/firebaseAdmin.js");

// Playwright from the project if installed, otherwise the global install.
async function loadPlaywright() {
  try { return await import("playwright"); } catch { /* fall through */ }
  const globalRoot = execSync("npm root -g").toString().trim();
  return import(path.join(globalRoot, "playwright", "index.mjs"));
}
const { chromium, webkit, devices } = await loadPlaywright();

const APP = "http://127.0.0.1:5310";
const SHOTS = path.join(import.meta.dirname, "screenshots");
mkdirSync(SHOTS, { recursive: true });
const PASSWORD = "secret-pass-123";
let step = 0;
const log = (msg) => console.log(`  ✓ ${++step}. ${msg}`);

async function makeUser(uid, email, displayName) {
  await adminAuth().createUser({ uid, email, password: PASSWORD, displayName, emailVerified: true });
}
const outbox = async () => (await fetch(`${APP}/__outbox`)).json();

async function signIn(page, url, email) {
  await page.goto(`${APP}${url}`);
  await page.getByRole("button", { name: "Sign in with email" }).click();
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function noSideScroll(page, where) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  assert.ok(sw <= iw + 1, `${where}: page scrolls sideways (${sw}px wide in a ${iw}px window)`);
}

// A realistic week of practice for a pupil, as the app syncs it to users/{uid}.
function practice(today = new Date()) {
  const d = (n) => new Date(today.getTime() - n * 864e5).toLocaleDateString("en-GB");
  return {
    history: {
      "A-synonyms-10": [{ stars: 3, wrong: 1, time: 180, name: "Amu", date: d(0) }, { stars: 2, wrong: 3, time: 200, name: "Amu", date: d(1) }],
      "B-spelling-10": [{ stars: 1, wrong: 6, time: 240, name: "Amu", date: d(2) }],
    },
    progress: {
      skills: { synonyms: { hits: 40, misses: 6 }, spelling: { hits: 14, misses: 16 } },
      words: {
        "synonyms:meticulous": { word: "Meticulous", skill: "synonyms", misses: 3, hitsSinceMiss: 0, meaning: "Very careful about details" },
        "spelling:necessary": { word: "necessary", skill: "spelling", misses: 2, hitsSinceMiss: 1 },
        "synonyms:placid": { word: "Placid", skill: "synonyms", misses: 1, hitsSinceMiss: 2 },
      },
    },
  };
}

async function main() {
  const api = await startApiServer(5311);
  const vite = await createServer({ configFile: path.join(import.meta.dirname, "vite.config.js") });
  await vite.listen();
  const browsers = [];
  try {
    return await journey(browsers);
  } catch (e) {
    // Leave a picture of every open page to debug from.
    let n = 0;
    for (const b of browsers) for (const c of b.contexts()) for (const pg of c.pages()) {
      await pg.screenshot({ path: path.join(SHOTS, `failure-${++n}.png`), fullPage: true }).catch(() => {});
      console.error(`  [failure-${n}.png] ${pg.url()}\n    ${(await pg.locator("body").innerText().catch(() => "")).slice(0, 400).replace(/\n+/g, " | ")}`);
    }
    throw e;
  } finally {
    await Promise.all(browsers.map((b) => b.close()));
    await vite.close();
    api.close();
  }
}

async function journey(browsers) {
  {
    await makeUser("tutor1", "ms.patel@tutors.test", "Ms Patel");
    await makeUser("owner1", "reuben.dongre@gmail.com", "Reuben");
    await makeUser("kid1", "parent.amu@family.test", "Amu");
    await makeUser("kid2", "parent.leo@family.test", "Leo");

    console.log("\nDesktop Chrome");
    const chrome = await chromium.launch();
    browsers.push(chrome);
    const desk = { viewport: { width: 1280, height: 900 } };

    // 1. Tutor signs in at /tutor and applies.
    const tutorCtx = await chrome.newContext(desk);
    const tutor = await tutorCtx.newPage();
    await tutor.goto(`${APP}/tutor`);
    await tutor.getByTestId("tutor-signin-banner").waitFor();
    await signIn(tutor, "/tutor", "ms.patel@tutors.test");
    await tutor.getByRole("heading", { name: "Become an 11 PlusLab tutor" }).waitFor();
    const applyBtn = tutor.getByRole("button", { name: "Apply for a free tutor account" });
    assert.equal(await applyBtn.isDisabled(), true, "apply button should wait for name + confirmation");
    await tutor.getByLabel("Your name").fill("Ms Patel");
    await tutor.getByLabel(/Tutoring business/).fill("Patel Tuition");
    await tutor.getByRole("checkbox").check();
    await applyBtn.click();
    await tutor.getByRole("heading", { name: "Thanks for applying" }).waitFor();
    assert.ok((await outbox()).some((m) => m.to === "hello@11pluslab.com" && /New tutor application/.test(m.subject)));
    log("Tutor applies at /tutor; owner is emailed; tutor sees 'Thanks for applying'");

    // 2. A pending tutor can't be connected to.
    const pendingCode = (await adminDb().doc("tutors/tutor1").get()).get("code");
    assert.equal(pendingCode, undefined, "no join code before approval");
    log("No join code exists before approval");

    // 3. Owner approves on /owner.
    const ownerCtx = await chrome.newContext(desk);
    const owner = await ownerCtx.newPage();
    owner.on("dialog", (d) => d.accept());
    await signIn(owner, "/owner", "reuben.dongre@gmail.com");
    const row = owner.getByTestId("tutor-admin-row").filter({ hasText: "Ms Patel" });
    await row.getByRole("button", { name: "Approve" }).click();
    await row.getByText("active").waitFor();
    await owner.screenshot({ path: path.join(SHOTS, "owner-tutors.png"), fullPage: true });
    assert.ok((await outbox()).some((m) => m.to === "ms.patel@tutors.test" && /approved/i.test(m.subject)));
    log("Owner approves the tutor on /owner; tutor gets the 'approved' email");

    // 4. Tutor sees the dashboard with a join code and no pupils.
    await tutor.reload();
    await tutor.getByTestId("no-pupils").waitFor();
    const code = (await tutor.getByTestId("tutor-code").innerText()).trim();
    assert.match(code, /^TUT-[2-9A-HJKMNP-Z]{8}$/);
    await tutor.screenshot({ path: path.join(SHOTS, "tutor-empty.png"), fullPage: true });
    log(`Tutor dashboard shows join code ${code} and 'No pupils yet'`);

    // 5. Tutor accounts don't get friends.
    await tutor.goto(`${APP}/`);
    await tutor.getByRole("button", { name: /Board/ }).first().click();
    await tutor.getByText("Tutor accounts don't use friends").waitFor();
    log("Tutor account sees no friends option on the leaderboard");

    // 6. Parent connects their child in Settings → Tutors.
    const kidCtx = await chrome.newContext(desk);
    const kid = await kidCtx.newPage();
    await signIn(kid, "/", "parent.amu@family.test");
    await kid.getByRole("button", { name: "Me", exact: true }).click();
    const card = kid.getByTestId("tutors-card");
    await card.getByRole("button", { name: "Connect" }).click();
    await kid.getByLabel("Tutor's join code").fill("TUT-WRONGCOD");
    await kid.getByRole("button", { name: "Next" }).click();
    await kid.getByText("We couldn't find a tutor with that code").waitFor();
    await kid.getByLabel("Tutor's join code").fill(code.toLowerCase());
    await kid.getByRole("button", { name: "Next" }).click();
    const confirm = kid.getByRole("dialog", { name: "Connect Amu to Ms Patel?" });
    await confirm.waitFor();
    await confirm.getByText("Your email address or name").waitFor();
    await kid.screenshot({ path: path.join(SHOTS, "parent-confirm.png") });
    await confirm.getByRole("button", { name: "Connect" }).click();
    await card.getByText("Ms Patel · Patel Tuition").waitFor();
    const mails = await outbox();
    assert.ok(mails.some((m) => m.to === "parent.amu@family.test" && /Amu is now connected to Ms Patel/.test(m.subject)), "parent is told");
    assert.ok(mails.some((m) => m.to === "ms.patel@tutors.test" && /Amu has joined/.test(m.subject)), "tutor is told");
    log("Wrong code is refused; right code shows what's shared; parent confirms; parent and tutor are emailed");

    // 7. The child practises (synced progress), and the tutor sees it.
    await adminDb().doc("users/kid1").set(practice(), { merge: true });
    await tutor.goto(`${APP}/tutor`);
    const pupil = tutor.getByTestId("pupil-row").filter({ hasText: "Amu" });
    await pupil.waitFor();
    const rowText = await pupil.innerText();
    assert.match(rowText, /3\s*rounds this week/);
    assert.match(rowText, /Last played today/);
    assert.match(rowText, /Struggling with Spelling/);
    await tutor.getByText("Words the group keeps missing").waitFor();
    await tutor.screenshot({ path: path.join(SHOTS, "tutor-class.png"), fullPage: true });
    await pupil.click();
    await tutor.getByRole("heading", { name: "Amu" }).waitFor();
    await tutor.getByRole("cell", { name: "Meticulous" }).waitFor();
    await tutor.getByText("1 tricky word has already been turned around").waitFor();
    await tutor.screenshot({ path: path.join(SHOTS, "tutor-pupil.png"), fullPage: true });
    log("Tutor sees Amu's rounds, flags, weak words and recent rounds");

    // 8. The tutor can't see a child who isn't connected (Leo).
    await adminDb().doc("users/kid2").set(practice(), { merge: true });
    await tutor.getByRole("button", { name: "← All pupils" }).click();
    assert.equal(await tutor.getByTestId("pupil-row").filter({ hasText: "Leo" }).count(), 0);
    log("A child who isn't connected never appears");

    // 9. Parent disconnects; the tutor loses access straight away.
    await kid.reload();
    await kid.getByTestId("tutors-card").getByRole("button", { name: "Disconnect" }).click();
    await kid.getByRole("dialog", { name: "Disconnect Ms Patel?" }).getByRole("button", { name: "Disconnect" }).click();
    await kid.getByTestId("tutors-card").getByText("Ms Patel · Patel Tuition").waitFor({ state: "detached" });
    await tutor.getByRole("button", { name: "Refresh" }).click();
    await tutor.getByTestId("no-pupils").waitFor();
    log("Parent disconnects; Amu disappears from the tutor's dashboard");

    // 10. Owner suspends the tutor; the dashboard closes.
    await owner.reload();
    await owner.getByTestId("tutor-admin-row").filter({ hasText: "Ms Patel" }).getByRole("button", { name: "Suspend" }).click();
    await owner.getByTestId("tutor-admin-row").filter({ hasText: "Ms Patel" }).getByText("suspended").waitFor();
    await tutor.reload();
    await tutor.getByRole("heading", { name: "Your tutor account is paused" }).waitFor();
    log("Owner suspends the tutor; their dashboard is switched off");

    // Reactivate for the phone run.
    await owner.getByTestId("tutor-admin-row").filter({ hasText: "Ms Patel" }).getByRole("button", { name: "Reactivate" }).click();
    await owner.getByTestId("tutor-admin-row").filter({ hasText: "Ms Patel" }).getByText("active").waitFor();

    console.log("\niPhone Safari (WebKit)");
    const safari = await webkit.launch();
    browsers.push(safari);
    const phone = devices["iPhone 13"];

    // 11. Parent on a phone connects Leo.
    const leoCtx = await safari.newContext(phone);
    const leo = await leoCtx.newPage();
    leo.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log(`    [phone console] ${m.text().slice(0, 200)}`); });
    await signIn(leo, "/", "parent.leo@family.test");
    await leo.getByRole("button", { name: "Me", exact: true }).click();
    await leo.getByTestId("tutors-card").getByRole("button", { name: "Connect" }).click();
    await leo.getByLabel("Tutor's join code").fill(code);
    await leo.getByRole("button", { name: "Next" }).click();
    const leoConfirm = leo.getByRole("dialog", { name: "Connect Leo to Ms Patel?" });
    await leoConfirm.waitFor();
    await noSideScroll(leo, "phone confirm sheet");
    await leo.screenshot({ path: path.join(SHOTS, "phone-parent-confirm.png") });
    await leoConfirm.getByRole("button", { name: "Connect" }).click();
    await leo.getByTestId("tutors-card").getByText("Ms Patel · Patel Tuition").waitFor();
    await noSideScroll(leo, "phone settings");
    log("Parent connects Leo from a phone");

    // 12. Tutor's dashboard on a phone.
    const tPhoneCtx = await safari.newContext(phone);
    const tPhone = await tPhoneCtx.newPage();
    await signIn(tPhone, "/tutor", "ms.patel@tutors.test");
    const leoRow = tPhone.getByTestId("pupil-row").filter({ hasText: "Leo" });
    await leoRow.waitFor();
    await noSideScroll(tPhone, "phone tutor dashboard");
    await tPhone.screenshot({ path: path.join(SHOTS, "phone-tutor-class.png"), fullPage: true });
    await leoRow.click();
    await tPhone.getByRole("heading", { name: "Leo" }).waitFor();
    await noSideScroll(tPhone, "phone pupil page");
    await tPhone.screenshot({ path: path.join(SHOTS, "phone-tutor-pupil.png"), fullPage: true });
    log("Tutor dashboard and pupil page fit an iPhone screen");

    console.log(`\nAll ${step} end-to-end checks passed. Screenshots: e2e/screenshots/\n`);
  }
}

main().then(() => process.exit(0), (e) => { console.error(`\n  ✗ Failed after step ${step}:`, e.message, "\n"); process.exit(1); });
