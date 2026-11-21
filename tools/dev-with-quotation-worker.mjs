import "dotenv/config";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const env = {
  ...process.env,
  NODE_ENV: "development",
  QUOTATION_WORKERS_ENABLED: "true",
  QUOTATION_QUEUE_MODE: "local",
  QUOTATION_QUEUE_PREFIX: process.env.QUOTATION_QUEUE_PREFIX?.trim() || "igen-local-quotation",
};
let stopping = false;
let exitCode = 0;
const child = spawn(process.execPath, [tsxCli, "watch", "--exclude", "**/tmp/**", "--exclude", "**/dist/**", "--exclude", "**/dist-server/**", "server.ts"], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});
child.on("error", (error) => {
  console.error(`[ERP server] ${error.message}`);
  exitCode = 1;
  stop("SIGTERM");
});
child.on("exit", (code) => {
  if (!stopping) {
    exitCode = code ?? 1;
    stop("SIGTERM");
  }
});
function stop(signal) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  if (child.exitCode === null && !child.killed) child.kill(signal);
}
process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
