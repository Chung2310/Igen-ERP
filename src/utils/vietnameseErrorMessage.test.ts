import { describe, expect, it } from "vitest";
import { toVietnameseErrorMessage } from "./vietnameseErrorMessage";

describe("toVietnameseErrorMessage", () => {
  it("giữ nguyên thông báo tiếng Việt", () => {
    expect(toVietnameseErrorMessage("Không thể tải dữ liệu.")).toBe("Không thể tải dữ liệu.");
  });

  it.each([
    ["Failed to fetch", "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng."],
    ["Network request failed", "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng."],
    ["Unauthorized", "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại."],
    ["Forbidden", "Bạn không có quyền thực hiện thao tác này."],
    ["Upload failed", "Tải tệp lên thất bại. Vui lòng thử lại."],
    ["Request timeout", "Yêu cầu đã hết thời gian chờ. Vui lòng thử lại."],
  ])("dịch %s", (input, expected) => {
    expect(toVietnameseErrorMessage(input)).toBe(expected);
  });

  it("che lỗi tiếng Anh chưa nhận diện", () => {
    expect(toVietnameseErrorMessage("Something unusual happened in widget parser"))
      .toBe("Đã xảy ra lỗi. Vui lòng thử lại.");
  });

  it("ẩn chi tiết kỹ thuật và hiển thị hướng xử lý bằng tiếng Việt", () => {
    expect(toVietnameseErrorMessage(
      "Tải lên Cloudinary thất bại: Unsupported source URL: data:audio/webm;base64,AAAA",
    )).toBe("Không thể tải tệp lên. Vui lòng chọn tệp khác hoặc thử lại.");
    expect(toVietnameseErrorMessage(
      'Lỗi tải "voice.webm": Request failed with status code 400',
    )).toBe("Không thể tải tệp lên. Vui lòng chọn tệp khác hoặc thử lại.");
  });

  it("dịch lỗi tiếng Anh thành hướng dẫn ngắn gọn cho người dùng", () => {
    expect(toVietnameseErrorMessage("Upload failed: Unsupported source URL: https://example.com/file.pdf"))
      .toBe("Không thể tải tệp lên. Vui lòng chọn tệp khác hoặc thử lại.");
    expect(toVietnameseErrorMessage("Request failed with status code 409: Duplicate employee code"))
      .toBe("Mã nhân viên đã tồn tại. Vui lòng kiểm tra và nhập mã khác.");
  });

  it.each([
    ["Unable to print payslip", "Không thể in phiếu lương. Vui lòng thử lại."],
    ["Payroll export failed", "Không thể xuất bảng lương. Vui lòng thử lại."],
    ["A written reason is required", "Vui lòng nhập lý do trước khi tiếp tục."],
    ["Deletion request code not found", "Không tìm thấy yêu cầu xóa dữ liệu. Vui lòng kiểm tra lại mã."],
    ["HTTP 404", "Không tìm thấy dữ liệu yêu cầu."],
  ])("dịch lỗi tiếng Anh phổ biến: %s", (input, expected) => {
    expect(toVietnameseErrorMessage(input)).toBe(expected);
  });

  it("trích message từ lỗi JSON mà không hiển thị thông tin kỹ thuật", () => {
    expect(toVietnameseErrorMessage(JSON.stringify({ error: "Unsupported source URL: https://example.com" })))
      .toBe("Không thể tải tệp lên. Vui lòng chọn tệp khác hoặc thử lại.");
  });

  it("giữ nguyên phần giải thích tiếng Việt sau dấu hai chấm", () => {
    expect(toVietnameseErrorMessage("Dữ liệu không hợp lệ: Vui lòng nhập tên dự án."))
      .toBe("Dữ liệu không hợp lệ: Vui lòng nhập tên dự án.");
  });
});
