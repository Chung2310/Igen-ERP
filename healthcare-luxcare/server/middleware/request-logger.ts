import { performance } from "node:perf_hooks";
import type { RequestHandler } from "express";
import { logger } from "../config/logger";
import { getRequestLogFields } from "./request-context";

export function requestLogPath(url: string | undefined): string {
  // Query values can contain access tokens, searches and other personal data.
  return (url || "").split(/[?#]/, 1)[0].slice(0, 1024);
}

function configuredSlowMs(): number {
  const value = Number(process.env.LOG_SLOW_REQUEST_MS?.trim() || 1000);
  return Number.isFinite(value) && value >= 0 ? value : 1000;
}

export function createRequestLogger(log = logger, slowMs = configuredSlowMs()): RequestHandler {
  return (req, res, next) => {
    const start = performance.now();
    const path = requestLogPath(req.originalUrl || req.url);
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      res.off("finish", finish);
      res.off("close", finish);
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      const aborted = !res.writableFinished;
      const slow = durationMs >= slowMs;
      const event = {
        event: aborted ? "http.request.aborted" : "http.request.completed",
        ...getRequestLogFields(req),
        method: req.method,
        path,
        clientIp: req.ip,
        userAgent: req.get?.("user-agent")?.slice(0, 256),
        route: typeof req.route?.path === "string" ? req.route.path : undefined,
        status: aborted ? undefined : res.statusCode,
        durationMs,
        slow,
        responseBytes: res.getHeader("content-length") == null ? undefined : Number(res.getHeader("content-length")),
      };
      const routine =
        req.method === "GET" && ["/api/v1/health", "/api/v1/wallet/balance", "/api/v1/crud/products"].includes(path);
      if (!aborted && res.statusCode >= 500) log.error(event);
      else if (aborted || res.statusCode >= 400 || slow) log.warn(event);
      else if (routine) log.debug(event);
      else log.info(event);
    };
    res.once("finish", finish);
    res.once("close", finish);
    next();
  };
}

export const requestLoggerMiddleware = createRequestLogger();
