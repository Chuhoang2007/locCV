import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false, workers: 1, retries: process.env.CI ? 1 : 0,
  timeout: 45000,
  expect: { timeout: 10000 },
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure", screenshot: "only-on-failure" },
  reporter: process.env.CI ? [["github"],["html",{open:"never"}]] : [["list"]],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: "node --conditions=react-server --import tsx tests/e2e/auth-provider.ts", url: "http://127.0.0.1:54329/health", reuseExistingServer: false, timeout: 30000 },
    { command: "node --conditions=react-server --import tsx --import ./tests/e2e/ai-fetch-fixture.mjs worker/main.ts",url:"http://127.0.0.1:3310/health",reuseExistingServer:false,timeout:30000,
      env:{NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54329",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_phase1_fixture",SUPABASE_SECRET_KEY:"sb_secret_phase1_fixture_only",NINE_ROUTER_BASE_URL:"https://nine-router-fixture.test/v1",NINE_ROUTER_API_KEY:"fixture-only",NINE_ROUTER_MODEL:"gpt-4o-mini",WORKER_HEALTH_PORT:"3310"}},
    { command: "npm run dev -- --port 3000", url: "http://127.0.0.1:3000/login", reuseExistingServer: false, timeout: 60000,
      env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_phase1_fixture", SUPABASE_SECRET_KEY: "sb_secret_phase1_fixture_only", SITE_URL: "http://127.0.0.1:3000", NEXT_TELEMETRY_DISABLED: "1",NINE_ROUTER_BASE_URL:"https://nine-router-fixture.test/v1",NINE_ROUTER_API_KEY:"fixture-only",NINE_ROUTER_MODEL:"gpt-4o-mini" } },
  ],
});
