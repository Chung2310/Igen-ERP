export function createInboxRefreshQueue<Scope>(refresh: (scopes: Scope[]) => Promise<void>, delayMs = 250) {
  const pending = new Set<Scope>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let disposed = false;

  function schedule() {
    if (disposed || running || timer !== undefined || !pending.size) return;
    timer = setTimeout(async () => {
      timer = undefined;
      const scopes = [...pending];
      pending.clear();
      running = true;
      try {
        await refresh(scopes);
      } catch (error) {
        console.error("[CRM] Không thể làm mới dữ liệu:", error);
      } finally {
        running = false;
        schedule();
      }
    }, delayMs);
  }

  return {
    request(scope: Scope) {
      if (disposed) return;
      pending.add(scope);
      schedule();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      pending.clear();
    },
  };
}
