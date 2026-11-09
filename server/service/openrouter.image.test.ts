import { afterEach, expect, it, vi } from "vitest";
import { openrouterGenerateImage } from "./openrouter.service";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("sends image_config and returns the generated image from OpenRouter", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { images: [{ image_url: { url: "data:image/png;base64,YQ==" } }] } }] }));
  vi.stubGlobal("fetch", fetchMock);
  const result = await openrouterGenerateImage({ prompt: "Một khu vườn", model: "google/gemini-3.1-flash-image", aspectRatio: "16:9", allowFallback: false });
  expect(result.url).toBe("data:image/png;base64,YQ==");
  const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
  expect(JSON.parse(String(options.body))).toMatchObject({ model: "google/gemini-3.1-flash-image", modalities: ["image", "text"], image_config: { aspect_ratio: "16:9" } });
});
