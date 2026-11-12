import { describe, expect, it } from "vitest";
import AdmZip from "adm-zip";
import { resolveStudioMindmapSource } from "./studio-mindmap-source";

describe("resolveStudioMindmapSource", () => {
  it("uses a text prompt as the mindmap source", async () => {
    await expect(resolveStudioMindmapSource({ sourceType: "text", prompt: "Kế hoạch kinh doanh" })).resolves.toMatchObject({
      text: "Kế hoạch kinh doanh",
      title: "Kế hoạch kinh doanh",
      fileName: "",
    });
  });

  it("blocks local and private URL targets", async () => {
    await expect(resolveStudioMindmapSource({ sourceType: "link", prompt: "http://127.0.0.1/admin" })).rejects.toMatchObject({ status: 400 });
    await expect(resolveStudioMindmapSource({ sourceType: "link", prompt: "http://localhost/admin" })).rejects.toMatchObject({ status: 400 });
  });

  it("extracts text from PowerPoint slides", async () => {
    const archive = new AdmZip();
    archive.addFile("ppt/slides/slide1.xml", Buffer.from('<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:t>Kế hoạch</a:t><a:t>doanh thu</a:t></p:sld>'));
    const result = await resolveStudioMindmapSource({ sourceType: "document", prompt: "", file: { buffer: archive.toBuffer(), fileName: "ke-hoach.pptx" } });
    expect(result).toMatchObject({ title: "ke-hoach", fileName: "ke-hoach.pptx" });
    expect(result.text).toContain("Kế hoạch · doanh thu");
  });
});
