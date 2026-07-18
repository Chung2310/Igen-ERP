import { getCircuitReason, summarizeMetrics, type CircuitReason, type MetricSample } from "./metrics.js";
import { MAX_VUS, SCENARIOS, selectScenario, type LoadStage } from "./profile.js";

export interface RunnerDependencies {
  clock: { now(): number; sleep(ms: number): Promise<void> };
  random(): number;
  health(): Promise<boolean>;
  executeScenario(name: string, vuId: number): Promise<MetricSample>;
  signal: AbortSignal;
}

export interface LoadReport {
  stopReason: "completed" | "health-failure" | "operator-abort" | CircuitReason;
  maxActiveVus: number;
  summary: ReturnType<typeof summarizeMetrics>;
}

export async function runLoadProfile(deps: RunnerDependencies, stages: readonly LoadStage[]): Promise<LoadReport> {
  const samples: MetricSample[] = [];
  let maxActiveVus = 0;
  let stopReason: LoadReport["stopReason"] = "completed";
  if (!(await deps.health())) return { stopReason: "health-failure", maxActiveVus, summary: summarizeMetrics(samples) };

  for (const stage of stages) {
    if (deps.signal.aborted) { stopReason = "operator-abort"; break; }
    const vus = Math.min(MAX_VUS, Math.max(0, Math.trunc(stage.vus)));
    const endsAt = deps.clock.now() + stage.durationMs;
    let activeVus = 0;
    const loops = Array.from({ length: vus }, (_, vuId) => (async () => {
      activeVus += 1;
      maxActiveVus = Math.max(maxActiveVus, activeVus);
      try {
        while (deps.clock.now() < endsAt && stopReason === "completed" && !deps.signal.aborted) {
          const scenario = selectScenario(deps.random() * 100) ?? SCENARIOS[0];
          samples.push(await deps.executeScenario(scenario.name, vuId));
          const circuit = getCircuitReason(summarizeMetrics(samples.slice(-1_000)));
          if (circuit) { stopReason = circuit; break; }
          await deps.clock.sleep(1_000 + Math.floor(deps.random() * 4_001));
        }
      } finally { activeVus -= 1; }
    })());
    await Promise.all(loops);
    if (deps.signal.aborted) stopReason = "operator-abort";
    if (stopReason !== "completed") break;
    if (!(await deps.health())) { stopReason = "health-failure"; break; }
  }
  return { stopReason, maxActiveVus, summary: summarizeMetrics(samples) };
}
