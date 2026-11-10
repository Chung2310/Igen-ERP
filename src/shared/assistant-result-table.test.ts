import { describe, expect, it } from "vitest";
import { formatAssistantResultTable, parseAssistantResultTable } from "./assistant-result-table";

describe("shared result table contract", () => {
  it("formats a future module without a special opening phrase or a module allowlist", () => {
    const text = formatAssistantResultTable("Đã lưu phiếu nghiệp vụ mới", [{ "Mã phiếu": "NEW-001", "Trạng thái": "Đã lưu", "Ghi chú": "Dòng 1\nDòng 2 · Nhắc: gọi lại" }], ["Bạn có muốn bổ sung không?"]);
    const result = parseAssistantResultTable(text);
    expect(result?.headers).toEqual(["Mã phiếu", "Trạng thái", "Ghi chú"]);
    expect(result?.rows[0].values["Ghi chú"]).toBe("Dòng 1; Dòng 2 • Nhắc: gọi lại");
    expect(result?.after).toEqual(["Bạn có muốn bổ sung không?"]);
  });
  it.each(["Đã nhận dữ liệu module mới.", "Có dữ liệu như sau:", "Đã tạo bệnh nhân."])("recognizes structured numbered rows after %s", summary => {
    expect(parseAssistantResultTable(`${summary}\n1. Mã: NEW-001 · Tên: Nguyễn An`)?.rows[0].values).toEqual({ Mã: "NEW-001", Tên: "Nguyễn An" });
  });
  it.each(["Xong rồi bạn nhé, mình đã tạo hồ sơ.", "Đã lưu hồ sơ thành công.", "Mình kiểm tra giúp bạn rồi nhé:"])("recognizes vertical fields after %s and keeps prose below the table", summary => {
    const text = `${summary}\nTên: Nguyễn An\nSố điện thoại: \n\nMình thấy các thông tin tùy chọn còn trống: Địa chỉ. Bạn có muốn bổ sung không?`;
    const table = parseAssistantResultTable(text);
    expect(table?.rows[0].values).toEqual({ Tên: "Nguyễn An", "Số điện thoại": "—" });
    expect(table?.after.join(" ")).toContain("Bạn có muốn bổ sung không?");
    expect(table?.headers).not.toContain("Mình thấy các thông tin tùy chọn còn trống");
  });
  it("keeps instructions and plain conversation out of result tables", () => {
    expect(parseAssistantResultTable("Làm theo các bước:\n1. Mở màn hình.\n2. Nhập tên rồi lưu.")).toBeNull();
    expect(parseAssistantResultTable("Bạn nhập giúp mình:\n1. Họ tên: tên đầy đủ\n2. Địa chỉ: nơi ở hiện tại")).toBeNull();
  });
});
