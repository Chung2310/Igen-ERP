type Channel = "facebook" | "zalo" | "tiktok" | undefined;

/** Zalo reconciles native OA sends even with a healthy socket: that socket only
 * relays events already received by ERP, not events missing from Zalo webhooks. */
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
    if (connected && options.channel !== "zalo") return;
    pending = true;
    try {
      // Facebook Graph synchronization is explicit/on reconnect, never a permanent polling loop.
      await options.refresh(options.channel !== "facebook");
    } catch (error) {
      options.onError(error);
    } finally {
      pending = false;
    }
  }, options.channel === "facebook" || options.channel === "zalo" ? 15000 : 60000);
  return () => clearInterval(timer);
}
