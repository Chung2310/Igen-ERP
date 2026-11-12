import { describe, expect, it } from "vitest";
import type { AssistantSlideDeck } from "../../shared/assistant-slide";
import { buildAssistantSlideDeckPackage } from "./assistant-studio-pptx";

describe("assistant slide PowerPoint package", () => {
  it("preserves direct text formatting and embeds slide images", () => {
    const deck: AssistantSlideDeck = {
      id: "deck-1",
      title: "Quarter plan",
      subtitle: "A practical plan",
      prompt: "",
      sourceFileName: "",
      style: "preserve",
      themeId: "ocean",
      coverTextStyles: { title: { fontFamily: "Georgia", fontSize: 32, color: "#123ABC", align: "center", bold: true } },
      slides: [{
        title: "Opening",
        keyMessage: "Focus",
        bullets: ["Growth", "Retention"],
        speakerNotes: "",
        textStyles: { title: { fontFamily: "Arial", fontSize: 24, italic: true }, "bullet-0": { underline: true, color: "#C34F38" } },
        objects: [{ id: "image-1", type: "image", src: "data:image/png;base64,aGVsbG8=", alt: "Market illustration", x: 70, y: 18, width: 22, height: 24 }],
      }],
      createdAt: "2026-11-11T00:00:00.000Z",
    };

    const zip = buildAssistantSlideDeckPackage(deck);
    const coverXml = zip.file("ppt/slides/slide1.xml")!.asText();
    const contentXml = zip.file("ppt/slides/slide2.xml")!.asText();
    const relationships = zip.file("ppt/slides/_rels/slide2.xml.rels")!.asText();

    expect(coverXml).toContain('typeface="Georgia"');
    expect(coverXml).toContain('algn="ctr"');
    expect(coverXml).toContain('val="123ABC"');
    expect(contentXml).toContain('typeface="Arial"');
    expect(contentXml).toContain('u="sng"');
    expect(contentXml).toContain('descr="Market illustration"');
    expect(contentXml).toContain('r:embed="rId2"');
    expect(relationships).toContain('Target="../media/slide2-image1.png"');
    expect(zip.file("ppt/media/slide2-image1.png")).not.toBeNull();
    expect(zip.file("[Content_Types].xml")!.asText()).toContain('Extension="png" ContentType="image/png"');
  });
});
