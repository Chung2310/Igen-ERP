import "dotenv/config";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { connect } from "node:net";
import path from "node:path";

const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const env = {
  ...process.env,
  NODE_ENV: "development",
  QUOTATION_WORKERS_ENABLED: "true",
  QUOTATION_QUEUE_MODE: "local",
  QUOTATION_QUEUE_PREFIX: process.env.QUOTATION_QUEUE_PREFIX?.trim() || "igen-local-quotation",
};
const commands = [
  {
    name: "ERP server",
    args: ["watch", "--exclude", "**/tmp/**", "--exclude", "**/dist/**", "--exclude", "**/dist-server/**", "server.ts"],
    env,
  },
];

const gymBridgeSecret = env.GYM_BRIDGE_SECRET?.trim();
let gymBackendUrl;
try {
  gymBackendUrl = new URL(env.GYM_BACKEND_URL || "http://127.0.0.1:3018");
} catch {
  gymBackendUrl = null;
}
const localGymHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
const shouldStartLocalGym = Boolean(
  env.GYM_MONGODB_URI?.trim()
  && gymBridgeSecret
  && gymBridgeSecret.length >= 32
  && gymBackendUrl
  && gymBackendUrl.protocol === "http:"
  && localGymHosts.has(gymBackendUrl.hostname)
  && (gymBackendUrl.port || "80") === "3018",
);

function isGymPortReachable() {
  return new Promise((resolve) => {
    const socket = connect({
      host: gymBackendUrl.hostname.replace(/^\[|\]$/g, ""),
      port: Number(gymBackendUrl.port || 80),
    });
    const finish = (reachable) => {
      socket.destroy();
      resolve(reachable);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(1000, () => finish(false));
  });
}

const gymCommand = {
    name: "GYM API",
    args: ["watch", "--exclude", "**/tmp/**", "--exclude", "**/dist/**", "backend/dev.ts"],
    env: {
      ...env,
      NODE_ENV: "development",
      GYM_EMBEDDED: "1",
      MONGODB_URI: env.GYM_MONGODB_URI,
      MONGODB_USER: env.GYM_MONGODB_USER,
      MONGODB_PASSWORD: env.GYM_MONGODB_PASSWORD,
      MONGODB_AUTH_SOURCE: env.GYM_MONGODB_AUTH_SOURCE,
      JWT_SECRET: gymBridgeSecret,
      PORT: "3018",
      GYM_ERP_API_URL: env.GYM_ERP_API_URL?.trim() || "http://127.0.0.1:3000",
      OPENROUTER_API_KEY: env.GYM_OPENROUTER_API_KEY?.trim() || env.OPENROUTER_API_KEY,
      OPENROUTER_REASONING_EFFORT: env.GYM_OPENROUTER_REASONING_EFFORT,
      AI_MODEL: env.GYM_AI_MODEL,
      OCR_MODEL: env.GYM_OCR_MODEL,
      AI_COMPANY_PAID_DAILY_CALLS_PER_USER: env.GYM_AI_COMPANY_PAID_DAILY_CALLS_PER_USER,
      AI_COMPANY_PAID_MONTHLY_CALLS_PER_USER: env.GYM_AI_COMPANY_PAID_MONTHLY_CALLS_PER_USER,
      AI_COMPANY_PAID_MONTHLY_CALLS_PER_CENTER: env.GYM_AI_COMPANY_PAID_MONTHLY_CALLS_PER_CENTER,
      AI_GLOBAL_MONTHLY_BUDGET_VND: env.GYM_AI_GLOBAL_MONTHLY_BUDGET_VND,
      AI_GLOBAL_MAX_RESERVATION_VND: env.GYM_AI_GLOBAL_MAX_RESERVATION_VND,
      CLOUDINARY_CLOUD_NAME: env.GYM_CLOUDINARY_CLOUD_NAME?.trim() || env.CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY: env.GYM_CLOUDINARY_API_KEY?.trim() || env.CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET: env.GYM_CLOUDINARY_API_SECRET?.trim() || env.CLOUDINARY_API_SECRET,
    },
    cwd: path.resolve(process.cwd(), "gym-module", "3s"),
};
if (shouldStartLocalGym && !await isGymPortReachable()) commands.push(gymCommand);

let stopping = false;
let exitCode = 0;
const children = [];
function startCommand({ name, args, env: childEnv, cwd = process.cwd() }) {
  const child = spawn(process.execPath, [tsxCli, ...args], { cwd, env: childEnv, stdio: "inherit" });
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
  children.push(child);
}
for (const command of commands) startCommand(command);

// An already-running GYM API may stop while the ERP dev server stays open.
// Start our own instance when its port becomes free.
let gymMonitor;
if (shouldStartLocalGym && commands.length === 1) {
  let checking = false;
  gymMonitor = setInterval(async () => {
    if (stopping || checking) return;
    checking = true;
    try {
      if (await isGymPortReachable() || stopping) return;
      clearInterval(gymMonitor);
      console.info("[GYM API] Cổng 3018 đã trống; khởi động GYM local.");
      startCommand(gymCommand);
    } finally {
      checking = false;
    }
  }, 5000);
  gymMonitor.unref();
}

function stop(signal) {
  if (stopping) return;
  stopping = true;
  if (gymMonitor) clearInterval(gymMonitor);
  process.exitCode = exitCode;
  for (const child of children) if (child.exitCode === null && !child.killed) child.kill(signal);
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
