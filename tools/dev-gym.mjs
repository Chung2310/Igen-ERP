import "dotenv/config";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const source = process.env;
const bridgeSecret = source.GYM_BRIDGE_SECRET?.trim();
if (!source.GYM_MONGODB_URI?.trim() || !bridgeSecret || bridgeSecret.length < 32) {
  console.error("GYM cần GYM_MONGODB_URI và GYM_BRIDGE_SECRET (tối thiểu 32 ký tự) trong .env.");
  process.exit(1);
}

const require = createRequire(import.meta.url);
const gymDirectory = path.resolve("gym-module", "3s");
const gymEnv = {
  ...source,
  NODE_ENV: "development",
  GYM_EMBEDDED: "1",
  GYM_ERP_API_URL: source.GYM_ERP_API_URL?.trim() || "http://127.0.0.1:3000",
  PORT: "3018",
  MONGODB_URI: source.GYM_MONGODB_URI,
  MONGODB_USER: source.GYM_MONGODB_USER,
  MONGODB_PASSWORD: source.GYM_MONGODB_PASSWORD,
  MONGODB_AUTH_SOURCE: source.GYM_MONGODB_AUTH_SOURCE,
  JWT_SECRET: bridgeSecret,
  OPENROUTER_API_KEY: source.GYM_OPENROUTER_API_KEY?.trim() || source.OPENROUTER_API_KEY,
  OPENROUTER_REASONING_EFFORT: source.GYM_OPENROUTER_REASONING_EFFORT,
  AI_MODEL: source.GYM_AI_MODEL,
  OCR_MODEL: source.GYM_OCR_MODEL,
  AI_COMPANY_PAID_DAILY_CALLS_PER_USER: source.GYM_AI_COMPANY_PAID_DAILY_CALLS_PER_USER,
  AI_COMPANY_PAID_MONTHLY_CALLS_PER_USER: source.GYM_AI_COMPANY_PAID_MONTHLY_CALLS_PER_USER,
  AI_COMPANY_PAID_MONTHLY_CALLS_PER_CENTER: source.GYM_AI_COMPANY_PAID_MONTHLY_CALLS_PER_CENTER,
  AI_GLOBAL_MONTHLY_BUDGET_VND: source.GYM_AI_GLOBAL_MONTHLY_BUDGET_VND,
  AI_GLOBAL_MAX_RESERVATION_VND: source.GYM_AI_GLOBAL_MAX_RESERVATION_VND,
  CLOUDINARY_CLOUD_NAME: source.GYM_CLOUDINARY_CLOUD_NAME?.trim() || source.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: source.GYM_CLOUDINARY_API_KEY?.trim() || source.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: source.GYM_CLOUDINARY_API_SECRET?.trim() || source.CLOUDINARY_API_SECRET,
};

const child = spawn(process.execPath, [require.resolve("tsx/cli"), "watch", "--exclude", "**/tmp/**", "--exclude", "**/dist/**", "backend/dev.ts"], {
  cwd: gymDirectory,
  env: gymEnv,
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error(`Không thể khởi động GYM API: ${error.message}`);
  process.exitCode = 1;
});
child.once("exit", (code) => { process.exitCode = code ?? 1; });
process.once("SIGINT", () => child.kill("SIGINT"));
process.once("SIGTERM", () => child.kill("SIGTERM"));
