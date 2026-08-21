import { describe, expect, it } from "vitest";
import { extractKnowledgeText } from "./knowledge-extract";

describe("knowledge extraction", () => {
  it("uses text export for Google Docs", async () => {
    const text = await extractKnowledgeText(
      { id: "doc-1", name: "Quy định", mimeType: "application/vnd.google-apps.document" },
      "token",
      { exportFile: async () => Buffer.from("Nội dung quy định") } as any,
    );
    expect(text).toEqual({ text: "Nội dung quy định", kind: "text" });
  });

  it("rejects unsupported files without crashing", async () => {
    await expect(extractKnowledgeText({ id: "bin", name: "a.bin", mimeType: "application/octet-stream" }, "token", {} as any))
      .rejects.toThrow("không hỗ trợ");
  });
  it("recognizes PDF and DOCX extraction paths", async () => {
    const drive = { downloadFile: async () => Buffer.from("not-a-real-document") } as any;
    await expect(extractKnowledgeText({ id: "pdf", name: "a.pdf", mimeType: "application/pdf" }, "token", drive)).rejects.not.toThrow("không hỗ trợ");
    await expect(extractKnowledgeText({ id: "docx", name: "a.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }, "token", drive)).rejects.not.toThrow("không hỗ trợ");
  });
});
