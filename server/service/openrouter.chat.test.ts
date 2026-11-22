import { afterEach, expect, it, vi } from "vitest";
import { openrouterChat } from "./openrouter.service";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

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
  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).model).toBe("openai/gpt-6-luna");
  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).not.toHaveProperty("temperature");
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
  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).model).toBe("openai/gpt-6-luna");
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
