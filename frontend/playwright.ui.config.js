import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "support.ui.spec.js",
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:5175", channel: "chrome" },
  webServer: { command: "npm.cmd run dev -- --host 127.0.0.1 --port 5175 --strictPort", url: "http://127.0.0.1:5175", timeout: 30000 },
});
