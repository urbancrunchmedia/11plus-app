// Which section the app opens on.
//
// Two kinds of "put me back where I was", and they want different answers:
//   · a reload (same tab, same visit) should land you exactly where you were,
//     Settings and the parent report included — pull-to-refresh on a phone
//     shouldn't throw you home.
//   · a later visit should never start you in a grown-up section, whether
//     that's after a sign-in or a child opening the app the next morning.
//
// The parent PIN is unaffected either way: it re-locks on every mount, so a
// reload onto the report still has to get past the gate.

export const VALID_SCREENS = [
  "home", "me", "wordMatch", "compoundWords",
  "punctuation", "spelling", "fillInBlanks", "wordList", "leaderboard", "report",
];

export const GROWN_UP_SCREENS = ["me", "report"];

export function chooseStartScreen(reloadedScreen, lastVisitScreen) {
  if (VALID_SCREENS.includes(reloadedScreen)) return reloadedScreen;
  if (VALID_SCREENS.includes(lastVisitScreen) && !GROWN_UP_SCREENS.includes(lastVisitScreen)) {
    return lastVisitScreen;
  }
  return "home";
}
