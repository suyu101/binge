import { spawn } from "node:child_process";
import { createServer } from "vite";

let shuttingDown = false;
process.env.VITE_API_BASE ||= "http://127.0.0.1:8787";

const api = spawn(process.execPath, ["server.mjs"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

const vite = await createServer();
await vite.listen();
vite.printUrls();

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  api.kill();
  await vite.close();
  process.exit(code);
}

api.on("exit", (code) => {
  if (!shuttingDown) shutdown(code || 1);
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
