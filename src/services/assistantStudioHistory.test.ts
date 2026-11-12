import { describe, expect, it } from "vitest";
import { combineAssistantStudioHistory } from "./assistantStudioHistory";

describe("combineAssistantStudioHistory", () => {
  it("labels Studio activities and sorts them newest first", () => {
    const entries = combineAssistantStudioHistory({
      creations: [
        { id: "image-1", userId: "user-1", kind: "create-image", title: "Ảnh sản phẩm", summary: "1 ảnh · 1:1", prompt: "Ảnh sản phẩm", createdAt: "2026-11-10T08:00:00.000Z", payload: {} },
        { id: "graphic-1", userId: "user-1", kind: "infographic", title: "Quy trình", summary: "Theo bước · 3:4", prompt: "Quy trình", createdAt: "2026-11-10T09:00:00.000Z", payload: {} },
        { id: "edit-1", userId: "user-1", kind: "edit-image", title: "Nền xanh", summary: "Ảnh gốc: san-pham.png", prompt: "Đổi nền", createdAt: "2026-11-10T10:00:00.000Z", payload: {} },
        { id: "mindmap-1", userId: "user-1", kind: "mindmap", title: "Kế hoạch năm", summary: "Sơ đồ tư duy", prompt: "Kế hoạch năm", createdAt: "2026-11-10T10:30:00.000Z", payload: {} },
      ],
      charts: [{ id: "chart-1", fileName: "doanh-thu.xlsx", title: "Doanh thu", chartType: "Biểu đồ cột", summary: "Tăng theo tháng", createdAt: "2026-11-10T11:00:00.000Z" }],
      slides: [{ id: "slide-1", title: "Cách làm giàu", subtitle: "Kế hoạch tài chính cá nhân", sourceFileName: "Cach_lam_giau.docx", slideCount: 10, createdAt: "2026-11-10T13:30:00.000Z" }],
      transcripts: [{ id: "transcript-1", fileName: "hop.mp3", text: "Nội dung cuộc họp", createdAt: "2026-11-10T12:00:00.000Z" }],
      speech: [{ id: "speech-1", userId: "user-1", text: "Xin chào khách hàng", voiceName: "Linh", audio: new Blob(["audio"]), createdAt: "2026-11-10T13:00:00.000Z" }],
    });

    expect(entries.map(({ label }) => label)).toEqual(["Tạo slide", "Tạo audio", "Chép lời", "Tạo biểu đồ", "Tạo Mindmap", "Chỉnh sửa ảnh", "Tạo graphic", "Tạo ảnh"]);
    expect(entries[0]).toMatchObject({ kind: "slide", title: "Cách làm giàu", summary: "10 trang · Cach_lam_giau.docx", payload: { id: "slide-1" } });
    expect(entries[1].kind).toBe("speech");
    expect(entries[3].title).toBe("Doanh thu");
  });
});
