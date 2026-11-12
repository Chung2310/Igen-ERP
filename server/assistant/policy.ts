import { validateStructuredField } from "./structured-data";
import type { AssistantField, AssistantValue, AssistantWorkflow, AssistantWorkflowUpdate } from "../../src/shared/assistant-workflow";
import { defaultWorkflow, operationById, type AssistantOperation } from "./catalog";
export class AssistantError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function isBlank(value: unknown) { return value === undefined || value === null || (typeof value === "string" && !value.trim()); }
const RETAIL_PARTNER_RELATION_ROLES: Readonly<Record<string, { role: string; label: string }>> = {
  supplierId: { role: "supplier", label: "nhà cung cấp" },
  userId: { role: "collaborator", label: "cộng tác viên" },
  customerId: { role: "dealer", label: "đại lý" },
};
export function isAssistantFieldApplicable(workflow: AssistantWorkflow, field: AssistantField) {
  if (!workflow.actionId?.startsWith("retail.partner.create.")) return true;
  const relationRole = RETAIL_PARTNER_RELATION_ROLES[field.apiKey || field.key];
  const fixedRole = operationById(workflow.actionId)?.fixedBodyValues?.role;
  return !relationRole || fixedRole === relationRole.role;
}
function containsRelationship(shape: AssistantField["structure"]): boolean {
  if (!shape) return false;
  if (shape.reference) return true;
  return Object.values(shape.keys || {}).some(containsRelationship) || containsRelationship(shape.items);
}
export function validateField(field: AssistantField, value: unknown): AssistantValue {
  if (!["string", "number", "boolean"].includes(typeof value)) throw new AssistantError(`${field.label}: giá trị không hợp lệ.`);
  if (field.type === "json") { try { return validateStructuredField(field, value); } catch (error) { throw new AssistantError((error as Error).message); } }
  const normalized = typeof value === "string" ? value.trim() : value as AssistantValue;
  if (typeof normalized === "string" && normalized.length > 4000) throw new AssistantError(`${field.label}: tối đa 4.000 ký tự.`);
  if (typeof normalized === "string" && field.max !== undefined && normalized.length > field.max) throw new AssistantError(`${field.label}: tối đa ${field.max} ký tự.`);
  if (field.type === "number" && (typeof normalized !== "number" || !Number.isFinite(normalized) || normalized < (field.min ?? -Infinity))) throw new AssistantError(`${field.label}: cần một số hợp lệ, không nhỏ hơn ${field.min ?? 0}.`);
  if (field.type === "number" && field.max !== undefined && Number(normalized) > field.max) throw new AssistantError(`${field.label}: vượt quá ${field.max}.`);
  if (field.type === "number" && field.integer && (typeof normalized !== "number" || !Number.isSafeInteger(normalized))) throw new AssistantError(`${field.label}: cần một số nguyên hợp lệ.`);
  if (field.type === "boolean" && typeof normalized !== "boolean") throw new AssistantError(`${field.label}: cần giá trị bật hoặc tắt.`);
  if (!["number", "boolean"].includes(field.type) && typeof normalized !== "string") throw new AssistantError(`${field.label}: cần nội dung văn bản.`);
  const str = String(normalized);
  if (field.type === "number" && field.exclusiveMin && typeof normalized === "number" && normalized <= (field.min ?? -Infinity)) throw new AssistantError(`${field.label}: must be greater than ${field.min ?? 0}.`);
  if (field.pattern && (typeof normalized !== "string" || !new RegExp(field.pattern).test(str))) throw new AssistantError(`${field.label}: định dạng không hợp lệ.`);
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) throw new AssistantError(`${field.label}: email không hợp lệ.`);
  if (field.type === "phone" && !/^(?:0|\+84|84)[0-9]{9}$/.test(str)) throw new AssistantError(`${field.label}: dùng số điện thoại Việt Nam, ví dụ 0987654321.`);
  if (field.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(str) || !Number.isFinite(Date.parse(str)) || new Date(str).toISOString().slice(0, 10) !== str)) throw new AssistantError(`${field.label}: dùng ngày có thực theo định dạng YYYY-MM-DD.`);
  if (field.type === "datetime" && (!/^\d{4}-\d{2}-\d{2}T/.test(str) || !Number.isFinite(Date.parse(str)))) throw new AssistantError(`${field.label}: cần ngày giờ hợp lệ.`);
  if (["birthDate", "dateOfBirth"].includes(field.key) && str > new Date().toISOString().slice(0, 10)) throw new AssistantError(`${field.label}: không được ở tương lai.`);
  if (field.options && !field.options.includes(str)) throw new AssistantError(`${field.label}: chọn ${field.options.join(", ")}.`);
  return normalized as AssistantValue;
}
export function validateWorkflow(op: AssistantOperation, input: AssistantWorkflowUpdate): AssistantWorkflow {
  if (!input || !Number.isInteger(input.version) || typeof input.enabled !== "boolean" || typeof input.requireConfirmation !== "boolean" || typeof input.instructions !== "string" || input.instructions.length > 2000) throw new AssistantError("Cấu hình workflow không hợp lệ.");
  if (input.sourceText !== undefined && (typeof input.sourceText !== "string" || !input.sourceText.trim() || input.sourceText.length > 12000)) throw new AssistantError("Mô tả workflow cần từ 1 đến 12.000 ký tự.");
  if (op.confirmation && !input.requireConfirmation) throw new AssistantError("Thao tác này luôn cần xác nhận, không thể tắt.");
  if (!Array.isArray(input.fields) || input.fields.length !== op.fields.length || new Set(input.fields.map(f => f.key)).size !== op.fields.length) throw new AssistantError("Workflow phải giữ đủ các trường của thao tác.");
  const fields = input.fields.map(rule => {
    const field = op.fields.find(f => f.key === rule.key);
    if (!field || typeof rule.required !== "boolean") throw new AssistantError("Trường workflow không được hỗ trợ.");
    if (field.systemRequired && !rule.required) throw new AssistantError(`${field.label} là trường bắt buộc của hệ thống.`);
    if ((field.reference || containsRelationship(field.structure)) && rule.defaultValue !== undefined) throw new AssistantError(`${field.label}: trường liên kết phải được người dùng chọn theo tên hoặc mã, không thể đặt mặc định.`);
    const { defaultValue: _default, ...base } = field;
    return { ...base, required: rule.required, ...(rule.defaultValue === undefined ? {} : { defaultValue: validateField(field, rule.defaultValue) }) };
  });
  return { ...defaultWorkflow(op), ...(input.sourceText === undefined ? {} : { sourceText: input.sourceText.trim() }), fields, enabled: input.enabled, instructions: input.instructions.trim(), requireConfirmation: input.requireConfirmation, version: input.version + 1 };
}
export function collectValues(workflow: AssistantWorkflow, provided: Record<string, unknown>) {
  const values: Record<string, AssistantValue> = {};
  const missing: string[] = [];
  const errors: string[] = [];
  const defaulted: string[] = [];
  const relationshipFields = new Set(workflow.fields.filter(field => field.reference || containsRelationship(field.structure)).map(field => field.key));
  const conditionValues = Object.fromEntries(workflow.fields.map(field => [field.key, isBlank(provided[field.key]) ? (relationshipFields.has(field.key) ? undefined : field.defaultValue) : provided[field.key]]));
  const conditionApplies = (field: AssistantField) => {
    const condition = field.requiredWhen;
    if (!condition) return false;
    const candidate = conditionValues[condition.field];
    if (condition.present) return !isBlank(candidate);
    if (condition.equals === undefined) return false;
    return (Array.isArray(condition.equals) ? condition.equals : [condition.equals]).some(value => value === candidate);
  };
  for (const field of workflow.fields) {
    if (!isAssistantFieldApplicable(workflow, field)) {
      const relationRole = RETAIL_PARTNER_RELATION_ROLES[field.apiKey || field.key];
      if (relationRole && !isBlank(provided[field.key])) errors.push(`${field.label} chỉ áp dụng cho vai trò ${relationRole.label}.`);
      continue;
    }
    let value = provided[field.key];
    if (isBlank(value) && field.defaultValue !== undefined && !relationshipFields.has(field.key)) { value = field.defaultValue; defaulted.push(field.key); }
    if (isBlank(value)) {
      const alternativeSatisfied = Boolean(field.alternativeField && !isBlank(conditionValues[field.alternativeField]));
      if (!alternativeSatisfied && (field.systemRequired || field.required || conditionApplies(field))) {
        const requiredStructuredFields = field.type === "json" && field.structure?.type === "object"
          ? Object.entries(field.structure.keys || {}).filter(([, shape]) => shape.required && !shape.reference)
          : [];
        if (requiredStructuredFields.length) {
          missing.push(...requiredStructuredFields.map(([key, shape]) => `${field.label} · ${shape.label || key}`));
        } else if (workflow.actionId === "quotation.customer-quote.create" && field.key === "items") {
          missing.push("Sản phẩm khách hàng cần báo giá (chọn sản phẩm từ bảng giá hoặc nhập Yêu cầu khách hàng để AI gợi ý)");
        } else missing.push(field.label);
      }
      continue;
    }
    try {
      if (field.type === "json") {
        const missingStructuredFields: string[] = [];
        values[field.key] = validateStructuredField(field, value, { allowMissingRequired: true, missingRequired: missingStructuredFields });
        missing.push(...missingStructuredFields.map(label => `${field.label} · ${label}`));
      } else values[field.key] = validateField(field, value);
    } catch (error) { errors.push((error as Error).message); }
  }
  const operation = operationById(workflow.actionId);
  if (operation && ["POST", "PATCH"].includes(operation.method) && /^\/worker-management\/partners\/policies(?:\/[^/]+)?$/.test(operation.path)) {
    const readObject = (key: string): Record<string, unknown> | undefined => {
      const raw = values[key];
      if (typeof raw !== "string") return undefined;
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
      } catch { return undefined; }
    };
    const settlementCycle = readObject("settlementCycle");
    const official = readObject("official");
    const seasonal = readObject("seasonal");
    const effectiveFrom = values.effectiveFrom;
    const effectiveTo = values.effectiveTo;
    if (typeof effectiveFrom === "string" && typeof effectiveTo === "string" && effectiveTo < effectiveFrom) {
      errors.push("Ngày hiệu lực đến phải từ ngày áp dụng trở đi.");
    }
    if (official && seasonal && typeof official.enabled === "boolean" && typeof seasonal.enabled === "boolean" && !official.enabled && !seasonal.enabled) {
      errors.push("Cần bật ít nhất một cơ chế: hoa hồng chính thức hoặc hoa hồng thời vụ.");
    }
    if (settlementCycle?.type === "calendar_month" && settlementCycle.cutoffDay !== undefined && settlementCycle.cutoffDay !== null) {
      errors.push("Chu kỳ theo tháng dương lịch không dùng ngày chốt riêng.");
    }
    if (official?.enabled === false && official.maxMonths !== undefined && official.maxMonths !== null) {
      errors.push("Số tháng tối đa chỉ áp dụng khi bật hoa hồng chính thức.");
    }
    if (seasonal?.enabled === false && [seasonal.aggregationScope, seasonal.tierMode].some(value => value !== undefined && value !== null)) {
      errors.push("Phạm vi tổng hợp và cách tính bậc chỉ áp dụng khi bật hoa hồng thời vụ.");
    }
    if (official?.enabled === true) {
      const maxMonths = official.maxMonths;
      const milestones = Array.isArray(official.milestones) ? official.milestones as Record<string, unknown>[] : undefined;
      if (typeof maxMonths === "number" && milestones && milestones.length !== maxMonths) {
        errors.push(`Các mốc hoa hồng cần có đủ ${maxMonths} mốc theo số tháng tối đa đã chọn.`);
      }
      const months = new Set<number>();
      milestones?.forEach((milestone, index) => {
        if (typeof milestone.month === "number") {
          if (typeof maxMonths === "number" && milestone.month > maxMonths) {
            errors.push(`Các mốc hoa hồng · Mục ${index + 1}: tháng làm việc không được vượt quá ${maxMonths} tháng đã chọn.`);
          }
          if (months.has(milestone.month)) errors.push(`Các mốc hoa hồng: tháng ${milestone.month} đang bị lặp.`);
          months.add(milestone.month);
        }
        if (milestone.eligibilityRule === "attendance_threshold" && isBlank(milestone.minWorkedDays) && isBlank(milestone.minWorkedHours)) {
          errors.push(`Các mốc hoa hồng · Mục ${index + 1}: điều kiện chấm công cần có số ngày hoặc số giờ làm tối thiểu.`);
        }
      });
    }
    if (seasonal?.enabled === true) {
      const minHours = typeof seasonal.minHoursPerWorker === "number" ? seasonal.minHoursPerWorker : 0;
      const maxEligibleHours = seasonal.maxEligibleHoursPerWorker;
      if (typeof maxEligibleHours === "number" && maxEligibleHours < minHours) {
        errors.push("Số giờ tối đa được tính mỗi người phải lớn hơn hoặc bằng số giờ tối thiểu.");
      }
      const tiers = Array.isArray(seasonal.tiers) ? seasonal.tiers as Record<string, unknown>[] : undefined;
      if (tiers?.length === 0) errors.push("Các bậc giờ hoa hồng cần có ít nhất một bậc.");
      if (tiers?.length) {
        let expectedMin = 0;
        tiers.forEach((tier, index) => {
          const min = tier.minHours;
          const max = tier.maxHours;
          const validFirstStart = index === 0 && (min === 0 || min === minHours);
          if (typeof min !== "number" || (index === 0 ? !validFirstStart : min !== expectedMin)) {
            errors.push("Các bậc giờ phải liên tục, bắt đầu từ 0 hoặc ngưỡng giờ tối thiểu và không chồng lấn.");
          }
          if (index === tiers.length - 1 && max !== undefined && max !== null) {
            errors.push("Bậc giờ cuối không nhập giới hạn trên để áp dụng không giới hạn.");
          } else if (index < tiers.length - 1 && (typeof max !== "number" || typeof min !== "number" || max <= min)) {
            errors.push(`Các bậc giờ · Mục ${index + 1}: giới hạn trên phải lớn hơn giới hạn dưới.`);
          }
          if (typeof max === "number") expectedMin = max;
        });
      }
    }
  }
  if (["training.create", "training.update"].includes(workflow.actionId)) {
    const readArray = (key: string): unknown[] | undefined => {
      const raw = values[key];
      if (typeof raw !== "string") return undefined;
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : undefined;
      } catch { return undefined; }
    };
    const lessons = readArray("lessons");
    lessons?.forEach((lesson, index) => {
      if (!lesson || typeof lesson !== "object" || Array.isArray(lesson)) return;
      const item = lesson as Record<string, unknown>;
      if (![item.url, item.content].some(value => typeof value === "string" && value.trim())) {
        errors.push(`Bài giảng · Mục ${index + 1}: cần đường dẫn hoặc nội dung.`);
      }
    });
    const quizzes = readArray("quizzes");
    quizzes?.forEach((quiz, index) => {
      if (!quiz || typeof quiz !== "object" || Array.isArray(quiz)) return;
      const item = quiz as Record<string, unknown>;
      const options = Array.isArray(item.options) ? item.options : [];
      if (!Number.isSafeInteger(item.correctOptionIndex) || Number(item.correctOptionIndex) < 0 || Number(item.correctOptionIndex) >= options.length) {
        errors.push(`Câu hỏi trắc nghiệm · Mục ${index + 1}: đáp án đúng phải trỏ tới một phương án có trong danh sách.`);
      }
    });
  }
  for (const key of Object.keys(provided)) if (!workflow.fields.some(f => f.key === key)) errors.push(`Trường không được hỗ trợ: ${key}.`);
  return { values, missing, errors, defaulted };
}
