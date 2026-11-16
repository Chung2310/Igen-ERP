import { describe, expect, it } from "vitest";
import { getAssistantImageGenerationRequest } from "./assistant-image-generation";

describe("assistant image generation requests", () => {
  it("recognizes direct Vietnamese image requests and requested framing", () => {
    expect(getAssistantImageGenerationRequest("Hãy tạo hình ảnh một chú mèo đang ngồi bên cửa sổ, khung 16:9"))
      .toEqual({
        prompt: "Hãy tạo hình ảnh một chú mèo đang ngồi bên cửa sổ, khung 16:9",
        aspectRatio: "16:9",
        count: 1,
        countLimited: false,
      });
    expect(getAssistantImageGenerationRequest("Tôi muốn bạn vẽ một khu vườn dọc"))
      .toMatchObject({ aspectRatio: "9:16" });
    expect(getAssistantImageGenerationRequest("Tạo hình một chú mèo")).not.toBeNull();
  });

  it("does not treat image how-to questions as generation requests", () => {
    expect(getAssistantImageGenerationRequest("Làm thế nào để tạo hình ảnh trong Canva?")).toBeNull();
    expect(getAssistantImageGenerationRequest("Cách tạo logo cho cửa hàng?")).toBeNull();
  });

  it("does not mistake document requests containing images for image generation", () => {
    expect(getAssistantImageGenerationRequest("Tạo file PDF có hình ảnh minh họa cho quy trình")).toBeNull();
  });

  it("reads requested image counts in digits and Vietnamese number words", () => {
    expect(getAssistantImageGenerationRequest("Tạo 3 ảnh poster cho quán cà phê"))
      .toMatchObject({ count: 3, countLimited: false });
    expect(getAssistantImageGenerationRequest("Tạo hai phiên bản logo cho cửa hàng"))
      .toMatchObject({ count: 2, countLimited: false });
    expect(getAssistantImageGenerationRequest("Create three images of a mountain lake"))
      .toMatchObject({ count: 3, countLimited: false });
  });

  it("caps chat generation at four images per request", () => {
    expect(getAssistantImageGenerationRequest("Tạo 8 hình ảnh phong cảnh"))
      .toMatchObject({ count: 4, countLimited: true });
  });
});
