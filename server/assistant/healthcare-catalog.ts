import type { AssistantField } from "../../src/shared/assistant-workflow";
import type { AssistantOperation } from "./catalog";
import { appointmentStatuses, careStatuses, catalogKinds, visitStatuses } from "../../shared/healthcare";

const field = (key: string, label: string, required = false, extra: Partial<AssistantField> = {}): AssistantField =>
  ({ key, label, type: "text", source: "body", apiKey: key, required, systemRequired: required, ...extra });
const reference = (key: string, label: string, target: string, required = false, extra: Partial<AssistantField> = {}) =>
  field(key, label, required, { type: "reference", reference: `healthcare.${target}.list`, ...extra });
const branch = (): AssistantField => reference("targetBranch", "Chi nhánh y tế", "", true,
  { source: "query", apiKey: "branchId", reference: "branch.list" });
const day = (key: string, label: string, required = false) => field(key, label, required, { type: "date" });
const instant = (key: string, label: string) => field(key, label, true, { type: "datetime",
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,3})?)?(?:Z|[+-]\\d{2}:\\d{2})$" });
const text = (key: string, label: string, max: number, required = false) => field(key, label, required, { max });
const status = (options: readonly string[], defaultValue?: string) => field("status", "Trạng thái", false,
  { options: [...options], ...(defaultValue ? { defaultValue } : {}) });
const catalogRef = (kind: string, label: string) => reference(`${kind}Id`, label, "catalog", false, { referenceContext: { kind, active: true }, ...(kind === "doctor" ? { alternativeField: "doctorName" } : {}) });
const externalDoctor = () => text("doctorName", "Tên bác sĩ ngoài danh mục", 180);
const patient = () => reference("patientId", "Bệnh nhân (tên hoặc mã)", "patient", true);
const code = (required = true) => text("code", "Mã hồ sơ", 50, required);
const note = () => text("note", "Ghi chú", 1000);
const paging = () => [field("page", "Trang", false, { type: "number", min: 1, max: 5000, integer: true, defaultValue: 1 }),
  field("pageSize", "Số kết quả mỗi trang", false, { type: "number", min: 1, max: 100, integer: true, defaultValue: 25 })];
const filters = (states?: readonly string[]) => [text("q", "Từ khóa tìm kiếm", 100), day("from", "Từ ngày"), day("to", "Đến ngày"),
  ...(states ? [reference("patientId", "Bệnh nhân cần lọc", "patient"), status(states)] : []), ...paging()];
const patientFields = [code(false), text("name", "Họ tên bệnh nhân", 180, true), text("phone", "Số điện thoại", 40),
  day("dateOfBirth", "Ngày sinh"), text("address", "Địa chỉ", 350), note()];
const visitFields = [code(), patient(), day("visitedOn", "Ngày khám", true), catalogRef("doctor", "Bác sĩ"),
  { ...externalDoctor(), alternativeField: "doctorId" },
  catalogRef("room", "Phòng khám"), catalogRef("service", "Dịch vụ"), status(visitStatuses.filter(s => s !== "imported"), "registered"),
  text("paymentNote", "Ghi chú thanh toán", 160), note()];
const appointmentFields = [patient(), reference("visitId", "Lượt khám liên quan", "visit", false, { referenceParentKey: "patientId" }),
  catalogRef("doctor", "Bác sĩ"), catalogRef("room", "Phòng khám"),
  { ...externalDoctor(), alternativeField: "doctorId" },
  instant("startsAt", "Thời gian bắt đầu"), instant("endsAt", "Thời gian kết thúc"),
  status(appointmentStatuses, "scheduled"), note()];
const careFields = [patient(), reference("appointmentId", "Lịch hẹn liên quan", "appointment", false, { referenceParentKey: "patientId" }),
  reference("visitId", "Lượt khám liên quan", "visit", false, { referenceParentKey: "patientId" }),
  reference("assigneeId", "Nhân viên phụ trách chăm sóc", "staff", true), text("title", "Nội dung chăm sóc", 200, true),
  day("dueOn", "Hạn chăm sóc", true), status(careStatuses, "open"), { ...text("result", "Kết quả chăm sóc", 1000), requiredWhen: { field: "status", equals: "completed" } }];
const catalogFields = [field("kind", "Loại danh mục", true, { options: [...catalogKinds] }), code(),
  text("name", "Tên danh mục", 180, true), field("active", "Đang sử dụng", false, { type: "boolean", defaultValue: true })];
const identity = (entity: string, label: string) => reference("path_id", label, entity, true, { source: "path", apiKey: "id" });
const optionalUpdateField = (input: AssistantField): AssistantField => {
  const { defaultValue: _default, ...rest } = input;
  return { ...rest, required: false, systemRequired: false };
};
const resultFields: Record<string, string[]> = {
  patient: ["code", "name", "phone", "dateOfBirth", "address", "note"],
  visit: ["code", "patientName", "patientCode", "patientPhone", "visitedOn", "doctorName", "roomName", "serviceName", "status", "paymentNote", "note"],
  appointment: ["patientName", "patientCode", "patientPhone", "startsAt", "endsAt", "doctorName", "roomName", "status", "note"],
  care: ["patientName", "patientCode", "patientPhone", "title", "dueOn", "assigneeName", "status", "result"],
  catalog: ["kind", "code", "name", "active"], staff: ["name"],
  import: ["kind", "filename", "status", "phase", "total", "ready", "processed", "duplicates", "invalid", "inserted", "skipped", "patientsInserted", "createdAt", "completedAt", "retryable", "error"],
};
export const HEALTHCARE_OPERATIONS: AssistantOperation[] = [];
function add(id: string, title: string, path: string, method: AssistantOperation["method"], fields: AssistantField[], feature = "", readOnly = false, outputs?: string[]) {
  const permission = `healthcare${feature ? `-${feature}` : ""}:${readOnly ? "read" : "manage"}`;
  HEALTHCARE_OPERATIONS.push({ id: `healthcare.${id}`, title, description: `${title} trong chi nhánh đã chọn. ${readOnly ? "Chỉ đọc dữ liệu được cấp quyền." : "Chỉ ghi thông tin người dùng cung cấp; xác nhận trước khi thực hiện."}`,
    module: "healthcare", permissions: [permission], permissionGroups: [["healthcare:read"], [permission]],
    path: `/healthcare${path}`, method, fields: [branch(), ...fields], link: "/quan-ly-y-te", adapter: "healthcare", readOnly,
    confirmation: !readOnly, resultFields: outputs || resultFields[id.split(".")[0]] || [] });
}
add("overview", "Xem tổng quan y tế", "/overview", "GET", filters().filter(f => f.key !== "q").map(f => ({ ...f, source: "query" })), "", true,
  ["today", "patients", "visitCount", "appointmentCount", "careCount", "todayAppointments", "dueCare"]);
for (const [entity, title, path, feature, fields] of [
  ["patient", "bệnh nhân", "patients", "", patientFields], ["visit", "lượt khám", "visits", "visits", visitFields],
  ["appointment", "lịch hẹn khám", "appointments", "appointments", appointmentFields], ["care", "công việc chăm sóc bệnh nhân", "care", "care", careFields],
] as const) {
  const states = entity === "visit" ? visitStatuses : entity === "appointment" ? appointmentStatuses : entity === "care" ? careStatuses : undefined;
  add(`${entity}.list`, `Tra cứu ${title}`, `/${path}/search`, "POST", filters(states), feature, true);
  add(`${entity}.create`, `Tạo ${title}`, `/${path}`, "POST", fields.map(f => f.key === "status" ? { ...f, options: [String(f.defaultValue)] } : f), feature);
  const immutable = entity === "patient" ? ["code"] : entity === "visit" ? ["code", "patientId"] : entity === "appointment" ? ["patientId", "visitId"] : ["patientId", "appointmentId", "visitId"];
  add(`${entity}.update`, `Cập nhật ${title}`, `/${path}/:id`, "PATCH", [identity(entity, `${title} cần cập nhật`),
    ...fields.filter(f => !immutable.includes(f.key)).map(optionalUpdateField)], feature);
  const update = HEALTHCARE_OPERATIONS.at(-1)!;
  update.systemBodyFields = ["revision"];
  update.mergeBodyWithReference = true;
  if (feature) update.permissionGroups!.push([`healthcare-${feature}:read`]);
}
add("patient.detail", "Xem hồ sơ bệnh nhân", "/patients/:id", "GET", [identity("patient", "Bệnh nhân cần xem")], "", true);
const deletePatients = () => field("patientIds", "Bệnh nhân cần xóa", true, { apiKey: "ids", type: "json", structure: {
  type: "array", minItems: 1, maxItems: 500, items: { type: "string", required: true, reference: "healthcare.patient.list", label: "Bệnh nhân" },
} });
add("patient.bulk-delete-preview", "Xem dữ liệu liên quan trước khi xóa bệnh nhân", "/patients/bulk-delete-preview", "POST", [deletePatients()], "", true,
  ["code", "name", "phone", "visits", "appointments", "care"]);
Object.assign(HEALTHCARE_OPERATIONS.at(-1)!, { permissions: ["healthcare:manage"], permissionGroups: [["healthcare:read"], ["healthcare:manage"]] });
add("patient.bulk-delete", "Xóa bệnh nhân và dữ liệu y tế liên quan", "/patients/bulk-delete", "POST", [deletePatients()], "", false,
  ["deletedCount", "deletedVisits", "deletedAppointments", "deletedCare"]);
add("visit.report", "Xem phiếu khám bệnh viện đã nhập", "/visits/:id/report", "GET", [identity("visit", "Mã lượt khám cần xem phiếu")], "visits", true, ["fields"]);
add("catalog.list", "Tra cứu danh mục bác sĩ, phòng khám, dịch vụ", "/catalog", "GET", [
  field("kind", "Loại danh mục", false, { options: [...catalogKinds] }), text("q", "Tên hoặc mã danh mục", 100), field("active", "Đang sử dụng", false, { type: "boolean" }),
], "", true);
// The catalog API returns its scoped array; these filters are applied locally by the adapter.
HEALTHCARE_OPERATIONS.at(-1)!.assistantOnlyFields = ["kind", "q", "active"];
for (const item of HEALTHCARE_OPERATIONS.at(-1)!.fields) if (item.source === "body") item.source = "query";
add("catalog.create", "Tạo danh mục y tế", "/catalog", "POST", catalogFields, "settings");
add("catalog.update", "Cập nhật hoặc ngừng sử dụng danh mục y tế", "/catalog/:id", "PATCH", [identity("catalog", "Danh mục cần cập nhật"),
  ...catalogFields.filter(f => f.key !== "kind").map(optionalUpdateField)], "settings");
Object.assign(HEALTHCARE_OPERATIONS.at(-1)!, { systemBodyFields: ["revision"], mergeBodyWithReference: true });
add("staff.list", "Tra cứu nhân viên chăm sóc tại chi nhánh", "/staff", "GET", [], "care", true);
add("import.list", "Tra cứu lịch sử nhập Excel y tế", "/imports", "GET", [], "import", true);
add("import.detail", "Xem tiến độ và kết quả đợt nhập y tế", "/imports/:id", "GET", [identity("import", "Tên tệp hoặc đợt nhập")], "import", true);
add("import.rows", "Tra cứu từng dòng dữ liệu nhập y tế", "/imports/:id/rows/search", "POST", [identity("import", "Đợt nhập cần kiểm tra"),
  text("q", "Tên hoặc mã cần tìm trong tệp", 100), field("status", "Trạng thái dòng nhập", false, { options: ["ready", "imported", "skipped", "invalid"] }), ...paging()], "import", true,
  ["row", "sheet", "code", "label", "status", "message", "preview"]);
add("import.commit", "Xác nhận ghi dữ liệu Excel y tế đã kiểm tra", "/imports/:id/commit", "POST", [identity("import", "Đợt nhập đã kiểm tra")], "import");
add("import.retry", "Thử lại đợt nhập Excel y tế bị lỗi", "/imports/:id/retry", "POST", [identity("import", "Đợt nhập bị lỗi")], "import");
add("import.preview", "Kiểm tra tệp Excel bệnh nhân, lượt khám hoặc báo cáo bệnh viện", "/imports/preview/:kind", "POST", [
  field("path_kind", "Loại dữ liệu nhập", true, { source: "path", apiKey: "kind", options: ["patients", "visits", "hospital-report"] }),
  text("filename", "Tên tệp Excel", 180), field("rows", "Dữ liệu bảng đính kèm (tối đa 100 dòng)", true,
    { type: "json", structure: { type: "array", minItems: 1, maxItems: 100, items: { type: "object", open: true } } }),
], "import");
add("import.template", "Tải mẫu Excel bệnh nhân hoặc lượt khám", "/imports/template/:kind", "GET", [
  field("path_kind", "Loại mẫu Excel", true, { source: "path", apiKey: "kind", options: ["patients", "visits"] }),
], "import", true, ["filename"]);

export const healthcareWorkflowInstructions = [
  "Dùng chi nhánh của tài khoản; quản trị viên chưa gắn chi nhánh phải chọn chi nhánh theo tên trước khi tra cứu. Chọn bệnh nhân, hồ sơ, bác sĩ, phòng, dịch vụ và nhân viên theo tên, mã hoặc số điện thoại hiển thị, không yêu cầu mã nội bộ. Nếu trùng tên, hỏi để chọn đúng hồ sơ.",
  "Tạo bệnh nhân không cần hỏi mã hồ sơ: nếu người dùng không cung cấp, hệ thống tự sinh mã. Bác sĩ có thể chọn trong danh mục hoặc nhập doctorName cho bác sĩ ngoài ERP; không tự tạo danh mục bác sĩ và không hỏi lại danh mục khi đã có tên ngoài ERP.",
  "Chỉ ghi những thông tin người dùng cung cấp; không suy đoán chẩn đoán hoặc điều trị. Cập nhật giữ nguyên trường không được yêu cầu sửa và tự kiểm tra phiên bản. Chăm sóc có thể gắn với lượt khám cùng bệnh nhân; liên kết bệnh nhân, lượt khám, lịch hẹn đã lưu không được đổi. Hoàn tất chăm sóc phải có kết quả.",
  "Lịch hẹn phải có ngày giờ và múi giờ rõ ràng, theo mốc 15 phút, kết thúc sau bắt đầu và tối đa 8 giờ. Không tự chọn giờ kết thúc.",
  "Xóa bệnh nhân phải chọn rõ từng hồ sơ, xem số lượt khám, lịch hẹn và việc chăm sóc sẽ xóa kèm, rồi xác nhận. Nếu hồ sơ hoặc dữ liệu liên quan thay đổi sau bản xem trước, yêu cầu xem lại và xác nhận lại. Không tự chọn tất cả bệnh nhân theo một bộ lọc.",
  "Nhập Excel trong chat tối đa 100 dòng: kiểm tra tệp trước, xem kết quả từng dòng rồi xác nhận ghi bằng thao tác riêng; theo dõi tiến độ, không báo đã nhập xong khi tác vụ mới xếp hàng. Hiển thị kết quả bằng bảng tiếng Việt, không hiện mã nội bộ, phiên bản kỹ thuật, lời dẫn workflow hoặc trường tự điền mặc định.",
].join(" ");
