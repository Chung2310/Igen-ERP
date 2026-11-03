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
  let lastChannelSyncAt = Date.now();
  const timer = setInterval(async () => {
    if (pending || !options.isVisible()) return;
    const connected = options.isSocketConnected();
    if (connected && options.channel !== "facebook") return;
    pending = true;
    try {
      // DB polling cannot recover a reply that reached Facebook but was never stored locally.
      const syncChannel = !connected || (options.channel === "facebook" && Date.now() - lastChannelSyncAt >= 60000);
      await options.refresh(syncChannel);
      if (syncChannel) lastChannelSyncAt = Date.now();
    } catch (error) {
      options.onError(error);
    } finally {
      pending = false;
    }
  }, options.channel === "facebook" ? 15000 : 60000);
  return () => clearInterval(timer);
}
