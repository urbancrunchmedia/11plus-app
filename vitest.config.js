import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.js so the PWA plugin doesn't run under tests.
// jsdom gives the pure utils a real localStorage to read/write.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // rules-tests/ needs a live Firestore emulator (`npm run test:rules`),
    // not jsdom — keep it out of the ordinary app test run.
    exclude: ['**/node_modules/**', 'rules-tests/**'],
  },
})
