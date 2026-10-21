import { defineConfig } from "@playwright/test";

// E2E contra o ambiente local de teste (tests/e2e/stack/start-stack.mjs)
// e o app em produção (next build && next start) na porta 3100.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
    trace: "retain-on-failure",
  },
});
