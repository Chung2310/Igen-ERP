export function calculateEstimatedEndDate(startDate: string, daysOfWeek: number[], sessionCount: number): string {
  if (!startDate || !daysOfWeek.length || !Number.isInteger(sessionCount) || sessionCount < 1) return '';
  const date = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';

  let remaining = sessionCount;
  for (let index = 0; index < 3700; index += 1) {
    if (daysOfWeek.includes(date.getUTCDay()) && --remaining === 0) return date.toISOString().slice(0, 10);
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return '';
}
