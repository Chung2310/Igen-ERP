import { isTabHidden, MODULE_LABELS, MODULE_TAB_MAP } from "../../src/config/modules";
import type { AssistantOperation } from "./catalog";
import { manualProcedure } from "./manual-guide-procedures";
import { manualScreen } from "./manual-guide-routes";
import { isProtectedAssistantKey } from "./structured-data";
import { PAYROLL_FORMULA_LIBRARY_ENABLED } from "../../src/config/payrollFeatureFlags";
import { MANUAL_GUIDE_UNAVAILABLE } from "./manual-guide-unavailable";

export type ManualGuideStatus = "procedure" | "navigation-only" | "unverified" | "ui-unavailable";
export function publicGuideFields(op: AssistantOperation) {
  return op.fields.filter(f => !isProtectedAssistantKey(f.key) && !isProtectedAssistantKey(f.apiKey || f.key)
    && !/mật khẩu|bí mật|token|phiên bản/i.test(f.label))
    .map(f => ({ label: f.label, required: Boolean(f.required || f.systemRequired),
      purpose: f.source === "path" || f.type === "reference" ? "Chọn đúng bản ghi" : f.source === "query" ? "Điều kiện tra cứu" : "Thông tin nhập",
      ...(f.options ? { options: f.options } : {}) }));
}

export function buildManualGuide(op: AssistantOperation) {
  const screen = manualScreen(op.module, op.path);
  const procedure = manualProcedure(op);
  const tab = MODULE_TAB_MAP[op.module];
  const hidden = Boolean(tab && isTabHidden(tab));
  // These legacy panels are not mounted by the current payroll workspace.
  const unavailable = MANUAL_GUIDE_UNAVAILABLE[op.id]?.reason || (!PAYROLL_FORMULA_LIBRARY_ENABLED && /^\/payroll\/formulas(?:\/|$)/.test(op.path)
    ? "Thư viện công thức lương hiện bị tắt trong giao diện; chưa có hướng dẫn thủ công khả dụng cho thao tác này."
    : /^\/payroll\/(?:payments\/|runs\/:id\/payments$)/.test(op.path)
      ? "Màn hình quản lý đợt thanh toán lương riêng chưa được nối vào ứng dụng hiện tại. Không dùng Đánh dấu đã thanh toán để thay thế thao tác trên một đợt thanh toán."
      : op.method === "PUT" && /^\/payroll\/periods\/:periodKey\/inputs(?:\/|$)/.test(op.path)
        ? "Biểu mẫu sửa dữ liệu đầu vào lương riêng chưa được nối vào ứng dụng hiện tại. Không dùng sửa khoản lương để thay thế thao tác này."
        : undefined);
  const status: ManualGuideStatus = hidden || unavailable ? "ui-unavailable" : screen && procedure ? "procedure" : screen ? "navigation-only" : "unverified";
  const base = screen?.base || op.link?.split("?")[0];
  const link = !hidden && !unavailable && screen && base?.startsWith("/") && !base.startsWith("//") && !/[\\\s]/.test(base)
    ? base + (screen.sub ? `?sub=${screen.sub}` : "") : undefined;
  const reason = hidden ? "Phân hệ này hiện bị ẩn khỏi điều hướng ứng dụng; chưa có luồng thao tác thủ công khả dụng qua phân hệ này."
    : unavailable || (!screen ? "Chưa xác minh được màn hình và các bước thao tác thủ công cho chức năng này."
    : !procedure ? "Đã xác định màn hình liên quan, nhưng chưa xác minh đủ các bước cho thao tác này; không coi đây là hướng dẫn hoàn chỉnh."
    : "Đã đối chiếu các bước với mã nguồn giao diện; chưa thay thế kiểm thử trực tiếp bằng tài khoản thực tế.");
  return {
    operationId: op.id, title: op.title, module: op.module, moduleLabel: MODULE_LABELS[op.module],
    status, reason, link, screen: screen?.screen, fields: publicGuideFields(op),
    prerequisites: ["Đăng nhập đúng doanh nghiệp, chọn đúng chi nhánh và có quyền sử dụng chức năng.",
      ...(op.method !== "GET" && !op.readOnly ? ["Nếu trợ lý báo chưa xác định kết quả, kiểm tra bản ghi/lịch sử trước; không thực hiện lại khi dữ liệu đã được lưu."] : []),
      ...(screen?.note ? [screen.note] : [])],
    steps: status === "procedure" ? [`Mở ${screen!.navigationLabel || MODULE_LABELS[op.module]} → ${screen!.screen}.`, ...procedure!.steps] : [],
    evidence: [...(screen ? [{ file: screen.file, contains: "", kind: "navigation" as const }] : []),
      ...(MANUAL_GUIDE_UNAVAILABLE[op.id]?.files.map(file => ({ file, contains: "", kind: "audit" as const })) || []),
      ...(procedure ? procedure.evidence.map(e => ({ ...e, kind: "procedure" as const })) : [])],
    procedureId: status === "procedure" ? procedure!.id : undefined,
  };
}
