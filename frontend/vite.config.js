import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { cwd } from "node:process";
import { fileURLToPath } from "node:url";
import { localApi } from "./local-api.js";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, cwd(), "");
  const backendEnv = loadEnv(mode, fileURLToPath(new URL("../backend/", import.meta.url)), "");
  const port = backendEnv.PORT || "5000";
  const target = env.API_PROXY_TARGET || `http://127.0.0.1:${port}`;
  const proxy = { "/api": target };
  return {
    plugins: [react(), localApi(target, port)],
    server: {
      port: 5173,
      strictPort: true,
      proxy,
    },
    preview: { proxy },
  };
});
