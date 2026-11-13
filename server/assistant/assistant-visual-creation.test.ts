import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { createAssistantVisualIllustration, recommendAssistantVisualCreation, type AssistantVisualRecommendation } from "./assistant-visual-creation";
import { openrouterChat } from "../service/openrouter.service";
import { generateStudioImages } from "./studio-images";

vi.mock("../service/openrouter.service", () => ({ openrouterChat: vi.fn() }));
vi.mock("./studio-images", async importOriginal => {
  const actual = await importOriginal<typeof import("./studio-images")>();
  return { ...actual, generateStudioImages: vi.fn() };
});

afterEach(() => vi.clearAllMocks());

const recommendation: AssistantVisualRecommendation = {
  shouldGenerate: true,
  prompt: "A clean wide illustration explaining how the workflow connects the three teams.",
  alt: "Sơ đồ kết nối ba nhóm trong quy trình",
  aspectRatio: "16:9",
};

describe("assistant answer illustration", () => {
  it("asks AI to evaluate the answer and existing images before recommending a visual", async () => {
    vi.mocked(openrouterChat).mockResolvedValue({ text: JSON.stringify(recommendation) });

    const result = await recommendAssistantVisualCreation({
      question: "Giải thích quy trình phối hợp giữa ba nhóm",
      answer: "Nhóm A chuyển hồ sơ cho nhóm B, sau đó nhóm C kiểm tra kết quả.",
      illustrations: [{ alt: "Ảnh văn phòng", url: "https://images.example.com/office.webp", sourceTitle: "Ảnh văn phòng" }],
    });

    expect(result).toEqual(recommendation);
    expect(openrouterChat).toHaveBeenCalledWith(expect.objectContaining({
      jsonMode: true,
      responseSchema: expect.objectContaining({ required: ["shouldGenerate", "prompt", "alt", "aspectRatio"] }),
      messages: expect.arrayContaining([
        expect.objectContaining({ role: "user", content: expect.stringContaining("Nhóm A chuyển hồ sơ") }),
      ]),
    }));
  });

  it("follows the AI decision not to generate even when the question mentions a logo", async () => {
    const noImage = { shouldGenerate: false, prompt: "", alt: "", aspectRatio: "1:1" };
    vi.mocked(openrouterChat).mockResolvedValue({ text: JSON.stringify(noImage) });

    const result = await recommendAssistantVisualCreation({ question: "Cách tạo logo trong Canva?", answer: "Dưới đây là các bước để tự thiết kế." });

    expect(result).toEqual(noImage);
    expect(generateStudioImages).not.toHaveBeenCalled();
  });

  it("rejects malformed recommendations instead of starting image generation", async () => {
    vi.mocked(openrouterChat).mockResolvedValue({ text: "not json" });

    await expect(recommendAssistantVisualCreation({ question: "Giải thích quy trình", answer: "Một câu trả lời." })).resolves.toBeNull();
    expect(generateStudioImages).not.toHaveBeenCalled();
  });

  it("uses the AI-selected prompt, framing and reference image for generation", async () => {
    vi.mocked(generateStudioImages).mockResolvedValue({
      images: [{ url: "https://images.example.com/workflow.webp" }],
      model: "iGenAI",
      aspectRatio: "16:9",
    });

    const illustration = await createAssistantVisualIllustration(recommendation, "data:image/png;base64,YQ==");

    expect(generateStudioImages).toHaveBeenCalledWith({
      prompt: recommendation.prompt,
      aspectRatio: "16:9",
      count: 1,
      referenceImage: "data:image/png;base64,YQ==",
    });
    expect(illustration).toMatchObject({
      alt: recommendation.alt,
      url: "https://images.example.com/workflow.webp",
      generatedByAi: true,
    });
  });

  it("compresses generated data images before storing them in the conversation", async () => {
    const png = await sharp(Buffer.alloc(4 * 4 * 4, 220), { raw: { width: 4, height: 4, channels: 4 } }).png().toBuffer();
    vi.mocked(generateStudioImages).mockResolvedValue({ images: [{ url: `data:image/png;base64,${png.toString("base64")}` }], model: "iGenAI", aspectRatio: "16:9" });

    const illustration = await createAssistantVisualIllustration(recommendation);

    expect(illustration.url).toMatch(/^data:image\/webp;base64,/);
    expect(Buffer.byteLength(illustration.url)).toBeLessThan(1_050_000);
  });
});
