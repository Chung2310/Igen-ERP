import fs from "fs";
import path from "path";
import util from "util";

type LogLevel = "error" | "warn" | "info" | "http" | "debug";

const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

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
const currentLevel: LogLevel = process.env.NODE_ENV === "production" ? "info" : "debug";

function timestamp(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] <= levelPriority[currentLevel];
}

function serializeArg(arg: unknown): string {
  if (arg instanceof Error) {
    return arg.stack || arg.message;
  }

  if (typeof arg === "string") {
    return arg;
  }

  return util.inspect(arg, {
    depth: null,
    colors: false,
    breakLength: Infinity,
  });
}

function formatMessage(args: unknown[]): string {
  if (args.length === 0) {
    return "";
  }

  const [first, ...rest] = args;
  if (typeof first === "string") {
    return util.format(first, ...rest);
  }

  return args.map(serializeArg).join(" ");
}

function appendLog(filename: string, line: string): void {
  fs.appendFileSync(path.join(logDir, filename), `${line}\n`, "utf8");
}

function write(level: LogLevel, args: unknown[]): void {
  if (!shouldLog(level)) {
    return;
  }

  const time = timestamp();
  const message = formatMessage(args);
  const plainLine = `[${time}] [${level.toUpperCase()}]: ${message}`;
  const color = ansiColors[level];
  const consoleLine = `[${time}] [${color}${level}${resetColor}]: ${message}`;

  if (level === "error") {
    console.error(consoleLine);
  } else {
    console.log(consoleLine);
  }

  appendLog("combined.log", plainLine);
  if (level === "error") {
    appendLog("error.log", plainLine);
  }
}

export const logger = {
  error: (...args: unknown[]) => write("error", args),
  warn: (...args: unknown[]) => write("warn", args),
  info: (...args: unknown[]) => write("info", args),
  http: (...args: unknown[]) => write("http", args),
  debug: (...args: unknown[]) => write("debug", args),
};
