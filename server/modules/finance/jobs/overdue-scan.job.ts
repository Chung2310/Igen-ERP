import { businessDateInTimeZone } from "../services/overdue-reminder.service";

export function shouldRunOverdueSchedule(now: Date, timeZone: string, lastBusinessDate?: string) {
  const businessDate = businessDateInTimeZone(now, timeZone);
  if (lastBusinessDate === businessDate) return false;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return value("hour") > 8 || value("hour") === 8 && value("minute") >= 15;
}

export function startOverdueScanScheduler(runAll: (now: Date) => Promise<void>, timeZone = "Asia/Ho_Chi_Minh", intervalMs = 60_000) {
  let lastBusinessDate: string | undefined;
  const run = () => {
    const now = new Date();
    if (!shouldRunOverdueSchedule(now, timeZone, lastBusinessDate)) return;
    lastBusinessDate = businessDateInTimeZone(now, timeZone);
    void runAll(now).catch((error) => { lastBusinessDate = undefined; console.error("[finance-overdue-scan]", error); });
  };
  const timer = setInterval(run, intervalMs); timer.unref?.(); return timer;
}

let scheduler: ReturnType<typeof setInterval> | undefined;
export function ensureOverdueScanScheduler(runAll: (now: Date) => Promise<void>) {
  if (!scheduler) scheduler = startOverdueScanScheduler(runAll);
  return scheduler;
}
