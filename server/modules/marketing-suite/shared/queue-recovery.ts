/** Serialize periodic recovery, and stop it with the owning worker. */
export function startQueueRecovery(recover: () => Promise<unknown>, intervalMs = 30_000) {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    void recover().catch(error => console.error("[Marketing queue recovery]", error))
      .finally(() => { running = false; });
  }, intervalMs);
  timer.unref();
  queueRecoveryTimers.add(timer);
  return timer;
}

const queueRecoveryTimers = new Set<ReturnType<typeof setInterval>>();
export function stopQueueRecovery() {
  for (const timer of queueRecoveryTimers) clearInterval(timer);
  queueRecoveryTimers.clear();
}
