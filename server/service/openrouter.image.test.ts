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

it("uses default image model at low quality through OpenRouter Images API by default", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: [{ b64_json: "YQ==", media_type: "image/png" }] }));
  vi.stubGlobal("fetch", fetchMock);
  const result = await openrouterGenerateImage({ prompt: "Một khu vườn", aspectRatio: "16:9", allowFallback: false });
  expect(result.url).toBe("data:image/png;base64,YQ==");
  const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("https://openrouter.ai/api/v1/images");
  expect(JSON.parse(String(options.body))).toEqual({ model: "google/gemini-3.1-flash-lite-image", prompt: "Một khu vườn", aspect_ratio: "16:9", quality: "low" });
});

it("does not switch to a different model when default image model fails", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("unavailable", { status: 503 })));
  vi.stubGlobal("fetch", fetchMock);
  await expect(openrouterGenerateImage({ prompt: "Một khu vườn" })).rejects.toThrow("Images API lỗi 503");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("uses an image-capable model when a reference is provided", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { images: [{ image_url: { url: "data:image/png;base64,Yg==" } }] } }] }));
  vi.stubGlobal("fetch", fetchMock);
  await openrouterGenerateImage({ prompt: "Đổi màu nền", model: "recraft/recraft-v4.1-flash", referenceImages: ["data:image/png;base64,YQ=="], allowFallback: false });
  const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
  expect(JSON.parse(String(options.body)).model).toBe("google/gemini-3.1-flash-image");
});

it("requests a transparent PNG edit with the source image through the Images API", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: [{ b64_json: "Yg==", media_type: "image/png" }] }));
  vi.stubGlobal("fetch", fetchMock);
  const result = await openrouterGenerateImage({
    prompt: "Tách nền và giữ nguyên chủ thể",
    background: "transparent",
    outputFormat: "png",
    quality: "medium",
    referenceImages: ["data:image/png;base64,YQ=="],
    preserveInputAspectRatio: true,
    allowFallback: false,
  });
  expect(result.url).toBe("data:image/png;base64,Yg==");
  const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("https://openrouter.ai/api/v1/images");
  expect(JSON.parse(String(options.body))).toEqual({
    model: "openai/gpt-image-2.6-flare",
    prompt: "Tách nền và giữ nguyên chủ thể",
    aspect_ratio: "auto",
    quality: "medium",
    background: "transparent",
    output_format: "png",
    input_references: [{ type: "image_url", image_url: { url: "data:image/png;base64,YQ==" } }],
  });
});
