# 11+ Prep — Gamified Redesign Spec

Source: Claude design file "11 Plus Gamified.dc.html" (EduCore direction, section 1a).
Mobile-first, bold sporty. This doc is the implementation reference.

## Palette (EduCore)

| Token            | Hex        | Role                                            |
|------------------|------------|-------------------------------------------------|
| `--brand`        | `#12A5FF`  | Primary blue — hero cards, progress, active nav |
| `--brand-dark`   | `#0B7FC7`  | Blue button bottom-shadow / pressed             |
| `--accent`       | `#D4F520`  | Lime — CTAs, streak, highlights, selected state |
| `--accent-dark`  | `#A8C400`  | Lime button bottom-shadow                       |
| `--on-accent`    | `#5C7000`  | Text on lime when muted                         |
| `--ink`          | `#0E1116`  | Near-black — text, dark cards, dark nav rail    |
| `--surface`      | `#F4F9FF`  | App background (light blue-white)               |
| `--canvas`       | `#DCEEFB`  | Deeper page backdrop                            |
| `--card`         | `#FFFFFF`  | Cards                                           |
| `--muted`        | `#6B7A8C`  | Secondary text                                  |
| `--muted-2`      | `#9AA8B6`  | Tertiary text / inactive nav                    |
| `--track`        | `#E7EEF5`  | Progress-bar track                              |
| `--line`         | `#DDE7F0`  | Card bottom-shadow (light buttons), dividers    |

Calmer alt direction (optional, section 2c): surface `#FBFAF7`, ink `#1A1A18`, thin dividers `#E9E6DE`, square-ish 8px radius. Not the primary pick.

## Type

- **Body / UI:** Plus Jakarta Sans (400/500/600/700/800)
- **Headings:** Gabarito (500–900) — designer's recommended pick (3a) for a 9–11 audience
- Google Fonts, both free.

## Signature components

- **Cards:** radius 20–32px, `box-shadow: 0 16px 40px rgba(11,60,110,.16)`.
- **Chunky buttons:** solid offset bottom-shadow (`0 4px 0 var(--line)` light, `0 6px 0 var(--accent-dark)` lime, `0 6px 0 var(--brand-dark)` blue) — tactile "pressable" look.
- **Pills:** `border-radius: 999px`; streak = lime text on ink.
- **Hero challenge card:** blue, big rounded, conic-gradient progress ring, lime CTA pill inside.
- **Stat tiles:** white / ink mini-cards (XP, badges, rank).
- **Mastery rows:** icon chip + label + % + progress bar.
- **In-game board:** 2-col word grid; selected = lime fill; matched = line-through + faded; dark OR light variant.
- **Bottom nav (mobile):** Home · Play · [center lime FAB] · Board · Me. Desktop = slim 96px ink icon rail.

## Screens (section 1a)

- **Home** — greeting + streak pill, "Today's Challenge" hero w/ ring, stat tiles, "Your skills" mastery list, bottom nav.
- **Play setup** — Synonyms/Antonyms toggle, "PICKED FOR YOU" smart-round card, big "Play now", collapsed "Change level & length", friend-duel card.
- **In-game** — progress segments + lives, combo/timer/points tiles, word grid, streak banner, hint bar.
- **Leaderboard** — podium (top 3), friends list, "you" highlighted, duel CTA.
- **Results (payout)** — score/time/combo tiles, +XP with level-up bar, streak extended, "keep mixing up X" tip, Play again / Challenge friend.
- **Desktop** — slim icon rail + dashboard (hero challenge, friends panel, "Jump back in" skill cards).

## New concepts introduced (beyond current app)

XP + levels + titles ("Word Wrangler"), daily streak, daily challenge (N rounds/day), per-skill mastery %, badges, friend duels, quest-map progression, "picked for you" spaced-repetition rounds. These need new data/model work — not just styling.
