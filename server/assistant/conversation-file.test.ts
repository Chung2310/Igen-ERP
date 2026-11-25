import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { assistantConversationFileFilter, isAssistantConversationFileAllowedForMode, isAssistantConversationFileName, readAssistantConversationFile, readAssistantConversationImages } from "./conversation-file";

describe("assistant conversation file readers", () => {
  it("recognizes supported document, image, and video file extensions", () => {
    expect(isAssistantConversationFileName("tai-lieu.PDF")).toBe(true);
    expect(isAssistantConversationFileName("anh.webp")).toBe(true);
    expect(isAssistantConversationFileName("hop.mp4")).toBe(true);
    expect(isAssistantConversationFileName("bang.xlsx")).toBe(false);
    expect(isAssistantConversationFileName("ma-doc.exe")).toBe(false);
  });

  it("allows work-mode image context while documents while keeping videos in chat mode", () => {
    expect(isAssistantConversationFileAllowedForMode("cccd.jpg", "work")).toBe(true);
    expect(isAssistantConversationFileAllowedForMode("ho-so.webp", "work")).toBe(true);
    expect(isAssistantConversationFileAllowedForMode("hop-dong.pdf", "work")).toBe(true);
    expect(isAssistantConversationFileAllowedForMode("hop.mp4", "work")).toBe(false);
    expect(isAssistantConversationFileAllowedForMode("hop-dong.pdf", "qa")).toBe(true);
    expect(isAssistantConversationFileAllowedForMode("hop.mp4", "qa")).toBe(true);
  });

  it("explicitly accepts supported files in Multer's file filter", () => {
    const callback = vi.fn();
    assistantConversationFileFilter("anh.png", callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it("normalizes an uploaded image into a model-readable vision attachment", async () => {
    const buffer = await sharp({
      create: { width: 4, height: 3, channels: 3, background: { r: 20, g: 80, b: 180 } },
    }).png().toBuffer();
    const result = await readAssistantConversationFile({
      buffer,
      fileName: "anh.png",
      req: {} as never,
    });

    expect(result.fileName).toBe("anh.png");
    expect(result.documentContext.content).toEqual({ type: "uploaded-image", fileName: "anh.png" });
    expect(result.visualAttachments).toHaveLength(1);
    expect(result.visualAttachments?.[0].dataUrl).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("combines multiple uploaded images into one vision context", async () => {
    const buffer = await sharp({
      create: { width: 4, height: 3, channels: 3, background: { r: 20, g: 80, b: 180 } },
    }).png().toBuffer();
    const result = await readAssistantConversationImages({
      files: [
        { buffer, fileName: "anh-mot.png" },
        { buffer, fileName: "anh-hai.png" },
      ],
      req: {} as never,
    });

    expect(result.documentContext.content).toEqual({ type: "uploaded-images", fileNames: ["anh-mot.png", "anh-hai.png"] });
    expect(result.visualAttachments).toHaveLength(2);
    expect(result.visualAttachments?.every(attachment => attachment.dataUrl.startsWith("data:image/jpeg;base64,"))).toBe(true);
  });
});
