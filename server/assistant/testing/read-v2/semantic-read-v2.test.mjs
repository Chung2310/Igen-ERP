import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { ERP_LLM_MODEL } from '../../../../shared/llm-model.ts';
import { interpretProductReadV2 } from '../../semantic-read-v2.ts';
import { withAssistantExecution } from '../../execution-control.ts';
import { PlanCancelledError, PlanStoppedError } from '../../execution-budget.ts';

const dto = { schemaVersion: 2, inputRef: 'input_fixture', contextRef: 'ctx_fixture', text: 'Tìm SP-MAY-A1', entities: [] };
const output = { schemaVersion: 2, intentType: 'workflow', proposal: { actionId: 'product.list', values: { search: { raw: 'SP-MAY-A1', source: 'utterance', evidence: { kind: 'text_quote', inputRef: dto.inputRef, quote: 'SP-MAY-A1' } } } }, cancel: false, newRequest: false };
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('ASSISTANT_SAFE_EXECUTION', 'true'); vi.stubEnv('OPENROUTER_API_KEY', 'fixture-only-key');
  vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {});
  globalThis.__layerBProductSafety.violations.length = 0;
});
afterEach(() => {
  expect(globalThis.__layerBProductSafety.violations).toEqual([]);
  vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.mocked(console.log).mockRestore(); vi.mocked(console.warn).mockRestore();
});
const controlled = work => withAssistantExecution({ deadlineAt: Date.now() + 90_000 }, work);
it('uses the actual Luna provider wire contract with JSON mode and bounded output, without legacy context', async () => {
  const transport = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify(output) } }] }));
  vi.stubGlobal('fetch', transport);
  expect(await controlled(() => interpretProductReadV2(dto))).toEqual(output);
  expect(transport).toHaveBeenCalledTimes(1);
  const [url, init] = transport.mock.calls[0], body = JSON.parse(init.body);
  expect(url).toBe('https://openrouter.ai/api/v1/chat/completions'); expect(body.model).toBe(ERP_LLM_MODEL);
  expect(body.response_format).toEqual({ type: 'json_object' }); expect(body.max_tokens).toBe(2048); expect(body).not.toHaveProperty('temperature');
  expect(JSON.parse(body.messages[1].content)).toEqual(dto); expect(init.signal).toBeInstanceOf(AbortSignal);
});
it.each(['extra-values', 'extra-evidence', 'wrong-shape', 'model-provenance'])('validates native model response: %s', async mode => {
  const response = structuredClone(output);
  if (mode === 'extra-values') response.proposal.values.companyCode = 'invented';
  if (mode === 'extra-evidence') response.proposal.values.search.evidence.start = 0;
  if (mode === 'wrong-shape') response.proposal.values.search = 'SP-MAY-A1';
  if (mode === 'model-provenance') response.provenance = { source: 'server_default' };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify(response) } }] })));
  await expect(controlled(() => interpretProductReadV2(dto))).rejects.toThrow('không hợp lệ');
});
it.each(['cancel', 'timeout'])('aborts the actual native provider fetch on %s, with no retry after stop', async mode => {
  vi.useFakeTimers(); const controller = new AbortController(); let actualSignal;
  const transport = vi.fn((_url, init) => { actualSignal = init.signal; return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })); });
  vi.stubGlobal('fetch', transport);
  try {
    const result = expect(withAssistantExecution({ deadlineAt: Date.now() + 100, signal: controller.signal }, () => interpretProductReadV2(dto)))
      .rejects.toBeInstanceOf(mode === 'cancel' ? PlanCancelledError : PlanStoppedError);
    await vi.advanceTimersByTimeAsync(mode === 'cancel' ? 1 : 100); if (mode === 'cancel') controller.abort(); await result;
    expect(actualSignal.aborted).toBe(true); expect(transport).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
});
