// Builds every 11 Plus Lab logo file from the traced artwork (traced.json).
// Usage: node export.mjs traced.json outDir fontsDir
import fs from "fs";
import opentype from "opentype.js";
import { Resvg } from "@resvg/resvg-js";
const [, , jsonPath, out, fontsDir] = process.argv;
const t = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const INK = "#0E1116", LIME = "#D4F520", BLUE = "#12A5FF", WHITE = "#FFFFFF", RING = "#3A4552";
const [tx0, ty0, tx1, ty1] = t.tile_box, [wx0, wy0, wx1] = t.word_box;
const TW = tx1 - tx0, TH = ty1 - ty0, S = Math.max(TW, TH);
const L = t.layers;
const p = (d, fill) => `<path d="${d}" fill="${fill}" fill-rule="evenodd"/>`;

// detail: bubbles, dots and motion lines on; off for tiny sizes (favicon, nav rail).
const tileInner = ({ detail = true, ring = false } = {}) =>
  p(L.tile, INK) + p(L.ones, LIME) + (detail ? p(L.sparkle, LIME) + p(L.dots, WHITE) : "") + p(L.blue, BLUE) +
  (ring ? `<path d="${L.tile}" fill="none" stroke="${RING}" stroke-width="14"/>` : "");
const centred = (o) => `<g transform="translate(${(S - TW) / 2} ${(S - TH) / 2})">${tileInner(o)}</g>`;
const svgDoc = (w, h, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${inner}</svg>`;
const mark = (o) => svgDoc(S, S, centred(o));
const LW = wx1 - tx0, LH = TH;
const lockupInner = (wordFill, ring) =>
  `<g>${tileInner({ ring })}</g><g transform="translate(${wx0 - tx0} ${wy0 - ty0})">${p(L.word, wordFill)}</g>`;
const lockup = (wordFill, ring = false) => svgDoc(LW, LH, lockupInner(wordFill, ring));

const png = (file, svg, width) =>
  fs.writeFileSync(`${out}/${file}`, new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());

fs.mkdirSync(out, { recursive: true });
const full = mark(), simple = mark({ detail: false });
fs.writeFileSync(`${out}/logo-mark.svg`, full);
fs.writeFileSync(`${out}/logo-mark-simple.svg`, simple);
fs.writeFileSync(`${out}/favicon.svg`, simple);
fs.writeFileSync(`${out}/logo-lockup.svg`, lockup(INK));
fs.writeFileSync(`${out}/logo-lockup-white.svg`, lockup(WHITE, true));

png("logo-mark-1024.png", full, 1024);
png("pwa-512.png", full, 512);
png("pwa-192.png", full, 192);
png("apple-touch-icon.png", full, 180);
png("favicon-32.png", simple, 32);
png("favicon-16.png", simple, 16);
// Android crops icons to a circle: keep the square inside the safe zone on an ink field.
png("pwa-maskable-512.png", svgDoc(S, S, `<rect width="${S}" height="${S}" fill="${INK}"/><g transform="translate(${S * 0.1} ${S * 0.1}) scale(0.8)">${centred()}</g>`), 512);
png("logo-lockup.png", lockup(INK), 2000);
png("logo-lockup-white.png", lockup(WHITE, true), 2000);
// Email header: shown 44 px tall, exported at 2x.
const emailW = Math.round((LW / LH) * 88);
png("email-lockup.png", lockup(WHITE, true), emailW);
console.log("email-lockup display width", Math.round(emailW / 2));

// Link preview, 1200 x 630.
const jk7 = opentype.parse(fs.readFileSync(`${fontsDir}/Jakarta-700.woff`).buffer.slice(0));
const jk8 = opentype.parse(fs.readFileSync(`${fontsDir}/Jakarta-800.woff`).buffer.slice(0));
const k = 220 / LH; // lockup 220 px tall
const line = (txt, x, y, size) => `<path d="${jk7.getPath(txt, x, y, size).toPathData(2)}" fill="${WHITE}" opacity=".92"/>`;
const pill = "11pluslab.com", pw = jk8.getAdvanceWidth(pill, 30) + 64;
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
<rect width="1200" height="630" fill="${BLUE}"/>
<circle cx="1090" cy="80" r="200" fill="${WHITE}" opacity=".1"/><circle cx="70" cy="610" r="190" fill="${INK}" opacity=".08"/>
<g transform="translate(90 100) scale(${k})">${lockupInner(WHITE, true)}</g>
${line("Vocabulary, spelling and punctuation", 92, 410, 40)}${line("games for ages 8–11", 92, 462, 40)}
<rect x="90" y="505" width="${pw}" height="62" rx="31" fill="${LIME}"/>
<path d="${jk8.getPath(pill, 122, 547, 30).toPathData(2)}" fill="${INK}"/></svg>`;
fs.writeFileSync(`${out}/og.png`, new Resvg(og).render().asPng());

// Contact sheet for checking.
const b = (f) => `data:image/png;base64,${fs.readFileSync(`${out}/${f}`).toString("base64")}`;
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="760"><rect width="1100" height="760" fill="#F4F9FF"/>
<g transform="translate(30 30) scale(${280 / S})">${centred()}</g>
<g transform="translate(340 30) scale(${280 / S})">${centred({ detail: false })}</g>
<image x="660" y="40" width="96" height="96" href="${b("pwa-192.png")}"/>
<image x="780" y="88" width="48" height="48" href="${b("pwa-192.png")}"/>
<image x="850" y="104" width="32" height="32" href="${b("favicon-32.png")}"/>
<image x="900" y="120" width="16" height="16" href="${b("favicon-16.png")}"/>
<rect x="30" y="340" width="1040" height="160" rx="18" fill="#fff"/>
<g transform="translate(60 360) scale(${120 / LH})">${lockupInner(INK)}</g>
<rect x="30" y="520" width="510" height="210" rx="18" fill="${INK}"/>
<g transform="translate(55 585) scale(${80 / LH})">${lockupInner(WHITE, true)}</g>
<rect x="560" y="520" width="510" height="210" rx="18" fill="${BLUE}"/>
<g transform="translate(585 585) scale(${80 / LH})">${lockupInner(WHITE, true)}</g></svg>`;
fs.writeFileSync(`${out}/sheet.png`, new Resvg(sheet).render().asPng());
