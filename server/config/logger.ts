import fs from "fs";
import path from "path";
import util from "util";

type LogLevel = "error" | "warn" | "info" | "http" | "debug";

const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const levelPriority: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};
const ansiColors: Record<LogLevel, string> = {
  error: "\x1b[31m",
  warn: "\x1b[33m",
  info: "\x1b[32m",
  http: "\x1b[35m",
  debug: "\x1b[37m",
};
const resetColor = "\x1b[0m";
const currentLevel: LogLevel =
  process.env.NODE_ENV === "production" ? "info" : "debug";
const SENSITIVE_KEY =
  /^(authorization|cookie|password|passcode|token|accessToken|refreshToken|otp|secret|apiKey)$/i;

function timestamp(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join(
      "-",
    ) +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] <= levelPriority[currentLevel];
}

export function redactLogData(
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (value instanceof Error) {
    const cause =
      "cause" in value
        ? (value as Error & { cause?: unknown }).cause
        : undefined;
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...(cause !== undefined ? { cause: redactLogData(cause, seen) } : {}),
    };
  }
  if (Array.isArray(value))
    return value.map((item) => redactLogData(item, seen));

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactLogData(item, seen),
    ]),
  );
}

function serializeArg(arg: unknown): string {
  if (arg instanceof Error) return arg.stack || arg.message;
  if (typeof arg === "string") return arg;
  try {
    return JSON.stringify(redactLogData(arg));
  } catch {
    return util.inspect(redactLogData(arg), {
      depth: null,
      colors: false,
      breakLength: Infinity,
    });
  }
}

function formatMessage(args: unknown[]): string {
  if (args.length === 0) return "";
  const [first, ...rest] = args;
  if (typeof first === "string") return util.format(first, ...rest);
  return args.map(serializeArg).join(" ");
}

function appendLog(filename: string, line: string): void {
  fs.appendFileSync(path.join(logDir, filename), `${line}\n`, "utf8");
}

function write(level: LogLevel, args: unknown[]): void {
  if (!shouldLog(level)) return;
  const time = timestamp();
  const message = formatMessage(args);
  const plainLine = `[${time}] [${level.toUpperCase()}]: ${message}`;
  const consoleLine = `[${time}] [${ansiColors[level]}${level}${resetColor}]: ${message}`;
  if (level === "error") console.error(consoleLine);
  else console.log(consoleLine);
  appendLog("combined.log", plainLine);
  if (level === "error") appendLog("error.log", plainLine);
}

export const logger = {
  error: (...args: unknown[]) => write("error", args),
  warn: (...args: unknown[]) => write("warn", args),
  info: (...args: unknown[]) => write("info", args),
  http: (...args: unknown[]) => write("http", args),
  debug: (...args: unknown[]) => write("debug", args),
};
