type Channel = "facebook" | "zalo" | "tiktok" | undefined;

/** Realtime delivers webhook updates. Poll only the local inbox while disconnected;
 * provider history reconciliation is explicit, never a permanent polling loop. */
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
    if (connected) return;
    pending = true;
    try {
      await options.refresh(options.channel !== "facebook" && options.channel !== "zalo");
    } catch (error) {
      options.onError(error);
    } finally {
      pending = false;
    }
  }, options.channel === "facebook" ? 15000 : 60000);
  return () => clearInterval(timer);
}
