import { formatAssistantResultTable } from "../../src/shared/assistant-result-table";
import { formatAssistantTemporalValue } from "../../src/shared/assistant-date";

type Metric = [string, string, "count" | "money"];
const sections: Record<string, { label: string; metrics: Metric[] }> = {
  education: { label: "Học viên", metrics: [["students", "Tổng học viên", "count"], ["newStudents", "Học viên mới", "count"], ["activeClasses", "Lớp đang hoạt động", "count"], ["tuition", "Học phí thu trong kỳ", "money"], ["previousTuition", "Học phí kỳ trước", "money"], ["missingTeachers", "Lớp thiếu giảng viên", "count"], ["unpaidStudents", "Học viên còn nợ học phí", "count"]] },
  hr: { label: "Nhân sự", metrics: [["employees", "Tổng nhân sự", "count"], ["checkedIn", "Đã chấm công", "count"], ["late", "Đi muộn", "count"], ["approvedLeave", "Nghỉ phép được duyệt", "count"], ["absent", "Vắng", "count"], ["tasks.todo", "Việc chưa làm", "count"], ["tasks.doing", "Việc đang làm", "count"], ["tasks.done", "Việc hoàn thành", "count"], ["tasks.total", "Tổng công việc", "count"], ["overdueTasks", "Việc quá hạn", "count"], ["pendingApprovals", "Yêu cầu chờ duyệt", "count"], ["expiringContracts", "Hợp đồng sắp hết hạn", "count"]] },
  labor: { label: "Lao động", metrics: [["workers", "Tổng lao động", "count"], ["newWorkers", "Lao động mới", "count"], ["activeWorkers", "Lao động đang hoạt động", "count"], ["placedWorkers", "Lao động đã bố trí", "count"], ["activeProjects", "Dự án đang hoạt động", "count"], ["unfilledProjects", "Dự án chưa đủ lao động", "count"]] },
  retail: { label: "Bán lẻ", metrics: [["netSales", "Doanh thu thuần", "money"], ["previousSales", "Doanh thu kỳ trước", "money"], ["orderCount", "Số đơn", "count"], ["refunds", "Tiền hoàn", "money"]] },
  partners: { label: "Đối tác", metrics: [["active", "Đối tác đang hoạt động", "count"], ["payable", "Còn phải trả", "money"], ["pendingSettlements", "Kỳ đối soát chờ duyệt", "count"]] },
  inventory: { label: "Kho", metrics: [["quantity", "Số lượng tồn", "count"], ["lowStock", "Hàng dưới định mức", "count"]] },
  repair: { label: "Sửa chữa", metrics: [["open", "Phiếu đang xử lý", "count"], ["overdue", "Phiếu quá hạn", "count"], ["waitingParts", "Phiếu chờ linh kiện", "count"]] },
  finance: { label: "Tài chính", metrics: [["receivable", "Còn phải thu", "money"], ["overdue", "Phải thu quá hạn", "money"]] },
  customer: { label: "Khách hàng", metrics: [["total", "Tổng khách hàng", "count"], ["newCustomers", "Khách hàng mới", "count"]] },
};
const object = (value: any): any => {
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return {}; } }
  return value && typeof value === "object" ? value : {};
};
export function formatBusinessOverview(input: unknown): string {
  const wrapped = object(input);
  const data = object(Array.isArray(wrapped) ? wrapped[0] : wrapped.data || wrapped);
  const rows: Record<string, string>[] = [];
  const access = object(data.access);
  const failures = Array.isArray(data.errors) ? data.errors : [];
  const notes: string[] = [];
  for (const [key, section] of Object.entries(sections)) {
    if (access[key] === false) continue;
    if (failures.includes(key)) { notes.push(`Chưa tải được số liệu ${section.label.toLocaleLowerCase("vi")}. Báo cáo hiện chưa đầy đủ.`); continue; }
    if (data[key] == null) continue;
    const source = object(data[key]);
    for (const [path, label, type] of section.metrics) {
      const value = path.split(".").reduce((current, field) => object(current)[field], source);
      if (value === undefined) continue;
      const rendered = typeof value === "number" && Number.isFinite(value)
        ? new Intl.NumberFormat("vi-VN").format(value) + (type === "money" ? " ₫" : "") : "Chưa có dữ liệu";
      rows.push({ "Phân hệ": section.label, "Chỉ tiêu": label, "Giá trị": rendered });
    }
  }
  const range = object(data.range);
  if (typeof range.from === "string" && typeof range.to === "string") notes.unshift(`Kỳ báo cáo: ${formatAssistantTemporalValue(range.from) || range.from} đến ${formatAssistantTemporalValue(range.to) || range.to}.`);
  if (!rows.length) return ["Chưa có số liệu để lập báo cáo.", ...notes].join("\n");
  return formatAssistantResultTable("Kết quả", rows, notes);
}
