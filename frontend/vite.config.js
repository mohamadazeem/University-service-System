import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { cwd } from "node:process";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, cwd(), "");
  return {
    plugins: [react()],
    server: {
      proxy: { "/api": env.API_PROXY_TARGET || "http://127.0.0.1:5000" },
    },
  };
});
