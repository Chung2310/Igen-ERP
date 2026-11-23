import { MODULE_LABELS, type ModuleKey } from "../../src/config/modules";
import type { AssistantOperation } from "./catalog";
import { assistantModuleContext } from "./module-context";

export type AssistantAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "approve"
  | "cancel"
  | "process"
  | "export"
  | "import"
  | "communicate"
  | "other";

export type AssistantIntent = "lookup" | "report" | AssistantAction;

export interface AssistantOperationMetadata {
  action: AssistantAction;
  intent: AssistantIntent;
  effect: "read" | "write";
  entityKey?: string;
  featureKey: string;
  featureLabel: string;
  confirmationRequired: boolean;
  requiredInputs: string[];
  capabilities: string[];
  /** Private retrieval index terms; these are not sent to the interpreter. */
  searchTerms: string[];
}

const SUFFIX_ACTIONS: Record<string, AssistantAction> = {
  add: "create", create: "create", clone: "create", duplicate: "create",
  list: "read", get: "read", detail: "read", details: "read", show: "read", search: "read", find: "read", lookup: "read", history: "read", status: "read", overview: "read",
  count: "read", summary: "read", report: "read", kpi: "read", analytics: "read", statistics: "read",
  update: "update", edit: "update", patch: "update", configure: "update", adjust: "update", restore: "update", activate: "update", deactivate: "update", archive: "update", enable: "update", disable: "update",
  delete: "delete", remove: "delete", destroy: "delete",
  approve: "approve", accept: "approve", reject: "approve",
  cancel: "cancel", revoke: "cancel",
  export: "export", download: "export",
  import: "import", upload: "import",
  send: "communicate", reply: "communicate", respond: "communicate", notify: "communicate",
  retry: "process", submit: "process", execute: "process", complete: "process", close: "process", reopen: "process", checkin: "process", checkout: "process", enroll: "process", assign: "process",
};

const ACTION_SYNONYMS: Record<AssistantAction, string[]> = {
  create: ["tạo", "thêm", "lập", "đăng ký", "ghi nhận"],
  read: ["xem", "tra cứu", "tìm", "lấy thông tin", "danh sách"],
  update: ["sửa", "cập nhật", "điều chỉnh", "thay đổi"],
  delete: ["xóa", "gỡ bỏ"],
  approve: ["duyệt", "phê duyệt", "chấp thuận", "từ chối"],
  cancel: ["hủy", "thu hồi"],
  process: ["xử lý", "thực hiện", "hoàn tất", "gửi đi"],
  export: ["xuất", "tải xuống", "excel"],
  import: ["nhập", "tải lên", "nhập hàng loạt"],
  communicate: ["gửi tin", "trả lời", "thông báo"],
  other: [],
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[đĐ]/g, "d").toLocaleLowerCase("vi").replace(/[^a-z0-9]+/g, " ").trim();

function inferredAction(operation: AssistantOperation): AssistantAction {
  const segments = operation.id.toLocaleLowerCase("en").split(".");
  for (const segment of segments.slice().reverse()) {
    const action = SUFFIX_ACTIONS[segment];
    if (action) return action;
  }
  const title = normalize(operation.title);
  if (/\b(xoa|go bo|delete|remove)\b/.test(title)) return "delete";
  if (/\b(huy|thu hoi|cancel)\b/.test(title)) return "cancel";
  if (/\b(duyet|phe duyet|chap thuan|tu choi|approve|reject)\b/.test(title)) return "approve";
  if (/\b(tao|them moi|them|lap moi|dang ky|ghi nhan)\b/.test(title)) return "create";
  if (/\b(cap nhat|chinh sua|sua|dieu chinh|thay doi|kich hoat|vo hieu)\b/.test(title)) return "update";
  if (/\b(xuat|tai xuong|export|excel)\b/.test(title)) return "export";
  if (/\b(nhap hang loat|tai len|import)\b/.test(title)) return "import";
  if (/\b(gui tin|tra loi|thong bao)\b/.test(title)) return "communicate";
  if (/\b(bao cao|tong hop|thong ke|dem so|kpi|phan tich)\b/.test(title) || operation.analysis) return "read";
  if (/\b(tra cuu|tim kiem|danh sach|chi tiet|trang thai|lich su|xem)\b/.test(title)) return "read";
  if (operation.method === "GET" || operation.readOnly) return "read";
  if (operation.confirmation || operation.method === "POST") return "create";
  if (operation.method === "DELETE") return "delete";
  if (operation.method === "PATCH" || operation.method === "PUT") return "update";
  return "other";
}

function entityKey(operation: AssistantOperation): string | undefined {
  const parts = operation.id.split(".").filter(Boolean);
  if (!parts.length || ["api", "workflow", "assistant", "worker-management"].includes(parts[0].toLowerCase())) return undefined;
  const moduleQualified = parts[0] === operation.module;
  if (moduleQualified) parts.shift();
  while (parts.length && SUFFIX_ACTIONS[parts.at(-1)!.toLowerCase()]) parts.pop();
  const generic = new Set(["report", "overview", "summary", "dashboard", "analytics", "statistics", "kpi", "count", "status", "history", "search", "list", "detail"]);
  const meaningful = parts.filter(part => !/^[a-f0-9]{12,}$/i.test(part));
  const keyParts = moduleQualified ? meaningful : meaningful.slice(0, 1);
  if (keyParts.some(part => generic.has(part.toLowerCase()))) return undefined;
  const key = keyParts.join(".");
  return key || undefined;
}

const FEATURE_LABELS: Record<string, string> = {
  employee: "Hồ sơ nhân sự",
  recruitment: "Tuyển dụng",
  contract: "Hợp đồng",
  calendar: "Lịch",
  payroll: "Lương",
  timekeeping: "Chấm công và lịch làm việc",
  department: "Phòng ban",
  project: "Dự án",
  task: "Công việc",
  training: "Đào tạo",
  leave: "Nghỉ phép",
  branch: "Chi nhánh",
  access: "Phân quyền",
  partner: "Đối tác",
  student: "Học viên",
  worker: "Người lao động",
  batch: "Lớp học",
  course: "Khóa học",
  inventory: "Kho",
  product: "Sản phẩm",
  customer: "Khách hàng",
  finance: "Tài chính",
  retail: "Bán lẻ",
  repair: "Sửa chữa",
  "partner-records": "Hồ sơ đối tác lao động",
  "partner-policies": "Chính sách đối tác lao động",
  "partner-referral-analysis": "Phân tích KPI và lượt giới thiệu lao động",
  "partner-kpi-setting": "Thiết lập KPI giới thiệu",
  "partner-referrals": "Lượt giới thiệu lao động",
  "partner-settlements": "Đối soát hoa hồng đối tác",
  "partner-commission-report": "Báo cáo hoa hồng đối tác",
  "partner-dashboard": "Tổng quan đối tác lao động",
  "partner-overview": "Tổng quan một đối tác lao động",
  "partner-payouts": "Chi trả hoa hồng đối tác",
  "partner-analysis": "Phân tích đối tác học viên",
  "partner-commission-settings": "Cấu hình hoa hồng đối tác học viên",
  "partner-bulk-management": "Quản lý hàng loạt đối tác học viên",
};

function featureDescriptor(operation: AssistantOperation) {
  const path = operation.path;
  if (operation.module === "labor-partner") {
    if (operation.analysis && /\/partners\/kpi(?:\/|$)/.test(path)) return { key: "partner-referral-analysis", label: FEATURE_LABELS["partner-referral-analysis"] };
    if (/\/partners\/kpi\//.test(path)) return { key: "partner-kpi-setting", label: FEATURE_LABELS["partner-kpi-setting"] };
    if (/\/partners\/policies(?:\/|$)/.test(path)) return { key: "partner-policies", label: FEATURE_LABELS["partner-policies"] };
    if (/\/partners\/(?:workers\/[^/]+\/referral|[^/]+\/referrals?)(?:\/|$)/.test(path)) return { key: "partner-referrals", label: FEATURE_LABELS["partner-referrals"] };
    if (/\/partners\/settlements(?:\/|$)/.test(path)) return { key: "partner-settlements", label: FEATURE_LABELS["partner-settlements"] };
    if (/\/partners\/reports\/commission(?:\/|$)/.test(path)) return { key: "partner-commission-report", label: FEATURE_LABELS["partner-commission-report"] };
    if (/\/partners\/(?:dashboard|[^/]+\/overview)(?:\/|$)/.test(path)) return { key: "partner-dashboard", label: FEATURE_LABELS["partner-dashboard"] };
    if (/\/partners\/(?:payouts|[^/]+\/payouts)(?:\/|$)/.test(path)) return { key: "partner-payouts", label: FEATURE_LABELS["partner-payouts"] };
    return { key: "partner-records", label: FEATURE_LABELS["partner-records"] };
  }
  if (operation.module === "student-partner") {
    if (operation.analysis) return { key: "partner-analysis", label: FEATURE_LABELS["partner-analysis"] };
    if (/\/partners\/commission-levels(?:\/|$)/.test(path)) return { key: "partner-commission-settings", label: FEATURE_LABELS["partner-commission-settings"] };
    if (/\/partners\/(?:payouts|[^/]+\/payouts)(?:\/|$)/.test(path)) return { key: "partner-payouts", label: "Chi trả hoa hồng đối tác học viên" };
    if (/\/partners\/bulk(?:\/|$)/.test(path)) return { key: "partner-bulk-management", label: FEATURE_LABELS["partner-bulk-management"] };
    return { key: "partner-records", label: "Hồ sơ đối tác học viên" };
  }

  const entity = entityKey(operation)?.split(".")[0];
  if (entity) return { key: entity, label: FEATURE_LABELS[entity] || entity };

  const route = path.split("/").filter(Boolean).filter(segment => !segment.startsWith(":"));
  while (["worker-management", "crud", "auth", "api", "v1"].includes(route[0])) route.shift();
  const idPrefix = operation.id.split(".").find(segment => !["api", "get", "post", "patch", "put", "delete"].includes(segment.toLowerCase()));
  const key = route[0] || idPrefix || "general";
  return { key, label: FEATURE_LABELS[key] || key.replace(/[-_]+/g, " ") };
}

function safeSearchTerms(operation: AssistantOperation, action: AssistantAction): string[] {
  const context = assistantModuleContext(operation.module);
  const sensitive = /password|secret|token|credential|cookie|authorization|mật khẩu|mã xác thực|khóa bí mật/i;
  const terms = [
    operation.id,
    operation.title,
    operation.description,
    MODULE_LABELS[operation.module as ModuleKey],
    ...context.aliases,
    ...ACTION_SYNONYMS[action],
    ...operation.fields.map(field => field.label),
    ...Object.entries(operation.analysis?.fields || {}).flatMap(([key, field]) => [key, field.label, ...(field.aliases || [])]),
  ];
  const seen = new Set<string>();
  return terms.flatMap(term => {
    const clean = term?.trim().replace(/\s+/g, " ");
    const normalized = clean ? normalize(clean) : "";
    if (!clean || normalized.length < 2 || sensitive.test(clean) || seen.has(normalized)) return [];
    seen.add(normalized);
    return [clean];
  });
}

export function buildAssistantOperationMetadata(operation: AssistantOperation): AssistantOperationMetadata {
  const effect = operation.readOnly || operation.method === "GET" ? "read" : "write";
  const action = effect === 'read' ? 'read' : inferredAction(operation);
  const feature = featureDescriptor(operation);
  const report = action === "read" && Boolean(operation.analysis || /\b(report|summary|count|kpi|overview|analytics|statistics)\b/i.test(operation.id)
    || /báo cáo|tổng hợp|thống kê|đếm số|chỉ số/i.test(operation.title));
  const capabilities = new Set<string>();
  if (operation.analysis) capabilities.add("analysis");
  if (operation.analysis?.pagination) capabilities.add("pagination");
  if (operation.fields.some(field => field.reference)) capabilities.add("reference-resolution");
  if (operation.fields.some(field => field.source === "query")) capabilities.add("query-filters");
  if (operation.partialUpdate) capabilities.add("partial-update");
  if (operation.confirmation) capabilities.add("confirmation-required");
  if (operation.fields.some(field => field.key.toLowerCase() === "version" || field.apiKey?.toLowerCase() === "version")) capabilities.add("version-input");
  if (operation.fields.some(field => field.minItems !== undefined || field.structure?.items)) capabilities.add("collection-input");
  if (/batch|bulk|import/i.test(operation.id)) capabilities.add("bulk-operation");
  if (action === "export" || action === "import"
    || /file|image|attachment|excel|upload|download|tệp|tập tin|ảnh|đính kèm/i.test(`${operation.title} ${operation.description}`)) capabilities.add("file-related");
  if (operation.resultFields.length) capabilities.add("structured-results");
  return {
    action,
    intent: report ? "report" : action === "read" ? "lookup" : action,
    effect,
    ...(entityKey(operation) ? { entityKey: entityKey(operation) } : {}),
    featureKey: feature.key,
    featureLabel: feature.label,
    confirmationRequired: Boolean(operation.confirmation),
    requiredInputs: operation.fields.filter(field => field.required || field.systemRequired).map(field => field.key),
    capabilities: [...capabilities],
    searchTerms: safeSearchTerms(operation, action),
  };
}
