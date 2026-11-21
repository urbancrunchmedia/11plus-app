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
  if (url) await page.goto(`${APP}${url}`);
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

    // 1. Tutor signs in at /tutor, applies, and can share a link straight away.
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
    assert.equal(await tutor.getByLabel("Country code").inputValue(), "+44", "UK is the default country code");
    await tutor.getByLabel("Phone number").fill("07700 900123");
    await tutor.getByRole("checkbox").check();
    await applyBtn.click();
    await tutor.getByTestId("tutor-pending").waitFor();
    assert.equal((await adminDb().doc("tutors/tutor1").get()).get("phone"), "+44 7700 900123");
    const code = (await tutor.getByTestId("tutor-code").innerText()).trim();
    assert.match(code, /^TUT-[2-9A-HJKMNP-Z]{8}$/);
    assert.match(await tutor.getByTestId("tutor-link").innerText(), new RegExp(`/join/${code}$`));
    await tutor.getByTestId("first-pupils").waitFor();
    await tutor.screenshot({ path: path.join(SHOTS, "tutor-pending.png"), fullPage: true });
    let mails = await outbox();
    assert.ok(mails.some((m) => m.to === "hello@11pluslab.com" && /New tutor to approve/.test(m.subject)), "owner asked to approve");
    assert.ok(mails.some((m) => m.to === "ms.patel@tutors.test" && /link is ready/.test(m.subject)), "tutor gets their link");
    log(`Tutor applies and gets join link /join/${code} straight away; owner is asked to approve`);

    // 2. A parent taps the link (signed out) before approval, signs in and confirms.
    const kidCtx = await chrome.newContext(desk);
    const kid = await kidCtx.newPage();
    await kid.goto(`${APP}/join/${code}`);
    await kid.getByTestId("tutor-join-banner").getByText("Ms Patel (Patel Tuition) uses 11 PlusLab").waitFor();
    assert.equal(new URL(kid.url()).pathname, "/", "join link leaves the address bar on the home page");
    await kid.locator(".login2-toggle button").click(); // "Log in" (the link opens on sign-up)
    await signIn(kid, null, "parent.amu@family.test");
    const confirm = kid.getByRole("dialog", { name: "Connect Amu to Ms Patel?" });
    await confirm.getByTestId("tutor-pending-note").waitFor();
    await confirm.getByText("Your email address or name").waitFor();
    await kid.screenshot({ path: path.join(SHOTS, "parent-confirm.png") });
    await confirm.getByRole("button", { name: "Connect" }).click();
    const done = kid.getByRole("dialog", { name: /Connected to Ms Patel/ });
    await done.getByText(/once we've checked their tutor account/).waitFor();
    await done.getByRole("button", { name: "Start practising" }).click();
    mails = await outbox();
    assert.ok(mails.some((m) => m.to === "parent.amu@family.test" && /Amu is now connected to Ms Patel/.test(m.subject)), "parent is told");
    assert.ok(mails.some((m) => m.to === "ms.patel@tutors.test" && /Amu has joined/.test(m.subject)), "tutor is told");
    log("Parent taps the link, signs in, sees what's shared and that the tutor is being checked, confirms; both emailed");

    // 3. While pending, the tutor sees how many families joined, but no child's data.
    await adminDb().doc("users/kid1").set(practice(), { merge: true });
    await tutor.reload();
    await tutor.getByTestId("pending-count").getByText("1 family has connected").waitFor();
    assert.equal(await tutor.getByTestId("pupil-row").count(), 0);
    log("Before approval the tutor sees '1 family has connected' and no progress");

    // 4. Owner approves with one tap from the email (opening the link alone doesn't approve).
    const ownerMail = (await outbox()).find((m) => m.to === "hello@11pluslab.com" && /New tutor to approve/.test(m.subject));
    const approveUrl = ownerMail.html.replace(/&amp;/g, "&").match(/https:\/\/11pluslab\.com\/api\/tutor\?approve=[^"]+/)[0].replace("https://11pluslab.com", APP);
    const ownerCtx = await chrome.newContext(desk);
    const owner = await ownerCtx.newPage();
    owner.on("dialog", (d) => d.accept());
    await owner.goto(approveUrl);
    await owner.getByRole("heading", { name: "Approve Ms Patel?" }).waitFor();
    assert.equal((await adminDb().doc("tutors/tutor1").get()).get("status"), "pending", "opening the link doesn't approve");
    await owner.getByRole("button", { name: "Approve" }).click();
    await owner.getByRole("heading", { name: "Approved ✓" }).waitFor();
    assert.ok((await outbox()).some((m) => m.to === "ms.patel@tutors.test" && /approved/i.test(m.subject)));
    await signIn(owner, "/owner", "reuben.dongre@gmail.com");
    await owner.getByTestId("tutor-admin-row").filter({ hasText: "Ms Patel" }).getByText("active").waitFor();
    await owner.screenshot({ path: path.join(SHOTS, "owner-tutors.png"), fullPage: true });
    log("Owner approves from the email in one tap; the tutor gets the 'approved' email");

    // 5. A tutor opening the app lands on their dashboard; "Back to games" and the Pupils tab move between them.
    await tutor.goto(`${APP}/`);
    await tutor.waitForURL(/\/tutor$/);
    await tutor.getByTestId("back-to-games").click();
    await tutor.waitForURL(/127\.0\.0\.1:5310\/$/);
    await tutor.getByRole("button", { name: "Pupils", exact: true }).first().waitFor();
    assert.equal(await tutor.getByRole("button", { name: "Board", exact: true }).count(), 0, "tutors get Pupils, not the friends Board");
    await tutor.waitForTimeout(800);
    assert.equal(new URL(tutor.url()).pathname, "/", "stays in the games after Back to games");
    await tutor.getByRole("button", { name: "Pupils", exact: true }).first().click();
    await tutor.waitForURL(/\/tutor$/);
    log("Tutor lands on their dashboard; 'Back to games' stays in the games; the Pupils tab (not Board) goes back");

    // 6. Now approved, the tutor sees Amu's practice.
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
    log("Approved: the tutor sees Amu's rounds, flags, weak words and recent rounds");

    // A parent sees "Are you a tutor?" in Settings; the tutor page gently flags a child's account.
    await kid.reload();
    await kid.getByRole("button", { name: "Me", exact: true }).click();
    await kid.getByTestId("become-tutor").getByRole("button", { name: /Get a free tutor account/ }).click();
    await kid.waitForURL(/\/tutor$/);
    await kid.getByTestId("child-account-note").getByText(/This account has played \d+ rounds/).waitFor();
    await kid.goto(`${APP}/`);
    log("Settings offers 'Are you a tutor?'; the tutor page notes when an account has played as a learner");

    // 7. The tutor can't see a child who isn't connected (Leo).
    await adminDb().doc("users/kid2").set(practice(), { merge: true });
    await tutor.getByRole("button", { name: "← All pupils" }).click();
    assert.equal(await tutor.getByTestId("pupil-row").filter({ hasText: "Leo" }).count(), 0);
    log("A child who isn't connected never appears");

    // 8. Parent disconnects in Settings; the tutor loses access straight away.
    await kid.reload();
    await kid.getByRole("button", { name: "Me", exact: true }).click();
    await kid.getByTestId("tutors-card").getByRole("button", { name: "Disconnect" }).click();
    await kid.getByRole("dialog", { name: "Disconnect Ms Patel?" }).getByRole("button", { name: "Disconnect" }).click();
    await kid.getByTestId("tutors-card").getByText("Ms Patel · Patel Tuition").waitFor({ state: "detached" });
    await tutor.getByRole("button", { name: "Refresh" }).click();
    await tutor.getByTestId("no-pupils").waitFor();
    log("Parent disconnects; Amu disappears from the tutor's dashboard");

    // 9. Owner suspends the tutor; the dashboard closes.
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
    await leo.getByLabel("Tutor's join code").fill("TUT-WRONGCOD");
    await leo.getByRole("button", { name: "Next" }).click();
    await leo.getByText("We couldn't find a tutor with that code").waitFor();
    await leo.getByLabel("Tutor's join code").fill(code.toLowerCase());
    await leo.getByRole("button", { name: "Next" }).click();
    const leoConfirm = leo.getByRole("dialog", { name: "Connect Leo to Ms Patel?" });
    await leoConfirm.waitFor();
    await noSideScroll(leo, "phone confirm sheet");
    await leo.screenshot({ path: path.join(SHOTS, "phone-parent-confirm.png") });
    await leoConfirm.getByRole("button", { name: "Connect" }).click();
    await leo.getByTestId("tutors-card").getByText("Ms Patel · Patel Tuition").waitFor();
    await noSideScroll(leo, "phone settings");
    log("On a phone, a wrong code is refused and the right one connects Leo (Settings → Tutors)");

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

    console.log("\nFriend requests");
    // 13. Amu (desktop) enters Leo's code: that's a request, not a friendship.
    const leoCode = (await adminDb().doc("profiles/kid2").get()).get("code");
    await kid.goto(`${APP}/`);
    await kid.getByRole("button", { name: /Board/ }).first().click();
    await kid.getByRole("button", { name: "+ Add friend" }).click();
    await kid.getByPlaceholder("e.g. WM-7H2K9").fill(leoCode);
    await kid.getByRole("button", { name: "Send friend request" }).click();
    await kid.getByText(/Request sent to Leo/).waitFor();
    await kid.getByTestId("friend-requests").getByText("Waiting for Leo to accept").waitFor();
    const pair = ["kid1", "kid2"].sort().join("__");
    assert.equal((await adminDb().doc(`friendships/${pair}`).get()).exists, false, "not friends before Leo accepts");
    log("Entering a friend's code sends a request; they aren't friends yet");

    // 14. Leo (phone) sees it on Home, accepts on the leaderboard.
    await leo.goto(`${APP}/`);
    await leo.getByRole("button", { name: "Home", exact: true }).first().click();
    await leo.getByTestId("home-friend-request").getByText("Amu wants to be friends").click();
    await leo.getByTestId("friend-requests").getByRole("button", { name: "Accept" }).click();
    await leo.getByText("You and Amu are now friends!").waitFor();
    await leo.locator(".board-row").filter({ hasText: "Amu" }).waitFor();
    await leo.getByTestId("friend-requests").waitFor({ state: "detached" });
    await noSideScroll(leo, "phone leaderboard");
    await leo.screenshot({ path: path.join(SHOTS, "phone-friend-accepted.png"), fullPage: true });
    assert.equal((await adminDb().doc(`friendships/${pair}`).get()).exists, true);
    assert.equal((await adminDb().doc("friendRequests/kid1__kid2").get()).exists, false, "request tidied up");
    await kid.reload();
    await kid.locator(".board-row").filter({ hasText: "Leo" }).waitFor();
    log("Leo sees the request on Home, accepts; both now see each other on the leaderboard");

    console.log("\nNew families and pre-approved tutors");
    // 15. A brand-new family signs up through the tutor's link.
    const miaCtx = await chrome.newContext(desk);
    const mia = await miaCtx.newPage();
    await mia.goto(`${APP}/join/${code}`);
    await mia.getByTestId("tutor-join-banner").waitFor();
    await mia.getByRole("button", { name: "Sign up with email" }).click();
    await mia.getByPlaceholder("Your child's name").fill("Mia");
    await mia.getByPlaceholder("you@email.com").fill("parent.mia@family.test");
    await mia.getByPlaceholder("••••••••").fill(PASSWORD);
    await mia.getByRole("button", { name: "Create account" }).click();
    const miaConfirm = mia.getByRole("dialog", { name: "Connect Mia to Ms Patel?" });
    await miaConfirm.getByRole("button", { name: "Connect" }).click();
    await mia.getByRole("dialog", { name: /Connected to Ms Patel/ }).getByText(/can now follow Mia's practice/).waitFor();
    const miaUid = (await adminAuth().getUserByEmail("parent.mia@family.test")).uid;
    const miaLink = (await adminDb().doc(`tutorLinks/tutor1__${miaUid}`).get()).data();
    assert.equal(miaLink.via, "link");
    assert.equal(miaLink.newFamily, true);
    await owner.reload();
    await owner.getByTestId("tutor-admin-row").filter({ hasText: "Ms Patel" }).getByText(/1 by link/).waitFor();
    log("A new family signs up through the link and connects; the owner sees it counted as 'by link'");

    // Progress report before any rounds, and the grown-up PIN (Mia: free plan, no rounds yet).
    await mia.getByRole("button", { name: "Start practising" }).click().catch(() => {});
    await mia.getByRole("button", { name: "Me", exact: true }).click();
    await mia.locator(".set-row").filter({ has: mia.getByText("Progress report", { exact: true }) }).getByRole("button").click();
    const empty = mia.getByTestId("report-empty");
    await empty.getByText("Example", { exact: true }).waitFor();
    await empty.getByText(/The full report is part of Full Access/).waitFor(); // (no Stripe locally, so no trial is offered)
    await mia.screenshot({ path: path.join(SHOTS, "report-empty.png"), fullPage: true });
    await empty.getByRole("button", { name: "Choose a game" }).click();
    await mia.getByText("Choose a game").first().waitFor();
    // Set a grown-up PIN: Settings now needs it.
    await mia.getByRole("button", { name: "Me", exact: true }).click();
    const pinRow = mia.getByTestId("grownup-pin");
    await pinRow.getByRole("button", { name: "Set PIN" }).click();
    await pinRow.getByLabel("New 4-digit PIN").fill("2468");
    await pinRow.getByRole("button", { name: "Save" }).click();
    await pinRow.getByText("On", { exact: true }).waitFor();
    await mia.getByRole("button", { name: "Home", exact: true }).first().click();
    await mia.getByRole("button", { name: "Me", exact: true }).click();
    await mia.getByText("Grown-ups only").waitFor();
    // "Forgot the PIN?" needs the account password; a wrong one keeps the lock.
    await mia.getByRole("button", { name: "Forgot the PIN?" }).click();
    await mia.getByLabel("Account password").fill("not-the-password");
    await mia.getByRole("button", { name: "Confirm and turn the lock off" }).click();
    await mia.getByText("That password isn't right.").waitFor();
    await mia.getByLabel("Account password").fill(PASSWORD);
    await mia.getByRole("button", { name: "Confirm and turn the lock off" }).click();
    await mia.getByTestId("grownup-pin").getByRole("button", { name: "Set PIN" }).waitFor();
    log("Report before any rounds shows an example and 'Choose a game'; the grown-up PIN locks Settings; 'Forgot the PIN?' needs the account password");

    // 16. A tutor on the outreach list is approved instantly, with link and poster ready.
    await adminDb().doc("outreach/bright").set({ email: "hello@brightminds.test", business: "Bright Minds Tuition" });
    await makeUser("tutor2", "head@brightminds.test", "Mr Khan");
    const t2Ctx = await chrome.newContext(desk);
    const t2 = await t2Ctx.newPage();
    // The sign-up form on /tutor asks for the tutor's own name, not a child's.
    await t2.goto(`${APP}/tutor`);
    await t2.locator(".login2-toggle button").click();
    await t2.getByRole("button", { name: "Sign up with email" }).click();
    await t2.getByText("Create your tutor account").waitFor();
    await t2.getByText("YOUR NAME").waitFor();
    assert.equal(await t2.getByPlaceholder("Your child's name").count(), 0, "tutors aren't asked for a child's name");
    await signIn(t2, "/tutor", "head@brightminds.test");
    await t2.getByLabel("Your name").fill("Mr Khan");
    await t2.getByRole("checkbox").check();
    await t2.getByRole("button", { name: "Apply for a free tutor account" }).click();
    await t2.getByRole("heading", { name: "Hi Mr Khan" }).waitFor();
    await t2.getByTestId("first-pupils").waitFor();
    await t2.getByRole("button", { name: "QR poster", exact: true }).click();
    const qr = t2.getByTestId("tutor-poster").getByRole("img", { name: /QR code for/ });
    await qr.waitFor();
    assert.match(await qr.getAttribute("src"), /^data:image\/png;base64,/);
    await t2.getByTestId("tutor-poster").getByText("Bright Minds Tuition uses 11 PlusLab", { exact: false }).waitFor();
    await t2.screenshot({ path: path.join(SHOTS, "tutor-poster.png"), fullPage: true });
    assert.ok((await outbox()).some((m) => m.to === "hello@11pluslab.com" && /pre-approved/.test(m.subject)));
    log("A tutor whose business is on the outreach list is approved instantly (signed up as a tutor, not a child); QR poster shows their link");

    // 17. Example class: 12 made-up pupils, sortable by who practises most.
    await t2.getByRole("button", { name: "Close" }).click();
    await t2.getByTestId("see-example").click();
    await t2.getByTestId("demo-banner").waitFor();
    assert.equal(await t2.getByTestId("pupil-row").count(), 12);
    await t2.getByTestId("pupil-sort").selectOption("most");
    const topName = (await t2.locator(".tut-tile").filter({ hasText: "Most practice this week" }).locator(".tut-tile-value").innerText()).trim();
    assert.match(await t2.getByTestId("pupil-row").first().innerText(), new RegExp(topName));
    await t2.screenshot({ path: path.join(SHOTS, "tutor-example-class.png"), fullPage: true });
    await t2.getByTestId("pupil-row").first().click();
    await t2.getByRole("heading", { name: topName }).waitFor();
    assert.equal(await t2.getByRole("button", { name: "Remove pupil" }).count(), 0, "example pupils can't be removed");
    await t2.getByRole("button", { name: "← All pupils" }).click();
    await t2.getByRole("button", { name: "Back to my dashboard" }).click();
    await t2.getByTestId("first-pupils").waitFor();
    // And on a phone.
    const t2PhoneCtx = await safari.newContext(phone);
    const t2Phone = await t2PhoneCtx.newPage();
    await signIn(t2Phone, "/tutor", "head@brightminds.test");
    await t2Phone.getByTestId("see-example").click();
    await t2Phone.getByTestId("pupil-row").nth(11).waitFor();
    await noSideScroll(t2Phone, "phone example class");
    await t2Phone.screenshot({ path: path.join(SHOTS, "phone-example-class.png"), fullPage: true });
    log(`Example class shows 12 made-up pupils; 'Most practice' puts ${topName} first; fits an iPhone`);

    console.log(`\nAll ${step} end-to-end checks passed. Screenshots: e2e/screenshots/\n`);
  }
}

main().then(() => process.exit(0), (e) => { console.error(`\n  ✗ Failed after step ${step}:`, e.message, "\n"); process.exit(1); });
