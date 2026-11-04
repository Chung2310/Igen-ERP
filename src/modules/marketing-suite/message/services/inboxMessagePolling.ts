type Channel = "facebook" | "zalo" | "tiktok" | undefined;

/** Read DB as a fallback until the selected account's realtime subscription is confirmed. */
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
      // Facebook Graph synchronization is explicit/on reconnect, never a permanent polling loop.
      await options.refresh(options.channel !== "facebook");
    } catch (error) {
      options.onError(error);
    } finally {
      pending = false;
    }
  }, options.channel === "facebook" ? 15000 : 60000);
  return () => clearInterval(timer);
}
