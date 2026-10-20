import opentype from "opentype.js";
import { Resvg } from "@resvg/resvg-js";
import fs from "fs";

const INK = "#0E1116", LIME = "#D4F520", BLUE = "#12A5FF", WHITE = "#FFFFFF";

// A chunky "1" with a flag and a foot, in its own 26 x 50 box.
// Corners are rounded by a same-colour stroke with round joins.
const ONE = "M8.5,1.5 Q10,0 12,0 H17 Q19.5,0 19.5,2.5 V40 H23.5 Q26,40 26,42.5 V47.5 Q26,50 23.5,50 H2.5 Q0,50 0,47.5 V42.5 Q0,40 2.5,40 H8 V17.5 Q5,19.6 2.8,18.8 Q0.3,17.8 0.6,14.2 Q0.9,11.2 3.6,9.6 Z";
const PLUS = "M-4,-12 H4 V-4 H12 V4 H4 V12 H-4 V4 H-12 V-4 H-4 Z";

function glyph(d, tx, ty, rot, fill, outline) {
  const t = `translate(${tx} ${ty}) rotate(${rot} 13 25)`;
  return `<g transform="${t}">` +
    `<path d="${d}" fill="${INK}" stroke="${INK}" stroke-width="${outline}" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="${fill}" stroke="${fill}" stroke-width="3" stroke-linejoin="round"/></g>`;
}

function mark({ detail, ring }) {
  // Full detail for 48 px and up; the favicon drops the sparkle and goes a bit bigger.
  const s = detail ? 1.05 : 1.16;
  const cx = 50, cy = 52;
  const g = (x, y) => [cx + (x - cx) * s, cy + (y - cy) * s];
  const [x1, y1] = g(24, 28), [x2, y2] = g(47, 26), [px, py] = g(71, 32);
  let out = `<rect width="100" height="100" rx="22" fill="${INK}"/>` + (ring ? `<rect x="1" y="1" width="98" height="98" rx="21" fill="none" stroke="#3A4552" stroke-width="2"/>` : "");
  if (detail) {
    const arc = (d) => `<path d="${d}" fill="none" stroke="${LIME}" stroke-width="2.4" stroke-linecap="round"/>`;
    out += arc("M16 36 Q12 43 15 50") + arc("M20.5 39 Q18 44 20 48.5");      // left wiggle
    out += arc("M18 70 Q19 79 28 81") + arc("M77 70 Q77 79 70 81.5");         // bottom corners
    out += arc("M70 13 Q75 11 79 13") + arc("M73 16.5 Q76 15.5 78.5 16.5");   // top right
    out += arc("M83 41 Q87 44 84 48") + arc("M79 50 Q82 51 85 50.5");         // right
    const dot = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
    out += dot(22, 24, 3.4, WHITE) + dot(15.5, 60, 3.4, WHITE) + dot(85, 61, 3.4, WHITE);
    out += dot(44, 15, 2.2, LIME) + dot(50, 11, 1.7, LIME) + dot(55.5, 16.5, 1.9, LIME) + dot(49.5, 21.5, 2.9, LIME);
    out += dot(37, 87, 2, LIME) + dot(42.5, 84, 2.6, LIME);
  }
  out += `<g transform="translate(${x1} ${y1}) scale(${s}) translate(${-x1} ${-y1})">${glyph(ONE, x1, y1, -5, LIME, 0)}</g>`;
  out += `<g transform="translate(${x2} ${y2}) scale(${s}) translate(${-x2} ${-y2})">${glyph(ONE, x2, y2, 3, LIME, 8)}</g>`;
  out += `<g transform="translate(${px} ${py}) scale(${s})">` +
    `<path d="${PLUS}" fill="${INK}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>` +
    `<path d="${PLUS}" fill="${BLUE}" stroke="${BLUE}" stroke-width="2.5" stroke-linejoin="round"/></g>`;
  return out;
}

const svg = (w, h, inner, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ""}${inner}</svg>`;

const font = opentype.parse(fs.readFileSync("fonts/Fredoka_wght-700.woff").buffer.slice(0));
function wordmark(x, baseline, size, color) {
  return `<path d="${font.getPath("PlusLab", x, baseline, size, { letterSpacing: 0.035 }).toPathData(2)}" fill="${color}"/>`;
}
// Lockup: 100-unit square, then "PlusLab" set so its cap height sits within the square.
function lockup(color, ring) {
  const w = font.getAdvanceWidth("PlusLab", 62, { letterSpacing: 0.035 });
  return { w: Math.ceil(124 + w + 4), inner: mark({ detail: true, ring }), text: wordmark(124, 72, 62, color) };
}

fs.mkdirSync("out", { recursive: true });
const full = svg(100, 100, mark({ detail: true }));
const simple = svg(100, 100, mark({ detail: false }));
fs.writeFileSync("out/logo-mark.svg", full);
fs.writeFileSync("out/favicon.svg", simple);
for (const [name, color] of [["logo-lockup", INK], ["logo-lockup-white", WHITE]]) {
  const l = lockup(color, color === WHITE);
  fs.writeFileSync(`out/${name}.svg`, svg(l.w, 100, `<g>${l.inner}</g>${l.text}`));
}

const png = (file, svgText, width) =>
  fs.writeFileSync(file, new Resvg(svgText, { fitTo: { mode: "width", value: width } }).render().asPng());
png("out/pwa-512.png", full, 512);
png("out/pwa-192.png", full, 192);
png("out/apple-touch-icon.png", full, 180);
png("out/favicon-32.png", simple, 32);
png("out/favicon-16.png", simple, 16);
png("out/email-logo.png", full, 88);           // shown at 44 px in emails (2x for retina)
// Maskable: Android crops to a circle-ish safe zone, so the square sits inside ink padding.
png("out/pwa-maskable-512.png", svg(100, 100, `<rect width="100" height="100" fill="${INK}"/><g transform="translate(10 10) scale(.8)">${mark({ detail: true })}</g>`), 512);
png("out/logo-lockup.png", fs.readFileSync("out/logo-lockup.svg", "utf8"), 1200);
png("out/logo-lockup-white.png", fs.readFileSync("out/logo-lockup-white.svg", "utf8"), 1200);

// Preview sheet
const l = lockup(INK), lw = lockup(WHITE, true);
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="640"><rect width="1000" height="640" fill="#F4F9FF"/>
<g transform="translate(30 30) scale(2.6)">${mark({ detail: true })}</g>
<g transform="translate(330 30) scale(2.6)">${mark({ detail: false })}</g>
<image x="640" y="40" width="64" height="64" href="data:image/png;base64,${fs.readFileSync("out/pwa-192.png").toString("base64")}"/>
<image x="730" y="72" width="32" height="32" href="data:image/png;base64,${fs.readFileSync("out/favicon-32.png").toString("base64")}"/>
<image x="790" y="88" width="16" height="16" href="data:image/png;base64,${fs.readFileSync("out/favicon-16.png").toString("base64")}"/>
<rect x="30" y="330" width="940" height="130" rx="18" fill="#fff"/>
<g transform="translate(60 345) scale(1)">${l.inner}${l.text}</g>
<rect x="30" y="480" width="460" height="130" rx="18" fill="#0E1116"/>
<g transform="translate(55 505) scale(.8)">${lw.inner}${lw.text}</g>
<rect x="510" y="480" width="460" height="130" rx="18" fill="#12A5FF"/>
<g transform="translate(535 505) scale(.8)">${lw.inner}${lw.text}</g>
</svg>`;
fs.writeFileSync("preview.png", new Resvg(sheet).render().asPng());
console.log("lockup width", l.w);

// ---- Email header lockup (white text, shown 44 px tall, exported 2x) ----
{
  const l = lockup(WHITE, true);
  png("out/email-lockup.png", svg(l.w, 100, `<g>${l.inner}</g>${l.text}`), Math.round(l.w * 0.88));
}

// ---- Link preview (og.png, 1200 x 630) ----
{
  const jk7 = opentype.parse(fs.readFileSync("fonts/Jakarta-700.woff").buffer.slice(0));
  const jk8 = opentype.parse(fs.readFileSync("fonts/Jakarta-800.woff").buffer.slice(0));
  const l = lockup(WHITE, true);
  const k = 2.0; // lockup scale
  const line = (t, x, y, size) => `<path d="${jk7.getPath(t, x, y, size).toPathData(2)}" fill="#FFFFFF" opacity=".92"/>`;
  const pillText = "11pluslab.com";
  const pw = jk8.getAdvanceWidth(pillText, 30) + 64;
  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${BLUE}"/>
  <circle cx="1090" cy="80" r="200" fill="#FFFFFF" opacity=".1"/>
  <circle cx="70" cy="610" r="190" fill="${INK}" opacity=".08"/>
  <g transform="translate(90 120) scale(${k})">${l.inner}${l.text}</g>
  ${line("Vocabulary, spelling and punctuation", 92, 410, 40)}
  ${line("games for ages 8–11", 92, 462, 40)}
  <rect x="90" y="505" width="${pw}" height="62" rx="31" fill="${LIME}"/>
  <path d="${jk8.getPath(pillText, 122, 547, 30).toPathData(2)}" fill="${INK}"/>
  </svg>`;
  fs.writeFileSync("out/og.png", new Resvg(og).render().asPng());
}
