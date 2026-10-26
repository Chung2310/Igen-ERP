import { closeExpiredRetailPosSessions } from "./cashier-shift.service";

let timer: ReturnType<typeof setTimeout> | undefined;
let started = false;

function nextVietnameseMidnightDelay(now = new Date()): number {
  const vietnamNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const nextMidnightVietnam = Date.UTC(
    vietnamNow.getUTCFullYear(),
    vietnamNow.getUTCMonth(),
    vietnamNow.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(1_000, nextMidnightVietnam - 7 * 60 * 60 * 1000 - now.getTime());
}

async function runAndSchedule(): Promise<void> {
  if (!started) return;
  const startedAt = Date.now();
  const nextRunDelay = Math.min(nextVietnameseMidnightDelay(), 60_000);
  try {
    await closeExpiredRetailPosSessions();
  } catch (error) {
    console.error("[retail-pos-session-scheduler] Failed to close expired sessions", error);
  }

  if (!started) return;
  timer = setTimeout(() => void runAndSchedule(), Math.max(1_000, nextRunDelay - (Date.now() - startedAt)));
  timer.unref?.();
}

export function startRetailPosSessionScheduler(): void {
  if (started) return;
  started = true;
  void runAndSchedule();
}

export function stopRetailPosSessionScheduler(): void {
  started = false;
  if (timer) clearTimeout(timer);
  timer = undefined;
}
