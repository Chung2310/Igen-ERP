export function calculateEstimatedHours(startTime: string, endTime: string): number | "" {
  if (!startTime || !endTime) return "";

  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "";

  return Number(((end - start) / (1000 * 60 * 60)).toFixed(1));
}
