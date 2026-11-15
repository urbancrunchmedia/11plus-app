import { defineConfig } from "vitest/config";
// Runs inside `npm run test:api` (Firestore + Auth emulators, demo project).
export default defineConfig({
  test: { include: ["api-tests/**/*.test.js"], environment: "node", testTimeout: 20000, hookTimeout: 30000, fileParallelism: false },
});
