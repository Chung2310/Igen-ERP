import { ProxyAgent } from 'undici';

let cachedProxy: { url: string; agent: ProxyAgent } | undefined;

/** Race connection and body decoding even if a relay ignores abort. A local
 * attempt timeout leaves the assistant turn available for model failover. */
export async function withProviderAttemptTimeout<T>(timeoutMs:number,parent:AbortSignal|undefined,work:(signal:AbortSignal)=>Promise<T>):Promise<T>{
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new Error('Thời hạn gọi AI không hợp lệ.');
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 let onAbort:()=>void=()=>{};
 const stopped=new Promise<never>((_resolve,reject)=>{
  onAbort=()=>{const error=parent?.reason||new DOMException('Đã hủy yêu cầu.','AbortError');controller.abort(error);reject(error);};
  parent?.addEventListener('abort',onAbort,{once:true});
  timer=setTimeout(()=>{const error=new DOMException('Dịch vụ AI phản hồi quá lâu.','TimeoutError');controller.abort(error);reject(error);},timeoutMs);
  if(parent?.aborted)onAbort();
 });
 try{return await Promise.race([stopped,Promise.resolve().then(()=>{if(controller.signal.aborted)throw controller.signal.reason;return work(controller.signal);})]);}
 finally{if(timer)clearTimeout(timer);parent?.removeEventListener('abort',onAbort);}
}

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
