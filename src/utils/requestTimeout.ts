/** Bound read requests even when a fetch wrapper does not release an aborted request. */
export function withRequestTimeout<T>(
  request: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  message: string,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let cleanup: (() => void) | undefined;
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      controller.abort(signal?.reason);
      reject(signal?.reason ?? new DOMException('Request aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error(message));
    }, timeoutMs);
    cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    };
    if (signal?.aborted) {
      abort();
      cleanup();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(() => {
      if (controller.signal.aborted) throw controller.signal.reason;
      return request(controller.signal);
    }).then(resolve, reject);
  }).finally(() => cleanup?.());
}
