export interface MetricSample {
  status?: number;
  latencyMs: number;
  validLogin: boolean;
  loginSucceeded?: boolean;
}

export interface MetricsSummary {
  completed: number;
  serverErrors: number;
  networkErrors: number;
  validLogins: number;
  validLoginFailures: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
}

function nearestRank(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.ceil(sorted.length * percentile) - 1];
}

export function summarizeMetrics(samples: MetricSample[]): MetricsSummary {
  const latencies = samples.map((sample) => sample.latencyMs).sort((a, b) => a - b);
  return {
    completed: samples.length,
    serverErrors: samples.filter((sample) => (sample.status ?? 0) >= 500).length,
    networkErrors: samples.filter((sample) => sample.status === undefined).length,
    validLogins: samples.filter((sample) => sample.validLogin).length,
    validLoginFailures: samples.filter((sample) => sample.validLogin && !sample.loginSucceeded).length,
    p50LatencyMs: nearestRank(latencies, 0.5),
    p95LatencyMs: nearestRank(latencies, 0.95),
    p99LatencyMs: nearestRank(latencies, 0.99),
  };
}

export type CircuitReason = "5xx-threshold" | "login-threshold" | "latency-threshold" | "network-threshold";
export function getCircuitReason(summary: MetricsSummary): CircuitReason | null {
  if (summary.completed >= 100 && summary.serverErrors / summary.completed > 0.01) return "5xx-threshold";
  if (summary.validLogins >= 100 && summary.validLoginFailures / summary.validLogins > 0.01) return "login-threshold";
  if (summary.completed >= 100 && summary.p95LatencyMs > 1_000) return "latency-threshold";
  if (summary.networkErrors >= 10) return "network-threshold";
  return null;
}
