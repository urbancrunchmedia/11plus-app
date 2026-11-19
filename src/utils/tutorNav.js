// Getting a tutor to their dashboard quickly. Opening the app ("/", also the
// home-screen icon) takes a tutor account to /tutor, unless they chose "Back
// to games" in this visit, which they can do at any time.
const KEY = "11plus_tutor_playing";

export function shouldOpenTutorDashboard({ isTutor, path }) {
  if (!isTutor || path !== "/") return false;
  try { return sessionStorage.getItem(KEY) !== "1"; } catch { return true; }
}

// "Back to games" from the dashboard: stay in the app for the rest of this visit.
export function goToGames() {
  try { sessionStorage.setItem(KEY, "1"); } catch { /* private mode */ }
  window.location.assign("/");
}

export function goToTutorDashboard() {
  window.location.assign("/tutor");
}
