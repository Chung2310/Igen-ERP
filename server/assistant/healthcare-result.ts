import type { AssistantOperation } from "./catalog";
import { hospitalReportColumns } from "../../shared/healthcare";
import { formatAssistantResultTable } from "../../src/shared/assistant-result-table";
import { formatAssistantTemporalValue } from "../../src/shared/assistant-date";

export const healthcareLabels: Record<string, string> = {
  code: "Mã", name: "Tên", phone: "Số điện thoại", dateOfBirth: "Ngày sinh", address: "Địa chỉ", note: "Ghi chú",
  patientName: "Bệnh nhân", patientCode: "Mã bệnh nhân", patientPhone: "Số điện thoại bệnh nhân", visitedOn: "Ngày khám", doctorName: "Bác sĩ", roomName: "Phòng khám", serviceName: "Dịch vụ",
  status: "Trạng thái", paymentNote: "Ghi chú thanh toán", startsAt: "Bắt đầu", endsAt: "Kết thúc", title: "Nội dung chăm sóc", dueOn: "Hạn chăm sóc",
  assigneeName: "Người phụ trách", result: "Kết quả", kind: "Loại", active: "Đang sử dụng", filename: "Tên tệp", phase: "Giai đoạn", total: "Tổng số dòng",
  ready: "Sẵn sàng", processed: "Đã xử lý", duplicates: "Trùng lặp", invalid: "Không hợp lệ", inserted: "Đã nhập", skipped: "Đã bỏ qua", patientsInserted: "Bệnh nhân đã nhập",
  createdAt: "Thời gian tạo", completedAt: "Hoàn tất lúc", retryable: "Có thể thử lại", error: "Lỗi", row: "Dòng Excel", sheet: "Trang tính", label: "Hồ sơ", message: "Thông báo",
  today: "Ngày", patients: "Số bệnh nhân", visitCount: "Lượt khám", appointmentCount: "Lịch hẹn hôm nay", careCount: "Việc chăm sóc đến hạn", todayAppointments: "Lịch hẹn hôm nay", dueCare: "Chăm sóc đến hạn",
  visits: "Lượt khám liên quan", appointments: "Lịch hẹn liên quan", care: "Việc chăm sóc liên quan",
  deletedCount: "Bệnh nhân đã xóa", deletedVisits: "Lượt khám đã xóa", deletedAppointments: "Lịch hẹn đã xóa", deletedCare: "Việc chăm sóc đã xóa",
};
export function healthcareValue(key: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (value === null) return "Chưa có dữ liệu được cấp quyền";
  if (typeof value === "number") return value.toLocaleString("vi-VN");
  const text = String(value ?? "");
  if (["status", "kind", "phase"].includes(key)) return ({ registered: "Đã đăng ký", in_progress: "Đang thực hiện", completed: "Hoàn tất", cancelled: "Đã hủy", imported: "Đã nhập",
    scheduled: "Chờ xác nhận", confirmed: "Đã xác nhận", arrived: "Đã đến", no_show: "Không đến", open: "Chưa thực hiện", queued: "Đang chờ xử lý", running: "Đang xử lý",
    preview: "Đã kiểm tra, chờ xác nhận ghi", failed: "Thất bại", doctor: "Bác sĩ", room: "Phòng khám", service: "Dịch vụ", patients: "Bệnh nhân", visits: "Lượt khám",
    "hospital-report": "Báo cáo bệnh viện", check: "Kiểm tra dữ liệu", write: "Ghi dữ liệu", ready: "Sẵn sàng", skipped: "Đã bỏ qua", invalid: "Không hợp lệ" } as Record<string, string>)[text] || text;
  const temporal = ["date", "today", "dateOfBirth"].includes(key) || /(?:At|On|Date)$/.test(key) || key.startsWith("ngay_");
  const date = temporal ? formatAssistantTemporalValue(text) : undefined;
  if (date !== undefined) return date;
  return text.slice(0, 1500);
}

export function formatHealthcareResult(op: AssistantOperation, value: any) {
  if (op.id === "healthcare.visit.report") return [op.title, ...Object.entries(hospitalReportColumns).flatMap(([key, label]) =>
    typeof value?.fields?.[key] === "string" && value.fields[key] ? [`${label}: ${["ngay_gio_kham", "ngay_sinh", "ngay_hen_tai_kham"].includes(key)
      ? healthcareValue(key, value.fields[key]) : value.fields[key].slice(0, 1500)}`] : [])].join("\n");
  if (op.id === "healthcare.overview") {
    const patients = new Map<string, any>((value.patientReferences || []).map((p: any) => [p._id, p]));
    const summary = [op.title, ...["today", "patients", "visitCount", "appointmentCount", "careCount"].map(k => `${healthcareLabels[k]}: ${healthcareValue(k, value[k])}`)];
    for (const key of ["todayAppointments", "dueCare"]) for (const row of (value[key] || []).slice(0, 8)) {
      summary.push(`${healthcareLabels[key]}: ${patients.get(row.patientId)?.name || "Bệnh nhân"} · ${row.title || healthcareValue("status", row.status)} · ${healthcareValue("date", row.startsAt || row.dueOn)}`);
    }
    return summary.join("\n");
  }
  const rows: any[] = Array.isArray(value) ? value : value?.items || [value];
  if (!rows.length) return "Mình chưa tìm thấy hồ sơ y tế phù hợp trong chi nhánh đã chọn.";
  const total = value?.total ?? rows.length;
  const summary = op.readOnly
    ? `Mình tìm thấy ${total === 1 ? "một" : Number(total).toLocaleString("vi-VN")} kết quả phù hợp cho bạn.`
    : `Đã ${op.title.charAt(0).toLowerCase() + op.title.slice(1)}`;
  const patient = op.id.startsWith("healthcare.patient.");
  const records = rows.slice(0, 15).map(row => {
    const details = op.resultFields.flatMap(key => {
      if (key === "preview") {
        const preview = row.preview || row.__assistantImportPreview;
        if (!preview || typeof preview !== "object" || Array.isArray(preview)) return [];
        return Object.entries(hospitalReportColumns).flatMap(([field, label]) => field !== "stt" && typeof preview[field] === "string"
          && preview[field] ? [[label, healthcareValue(field, preview[field]).slice(0, 1500)]] : []);
      }
      const missing = row?.[key] === undefined || row[key] === null || row[key] === "";
      if ((!patient && missing) || (!missing && typeof row[key] === "object")) return [];
      const label = patient && key === "code" ? "Mã bệnh nhân" : patient && key === "name" ? "Họ tên bệnh nhân" : healthcareLabels[key] || key;
      return [[label, missing ? "—" : healthcareValue(key, row[key])]];
    });
    return details.length ? Object.fromEntries(details) : { "Thông tin": "Đã xử lý hồ sơ" };
  });
  const after = total > Math.min(rows.length, 15)
    ? [`Đang hiển thị ${Math.min(rows.length, 15)} trong ${Number(total).toLocaleString("vi-VN")} kết quả; bạn có thể xem trang tiếp theo hoặc lọc cụ thể hơn.`] : [];
  return formatAssistantResultTable(summary, records, after);
}
