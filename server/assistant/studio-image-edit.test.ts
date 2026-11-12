import sharp from "sharp";
import { afterEach, expect, it, vi } from "vitest";
import { editStudioImage, buildStudioEditPrompt } from "./studio-image-edit";
import { openrouterGenerateImage } from "../service/openrouter.service";

vi.mock("../service/openrouter.service", () => ({ openrouterGenerateImage: vi.fn() }));

const imageDataUrl = (bytes: Buffer) => `data:image/png;base64,${bytes.toString("base64")}`;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("requires real alpha transparency for the remove-background result", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("IGENAI_TRANSPARENT_IMAGE_EDIT_MODEL", "");
  const source = await sharp({ create: { width: 2, height: 1, channels: 3, background: { r: 100, g: 120, b: 140 } } }).png().toBuffer();
  const cutout = await sharp(Buffer.from([30, 60, 90, 255, 0, 0, 0, 0]), { raw: { width: 2, height: 1, channels: 4 } }).png().toBuffer();
  vi.mocked(openrouterGenerateImage).mockResolvedValue({ url: imageDataUrl(cutout) });

  const result = await editStudioImage({ sourceImage: imageDataUrl(source), prompt: "Tách toàn bộ nền", mode: "remove-background" });

  expect(openrouterGenerateImage).toHaveBeenCalledWith(expect.objectContaining({
    model: "openai/gpt-image-2.6-flare",
    background: "transparent",
    outputFormat: "png",
    quality: "medium",
    referenceImages: [imageDataUrl(source)],
    allowFallback: false,
  }));
  expect(result.image.url).toMatch(/^data:image\/png;base64,/);
  const output = Buffer.from(result.image.url.slice("data:image/png;base64,".length), "base64");
  const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(data[info.channels - 1]).toBe(255);
  expect(data[info.channels * 2 - 1]).toBe(0);
  expect(buildStudioEditPrompt("remove-background", "Tách toàn bộ nền", false)).toContain("kênh alpha thật");
});

it("rejects a background-removal response that is an opaque white-backed PNG", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  const source = await sharp({ create: { width: 2, height: 1, channels: 3, background: { r: 100, g: 120, b: 140 } } }).png().toBuffer();
  const opaque = await sharp({ create: { width: 2, height: 1, channels: 3, background: "white" } }).png().toBuffer();
  vi.mocked(openrouterGenerateImage).mockResolvedValue({ url: imageDataUrl(opaque) });

  await expect(editStudioImage({ sourceImage: imageDataUrl(source), prompt: "Tách toàn bộ nền", mode: "remove-background" }))
    .rejects.toThrow("Mô hình không trả ảnh có nền trong suốt");
});

it.each([
  [402, 502],
  [429, 429],
  [401, 502],
])("hides provider details from image-edit errors with status %i", async (providerStatus, responseStatus) => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  const source = await sharp({ create: { width: 2, height: 1, channels: 3, background: { r: 100, g: 120, b: 140 } } }).png().toBuffer();
  vi.mocked(openrouterGenerateImage).mockRejectedValue(Object.assign(new Error("OpenRouter provider balance error"), { status: providerStatus }));

  await expect(editStudioImage({ sourceImage: imageDataUrl(source), prompt: "Đổi nền", mode: "change-background" }))
    .rejects.toMatchObject({ message: "Có sự cố từ hệ thống, vui lòng tải lại sau!", status: responseStatus });
});
