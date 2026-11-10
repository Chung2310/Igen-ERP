export function normalizeChartPrompt(value: string, mode: "create" | "edit"): string {
  const request = value.trim().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  if (!request) return "";

  if (mode === "edit") return [
    `Yêu cầu chỉnh sửa: ${request}`,
    "Chỉ thay đổi những phần được yêu cầu; giữ nguyên dữ liệu nguồn nếu người dùng không yêu cầu thay dữ liệu.",
    "Cập nhật biểu đồ, chú giải, bảng số liệu và nhận xét để chúng thống nhất với nhau.",
  ].join("\n");

  return [
    `Mục tiêu: ${request}`,
    "Nguồn dữ liệu: tệp đính kèm. Chỉ dùng dữ liệu có trong tệp; không tự tạo số liệu.",
    "Dùng loại biểu đồ đã chọn; nếu chọn Tự động, chọn loại phù hợp với dữ liệu và mục tiêu trình bày.",
    "Nêu rõ các trường dữ liệu, tiêu đề, đơn vị, chú giải và bảng số liệu. Nếu thiếu thông tin cần thiết, nêu phần còn thiếu.",
  ].join("\n");
}
