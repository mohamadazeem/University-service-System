import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests", testMatch: "notifications.ui.spec.js", workers: 1,
  timeout: 45000, expect: { timeout: 10000 }, reporter: "list",
  use: { baseURL: "http://127.0.0.1:5176", channel: "chrome", screenshot: "only-on-failure" },
  webServer: {
    command: "npm.cmd run dev -- --host 127.0.0.1 --port 5176 --strictPort",
    url: "http://127.0.0.1:5176", timeout: 30000,
    env: { API_PROXY_TARGET: "http://127.0.0.1:5002" },
  },
});
