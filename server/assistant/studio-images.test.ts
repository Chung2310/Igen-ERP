import { afterEach, describe, expect, it, vi } from "vitest";
import { enhanceStudioImagePrompt, generateStudioImages, type StudioImageInput } from "./studio-images";
import { openrouterChat, openrouterGenerateImage } from "../service/openrouter.service";

vi.mock("../service/openrouter.service", () => ({ openrouterChat: vi.fn(), openrouterGenerateImage: vi.fn() }));

const input: StudioImageInput = {
  prompt: "Một khu vườn dưới nắng sớm",
  aspectRatio: "16:9",
  count: 2,
};

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("generateStudioImages", () => {
  it("uses Recraft by default for new images", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("IGENAI_IMAGE_MODEL", "");
    vi.mocked(openrouterGenerateImage).mockResolvedValue({ url: "data:image/png;base64,YQ==" });
    await generateStudioImages({ ...input, count: 1 });
    expect(openrouterGenerateImage).toHaveBeenCalledWith(expect.objectContaining({ model: "recraft/recraft-v4.1-flash", referenceImages: undefined }));
  });
  it("uses the server-configured provider model, ratio and reference for every requested image", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("IGENAI_IMAGE_EDIT_MODEL", "google/gemini-3-pro-image");
    vi.mocked(openrouterGenerateImage).mockResolvedValueOnce({ url: "data:image/png;base64,YQ==" }).mockResolvedValueOnce({ url: "data:image/png;base64,Yg==" });
    const result = await generateStudioImages({ ...input, referenceImage: "data:image/png;base64,YQ==" });
    expect(result.images).toHaveLength(2);
    expect(openrouterGenerateImage).toHaveBeenCalledTimes(2);
    expect(openrouterGenerateImage).toHaveBeenCalledWith(expect.objectContaining({ model: "google/gemini-3-pro-image", aspectRatio: "16:9", referenceImages: ["data:image/png;base64,YQ=="], allowFallback: false }));
    expect(result.model).toBe("iGenAI");
  });

  it("reports missing configuration before contacting OpenRouter", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    await expect(generateStudioImages(input)).rejects.toMatchObject({ status: 503, message: "Có sự cố từ hệ thống, vui lòng tải lại sau!" });
    expect(openrouterGenerateImage).not.toHaveBeenCalled();
  });

  it.each([
    [402, 502],
    [429, 429],
  ])("hides provider details from generation errors with status %i", async (providerStatus, responseStatus) => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.mocked(openrouterGenerateImage).mockRejectedValue(Object.assign(new Error("OpenRouter provider balance error"), { status: providerStatus }));

    await expect(generateStudioImages({ ...input, count: 1 }))
      .rejects.toMatchObject({ message: "Có sự cố từ hệ thống, vui lòng tải lại sau!", status: responseStatus });
  });
});

describe("enhanceStudioImagePrompt", () => {
  it("returns a refined prompt without generating an image", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.mocked(openrouterChat).mockResolvedValue({ text: "  Quán cà phê buổi sáng, ánh sáng tự nhiên dịu nhẹ.  " });
    await expect(enhanceStudioImagePrompt("Quán cà phê buổi sáng")).resolves.toEqual({ prompt: "Quán cà phê buổi sáng, ánh sáng tự nhiên dịu nhẹ." });
    expect(openrouterChat).toHaveBeenCalledWith(expect.objectContaining({ model: "google/gemma-4-31b-it:free", fallbackModel: "qwen/qwen3.5-flash-02-23", messages: expect.arrayContaining([{ role: "user", content: "Quán cà phê buổi sáng" }]) }));
    expect(openrouterGenerateImage).not.toHaveBeenCalled();
  });

  it("requires a configured OpenRouter key", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    await expect(enhanceStudioImagePrompt("Quán cà phê buổi sáng")).rejects.toMatchObject({ status: 503, message: "Có sự cố từ hệ thống, vui lòng tải lại sau!" });
  });

  it("hides provider details when prompt refinement fails", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.mocked(openrouterChat).mockRejectedValue(Object.assign(new Error("OpenRouter provider balance error"), { status: 402 }));

    await expect(enhanceStudioImagePrompt("Quán cà phê buổi sáng"))
      .rejects.toMatchObject({ message: "Có sự cố từ hệ thống, vui lòng tải lại sau!", status: 502 });
  });
});
