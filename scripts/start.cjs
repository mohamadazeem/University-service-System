// Start both servers with one source of truth for the API port.
const path = require("node:path");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const backend = path.join(root, "backend");
let dotenv;
try {
  dotenv = require(path.join(backend, "node_modules", "dotenv"));
  require.resolve(path.join(root, "frontend", "node_modules", "vite", "bin", "vite.js"));
} catch {
  console.error("Install dependencies first: npm.cmd run setup");
  process.exit(1);
}
dotenv.config({ path: path.join(backend, ".env"), quiet: true });
const port = process.env.PORT || "5000";
const children = [];
let stopping = false;
let frontendStarted = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === "win32") {
      spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    } else child.kill();
  }
}
function launch(file, cwd, env, output = "inherit") {
  const args = file === path.join(backend, "server.js")
    ? [path.join(backend, "node_modules", "nodemon", "bin", "nodemon.js"), "--watch", backend,
      "--ext", "js,json", "--ignore", "**/node_modules/**", "--ignore", "**/tests/**", file]
    : [file];
  const child = spawn(process.execPath, args, {
    cwd, env: { ...process.env, ...env }, stdio: ["inherit", output, "inherit"],
  });
  children.push(child);
  child.on("error", () => {
    console.error("Could not start the application. Check Node.js and run npm.cmd run setup.");
    stop(1);
  });
  child.on("exit", (code) => { if (!stopping) stop(code || 1); });
  return child;
}
console.log("Connecting to the configured MongoDB database before opening the website...");
const api = launch(path.join(backend, "server.js"), backend, {}, "pipe");
let output = "";
api.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  output = (output + chunk.toString()).slice(-4096);
  if (!frontendStarted && output.includes("MongoDB connected")) {
    frontendStarted = true;
    launch(path.join(root, "frontend", "node_modules", "vite", "bin", "vite.js"),
      path.join(root, "frontend"), {
        API_PROXY_TARGET: `http://127.0.0.1:${port}`,
        VITE_API_BASE_URL: "/api",
      });
    console.log("Keep this terminal open while using the website. Press Ctrl+C to stop both servers.");
  }
});
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
