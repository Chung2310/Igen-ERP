import { afterEach, expect, it, vi } from "vitest";
import { synthesizeVietnameseSpeech } from "./speech";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("requests Vietnamese MP3 from OpenRouter with the server API key", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key");
  vi.stubEnv("OPENROUTER_TTS_VOICE", "george");
  const bytes = new Uint8Array([0x49, 0x44, 0x33, 0x01]);
  const fetcher = vi.fn().mockResolvedValue(new Response(bytes, { status: 200, headers: { "content-type": "audio/mpeg" } }));
  vi.stubGlobal("fetch", fetcher);

  const audio = await synthesizeVietnameseSpeech("  Xin chào, tôi là Igen.  ", undefined, "alice");

  expect(audio).toEqual(Buffer.from(bytes));
  expect(fetcher).toHaveBeenCalledOnce();
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe("https://openrouter.ai/api/v1/audio/speech");
  expect(init.headers.Authorization).toBe("Bearer test-openrouter-key");
  expect(JSON.parse(init.body)).toMatchObject({
    model: "elevenlabs/eleven-flash-v2.5",
    input: "Xin chào, tôi là Igen.",
    voice: "alice",
    response_format: "mp3",
    provider: { options: { elevenlabs: { language_code: "vi" } } },
  });
});

it("does not call OpenRouter without a key and rejects non-audio responses", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(synthesizeVietnameseSpeech("Xin chào")).rejects.toThrow("OpenRouter chưa được cấu hình");
  expect(fetcher).not.toHaveBeenCalled();

  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  fetcher.mockResolvedValue(new Response(JSON.stringify({ error: "unexpected" }), { status: 200, headers: { "content-type": "application/json" } }));
  await expect(synthesizeVietnameseSpeech("Xin chào")).rejects.toThrow("không trả về tệp âm thanh MP3");
});

it("passes cancellation through to the OpenRouter request", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  const fetcher = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  }));
  vi.stubGlobal("fetch", fetcher);
  const controller = new AbortController();

  const speech = synthesizeVietnameseSpeech("Xin chào", controller.signal);
  controller.abort();

  await expect(speech).rejects.toBeTruthy();
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
});
