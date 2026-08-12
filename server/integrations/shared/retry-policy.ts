const DELAYS = [60_000, 300_000, 900_000, 3_600_000, 21_600_000] as const;

export function domainRetryDelay(attempt: number) {
  const index = Math.max(0, Math.min(DELAYS.length - 1, Math.trunc(attempt) - 1));
  return DELAYS[index];
}
