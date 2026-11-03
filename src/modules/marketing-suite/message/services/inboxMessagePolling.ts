type Channel = "facebook" | "zalo" | "tiktok" | undefined;

/** Reconcile persisted replies even if a connected socket misses a worker event. */
export function startInboxMessagePolling(options: {
  channel: Channel;
  isVisible: () => boolean;
  isSocketConnected: () => boolean;
  refresh: (syncChannel: boolean) => Promise<void>;
  onError: (error: unknown) => void;
}) {
  let pending = false;
  const timer = setInterval(async () => {
    if (pending || !options.isVisible()) return;
    const connected = options.isSocketConnected();
    if (connected && options.channel !== "facebook") return;
    pending = true;
    try {
      await options.refresh(!connected);
    } catch (error) {
      options.onError(error);
    } finally {
      pending = false;
    }
  }, options.channel === "facebook" ? 15000 : 60000);
  return () => clearInterval(timer);
}
