import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {openrouterChat} from './openrouter.service';
import {withProviderAttemptTimeout} from './openrouter-transport';
import {withAssistantInterpretationControl} from '../assistant/execution-control';
beforeEach(()=>{vi.useFakeTimers();vi.stubEnv('OPENROUTER_API_KEY','qa-fixture');vi.stubEnv('OPENROUTER_PROXY_URL','');});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('fails over when a relay body never resolves and ignores abort, without losing the turn',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:()=>new Promise(()=>{})}).mockResolvedValueOnce(Response.json({choices:[{message:{content:'QA fallback result'}}]}));vi.stubGlobal('fetch',fetcher);
 const promise=withAssistantInterpretationControl(()=>openrouterChat({model:'openai/gpt-6-luna',timeoutMs:1000,maxRetries:1,messages:[{role:'user',content:'QA'}]}),5000);
 const checked=expect(promise).resolves.toMatchObject({text:'QA fallback result'});
 await vi.advanceTimersByTimeAsync(500);await checked;
 expect(fetcher.mock.calls.map(([,init]:any)=>JSON.parse(init.body).model)).toEqual(['openai/gpt-6-luna','anthropic/claude-haiku-5.5']);expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);expect(vi.getTimerCount()).toBe(0);
});
it('bounds calls even without an assistant frame and with fallback disabled',async()=>{
 const fetcher=vi.fn(()=>new Promise(()=>{}));vi.stubGlobal('fetch',fetcher);
 const promise=openrouterChat({model:'openai/gpt-6-luna',allowFallback:false,timeoutMs:1000,maxRetries:1,messages:[{role:'user',content:'QA'}]});
 const checked=expect(promise).rejects.toMatchObject({name:'TimeoutError'});await vi.advanceTimersByTimeAsync(1000);await checked;expect(fetcher).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});
it('preserves cancellation and cleans up a provider attempt without waiting for a hung relay',async()=>{
 const abort=new AbortController(),reason=new Error('QA cancelled');
 const promise=withProviderAttemptTimeout(1000,abort.signal,()=>new Promise(()=>{})),checked=expect(promise).rejects.toBe(reason);abort.abort(reason);await checked;expect(vi.getTimerCount()).toBe(0);
});
it('does not sleep beyond the shared call deadline when a retry cannot fit',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response('retry',{status:429}));vi.stubGlobal('fetch',fetcher);
 await expect(openrouterChat({model:'openai/gpt-6-luna',allowFallback:false,timeoutMs:500,maxRetries:3,messages:[{role:'user',content:'QA'}]})).rejects.toMatchObject({name:'TimeoutError'});expect(fetcher).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});
