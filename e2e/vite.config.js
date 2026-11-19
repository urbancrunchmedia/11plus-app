// The real app, built against the Firebase emulators (e2e/.env.e2e), with
// /api proxied to e2e/api-server.mjs. No PWA plugin (no service worker in tests).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");
export default defineConfig({
  root,
  envDir: import.meta.dirname,
  mode: "e2e",
  plugins: [react(), {
    name: "no-pwa",
    resolveId(id) { return id === "virtual:pwa-register" ? "\0no-pwa" : null; },
    load(id) { return id === "\0no-pwa" ? "export function registerSW() {}" : null; },
  }],
  server: { host: "127.0.0.1", port: 5310, strictPort: true, proxy: { "/api": "http://127.0.0.1:5311", "/__outbox": "http://127.0.0.1:5311" } },
  logLevel: "warn",
});
