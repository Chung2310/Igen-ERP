import { afterEach, expect, it, vi } from "vitest";
import { openrouterChat, openRouterConfigurationDiagnostics } from "./openrouter.service";
import { AI_PROVIDER_TEMPORARY_ERROR } from "../../src/shared/ai-provider-error";
import { ERP_LLM_MODEL, ERP_LLM_FALLBACK_MODEL, llmSamplingParameters } from '../../shared/llm-model';
import { withAssistantExecution } from '../assistant/execution-control';
import { PlanCancelledError } from '../assistant/execution-budget';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('identifies the currently loaded credential without exposing it or making a request', () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('OPENROUTER_API_KEY', 'fixture-secret-first');
  const first = openRouterConfigurationDiagnostics();
  expect(first.configured).toBe(true);
  expect(first.keyFingerprint).toMatch(/^[a-f0-9]{16}$/);
  expect(JSON.stringify(first)).not.toContain('fixture-secret');
  expect(first.processId).toBe(process.pid);
  vi.stubEnv('OPENROUTER_API_KEY', 'fixture-secret-second');
  expect(openRouterConfigurationDiagnostics().keyFingerprint).not.toBe(first.keyFingerprint);
  vi.stubEnv('OPENROUTER_API_KEY', '');
  expect(openRouterConfigurationDiagnostics()).toMatchObject({ configured: false, keyFingerprint: null });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("pins language calls to GPT-6 Luna despite legacy primary/fallback model settings", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_FALLBACK_MODEL", "qwen/qwen3.6-flash");
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "Prompt đã chuẩn hoá" } }] }));
  vi.stubGlobal("fetch", fetchMock);

  const response = await openrouterChat({
    model: "google/gemma-4-31b-it:free",
    fallbackModel: "qwen/qwen3.5-flash-02-23",
    maxRetries: 1,
    messages: [{ role: "user", content: "Cảnh buổi sáng" }],
  });

  expect(response.text).toBe("Prompt đã chuẩn hoá");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).model).toBe(ERP_LLM_MODEL);
  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).not.toHaveProperty("temperature");
});

it('omits unsupported sampling on Haiku 5.5 and preserves compatibility for other models', () => {
  expect(ERP_LLM_MODEL).toBe('openai/gpt-6-luna');
  expect(ERP_LLM_FALLBACK_MODEL).toBe('anthropic/claude-haiku-5.5');
  expect(llmSamplingParameters(ERP_LLM_MODEL, 0.7)).toEqual({});
  expect(llmSamplingParameters('openai/gpt-6-luna', 0.7)).toEqual({});
  expect(llmSamplingParameters('anthropic/claude-haiku-4.5', 0.2)).toEqual({ temperature: 0.2 });
});

it.each([404, 429, 500, 502, 503, 504])('fails over once to Haiku after HTTP %s, preserving the request', async status => {
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response('unavailable', { status }))
    .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: '{"ok":true}' } }] }));
  vi.stubGlobal('fetch', fetchMock);
  expect((await openrouterChat({ model: 'legacy/model', maxRetries: 4, jsonMode: true, maxTokens: 500, messages: [{ role: 'user', content: 'fixture' }] })).text).toBe('{"ok":true}');
  const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init.body)));
  expect(bodies.map(body => body.model)).toEqual([ERP_LLM_MODEL, ERP_LLM_FALLBACK_MODEL]);
  expect(bodies[1]).toEqual({ ...bodies[0], model: ERP_LLM_FALLBACK_MODEL });
  expect(new Headers(fetchMock.mock.calls[1][1].headers).get('Authorization')).toBe('Bearer test-key');
});

it.each([400, 401, 402, 403])('does not fail over for permanent HTTP %s', async status => {
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  const fetchMock = vi.fn().mockResolvedValue(new Response('bad input or access', { status }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(openrouterChat({ model: ERP_LLM_MODEL, maxRetries: 1, messages: [{ role: 'user', content: 'fixture' }] })).rejects.toThrow();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('stops after the one backup attempt if both models fail', async () => {
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
  vi.stubGlobal('fetch', fetchMock);
  await expect(openrouterChat({ model: ERP_LLM_MODEL, maxRetries: 4, messages: [{ role: 'user', content: 'fixture' }] })).rejects.toThrow('fetch failed');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('does not fall back after the user cancels the assistant turn', async () => {
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  vi.stubEnv('ASSISTANT_SAFE_EXECUTION', 'true');
  const cancellation = new AbortController();
  const fetchMock = vi.fn(async () => { cancellation.abort(); return new Response('unavailable', { status: 503 }); });
  vi.stubGlobal('fetch', fetchMock);
  await expect(withAssistantExecution({ deadlineAt: Date.now() + 10000, signal: cancellation.signal }, () => openrouterChat({
    model: ERP_LLM_MODEL, maxRetries: 1, messages: [{ role: 'user', content: 'fixture' }],
  }))).rejects.toBeInstanceOf(PlanCancelledError);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("sets the requested output cap when a caller provides one", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: "ok" } }] }));
  vi.stubGlobal("fetch", fetchMock);

  await openrouterChat({
    model: "google/gemini-2.5-flash",
    maxRetries: 1,
    maxTokens: 4096,
    messages: [{ role: "user", content: "Return one short JSON object" }],
  });

  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).max_tokens).toBe(4096);
});

it("uses an environment output cap when the request does not set one", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_MAX_TOKENS", "3072");
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: "ok" } }] }));
  vi.stubGlobal("fetch", fetchMock);

  await openrouterChat({ model: "google/gemini-2.5-flash", maxRetries: 1, messages: [{ role: "user", content: "Return JSON" }] });

  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).max_tokens).toBe(3072);
});

it("logs the safe OpenRouter 402 limit reason without exposing credentials", async () => {
  const apiKey = "sk-or-v1-local-test-secret";
  vi.stubEnv("OPENROUTER_API_KEY", apiKey);
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: {
    code: 402,
    message: `Key spend limit reached; token ${apiKey}`,
    metadata: { limit_source: "openrouter_key_limit", provider_name: "OpenRouter", key: apiKey },
  } }, { status: 402 }));
  vi.stubGlobal("fetch", fetchMock);
  const log = vi.spyOn(console, "warn").mockImplementation(() => {});

  try {
    await expect(openrouterChat({
      model: "openai/gpt-6-luna",
      maxRetries: 3,
      messages: [{ role: "user", content: "Return JSON" }],
    })).rejects.toThrow(AI_PROVIDER_TEMPORARY_ERROR);

    const diagnostic = String(log.mock.calls[0]?.[0] || "");
    expect(diagnostic).toContain("limit_source=openrouter_key_limit");
    expect(diagnostic).toContain("detail=Key spend limit reached; token [redacted]");
    expect(diagnostic).not.toContain(apiKey);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  } finally {
    log.mockRestore();
  }
});

it("retries an OpenRouter in-flight budget 402 using Retry-After", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ error: {
      code: 402,
      message: "In-flight budget exceeded",
      metadata: { limit_source: "openrouter_in_flight_budget" },
    } }, { status: 402, headers: { "retry-after": "0" } }))
    .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "ok" } }] }));
  vi.stubGlobal("fetch", fetchMock);
  const log = vi.spyOn(console, "warn").mockImplementation(() => {});

  try {
    const result = await openrouterChat({
      model: "openai/gpt-6-luna",
      maxRetries: 2,
      messages: [{ role: "user", content: "Return JSON" }],
    });

    expect(result.text).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  } finally {
    log.mockRestore();
  }
});

it("keeps the requested OpenRouter model when fallback is disabled", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_FALLBACK_MODEL", "qwen/qwen3.6-flash");
  vi.stubEnv("FREELLM_API_URL", "https://freellm.example.test/v1");
  vi.stubEnv("FREELLM_API_KEY", "local-key");
  const fetchMock = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
  vi.stubGlobal("fetch", fetchMock);

  await expect(openrouterChat({
    model: "openai/gpt-6-luna",
    allowFallback: false,
    maxRetries: 1,
    messages: [{ role: "user", content: "Return a floor plan" }],
  })).rejects.toThrow();

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).model).toBe(ERP_LLM_MODEL);
});

it("requires an OpenRouter key instead of switching to FreeLLM when fallback is disabled", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "");
  vi.stubEnv("FREELLM_API_URL", "https://freellm.example.test/v1");
  vi.stubEnv("FREELLM_API_KEY", "local-key");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  await expect(openrouterChat({
    model: "openai/gpt-6-luna",
    allowFallback: false,
    messages: [{ role: "user", content: "Return a floor plan" }],
  })).rejects.toThrow("OPENROUTER_API_KEY");

  expect(fetchMock).not.toHaveBeenCalled();
});
