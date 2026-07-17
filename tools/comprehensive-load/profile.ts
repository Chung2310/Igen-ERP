export const STAGING_ORIGIN = "https://staging-erp.igentechsolutions.com";
export const MAX_VUS = 1_000;

export interface LoadStage { vus: number; durationMs: number }
export const STAGES: readonly LoadStage[] = Object.freeze([
  { vus: 5, durationMs: 120_000 },
  { vus: 25, durationMs: 300_000 },
  { vus: 50, durationMs: 300_000 },
  { vus: 100, durationMs: 300_000 },
  { vus: 250, durationMs: 300_000 },
  { vus: 500, durationMs: 300_000 },
  { vus: 1_000, durationMs: 300_000 },
  { vus: 1_000, durationMs: 600_000 },
  { vus: 0, durationMs: 300_000 },
]);

export const SCENARIOS = Object.freeze([
  { name: "auth", weight: 5 },
  { name: "dashboard-students", weight: 35 },
  { name: "courses-batches", weight: 20 },
  { name: "schedule", weight: 10 },
  { name: "partners-resources", weight: 10 },
  { name: "owned-write", weight: 10 },
  { name: "chat", weight: 10 },
]);

export function selectScenario(percentile: number) {
  const bounded = Math.min(99.999, Math.max(0, percentile));
  let cursor = 0;
  for (const scenario of SCENARIOS) {
    cursor += scenario.weight;
    if (bounded < cursor) return scenario;
  }
  return SCENARIOS[SCENARIOS.length - 1];
}
