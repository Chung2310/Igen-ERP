import "dotenv/config";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const env = {
  ...process.env,
  QUOTATION_WORKERS_ENABLED: "true",
  QUOTATION_QUEUE_PREFIX: process.env.QUOTATION_QUEUE_PREFIX?.trim() || "igen-local-quotation",
};
const commands = [
  ["ERP server", ["watch", "--exclude", "**/tmp/**", "--exclude", "**/dist/**", "--exclude", "**/dist-server/**", "server.ts"]],
  ["Quotation worker", ["watch", "server/workers/quotation.worker.ts"]],
];

let stopping = false;
let exitCode = 0;
const children = commands.map(([name, args]) => {
  const child = spawn(process.execPath, [tsxCli, ...args], { cwd: process.cwd(), env, stdio: "inherit" });
  child.on("error", (error) => {
    console.error(`[${name}] ${error.message}`);
    exitCode = 1;
    stop("SIGTERM");
  });
  child.on("exit", (code) => {
    if (!stopping) {
      exitCode = code ?? 1;
      stop("SIGTERM");
    }
  });
  return child;
});

function stop(signal) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) if (child.exitCode === null && !child.killed) child.kill(signal);
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
