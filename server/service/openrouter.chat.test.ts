import { afterEach, expect, it, vi } from "vitest";
import { openrouterChat } from "./openrouter.service";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("uses the task-specific Qwen fallback after the free prompt model runs out of requests", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
    .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "Prompt đã chuẩn hoá" } }] }));
  vi.stubGlobal("fetch", fetchMock);

  const response = await openrouterChat({
    model: "google/gemma-4-31b-it:free",
    fallbackModel: "qwen/qwen3.5-flash-02-23",
    maxRetries: 1,
    messages: [{ role: "user", content: "Cảnh buổi sáng" }],
  });

  expect(response.text).toBe("Prompt đã chuẩn hoá");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).model).toBe("google/gemma-4-31b-it:free");
  expect(JSON.parse(String(fetchMock.mock.calls[1][1].body)).model).toBe("qwen/qwen3.5-flash-02-23");
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
