import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { summarize, type RequestResult, type StressSummary } from "./controlled-staging-stress-test.js";

export const PRODUCTION_ORIGIN = "https://erp.igentechsolutions.com";
export const MAX_PRODUCTION_CONCURRENCY = 10;
export const MAX_PRODUCTION_DURATION_MS = 600_000;
export const PRODUCTION_STAGES = Object.freeze([
  { ratePerSecond: 2, durationMs: 120_000 },
  { ratePerSecond: 5, durationMs: 120_000 },
  { ratePerSecond: 10, durationMs: 120_000 },
  { ratePerSecond: 20, durationMs: 120_000 },
]);

const HEALTH_PATH = "/api/v1/health";
const LOGIN_PATH = "/api/v1/auth/login";
const LOGIN_BODY = JSON.stringify({
  email: "production-load-test@example.invalid",
  password: "not-a-real-password",
});

export interface ProductionClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export interface ProductionStage {
  ratePerSecond: number;
  durationMs: number;
}

export type ProductionStopReason =
  | "completed"
  | "health-failure"
  | "5xx"
  | "network-error-threshold"
  | "latency-threshold"
  | "deadline"
  | "operator-abort";

export interface ProductionStageReport {
  ratePerSecond: number;
  durationMs: number;
  summary: StressSummary;
}

export interface ProductionReport {
  stages: ProductionStageReport[];
  stopReason: ProductionStopReason;
  recoveryHealthy: boolean | null;
}

const systemClock: ProductionClock = {
  now: () => performance.now(),
  sleep: (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms)),
};

export async function runProductionLoadTest(
  fetchImpl: typeof fetch = fetch,
  clock: ProductionClock = systemClock,
  signal: AbortSignal = new AbortController().signal,
  stages: readonly ProductionStage[] = PRODUCTION_STAGES,
  recoveryMs = 60_000,
): Promise<ProductionReport> {
  const reports: ProductionStageReport[] = [];
  let stopReason: ProductionStopReason = "completed";
  const runStartedAt = clock.now();
  let consecutiveNetworkErrors = 0;

  const health = async (): Promise<boolean> => {
    try {
      const response = await fetchImpl(`${PRODUCTION_ORIGIN}${HEALTH_PATH}`, { signal });
      return response.status === 200;
    } catch {
      return false;
    }
  };

  if (signal.aborted) return { stages: reports, stopReason: "operator-abort", recoveryHealthy: null };
  if (!(await health())) return { stages: reports, stopReason: "health-failure", recoveryHealthy: false };

  for (const stage of stages) {
    const stageStartedAt = clock.now();
    const results: RequestResult[] = [];
    let windowResults: RequestResult[] = [];
    let nextHealthAt = stageStartedAt + 30_000;
    while (clock.now() - stageStartedAt < stage.durationMs) {
      if (signal.aborted) {
        stopReason = "operator-abort";
        break;
      }
      if (clock.now() - runStartedAt >= MAX_PRODUCTION_DURATION_MS) {
        stopReason = "deadline";
        break;
      }
      const windowStartedAt = clock.now();
      let remaining = stage.ratePerSecond;
      while (remaining > 0) {
        const batchSize = Math.min(MAX_PRODUCTION_CONCURRENCY, remaining);
        const batch = await Promise.all(Array.from({ length: batchSize }, async (): Promise<RequestResult> => {
          const startedAt = clock.now();
          try {
            const response = await fetchImpl(`${PRODUCTION_ORIGIN}${LOGIN_PATH}`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: LOGIN_BODY,
              signal,
            });
            return { status: response.status, latencyMs: clock.now() - startedAt };
          } catch {
            return { latencyMs: clock.now() - startedAt };
          }
        }));
        results.push(...batch);
        windowResults.push(...batch);
        for (const result of batch) {
          consecutiveNetworkErrors = result.status === undefined ? consecutiveNetworkErrors + 1 : 0;
          if (result.status !== undefined && result.status >= 500) stopReason = "5xx";
          if (consecutiveNetworkErrors >= 5) stopReason = "network-error-threshold";
        }
        remaining -= batchSize;
        if (stopReason !== "completed") break;
      }
      if (stopReason !== "completed") break;
      const waitMs = Math.min(1_000 - (clock.now() - windowStartedAt), stage.durationMs - (clock.now() - stageStartedAt));
      if (waitMs > 0) await clock.sleep(waitMs);
      if (clock.now() >= nextHealthAt) {
        const windowSummary = summarize(windowResults);
        if (windowSummary.completed >= 20 && windowSummary.p95LatencyMs > 1_000) {
          stopReason = "latency-threshold";
          break;
        }
        windowResults = [];
        nextHealthAt += 30_000;
        if (!(await health())) {
          stopReason = signal.aborted ? "operator-abort" : "health-failure";
          break;
        }
      }
    }
    reports.push({ ratePerSecond: stage.ratePerSecond, durationMs: clock.now() - stageStartedAt, summary: summarize(results) });
    if (stopReason !== "completed") break;
    if (!(await health())) {
      stopReason = "health-failure";
      break;
    }
  }

  if (stopReason === "completed" && recoveryMs > 0) await clock.sleep(recoveryMs);
  const recoveryHealthy = stopReason === "completed" ? await health() : null;
  if (stopReason === "completed" && !recoveryHealthy) stopReason = "health-failure";
  return { stages: reports, stopReason, recoveryHealthy };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  const report = await runProductionLoadTest(fetch, systemClock, controller.signal);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.stopReason === "completed" ? 0 : 1;
}
