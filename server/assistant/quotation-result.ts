import type { AssistantOperation } from "./catalog";
import { projectQuotationRecords } from "./quotation-executor";
import { formatAssistantResultTable } from "../../src/shared/assistant-result-table";
import { formatAssistantTemporalValue } from "../../src/shared/assistant-date";

const labels: Record<string, string> = { quoteNumber: "Số báo giá", kind: "Loại", customerName: "Khách hàng", customerEmail: "Email khách hàng", customerPhone: "Điện thoại khách hàng", status: "Trạng thái", subtotal: "Tạm tính", taxRate: "Thuế suất", taxAmount: "Tiền thuế", shippingFee: "Phí vận chuyển", total: "Tổng tiền", currency: "Tiền tệ", validityDays: "Hiệu lực (ngày)", completionDate: "Hạn hoàn thành", informationNeeded: "Thông tin cần bổ sung", additionalInformation: "Thông tin bổ sung", rejectionReason: "Lý do trả lại", createdAt: "Thời gian tạo", updatedAt: "Cập nhật lúc", sku: "Mã hàng", name: "Tên", description: "Mô tả", unit: "Đơn vị", price: "Đơn giá", unitPrice: "Đơn giá", quantity: "Số lượng", lineTotal: "Thành tiền", attributes: "Thuộc tính", catalogAttributes: "Quy cách", active: "Đang áp dụng", effectiveFrom: "Hiệu lực từ", effectiveTo: "Hiệu lực đến", contractNumber: "Số hợp đồng", projectName: "Công trình", projectAddress: "Địa chỉ công trình", scope: "Phạm vi công việc", paymentTerms: "Điều khoản thanh toán", deliveryTerms: "Tiến độ", deliverables: "Hồ sơ bàn giao", depositAmount: "Tiền đặt cọc", otherTerms: "Điều khoản bổ sung", signedDate: "Ngày ký", acceptanceNumber: "Số nghiệm thu", acceptedDate: "Ngày nghiệm thu", location: "Địa điểm", result: "Kết quả", notes: "Ghi chú", handoverDetails: "Hồ sơ bàn giao thực tế", qualityAssessment: "Chất lượng", settlementAmount: "Giá trị quyết toán", amountPaid: "Đã thanh toán", paymentDueDays: "Hạn thanh toán (ngày)", originalFilename: "Tên tệp", filename: "Tên tệp", mimeType: "Loại tệp", bytes: "Dung lượng (byte)", extension: "Định dạng", category: "Loại mẫu", requestText: "Yêu cầu", missingFields: "Thông tin còn thiếu", questions: "Câu hỏi cần bổ sung", assumptions: "Giả định", missingProducts: "Hạng mục còn thiếu", suggestedProducts: "Sản phẩm đề xuất", budget: "Ngân sách", area: "Diện tích", floors: "Số tầng", lines: "Dòng hàng", items: "Sản phẩm", validCount: "Dòng hợp lệ", invalidCount: "Dòng lỗi", errors: "Lỗi dữ liệu", imported: "Đã nhập", inserted: "Thêm mới", updated: "Cập nhật", deleted: "Đã xóa", error: "Lỗi", from: "Từ ngày", to: "Đến ngày", quotes: "Báo giá", contracts: "Hợp đồng", acceptances: "Nghiệm thu", templates: "Mẫu tài liệu", ai: "Lượt AI", used: "Đã dùng", limit: "Hạn mức", remaining: "Còn lại", count: "Số lượng", approved: "Đã duyệt", draft: "Bản nháp", pending: "Chờ duyệt", signed: "Đã ký", completed: "Hoàn tất", revenue: "Doanh thu", taxId: "Mã số thuế", address: "Địa chỉ", phone: "Điện thoại", businessEmail: "Email kinh doanh", representativeName: "Người đại diện", acceptedQuantity: "Khối lượng nghiệm thu", lineIndex: "Vị trí dòng" };
const states: Record<string, string> = { customer: "Báo giá khách hàng", estimate: "Dự toán", budget: "Phương án ngân sách", contract: "Hợp đồng", acceptance: "Nghiệm thu", settlement: "Quyết toán", quote: "Báo giá", draft: "Nháp", needs_info: "Cần bổ sung", pending_review: "Chờ duyệt", approved: "Đã duyệt", rejected: "Trả lại", signed: "Đã ký", completed: "Hoàn tất", queued: "Đang chờ xử lý", running: "Đang xử lý", failed: "Thất bại", not_found: "Chưa phân tích", matched: "Đã đối chiếu", partial: "Cần bổ sung" };
Object.assign(labels, { startTime: "Giờ bắt đầu", endTime: "Giờ kết thúc", customerAddress: "Địa chỉ khách hàng", customerTaxId: "Mã số thuế khách hàng", customerRepresentative: "Đại diện khách hàng", companyName: "Bên bán", companyAddress: "Địa chỉ bên bán", companyTaxId: "Mã số thuế bên bán", companyPhone: "Điện thoại bên bán", companyEmail: "Email bên bán", companyRepresentative: "Đại diện bên bán", bankDetails: "Thông tin thanh toán", signingPlace: "Địa điểm ký", byStatus: "Theo trạng thái", byKind: "Theo loại", values: "Giá trị", customer: "Báo giá khách hàng", estimate: "Dự toán", approvedCustomer: "Báo giá khách hàng đã duyệt", approvedEstimate: "Dự toán đã duyệt", needs_info: "Cần bổ sung", pending_review: "Chờ duyệt", rejected: "Trả lại" });
export function quotationValue(key: string, value: any, depth = 0): string {
  if (value == null) return "—";
  if (depth > 3) return "…";
  if (Array.isArray(value)) return value.slice(0, 15).map(item => quotationValue(key, item, depth + 1)).join("; ") || "Không có";
  if (typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => {
      if (v == null || v === "" || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length)) return [];
      if (k === "lineTotal" && v === 0 && typeof (value as any).unitPrice === "number" && (value as any).unitPrice > 0) return [];
      const formatted = quotationValue(k, v, depth + 1);
      if (formatted === "—") return [];
      if (labels[k]) return [`${labels[k]}: ${formatted}`];
      if (key === "attributes" || key === "additionalInformation") return [`${k}: ${formatted}`];
      return [];
    }).join(" • ") || "—";
  }
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number") return key === "taxRate" ? `${(value * 100).toLocaleString("vi-VN")}%` : value.toLocaleString("vi-VN");
  if (["createdAt", "updatedAt", "completionDate", "effectiveFrom", "effectiveTo", "signedDate", "acceptedDate", "from", "to"].includes(key)) return formatAssistantTemporalValue(value) ?? String(value);
  const optionLabels: Record<string, string> = { active: "Đang áp dụng", inactive: "Ngừng áp dụng", all: "Tất cả", deleted: "Đã xóa", upcoming: "Sắp hiệu lực", expired: "Hết hiệu lực", activate: "Áp dụng", deactivate: "Ngừng áp dụng", delete: "Xóa", restore: "Khôi phục", price: "Điều chỉnh giá", amount: "Theo số tiền", percent: "Theo phần trăm" };
  return (["status", "kind", "category", "action", "mode"].includes(key) ? states[String(value)] || optionLabels[String(value)] : undefined) || String(value).slice(0, 2000);
}
export function formatQuotationResult(op: AssistantOperation, value: any): string {
  const rows = projectQuotationRecords(op, value);
  const records = rows.slice(0, 15).map(row => {
    const record = Object.fromEntries(op.resultFields.filter(key => row[key] !== undefined && row[key] !== "").map(key => [labels[key] || key, quotationValue(key, row[key]).slice(0, 2000)]));
    return Object.keys(record).length ? record : { "Trạng thái": "Đã xử lý" };
  });
  const queued = rows.some(row => ["queued", "running"].includes(String(row.status)));
  return formatAssistantResultTable("Kết quả", records, queued ? ["File đang được xử lý. Bạn có thể yêu cầu xem tiến độ hoặc tải file khi hoàn tất."] : rows.length > 15 ? ["Đang hiển thị 15 kết quả. Hãy lọc theo mã hoặc tên để xem cụ thể hơn."] : []);
}
