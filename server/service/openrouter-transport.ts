import { ProxyAgent } from 'undici';

let cachedProxy: { url: string; agent: ProxyAgent } | undefined;

/** Optional per-request route; TLS remains verified and other services keep their own transport. */
export function fetchOpenRouter(url: string, init: RequestInit): Promise<Response> {
  const proxyUrl = process.env.OPENROUTER_PROXY_URL?.trim();
  if (!proxyUrl) {
    if (cachedProxy) {
      void cachedProxy.agent.close().catch(() => {});
      cachedProxy = undefined;
    }
    return fetch(url, init);
  }
  let parsed: URL;
  try {
    parsed = new URL(proxyUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch {
    throw new Error('OPENROUTER_PROXY_URL phải là địa chỉ HTTP hoặc HTTPS hợp lệ.');
  }
  if (cachedProxy?.url !== proxyUrl) {
    const previous = cachedProxy;
    try { cachedProxy = { url: proxyUrl, agent: new ProxyAgent(proxyUrl) }; }
    catch { throw new Error('Chưa khởi tạo được proxy OpenRouter. Kiểm tra cấu hình proxy.'); }
    if (previous) void previous.agent.close().catch(() => {});
  }
  const options: RequestInit & { dispatcher: ProxyAgent } = { ...init, dispatcher: cachedProxy.agent };
  return fetch(url, options);
}
