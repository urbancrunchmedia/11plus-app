# 11 PlusLab logo

Traced from the chosen artwork (`source/gemini-original.jpg`), so the shapes match it exactly. Colours are snapped to the brand: ink `#0E1116`, lime `#D4F520`, blue `#12A5FF`, white.

| File | Use |
|---|---|
| `logo-mark.svg` / `logo-mark-1024.png` | The square, full detail (48 px and up) |
| `logo-mark-simple.svg`, `favicon.svg` | The square without bubbles and lines, for tiny sizes (favicon, nav rail) |
| `logo-lockup.svg` / `.png` | Square + "PlusLab", dark text, for light backgrounds |
| `logo-lockup-white.svg` / `.png` | Square + "PlusLab", white text, faint ring on the square, for dark or blue backgrounds |
| `email-lockup.png` | Email header, shown 133 x 44 (exported 2x) |
| `og.png` | Link preview (1200 x 630) |
| `pwa-*.png`, `apple-touch-icon.png`, `favicon-*.png` | App and browser icons |

The same files are copied into `public/`.

## Regenerating

1. `scripts/trace.py source/gemini-original.jpg source/traced.json` (needs Python with pillow, numpy, scipy, potracer). Splits the image into colour layers and traces each with potrace.
2. `scripts/export.mjs source/traced.json <outDir> fonts` (needs Node with opentype.js and @resvg/resvg-js). Builds every SVG and PNG above.
