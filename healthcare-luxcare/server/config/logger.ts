import "dotenv/config";
import os from "node:os";
import util from "node:util";
import pino, { type DestinationStream } from "pino";
import { getActiveRequestLogFields } from "../middleware/request-context";

type LogLevel = "error" | "warn" | "info" | "http" | "debug";
const SENSITIVE_KEY =
  /password|passcode|token|secret|authorization|cookie|api[-_]?key|^otp$|^body$|^requestBody$|^responseBody$/i;
const MAX_TEXT = 8000;

function redactText(text: string): string {
  return text
    .replace(/\b(Bearer|Basic)\s+[^\s,;"']+/gi, "$1 [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED]")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, "$1[REDACTED]@")
    .replace(/([?&](?:[^=\s&#]*(?:token|secret|password|api[_-]?key|signature)|code)=)[^\s&#"']*/gi, "$1[REDACTED]")
    .replace(
      /((?:["']?[\w-]*(?:password|passcode|token|secret|authorization|cookie|api[_-]?key|otp)[\w-]*["']?)\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)/gi,
      "$1[REDACTED]",
    )
    .slice(0, MAX_TEXT);
}

/** Never mutate caller data, invoke toJSON, or include arbitrary Error payloads. */
export function redactLogData(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (typeof value === "string") return redactText(value);
  if (typeof value === "bigint") return String(value);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  if (depth >= 8) return "[MaxDepth]";
  seen.add(value);
  try {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return "[Binary]";
    if (value instanceof Error) {
      const error = value as Error & { code?: unknown; status?: unknown; cause?: unknown };
      return redactLogData(
        {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: error.code,
          status: error.status,
          cause: error.cause,
        },
        seen,
        depth + 1,
      );
    }
    if (Array.isArray(value)) {
      const items = value.slice(0, 30).map((item) => redactLogData(item, seen, depth + 1));
      if (value.length > 30) items.push(`[${value.length - 30} more items]`);
      return items;
    }
    return Object.fromEntries(
      Object.keys(value)
        .slice(0, 50)
        .map((key) => {
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          return [
            key,
            SENSITIVE_KEY.test(key)
              ? "[REDACTED]"
              : descriptor && "value" in descriptor
                ? redactLogData(descriptor.value, seen, depth + 1)
                : "[Accessor]",
          ];
        }),
    );
  } finally {
    seen.delete(value);
  }
}

function formatSafe(args: unknown[]): string {
  // Preserve format placeholders until substitution; otherwise token=%s could
  // lose %s during redaction and append the secret as an unlabelled argument.
  const [first, ...rest] = args;
  return redactText(
    util.format(typeof first === "string" ? first : redactLogData(first), ...rest.map((arg) => redactLogData(arg))),
  );
}

function logArguments(args: unknown[]): Record<string, unknown> {
  const safe = args.map((arg) => redactLogData(arg));
  if (args[0] && typeof args[0] === "object" && !(args[0] instanceof Error) && !Array.isArray(args[0])) {
    return { ...(safe[0] as Record<string, unknown>), ...(safe.length > 1 ? { msg: formatSafe(args.slice(1)) } : {}) };
  }
  const error = args.findIndex((arg) => arg instanceof Error);
  const data = safe.filter((arg, index) => index !== error && index > 0 && arg && typeof arg === "object");
  return {
    msg: formatSafe(args),
    ...(error >= 0 ? { error: safe[error] } : {}),
    ...(data.length ? { data: data.length === 1 ? data[0] : data } : {}),
  };
}

export function createAppLogger(options: { destination?: DestinationStream; level?: string; format?: string } = {}) {
  const requestedLevel =
    options.level ?? process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug");
  const level = ["fatal", "error", "warn", "info", "debug", "trace", "silent"].includes(requestedLevel)
    ? requestedLevel
    : "info";
  const format =
    options.format ?? process.env.LOG_FORMAT ?? (process.env.NODE_ENV === "production" ? "json" : "pretty");
  const destination: DestinationStream = options.destination ?? {
    write(line) {
      const entry = JSON.parse(line);
      const stream = entry.level === "error" || entry.level === "fatal" ? process.stderr : process.stdout;
      if (format === "json") stream.write(line);
      else {
        const { time, level, msg, ...fields } = entry;
        stream.write(`${time} ${level.toUpperCase()} ${msg ?? fields.event ?? ""} ${JSON.stringify(fields)}\n`);
      }
    },
  };
  const base = pino(
    {
      level,
      base: {
        service: "lux-care",
        environment: process.env.NODE_ENV || "development",
        version: process.env.APP_VERSION || "unknown",
        instanceId: process.env.INSTANCE_ID || os.hostname(),
        pid: process.pid,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
    },
    destination,
  );
  const write = (level: LogLevel, args: unknown[]) => {
    const target = level === "http" ? "info" : level;
    if (!base.isLevelEnabled(target)) return;
    try {
      const fields = logArguments(args);
      for (const key of ["time", "level", "service", "environment", "version", "instanceId", "pid", "hostname"])
        delete fields[key];
      base[target]({ ...fields, ...getActiveRequestLogFields() });
    } catch {
      base.error({
        event: "logging.serialization_failed",
        ...getActiveRequestLogFields(),
        msg: "Unable to serialize log event",
      });
    }
  };
  return {
    error: (...args: unknown[]) => write("error", args),
    warn: (...args: unknown[]) => write("warn", args),
    info: (...args: unknown[]) => write("info", args),
    http: (...args: unknown[]) => write("http", args),
    debug: (...args: unknown[]) => write("debug", args),
  };
}

export const logger = createAppLogger();
