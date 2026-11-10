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
