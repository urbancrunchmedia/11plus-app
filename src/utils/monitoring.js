// Error monitoring. Inactive until VITE_SENTRY_DSN is set, so local/dev runs
// and forks stay silent. Privacy-conscious defaults for a children's app:
// no session replay, no PII, low trace sampling.
import * as Sentry from "@sentry/react";

const DSN = (import.meta.env.VITE_SENTRY_DSN || "").trim();

export function initMonitoring() {
  if (!DSN) return false;
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    // Ignore noise we can't act on.
    ignoreErrors: ["ResizeObserver loop", "Non-Error promise rejection captured"],
  });
  return true;
}

// Called by the error boundary so crashes are reported, not just logged.
export function reportError(error, info) {
  if (!DSN) return;
  Sentry.captureException(error, { extra: { componentStack: info?.componentStack } });
}
