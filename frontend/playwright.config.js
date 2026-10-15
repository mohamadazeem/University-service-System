import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 120000,
  expect: { timeout: 15000 },
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:5174", channel: "chrome", actionTimeout: 15000, screenshot: "only-on-failure", trace: "off" },
  webServer: [
    { command: "node server.js", url: "http://127.0.0.1:5002", cwd: "../backend", env: { PORT: "5002" }, timeout: 60000 },
    { command: "npm run dev -- --host 127.0.0.1 --port 5174 --strictPort", url: "http://127.0.0.1:5174", env: { API_PROXY_TARGET: "http://127.0.0.1:5002" }, timeout: 30000 },
  ],
});
