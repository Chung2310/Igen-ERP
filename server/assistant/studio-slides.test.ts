import { describe, expect, it } from "vitest";
import { studioSlideDeckUpdateSchema, studioSlideRequestSchema, validateGeneratedDeck } from "./studio-slides";

const validSlide = {
  title: "Thông điệp chính",
  keyMessage: "Nêu mục tiêu của kế hoạch.",
  bullets: ["Ý thứ nhất", "Ý thứ hai"],
  speakerNotes: "Giải thích bối cảnh ngắn gọn.",
};
const analysis = {
  audience: "Người nghe phổ thông",
  objective: "Giúp người nghe hiểu cách lập kế hoạch.",
  storyline: "Mục tiêu → các bước → tổng kết.",
};

describe("studio slide structure", () => {
  it("accepts a document-only request and validates its page count and style", () => {
    expect(studioSlideRequestSchema.validate({ prompt: "", pageCount: 8, style: "preserve" }).error).toBeUndefined();
    expect(studioSlideRequestSchema.validate({ prompt: "Nội dung", pageCount: 31, style: "preserve" }).error).toBeTruthy();
    expect(studioSlideRequestSchema.validate({ prompt: "Nội dung", pageCount: 8, style: "visual" }).error).toBeTruthy();
  });

  it("requires the exact requested number of content slides", () => {
    const deck = { title: "Kế hoạch", subtitle: "Quý 4", analysis, slides: [validSlide] };
    expect(validateGeneratedDeck(deck, 2).slides).toHaveLength(1);
    expect(validateGeneratedDeck(deck, 2).analysis.audience).toBe(analysis.audience);
    expect(() => validateGeneratedDeck(deck, 3)).toThrow("AI chưa tạo đủ nội dung");
  });

  it("rejects edits that do not preserve the structured slide fields", () => {
    expect(studioSlideDeckUpdateSchema.validate({ title: "Kế hoạch", subtitle: "", slides: [validSlide] }).error).toBeUndefined();
    expect(studioSlideDeckUpdateSchema.validate({ title: "Kế hoạch", subtitle: "", slides: [{ ...validSlide, bullets: ["Chỉ có một ý"] }] }).error).toBeTruthy();
  });

  it("accepts bounded slide formatting and image objects", () => {
    const image = { id: "image-1", type: "image", src: "data:image/png;base64,aGVsbG8=", alt: "Chart image", x: 70, y: 18, width: 22, height: 24 };
    const styledSlide = { ...validSlide, textStyles: { title: { fontFamily: "Georgia", fontSize: 32, bold: true, color: "#123ABC", align: "center" } }, objects: [image] };
    expect(studioSlideDeckUpdateSchema.validate({ title: "Kế hoạch", subtitle: "", coverTextStyles: { title: { italic: true } }, coverObjects: [image], slides: [styledSlide] }).error).toBeUndefined();
    expect(studioSlideDeckUpdateSchema.validate({ title: "Kế hoạch", subtitle: "", slides: [{ ...styledSlide, objects: [{ ...image, x: 95 }] }] }).error).toBeTruthy();
    expect(studioSlideDeckUpdateSchema.validate({ title: "Kế hoạch", subtitle: "", slides: [{ ...styledSlide, textStyles: { title: { fontFamily: "Papyrus" } } }] }).error).toBeTruthy();
  });
});
