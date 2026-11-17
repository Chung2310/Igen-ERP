import { expect, it } from "vitest";
import { ASSISTANT_OPERATIONS, defaultWorkflow } from "./catalog";
import { assistantUnsupportedGuidance } from "./request-guidance";

const studentWorkflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === "student").map(defaultWorkflow);

it("guides a recognized delete request to the relevant ERP module without claiming it ran", () => {
  const reply = assistantUnsupportedGuidance("Xóa trường dữ liệu tùy chỉnh của học viên", studentWorkflows, "student");

  expect(reply).toContain("Mình hiểu bạn muốn thực hiện yêu cầu này.");
  expect(reply).toContain("chưa có dữ liệu nào được thay đổi");
  expect(reply).toContain("tab QUẢN LÝ HỌC VIÊN");
  expect(reply).toContain("Tìm đúng hồ sơ theo tên hoặc mã");
  expect(reply).toContain("Đọc kỹ cảnh báo và dữ liệu liên quan");
  expect(reply).toContain("nhờ quản trị viên kiểm tra phân hệ và quyền truy cập");
});

it.each([
  ["Thêm một khoản thu mới", "chọn Thêm/Tạo mới"],
  ["Thêm học viên mới, không xóa hồ sơ cũ", "chọn Thêm/Tạo mới"],
  ["Cập nhật địa chỉ trên hồ sơ", "chọn Sửa/Cập nhật"],
  ["Tra cứu lịch sử điểm danh", "Mở danh sách loại dữ liệu cần tra cứu"],
])("gives suitable manual steps for %s", (text, expectedStep) => {
  const reply = assistantUnsupportedGuidance(text, studentWorkflows, "student");
  expect(reply).toContain(expectedStep);
});

it("does not guide the user into a module outside their available workflows", () => {
  const reply = assistantUnsupportedGuidance("Tạo một hồ sơ mới", studentWorkflows, "finance");

  expect(reply).not.toContain("tab TÀI CHÍNH");
  expect(reply).toContain("Mở phân hệ đang quản lý dữ liệu");
  expect(reply).toContain("cho biết tên phân hệ");
});
