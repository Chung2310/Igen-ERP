import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { downloadArchitectureVideo, getArchitectureVideoStatus, startArchitectureVideo } from "./openrouter-video.service";

const providerFetch = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key");
  vi.stubGlobal("fetch", providerFetch);
  providerFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("starts a fixed-model image-to-video task through OpenRouter", async () => {
  providerFetch.mockResolvedValueOnce(Response.json({ id: "video-job-1", status: "pending" }, { status: 202 }));
  const result = await startArchitectureVideo({
    model: "google/veo-3.1",
    prompt: "Camera moves slowly through a house",
    aspectRatio: "16:9",
    duration: 4,
    resolution: "720p",
    generateAudio: false,
    referenceImage: "data:image/jpeg;base64,aGVsbG8=",
  });

  expect(result).toEqual({ id: "video-job-1", status: "pending" });
  expect(providerFetch).toHaveBeenCalledWith("https://openrouter.ai/api/v1/videos", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({
      model: "google/veo-3.1",
      prompt: "Camera moves slowly through a house",
      duration: 4,
      resolution: "720p",
      aspect_ratio: "16:9",
      generate_audio: false,
      frame_images: [{ type: "image_url", image_url: { url: "data:image/jpeg;base64,aGVsbG8=" }, frame_type: "first_frame" }],
    }),
  }));
});

it("polls a job and only downloads content from the OpenRouter video path", async () => {
  providerFetch.mockResolvedValueOnce(Response.json({
    status: "completed",
    unsigned_urls: ["https://openrouter.ai/api/v1/videos/video-job-1/content?index=0"],
  }));
  providerFetch.mockResolvedValueOnce(new Response(Buffer.from("video"), { headers: { "content-type": "video/mp4" } }));

  const status = await getArchitectureVideoStatus("video-job-1");
  const bytes = await downloadArchitectureVideo(status.contentUrl);

  expect(status.status).toBe("completed");
  expect(bytes.toString()).toBe("video");
  expect(providerFetch.mock.calls[0][0]).toBe("https://openrouter.ai/api/v1/videos/video-job-1");
  expect(new URL(String(providerFetch.mock.calls[1][0])).href).toBe(status.contentUrl);
});

it("rejects video download URLs outside OpenRouter", async () => {
  await expect(downloadArchitectureVideo("https://example.com/file.mp4")).rejects.toThrow("đường dẫn video không hợp lệ");
  expect(providerFetch).not.toHaveBeenCalled();
});
