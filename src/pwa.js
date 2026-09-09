import { registerSW } from "virtual:pwa-register";

// Registration can reject in some browser contexts (e.g. iOS Safari private
// browsing, where service worker/storage APIs are restricted) — the app
// still works fine as a normal page, so just log it rather than letting it
// become an unhandled promise rejection.
registerSW({
  onRegisterError(error) {
    console.warn("Service worker registration failed:", error);
  },
});
