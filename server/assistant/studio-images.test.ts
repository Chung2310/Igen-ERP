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
  it("uses Meta Muse Image for new images even when legacy image model overrides are set", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("IGENAI_IMAGE_MODEL", "recraft/recraft-v4.1-flash");
    vi.mocked(openrouterGenerateImage).mockResolvedValue({ url: "data:image/png;base64,YQ==" });
    await generateStudioImages({ ...input, count: 1 });
    expect(openrouterGenerateImage).toHaveBeenCalledWith(expect.objectContaining({ model: "meta/muse-image", referenceImages: undefined, allowFallback: false }));
  });
  it("uses Meta Muse Image with the ratio and reference for every requested image", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("IGENAI_IMAGE_EDIT_MODEL", "google/gemini-3-pro-image");
    vi.mocked(openrouterGenerateImage).mockResolvedValueOnce({ url: "data:image/png;base64,YQ==" }).mockResolvedValueOnce({ url: "data:image/png;base64,Yg==" });
    const result = await generateStudioImages({ ...input, referenceImage: "data:image/png;base64,YQ==" });
    expect(result.images).toHaveLength(2);
    expect(openrouterGenerateImage).toHaveBeenCalledTimes(2);
    expect(openrouterGenerateImage).toHaveBeenCalledWith(expect.objectContaining({ model: "meta/muse-image", aspectRatio: "16:9", referenceImages: ["data:image/png;base64,YQ=="], allowFallback: false }));
    expect(result.model).toBe("iGenAI");
  });

  it("starts image generations concurrently and returns successful results when one fails", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const pending: Array<{
      resolve: (image: Awaited<ReturnType<typeof openrouterGenerateImage>>) => void;
      reject: (error: unknown) => void;
    }> = [];
    vi.mocked(openrouterGenerateImage).mockImplementation(() => new Promise((resolve, reject) => pending.push({ resolve, reject })));

    const generation = generateStudioImages({ ...input, count: 3 });
    expect(openrouterGenerateImage).toHaveBeenCalledTimes(3);
    pending[0].resolve({ url: "data:image/png;base64,YQ==" });
    pending[1].reject(new Error("provider unavailable"));
    pending[2].resolve({ url: "data:image/png;base64,Yg==" });

    await expect(generation).resolves.toMatchObject({
      images: [{ url: "data:image/png;base64,YQ==" }, { url: "data:image/png;base64,Yg==" }],
      warning: expect.stringContaining("Đã tạo 2/3 ảnh"),
    });
  });

  it("rejects counts outside the four-image per-request limit", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    await expect(generateStudioImages({ ...input, count: 5 })).rejects.toThrow("Mỗi lượt chỉ có thể tạo từ 1 đến 4 ảnh.");
    expect(openrouterGenerateImage).not.toHaveBeenCalled();
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
  it("interprets the current request with recent conversation context", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.mocked(openrouterChat).mockResolvedValue({ text: JSON.stringify({ prompt: "Poster quảng cáo cà phê rang xay Mộc, bối cảnh quán buổi sáng, ánh sáng tự nhiên dịu nhẹ." }) });
    const conversation = [
      { role: "user" as const, content: "Tôi chuẩn bị ra mắt thương hiệu cà phê rang xay Mộc." },
      { role: "assistant" as const, content: "Bạn muốn hình ảnh quảng cáo hay ảnh sản phẩm?" },
    ];
    await expect(enhanceStudioImagePrompt("Tạo poster quảng cáo cho sản phẩm đó", conversation, 3)).resolves.toEqual({ prompt: "Poster quảng cáo cà phê rang xay Mộc, bối cảnh quán buổi sáng, ánh sáng tự nhiên dịu nhẹ." });
    const options = vi.mocked(openrouterChat).mock.calls[0][0];
    expect(options).toMatchObject({
      model: "openai/gpt-6-luna",
      fallbackModel: "openai/gpt-6-luna",
      jsonMode: true,
      responseSchema: expect.objectContaining({ required: ["prompt"] }),
    });
    const userMessage = options.messages?.find(message => message.role === "user");
    expect(JSON.parse(String(userMessage?.content))).toEqual({
      currentRequest: "Tạo poster quảng cáo cho sản phẩm đó",
      requestedImageCount: 3,
      recentConversation: conversation,
    });
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

  it("rejects malformed structured output", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.mocked(openrouterChat).mockResolvedValue({ text: "không có prompt" });

    await expect(enhanceStudioImagePrompt("Quán cà phê buổi sáng"))
      .rejects.toMatchObject({ message: "Có sự cố từ hệ thống, vui lòng tải lại sau!", status: 502 });
  });
});
