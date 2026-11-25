import { EventEmitter } from 'node:events';
import { ERP_LLM_MODEL } from '../../../../shared/llm-model.ts';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { withAssistantExecution, withAssistantRequestControl, withAssistantResponseCancellation } from '../../execution-control.ts';
import { PlanCancelledError, PlanStoppedError } from '../../execution-budget.ts';
import { openrouterChat } from '../../../service/openrouter.service.ts';
import { interpretRequest } from '../../semantic-interpreter.ts';
import { ASSISTANT_OPERATIONS, defaultWorkflow } from '../../catalog.ts';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('ASSISTANT_SAFE_EXECUTION', 'true');
  vi.stubEnv('OPENROUTER_API_KEY', 'fixture-only-not-a-real-key');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  globalThis.__layerBProductSafety.violations.length = 0;
});
afterEach(() => {
  expect(globalThis.__layerBProductSafety.violations).toEqual([]);
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.mocked(console.log).mockRestore();
  vi.mocked(console.warn).mockRestore();
});
const frame = (work, overrides = {}) => withAssistantExecution({ deadlineAt: Date.now() + 90_000, ...overrides }, work);
const hang = vi.fn(signal => new Promise((_resolve, reject) => {
  signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
}));
// This suite isolates same-model retry/control; the provider suite covers the
// default Luna → Haiku failover and cancellation during failover.
const chat = (extra = {}) => openrouterChat({ messages: [{ role: 'user', content: 'fixture' }], allowFallback: false, maxRetries: 3, ...extra });
const hangingFetch = () => {
  const signals = [];
  const transport = vi.fn((_url, init) => { signals.push(init.signal); return hang(init.signal); });
  vi.stubGlobal('fetch', transport);
  return { signals, transport };
};

it('aborts the native provider request at its timeout and forbids later retries in that turn', async () => {
  const { signals, transport } = hangingFetch();
  const result = frame(async () => {
    await expect(chat({ timeoutMs: 100 })).rejects.toBeInstanceOf(PlanStoppedError);
    await expect(chat()).rejects.toBeInstanceOf(PlanStoppedError);
  });
  await vi.advanceTimersByTimeAsync(100);
  await result;
  expect(transport).toHaveBeenCalledTimes(1);
  expect(signals[0].aborted).toBe(true);
});

it('holds the same turn deadline across successive provider calls', async () => {
  let signal;
  const transport = vi.fn().mockImplementationOnce(async () => {
    await new Promise(resolve => setTimeout(resolve, 60));
    return Response.json({ choices: [{ message: { content: 'ok' } }] });
  }).mockImplementation((_url, init) => { signal = init.signal; return hang(signal); });
  vi.stubGlobal('fetch', transport);
  const result = frame(async () => {
    expect((await chat()).text).toBe('ok');
    await expect(chat()).rejects.toBeInstanceOf(PlanStoppedError);
  }, { deadlineAt: Date.now() + 100 });
  await vi.advanceTimersByTimeAsync(100);
  await result;
  expect(transport).toHaveBeenCalledTimes(2);
  expect(signal.aborted).toBe(true);
});

it('aborts while the response body is still streaming', async () => {
  let bodyCancelled = false;
  vi.stubGlobal('fetch', vi.fn((_url, init) => {
    init.signal.addEventListener('abort', () => { bodyCancelled = true; });
    return Promise.resolve({ ok: true, json: () => hang(init.signal) });
  }));
  const result = frame(() => expect(chat({ timeoutMs: 50 })).rejects.toBeInstanceOf(PlanStoppedError));
  await vi.advanceTimersByTimeAsync(50);
  await result;
  expect(bodyCancelled).toBe(true);
});

it('cancels a provider call and its parent request-control scope together', async () => {
  const { signals, transport } = hangingFetch();
  const result = frame(() => expect(withAssistantRequestControl(50, () => chat())).rejects.toBeInstanceOf(PlanStoppedError));
  await vi.advanceTimersByTimeAsync(50);
  await result;
  expect(transport).toHaveBeenCalledTimes(1);
  expect(signals[0].aborted).toBe(true);
});

it('does not start discovery fallback or interpretation after a discovery deadline', async () => {
  const { transport, signals } = hangingFetch();
  const workflows = ASSISTANT_OPERATIONS.filter(op => !op.unavailableReason).map(defaultWorkflow);
  const result = frame(() => expect(interpretRequest('fixture tìm sản phẩm', workflows, null, [])).rejects.toBeInstanceOf(PlanStoppedError), { deadlineAt: Date.now() + 20_000 });
  await vi.advanceTimersByTimeAsync(20_000);
  await result;
  expect(transport).toHaveBeenCalledTimes(1);
  expect(signals[0].aborted).toBe(true);
});

it('aborts native transport on a caller signal without waiting for its timeout', async () => {
  const controller = new AbortController();
  const { transport, signals } = hangingFetch();
  const result = frame(() => expect(chat()).rejects.toBeInstanceOf(PlanCancelledError), { signal: controller.signal });
  await vi.advanceTimersByTimeAsync(1);
  controller.abort();
  await result;
  expect(transport).toHaveBeenCalledTimes(1);
  expect(signals[0].aborted).toBe(true);
});

it('polls job cancellation, aborts in flight, and cleans up polling', async () => {
  let cancelled = false;
  const { signals } = hangingFetch();
  const result = frame(() => expect(chat()).rejects.toBeInstanceOf(PlanCancelledError), { cancelled: async () => cancelled });
  await vi.advanceTimersByTimeAsync(1);
  cancelled = true;
  await vi.advanceTimersByTimeAsync(250);
  await result;
  expect(signals[0].aborted).toBe(true);
});

it('cancellation-check failure fails closed before transport', async () => {
  const { transport } = hangingFetch();
  await frame(() => expect(chat()).rejects.toThrow('Chưa kiểm tra được trạng thái hủy'), { cancelled: async () => { throw new Error('DB fixture'); } });
  expect(transport).not.toHaveBeenCalled();
});

it('cancellation aborts retry backoff and prevents the second provider attempt', async () => {
  const controller = new AbortController();
  const transport = vi.fn().mockResolvedValue(Response.json({ message: 'fixture' }, { status: 503 }));
  vi.stubGlobal('fetch', transport);
  const result = frame(() => expect(chat()).rejects.toBeInstanceOf(PlanCancelledError), { signal: controller.signal });
  await vi.advanceTimersByTimeAsync(100);
  controller.abort();
  await result;
  expect(transport).toHaveBeenCalledTimes(1);
});

it('keeps bounded same-model recovery when the deadline is still valid', async () => {
  const transport = vi.fn().mockResolvedValueOnce(Response.json({}, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: 'ok' } }] }));
  vi.stubGlobal('fetch', transport);
  const result = frame(() => chat());
  await vi.advanceTimersByTimeAsync(1000);
  expect((await result).text).toBe('ok');
  expect(transport).toHaveBeenCalledTimes(2);
  expect(transport.mock.calls.map(([_url, init]) => JSON.parse(init.body).model)).toEqual([ERP_LLM_MODEL, ERP_LLM_MODEL]);
});

it.each(['false', 'production', 'outside-assistant-context'])('keeps transport legacy when control is disabled: %s', async mode => {
  if (mode === 'false') vi.stubEnv('ASSISTANT_SAFE_EXECUTION', 'false');
  if (mode === 'production') vi.stubEnv('NODE_ENV', 'production');
  const transport = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: 'ok' } }] }));
  vi.stubGlobal('fetch', transport);
  if (mode === 'outside-assistant-context') await chat();
  else await frame(() => chat(), { deadlineAt: Date.now() - 1 });
  expect(transport.mock.calls[0][1].signal).toBeUndefined();
});

it.each(['expired', 'aborted', 'invalid-deadline', 'invalid-timeout'])('rejects before transport for %s', async mode => {
  const controller = new AbortController();
  controller.abort();
  const { transport } = hangingFetch();
  await expect(frame(() => chat({ timeoutMs: mode === 'invalid-timeout' ? NaN : 100 }), {
    deadlineAt: mode === 'expired' ? Date.now() - 1 : mode === 'invalid-deadline' ? NaN : Date.now() + 100,
    signal: mode === 'aborted' ? controller.signal : undefined,
  })).rejects.toThrow();
  expect(transport).not.toHaveBeenCalled();
});

it('does not let a late cancellation-poll result alter a completed request', async () => {
  let resolvePoll;
  let checks = 0;
  let finish;
  const result = frame(async () => {
    await withAssistantRequestControl(1000, () => new Promise(resolve => { finish = resolve; }));
    resolvePoll(true);
    await Promise.resolve();
    return withAssistantRequestControl(1000, async () => 'still-active');
  }, { cancelled: () => ++checks === 2 ? new Promise(resolve => { resolvePoll = resolve; }) : Promise.resolve(false) });
  await vi.advanceTimersByTimeAsync(250);
  finish();
  expect(await result).toBe('still-active');
});

it.each([false, true])('binds disconnect signal and removes listener, normal completion=%s', async completed => {
  const response = Object.assign(new EventEmitter(), { writableEnded: false });
  let actualSignal;
  await withAssistantResponseCancellation(response, async signal => {
    actualSignal = signal;
    response.writableEnded = completed;
    response.emit('close');
    expect(signal.aborted).toBe(!completed);
  });
  expect(response.listenerCount('close')).toBe(0);
  expect(actualSignal.aborted).toBe(!completed);
});

it('removes the response listener on failure and honors flag-off', async () => {
  const response = Object.assign(new EventEmitter(), { writableEnded: false });
  await expect(withAssistantResponseCancellation(response, async () => { throw new Error('fixture'); })).rejects.toThrow('fixture');
  expect(response.listenerCount('close')).toBe(0);
  vi.stubEnv('ASSISTANT_SAFE_EXECUTION', 'false');
  await withAssistantResponseCancellation(response, async signal => expect(signal).toBeUndefined());
});

it('isolates simultaneous turns when one is cancelled', async () => {
  const controller = new AbortController();
  const cancelled = frame(() => expect(withAssistantRequestControl(1000, signal => hang(signal))).rejects.toBeInstanceOf(PlanCancelledError), { signal: controller.signal });
  const unaffected = frame(async () => {
    await new Promise(resolve => setTimeout(resolve, 5));
    return withAssistantRequestControl(100, async () => 'ok');
  });
  await vi.advanceTimersByTimeAsync(1);
  controller.abort();
  await vi.advanceTimersByTimeAsync(5);
  await cancelled;
  expect(await unaffected).toBe('ok');
});

it('rechecks the deadline after awaiting a slow cancellation check', async () => {
  const { transport } = hangingFetch();
  const result = frame(() => expect(chat()).rejects.toBeInstanceOf(PlanStoppedError), {
    deadlineAt: Date.now() + 100,
    cancelled: async () => { await new Promise(resolve => setTimeout(resolve, 101)); return false; },
  });
  await vi.advanceTimersByTimeAsync(101);
  await result;
  expect(transport).not.toHaveBeenCalled();
});

it('cancellation lookup failure during a request aborts native transport and does not retry', async () => {
  let checks = 0;
  const { transport, signals } = hangingFetch();
  const result = frame(() => expect(chat()).rejects.toThrow('Chưa kiểm tra được trạng thái hủy'), {
    cancelled: async () => { if (++checks >= 3) throw new Error('fixture failure'); return false; },
  });
  await vi.advanceTimersByTimeAsync(250);
  await result;
  expect(transport).toHaveBeenCalledTimes(1);
  expect(signals[0].aborted).toBe(true);
});
