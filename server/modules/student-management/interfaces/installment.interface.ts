/**
 * Kế hoạch thu học phí theo đợt — do giáo viên tự cấu hình khi gửi thông báo.
 * Tổng percent của tất cả đợt trong 1 plan nên <= 100.
 */
export interface IInstallmentPlan {
  installmentNo: number;  // Số thứ tự đợt (bắt đầu từ 1)
  percent: number;        // % tổng học phí gốc của đợt này (ví dụ: 40 = 40%)
  label?: string;         // Nhãn tùy chỉnh (ví dụ: "Đợt 1", "Đợt cuối")
}
