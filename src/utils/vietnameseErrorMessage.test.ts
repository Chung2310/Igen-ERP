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

  it("loại bỏ chi tiết kỹ thuật tiếng Anh khỏi thông báo tiếng Việt", () => {
    expect(toVietnameseErrorMessage(
      "Tải lên Cloudinary thất bại: Unsupported source URL: data:audio/webm;base64,AAAA",
    )).toBe("Tải lên Cloudinary thất bại.");
    expect(toVietnameseErrorMessage(
      'Lỗi tải "voice.webm": Request failed with status code 400',
    )).toBe('Lỗi tải "voice.webm".');
  });

  it("giữ nguyên phần giải thích tiếng Việt sau dấu hai chấm", () => {
    expect(toVietnameseErrorMessage("Dữ liệu không hợp lệ: Vui lòng nhập tên dự án."))
      .toBe("Dữ liệu không hợp lệ: Vui lòng nhập tên dự án.");
  });
});
