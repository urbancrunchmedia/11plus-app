// Email image assets (PNG, 2x): icon chips, CTA arrow, header background, dark-text lockup.
import fs from "fs";
import { Resvg } from "@resvg/resvg-js";
const [, , out, lockupSvg] = process.argv;
fs.mkdirSync(out, { recursive: true });
const png = (name, svg, width) => fs.writeFileSync(`${out}/${name}.png`, new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());

// Same line icons and colours as the app (src/components/Icon.jsx SKILL_ICON).
const ICONS = {
  match: '<path d="M5 9.5h14"/><path d="M5 14.5h14"/>',
  oppose: '<path d="M5 9.5h14"/><path d="M5 14.5h14"/><path d="M16 5 8 19"/>',
  compound: '<rect x="3" y="4" width="8" height="8" rx="2.5"/><rect x="13" y="12" width="8" height="8" rx="2.5"/><path d="M11 8h3a2 2 0 0 1 2 2v2"/>',
  detect: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/><path d="M9 11h4"/>',
  punct: '<circle cx="7" cy="11" r="2.2"/><path d="M7 13.2c0 2.4-1 3.9-2.6 4.8"/><circle cx="17" cy="16" r="2.2"/>',
  spelling: '<path d="M4 18l4.5-11 4.5 11"/><path d="M5.6 14h5.8"/><path d="M20 8v10"/><path d="M20 11.5a3 3 0 1 0 0 6"/>',
  trophy: '<path d="M7 5h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.4A3.6 3.6 0 0 0 7.6 11"/><path d="M17 6h3v1.4A3.6 3.6 0 0 1 16.4 11"/><path d="M12 14v3"/><path d="M8.5 20h7"/><path d="M9.5 20l.5-3h4l.5 3"/>',
  chart: '<path d="M4 4v16h16"/><rect x="7.5" y="11" width="3" height="6" rx="1"/><rect x="12.5" y="7" width="3" height="10" rx="1"/><rect x="17.5" y="13" width="3" height="4" rx="1"/>',
  people: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M15 14.2a4.5 4.5 0 0 1 6 4.3"/>',
  tag: '<path d="M9 6.5v11"/><path d="M9 6.5h3"/><path d="M9 17.5h3"/><path d="M15 6.5v11"/><path d="M15 6.5h-3"/><path d="M15 17.5h-3"/><circle cx="12" cy="12" r="1.3"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17h14"/><path d="M9 8h6"/><path d="M9 11.5h4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
};
const CHIPS = {
  synonyms: ["match", "#12a5ff", "#e4f6ff"], antonyms: ["oppose", "#e0507a", "#fdeef3"],
  compound: ["compound", "#ff6b4a", "#ffe9e3"], detective: ["detect", "#7fa30c", "#f3fbd4"],
  punctuation: ["punct", "#0e1116", "#f0f2f5"], spelling: ["spelling", "#8b5cf6", "#f1ecfe"],
  wordclass: ["tag", "#0d9488", "#e0f5f3"], wordlist: ["book", "#12a5ff", "#eaf4fc"],
  confidence: ["trophy", "#12a5ff", "#e4f6ff"], progress: ["chart", "#22a35b", "#e3f7ea"],
  motivated: ["people", "#e0507a", "#fdeef3"], clock: ["clock", "#12a5ff", "#e4f6ff"], flame: ["flame", "#ff6b4a", "#ffe9e3"],
};
for (const [name, [icon, stroke, bg]] of Object.entries(CHIPS)) {
  png(`icon-${name}`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="16" fill="${bg}"/>
  <g transform="translate(12 12)" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[icon]}</g></svg>`, 96);
}
// CTA arrow: ink circle with a lime arrow, as on the poster.
png("cta-arrow", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#0E1116"/>
<path d="M12 20h15M21 13.5l6.5 6.5-6.5 6.5" fill="none" stroke="#D4F520" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`, 80);
// Header background: the poster's soft blue blobs and a lime corner glow on pale blue.
png("header-bg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300">
<rect width="600" height="300" fill="#EEF6FF"/>
<path d="M430 -40 C520 -30 640 10 620 120 C600 210 520 190 470 140 C420 90 360 30 430 -40Z" fill="#DCEEFF"/>
<path d="M-60 180 C10 150 90 190 110 250 C130 310 40 340 -40 320Z" fill="#E2F1FF"/>
<circle cx="560" cy="18" r="70" fill="#F3FBD4"/>
<path d="M330 250 C380 230 450 250 470 290 L480 320 L300 320Z" fill="#E6F3FF"/>
</svg>`, 1200);
// Dark-text lockup for the light header, 44 px tall at 2x.
const svg = fs.readFileSync(lockupSvg, "utf8");
const [, vw, vh] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
png("logo-lockup-dark", svg, Math.round((vw / vh) * 88));
console.log("lockup display width", Math.round((vw / vh) * 44));

// ---- Dark-mode-proof pieces ----
// Gmail's apps recolour HTML in dark mode but never touch images, so the
// branded parts that must not change colour are images.
import opentype from "opentype.js";
const fontsDir = process.argv[4];
const jk8 = opentype.parse(fs.readFileSync(`${fontsDir}/Jakarta-800.woff`).buffer.slice(0));

// Header banner: blobs + logo (56 px tall), rounded top corners, 600 x 112 (exported 2x).
{
  const lock = fs.readFileSync(lockupSvg, "utf8");
  const inner = lock.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  const [, lw, lh] = lock.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const k = 56 / lh;
  png("header-banner", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 112">
  <defs><clipPath id="c"><path d="M0 28 Q0 0 28 0 H572 Q600 0 600 28 V112 H0 Z"/></clipPath></defs>
  <g clip-path="url(#c)"><rect width="600" height="112" fill="#EEF6FF"/>
  <path d="M430 -40 C520 -30 640 10 620 120 C600 210 520 190 470 140 C420 90 360 30 430 -40Z" fill="#DCEEFF"/>
  <circle cx="560" cy="18" r="70" fill="#F3FBD4"/>
  <path d="M-60 90 C-10 60 40 80 50 112 L-60 112Z" fill="#E2F1FF"/>
  <g transform="translate(36 30) scale(${k})">${inner}</g></g></svg>`, 1200);
}

// CTA buttons as images: lime pill, ink label, ink arrow circle (exported 2x).
const BUTTONS = { start: "Start practising", open: "Open 11 Plus Lab", play: "Play a quick round" };
for (const [id, label] of Object.entries(BUTTONS)) {
  const size = 18, tw = jk8.getAdvanceWidth(label, size);
  const w = Math.ceil(28 + tw + 16 + 40 + 8), h = 56;
  png(`btn-${id}`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" rx="28" fill="#D4F520"/>
  <path d="${jk8.getPath(label, 28, 34.5, size).toPathData(2)}" fill="#0E1116"/>
  <circle cx="${w - 8 - 20}" cy="28" r="20" fill="#0E1116"/>
  <path d="M${w - 36} 28h15M${w - 27} 21.5l6.5 6.5-6.5 6.5" fill="none" stroke="#D4F520" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`, w * 2);
  console.log("btn", id, w, h);
}
