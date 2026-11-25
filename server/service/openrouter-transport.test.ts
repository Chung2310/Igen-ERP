import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({agents:[] as {url:string;close:ReturnType<typeof vi.fn>}[],requests:vi.fn()}));
vi.mock('undici',()=>({ProxyAgent:class {
  close=vi.fn(async()=>{});
  constructor(public url:string){state.agents.push(this);}
}}));
import {fetchOpenRouter} from './openrouter-transport';
const endpoint='https://openrouter.ai/api/v1/chat/completions';
beforeEach(()=>{
  state.requests.mockReset().mockResolvedValue(Response.json({ok:true}));
  vi.stubGlobal('fetch',state.requests);
  vi.stubEnv('OPENROUTER_PROXY_URL','');
});
afterEach(async()=>{
  vi.stubEnv('OPENROUTER_PROXY_URL','');
  await fetchOpenRouter(endpoint,{method:'POST'});
  vi.unstubAllEnvs();vi.unstubAllGlobals();state.agents.length=0;
});
it('keeps direct calls unchanged and never inherits the proxy of another service',async()=>{
  vi.stubEnv('HEYGEN_PROXY_URL','http://unrelated.invalid:3128');
  const init={method:'POST',headers:{Authorization:'Bearer fixture'},body:'{}'};
  await fetchOpenRouter(endpoint,init);
  expect(state.requests).toHaveBeenCalledExactlyOnceWith(endpoint,init);
  expect(state.agents).toHaveLength(0);
});
it('routes through an explicitly configured proxy without changing auth, body or cancellation',async()=>{
  vi.stubEnv('OPENROUTER_PROXY_URL','http://fixture-user:fixture-password@proxy.invalid:3128');
  const signal=new AbortController().signal;
  const init={method:'POST',headers:{Authorization:'Bearer fixture'},body:'{"model":"fixture"}',signal};
  await fetchOpenRouter(endpoint,init);
  expect(state.requests).toHaveBeenCalledExactlyOnceWith(endpoint,{...init,dispatcher:state.agents[0]});
  expect(state.agents).toHaveLength(1);
});
it('reuses an agent and closes an old route when configuration changes or returns to direct',async()=>{
  vi.stubEnv('OPENROUTER_PROXY_URL','https://proxy-one.invalid:3128');
  await fetchOpenRouter(endpoint,{method:'POST'});await fetchOpenRouter(endpoint,{method:'POST'});
  expect(state.agents).toHaveLength(1);
  vi.stubEnv('OPENROUTER_PROXY_URL','http://proxy-two.invalid:3128');
  await fetchOpenRouter(endpoint,{method:'POST'});
  expect(state.agents[0].close).toHaveBeenCalledTimes(1);
  expect(state.agents).toHaveLength(2);
  vi.stubEnv('OPENROUTER_PROXY_URL','');
  await fetchOpenRouter(endpoint,{method:'POST'});
  expect(state.agents[1].close).toHaveBeenCalledTimes(1);
  expect(state.requests.mock.calls.at(-1)?.[1]).not.toHaveProperty('dispatcher');
});
it.each(['socks5://user:password@proxy.invalid:1080','not-a-proxy'])('rejects invalid proxy settings before sending and keeps credentials out of errors: %s',async proxy=>{
  vi.stubEnv('OPENROUTER_PROXY_URL',proxy);
  expect(()=>fetchOpenRouter(endpoint,{method:'POST'})).toThrow('OPENROUTER_PROXY_URL');
  try{fetchOpenRouter(endpoint,{method:'POST'});}catch(e){expect((e as Error).message).not.toContain('password');}
  expect(state.requests).not.toHaveBeenCalled();
});
