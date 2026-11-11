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

it("enables bounded deep web search and returns only URL citations from the provider", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  const fetchMock = vi.fn().mockResolvedValue(Response.json({
    model: "google/gemini-2.5-flash",
    choices: [{ message: {
      content: "Kết quả có nguồn.",
      annotations: [{ type: "url_citation", url_citation: { title: "Tài liệu nghiên cứu", url: "https://example.com/study" } }],
    } }],
  }));
  vi.stubGlobal("fetch", fetchMock);

  const response = await openrouterChat({ model: "google/gemini-2.5-flash", webSearch: true, maxRetries: 1, messages: [{ role: "user", content: "Tìm hiểu chủ đề này." }] });
  const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));

  expect(body.tool_choice).toBe("required");
  expect(body.tools).toEqual([{ type: "openrouter:web_search", parameters: expect.objectContaining({ engine: "exa", mode: "deep", max_uses: 4, max_total_results: 20 }) }]);
  expect(body.plugins).toBeUndefined();
  expect(response).toEqual({ text: "Kết quả có nguồn.", citations: [{ title: "Tài liệu nghiên cứu", url: "https://example.com/study" }] });
});

it("uses fast web search when a response only needs current price data", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: "Đã tra cứu." } }] }));
  vi.stubGlobal("fetch", fetchMock);

  await openrouterChat({ model: "google/gemini-2.5-flash", webSearch: true, webSearchMode: "fast", maxRetries: 1, messages: [{ role: "user", content: "Giá vàng hôm nay" }] });

  const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
  expect(body.tools[0].parameters).toMatchObject({ engine: "exa", mode: "fast", max_uses: 4 });
});
