import { afterEach, expect, it, vi } from "vitest";
import { geminiImageService } from "./image.service";
import { openrouterGenerateImage } from "../openrouter.service";

vi.mock("../openrouter.service", () => ({ openrouterGenerateImage: vi.fn() }));
vi.mock("../cloudinary.service", () => ({ cloudinaryService: { uploadMedia: vi.fn() } }));

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("routes the default Marketing image choice to Nano Banana 2 Lite", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.mocked(openrouterGenerateImage).mockResolvedValue({ url: "https://res.cloudinary.com/demo/image.png" });
  await geminiImageService.generateImage("Sản phẩm trên nền sáng", { modelName: "gemini-banana-flash" });
  expect(openrouterGenerateImage).toHaveBeenCalledWith(expect.objectContaining({ model: "google/gemini-3.1-flash-lite-image" }));
});

it("keeps image references on a model that accepts images", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.mocked(openrouterGenerateImage).mockResolvedValue({ url: "https://res.cloudinary.com/demo/image.png" });
  await geminiImageService.generateImage("Giữ logo", { modelName: "gemini-banana-flash", existingImageUris: ["https://example.com/logo.png"] });
  expect(openrouterGenerateImage).toHaveBeenCalledWith(expect.objectContaining({ model: "google/gemini-3.1-flash-lite-image", referenceImages: ["https://example.com/logo.png"] }));
});
