import { describe, expect, it } from "vitest";
import type { AssistantReply } from "../../src/shared/assistant-workflow";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";
import { omitAssistantInternalNarration, presentAssistantReply } from "./reply-presentation";

describe("shared assistant reply presentation", () => {
  it.each([
    "Mình sẽ sử dụng workflow “Tạo bệnh nhân” để xử lý yêu cầu. ",
    "Tôi đang dùng workflow tạo khóa học. ",
    "Workflow sử dụng: Tạo nghiệp vụ mới\n",
    "Workflow: Tạo bệnh nhân\n",
    "**Workflow:** Tạo nhân sự\n",
    "1. Workflow sử dụng: Tạo nhân sự\n",
    "1. Mình sử dụng workflow tạo bệnh nhân. ",
    "Với thông tin chưa được nêu, mình sẽ dùng giá trị mặc định của workflow: Trạng thái = active. ",
    "Mình sẽ tự điền giá trị mặc định cho trạng thái. ",
    "Các trường mặc định: Trạng thái = active\n",
  ])("removes implementation narration while keeping the business question: %s", narration => {
    const question = "Bạn gửi giúp mình số điện thoại nhé?";
    expect(omitAssistantInternalNarration(narration + question)).toBe(question);
  });

  it("keeps a question sharing the same sentence as narration", () => {
    expect(omitAssistantInternalNarration("Mình dùng workflow tạo nhân sự; bạn gửi giúp mình họ tên nhé?"))
      .toBe("bạn gửi giúp mình họ tên nhé?");
  });

  it("preserves business data and explanations about actual workflow or default settings", () => {
    const text = "Workflow là một chuỗi bước công việc.\n1. Tên: Workflow sản xuất · Ghi chú: Dùng giá trị mặc định khi nhập kho\nGhi chú: Mình dùng workflow được mô tả trong tài liệu.";
    expect(omitAssistantInternalNarration(text)).toBe(text);
  });

  it.each(["completed", "collecting", "confirmation"] as const)("hides only auto-filled preview values for %s without mutating execution metadata", status => {
    const source: AssistantReply = { status, reply: "Bạn kiểm tra thông tin rồi xác nhận nhé?", action: {
      id: "preview-id", title: "Tạo nghiệp vụ mới", values: [
        { label: "Tên", value: "Nguyễn An" },
        { label: "Mức phí", value: 0, defaulted: true },
        { label: "Cho phép gửi tin", value: false, defaulted: true },
        { label: "Số lượng", value: 0, defaulted: false },
      ],
    } };
    const presented = presentAssistantReply(source);
    expect(presented.action).toMatchObject({ id: "preview-id", title: "Tạo nghiệp vụ mới", values: [
      { label: "Tên", value: "Nguyễn An" }, { label: "Số lượng", value: 0, defaulted: false },
    ] });
    expect(presented.reply).toBe(source.reply);
    expect(source.action?.values).toHaveLength(4);
  });

  it.each([
    "Đã lưu nghiệp vụ mới · 1 kết quả:\n1. Mã: NEW-001 · Tên: Nguyễn An · Trạng thái: Đang hoạt động",
    "Xong rồi bạn nhé, mình đã tạo hồ sơ.\nMã: NEW-001\nTên: Nguyễn An\nTrạng thái: Đang hoạt động",
  ])("omits defaulted result columns while preserving the table and optional question", content => {
    const question = "Mình thấy thông tin tùy chọn còn trống: Ghi chú. Bạn có muốn bổ sung không?";
    const result = presentAssistantReply({ status: "completed", reply: `${content}\n\n${question}` }, ["Trạng thái"]);
    expect(result.reply).not.toContain("Trạng thái");
    expect(result.reply).toContain(question);
    const table = parseAssistantResultTable(result.reply);
    expect(table?.headers).toEqual(["Mã", "Tên"]);
    expect(table?.rows[0].values).toEqual({ "Mã": "NEW-001", "Tên": "Nguyễn An" });
  });

  it("keeps explicitly supplied values even when equal to a configured default", () => {
    const source = { status: "completed" as const, reply: "Đã lưu hồ sơ · 1 kết quả:\n1. Tên: Nguyễn An · Trạng thái: Đang hoạt động" };
    expect(presentAssistantReply(source).reply).toBe(source.reply);
  });

  it("keeps the result as a table when hiding defaults leaves only one column", () => {
    const result = presentAssistantReply({ status: "completed", reply: "Xong rồi bạn nhé, mình đã lưu hồ sơ.\nTên: Nguyễn An\nTrạng thái: Đang hoạt động\n\nBạn có muốn bổ sung ghi chú không?" }, ["Trạng thái"]);
    expect(parseAssistantResultTable(result.reply)?.headers).toEqual(["Tên"]);
    expect(result.reply).toContain("Bạn có muốn bổ sung ghi chú không?");
    expect(result.reply).not.toContain("Trạng thái");
  });
});
