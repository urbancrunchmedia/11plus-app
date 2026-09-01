import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.js so the PWA plugin doesn't run under tests.
// jsdom gives the pure utils a real localStorage to read/write.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
