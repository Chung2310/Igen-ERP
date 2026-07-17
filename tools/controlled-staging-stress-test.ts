export const STAGING_ORIGIN = "https://staging-erp.igentechsolutions.com";
export const MAX_REQUESTS = 10_000;
export const MAX_CONCURRENCY = 10;
export const MAX_RATE_PER_SECOND = 20;
export const MAX_DURATION_MS = 600_000;

const DEFAULT_REQUESTS = 50;
const DEFAULT_CONCURRENCY = 5;

export interface StressOptions {
  requests: number;
  concurrency: number;
}

export interface RequestResult {
  status?: number;
  latencyMs: number;
}

export interface StressSummary {
  completed: number;
  statusCounts: Record<string, number>;
  networkErrors: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  serverErrors: number;
}

export type StopReason =
  | "completed"
  | "deadline"
  | "health-failure"
  | "5xx-threshold"
  | "network-error-threshold";

export interface RunReport {
  summary: StressSummary;
  stopReason: StopReason;
  durationMs: number;
}

export interface RunnerClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

const systemClock: RunnerClock = {
  now: () => performance.now(),
  sleep: (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms)),
};

function boundedInteger(value: string | undefined, fallback: number, maximum: number): number {
  if (value === undefined || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

export function parseOptions(args: string[]): StressOptions {
  let requests = DEFAULT_REQUESTS;
  let concurrency = DEFAULT_CONCURRENCY;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--requests") {
      requests = boundedInteger(args[index + 1], DEFAULT_REQUESTS, MAX_REQUESTS);
      index += 1;
    } else if (args[index] === "--concurrency") {
      concurrency = boundedInteger(args[index + 1], DEFAULT_CONCURRENCY, MAX_CONCURRENCY);
      index += 1;
    }
  }

  return { requests, concurrency };
}

export function summarize(results: RequestResult[]): StressSummary {
  const statusCounts: Record<string, number> = {};
  let networkErrors = 0;
  let serverErrors = 0;
  let totalLatency = 0;
  const latencies: number[] = [];

  for (const result of results) {
    totalLatency += result.latencyMs;
    latencies.push(result.latencyMs);
    if (result.status === undefined) {
      networkErrors += 1;
    } else {
      const key = String(result.status);
      statusCounts[key] = (statusCounts[key] ?? 0) + 1;
      if (result.status >= 500 && result.status < 600) serverErrors += 1;
    }
  }

  latencies.sort((left, right) => left - right);
  const completed = results.length;
  const p95Index = completed === 0 ? 0 : Math.ceil(completed * 0.95) - 1;
  return {
    completed,
    statusCounts,
    networkErrors,
    averageLatencyMs: completed === 0 ? 0 : totalLatency / completed,
    p95LatencyMs: completed === 0 ? 0 : latencies[p95Index],
    serverErrors,
  };
}

export function getCircuitReason(summary: StressSummary): "5xx-threshold" | null {
  return summary.completed >= 20 && summary.serverErrors / summary.completed > 0.05
    ? "5xx-threshold"
    : null;
}

const HEALTH_PATH = "/api/v1/health";
const LOGIN_PATH = "/api/v1/auth/login";
const FAKE_LOGIN_BODY = JSON.stringify({
  email: "controlled-stress-test@example.invalid",
  password: "not-a-real-password",
});

export async function runStressTest(
  requestedOptions: StressOptions,
  fetchImpl: typeof fetch = fetch,
  clock: RunnerClock = systemClock,
): Promise<RunReport> {
  const options = {
    requests: Math.min(Math.max(1, Math.trunc(requestedOptions.requests)), MAX_REQUESTS),
    concurrency: Math.min(Math.max(1, Math.trunc(requestedOptions.concurrency)), MAX_CONCURRENCY),
  };
  const startedAt = clock.now();
  const deadlineController = new AbortController();
  const deadlineTimer = setTimeout(() => deadlineController.abort(), MAX_DURATION_MS);
  const results: RequestResult[] = [];
  let stopReason: StopReason = "completed";

  const timedFetch = async (path: string, init?: RequestInit): Promise<Response> => {
    const elapsed = clock.now() - startedAt;
    const remaining = Math.max(1, MAX_DURATION_MS - elapsed);
    const requestController = new AbortController();
    const abortRequest = () => requestController.abort();
    deadlineController.signal.addEventListener("abort", abortRequest, { once: true });
    const requestTimer = setTimeout(abortRequest, remaining);
    try {
      return await fetchImpl(`${STAGING_ORIGIN}${path}`, {
        ...init,
        signal: requestController.signal,
      });
    } finally {
      clearTimeout(requestTimer);
      deadlineController.signal.removeEventListener("abort", abortRequest);
    }
  };

  const isHealthy = async (): Promise<boolean> => {
    try {
      const response = await timedFetch(HEALTH_PATH, { method: "GET" });
      return response.status === 200;
    } catch {
      return false;
    }
  };

  const attemptLogin = async (): Promise<RequestResult> => {
    const requestStartedAt = clock.now();
    try {
      const response = await timedFetch(LOGIN_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: FAKE_LOGIN_BODY,
      });
      return { status: response.status, latencyMs: clock.now() - requestStartedAt };
    } catch {
      return { latencyMs: clock.now() - requestStartedAt };
    }
  };

  try {
    if (!(await isHealthy())) {
      stopReason = deadlineController.signal.aborted ? "deadline" : "health-failure";
    } else {
      let windowStartedAt = clock.now();
      let issuedInWindow = 0;
      let nextHealthAt = 100;
      let consecutiveNetworkErrors = 0;
      while (results.length < options.requests) {
        if (deadlineController.signal.aborted || clock.now() - startedAt >= MAX_DURATION_MS) {
          stopReason = "deadline";
          break;
        }
        if (issuedInWindow >= MAX_RATE_PER_SECOND) {
          const remainingWindowMs = 1_000 - (clock.now() - windowStartedAt);
          if (remainingWindowMs > 0) await clock.sleep(remainingWindowMs);
          windowStartedAt = clock.now();
          issuedInWindow = 0;
          continue;
        }
        const batchSize = Math.min(
          options.concurrency,
          options.requests - results.length,
          MAX_RATE_PER_SECOND - issuedInWindow,
        );
        const batchResults = await Promise.all(Array.from({ length: batchSize }, attemptLogin));
        results.push(...batchResults);
        issuedInWindow += batchSize;

        for (const result of batchResults) {
          consecutiveNetworkErrors = result.status === undefined
            ? consecutiveNetworkErrors + 1
            : 0;
        }
        if (consecutiveNetworkErrors >= 10) {
          stopReason = "network-error-threshold";
          break;
        }
        const circuitReason = getCircuitReason(summarize(results));
        if (circuitReason) {
          stopReason = circuitReason;
          break;
        }
        const needsHealthCheck = results.length >= nextHealthAt || results.length === options.requests;
        if (needsHealthCheck) {
          while (nextHealthAt <= results.length) nextHealthAt += 100;
          if (!(await isHealthy())) {
            stopReason = deadlineController.signal.aborted ? "deadline" : "health-failure";
            break;
          }
        }
      }
    }
  } finally {
    clearTimeout(deadlineTimer);
  }

  return {
    summary: summarize(results),
    stopReason,
    durationMs: clock.now() - startedAt,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const report = await runStressTest(parseOptions(process.argv.slice(2)));
  console.log(JSON.stringify({
    completed: report.summary.completed,
    statusCounts: report.summary.statusCounts,
    networkErrors: report.summary.networkErrors,
    averageLatencyMs: report.summary.averageLatencyMs,
    p95LatencyMs: report.summary.p95LatencyMs,
    serverErrors: report.summary.serverErrors,
    stopReason: report.stopReason,
    durationMs: report.durationMs,
  }, null, 2));
  process.exitCode = report.stopReason === "completed" ? 0 : 1;
}
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
