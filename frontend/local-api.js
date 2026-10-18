import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";

// Vite owns the local API only when it starts it. An existing API is reused.
export function localApi(target, backendPort) {
  let child;
  const backend = fileURLToPath(new URL("../backend/", import.meta.url));
  async function start(server) {
    const url = new URL(target);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        Number(url.port || 80) !== Number(backendPort)) return;
    try {
      const response = await fetch(new URL("/", url), { signal: AbortSignal.timeout(1500) });
      const data = await response.json();
      if (response.ok && data.message === "University Service System API") return;
      throw new Error("Unexpected service");
    } catch (error) {
      if (error.message === "Unexpected service") {
        throw new Error("The API port is occupied by another service. Check backend/.env PORT.", { cause: error });
      }
    }
    console.log("Starting the local API and waiting for MongoDB...");
    child = spawn(process.execPath, ["server.js"], {
      cwd: backend, env: process.env, stdio: ["ignore", "pipe", "inherit"],
    });
    const stop = () => { if (child && !child.killed) child.kill(); };
    process.once("exit", stop);
    server.httpServer?.once("close", stop);
    await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(() => {
        stop();
        reject(new Error("The API did not become ready. Check the backend startup messages."));
      }, 60000);
      child.stdout.on("data", (chunk) => {
        process.stdout.write(chunk);
        output = (output + chunk).slice(-4096);
        if (output.includes("MongoDB connected")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once("error", (error) => { clearTimeout(timer); reject(error); });
      child.once("exit", () => {
        clearTimeout(timer);
        reject(new Error("The local API stopped. Check the backend startup messages above."));
      });
    });
  }
  return { name: "local-api", configureServer: start, configurePreviewServer: start };
}
