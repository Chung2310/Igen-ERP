import { createHash, randomUUID } from "node:crypto";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { AssistantDataShape, AssistantField, AssistantQuotationAcceptanceForm, AssistantQuotationAcceptanceLinesInput, AssistantReferenceSelection, AssistantReply, AssistantTableAttachment, AssistantTrainingContentForm, AssistantValue, AssistantWorkflow } from "../../src/shared/assistant-workflow";
import { TRAINING_CATEGORY_OPTIONS } from "../../src/shared/training-categories";
import { AssistantDocumentModel, AssistantSessionModel, AssistantTurnModel, ensureAssistantIndexes } from "./models";
import { actorScope, assertOperation, currentWorkflow, listWorkflows } from "./workflows";
import { AssistantError, collectValues, isAssistantFieldApplicable, isBlank } from "./policy";
import { callOperation, lookupRecords, projectRecords, resolveNamedReferenceSelectors, resolveReferences, suggestReferenceOptions, UncertainExecutionError } from "./executor";
import { getSettings } from "./settings";
import { directStudentRecordActionId, directWorkerRecordActionId, interpretRequest, isEmployeeDetailsIntent } from "./interpreter";
import { ASSISTANT_OPERATIONS, operationById, type AssistantOperation } from "./catalog";
import { formatFriendlyAssistantResult, localizedAssistantFieldLabel } from "./result-format";
import { presentAssistantReply } from "./reply-presentation";
import { applyAssistantResponseRules } from "./reply-rules";
import { assistantRequestGuidance } from "./request-guidance";
import { autoSaveAssistantMemories } from "./auto-memory";
import { assistantMemoryContext, containsSensitiveMemoryContent, forgetAssistantMemoryByContent, parseExplicitMemoryCommand, parseExplicitMemoryForgetCommand, saveAssistantMemory } from "./memory";
import { SESSION_MEMORY_LIMIT, summarizeAssistantSession } from "./session-memory";
import { mapAssistantTableAttachment } from "./table-import";
import { normalizeAssistantReply } from "./general-answer";
import { answerAssistantConversation } from "./documents";
import { decorateHealthcareResult, healthcareAttachment } from "./healthcare-executor";
import { formatHealthcareResult, healthcareValue } from "./healthcare-result";
import { formatQuotationResult, quotationValue } from "./quotation-result";
import { formatAssistantTemporalValue } from "../../src/shared/assistant-date";
import { completeAssistantOperation, hasAssistantUpdatePayload as hasUpdatePayload, type AssistantCompletion } from "./completion";
import { projectInstructionsForConversation } from "./projects";
import { readAssistantConversationFile, type AssistantConversationFileContext } from "./conversation-file";
export { missingOptionalCreateFields } from "./completion";
const ASSISTANT_TURN_RECOVERY_WINDOW_MS = 8 * 60_000;
export interface TurnInput { conversationId: string; requestId: string; projectId?: string; mode?: "work" | "qa"; research?: boolean; text?: string; attachment?: AssistantTableAttachment; conversationUpload?: { buffer: Buffer; fileName: string }; referenceSelections?: Record<string, string[]>; skipReferenceKeys?: string[]; trainingContent?: AssistantTrainingContentForm; acceptanceLines?: AssistantQuotationAcceptanceLinesInput; decision?: { id: string; confirmed: boolean; password?: string }; }
interface PendingAction { id: string; actionId: string; provided: Record<string, unknown>; intent: string; resolved?: Record<string, AssistantValue>; selectedProductVariant?: { productId: string; variantId: string }; explicitReferenceKeys?: string[]; workflowVersion: number; preview: NonNullable<AssistantReply["action"]>; attachmentSummary?: { fieldKey: string; fileName: string; rowCount: number }; confirmationDetails?: Record<string, Array<{ label: string; value: string }>>; awaitingReferenceKeys?: string[]; awaitingReferenceLabels?: Record<string, string>; awaitingPathReferenceKeys?: string[]; skippedReferenceKeys?: string[]; referenceSelections?: AssistantReferenceSelection[]; defaultedKeys?: string[]; }
function restorePendingActionId(pending: PendingAction | null): PendingAction | null {
  if (!pending || operationById(pending.actionId)) return pending;
  const previousTitle = String(pending.preview?.title || "").trim();
  if (!previousTitle) return pending;
  const matches = ASSISTANT_OPERATIONS.filter(operation => operation.title.trim() === previousTitle);
  return matches.length === 1 ? { ...pending, actionId: matches[0].id } : pending;
}
const internalAssistantIdPattern = /\b(?:[a-f\d]{24}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})\b/gi;
function hideInternalAssistantIds(value: string): string;
function hideInternalAssistantIds(value: AssistantValue): AssistantValue;
function hideInternalAssistantIds(value: AssistantValue): AssistantValue {
  return typeof value === "string" ? value.replace(internalAssistantIdPattern, "Bản ghi đã chọn") : value;
}
function safeAssistantPreviewFieldValue(field: AssistantField, rawValue: AssistantValue, displayValue: AssistantValue): AssistantValue {
  if (field.reference && (typeof displayValue === "number" || (typeof displayValue === "string" && /^\d{6,32}$/.test(displayValue.trim())))) {
    return "Bản ghi đã chọn";
  }
  if (field.reference && typeof rawValue === "string" && /^\d{6,32}$/.test(rawValue.trim()) && displayValue === rawValue) {
    return "Bản ghi đã chọn";
  }
  const visibleValue = hideInternalAssistantIds(displayValue);
  return (typeof visibleValue === "string" && ["date", "datetime"].includes(field.type)
    ? formatAssistantTemporalValue(visibleValue) : undefined) ?? visibleValue;
}
function sanitizeActionPreview(preview: NonNullable<AssistantReply["action"]>, operation?: AssistantOperation) {
  return { ...preview, values: preview.values.filter(item => !item.defaulted).map(item => {
    const field = operation?.fields.find(candidate => candidate.label === item.label);
    return { ...item, value: field ? safeAssistantPreviewFieldValue(field, item.value, item.value) : hideInternalAssistantIds(item.value) };
  }) };
}
function sanitizeReplyPreview(reply: AssistantReply | null | undefined, operation?: AssistantOperation, mode: TurnInput["mode"] = "work"): AssistantReply | null {
  if (!reply) return null;
  const sanitized = { ...reply, ...(reply.action ? { action: sanitizeActionPreview(reply.action, operation) } : {}) };
  return mode === "qa" ? sanitized : presentAssistantReply(sanitized);
}
const isAssistantRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
function parseStructuredAssistantValue(value: unknown) {
  if (typeof value !== "string") return value && typeof value === "object" ? value : undefined;
  try { return JSON.parse(value); } catch { return undefined; }
}
function requireExplicitReceiptItemSelections(op: AssistantOperation, values: Record<string, unknown>, selectedKeys: ReadonlySet<string>) {
  if (op.id !== "inventory.receipt.create" || typeof values.items !== "string") return;
  const items = parseStructuredAssistantValue(values.items);
  if (!Array.isArray(items)) return;
  items.forEach((item, index) => {
    if (!isAssistantRecord(item)) return;
    for (const key of ["productId", "variantId"]) {
      if (!selectedKeys.has(`items[${index + 1}].${key}`)) delete item[key];
    }
  });
  values.items = JSON.stringify(items);
}
function mergeStructuredAssistantValue(previous: unknown, incoming: unknown, shape: AssistantDataShape | undefined): unknown {
  if (isBlank(incoming) && !isBlank(previous)) return previous;
  if (shape?.type === "object" && isAssistantRecord(previous) && isAssistantRecord(incoming)) {
    const merged = { ...previous };
    for (const [key, value] of Object.entries(incoming)) {
      merged[key] = Object.prototype.hasOwnProperty.call(previous, key)
        ? mergeStructuredAssistantValue(previous[key], value, shape.keys?.[key])
        : value;
    }
    return merged;
  }
  if (shape?.type === "array" && Array.isArray(previous) && Array.isArray(incoming)) {
    if (!incoming.length && previous.length) return previous;
    return incoming.map((value, index) => index < previous.length
      ? mergeStructuredAssistantValue(previous[index], value, shape.items)
      : value);
  }
  return incoming;
}
function normalizeStructuredAssistantValues(op: AssistantOperation, values: Record<string, unknown>, previous: Record<string, unknown> = {}) {
  const normalized = { ...values };
  for (const field of op.fields) {
    if (field.type !== "json" || normalized[field.key] === undefined) continue;
    const incoming = parseStructuredAssistantValue(normalized[field.key]);
    const prior = parseStructuredAssistantValue(previous[field.key]);
    if (incoming === undefined) {
      // A plain-language reply can be mistakenly assigned to a JSON field by
      // the interpreter. Preserve the valid partial object already collected
      // (for example, the selected SKU unit) instead of replacing it with that
      // raw sentence and losing the user's choice.
      if (prior !== undefined) normalized[field.key] = JSON.stringify(prior);
      continue;
    }
    normalized[field.key] = JSON.stringify(prior === undefined
      ? incoming
      : mergeStructuredAssistantValue(prior, incoming, field.structure));
  }
  return normalized;
}
const acceptanceFieldAliases: Record<string, string> = {
  acceptanceDate: "acceptedDate",
  acceptanceLocation: "location",
  acceptanceResult: "result",
  handedOverDocuments: "handoverDetails",
  finalSettlementValue: "settlementAmount",
};
function parseVietnameseClock(hourText: string, minuteText = "0", period = "") {
  let hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) return "";
  if ((period === "chieu" || period === "toi") && hour < 12) hour += 12;
  if (period === "sang" && hour === 12) hour = 0;
  if (period === "trua" && hour > 0 && hour < 11) hour += 12;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function parseVietnameseTimeRange(text: string) {
  const normalized = normalizeAssistantText(text);
  const match = normalized.match(/(?:\btu\s+)?(\d{1,2})\s*(?:h|:)\s*(?:(\d{1,2})\s*(?:p|phut)?)?\s*(sang|trua|chieu|toi)?\s*(?:den|toi)\s*(\d{1,2})\s*(?:h|:)\s*(?:(\d{1,2})\s*(?:p|phut)?)?\s*(sang|trua|chieu|toi)?\b/);
  if (!match) return undefined;
  const startTime = parseVietnameseClock(match[1], match[2], match[3]);
  const endTime = parseVietnameseClock(match[4], match[5], match[6]);
  return startTime && endTime ? { startTime, endTime } : undefined;
}
function normalizeAcceptanceValues(op: AssistantOperation, values: Record<string, unknown>, responseText: string) {
  if (!op.id.startsWith("quotation.acceptance.")) return values;
  const normalized = { ...values };
  const fieldKeys = new Set(op.fields.map(field => field.key));
  for (const [alias, key] of Object.entries(acceptanceFieldAliases)) {
    if (!fieldKeys.has(key)) continue;
    if ((normalized[key] === undefined || isBlank(normalized[key])) && normalized[alias] !== undefined && !isBlank(normalized[alias])) {
      normalized[key] = normalized[alias];
    }
    delete normalized[alias];
  }

  const response = normalizeAssistantText(responseText);
  const mentionsAbsence = /\b(?:k|ko|khong|chua)\s*(?:co|can|phat sinh)?\b/.test(response);
  if (mentionsAbsence) {
    if (/\b(?:ho so ban giao|ban giao)\b/.test(response)) normalized.handoverDetails = "Không có";
    if (/\b(?:danh gia chat luong|chat luong)\b/.test(response)) normalized.qualityAssessment = "Không có";
    if (/\b(?:gia tri quyet toan|quyet toan)\b/.test(response)) delete normalized.settlementAmount;
    if (/\b(?:so tien da thanh toan|da thanh toan|thanh toan)\b/.test(response)) delete normalized.amountPaid;
  }
  const responseWithoutEndingPunctuation = response.replace(/[.!?,;:]+$/, "").trim();
  if (/\b(?:gia tri quyet toan|quyet toan)\s*$/.test(responseWithoutEndingPunctuation)) delete normalized.settlementAmount;
  if (/\b(?:so tien da thanh toan|da thanh toan)\s*$/.test(responseWithoutEndingPunctuation)) delete normalized.amountPaid;

  const timeRange = parseVietnameseTimeRange(responseText);
  if (timeRange && fieldKeys.has("startTime") && fieldKeys.has("endTime")) Object.assign(normalized, timeRange);
  for (const key of ["startTime", "endTime"]) {
    const value = normalized[key];
    if (typeof value !== "string") continue;
    const time = normalizeAssistantText(value).match(/^(\d{1,2})\s*(?:h|:)\s*(?:(\d{1,2})\s*(?:p|phut)?)?\s*(sang|trua|chieu|toi)?$/);
    if (time) {
      const parsed = parseVietnameseClock(time[1], time[2], time[3]);
      if (parsed) normalized[key] = parsed;
    }
  }
  return normalized;
}
const scopeOf = (req: AuthenticatedRequest) => ({ ...actorScope(req), branchId: req.user?.branchId || "" });
const conversationReadScope = (req: AuthenticatedRequest) => {
  const scope = scopeOf(req);
  if (req.user?.role !== "admin") return scope;
  return { ...scope, branchId: { $in: [...new Set(["", scope.branchId])] } };
};
const sessionMemoryVersionFilter = (version: number) => version === 0
  ? { $or: [{ sessionMemoryVersion: 0 }, { sessionMemoryVersion: { $exists: false } }] }
  : { sessionMemoryVersion: version };
const friendlyResult = (op: AssistantOperation, value: unknown) => hideInternalAssistantIds(op.module === "quotation" ? formatQuotationResult(op, value) : op.module === "healthcare" ? formatHealthcareResult(op, value) : formatFriendlyAssistantResult(op, value));
function friendlyFailure(error: unknown) {
  if (!(error instanceof AssistantError)) return "Mình gặp trục trặc khi xử lý yêu cầu. Hiện chưa xác nhận thao tác nào thành công; bạn thử lại sau giúp mình nhé.";
  const message = error.message || "";
  if (/dữ liệu yêu cầu không hợp lệ/i.test(message)) {
    return "Mình chưa làm được vì một vài thông tin gửi lên chưa đúng định dạng. Bạn kiểm tra lại yêu cầu rồi gửi mình nhé; dữ liệu vẫn chưa thay đổi.";
  }
  if (/(?:không có quyền|chưa được cấp quyền|phân hệ chưa được bật)/i.test(message)) {
    return "Tài khoản hiện chưa có quyền cho thao tác này hoặc phân hệ chưa được bật. Bạn nhờ quản trị viên kiểm tra giúp mình nhé.";
  }
  if (/(?:không tìm thấy|chưa tìm thấy)/i.test(message)) {
    return `Mình chưa tìm được thông tin phù hợp. ${message}`;
  }
  return `Mình chưa làm được việc này: ${message}`;
}
export function inventoryReceiptFollowUpQuestion(
  op: AssistantOperation,
  missingLabels: string[],
  referenceSelections: AssistantReferenceSelection[],
  textPrompts: string[],
) {
  if (op.id !== "inventory.receipt.create") return "";
  const productPending = referenceSelections.some(selection => /^items\[\d+\]\.productId$/.test(selection.key))
    || textPrompts.some(prompt => prompt.includes("Tên hoặc mã sản phẩm"));
  const variantPending = referenceSelections.some(selection => /^items\[\d+\]\.variantId$/.test(selection.key))
    || textPrompts.some(prompt => prompt.includes("SKU cần nhập"));
  if (productPending && variantPending) return "Bạn chọn giúp mình sản phẩm và SKU cần nhập trong danh sách bên dưới nhé.";
  if (productPending) return "Bạn chọn giúp mình sản phẩm cần nhập trong danh sách bên dưới nhé.";
  if (variantPending) return "Bạn chọn giúp mình SKU cần nhập trong danh sách bên dưới nhé.";

  const itemFields = missingLabels.flatMap(label => {
    const match = label.match(/^items · Mục (\d+) · (quantity|unitCost)$/u);
    return match ? [{ row: match[1], field: match[2] }] : [];
  });
  const needsQuantity = itemFields.some(item => item.field === "quantity");
  const needsUnitCost = itemFields.some(item => item.field === "unitCost");
  if (!needsQuantity && !needsUnitCost) return "";

  const multipleItems = new Set(itemFields.map(item => item.row)).size > 1;
  if (needsQuantity && needsUnitCost) {
    return multipleItems
      ? "Bạn gửi giúp mình số lượng và giá nhập của từng SKU nhé. Ví dụ: SKU màu trắng: số lượng 10, giá nhập 25.000đ."
      : "Bạn muốn nhập số lượng bao nhiêu và giá nhập của SKU này là bao nhiêu? Ví dụ: số lượng 10, giá nhập 25.000đ.";
  }
  if (needsQuantity) return "Bạn muốn nhập số lượng bao nhiêu cho SKU này?";
  return "Bạn cho mình biết giá nhập của SKU này nhé. Ví dụ: 25.000đ.";
}
const processingReply = (): AssistantReply => ({ status: "processing", reply: "Mình đang xử lý yêu cầu trước. Bạn chờ mình một chút nhé; chưa cần gửi lại yêu cầu." });
const uncertainReply = (): AssistantReply => ({ status: "uncertain", reply: "Mình chưa xác nhận được yêu cầu trước đã hoàn tất hay chưa. Bạn kiểm tra dữ liệu trong phân hệ giúp mình trước khi thử lại nhé; mình không tự chạy lại để tránh tạo trùng." });
function updateDetailsQuestion(op: AssistantOperation, intent: string, values: Record<string, unknown>) {
  if (op.id === "healthcare.patient.update" && normalizeAssistantText(intent).includes("bo sung thong tin benh nhan vua tao")) {
    return "Bạn gửi thông tin muốn bổ sung cho bệnh nhân vừa tạo nhé: số điện thoại, ngày sinh, địa chỉ hoặc ghi chú. Bạn có thể chỉ bổ sung những mục đang có thông tin.";
  }
  if (op.id === "student.batch.update" && isBatchTitleRenameRequest(intent)) {
    return "Bạn muốn sửa thông tin nào của lớp đã chọn? Tên và mã lớp không thể đổi sau khi tạo. Tiêu đề hiển thị lấy từ khóa học; nếu muốn đổi khóa học gắn với riêng lớp này, hãy cho biết khóa học muốn chọn. Bạn cũng có thể sửa lịch học, giờ, ngày, giảng viên, địa điểm hoặc lộ trình.";
  }
  if (op.id === "student.batch.update") {
    return "Bạn muốn sửa thông tin nào của lớp đã chọn? Có thể cập nhật lịch học, giờ, ngày, giảng viên, địa điểm, khóa học hoặc lộ trình.";
  }
  if (op.id === "hr.workflow.update") {
    let processName = "quy trình đã chọn";
    let stepTitles: string[] = [];
    try {
      const existing = JSON.parse(String(values.__assistantExistingRecord || ""));
      if (typeof existing.name === "string" && existing.name.trim()) processName = existing.name.trim();
      if (Array.isArray(existing.steps)) stepTitles = existing.steps.slice(0, 30).map((step: any) => String(step?.title || "").trim()).filter(Boolean);
    } catch { /* keep the follow-up question useful without an optional summary */ }
    const currentSteps = stepTitles.length
      ? ` Hiện có các bước: ${stepTitles.map((title, index) => `${index + 1}. ${title}`).join("; ")}. Nếu sửa danh sách bước, gửi giúp mình đầy đủ thứ tự các bước muốn giữ; mình sẽ giữ thông tin của bước trùng tên.`
      : " Nếu sửa danh sách bước, gửi giúp mình đầy đủ thứ tự các bước muốn có nhé.";
    return `Bạn muốn mình cập nhật thông tin nào của quy trình “${processName}” — tên, nhóm, mô tả hay các bước?${currentSteps}`;
  }
  if (op.id === "company-knowledge.documents.scopes.update") return "Bạn muốn mình đổi kênh áp dụng, mục đích sử dụng, loại tài liệu hay áp dụng cho tất cả trang?";
  if (op.path === "/partners/:id" && /(?:thông tin (?:chuyển khoản|tài khoản)|chuyển khoản)/i.test(intent)) {
    const required = [
      ["bankName", "tên ngân hàng"],
      ["bankAccountNo", "số tài khoản"],
      ["bankAccountName", "tên chủ tài khoản"],
    ] as const;
    const missing = required.filter(([key]) => values[key] === undefined || values[key] === null || String(values[key]).trim() === "").map(([, label]) => label);
    if (missing.length) return `Mình còn thiếu ${missing.join(", ")} để cập nhật thông tin chuyển khoản cho đối tác. Bạn gửi giúp mình nhé.`;
  }
  if (op.path === "/partners/:id" && /(?:cấu hình hoa hồng|hoa hồng|hoa hong|commission)/i.test(intent)) {
    const required = [
      ["commissionType", "hình thức (phần trăm hoặc số tiền cố định)"],
      ["commissionValue", "mức hoa hồng (số % hoặc số tiền)"],
    ] as const;
    const missing = required.filter(([key]) => values[key] === undefined || values[key] === null || String(values[key]).trim() === "").map(([, label]) => label);
    if (missing.length) return `Để cập nhật hoa hồng cho đối tác, bạn cho mình biết ${missing.join(" và ")} nhé.`;
  }
  return "Bạn muốn mình cập nhật những thông tin nào?";
}
const normalizePartnerIntent = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
const isBatchTitleRenameRequest = (value: string) => {
  const intent = normalizePartnerIntent(value);
  return /\b(?:sua|doi|cap nhat|dat lai)\b.{0,50}\b(?:ten|title|tieu de)\b.{0,30}\b(?:lop|lop hoc)\b/.test(intent)
    || /\b(?:sua|doi|cap nhat|dat lai)\b.{0,50}\b(?:lop|lop hoc)\b.{0,50}\b(?:ten|title|tieu de)\b/.test(intent);
};
const normalizeAssistantText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
function taskTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const input = value.trim();
  const floating = input.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
  if (floating) {
    const [, year, month, day, hour, minute, second = "0", fraction = "0"] = floating;
    const milliseconds = Number(fraction.padEnd(3, "0"));
    const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), milliseconds);
    const parsed = new Date(timestamp);
    if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1 || parsed.getUTCDate() !== Number(day)
      || parsed.getUTCHours() !== Number(hour) || parsed.getUTCMinutes() !== Number(minute) || parsed.getUTCSeconds() !== Number(second)) return null;
    return timestamp;
  }
  const timestamp = Date.parse(input);
  return Number.isFinite(timestamp) ? timestamp : null;
}
export function inferTaskDeadline(op: AssistantOperation, values: Record<string, unknown>, intent: string) {
  if (op.id !== "task.create") return values;
  const startValue = values.startTime;
  const start = taskTimestamp(startValue);
  const hours = Number(values.estTime);
  if (start === null || !Number.isFinite(hours) || hours <= 0) return values;
  const existingDue = taskTimestamp(values.dueDate);
  if (existingDue !== null && existingDue >= start) return values;
  const normalizedIntent = normalizeAssistantText(intent);
  if (/\b(?:han(?: chot| hoan thanh)?|deadline|due date|ngay ket thuc|ket thuc ngay|hoan thanh truoc|phai xong truoc)\b/.test(normalizedIntent)) return values;
  const deadline = start + hours * 60 * 60 * 1000;
  const dueDate = typeof startValue === "string" && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(startValue.trim())
    ? new Date(deadline).toISOString().slice(0, 23)
    : new Date(deadline).toISOString();
  return { ...values, dueDate };
}
function parseWorkHoursFromText(value: string) {
  const normalized = normalizeAssistantText(value);
  const breakIndex = normalized.search(/\b(?:nghi|break|lunch)\b/);
  const workText = breakIndex < 0 ? normalized : normalized.slice(0, breakIndex);
  const breakText = breakIndex < 0 ? "" : normalized.slice(breakIndex);
  const times = (text: string) => {
    const found: string[] = [];
    const expression = /\b(\d{1,2})\s*(?:h|:)\s*(\d{1,2})?\s*p?\s*(sang|chieu|toi|trua)?\b/g;
    for (const match of text.matchAll(expression)) {
      let hour = Number(match[1]);
      const minute = Number(match[2] || 0);
      const period = match[3] || "";
      if (hour > 23 || minute > 59) continue;
      if (["chieu", "toi"].includes(period) && hour < 12) hour += 12;
      else if (period === "sang" && hour === 12) hour = 0;
      else if (period === "trua" && hour > 0 && hour < 11) hour += 12;
      found.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
    return found;
  };
  const workTimes = times(workText);
  const breakTimes = times(breakText);
  return {
    ...(workTimes.length >= 2 ? { checkInLimit: workTimes[0], checkOutLimit: workTimes[1] } : {}),
    ...(breakTimes.length >= 2 ? { lunchBreakStart: breakTimes[0], lunchBreakEnd: breakTimes[1] } : {}),
  };
}
export function inferCustomWorkHoursMode(op: AssistantOperation, values: Record<string, unknown>, intent: string, detailText = intent): Record<string, unknown> {
  if (op.id !== "api.patch.6bc968347283a069") return values;
  const schedule = parseWorkHoursFromText(detailText);
  const merged = { ...values, ...schedule };
  const normalizedIntent = normalizeAssistantText(`${intent} ${detailText}`);
  const explicitlyDisablesPrivateHours = /\b(?:tat|bo|ngung|khong dung|khong ap dung)\b.{0,40}\b(?:gio rieng|gio lam rieng|gio lam viec rieng|gio tuy chinh|gio cong ty|gio mac dinh|gio chung)\b|\b(?:dung gio cong ty|theo gio cong ty|dung gio mac dinh)\b/.test(normalizedIntent);
  if (explicitlyDisablesPrivateHours) return { ...merged, useCustom: false };
  const requestsPrivateHours = /\b(?:gio lam (?:viec )?rieng|gio rieng|gio lam tuy chinh|tuy chinh gio lam|gio lam viec ca nhan)\b/.test(normalizedIntent);
  const suppliesCustomHours = ["checkInLimit", "checkOutLimit", "lunchBreakStart", "lunchBreakEnd"]
    .some(key => typeof merged[key] === "string" && String(merged[key]).trim());
  return requestsPrivateHours || suppliesCustomHours ? { ...merged, useCustom: true } : merged;
}
const customerQuoteMissingProductLabel = "Sản phẩm khách hàng cần báo giá (chọn sản phẩm từ bảng giá hoặc nhập Yêu cầu khách hàng để AI gợi ý)";
export function inferCustomerQuoteMode(
  op: AssistantOperation,
  values: Record<string, unknown>,
  detailText = "",
  previousMode?: unknown,
  previousValues?: Record<string, unknown>,
): Record<string, unknown> {
  if (op.id !== "quotation.customer-quote.create") return values;
  const next: Record<string, unknown> = { ...values };
  const rawDetail = detailText.trim();
  const text = normalizeAssistantText(rawDetail);
  const combinedCustomerAndRequirement = rawDetail.match(
    /^(?:cho\s+)?(?:khách(?:\s+hàng)?(?:\s+tên(?:\s+là)?)?|tên\s+khách(?:\s+hàng)?(?:\s+là)?)\s*[:,-]?\s*([^,.;"\n]+?)\s*(?:[,.;-]?\s*(?:có\s+)?(?:yêu\s+cầu|nhu\s+cầu)(?:\s+là)?\s*[:,-]?|[,.;-]\s+|\s+(?=(?:cần|muốn|lắp|lặp|thi\s+công)\b))\s*["“”']?(.+?)["“”']?\s*$/iu,
  );
  if (combinedCustomerAndRequirement) {
    const extractedName = combinedCustomerAndRequirement[1].trim().replace(/^["“”']+|["“”']+$/g, "").trim();
    const extractedRequirement = combinedCustomerAndRequirement[2].trim().replace(/^["“”']+|["“”']+$/g, "").trim();
    if (isBlank(next.customerName) && extractedName) next.customerName = extractedName;
    if ((isBlank(next.sourceRequirements) || String(next.sourceRequirements).trim() === rawDetail) && extractedRequirement) {
      next.sourceRequirements = extractedRequirement;
    }
  }
  const explicitManual = /^(?:minh\s+chon\s+|chon\s+|phuong\s+thuc\s+|cach\s+chon\s+san\s+pham(?:\s+bao\s+gia)?\s*[:,-]?\s*)?(?:tu\s+chon(?:\s+san\s+pham(?:\s+tu\s+bang\s+gia)?)?|chon\s+truc\s+tiep(?:\s+san\s+pham)?|chon\s+san\s+pham(?:\s+tu\s+bang\s+gia)?)[.!? ]*$/.test(text);
  const explicitAi = /^(?:minh\s+chon\s+|chon\s+|phuong\s+thuc\s+|cach\s+chon\s+san\s+pham(?:\s+bao\s+gia)?\s*[:,-]?\s*)?(?:de\s+ai\s+goi\s+y(?:\s+san\s+pham(?:\s+theo\s+yeu\s+cau)?)?|ai\s+goi\s+y(?:\s+san\s+pham)?|goi\s+y\s+san\s+pham(?:\s+theo\s+yeu\s+cau)?|theo\s+prompt)[.!? ]*$/.test(text);
  if (explicitManual) {
    delete next.sourceRequirements;
    delete next.__assistantQuotationSuggested;
    return { ...next, __assistantQuotationMode: "manual" };
  }
  if (explicitAi) {
    delete next.items;
    return { ...next, __assistantQuotationMode: "ai" };
  }
  if (!isBlank(next.items)) return { ...next, __assistantQuotationMode: "manual" };
  if (!isBlank(next.sourceRequirements)) return { ...next, __assistantQuotationMode: "ai" };
  if (/\b(?:tu chon|chon truc tiep|chon san pham(?:\s+tu\s+bang\s+gia)?)\b/.test(text)) return { ...next, __assistantQuotationMode: "manual" };
  if (/\b(?:de ai goi y|ai goi y|goi y san pham|theo prompt)\b/.test(text)) return { ...next, __assistantQuotationMode: "ai" };
  const customerOnlyMatch = rawDetail.match(
    /^(?:cho\s+)?(?:khách(?:\s+hàng)?(?:\s+tên(?:\s+là)?)?|tên\s+khách(?:\s+hàng)?(?:\s+là)?)\s*[:,-]?\s*([^,.;"\n]{1,80})$/iu,
  );
  if (customerOnlyMatch && isBlank(next.customerName) && !/\b(?:yeu cau|nhu cau|lap dat|thi cong|camera|wifi|tang|m2)\b/.test(text)) {
    next.customerName = customerOnlyMatch[1].trim().replace(/^["“”']+|["“”']+$/g, "").trim();
  }
  if (previousMode === "ai" && next.__assistantQuotationMode === "ai" && isBlank(next.sourceRequirements) && rawDetail && !/^(?:(?:tao|lap|them)\s+(?:bao\s+gia|du\s+toan)|huy|bo\s+qua)\b/.test(text)) {
    const suppliedNewCustomerName = isBlank(previousValues?.customerName) && !isBlank(next.customerName);
    const suppliedNewEmail = isBlank(previousValues?.customerEmail) && !isBlank(next.customerEmail);
    const suppliedNewPhone = isBlank(previousValues?.customerPhone) && !isBlank(next.customerPhone);
    const suppliedNewTemplate = isBlank(previousValues?.templateId) && !isBlank(next.templateId);
    let remainder = text;
    if (suppliedNewCustomerName) {
      const normName = normalizeAssistantText(String(next.customerName));
      if (normName) remainder = remainder.replace(normName, " ");
    }
    if (suppliedNewEmail) {
      const normEmail = normalizeAssistantText(String(next.customerEmail));
      if (normEmail) remainder = remainder.replace(normEmail, " ");
    }
    if (suppliedNewPhone) {
      const normPhone = normalizeAssistantText(String(next.customerPhone));
      if (normPhone) remainder = remainder.replace(normPhone, " ");
    }
    if (suppliedNewTemplate) {
      const normTemplate = normalizeAssistantText(String(next.templateId));
      if (normTemplate) remainder = remainder.replace(normTemplate, " ");
    }
    remainder = remainder
      .replace(/\b(?:khach hang|khach|ten|la|anh|chi|cong ty|email|so dien thoai|sdt|dien thoai|mau bao gia|mau|dung|chon|cho|cua|nhe|nha|giup|minh)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (remainder || (!suppliedNewCustomerName && !suppliedNewEmail && !suppliedNewPhone && !suppliedNewTemplate)) {
      const cleanedRequirement = rawDetail
        .replace(/^(?:yêu\s+cầu(?:\s+khách\s+hàng)?(?:\s+là)?|nhu\s+cầu(?:\s+khách\s+hàng)?(?:\s+là)?)\s*[:,-]?\s*/iu, "")
        .replace(/^["“”']+|["“”']+$/g, "")
        .trim();
      return { ...next, sourceRequirements: cleanedRequirement || rawDetail };
    }
  }
  return next;
}
export function customerQuoteFollowUpQuestion(op: AssistantOperation, values: Record<string, unknown>, referenceSelections: AssistantReferenceSelection[]) {
  if (op.id !== "quotation.customer-quote.create" || !isBlank(values.items) || !isBlank(values.sourceRequirements)) return "";
  if (values.__assistantQuotationMode === "manual") {
    return referenceSelections.some(selection => selection.key === "items")
      ? "Bạn chọn một hoặc nhiều sản phẩm từ bảng giá bên dưới (hoặc nhập tên/mã SKU sản phẩm) để lập báo giá nhé."
      : "Bạn gửi giúp mình tên hoặc mã SKU các sản phẩm trong bảng giá cần báo giá nhé.";
  }
  if (values.__assistantQuotationMode === "ai") {
    return "Bạn nhập mô tả yêu cầu của khách hàng (nhu cầu sử dụng, công suất, quy mô hoặc sản phẩm mong muốn) để AI gợi ý danh sách sản phẩm phù hợp nhé.";
  }
  return "Bạn muốn tự chọn sản phẩm từ bảng giá hay để AI gợi ý sản phẩm theo yêu cầu? Bạn chọn phương thức bên dưới nhé.";
}
const customWorkHoursFieldKeys = ["checkInLimit", "checkOutLimit", "lunchBreakStart", "lunchBreakEnd"] as const;
export function missingCustomWorkHoursLabels(op: AssistantOperation, values: Record<string, unknown>) {
  if (op.id !== "api.patch.6bc968347283a069" || values.useCustom !== true) return [];
  return customWorkHoursFieldKeys
    .filter(key => isBlank(values[key]))
    .map(key => op.fields.find(field => field.key === key)?.label || key);
}
export function customWorkHoursFollowUpQuestion(op: AssistantOperation, missingLabels: string[]) {
  if (op.id !== "api.patch.6bc968347283a069" || !missingLabels.length) return "";
  const keys = new Set(customWorkHoursFieldKeys.filter(key => missingLabels.includes(op.fields.find(field => field.key === key)?.label || key)));
  const scheduleExample = "Ví dụ: 9h30 sáng đến 7h tối, nghỉ trưa từ 2h chiều đến 3h30 chiều.";
  if (keys.size === customWorkHoursFieldKeys.length) {
    return `Để cài giờ làm riêng, bạn cho mình giờ vào, giờ ra và thời gian nghỉ trưa nhé. ${scheduleExample}`;
  }
  const names: Record<(typeof customWorkHoursFieldKeys)[number], string> = {
    checkInLimit: "giờ vào",
    checkOutLimit: "giờ ra",
    lunchBreakStart: "giờ bắt đầu nghỉ trưa",
    lunchBreakEnd: "giờ kết thúc nghỉ trưa",
  };
  const missing = customWorkHoursFieldKeys.filter(key => keys.has(key)).map(key => names[key]);
  return `Mình còn thiếu ${missing.join(", ")} để cài giờ làm riêng. Bạn gửi giúp mình nhé. ${scheduleExample}`;
}
export function trainingContentFollowUpQuestion(op: AssistantOperation, missingLabels: string[]) {
  if (op.id !== "training.create") return "";
  const missingLessons = op.fields.find(field => field.key === "lessons")?.label;
  const missingQuizzes = op.fields.find(field => field.key === "quizzes")?.label;
  const asksLessons = Boolean(missingLessons && missingLabels.includes(missingLessons));
  const asksQuizzes = Boolean(missingQuizzes && missingLabels.includes(missingQuizzes));
  return [
    ...(asksLessons ? ["Bạn muốn gắn bài giảng nào? Gửi tên bài kèm đường dẫn hoặc nội dung; nếu chưa có, nói ‘bỏ qua bài giảng’ nhé."] : []),
    ...(asksQuizzes ? ["Bạn muốn thêm câu hỏi trắc nghiệm nào? Gửi câu hỏi, các phương án và đáp án đúng; nếu chưa có, nói ‘bỏ qua câu hỏi’ nhé."] : []),
  ].join("\n");
}
function trainingContentSkipFields(text: string): Array<"lessons" | "quizzes"> {
  const normalized = normalizeAssistantText(text);
  const skipVerb = "(?:bo qua|khong can|chua co|chua muon|khong muon them|khong them)";
  if (new RegExp(`^${skipVerb}(?: ca hai| het)?[.!? ]*$`).test(normalized)) return ["lessons", "quizzes"];
  const skips: Array<"lessons" | "quizzes"> = [];
  if (new RegExp(`(?:${skipVerb}).{0,36}\\b(?:bai giang|bai hoc)\\b|\\b(?:bai giang|bai hoc)\\b.{0,36}(?:${skipVerb})`).test(normalized)) skips.push("lessons");
  if (new RegExp(`(?:${skipVerb}).{0,36}\\b(?:cau hoi|trac nghiem|quiz)\\b|\\b(?:cau hoi|trac nghiem|quiz)\\b.{0,36}(?:${skipVerb})`).test(normalized)) skips.push("quizzes");
  return skips;
}
const isWorkerMissingInfoIntent = (value: string) => {
  const intent = normalizeAssistantText(value);
  return /\b(?:lao dong|nguoi lao dong|ho so)\b/.test(intent)
    && /\b(?:thieu|bo trong|chua co)\b/.test(intent)
    && /\b(?:thong tin|muc|gi)\b/.test(intent);
};
const isMissingProfileInfoIntent = (value: string) => {
  const intent = normalizeAssistantText(value);
  return /\b(?:thieu|trong|chua co|bo sung)\b/.test(intent)
    && /\b(?:thong tin|muc|truong|gi)\b/.test(intent);
};
const isLaborPartnerMissingInfoIntent = (value: string) => {
  const intent = normalizeAssistantText(value);
  return isMissingProfileInfoIntent(value)
    && /\b(?:doi tac|cong tac vien)\b/.test(intent)
    && /\b(?:lao dong|cung ung)\b/.test(intent);
};
const isLaborPartnerProfileUpdateIntent = (value: string) => {
  const intent = normalizeAssistantText(value);
  return /\b(?:them|cap nhat|sua|bo sung|doi|thay doi)\b/.test(intent)
    && /\b(?:email|tax code|ma so thue|nguoi dai dien|dia chi|address|ngan hang|so tai khoan|stk|chu tai khoan|ghi chu)\b/.test(intent);
};
const explicitlyMentionsLaborPartner = (value: string) =>
  /\b(?:doi tac lao dong|doi tac cung ung|cong tac vien lao dong)\b/.test(normalizeAssistantText(value));
const workerCreateActionIds = new Set([
  ...ASSISTANT_OPERATIONS.filter(operation => operation.method === "POST" && operation.path === "/worker-management/workers").map(operation => operation.id),
  "api.post.479b054fb833c67d",
]);
const laborPartnerContextActionIds = new Set(ASSISTANT_OPERATIONS
  .filter(operation => /^\/worker-management\/partners(?:\/:[^/]+)?$/.test(operation.path))
  .map(operation => operation.id));
async function latestCompletedAction(req: AuthenticatedRequest, conversationId: string) {
  return await AssistantTurnModel.findOne({
    ...scopeOf(req), conversationId, status: "completed", "result.status": "completed",
    actionId: { $exists: true, $ne: "" },
  }).sort({ createdAt: -1 }).select("actionId payload").lean() as any;
}
async function createdRecordFollowUp(req: AuthenticatedRequest, conversationId: string): Promise<{ actionId: string; values: Record<string, AssistantValue> } | null> {
  const previous = await latestCompletedAction(req, conversationId);
  const followUp = previous?.payload?.__assistantFollowUp;
  const update = followUp && operationById(followUp.actionId);
  if (!update || !["PATCH", "PUT"].includes(update.method) || !followUp.values || typeof followUp.values !== "object") return null;
  return { actionId: update.id, values: Object.fromEntries(Object.entries(followUp.values).filter(([key, value]) =>
    update.fields.some(field => field.key === key) && ["string", "number", "boolean"].includes(typeof value))) as Record<string, AssistantValue> };
}
const workerProfileFields = [
  ["phone", "Số điện thoại"],
  ["email", "Email"],
  ["idCard", "CCCD/CMND"],
  ["birthday", "Ngày sinh"],
  ["registrationDate", "Ngày tiếp nhận"],
  ["nationality", "Quốc tịch"],
  ["address", "Địa chỉ"],
  ["note", "Ghi chú"],
] as const;
const legacyWorkerCreateActionId = "api.post.479b054fb833c67d";
async function workerMissingInfoReply(req: AuthenticatedRequest, conversationId: string, text: string): Promise<AssistantReply> {
  const listOperation = operationById("worker.list");
  if (!listOperation) throw new AssistantError("Chưa bật thao tác xem hồ sơ lao động.", 403);
  const createActionIds = [...new Set([
    ...ASSISTANT_OPERATIONS.filter(operation => operation.method === "POST" && operation.path === "/worker-management/workers").map(operation => operation.id),
    legacyWorkerCreateActionId,
  ])];
  const previousCreate = await AssistantTurnModel.findOne({
    ...scopeOf(req),
    conversationId,
    actionId: { $in: createActionIds },
    status: "completed",
    "result.status": "completed",
  }).sort({ createdAt: -1 }).select("payload createdAt").lean() as any;
  const previousName = [previousCreate?.payload?.fullName, previousCreate?.payload?.body_fullName, previousCreate?.payload?.worker?.fullName]
    .find(value => typeof value === "string" && value.trim());

  const response = await callOperation(req, listOperation, {});
  const data = response?.data ?? response;
  const workers: Record<string, any>[] = Array.isArray(data?.workers)
    ? data.workers
    : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data)
        ? data
        : [];
  const normalizedText = normalizeAssistantText(text);
  const mentioned = workers.filter(worker => {
    const name = typeof worker?.fullName === "string" ? normalizeAssistantText(worker.fullName) : "";
    return name.length >= 3 && normalizedText.includes(name);
  });
  const mentionedNames = [...new Map(mentioned.map(worker => [normalizeAssistantText(String(worker.fullName)), String(worker.fullName)])).values()];
  if (mentionedNames.length > 1) {
    return { status: "completed", reply: "Bạn đang nhắc đến nhiều người lao động. Bạn cho mình biết hồ sơ nào cần kiểm tra nhé.", link: listOperation.link };
  }
  const targetName = String(mentionedNames[0] || previousName || "").trim();
  if (!targetName) {
    return { status: "completed", reply: "Bạn đang muốn kiểm tra hồ sơ lao động nào? Gửi mình tên người đó nhé.", link: listOperation.link };
  }
  let candidates = workers.filter(worker => typeof worker?.fullName === "string" && normalizeAssistantText(worker.fullName) === normalizeAssistantText(targetName));
  if (candidates.length > 1 && previousCreate?.createdAt) {
    const createdAt = new Date(previousCreate.createdAt).getTime();
    const recent = candidates.filter(worker => {
      const workerCreatedAt = new Date(worker.createdAt || "").getTime();
      return Number.isFinite(createdAt) && Number.isFinite(workerCreatedAt) && Math.abs(workerCreatedAt - createdAt) <= 120_000;
    });
    if (recent.length === 1) candidates = recent;
  }
  if (!candidates.length) {
    return { status: "completed", reply: `Mình chưa tìm thấy hồ sơ của ${targetName} trong phạm vi bạn được xem. Bạn kiểm tra lại tên hoặc chi nhánh giúp mình nhé.`, link: listOperation.link };
  }
  if (candidates.length > 1) {
    return { status: "completed", reply: `Mình thấy ${targetName} có nhiều hồ sơ trùng tên. Bạn cho mình biết chi nhánh của người cần kiểm tra nhé.`, link: listOperation.link };
  }

  const worker = candidates[0];
  const fields = worker.laborType === "foreign"
    ? [...workerProfileFields, ["workPermitNumber", "Số giấy phép lao động/visa"], ["workPermitExpiry", "Ngày hết hạn giấy phép/visa"]] as const
    : workerProfileFields;
  const missing = fields.filter(([key]) => worker[key] === undefined || worker[key] === null || String(worker[key]).trim() === "").map(([, label]) => label);
  return {
    status: "completed",
    reply: missing.length
      ? `Mình đã xem hồ sơ của ${worker.fullName}. Các mục còn đang để trống là: ${missing.join(", ")}. Đây là những thông tin có thể bổ sung; bạn muốn cập nhật mục nào trước?`
      : `Mình đã xem hồ sơ của ${worker.fullName}; các trường thông tin cơ bản hiện đều đã có. Bạn muốn mình kiểm tra thêm nội dung nào không?`,
    link: listOperation.link,
  };
}
function laborPartnerTargetFromText(value: string) {
  const text = value.trim();
  const match = text.match(/(?:của|cho)\s+(.+)$/iu)
    || text.match(/(?:đối tác|cộng tác viên)(?: cung ứng)?(?: lao động)?\s+(.+)$/iu);
  return String(match?.[1] || "")
    .replace(/^(?:(?:đối tác|cộng tác viên)(?: cung ứng)?(?: lao động)?|lao động)\s+/iu, "")
    .replace(/[?!.…]+$/u, "")
    .trim();
}
function laborPartnerReferenceFromAction(previousAction?: any) {
  const payload = previousAction?.payload && typeof previousAction.payload === "object" ? previousAction.payload : {};
  const previousOperation = previousAction?.actionId ? operationById(previousAction.actionId) : undefined;
  const pathField = previousOperation?.fields.find(field => field.source === "path" && field.apiKey === "partnerId");
  const reference = [pathField ? payload[pathField.key] : undefined, payload.path_partnerId, payload.partnerId, payload.id]
    .find(value => typeof value === "string" && value.trim());
  if (typeof reference === "string") return reference.trim();
  return [payload.name, payload.code, payload.search, payload.query_search]
    .find(value => typeof value === "string" && value.trim() && !/^[a-f\d]{24}$/i.test(value.trim()))?.trim() || "";
}
async function laborPartnerMissingInfoReply(req: AuthenticatedRequest, text: string, previousAction?: any): Promise<AssistantReply> {
  const listOperation = operationById("worker.partner.list");
  if (!listOperation) throw new AssistantError("Chưa bật thao tác tra cứu đối tác lao động.", 403);
  const payload = previousAction?.payload && typeof previousAction.payload === "object" ? previousAction.payload : {};
  const targetFromText = laborPartnerTargetFromText(text);
  const previousTarget = [payload.name, payload.code, payload.search, payload.query_search]
    .find(value => typeof value === "string" && value.trim() && !/^[a-f\d]{24}$/i.test(value.trim()));
  const target = String(targetFromText || previousTarget || "").trim();
  const previousOperation = previousAction?.actionId ? operationById(previousAction.actionId) : undefined;
  let previouslyViewedPartner: Record<string, any> | undefined;
  if (!targetFromText && previousOperation?.method === "GET" && /^\/worker-management\/partners\/:[^/]+$/.test(previousOperation.path)) {
    await assertOperation(req, previousOperation.id);
    const detailResponse = await callOperation(req, previousOperation, payload);
    const detailData = detailResponse?.data?.data ?? detailResponse?.data ?? detailResponse;
    const candidate = detailData?.partner ?? detailData?.item ?? detailData;
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate) && (candidate.name || candidate.code)) previouslyViewedPartner = candidate;
  }
  if (!target && !previouslyViewedPartner) {
    return { status: "completed", reply: "Bạn muốn kiểm tra hồ sơ đối tác lao động nào? Gửi mình tên hoặc mã đối tác nhé.", link: listOperation.link };
  }

  let partners: Record<string, any>[] = previouslyViewedPartner ? [previouslyViewedPartner] : [];
  if (!previouslyViewedPartner) {
    const listInput: Record<string, AssistantValue> = {};
    const searchField = listOperation.fields.find(field => field.source === "query" && field.apiKey === "search");
    if (searchField) listInput[searchField.key] = target;
    else listInput.search = target;
    for (const field of listOperation.fields) {
      if (field.source !== "query") continue;
      const apiKey = String(field.apiKey || field.key).toLowerCase();
      if (/page$/.test(apiKey)) listInput[field.key] = 1;
      else if (/pagesize$|limit$/.test(apiKey)) listInput[field.key] = 100;
    }

    const response = await callOperation(req, listOperation, listInput);
    const data = response?.data?.data ?? response?.data ?? response;
    partners = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.partners)
        ? data.partners
        : Array.isArray(data)
          ? data
          : [];
  }
  const normalizedTarget = normalizeAssistantText(target);
  const matching = previouslyViewedPartner ? partners : partners.filter(partner => [partner?.name, partner?.code]
    .some(value => typeof value === "string" && normalizeAssistantText(value).includes(normalizedTarget)));
  const exact = previouslyViewedPartner ? matching : matching.filter(partner => [partner?.name, partner?.code]
    .some(value => typeof value === "string" && normalizeAssistantText(value) === normalizedTarget));
  const candidates = previouslyViewedPartner ? matching : exact.length ? exact : matching;
  if (!candidates.length) {
    return { status: "completed", reply: `Mình chưa tìm thấy hồ sơ đối tác lao động “${target}” trong phạm vi bạn được xem. Bạn kiểm tra lại tên hoặc mã giúp mình nhé.`, link: listOperation.link };
  }
  if (candidates.length > 1) {
    const choices = candidates.slice(0, 5).map((partner, index) => `${index + 1}. ${partner.name || "Chưa có tên"}${partner.code ? ` · Mã: ${partner.code}` : ""}`).join("\n");
    return { status: "completed", reply: `Mình tìm thấy nhiều đối tác phù hợp với “${target}”. Bạn chọn đúng hồ sơ nhé:\n${choices}`, link: listOperation.link };
  }

  const partner = candidates[0];
  const optionalFields = [
    ["email", "Email"],
    ["taxCode", "Mã số thuế"],
    ["representative", "Người đại diện"],
    ["address", "Địa chỉ"],
    ["bankName", "Ngân hàng"],
    ["bankAccountNo", "Số tài khoản ngân hàng"],
    ["bankAccountName", "Tên chủ tài khoản"],
    ["defaultPolicyId", "Chính sách hoa hồng mặc định"],
    ["defaultOfficialPolicyId", "Chính sách hoa hồng chính thức"],
    ["defaultSeasonalPolicyId", "Chính sách hoa hồng thời vụ"],
    ["note", "Ghi chú"],
  ] as const;
  const missing = optionalFields.filter(([key]) => partner[key] === undefined || partner[key] === null || String(partner[key]).trim() === "").map(([, label]) => label);
  return {
    status: "completed",
    reply: missing.length
      ? `Mình đã xem hồ sơ đối tác lao động ${partner.name}. Các mục tùy chọn còn để trống là: ${missing.join(", ")}. Bạn muốn bổ sung mục nào trước?`
      : `Mình đã xem hồ sơ đối tác lao động ${partner.name}; các mục thông tin tùy chọn hiện đã có dữ liệu. Bạn muốn kiểm tra thêm nội dung nào không?`,
    link: listOperation.link,
  };
}
const relationMentioned = (intent: string, field: AssistantField) => {
  const text = normalizeAssistantText(intent);
  const stopWords = new Set(["ten", "ma", "hoac", "va", "cua", "cho", "ho", "mot", "cac", "ban", "ghi", "lien", "quan", "tai"]);
  const intentTokens = new Set(text.split(/\s+/).filter(Boolean));
  const tokens = [field.key, field.apiKey || "", field.label]
    .flatMap(value => normalizeAssistantText(value).split(/[^a-z0-9]+/))
    .filter(token => token.length >= 3 && !stopWords.has(token));
  return tokens.some(token => intentTokens.has(token));
};
const relationChangeRequested = (intent: string, field: AssistantField) => {
  const text = normalizeAssistantText(intent);
  return relationMentioned(intent, field)
    && /(?:^|\s)(?:doi|chuyen|gan|lien ket|thuoc|cap nhat|thay doi|them vao|bo sung vao|dat vao|assign|set)(?:\s|$)/.test(text);
};
function containsReference(shape?: AssistantDataShape): boolean {
  if (!shape) return false;
  return Boolean(shape.reference || Object.values(shape.keys || {}).some(containsReference) || containsReference(shape.items));
}
function workflowForRequest(op: AssistantOperation, workflow: AssistantWorkflow, intent: string): AssistantWorkflow {
  if (!["PATCH", "PUT"].includes(op.method)) return workflow;
  return {
    ...workflow,
    fields: workflow.fields.map(field => {
      const isReferenceField = Boolean(field.reference || containsReference(field.structure));
      if (!isReferenceField || field.systemRequired || relationMentioned(intent, field)) return field;
      // Partial updates should only require linked records when the user asks
      // to change that relationship. Changing product status, for example,
      // does not require unrelated media or document selections.
      return { ...field, required: false };
    }),
  };
}
const referenceSearchKey = (key: string) => `__assistantReferenceSearch_${key}`;
const isReferenceCorrectionReply = (text: string) => {
  const normalized = normalizeAssistantText(text);
  if (!normalized) return false;
  return !/^(?:hay\s+)?(?:tao|them|cap nhat|sua|xoa|huy|chuyen|doi|liet ke|tra cuu|tim|xem|nhap|xuat|ghi nhan|xac nhan|bo qua)(?:\s|$)/.test(normalized);
};
const isSkippingReference = (text: string) => /^(?:thoi\s+)?(?:bo qua|khong can|de trong|khong gan|khong lien ket|khong chon)(?:\s|$)/.test(normalizeAssistantText(text));
function unavailableReferencePrompt(op: AssistantOperation, field: AssistantField, label: string, skipHint = "", lookupFailed = false) {
  if (op.id === "quotation.contract.create" && field.key === "quoteId") {
    return lookupFailed
      ? "Mình chưa tải được danh sách dự toán đã duyệt. Bạn thử lại sau hoặc gửi mã dự toán nếu đã biết nhé."
      : "Chưa có dự toán đã duyệt và đủ thông tin để tạo hợp đồng. Hãy duyệt, bổ sung đầy đủ dự toán rồi thử lại nhé.";
  }
  if (op.id === "quotation.estimate.from-customer" && field.key === "sourceQuoteId") {
    return lookupFailed
      ? "Mình chưa tải được danh sách báo giá khách hàng. Bạn thử lại sau hoặc gửi mã/tên báo giá nếu đã biết nhé."
      : "Chưa có báo giá khách hàng nào để chọn. Bạn có thể tạo báo giá trước, hoặc gửi “tạo dự toán” để bắt đầu bằng yêu cầu mới.";
  }
  if (field.reference === "batch.list" && field.key === "path_id") {
    return lookupFailed
      ? "M\u00ECnh ch\u01B0a t\u1EA3i \u0111\u01B0\u1EE3c danh s\u00E1ch l\u1EDBp trong chi nh\u00E1nh hi\u1EC7n t\u1EA1i. B\u1EA1n th\u1EED l\u1EA1i sau ho\u1EB7c g\u1EEDi m\u00E3 l\u1EDBp n\u1EBFu \u0111\u00E3 bi\u1EBFt nh\u00E9."
      : "M\u00ECnh ch\u01B0a t\u00ECm th\u1EA5y l\u1EDBp theo th\u00F4ng tin b\u1EA1n v\u1EEBa g\u1EEDi. B\u1EA1n c\u00F3 th\u1EC3 nh\u1EADp m\u1ED9t ph\u1EA7n t\u00EAn/m\u00E3 l\u1EDBp ho\u1EB7c t\u00EAn kh\u00F3a h\u1ECDc; n\u1EBFu l\u1EDBp ch\u01B0a \u0111\u01B0\u1EE3c t\u1EA1o, h\u00E3y t\u1EA1o l\u1EDBp tr\u01B0\u1EDBc r\u1ED3i th\u1EED l\u1EA1i."
  }
  if (op.method === "POST" && op.path === "/courses" && field.apiKey === "category") {
    return lookupFailed
      ? "Mình chưa tải được danh sách danh mục khóa học để bạn chọn. Khóa học chưa được tạo; bạn thử lại giúp mình nhé."
      : "Hiện chưa có danh mục khóa học trong phạm vi đang chọn để đưa ra lựa chọn. Khóa học chưa được tạo; bạn kiểm tra chi nhánh đang chọn hoặc nhờ quản trị viên kiểm tra danh mục giúp mình nhé.";
  }
  if (op.method === "POST" && op.path === "/inventory/catalog/resources/:kind" && field.apiKey === "parentCode") {
    return "Mình chưa tìm thấy thể loại / thư mục cha nào đang hoạt động. Bạn hãy tạo một mục gốc trước, rồi mình có thể tạo các mục con bên dưới nhé.";
  }
  if (op.path === "/inventory/catalog/products" && field.reference === "inventory.catalog.resource.list") {
    if (field.referenceContext?.path_kind === "categories") {
      return "Chưa có thể loại / thư mục sản phẩm để chọn. Bạn có thể tạo một mục trong Cây thể loại / Thư mục rồi gửi lại yêu cầu nhé.";
    }
    if (field.referenceContext?.path_kind === "units") {
      return "Chưa có đơn vị tính để chọn. Tạo đơn vị tính rồi gửi lại yêu cầu này nhé.";
    }
  }
  if (op.id === "inventory.receipt.create" && field.reference === "inventory.product.detail") {
    return lookupFailed
      ? "Mình chưa đọc được danh sách SKU của sản phẩm đã chọn. Phiếu nhập chưa được tạo; nhà cung cấp và kho bạn chọn vẫn được giữ. Bạn thử lại sau hoặc gửi mã SKU nếu đã biết nhé."
      : "Mình chưa tìm thấy SKU nào cho sản phẩm đã chọn. Phiếu nhập kho cần một SKU cụ thể; nếu sản phẩm chưa có SKU, hãy thêm SKU cho sản phẩm rồi gửi lại yêu cầu nhập kho nhé. Nhà cung cấp và kho bạn chọn vẫn được giữ. Bản ghi chưa được tạo."
  }
  return `Chưa có lựa chọn khả dụng cho ${label}.${skipHint}`;
}
function assistantOptionLabel(op: AssistantOperation, field: AssistantField, value: string) {
  if (op.module === "quotation") return quotationValue(field.apiKey || field.key, value);
  if (op.module === "healthcare") return healthcareValue(field.apiKey || field.key, value);
  if (op.id === "retail.coupon.create" && field.key === "targetType") {
    const labels: Record<string, string> = {
      all_customers: "Tất cả khách hàng",
      specific_customer: "Một khách hàng cụ thể",
    };
    return labels[value] || value;
  }
  if (op.id === "retail.coupon.create" && field.apiKey === "discountType") {
    return value === "amount" ? "Giảm theo số tiền" : value === "percent" ? "Giảm theo phần trăm" : value;
  }
  if (op.path.startsWith("/worker-management/partners/policies")) {
    const labels: Record<string, string> = {
      "settlementCycle.type.calendar_month": "Theo tháng dương lịch",
      "settlementCycle.type.cutoff_day": "Theo ngày chốt (chọn ngày từ 1 đến 28)",
      "official.enabled.true": "Có áp dụng",
      "official.enabled.false": "Không áp dụng",
      "seasonal.enabled.true": "Có áp dụng",
      "seasonal.enabled.false": "Không áp dụng",
      "official.milestones.eligibilityRule.contract_active": "Hợp đồng còn hiệu lực",
      "official.milestones.eligibilityRule.manual_confirmation": "Xác nhận thủ công",
      "official.milestones.eligibilityRule.attendance_threshold": "Đạt ngưỡng chấm công",
      "seasonal.aggregationScope.partner_period": "Cộng giờ theo đối tác trong kỳ",
      "seasonal.aggregationScope.partner_project_period": "Cộng giờ theo đối tác, dự án và kỳ",
      "seasonal.tierMode.flat": "Áp dụng một mức cho toàn bộ số giờ",
      "seasonal.tierMode.progressive": "Áp dụng mức theo từng bậc giờ",
      "seasonal.hourRounding.unitMinutes.1": "Mỗi 1 phút",
      "seasonal.hourRounding.unitMinutes.5": "Mỗi 5 phút",
      "seasonal.hourRounding.unitMinutes.15": "Mỗi 15 phút",
      "seasonal.hourRounding.unitMinutes.30": "Mỗi 30 phút",
      "seasonal.hourRounding.unitMinutes.60": "Mỗi 60 phút",
      "seasonal.hourRounding.mode.floor": "Làm tròn xuống",
      "seasonal.hourRounding.mode.nearest": "Làm tròn đến giá trị gần nhất",
      "seasonal.hourRounding.mode.ceil": "Làm tròn lên",
      "seasonal.moneyRounding.mode.floor": "Làm tròn xuống",
      "seasonal.moneyRounding.mode.nearest": "Làm tròn đến giá trị gần nhất",
      "seasonal.moneyRounding.mode.ceil": "Làm tròn lên",
    };
    const normalizedFieldKey = field.key.replace(/\[\d+\]/g, "");
    return labels[`${normalizedFieldKey}.${value}`] || value;
  }
  if (op.id.startsWith("training.") && field.key === "category") {
    return TRAINING_CATEGORY_OPTIONS.find(option => option.value === value)?.label || value;
  }
  if (op.id === "inventory.catalog.unit.create" && field.apiKey === "category") {
    const labels: Record<string, string> = { count: "Đếm", weight: "Khối lượng", volume: "Thể tích", length: "Chiều dài", time: "Thời gian", other: "Khác" };
    return labels[value] || value;
  }
  if (op.path === "/inventory/catalog/resources/:kind" && field.key === "path_kind") {
    if (value === "categories") return "Cây thể loại / thư mục sản phẩm";
    if (value === "brands") return "Thương hiệu";
    if (value === "units") return "Đơn vị tính";
    if (value === "attributes") return "Thuộc tính sản phẩm";
  }
  if (op.path === "/inventory/catalog/products" && field.key === "productType") {
    if (value === "physical") return "Hàng hóa vật lý (quản lý kho, IMEI/số lượng)";
    if (value === "service") return "Dịch vụ (sửa chữa, thay pin, không theo dõi kho)";
    if (value === "bundle") return "Gói sản phẩm";
  }
  if (op.path === "/inventory/catalog/products/:id" && field.apiKey === "status") {
    const labels: Record<string, string> = { draft: "Bản nháp", active: "Đang kinh doanh", inactive: "Ngừng kinh doanh", archived: "Đã lưu trữ" };
    return labels[value] || value;
  }
  return value;
}
function assistantPreviewValue(op: AssistantOperation, fieldKey: string, value: AssistantValue): AssistantValue {
  if (op.id === "hr.workflow.update" && fieldKey === "steps") {
    const parsed = parseStructuredAssistantValue(value);
    if (!Array.isArray(parsed)) return value;
    return parsed.map((step: any, index: number) => [
      `${index + 1}. ${String(step?.title || "Bước chưa có tên")}`,
      typeof step?.description === "string" && step.description.trim() ? step.description.trim() : "",
      typeof step?.estDays === "number" ? `${step.estDays} ngày dự kiến` : "",
      typeof step?.deliverable === "string" && step.deliverable.trim() ? `Bàn giao: ${step.deliverable.trim()}` : "",
      typeof step?.note === "string" && step.note.trim() ? `Ghi chú: ${step.note.trim()}` : "",
    ].filter(Boolean).join(" · ")).join("\n");
  }
  if (!op.id.startsWith("training.") || !["lessons", "quizzes"].includes(fieldKey)) return value;
  const parsed = parseStructuredAssistantValue(value);
  if (!Array.isArray(parsed)) return value;
  if (fieldKey === "lessons") return parsed.length ? `${parsed.length} bài giảng` : "Chưa thêm bài giảng";
  return parsed.length ? `${parsed.length} câu trắc nghiệm` : "Chưa thêm câu hỏi trắc nghiệm";
}
function trainingContentFormFromValues(values: Record<string, unknown>): AssistantTrainingContentForm {
  const parseArray = (key: string) => {
    const parsed = parseStructuredAssistantValue(values[key]);
    return Array.isArray(parsed) ? parsed : [];
  };
  const lessonTypes = new Set(["youtube", "document", "other", "text", "video"]);
  const lessons = parseArray("lessons").flatMap(value => {
    if (!isAssistantRecord(value)) return [];
    const type = String(value.type || "text");
    return [{
      title: String(value.title || ""),
      type: (lessonTypes.has(type) ? type : "text") as AssistantTrainingContentForm["lessons"][number]["type"],
      ...(typeof value.url === "string" ? { url: value.url } : {}),
      ...(typeof value.content === "string" ? { content: value.content } : {}),
      ...(typeof value.fileName === "string" ? { fileName: value.fileName } : {}),
      ...(typeof value.uploadToken === "string" ? { uploadToken: value.uploadToken } : {}),
    }];
  });
  const quizzes = parseArray("quizzes").flatMap(value => {
    if (!isAssistantRecord(value)) return [];
    return [{
      question: String(value.question || ""),
      options: Array.isArray(value.options) ? value.options.map(option => String(option || "")) : [],
      correctOptionIndex: Number.isSafeInteger(value.correctOptionIndex) ? Number(value.correctOptionIndex) : -1,
    }];
  });
  return { lessons, quizzes };
}
function quotationAcceptanceFormFromValues(values: Record<string, unknown>): AssistantQuotationAcceptanceForm | undefined {
  const contract = parseStructuredAssistantValue(values.__assistantQuotationAcceptanceContract);
  if (!isAssistantRecord(contract) || !Array.isArray(contract.lines) || !contract.lines.length) return undefined;
  const priorLines = parseStructuredAssistantValue(values.lines);
  const priorByIndex = new Map<number, Record<string, unknown>>();
  if (Array.isArray(priorLines)) for (const value of priorLines) {
    if (isAssistantRecord(value) && Number.isInteger(value.lineIndex)) priorByIndex.set(Number(value.lineIndex), value);
  }
  const lines = contract.lines.flatMap((value, lineIndex) => {
    if (!isAssistantRecord(value)) return [];
    const name = typeof value.name === "string" ? value.name.trim().slice(0, 250) : "";
    const unit = typeof value.unit === "string" ? value.unit.trim().slice(0, 50) : "";
    const contractQuantity = Number(value.quantity);
    if (!name || !Number.isFinite(contractQuantity) || contractQuantity < 0) return [];
    const prior = priorByIndex.get(lineIndex);
    return [{
      lineIndex,
      name,
      ...(typeof value.sku === "string" && value.sku.trim() ? { sku: value.sku.trim().slice(0, 100) } : {}),
      ...(typeof value.description === "string" && value.description.trim() ? { description: value.description.trim().slice(0, 500) } : {}),
      unit,
      contractQuantity,
      ...(typeof prior?.acceptedQuantity === "number" ? { acceptedQuantity: prior.acceptedQuantity } : {}),
      ...(typeof prior?.acceptedDetails === "string" ? { acceptedDetails: prior.acceptedDetails.slice(0, 1000) } : {}),
    }];
  });
  if (lines.length !== contract.lines.length) return undefined;
  return { contractNumber: String(contract.contractNumber || "").slice(0, 100), lines };
}
function quotationAcceptanceFinancialDetails(values: Record<string, unknown>) {
  const contract = parseStructuredAssistantValue(values.__assistantQuotationAcceptanceContract);
  if (!isAssistantRecord(contract)) return [];
  const currency = typeof contract.currency === "string" ? contract.currency : "";
  const formatAmount = (value: unknown) => typeof value === "number" && Number.isFinite(value)
    ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value)}${currency ? ` ${currency}` : ""}`
    : "";
  const settlementAmount = formatAmount(contract.total);
  const amountPaid = formatAmount(typeof contract.depositAmount === "number" ? contract.depositAmount : 0);
  return [
    ...(settlementAmount ? [{ label: "Giá trị quyết toán theo hợp đồng", value: settlementAmount }] : []),
    ...(amountPaid ? [{ label: "Số tiền đã thanh toán theo hợp đồng", value: amountPaid }] : []),
  ];
}
function assistantChoiceOptions(op: AssistantOperation, field: AssistantField, values: string[]) {
  return values.map(value => ({ value, label: assistantOptionLabel(op, field, value) }));
}
function receiptProductSearchFromIntent(intent: string) {
  const match = intent.trim().match(/^(?:(?:tạo\s+(?:(?:yêu cầu|phiếu)\s+)?nhập\s+kho)|(?:lập\s+phiếu\s+nhập\s+kho)|(?:nhập\s+(?:hàng|kho)))(?:\s+cho)?(?:\s+(?:sản phẩm|mặt hàng))?(?:\s+(.+))?$/iu);
  return match?.[1]?.replace(/\s+(?:số lượng|sl|giá nhập|đơn giá|kho nhập|nhà cung cấp)\b.*$/iu, "").trim() || "";
}
const INVENTORY_RESOURCE_FIELD_KINDS: Readonly<Record<string, string>> = {
  parentCode: "categories",
  baseUnitCode: "units",
  unitCode: "attributes",
};
export async function missingReferencePrompts(
  req: AuthenticatedRequest,
  op: AssistantOperation,
  workflow: AssistantWorkflow,
  values: Record<string, AssistantValue>,
  intent: string,
  skipped: Set<string>,
  suggestOptions: typeof suggestReferenceOptions = suggestReferenceOptions,
  unresolvedReferenceKeys: ReadonlySet<string> = new Set(),
) {
  const prompts: string[] = [];
  const textPrompts: string[] = [];
  const referenceSelections: AssistantReferenceSelection[] = [];
  const optionSelectionKeys = new Set<string>();
  const awaitingOptional: string[] = [];
  const awaitingLabels: Record<string, string> = {};
  if (op.module === "healthcare" && !values.targetBranch) {
    const branchField = op.fields.find(field => field.key === "targetBranch")!;
    let options: string[] = [];
    try { options = await suggestOptions(req, op, branchField, values); } catch { /* Keep unreadable branches out of suggestions. */ }
    const prompt = options.length ? "Bạn chọn chi nhánh y tế để tiếp tục nhé." : "Mình cần tên chi nhánh y tế để tiếp tục. Bạn kiểm tra quyền xem chi nhánh nếu chưa có lựa chọn nhé.";
    return { prompts: [prompt], textPrompts: options.length ? [] : [prompt], awaitingOptional, awaitingLabels,
      referenceSelections: options.length ? [{ key: branchField.key, label: branchField.label, required: true, multiple: false, options: options.map(value => ({ label: value, value })) }] : [] };
  }
  const missingRequiredDetailReference = op.method === "GET" && op.fields.some(field => {
    if (field.source !== "path" || !field.reference || values[field.key] !== undefined || unresolvedReferenceKeys.has(field.key)) return false;
    const configured = workflow.fields.find(candidate => candidate.key === field.key);
    return Boolean(field.required || field.systemRequired || configured?.required);
  });
  if (missingRequiredDetailReference && op.id !== "student.batch.detail") {
    const missingPathFields = op.fields.filter(field => {
      if (field.source !== "path" || !field.reference || values[field.key] !== undefined || unresolvedReferenceKeys.has(field.key)) return false;
      const configured = workflow.fields.find(candidate => candidate.key === field.key);
      return Boolean(field.required || field.systemRequired || configured?.required);
    });
    const identityPrompts = missingPathFields.map(field => `Mình cần ${field.label} để tra cứu. Bạn gửi giúp mình nhé.`);
    return {
      prompts: identityPrompts,
      textPrompts: identityPrompts,
      referenceSelections,
      awaitingOptional,
      awaitingLabels,
    };
  }
  const isCreate = op.method === "POST" && !op.readOnly;
  const isCatalogProductCreate = isCreate && op.path === "/inventory/catalog/products";
  const branchlessCommissionMutation = String(op.path || "").startsWith("/partners/commission-levels")
    && ["POST", "PATCH", "DELETE"].includes(op.method)
    && ["admin", "manager"].includes(String(req.user?.role || ""))
    && !String(req.user?.branchId || "").trim();
  const commissionBranchField = branchlessCommissionMutation
    ? op.fields.find(field => field.reference === "branch.list" && field.source === "query" && field.apiKey === "branchId")
    : undefined;
  if (commissionBranchField && values[commissionBranchField.key] === undefined) {
    let options: string[] = [];
    try { options = await suggestOptions(req, op, commissionBranchField, values); } catch { /* Do not expose branches outside the caller's permission scope. */ }
    return {
      prompts: [options.length
        ? `Bạn chọn giúp mình ${commissionBranchField.label}: ${options.join("; ")}.`
        : `Mình chưa tìm thấy lựa chọn khả dụng cho ${commissionBranchField.label}. Bạn kiểm tra lại giúp mình nhé.`],
      textPrompts: options.length ? [] : [`Mình chưa tìm thấy lựa chọn khả dụng cho ${commissionBranchField.label}. Bạn kiểm tra lại giúp mình nhé.`],
      referenceSelections: options.length ? [{ key: commissionBranchField.key, label: commissionBranchField.label, required: true, multiple: false, options: assistantChoiceOptions(op, commissionBranchField, options) }] : [],
      awaitingOptional: [],
      awaitingLabels: {},
    };
  }
  const conditionApplies = (field: AssistantField) => {
    const condition = field.requiredWhen;
    if (!condition) return false;
    const candidate = values[condition.field];
    if (condition.present) return candidate !== undefined && candidate !== null && String(candidate).trim() !== "";
    if (condition.equals === undefined) return false;
    return (Array.isArray(condition.equals) ? condition.equals : [condition.equals]).some(value => value === candidate);
  };
  for (const field of op.fields) {
    if (!isAssistantFieldApplicable(workflow, field)) continue;
    if (op.id === "quotation.contract.create" && field.key !== "quoteId" && isBlank(values.quoteId)) continue;
    if (op.id === "retail.coupon.create" && field.apiKey === "customerId" && values.targetType !== "specific_customer") continue;
    if (op.path === "/inventory/catalog/resources/:kind") {
      const applicableKind = INVENTORY_RESOURCE_FIELD_KINDS[field.apiKey || field.key];
      const resourceKind = op.fixedPathValues?.kind ?? values.path_kind;
      if (applicableKind && resourceKind !== applicableKind) continue;
    }
    if (isCatalogProductCreate && field.apiKey === "baseUnitCode" && values[field.key] === undefined) continue;
    if (!field.reference || (values[field.key] !== undefined && !unresolvedReferenceKeys.has(field.key)) || skipped.has(field.key)) continue;
    if (field.alternativeField && !isBlank(values[field.alternativeField]) && isBlank(values[field.key])) continue;
    const configured = workflow.fields.find(item => item.key === field.key);
    const required = Boolean(field.systemRequired || configured?.required || conditionApplies(field));
    const healthcareRelationships: Record<string, RegExp> = {
      doctorId: /\bbac si\b/, roomId: /\bphong(?: kham)?\b/, serviceId: /\bdich vu\b/,
      assigneeId: /\b(?:nhan vien|nguoi phu trach|dieu duong|giao cho|phan cong)\b/,
    };
    const relationRequested = op.module === "healthcare" && ["PATCH", "PUT"].includes(op.method) && field.source === "body"
      ? Boolean(healthcareRelationships[field.apiKey || field.key]?.test(normalizeAssistantText(intent)))
      : relationMentioned(intent, field);
    const mustResolve = required || relationChangeRequested(intent, field);
    const shouldPrompt = required || isCreate || (["PATCH", "PUT"].includes(op.method) && relationRequested);
    if (!shouldPrompt) continue;
    let options: string[] = [];
    let lookupFailed = false;
    const referenceValues = unresolvedReferenceKeys.has(field.key) && values[field.key] !== undefined
      ? { ...values, [referenceSearchKey(field.key)]: String(values[field.key]) }
      : values;
    try { options = await suggestOptions(req, op, field, referenceValues); } catch { lookupFailed = true; /* permission or endpoint failures do not expose another scope */ }
    if (!mustResolve && options.length === 0) continue;
    if (!mustResolve) { awaitingOptional.push(field.key); awaitingLabels[field.key] = field.label; }
    const skipHint = mustResolve ? ""
      : op.path === "/inventory/catalog/resources/:kind" && field.apiKey === "parentCode"
        ? " Nếu muốn tạo mục gốc, bạn có thể nói “bỏ qua thư mục cha”."
        : ` Nếu chưa muốn chọn, bạn có thể nói “bỏ qua ${field.label.toLocaleLowerCase("vi")}”.`;
    const prompt = options.length
      ? `Bạn chọn giúp mình ${field.label}: ${options.join("; ")}.${skipHint}`
      : unavailableReferencePrompt(op, field, field.label, skipHint, lookupFailed);
    prompts.push(prompt);
    if (options.length) referenceSelections.push({ key: field.key, label: field.label, required: mustResolve, multiple: false, options: assistantChoiceOptions(op, field, options) });
    else textPrompts.push(prompt);
  }

  for (const field of op.fields) {
    if (!isAssistantFieldApplicable(workflow, field)) continue;
    const currentValue = values[field.key];
    const currentOptionIsValid = currentValue !== undefined && field.options?.some(option => String(option) === String(currentValue));
    const hasInvalidProvidedOption = currentValue !== undefined && !isBlank(currentValue);
    if (!field.options?.length || field.reference || currentOptionIsValid || skipped.has(field.key)) continue;
    const configured = workflow.fields.find(item => item.key === field.key);
    const required = Boolean(field.systemRequired || configured?.required || conditionApplies(field));
    if (!required && !hasInvalidProvidedOption) continue;
    referenceSelections.push({ key: field.key, label: field.label, required: true, multiple: false, options: assistantChoiceOptions(op, field, field.options) });
    optionSelectionKeys.add(field.key);
    prompts.push(`${field.label}: cần chọn một giá trị trong danh sách.`);
  }

  const isLaborPartnerPolicyCreate = op.method === "POST" && op.path === "/worker-management/partners/policies";
  const readPolicyEnabled = (key: "official" | "seasonal") => {
    const value = parseStructuredAssistantValue(values[key]);
    return isAssistantRecord(value) && typeof value.enabled === "boolean" ? value.enabled : undefined;
  };
  const shouldSelectLaborPolicyType = isLaborPartnerPolicyCreate
    && readPolicyEnabled("official") === undefined
    && readPolicyEnabled("seasonal") === undefined;
  if (shouldSelectLaborPolicyType) {
    referenceSelections.push({
      key: "laborPolicyTypes",
      label: "Loại lao động áp dụng",
      required: true,
      multiple: false,
      options: [
        { value: "official", label: "Lao động chính thức" },
        { value: "seasonal", label: "Lao động thời vụ" },
      ],
    });
    prompts.push("Chọn một loại lao động áp dụng cho chính sách.");
  }

  if (op.id === "quotation.customer-quote.create" && isBlank(values.items) && isBlank(values.sourceRequirements)) {
    if (values.__assistantQuotationMode === "manual") {
      const referenceField: AssistantField = { key: "items", label: "Sản phẩm khách hàng cần báo giá", type: "reference", reference: "quotation.catalog.list" };
      let options: string[] = [];
      try { options = await suggestOptions(req, op, referenceField, values); } catch { /* ignore lookup failure */ }
      if (options.length) {
        prompts.push(`Bạn chọn giúp mình ${referenceField.label} từ bảng giá: ${options.join("; ")}. Có thể chọn một hoặc nhiều sản phẩm.`);
        referenceSelections.push({ key: "items", label: referenceField.label, required: true, multiple: true, options: assistantChoiceOptions(op, referenceField, options) });
      }
    } else if (values.__assistantQuotationMode !== "ai") {
      referenceSelections.push({
        key: "customerQuoteMode",
        label: "Cách chọn sản phẩm báo giá",
        required: true,
        multiple: false,
        options: [
          { value: "manual", label: "Tự chọn sản phẩm từ bảng giá" },
          { value: "ai", label: "Để AI gợi ý sản phẩm theo yêu cầu" },
        ],
      });
      prompts.push("Chọn cách lập danh sách sản phẩm báo giá: tự chọn sản phẩm từ bảng giá hoặc để AI gợi ý sản phẩm theo yêu cầu.");
    }
  }

  const nestedReferenceKey = (rootKey: string, path: string) => `${rootKey}${path}`;
  for (const field of op.fields) {
    if (!field.structure) continue;
    let data: unknown;
    if (values[field.key] === undefined && field.structure.type !== "array" && !["POST", "PATCH", "PUT"].includes(op.method)) continue;
    if (values[field.key] !== undefined) {
      if (typeof values[field.key] !== "string") continue;
      try { data = JSON.parse(String(values[field.key])); } catch { continue; }
    }
    if (op.id === "inventory.receipt.create" && field.key === "items" && (!Array.isArray(data) || data.length === 0)) data = [{}];
    const visit = async (
      shape: AssistantDataShape,
      node: unknown,
      path: string,
      displayPath: string[],
      currentObject?: Record<string, unknown>,
    ): Promise<void> => {
      const condition = shape.requiredWhen;
      const conditionValue = condition ? currentObject?.[condition.field] : undefined;
      const shapeConditionApplies = condition?.present
        ? conditionValue !== undefined && conditionValue !== null && !(typeof conditionValue === "string" && !conditionValue.trim())
        : condition?.equals !== undefined && (Array.isArray(condition.equals) ? condition.equals : [condition.equals]).some(value => value === conditionValue);
      const nodeIsBlank = node === undefined || node === null || (typeof node === "string" && !node.trim());
      if (condition && !shape.required && !shapeConditionApplies && nodeIsBlank) return;
      if (shape.reference) {
        const key = nestedReferenceKey(field.key, path);
        const unresolved = unresolvedReferenceKeys.has(key);
        if (node !== undefined && node !== null && String(node).trim() && !unresolved) return;
        if (isCatalogProductCreate && field.key === "variant" && path === ".unitCode") return;
        if (skipped.has(key)) return;
        const parentValue = shape.referenceParentKey
          ? currentObject?.[shape.referenceParentKey] ?? values[shape.referenceParentKey]
          : undefined;
        const required = Boolean(shape.required || shapeConditionApplies);
        const referenceField: AssistantField = {
          key,
          label: shape.label || path.split(".").at(-1) || "Thông tin liên quan",
          type: "reference",
          reference: shape.reference,
          ...(shape.referenceValueKey ? { referenceValueKey: shape.referenceValueKey } : {}),
          ...(shape.referenceParentKey ? { referenceParentKey: shape.referenceParentKey } : {}),
          ...(shape.referenceContext ? { referenceContext: shape.referenceContext } : {}),
        };
        const relationRequested = relationMentioned(intent, referenceField);
        const mustResolve = required || relationChangeRequested(intent, referenceField);
        const isBulkOptionalNestedUnmentioned = (op.id === "student.bulk.create" || op.id === "student.bulk.preview")
          && !required
          && !unresolved
          && nodeIsBlank
          && (!relationRequested || (Array.isArray(data) && data.length > 1));
        const shouldPrompt = !isBulkOptionalNestedUnmentioned && (required || isCreate || (["PATCH", "PUT"].includes(op.method) && relationRequested));
        if (!shouldPrompt) return;
        if (shape.referenceParentKey && !shape.referenceParentOptional && (parentValue === undefined || parentValue === null || parentValue === "")) return;
        const label = [field.label, ...displayPath, shape.label || path.split(".").at(-1) || "Thông tin liên quan"].filter(Boolean).join(" · ");
        referenceField.label = label;
        let options: string[] = [];
        let lookupFailed = false;
        const receiptProductSearch = op.id === "inventory.receipt.create" && field.key === "items" && path.endsWith(".productId")
          ? receiptProductSearchFromIntent(intent)
          : "";
        try { options = await suggestOptions(req, op, referenceField, {
          ...values,
          ...(currentObject || {}),
          ...(unresolved && node !== undefined && node !== null && String(node).trim() ? { [referenceSearchKey(key)]: String(node) } : {}),
          ...(receiptProductSearch ? { [`__assistantReferenceSearch_${key}`]: receiptProductSearch } : {}),
          ...(shape.referenceParentKey && parentValue !== undefined ? { [shape.referenceParentKey]: parentValue as AssistantValue } : {}),
        } as Record<string, AssistantValue>); }
        catch { lookupFailed = true; /* permission or endpoint failures do not expose another scope */ }
        if (!mustResolve && options.length === 0) return;
        if (!mustResolve) { awaitingOptional.push(key); awaitingLabels[key] = label; }
        const skipHint = mustResolve ? "" : ` Nếu chưa muốn chọn, bạn có thể nói “bỏ qua ${shape.label || "trường liên kết"}”.`;
        const prompt = options.length
          ? `Bạn chọn giúp mình ${label}: ${options.join("; ")}.${skipHint}`
          : unavailableReferencePrompt(op, referenceField, label, skipHint, lookupFailed);
        prompts.push(prompt);
        if (options.length) referenceSelections.push({ key, label, required: mustResolve, multiple: false, options: assistantChoiceOptions(op, referenceField, options) });
        else textPrompts.push(prompt);
        return;
      }
      if (shape.options?.length) {
        const currentOptionIsValid = node !== undefined && node !== null && shape.options.some(option => String(option) === String(node));
        const hasInvalidProvidedOption = node !== undefined && node !== null && String(node).trim() !== "";
        if (currentOptionIsValid) return;
        if (!shape.required && !shapeConditionApplies && !hasInvalidProvidedOption) return;
        const key = nestedReferenceKey(field.key, path);
        if (skipped.has(key)) return;
        const label = [field.label, ...displayPath].filter(Boolean).join(" · ");
        const optionField: AssistantField = { key, label, type: "text", options: shape.options.map(String) };
        referenceSelections.push({
          key,
          label,
          required: true,
          multiple: false,
          options: assistantChoiceOptions(op, optionField, optionField.options || []),
        });
        optionSelectionKeys.add(key);
        prompts.push(`${label}: cần chọn một giá trị trong danh sách.`);
        return;
      }
      if (shape.type === "array") {
        if ((!Array.isArray(node) || node.length === 0) && shape.items?.reference) {
          const itemShape = shape.items;
          const normalizedPath = path.replace(/^\./, "");
          const key = normalizedPath ? nestedReferenceKey(field.key, `.${normalizedPath}`) : field.key;
          if (skipped.has(key) || skipped.has(`${key}[]`)) return;
          const referenceField: AssistantField = {
            key,
            label: itemShape.label || field.label,
            type: "reference",
            reference: itemShape.reference,
            ...(itemShape.referenceValueKey ? { referenceValueKey: itemShape.referenceValueKey } : {}),
            ...(itemShape.referenceParentKey ? { referenceParentKey: itemShape.referenceParentKey } : {}),
            ...(itemShape.referenceContext ? { referenceContext: itemShape.referenceContext } : {}),
          };
          const configured = workflow.fields.find(candidate => candidate.key === field.key);
          const required = Boolean(field.systemRequired || field.required || configured?.required || shape.required || itemShape.required || conditionApplies(field));
          const relationRequested = relationMentioned(intent, referenceField);
          const mustResolve = required || relationChangeRequested(intent, referenceField);
          const shouldPrompt = required || isCreate || (["PATCH", "PUT"].includes(op.method) && relationRequested);
          if (!shouldPrompt) return;
          const parentValue = itemShape.referenceParentKey
            ? currentObject?.[itemShape.referenceParentKey] ?? values[itemShape.referenceParentKey]
            : undefined;
          if (itemShape.referenceParentKey && !itemShape.referenceParentOptional
            && (parentValue === undefined || parentValue === null || parentValue === "")) return;
          const context = displayPath.length ? ` (${displayPath.join(" · ").toLocaleLowerCase("vi")} trong ${field.label})` : "";
          const label = `${itemShape.label}${context}`;
          referenceField.label = label;
          let options: string[] = [];
          let lookupFailed = false;
          try { options = await suggestOptions(req, op, referenceField, {
            ...values,
            ...(currentObject || {}),
            ...(itemShape.referenceParentKey && parentValue !== undefined ? { [itemShape.referenceParentKey]: parentValue as AssistantValue } : {}),
          } as Record<string, AssistantValue>); }
          catch { lookupFailed = true; /* do not expose records outside the granted scope */ }
          if (!mustResolve && options.length === 0) return;
          if (!mustResolve) { awaitingOptional.push(key); awaitingLabels[key] = label; }
          const skipHint = mustResolve ? "" : ` Nếu chưa muốn chọn, bạn có thể nói “bỏ qua ${itemShape.label || field.label}”.`;
          const prompt = options.length
            ? `Bạn chọn giúp mình ${itemShape.label}: ${options.join("; ")}${context}. Có thể chọn một hoặc nhiều tên.${skipHint}`
            : unavailableReferencePrompt(op, referenceField, label, skipHint, lookupFailed);
          prompts.push(prompt);
          if (options.length) referenceSelections.push({ key, label, required: mustResolve, multiple: true, options: assistantChoiceOptions(op, referenceField, options) });
          else textPrompts.push(prompt);
          return;
        }
        if (!Array.isArray(node)) return;
        for (let index = 0; index < node.length; index++) {
          await visit(shape.items || { type: "unknown" }, node[index], `${path}[${index + 1}]`, [...displayPath, `Mục ${index + 1}`], currentObject);
        }
        return;
      }
      if (shape.type !== "object") return;
      if (node !== undefined && node !== null && (typeof node !== "object" || Array.isArray(node))) return;
      const record = (node || {}) as Record<string, unknown>;
      for (const [key, childShape] of Object.entries(shape.keys || {})) {
        const childPath = `${path}.${key}`;
        if (shouldSelectLaborPolicyType && ["official.enabled", "seasonal.enabled"].includes(`${field.key}${childPath}`)) continue;
        const childDisplay = [...displayPath, childShape.label || key];
        if (childShape.reference) await visit(childShape, record[key], childPath, displayPath, record);
        else if (childShape.type === "object" || childShape.type === "array" || childShape.options?.length) await visit(childShape, record[key], childPath, childDisplay, record);
      }
    };
    await visit(field.structure, data, "", [], undefined);
  }
  return { prompts, textPrompts, referenceSelections, awaitingOptional, awaitingLabels, optionSelectionKeys };
}
export function skippedReferenceTargets(text: string, operation: AssistantOperation, awaitingKeys: string[], awaitingLabels: Record<string, string> = {}) {
  if (!awaitingKeys.length || !isSkippingReference(text)) return [];
  const normalized = normalizeAssistantText(text);
  const matched = awaitingKeys.filter(key => {
    const field = operation.fields.find(item => item.key === key);
    const stopWords = new Set(["ten", "ma", "hoac", "va", "cua", "cho", "ho", "mot", "cac", "ban", "ghi"]);
    const tokens = [key, field?.apiKey || "", awaitingLabels[key] || field?.label || ""]
      .flatMap(value => normalizeAssistantText(value).split(/[^a-z0-9]+/))
      .filter(token => token.length >= 3 && !stopWords.has(token));
    return tokens.some(token => normalized.includes(token));
  });
  return matched.length ? matched : awaitingKeys;
}
function populatedNestedReferenceKeys(operation: AssistantOperation, values: Record<string, unknown>) {
  const populated = new Set<string>();
  const visit = (shape: AssistantDataShape, node: unknown, path: string): void => {
    if (shape.reference) {
      if (node !== undefined && node !== null && String(node).trim()) populated.add(`${path}`);
      return;
    }
    if (shape.type === "array" && Array.isArray(node)) {
      node.forEach((item, index) => visit(shape.items || { type: "unknown" }, item, `${path}[${index + 1}]`));
      return;
    }
    if (shape.type === "object" && node && typeof node === "object" && !Array.isArray(node)) {
      for (const [key, childShape] of Object.entries(shape.keys || {})) visit(childShape, (node as Record<string, unknown>)[key], `${path}.${key}`);
    }
  };
  for (const field of operation.fields) {
    if (!field.structure || typeof values[field.key] !== "string") continue;
    try { visit(field.structure, JSON.parse(String(values[field.key])), field.key); } catch { /* malformed structures are reported by normal validation */ }
  }
  return populated;
}
function applyReferenceSelection(provided: Record<string, unknown>, operation: AssistantOperation, selection: AssistantReferenceSelection, values: string[]) {
  if (operation.method === "POST" && operation.path === "/worker-management/partners/policies" && selection.key === "laborPolicyTypes") {
    const allowedTypes = new Set(["official", "seasonal"]);
    if (values.length !== 1 || values.some(value => !allowedTypes.has(value))) throw new AssistantError("Bạn cần chọn đúng một loại lao động: chính thức hoặc thời vụ.");
    const selectedType = values[0];
    for (const type of ["official", "seasonal"] as const) {
      const parsed = parseStructuredAssistantValue(provided[type]);
      const current = isAssistantRecord(parsed) ? parsed : {};
      provided[type] = JSON.stringify({ ...current, enabled: selectedType === type });
    }
    return;
  }
  if (operation.id === "quotation.customer-quote.create" && selection.key === "customerQuoteMode") {
    if (values.length !== 1 || !["manual", "ai"].includes(values[0])) throw new AssistantError("Bạn cần chọn một phương thức: tự chọn sản phẩm từ bảng giá hoặc để AI gợi ý sản phẩm.");
    provided.__assistantQuotationMode = values[0];
    return;
  }
  const field = operation.fields.find(candidate => selection.key === candidate.key
    || selection.key.startsWith(`${candidate.key}.`) || selection.key.startsWith(`${candidate.key}[`));
  if (!field) throw new AssistantError("Một lựa chọn không còn thuộc thao tác đang chờ. Bạn tải lại lựa chọn giúp mình nhé.");
  if (selection.key === field.key) {
    if (operation.id === "quotation.customer-quote.create" && field.key === "items") provided[field.key] = JSON.stringify(values.map(catalogItemId => ({ catalogItemId })));
    else if (field.structure?.type === "array" && field.structure.items?.reference) provided[field.key] = JSON.stringify(values);
    else if (field.structure?.reference) provided[field.key] = values[0];
    else if (!field.structure) provided[field.key] = values[0];
    else throw new AssistantError(`Mình chưa thể áp dụng lựa chọn cho ${selection.label}.`);
    return;
  }
  let root: any = field.structure?.type === "array" ? [] : {};
  if (typeof provided[field.key] === "string" && String(provided[field.key]).trim()) {
    try { root = JSON.parse(String(provided[field.key])); }
    catch { throw new AssistantError(`Thông tin ${field.label} không còn đúng định dạng. Bạn gửi lại yêu cầu giúp mình nhé.`); }
  }
  const suffix = selection.key.slice(field.key.length);
  const tokens = [...suffix.matchAll(/(?:^|\.)([^.[\]]+)|\[(\d+)\]/g)].map(match => match[1] ?? { index: Number(match[2]) });
  if (!tokens.length) throw new AssistantError(`Mình chưa thể áp dụng lựa chọn cho ${selection.label}.`);
  let valueShape: AssistantDataShape | undefined = field.structure;
  for (const token of tokens) valueShape = typeof token === "object" ? valueShape?.items : valueShape?.keys?.[token];
  const selectedValue = (value: string): AssistantValue => valueShape?.type === "number" && Number.isFinite(Number(value))
    ? Number(value)
    : valueShape?.type === "boolean" && (value === "true" || value === "false")
      ? value === "true"
      : value;
  const mappedValues = values.map(selectedValue);
  let node = root;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const isLast = index === tokens.length - 1;
    if (typeof token === "object") {
      if (!Array.isArray(node)) throw new AssistantError(`Thông tin ${selection.label} không còn đúng cấu trúc.`);
      const arrayIndex = Math.max(0, token.index - 1);
      if (isLast) node[arrayIndex] = selection.multiple ? mappedValues : mappedValues[0];
      else {
        if (node[arrayIndex] === undefined) node[arrayIndex] = typeof tokens[index + 1] === "object" ? [] : {};
        node = node[arrayIndex];
      }
    } else {
      if (!node || typeof node !== "object" || Array.isArray(node)) throw new AssistantError(`Thông tin ${selection.label} không còn đúng cấu trúc.`);
      if (isLast) node[token] = selection.multiple ? mappedValues : mappedValues[0];
      else {
        if (node[token] === undefined) node[token] = typeof tokens[index + 1] === "object" ? [] : {};
        node = node[token];
      }
    }
  }
  provided[field.key] = JSON.stringify(root);
}
function applyReferenceSelections(
  pending: PendingAction,
  operation: AssistantOperation,
  selections: Record<string, string[]>,
  skipKeys: string[],
) {
  const groups = new Map((pending.referenceSelections || []).map(group => [group.key, group]));
  const selectedKeys = Object.keys(selections);
  if (selectedKeys.some(key => !groups.has(key)) || skipKeys.some(key => !groups.has(key))) {
    throw new AssistantError("Một lựa chọn đã hết hạn. Bạn chọn lại trong danh sách hiện tại giúp mình nhé.");
  }
  const skipSet = new Set(skipKeys);
  const provided = { ...pending.provided };
  for (const group of groups.values()) {
    const values = selections[group.key] || [];
    const skipped = skipSet.has(group.key);
    if (values.length && skipped) throw new AssistantError(`Bạn chỉ cần chọn hoặc bỏ qua ${group.label}, không chọn cả hai.`);
    if (group.required && !values.length) throw new AssistantError(`Bạn chọn giúp mình ${group.label} để tiếp tục.`);
    if (!group.required && !values.length && !skipped) throw new AssistantError(`Bạn chọn một mục hoặc bỏ qua ${group.label} giúp mình nhé.`);
    if (!group.multiple && values.length > 1) throw new AssistantError(`Bạn chỉ chọn một mục cho ${group.label} nhé.`);
    if (values.some(value => !group.options.some(option => option.value === value))) throw new AssistantError(`Một lựa chọn cho ${group.label} không còn trong danh sách. Bạn chọn lại giúp mình nhé.`);
    if (values.length) applyReferenceSelection(provided, operation, group, values);
  }
  return { provided, skipped: skipKeys };
}
function referenceSelectionSummary(pending: PendingAction | null, selections?: Record<string, string[]>, skipKeys: string[] = []) {
  if (!selections) return "";
  const groups = new Map((pending?.referenceSelections || []).map(group => [group.key, group]));
  const chosen = Object.entries(selections).flatMap(([key, values]) => {
    const group = groups.get(key);
    return group && values.length ? [`${group.label}: ${values.map(value => group.options.find(option => option.value === value)?.label || value).join(", ")}`] : [];
  });
  const skipped = skipKeys.map(key => groups.get(key)?.label).filter((label): label is string => Boolean(label));
  return [chosen.length ? `Mình chọn ${chosen.join("; ")}.` : "Mình tiếp tục mà không chọn thêm mục nào.", skipped.length ? `Đã bỏ qua: ${skipped.join(", ")}.` : ""].filter(Boolean).join("\n");
}
const pendingPartnerReference = (pending?: PendingAction | null) => {
  if (!pending || operationById(pending.actionId)?.path !== "/partners/:id") return "";
  const reference = pending.provided.path_id ?? pending.provided.id;
  return typeof reference === "string" ? reference.trim() : "";
};
const contextualPendingPartnerReference = (intent: string, pending?: PendingAction | null) => {
  const reference = pendingPartnerReference(pending);
  const normalized = normalizePartnerIntent(intent);
  return reference && (!/\bcho doi tac\b/.test(normalized) || /\bdoi tac (?:nay|do)\b/.test(normalized)) ? reference : "";
};
const isPartnerBankUpdateIntent = (value: string) => {
  const intent = normalizePartnerIntent(value);
  return /\bdoi tac\b/.test(intent)
    && /\b(?:chuyen khoan|tai khoan(?: ngan hang)?|ngan hang|bank account|bank details)\b/.test(intent)
    && /\b(?:them|cap nhat|sua|bo sung|doi|thay doi|cau hinh)\b/.test(intent);
};
const isCommissionLevelCreationIntent = (value: string, hasPartnerContext = false) => {
  const intent = normalizePartnerIntent(value);
  if (hasPartnerContext && /\bhoa hong\b/.test(intent) && !/\bcap bac\b/.test(intent)) return false;
  return /\b(?:them|tao|bo sung|lap)\b.{0,40}\b(?:cau hinh|cap bac|muc)\b.{0,24}\bhoa hong\b/.test(intent)
    && !/\bcho doi tac\b/.test(intent);
};
const isPartnerCommissionUpdateIntent = (value: string, hasPartnerContext = false) => {
  const intent = normalizePartnerIntent(value);
  return /\bhoa hong\b/.test(intent)
    && !/\b(?:lao dong|cong nhan|worker|labor)\b/.test(intent)
    && (/\bcho doi tac\b/.test(intent) || hasPartnerContext)
    && !/\bcap bac\b/.test(intent);
};
const isPartnerDetailsIntent = (value: string) => {
  const intent = normalizePartnerIntent(value);
  return /\bdoi tac\b/.test(intent)
    && /\b(?:thong tin|tai khoan|chuyen khoan|ho so)\b/.test(intent)
    && !/\b(?:them|cap nhat|sua|xoa|tao|cau hinh|ghi nhan|thay doi|doi\s+(?:thong tin|tai khoan))\b/.test(intent);
};

export async function conversationState(req: AuthenticatedRequest, conversationId: string) {
  const scope = { ...conversationReadScope(req), conversationId };
  const session = await AssistantSessionModel.findOne(scope).lean();
  const turn = await AssistantTurnModel.findOne(scope).sort({ createdAt: -1 }).lean();
  const operation = operationById((session?.pending as PendingAction | undefined)?.actionId || turn?.actionId || "");
  return { messages: session?.messages || [], lastReply: sanitizeReplyPreview(session?.lastReply as AssistantReply | null, operation, session?.mode === "qa" ? "qa" : "work") || null, busy: Boolean(session?.busy), mode: session?.mode === "qa" ? "qa" : "work", requestId: turn && ["processing", "executing"].includes(turn.status) ? turn.requestId : undefined };
}

export async function conversationMemory(req: AuthenticatedRequest, conversationId: string) {
  const session = await AssistantSessionModel.findOne({ ...conversationReadScope(req), conversationId })
    .select("sessionMemory sessionMemoryMessageCount sessionMemoryVersion messageCount busy updatedAt").lean();
  if (!session) return { summary: "", summaryMessageCount: 0, version: 0, messageCount: 0, busy: false, updatedAt: null };
  return {
    summary: typeof session.sessionMemory === "string" ? session.sessionMemory : "",
    summaryMessageCount: Number(session.sessionMemoryMessageCount) || 0,
    version: Number(session.sessionMemoryVersion) || 0,
    messageCount: Number(session.messageCount) || 0,
    busy: Boolean(session.busy),
    updatedAt: session.updatedAt,
  };
}

export async function saveConversationMemory(req: AuthenticatedRequest, conversationId: string, rawSummary: unknown, expectedVersion?: number) {
  if (typeof rawSummary !== "string") throw new AssistantError("Nội dung ngữ cảnh phiên không hợp lệ.", 400);
  const summary = rawSummary.replace(/\s+/g, " ").trim();
  if (summary.length > SESSION_MEMORY_LIMIT) throw new AssistantError(`Ngữ cảnh phiên tối đa ${SESSION_MEMORY_LIMIT} ký tự.`, 400);
  if (containsSensitiveMemoryContent(summary)) throw new AssistantError("Không lưu mật khẩu, dữ liệu nhạy cảm hoặc thông tin xác thực trong ngữ cảnh phiên.", 400);
  const scope = { ...conversationReadScope(req), conversationId };
  const session = await AssistantSessionModel.findOne(scope).select("_id messageCount sessionMemoryVersion").lean();
  const currentVersion = Number(session?.sessionMemoryVersion) || 0;
  if (expectedVersion !== undefined && expectedVersion !== currentVersion) throw new AssistantError("Ngữ cảnh phiên đã được cập nhật ở nơi khác. Tải lại rồi thử lưu lại.", 409);
  let updated: any;
  try {
    const updateFilter: any = { ...(session ? { _id: session._id } : scope), busy: false, ...sessionMemoryVersionFilter(currentVersion) };
    const updateValues: any = {
      $set: { sessionMemory: summary, sessionMemoryMessageCount: Number(session?.messageCount) || 0 },
      $inc: { sessionMemoryVersion: 1 },
      ...(!session ? { $setOnInsert: { ...scopeOf(req), conversationId, messages: [], messageCount: 0, busy: false } } : {}),
    };
    const updateOptions: any = { returnDocument: "after", upsert: !session, setDefaultsOnInsert: true };
    updated = await AssistantSessionModel.findOneAndUpdate(updateFilter, updateValues, updateOptions)
      .select("sessionMemory sessionMemoryMessageCount sessionMemoryVersion messageCount updatedAt").lean();
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new AssistantError("Phiên vừa được tạo hoặc cập nhật. Tải lại rồi thử lưu lại.", 409);
    throw error;
  }
  if (!updated) throw new AssistantError("Phiên đang xử lý. Hãy thử lưu lại sau khi trợ lý trả lời.", 409);
  return {
    summary: updated.sessionMemory || "",
    summaryMessageCount: Number(updated.sessionMemoryMessageCount) || 0,
    version: Number(updated.sessionMemoryVersion) || 0,
    messageCount: Number(updated.messageCount) || 0,
    updatedAt: updated.updatedAt,
  };
}

export async function clearConversationMemory(req: AuthenticatedRequest, conversationId: string) {
  return saveConversationMemory(req, conversationId, "");
}

export async function deleteConversation(req: AuthenticatedRequest, conversationId: string): Promise<{ deleted: boolean }> {
  const scope = { ...conversationReadScope(req), conversationId };
  const session = await AssistantSessionModel.findOneAndUpdate(
    { ...scope, busy: false }, { $set: { busy: true } }, { returnDocument: "after" },
  ).lean();
  if (!session) {
    const existing = await AssistantSessionModel.findOne(scope).select("_id").lean();
    if (!existing) return { deleted: false };
    throw new AssistantError("Phiên đang xử lý. Hãy thử xóa lại sau khi trợ lý trả lời.", 409);
  }
  try {
    await AssistantDocumentModel.deleteMany({
      userId: session.userId, companyCode: session.companyCode,
      branchId: session.branchId || "", conversationId: session.conversationId,
    });
    await AssistantTurnModel.deleteMany({
      userId: session.userId,
      companyCode: session.companyCode,
      branchId: session.branchId || "",
      conversationId: session.conversationId,
    });
    await AssistantSessionModel.deleteOne({ _id: session._id, busy: true });
    return { deleted: true };
  } catch (error) {
    await AssistantSessionModel.updateOne({ _id: session._id, busy: true }, { $set: { busy: false } }).catch(() => undefined);
    throw error;
  }
}

const conversationText = (value: unknown, maxLength: number) => {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
};

export async function listConversations(req: AuthenticatedRequest, options: { limit: number; before?: Date; beforeId?: string }) {
  await ensureAssistantIndexes();
  const filter: any = { ...conversationReadScope(req) };
  if (options.before && options.beforeId) {
    filter.$or = [
      { updatedAt: { $lt: options.before } },
      { updatedAt: options.before, _id: { $lt: options.beforeId } },
    ];
  }
  const rows = await AssistantSessionModel.find(filter)
    .select("_id conversationId mode messages messageCount updatedAt")
    .sort({ updatedAt: -1, _id: -1 })
    .limit(options.limit + 1)
    .lean();
  const hasMore = rows.length > options.limit;
  const page = rows.slice(0, options.limit);
  const last = page[page.length - 1];
  return {
    items: page.map(session => {
      const messages = Array.isArray(session.messages) ? session.messages : [];
      const firstUser = messages.find(message => message?.role === "user");
      const lastMessage = messages[messages.length - 1];
      return {
        conversationId: session.conversationId,
        mode: session.mode === "qa" ? "qa" : "work",
        title: conversationText(firstUser?.content, 100) || "Cuộc trò chuyện mới",
        preview: conversationText(lastMessage?.content, 180),
        messageCount: session.messageCount || messages.length,
        updatedAt: session.updatedAt,
      };
    }),
    nextCursor: hasMore && last ? { before: new Date(last.updatedAt).toISOString(), beforeId: String(last._id) } : null,
  };
}

export async function processTurn(req: AuthenticatedRequest, input: TurnInput): Promise<AssistantReply> {
  const scope = scopeOf(req);
  const assistantMode = input.mode || "work";
  await ensureAssistantIndexes();
  const projectInstructions = input.projectId ? await projectInstructionsForConversation(req, input.projectId, input.conversationId) : "";
  const fileDigestInput = input.conversationUpload ? {
    fileName: input.conversationUpload.fileName,
    digest: createHash("sha256").update(input.conversationUpload.buffer).digest("hex"),
  } : null;
  const digest = createHash("sha256").update(JSON.stringify({ conversationId: input.conversationId, projectId: input.projectId || "", mode: assistantMode, research: assistantMode === "qa", text: input.text || "", attachment: input.attachment || null, conversationFile: fileDigestInput, referenceSelections: input.referenceSelections || null, skipReferenceKeys: input.skipReferenceKeys || null, trainingContent: input.trainingContent || null, acceptanceLines: input.acceptanceLines || null, decision: input.decision ? { id: input.decision.id, confirmed: input.decision.confirmed } : null })).digest("hex");
  const requestFilter = { ...scope, requestId: input.requestId };
  let turn: any;
  try { turn = await AssistantTurnModel.create({ ...requestFilter, conversationId: input.conversationId, digest }); }
  catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const existing = await AssistantTurnModel.findOne(requestFilter).lean();
    if (!existing || existing.digest !== digest) throw new AssistantError("Mã yêu cầu đã được dùng cho nội dung khác.", 409);
    if (existing.result) {
      const cached = existing.result as AssistantReply;
      let operation = operationById(existing.actionId || "");
      if (!operation && cached.action) {
        // Older collecting turns kept their operation only in the pending action.
        const stored = await AssistantSessionModel.findOne({ ...scope, conversationId: input.conversationId }).select("pending").lean();
        const pendingAction = stored?.pending as PendingAction | undefined;
        if (pendingAction?.id === cached.action.id) operation = operationById(pendingAction.actionId);
      }
      return sanitizeReplyPreview(cached, operation, assistantMode)!;
    }
    return Date.now() - new Date(existing.updatedAt).getTime() > ASSISTANT_TURN_RECOVERY_WINDOW_MS ? uncertainReply() : processingReply();
  }
  const sessionFilter = { ...scope, conversationId: input.conversationId };
  try { await AssistantSessionModel.updateOne(sessionFilter, { $setOnInsert: { ...sessionFilter, mode: assistantMode } }, { upsert: true }); }
  catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
  const session = await AssistantSessionModel.findOneAndUpdate({ ...sessionFilter, busy: false }, { $set: { busy: true } }, { returnDocument: "after" });
  if (!session) {
    const reply: AssistantReply = { status: "failed", reply: "Mình đang xử lý một yêu cầu khác trong cuộc trò chuyện này. Bạn chờ kết quả rồi gửi yêu cầu tiếp theo nhé." };
    await AssistantTurnModel.updateOne({ _id: turn._id }, { $set: { status: "completed", result: reply } });
    return reply;
  }
  let pending = restorePendingActionId(session.pending as PendingAction | null);
  let pendingDocumentRequest = session.pendingDocumentRequest || "";
  if (pending) pending.preview = sanitizeActionPreview(pending.preview, operationById(pending.actionId));
  let hasDispatched = false;
  let completion: AssistantCompletion | undefined;
  let reply: AssistantReply;
  let needsIntentClarification = false;
  let responseRules = "";
  let autoMemoryEnabled = false;
  const sessionMemory = typeof session.sessionMemory === "string" ? session.sessionMemory : "";
  const trainingContentSummary = input.trainingContent
    ? `Đã gửi biểu mẫu với ${input.trainingContent.lessons.length} bài giảng và ${input.trainingContent.quizzes.length} câu hỏi trắc nghiệm.`
    : "";
  const acceptanceLinesSummary = input.acceptanceLines
    ? `Đã nhập khối lượng nghiệm thu cho ${input.acceptanceLines.lines.length} dòng hợp đồng.`
    : "";
  const uploadedFileSummary = input.conversationUpload ? `Đã đính kèm tệp ${input.conversationUpload.fileName}.` : "";
  let conversationFile: AssistantConversationFileContext | undefined;
  const userContent = [input.text || referenceSelectionSummary(pending, input.referenceSelections, input.skipReferenceKeys) || trainingContentSummary || acceptanceLinesSummary || (input.decision?.confirmed ? "Xác nhận thực hiện thao tác đã xem trước." : "Hủy thao tác đã xem trước."), input.attachment ? `Đã đính kèm ${input.attachment.fileName} (${input.attachment.rows.length} dòng).` : "", uploadedFileSummary].filter(Boolean).join("\n");
  const memoryCommand = input.text ? parseExplicitMemoryCommand(input.text) : null;
  const forgetMemoryCommand = input.text ? parseExplicitMemoryForgetCommand(input.text) : null;
  const historyContent = forgetMemoryCommand
    ? "Người dùng đã yêu cầu quên một ghi nhớ cá nhân."
    : memoryCommand && containsSensitiveMemoryContent(memoryCommand)
      ? "Yêu cầu ghi nhớ bị từ chối vì chứa thông tin nhạy cảm."
      : userContent;
  const history = [...session.messages, { role: "user", content: historyContent, createdAt: new Date().toISOString() }];

  const execute = async (op: AssistantOperation, workflow: AssistantWorkflow, values: Record<string, AssistantValue>, password?: string): Promise<AssistantReply> => {
    const dispatch = async (resolved: Record<string, AssistantValue>) => {
      const result = await callOperation(req, op, resolved, password, input.requestId);
      completion = { operation: op, workflow, values: resolved, result, defaultedKeys: pending?.defaultedKeys || [] };
      return result;
    };
    if (Date.now() - new Date(turn.createdAt).getTime() > 120_000) throw new AssistantError("Yêu cầu đã hết thời gian xử lý trước khi thực thi. Chưa thay đổi dữ liệu; vui lòng gửi lại yêu cầu.", 408);
    await assertOperation(req, op.id);
    if (op.id === "employee.create" && (!password || password.length < 6 || password.length > 128)) throw new AssistantError("Vui lòng nhập mật khẩu khởi tạo (6–128 ký tự) trong ô bảo mật của bản xem trước.");
    const latest = await currentWorkflow(req, op.id);
    if (latest.version !== workflow.version) throw new AssistantError("Quy tắc xử lý vừa thay đổi. Vui lòng gửi lại nội dung để kiểm tra theo quy tắc mới.", 409);
    if (op.method !== "GET" && !op.readOnly && !input.decision?.confirmed && (await getSettings(req)).alwaysConfirm) return { status: "confirmation", reply: "Cài đặt yêu cầu xác nhận trước khi thay đổi dữ liệu. Vui lòng kiểm tra bản xem trước.", action: pending!.preview };
    const hiddenFields = new Set(op.systemBodyFields || []);
    const validationValues = Object.fromEntries(Object.entries(values).filter(([key]) =>
      !key.startsWith("__assistant")
      && !hiddenFields.has(key)
      && !(op.id.startsWith("recruitment.") && key === "version")
    ));
    if (["payroll.period.inputs.bulk", "payroll.period.line-overrides.bulk"].includes(op.id) && typeof validationValues.rows === "string") {
      try {
        const rows = JSON.parse(validationValues.rows);
        if (Array.isArray(rows)) validationValues.rows = JSON.stringify(rows.map((row: any) => {
          const { expectedVersion: _expectedVersion, ...visible } = row;
          return visible;
        }));
      } catch { /* collectValues reports malformed JSON through the workflow's own validation */ }
    }
    const finalValidation = collectValues(workflowForRequest(op, latest, pending?.intent || input.text || ""), validationValues);
    const missingWorkHours = missingCustomWorkHoursLabels(op, validationValues);
    finalValidation.missing.push(...missingWorkHours.filter(label => !finalValidation.missing.includes(label)));
    if (finalValidation.missing.length || finalValidation.errors.length) throw new AssistantError([...(finalValidation.missing.length ? [`Cần bổ sung: ${finalValidation.missing.join(", ")}.`] : []), ...finalValidation.errors].join("\n"));
    // Resolve again immediately before writing, including after a confirmation wait.
    const pinnedOperations = op.id.startsWith("recruitment.")
      || ["payroll.period.inputs.bulk", "payroll.period.line-overrides.bulk"].includes(op.id);
    const checked = await resolveReferences(req, op, input.decision?.confirmed && pinnedOperations ? { ...values, __assistantPinnedVersion: true } : values);
    if (checked.errors.length) throw new AssistantError(checked.errors.join("\n"));
    if (input.decision?.confirmed && op.id === "hr.workflow.update") {
      let previewSnapshot: string;
      let currentSnapshot: string;
      try {
        previewSnapshot = JSON.stringify(JSON.parse(String(values.__assistantExistingRecord || "")));
        currentSnapshot = JSON.stringify(JSON.parse(String(checked.values.__assistantExistingRecord || "")));
      } catch { throw new AssistantError("Không đọc được phiên bản quy trình trong bản xem trước; chưa lưu thay đổi.", 409); }
      if (!previewSnapshot || previewSnapshot !== currentSnapshot) {
        throw new AssistantError("Quy trình đã thay đổi sau khi bạn xem bản xem trước. Mình chưa lưu; hãy gửi lại yêu cầu để kiểm tra thông tin mới.", 409);
      }
    }
    if (input.decision?.confirmed && op.confirmationDetails) {
      for (const key of Object.keys(op.confirmationDetails)) {
        const expectedDetails = pending?.confirmationDetails?.[key] || [];
        const currentDetails = checked.confirmationDetails?.[key] || [];
        if (JSON.stringify(expectedDetails) !== JSON.stringify(currentDetails)) {
          throw new AssistantError("Thông tin người nhận hoặc nội dung đã thay đổi kể từ bản xem trước. Chưa thực hiện; vui lòng kiểm tra và xác nhận lại.", 409);
        }
      }
    }
    if (["PATCH", "PUT"].includes(op.method) && !hasUpdatePayload(op, pending?.provided || validationValues)) throw new AssistantError(updateDetailsQuestion(op, input.text || pending?.intent || "", checked.values));
    await AssistantTurnModel.updateOne({ _id: turn._id }, { $set: { status: "executing", actionId: op.id, workflowVersion: workflow.version, payload: checked.values } });
    hasDispatched = !op.readOnly && (op.method !== "GET" || op.module === "quotation");
    if (op.module === "quotation") {
      const result = await dispatch(checked.values);
      pending = null;
      const attachment = result?.__assistantQuotationFile;
      if (attachment) {
        const documentId = randomUUID();
        const file = { id: randomUUID(), ...attachment, size: attachment.bytes.length };
        await AssistantDocumentModel.create({ ...scopeOf(req), conversationId: input.conversationId, requestId: input.requestId,
          documentId, version: 1, title: op.title, content: { title: op.title }, files: [file] });
        const { bytes: _bytes, ...metadata } = file;
        return { status: "completed", reply: friendlyResult(op, result), files: [{ ...metadata, documentId, conversationId: input.conversationId, version: 1 }], link: op.link };
      }
      return { status: "completed", reply: friendlyResult(op, result), link: op.link };
    }
    if (op.module === "healthcare") {
      const result = await dispatch(checked.values);
      pending = null;
      if (op.id === "healthcare.import.template") {
        const documentId = randomUUID();
        const file = { id: randomUUID(), fileName: result.filename, format: "xlsx" as const,
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: result.__assistantWorkbook.length, bytes: result.__assistantWorkbook };
        await AssistantDocumentModel.create({ ...scopeOf(req), conversationId: input.conversationId, requestId: input.requestId,
          documentId, version: 1, title: op.title, content: { title: op.title }, files: [file] });
        const { bytes: _bytes, ...metadata } = file;
        return { status: "completed", reply: "Mẫu Excel y tế đã sẵn sàng. Bạn có thể tải tệp bên dưới.",
          files: [{ ...metadata, documentId, conversationId: input.conversationId, version: 1 }], link: op.link };
      }
      if (["healthcare.import.preview", "healthcare.import.commit", "healthcare.import.retry"].includes(op.id) && ["queued", "running"].includes(result.status)) {
        return { status: "completed", reply: `Đã xếp hàng ${op.id === "healthcare.import.preview" ? "kiểm tra" : "xử lý"} tệp ${result.filename || "Excel y tế"}. Dữ liệu đang được xử lý; bạn có thể yêu cầu xem tiến độ đợt nhập để kiểm tra kết quả.`, link: op.link };
      }
      const rendered = op.id === "healthcare.overview" || op.id === "healthcare.visit.report"
        ? result : await decorateHealthcareResult(req, op, result, checked.values);
      return { status: "completed", reply: friendlyResult(op, rendered), link: op.link };
    }
    if (op.method === "GET" && op.id === "worker.list") {
      const search = String(checked.values.query_search || checked.values.search || "");
      const rows = await lookupRecords(req, op.id, search, checked.values);
      pending = null;
      return { status: "completed", reply: friendlyResult(op, rows), link: op.link };
    }
    if (op.method === "GET" && op.id === "employee.detail") {
      const search = String(checked.values.search || "").trim();
      const rows = await lookupRecords(req, op.id, search, checked.values);
      const query = normalizeAssistantText(search);
      const matches = rows.filter(row => [row.displayName, row.email, row.phone]
        .some(value => typeof value === "string" && normalizeAssistantText(value).includes(query)));
      const exact = matches.filter(row => [row.displayName, row.email, row.phone]
        .some(value => typeof value === "string" && normalizeAssistantText(value) === query));
      const selected = exact.length ? exact : matches;
      if (selected.length > 1) {
        return { status: "collecting", reply: friendlyResult(op, selected), action: pending?.preview, link: op.link };
      }
      pending = null;
      return { status: "completed", reply: friendlyResult(op, selected), link: op.link };
    }
    if (op.method === "GET" && (op.adapter === "contract" || op.rawResponse)) {
      const result = await dispatch(checked.values);
      pending = null;
      return { status: "completed", reply: friendlyResult(op, result?.data ?? result), link: op.link };
    }
    if (op.method === "GET") {
      const rows = await lookupRecords(req, op.id, String(values.search || ""), values);
      pending = null;
      return { status: "completed", reply: friendlyResult(op, rows), link: op.link };
    }
    const result = await dispatch(checked.values);
    if (op.adapter === "contract" || op.rawResponse) {
      if (op.id === "worker.partner.kpi.set" && result?.data && typeof result.data === "object" && !Array.isArray(result.data)) {
        const partnerLabel = pending?.preview.values.find(item => /đối tác lao động/i.test(item.label))?.value;
        const partnerName = typeof partnerLabel === "string" ? partnerLabel.split(" — ")[0].trim() : undefined;
        pending = null;
        return { status: "completed", reply: friendlyResult(op, { ...result.data, ...(partnerName ? { partnerName } : {}) }), link: op.link };
      }
      pending = null;
      const created = result?.data ?? result;
      return { status: "completed", reply: friendlyResult(op, created), link: op.link };
    }
    const records = projectRecords(op, result, req);
    pending = null;
    return { status: "completed", reply: friendlyResult(op, records[0] || {})
      + (op.id === "employee.create" ? "\n\nHồ sơ cũng đã có tài khoản đăng nhập với vai trò nhân viên." : ""), link: op.link };
  };

  const prepare = async (actionId: string, provided: Record<string, unknown>, forceConfirmation = false, intent = input.text || "", selectedReferenceKeys: string[] = []): Promise<AssistantReply> => {
    if (input.attachment) {
      const targetOp = operationById(actionId);
      if (targetOp?.method === "POST" && targetOp.path === "/students") {
        const previewOp = ASSISTANT_OPERATIONS.find(candidate => candidate.method === "POST" && candidate.path === "/students/bulk-preview");
        const bulkOp = ASSISTANT_OPERATIONS.find(candidate => candidate.method === "POST" && candidate.path === "/students/bulk");
        actionId = /\b(?:kiem tra|xem truoc|preview)\b/.test(normalizeAssistantText(intent)) && previewOp ? previewOp.id : (bulkOp?.id || "student.bulk.create");
      } else if (targetOp?.id === "worker.create" || (targetOp?.method === "POST" && targetOp.path === "/worker-management/workers")) {
        const bulkOp = ASSISTANT_OPERATIONS.find(candidate => candidate.method === "POST" && candidate.path === "/worker-management/workers/bulk");
        actionId = bulkOp?.id || "worker.bulk.create";
      } else if (targetOp?.method === "POST" && targetOp.path === "/partners") {
        const bulkOp = ASSISTANT_OPERATIONS.find(candidate => candidate.method === "POST" && candidate.path === "/partners/bulk");
        actionId = bulkOp?.id || "partner.bulk.create";
      } else if (targetOp?.id === "quotation.catalog.create") {
        actionId = "quotation.catalog.import";
      } else if (targetOp?.id === "healthcare.patient.create") {
        actionId = "healthcare.import.preview";
        if (provided.table === undefined) provided.table = "patients";
      } else if (targetOp?.id === "payroll.period.input.update") {
        actionId = "payroll.period.inputs.bulk";
      }
    }
    const requestedOperation = operationById(actionId);
    if (requestedOperation?.method === "PATCH" && requestedOperation.path === "/partners/:id") {
      const normalizedIntent = normalizePartnerIntent(intent);
      if (/(?:thong tin (?:chuyen khoan|tai khoan)|chuyen khoan|bank account|bank details)/.test(normalizedIntent)) actionId = "partner.bank-details.update";
      else if (/(?:cau hinh hoa hong|hoa hong|commission)/.test(normalizedIntent)) actionId = "partner.commission.update";
    }
    const op = await assertOperation(req, actionId);
    provided = normalizeAcceptanceValues(op, provided, input.text || "");
    const workflow = await currentWorkflow(req, actionId);
    const requestWorkflow = workflowForRequest(op, workflow, intent);
    const previousPending = pending?.actionId === actionId && pending.intent === intent ? pending : undefined;
    const explicitReferenceKeys = new Set(pending?.actionId === actionId ? pending.explicitReferenceKeys || [] : []);
    for (const key of selectedReferenceKeys) explicitReferenceKeys.add(key);
    const contextualValues = normalizeStructuredAssistantValues(op, provided, previousPending?.provided);
    if (op.id === "student.batch.update") {
      const searchKey = referenceSearchKey("path_id");
      const classSearch = String(contextualValues.path_id ?? contextualValues[searchKey] ?? "").trim();
      if (!explicitReferenceKeys.has("path_id")) {
        for (const field of op.fields) delete contextualValues[field.key];
        if (classSearch) contextualValues[searchKey] = classSearch;
      } else {
        delete contextualValues[searchKey];
      }
    }
    if (op.id === "training.create") {
      const skippedContent = trainingContentSkipFields(input.text || "");
      const bareSkip = /^(?:bo qua|khong can(?: nua)?|chua co|chua can|khong them)(?: ca hai| het)?[.!? ]*$/.test(normalizeAssistantText(input.text || ""));
      for (const key of skippedContent) {
        if (!bareSkip || isBlank(contextualValues[key])) contextualValues[key] = "[]";
      }
    }
    const creatorName = String(req.user?.displayName || req.user?.email || "iGen Academy");
    const trainingInstructorIsDefault = op.id === "training.create"
      && isBlank(contextualValues.instructor);
    if (trainingInstructorIsDefault) contextualValues.instructor = creatorName;
    if (previousPending?.awaitingPathReferenceKeys?.length === 1 && input.text?.trim()) {
      contextualValues[previousPending.awaitingPathReferenceKeys[0]] = input.text.trim();
    }
    let attachmentSummary = previousPending?.attachmentSummary;
    if (input.attachment) {
      try {
        const mapped = op.id === "healthcare.import.preview" ? healthcareAttachment(input.attachment) : mapAssistantTableAttachment(op, input.attachment);
        if (!mapped.rowCount) return { status: "unsupported", reply: `Tệp ${input.attachment.fileName} chưa có dòng dữ liệu để nhập. Chưa có dữ liệu nào thay đổi.` };
        contextualValues[mapped.fieldKey] = JSON.stringify(mapped.rows);
        if (op.id === "healthcare.import.preview") contextualValues.filename = input.attachment.fileName;
        attachmentSummary = { fieldKey: mapped.fieldKey, fileName: input.attachment.fileName, rowCount: mapped.rowCount };
      } catch (error) {
        return { status: "unsupported", reply: `${(error as Error).message} Chưa có dữ liệu nào thay đổi.` };
      }
    }
    const skippedReferenceKeys = new Set(previousPending?.skippedReferenceKeys || []);
    if (input.skipReferenceKeys?.length) {
      const groups = new Map((previousPending?.referenceSelections || []).map(group => [group.key, group]));
      for (const key of input.skipReferenceKeys) {
        const group = groups.get(key);
        if (!group || group.required || input.referenceSelections?.[key]?.length) throw new AssistantError("Lựa chọn bỏ qua không còn hợp lệ cho thao tác này. Bạn chọn lại giúp mình nhé.");
        skippedReferenceKeys.add(key);
        if (op.fields.some(field => field.key === key)) delete contextualValues[key];
      }
    }
    for (const key of skippedReferenceTargets(input.text || "", op, previousPending?.awaitingReferenceKeys || [], previousPending?.awaitingReferenceLabels)) {
      skippedReferenceKeys.add(key);
      delete contextualValues[key];
    }
    for (const field of op.fields) if (contextualValues[field.key] !== undefined && String(contextualValues[field.key]).trim()) skippedReferenceKeys.delete(field.key);
    const selectedBranchField = op.fields.find(field => field.source === "query" && field.apiKey === "branchId");
    if (req.user?.branchId && selectedBranchField && contextualValues[selectedBranchField.key] === undefined) contextualValues[selectedBranchField.key] = req.user.branchId;
    const resolvedNamedValues = await resolveNamedReferenceSelectors(req, op, contextualValues);
    const selectedValues = inferCustomerQuoteMode(
      op,
      inferCustomWorkHoursMode(op, inferTaskDeadline(op, resolvedNamedValues, intent), intent, input.text || intent),
      input.text || "",
      previousPending?.provided?.__assistantQuotationMode,
      previousPending?.provided,
    );
    if (op.id === "retail.coupon.create" && selectedValues.targetType === "all_customers") delete selectedValues.customerId;
    const kpiPeriodWasDefaulted = op.id === "worker.partner.kpi.set"
      && previousPending?.defaultedKeys?.includes("periodAnchor") === true
      && String(previousPending.provided.periodAnchor || "") === String(selectedValues.periodAnchor || "");
    const kpiPeriodDefaulted = op.id === "worker.partner.kpi.set"
      && (isBlank(selectedValues.periodAnchor) || kpiPeriodWasDefaulted);
    if (op.id === "worker.partner.kpi.set" && isBlank(selectedValues.periodAnchor)) {
      selectedValues.periodAnchor = `${new Date().toISOString().slice(0, 7)}-01`;
    }
    requireExplicitReceiptItemSelections(op, selectedValues, explicitReferenceKeys);
    for (const key of populatedNestedReferenceKeys(op, selectedValues)) skippedReferenceKeys.delete(key);
    const collected = collectValues(requestWorkflow, Object.fromEntries(Object.entries(selectedValues).filter(([key]) => !key.startsWith("__assistant"))));
    if (kpiPeriodDefaulted && !collected.defaulted.includes("periodAnchor")) collected.defaulted.push("periodAnchor");
    const missingWorkHours = missingCustomWorkHoursLabels(op, collected.values);
    collected.missing.push(...missingWorkHours.filter(label => !collected.missing.includes(label)));
    if (trainingInstructorIsDefault && !collected.defaulted.includes("instructor")) collected.defaulted.push("instructor");
    const id = randomUUID();
    const references = await resolveReferences(req, op, {
      ...collected.values,
      ...(typeof selectedValues.__assistantQuotationSuggested === "string" ? { __assistantQuotationSuggested: selectedValues.__assistantQuotationSuggested } : {}),
    });
    const summarizedValue = (field: AssistantField, value: AssistantValue) => {
      if (attachmentSummary?.fieldKey === field.key) return `${attachmentSummary.rowCount} dòng từ ${attachmentSummary.fileName}`;
      const resolvedLabel = references.labels[field.key];
      const optionLabel = field.options?.some(option => String(option) === String(value)) ? assistantOptionLabel(op, field, String(value)) : "";
      return safeAssistantPreviewFieldValue(field, value, resolvedLabel || optionLabel || assistantPreviewValue(op, field.key, value));
    };
    const previewValues = workflow.fields.filter(f => collected.values[f.key] !== undefined
      && !(op.id === "quotation.acceptance.create" && f.key === "lines"))
      .map(f => ({ label: f.label, value: summarizedValue(f, collected.values[f.key]), defaulted: collected.defaulted.includes(f.key) }));
    if (op.path === "/inventory/catalog/products") {
      const suppliedVariant = collected.values.variant;
      let hasSku = false;
      if (typeof suppliedVariant === "string") {
        try { hasSku = Boolean(JSON.parse(suppliedVariant)?.sku); } catch { /* structured validation reports malformed input below */ }
      }
      if (!hasSku) previewValues.push({ label: "SKU đầu tiên", value: "Mã tự sinh; tên và đơn vị theo sản phẩm; chế độ kho theo thể loại; thông số tùy chọn để trống", defaulted: true });
    }
    const preview = { id, requiresPassword: op.id === "employee.create", title: workflow.title, values: previewValues };
    if (op.id === "access.role-permissions.save" && typeof references.labels.permissions === "string") {
      try {
        const selectedNames = JSON.parse(references.labels.permissions);
        if (Array.isArray(selectedNames)) references.labels.permissions = selectedNames.map(value => String(value)).join("; ") || "Không cấp quyền nào";
      } catch { /* structured validation will keep malformed values from reaching the route */ }
    }
    const confirmationDetails = references.confirmationDetails || {};
    const acceptanceFinancialDetails = op.id === "quotation.acceptance.create"
      ? quotationAcceptanceFinancialDetails(references.values)
      : [];
    if (acceptanceFinancialDetails.length) confirmationDetails.acceptanceContractFinancials = acceptanceFinancialDetails;
    if (collected.missing.length && acceptanceFinancialDetails.length) preview.values.push(...acceptanceFinancialDetails.map(detail => ({ ...detail, defaulted: false })));
    // Keep partial structured input available to reference prompting if a
    // nested reference lookup fails. Missing required scalar siblings are
    // tracked separately by collectValues, so valid selected references can
    // still be resolved and retained across turns.
    const promptValues: Record<string, AssistantValue> = {
      ...references.values,
      ...(typeof selectedValues.__assistantQuotationMode === "string" ? { __assistantQuotationMode: selectedValues.__assistantQuotationMode } : {}),
    };
    const unresolvedReferenceKeys = new Set(references.unresolvedReferenceKeys || []);
    const failedPathReferenceKeys = op.fields
      .filter(field => field.source === "path" && field.reference && unresolvedReferenceKeys.has(field.key))
      .map(field => field.key);
    for (const key of failedPathReferenceKeys) {
      const failedValue = selectedValues[key];
      if (typeof failedValue === "string" && failedValue.trim()) promptValues[referenceSearchKey(key)] = failedValue;
      delete promptValues[key];
    }
    for (const field of op.fields) {
      if (field.type !== "json" || promptValues[field.key] !== undefined || typeof selectedValues[field.key] !== "string") continue;
      if (collected.errors.some(error => error.startsWith(`${field.label}:`))) {
        promptValues[field.key] = String(selectedValues[field.key]);
      }
    }
    const askBatchEditDetails = op.id === "student.batch.update"
      && explicitReferenceKeys.has("path_id")
      && !hasUpdatePayload(op, references.values);
    const relationshipPrompts = await missingReferencePrompts(
      req,
      op,
      requestWorkflow,
      promptValues,
      askBatchEditDetails ? "" : intent,
      skippedReferenceKeys,
      undefined,
      unresolvedReferenceKeys,
    );
    const selectionLabels = new Set(relationshipPrompts.referenceSelections.map(selection => selection.label));
    if (relationshipPrompts.referenceSelections.some(selection => selection.key === "laborPolicyTypes")) {
      for (const key of ["official", "seasonal"]) {
        const field = op.fields.find(candidate => candidate.key === key);
        const enabled = field?.structure?.keys?.enabled;
        if (field && enabled) selectionLabels.add(`${field.label} · ${enabled.label || "enabled"}`);
      }
    }
    const recoveredReferenceKeys = new Set(relationshipPrompts.referenceSelections
      .filter(selection => unresolvedReferenceKeys.has(selection.key))
      .map(selection => selection.key));
    const recoveredReferenceErrors = new Set([...recoveredReferenceKeys]
      .map(key => references.unresolvedReferenceErrors?.[key])
      .filter((error): error is string => Boolean(error)));
    const visibleReferenceErrors = references.errors.filter(error => !recoveredReferenceErrors.has(error));
    const visibleCollectedErrors = collected.errors.filter(error => !relationshipPrompts.referenceSelections.some(selection => {
      if (!relationshipPrompts.optionSelectionKeys.has(selection.key)) return false;
      return error.startsWith(`${selection.label}:`) || error.startsWith(`${selection.label} ·`);
    }));
    const receiptQuestion = inventoryReceiptFollowUpQuestion(op, collected.missing, relationshipPrompts.referenceSelections, relationshipPrompts.textPrompts);
    const trainingContentQuestion = trainingContentFollowUpQuestion(op, collected.missing);
    const customWorkHoursQuestion = customWorkHoursFollowUpQuestion(op, missingWorkHours);
    const customerQuoteQuestion = customerQuoteFollowUpQuestion(op, selectedValues, relationshipPrompts.referenceSelections);
    const trainingContentLabels = new Set(op.id === "training.create"
      ? ["lessons", "quizzes"].map(key => op.fields.find(field => field.key === key)?.label).filter((label): label is string => Boolean(label))
      : []);
    const trainingContentNeedsForm = op.id === "training.create" && (
      [...trainingContentLabels].some(label => collected.missing.includes(label))
      || collected.errors.some(error => [...trainingContentLabels].some(label => error.startsWith(`${label}:`))
        || /^(?:Bài giảng|Câu hỏi trắc nghiệm) · Mục \d+:/u.test(error))
    );
    const acceptanceLinesLabel = op.fields.find(field => field.key === "lines")?.label || "";
    const acceptanceForm = op.id === "quotation.acceptance.create"
      ? quotationAcceptanceFormFromValues(references.values)
      : undefined;
    const acceptanceLinesNeedForm = Boolean(acceptanceForm && (
      collected.missing.some(label => acceptanceLinesLabel && label.startsWith(acceptanceLinesLabel))
      || collected.errors.some(error => acceptanceLinesLabel && error.startsWith(`${acceptanceLinesLabel}:`))
    ));
    const receiptScalarLabels = op.id === "inventory.receipt.create"
      ? new Set(collected.missing.filter(label => /^items · Mục \d+ · (?:quantity|unitCost)$/u.test(label)))
      : new Set<string>();
    const customWorkHoursLabels = new Set(missingWorkHours);
    const missingWithoutReferenceLabels = collected.missing.filter(label => label !== customerQuoteMissingProductLabel && !(acceptanceLinesNeedForm && label.startsWith(acceptanceLinesLabel)) && !trainingContentLabels.has(label) && !receiptScalarLabels.has(label) && !customWorkHoursLabels.has(label) && !selectionLabels.has(label) && !op.fields.some(field => field.reference && field.label === label && selectedValues[field.key] === undefined));
    pending = {
      id,
      actionId,
      provided: {
        ...Object.fromEntries(Object.entries(selectedValues).filter(([key]) => (key === "__assistantQuotationMode" || op.fields.some(field => field.key === key)) && !unresolvedReferenceKeys.has(key) && !collected.defaulted.includes(key))),
        ...(typeof references.values.__assistantQuotationSuggested === "string" && !unresolvedReferenceKeys.has("sourceRequirements")
          ? { __assistantQuotationSuggested: references.values.__assistantQuotationSuggested }
          : {}),
      },
      intent,
      explicitReferenceKeys: [...explicitReferenceKeys],
      workflowVersion: workflow.version,
      preview,
      ...(attachmentSummary ? { attachmentSummary } : {}),
      confirmationDetails,
      awaitingReferenceKeys: relationshipPrompts.awaitingOptional,
      awaitingReferenceLabels: relationshipPrompts.awaitingLabels,
      awaitingPathReferenceKeys: failedPathReferenceKeys,
      skippedReferenceKeys: [...skippedReferenceKeys],
      referenceSelections: relationshipPrompts.referenceSelections,
      defaultedKeys: [...collected.defaulted],
    };
    if (collected.missing.length || collected.errors.length || references.errors.length || relationshipPrompts.prompts.length) {
      const lines = [
        ...(missingWithoutReferenceLabels.length ? [`Mình đã hiểu yêu cầu ${workflow.title.toLocaleLowerCase("vi")}; mình còn thiếu ${missingWithoutReferenceLabels.join(", ")}. Bạn gửi giúp mình nhé.`] : []),
        ...(customerQuoteQuestion ? [customerQuoteQuestion] : []),
        ...(receiptQuestion ? [receiptQuestion] : []),
        ...(customWorkHoursQuestion ? [customWorkHoursQuestion] : []),
        ...(trainingContentQuestion ? [trainingContentQuestion] : []),
        ...(acceptanceLinesNeedForm ? ["Bạn nhập khối lượng nghiệm thu cho từng sản phẩm trong bảng bên dưới nhé."] : []),
        ...(visibleCollectedErrors.length || visibleReferenceErrors.length ? [`Mình cần bạn kiểm tra lại một chút:\n${[...visibleCollectedErrors, ...visibleReferenceErrors].join("\n")}`] : []),
        ...(relationshipPrompts.textPrompts.length ? [relationshipPrompts.textPrompts.join("\n")] : []),
        ...(relationshipPrompts.referenceSelections.length && !customerQuoteQuestion ? ["Mình đã tìm thấy lựa chọn phù hợp. Bạn chọn ngay bên dưới nhé."] : []),
      ];
      return { status: "collecting", reply: lines.join("\n"), action: preview,
        ...(relationshipPrompts.referenceSelections.length ? { referenceSelections: relationshipPrompts.referenceSelections } : {}),
        ...(trainingContentNeedsForm ? { trainingContentForm: trainingContentFormFromValues(selectedValues) } : {}),
        ...(acceptanceLinesNeedForm && acceptanceForm ? { quotationAcceptanceForm: acceptanceForm } : {}),
      };
    }
    if (["PATCH", "PUT"].includes(op.method) && !hasUpdatePayload(op, collected.values)) {
      if (op.path === "/inventory/catalog/variants/:id"
        && typeof references.values.path_id === "string"
        && typeof references.values.query_productId === "string") {
        pending.selectedProductVariant = {
          productId: references.values.query_productId,
          variantId: references.values.path_id,
        };
      }
      return { status: "collecting", reply: updateDetailsQuestion(op, intent, references.values), action: preview };
    }
    if (op.path === "/partners/:id" && /(?:thông tin (?:chuyển khoản|tài khoản)|chuyển khoản|cấu hình hoa hồng|hoa hồng|hoa hong|commission)/i.test(intent)) {
      const question = updateDetailsQuestion(op, intent, references.values);
      if (question !== "Bạn muốn mình cập nhật những thông tin nào?") return { status: "collecting", reply: question, action: preview };
    }
    pending.resolved = references.values;
    preview.values = workflow.fields.filter(f => references.values[f.key] !== undefined
      && !(op.id === "quotation.acceptance.create" && f.key === "lines")).map(f => {
      const rawValue = references.values[f.key];
      const displayValue = attachmentSummary?.fieldKey === f.key ? `${attachmentSummary.rowCount} dòng từ ${attachmentSummary.fileName}` : references.labels[f.key] || (f.options?.includes(String(rawValue)) ? assistantOptionLabel(op, f, String(rawValue)) : assistantPreviewValue(op, f.key, rawValue));
      return { label: f.label, value: safeAssistantPreviewFieldValue(f, rawValue, displayValue), defaulted: collected.defaulted.includes(f.key) };
    });
    preview.values.push(...Object.values(confirmationDetails).flat().map(detail => ({ label: detail.label, value: hideInternalAssistantIds(detail.value), defaulted: false })));
    if (op.path === "/inventory/catalog/products") {
      const suppliedVariant = references.values.variant;
      let hasSku = false;
      if (typeof suppliedVariant === "string") {
        try { hasSku = Boolean(JSON.parse(suppliedVariant)?.sku); } catch { /* structured validation reports malformed input below */ }
      }
      if (!hasSku) preview.values.push({ label: "SKU đầu tiên", value: "Mã tự sinh; tên và đơn vị theo sản phẩm; chế độ kho theo thể loại; thông số tùy chọn để trống", defaulted: true });
    }
    if (op.optionalPathFields?.includes("id") && references.labels.path_id) preview.values.push({ label: "Ca POS", value: references.labels.path_id, defaulted: false });
    if (((await getSettings(req)).alwaysConfirm && op.method !== "GET" && !op.readOnly) || workflow.requireConfirmation || forceConfirmation || op.id === "employee.create") return { status: "confirmation", reply: op.id === "employee.create"
      ? "Thông tin nhân sự đã đủ rồi. Bạn nhập mật khẩu khởi tạo vào ô bảo mật trong bản xem trước nhé; đừng gửi mật khẩu trong tin nhắn."
      : op.id === "access.role-permissions.save"
        ? "Thao tác này sẽ thay toàn bộ quyền của vai trò và áp dụng cho mọi tài khoản đang dùng vai trò đó. Bạn kiểm tra lại danh sách quyền trong bản xem trước rồi xác nhận giúp mình nhé."
        : op.id === "healthcare.patient.bulk-delete"
          ? "Thao tác này sẽ xóa các bệnh nhân đã chọn cùng toàn bộ lượt khám, lịch hẹn và công việc chăm sóc liên quan. Bạn kiểm tra từng hồ sơ và số dữ liệu sẽ xóa trong bản xem trước, rồi xác nhận để thực hiện nhé."
        : "Mình đã chuẩn bị xong. Bạn xem lại thông tin trong bản xem trước; nếu mọi thứ chính xác, hãy xác nhận để mình thực hiện nhé.", action: preview,
      ...(op.id === "quotation.acceptance.create" && acceptanceForm?.lines.every(line => typeof line.acceptedQuantity === "number")
        ? { quotationAcceptanceForm: acceptanceForm }
        : {}),
    };
    return execute(op, workflow, references.values);
  };

  try {
    if (input.conversationUpload) {
      conversationFile = await readAssistantConversationFile({ buffer: input.conversationUpload.buffer, fileName: input.conversationUpload.fileName, req });
    }
    const settings = await getSettings(req);
    responseRules = settings.responseRules || "";
    autoMemoryEnabled = settings.autoMemoryEnabled ?? false;
    const memories = input.text && settings.memoryEnabled ? await assistantMemoryContext(req, input.text) : [];
    if (assistantMode === "qa" && (!input.text || input.decision || input.referenceSelections || input.trainingContent || input.acceptanceLines)) {
      throw new AssistantError("Tab Trò chuyện cần có nội dung tin nhắn. Hãy nhập câu hỏi hoặc yêu cầu kèm tệp.");
    }
    if (forgetMemoryCommand !== null) {
      const deleted = await forgetAssistantMemoryByContent(req, forgetMemoryCommand);
      reply = {
        status: "completed",
        reply: deleted ? "Mình đã quên ghi nhớ đó khỏi tài khoản của bạn." : "Mình chưa tìm thấy ghi nhớ trùng khớp. Bạn có thể xem và xóa mục trong Cài đặt trợ lý > Ghi nhớ.",
      };
    } else if (memoryCommand !== null) {
      if (!settings.memoryEnabled) {
        reply = { status: "completed", reply: "Ghi nhớ đang tắt. Bạn có thể bật lại trong Cài đặt trợ lý để AI dùng các ghi nhớ của tài khoản." };
      } else {
        const saved = await saveAssistantMemory(req, memoryCommand, "explicit");
        reply = { status: "completed", reply: `${saved.created ? "Mình đã ghi nhớ" : "Mình đã cập nhật ghi nhớ"} cho tài khoản của bạn: ${saved.item.content}. Bạn có thể xem, sửa hoặc xóa trong Cài đặt trợ lý > Ghi nhớ.` };
      }
    } else if (assistantMode === "qa") {
      const conversationReply = await answerAssistantConversation(req, {
          conversationId: input.conversationId,
          requestId: input.requestId,
          pendingDocumentRequest,
          question: input.text,
          ...(conversationFile ? {
            documentContext: conversationFile.documentContext,
            ...(conversationFile.visualAttachments?.length ? { visualAttachments: conversationFile.visualAttachments } : {}),
          } : input.attachment ? { documentContext: {
            title: input.attachment.fileName,
            version: 1,
            content: { type: "uploaded-table", headers: input.attachment.headers, rows: input.attachment.rows },
          } } : {}),
          research: true,
          messages: session.messages as { role: "user" | "assistant"; content: string }[],
          instructions: [settings?.instructions || "", projectInstructions].filter(Boolean).join("\n\nChỉ dẫn của dự án:\n"),
          responseRules,
          memories,
          sessionMemory,
      });
      const { pendingDocumentRequest: nextDocumentRequest, ...publicReply } = conversationReply;
      if (nextDocumentRequest !== undefined) pendingDocumentRequest = nextDocumentRequest || "";
      reply = publicReply;
    } else if (input.decision) {
      if (!pending || pending.id !== input.decision.id || !pending.resolved) throw new AssistantError("Bản xem trước đã hết hiệu lực. Hãy gửi lại yêu cầu để kiểm tra.", 409);
      if (!input.decision.confirmed) { pending = null; reply = { status: "cancelled", reply: "Mình đã hủy thao tác theo yêu cầu. Dữ liệu chưa được thay đổi." }; }
      else {
        const workflow = await currentWorkflow(req, pending.actionId);
        const operation = await assertOperation(req, pending.actionId);
        reply = workflow.version !== pending.workflowVersion
          ? await prepare(pending.actionId, pending.provided, true, pending.intent)
          : missingCustomWorkHoursLabels(operation, pending.resolved).length
            ? await prepare(pending.actionId, pending.provided, true, pending.intent)
          : pending.preview.requiresPassword && !input.decision.password
            ? { status: "confirmation", reply: "Bạn nhập lại mật khẩu khởi tạo trong ô bảo mật giúp mình nhé. Mật khẩu sẽ không được giữ lại nếu tải lại trang.", action: pending.preview }
          : await execute(operation, workflow, pending.resolved, input.decision.password);
      }
    } else if (input.referenceSelections) {
      if (!pending || !pending.referenceSelections?.length) throw new AssistantError("Danh sách lựa chọn đã hết hiệu lực. Bạn gửi lại yêu cầu để mình tìm lựa chọn mới nhé.");
      const operation = await assertOperation(req, pending.actionId);
      const workflow = await currentWorkflow(req, pending.actionId);
      if (workflow.version !== pending.workflowVersion) {
        reply = await prepare(pending.actionId, pending.provided, false, pending.intent);
      } else {
        const applied = applyReferenceSelections(pending, operation, input.referenceSelections, input.skipReferenceKeys || []);
        for (const key of applied.skipped) if (operation.fields.some(field => field.key === key)) delete applied.provided[key];
        reply = await prepare(pending.actionId, applied.provided, false, pending.intent, Object.keys(input.referenceSelections));
      }
    } else if (input.acceptanceLines) {
      if (!pending || pending.actionId !== "quotation.acceptance.create") throw new AssistantError("Biểu mẫu khối lượng nghiệm thu đã hết hiệu lực. Gửi lại yêu cầu lập biên bản nghiệm thu giúp mình nhé.", 409);
      const provided = { ...pending.provided, lines: JSON.stringify(input.acceptanceLines.lines) };
      reply = await prepare(pending.actionId, provided, false, pending.intent);
    } else if (input.trainingContent) {
      if (!pending || pending.actionId !== "training.create") throw new AssistantError("Biểu mẫu bài giảng và câu hỏi đã hết hiệu lực. Bạn gửi lại yêu cầu tạo khóa đào tạo giúp mình nhé.", 409);
      const operation = await assertOperation(req, pending.actionId);
      const workflow = await currentWorkflow(req, pending.actionId);
      const provided = {
        ...pending.provided,
        lessons: JSON.stringify(input.trainingContent.lessons),
        quizzes: JSON.stringify(input.trainingContent.quizzes),
      };
      if (workflow.version !== pending.workflowVersion) {
        reply = await prepare(pending.actionId, provided, false, pending.intent);
      } else {
        reply = await prepare(operation.id, provided, false, pending.intent);
      }
    } else if (input.text && typeof session.lastReply?.reply === "string"
      && session.lastReply.reply.includes("Bạn có muốn bổ sung không?")
      && /^(?:co|vang|dong y|duoc|ok|oke|khong|khong can|thoi|bo qua)(?: nhe| nha)?[.!?]?$/.test(normalizeAssistantText(input.text).trim())) {
      const declined = /^(?:khong|thoi|bo qua)/.test(normalizeAssistantText(input.text).trim());
      const followUp = declined ? null : await createdRecordFollowUp(req, input.conversationId);
      reply = declined ? { status: "completed", reply: "Được nhé, mình giữ nguyên thông tin vừa tạo." }
        : followUp ? await prepare(followUp.actionId, followUp.values, false, "Bổ sung thông tin vừa tạo")
        : { status: "collecting", reply: "Được nhé. Bạn gửi giúp mình mục muốn bổ sung và nội dung cụ thể; mình sẽ chuẩn bị bản cập nhật để bạn kiểm tra trước khi lưu." };
    } else {
      const workflows = (await listWorkflows(req)).filter(w => w.enabled);
      const missingInfoQuestion = isMissingProfileInfoIntent(input.text || "");
      const laborPartnerUpdateRequest = isLaborPartnerProfileUpdateIntent(input.text || "");
      const previousAction = missingInfoQuestion || laborPartnerUpdateRequest ? await latestCompletedAction(req, input.conversationId) : null;
      const hasLaborPartnerContext = Boolean(previousAction?.actionId && laborPartnerContextActionIds.has(previousAction.actionId));
      const mentionsAnotherPartnerType = /\b(?:doi tac|cong tac vien)\b/.test(normalizeAssistantText(input.text || ""));
      const laborPartnerProfileUpdate = laborPartnerUpdateRequest
        && (explicitlyMentionsLaborPartner(input.text || "") || (hasLaborPartnerContext && !mentionsAnotherPartnerType));
      const laborPartnerMissingInfo = isLaborPartnerMissingInfoIntent(input.text || "")
        || Boolean(missingInfoQuestion && hasLaborPartnerContext
          && !/\b(?:nguoi lao dong|ho so lao dong|nhan su|nhan vien)\b/.test(normalizeAssistantText(input.text || "")));
      const workerMissingInfo = isWorkerMissingInfoIntent(input.text || "")
        || Boolean(missingInfoQuestion && previousAction?.actionId && workerCreateActionIds.has(previousAction.actionId) && !isLaborPartnerMissingInfoIntent(input.text || ""));
      const attachmentIntentHint = input.attachment
        ? `Thêm danh sách từ tệp excel ${input.attachment.fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ")}`
        : "";
      const effectiveInputText = input.text?.trim() || attachmentIntentHint;
      const interpreted = await interpretRequest(effectiveInputText, workflows, pending ? { actionId: pending.actionId, values: pending.provided } : null, session.messages as any, settings?.instructions || "", memories, sessionMemory);
      if (input.attachment && !interpreted.actionId && !interpreted.cancel) {
        const combinedText = `${input.text || ""} ${attachmentIntentHint}`.trim();
        const fallbackActionId = directStudentRecordActionId(combinedText, workflows)
          || directWorkerRecordActionId(combinedText, workflows);
        if (fallbackActionId) {
          interpreted.actionId = fallbackActionId;
          interpreted.intentType = "workflow";
        } else if (pending && workflows.some(w => w.actionId === pending!.actionId)) {
          interpreted.actionId = pending.actionId;
          interpreted.intentType = "workflow";
          interpreted.newRequest = false;
        }
      }
      if (interpreted.cancel === true) { pending = null; reply = { status: "cancelled", reply: "Mình đã hủy yêu cầu rồi nhé. Dữ liệu chưa được thay đổi." }; }
      else if (laborPartnerMissingInfo) {
        if (!workflows.some(workflow => workflow.actionId === "worker.partner.list")) {
          reply = { status: "unsupported", reply: "Mình chưa thể xem hồ sơ đối tác lao động vì chức năng tra cứu chưa được bật hoặc tài khoản chưa có quyền." };
        } else {
          reply = await laborPartnerMissingInfoReply(req, input.text || "", previousAction);
        }
      }
      else if (laborPartnerProfileUpdate) {
        const operation = ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/worker-management/partners/:partnerId");
        const workflow = operation && workflows.find(candidate => candidate.actionId === operation.id);
        if (!operation || !workflow) {
          reply = { status: "unsupported", reply: "Mình chưa thể cập nhật hồ sơ đối tác lao động vì chức năng này chưa được bật hoặc tài khoản chưa có quyền." };
        } else {
          const pathField = operation.fields.find(field => field.source === "path" && field.apiKey === "partnerId");
          const contextualReference = hasLaborPartnerContext ? laborPartnerReferenceFromAction(previousAction) : "";
          const targetValues = interpreted.actionId === workflow.actionId
            ? interpreted.values
            : (await interpretRequest(input.text!, [workflow], contextualReference && pathField
              ? { actionId: workflow.actionId, values: { [pathField.key]: contextualReference } }
              : null, session.messages as any, settings?.instructions || "", memories, sessionMemory)).values;
          const continuing = pending?.actionId === workflow.actionId && !interpreted.newRequest;
          const provided = {
            ...(continuing ? pending!.provided : {}),
            ...(contextualReference && pathField ? { [pathField.key]: contextualReference } : {}),
            ...targetValues,
          };
          reply = await prepare(workflow.actionId, provided, false, continuing ? pending!.intent : input.text || "");
        }
      }
      else if (workerMissingInfo) {
        if (!workflows.some(workflow => workflow.actionId === "worker.list")) {
          reply = { status: "unsupported", reply: "Mình chưa thể xem hồ sơ lao động này vì chức năng tra cứu chưa được bật hoặc tài khoản chưa có quyền." };
        } else {
          reply = await workerMissingInfoReply(req, input.conversationId, input.text || "");
        }
      }
      else if (isPartnerDetailsIntent(input.text || "") || pending?.actionId === ASSISTANT_OPERATIONS.find(op => op.method === "GET" && op.path === "/partners/:id")?.id) {
        const operation = ASSISTANT_OPERATIONS.find(op => op.method === "GET" && op.path === "/partners/:id");
        const workflow = operation && workflows.find(candidate => candidate.actionId === operation.id);
        if (!workflow) {
          reply = { status: "unsupported", reply: "Mình chưa thể xem thông tin đối tác qua chat vì chức năng này chưa được bật hoặc tài khoản chưa có quyền." };
        } else {
          const continuing = pending?.actionId === workflow.actionId && !interpreted.newRequest;
          const provided = { ...(continuing ? pending!.provided : {}), ...interpreted.values };
          const contextualReference = contextualPendingPartnerReference(input.text || "", pending);
          if (contextualReference && !provided.path_id) provided.path_id = contextualReference;
          reply = await prepare(workflow.actionId, provided, false, continuing ? pending!.intent : input.text || "");
        }
      }
      else if (isEmployeeDetailsIntent(input.text || "") || pending?.actionId === "employee.detail") {
        const actionId = "employee.detail";
        const workflow = workflows.find(candidate => candidate.actionId === actionId);
        if (!workflow) {
          reply = { status: "unsupported", reply: "Mình chưa thể xem hồ sơ nhân sự qua chat vì chức năng này chưa được bật hoặc tài khoản chưa có quyền." };
        } else {
          const continuing = pending?.actionId === actionId && !interpreted.newRequest;
          const values = interpreted.actionId === actionId
            ? interpreted.values
            : continuing
              ? { search: input.text!.trim() }
              : (await interpretRequest(input.text!, [workflow], null, session.messages as any, settings?.instructions || "", memories, sessionMemory)).values;
          const provided = { ...(continuing ? pending!.provided : {}), ...values };
          reply = await prepare(actionId, provided, false, continuing ? pending!.intent : input.text || "");
        }
      }
      else if (isPartnerBankUpdateIntent(input.text || "")) {
        const actionId = "partner.bank-details.update";
        const workflow = workflows.find(candidate => candidate.actionId === actionId);
        if (!workflow) {
          reply = { status: "unsupported", reply: "Mình chưa thể cập nhật thông tin chuyển khoản qua chat vì chức năng này chưa được bật hoặc tài khoản chưa có quyền." };
        } else {
          const continuing = pending?.actionId === actionId && !interpreted.newRequest;
          const contextualReference = contextualPendingPartnerReference(input.text || "", pending);
          const interpretedOperation = operationById(interpreted.actionId || "");
          const genericPartnerUpdate = interpretedOperation?.method === "PATCH" && interpretedOperation.path === "/partners/:id";
          const values = interpreted.actionId === actionId || genericPartnerUpdate
            ? interpreted.values
            : (await interpretRequest(input.text!, [workflow], contextualReference ? { actionId, values: { path_id: contextualReference } } : null, session.messages as any, settings?.instructions || "", memories, sessionMemory)).values;
          const provided = { ...(continuing ? pending!.provided : {}), ...(contextualReference ? { path_id: contextualReference } : {}), ...values };
          reply = await prepare(actionId, provided, false, continuing ? pending!.intent : input.text || "");
        }
      }
      else if (isCommissionLevelCreationIntent(input.text || "", Boolean(pendingPartnerReference(pending)))) {
        const operation = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/partners/commission-levels");
        const workflow = operation && workflows.find(candidate => candidate.actionId === operation.id);
        if (workflow) {
          const continuing = pending?.actionId === workflow.actionId && !interpreted.newRequest;
          const provided = { ...(continuing ? pending!.provided : {}), ...interpreted.values };
          reply = await prepare(workflow.actionId, provided, false, continuing ? pending!.intent : input.text || "");
        } else {
          reply = { status: "unsupported", reply: "Mình chưa thể tạo cấu hình hoa hồng qua chat vì chức năng này chưa được bật hoặc tài khoản chưa có quyền." };
        }
      }
      else if (isPartnerCommissionUpdateIntent(input.text || "", Boolean(pendingPartnerReference(pending)))) {
        const operation = ASSISTANT_OPERATIONS.find(op => op.id === "partner.commission.update");
        const workflow = operation && workflows.find(candidate => candidate.actionId === operation.id);
        if (!workflow) {
          reply = { status: "unsupported", reply: "Mình chưa thể cập nhật hoa hồng đối tác qua chat vì chức năng này chưa được bật hoặc tài khoản chưa có quyền." };
        } else {
          const continuing = pending?.actionId === workflow.actionId && !interpreted.newRequest;
          const contextualReference = contextualPendingPartnerReference(input.text || "", pending);
          const interpretedOperation = operationById(interpreted.actionId || "");
          const genericPartnerUpdate = interpretedOperation?.method === "PATCH" && interpretedOperation.path === "/partners/:id";
          const values = interpreted.actionId === workflow.actionId || genericPartnerUpdate
            ? interpreted.values
            : (await interpretRequest(input.text!, [workflow], continuing ? { actionId: pending!.actionId, values: pending!.provided } : contextualReference ? { actionId: workflow.actionId, values: { path_id: contextualReference } } : null, session.messages as any, settings?.instructions || "", memories, sessionMemory)).values;
          const provided = { ...(continuing ? pending!.provided : {}), ...(contextualReference ? { path_id: contextualReference } : {}), ...values };
          reply = await prepare(genericPartnerUpdate ? interpreted.actionId! : workflow.actionId, provided, false, continuing ? pending!.intent : input.text || "");
        }
      }
      else if (!interpreted.actionId) {
        if (!pending && !input.attachment && interpreted.intentType === "general_question") {
          reply = { status: "unsupported", reply: "Câu hỏi này phù hợp với tab Hỏi đáp. Bạn chuyển sang Hỏi đáp để tiếp tục nhé; tab Thao tác dành cho tra cứu và cập nhật dữ liệu." };
        } else {
          needsIntentClarification = true;
          const clarification = input.attachment
            ? `Mình đã nhận tệp ${input.attachment.fileName}. Bạn muốn dùng tệp này để làm gì?`
            : "Mình chưa hiểu rõ yêu cầu này. Bạn nói hoặc viết lại cụ thể hơn nhé.";
          const guidance = assistantRequestGuidance(input.text || "", workflows, Boolean(input.attachment));
          reply = { status: "unsupported", reply: `${clarification}\n\n${guidance}${pending ? "\n\nYêu cầu trước vẫn được giữ." : ""}` };
        }
      }
      else {
        const referenceCorrection = pending?.actionId === interpreted.actionId
          && Boolean(pending.awaitingPathReferenceKeys?.length)
          && isReferenceCorrectionReply(input.text || "");
        const continuing = pending?.actionId === interpreted.actionId && (!interpreted.newRequest || referenceCorrection);
        const previousOperation = pending ? operationById(pending.actionId) : undefined;
        const requestedOperation = operationById(interpreted.actionId);
        let selectedProductVariant = pending?.selectedProductVariant;
        if (!selectedProductVariant && pending && previousOperation?.path === "/inventory/catalog/variants/:id"
          && requestedOperation?.path === "/inventory/catalog/prices/:variantId") {
          // Recover selections from an in-flight chat created before this handoff
          // context was persisted on PendingAction.
          const previousSelection = await resolveReferences(req, previousOperation, pending.provided as Record<string, AssistantValue>);
          const productId = previousSelection.values.query_productId;
          const variantId = previousSelection.values.path_id;
          if (typeof productId === "string" && typeof variantId === "string") selectedProductVariant = { productId, variantId };
        }
        const continuingSelectedSkuPriceUpdate = previousOperation?.path === "/inventory/catalog/variants/:id"
          && requestedOperation?.path === "/inventory/catalog/prices/:variantId"
          && selectedProductVariant;
        const provided: Record<string, unknown> = {
          ...(continuing ? pending!.provided : {}),
          ...interpreted.values,
          ...(continuingSelectedSkuPriceUpdate ? {
            path_variantId: continuingSelectedSkuPriceUpdate.variantId,
            query_productId: continuingSelectedSkuPriceUpdate.productId,
          } : {}),
        };
        if (!pending && !interpreted.newRequest && session.lastReply?.reply?.includes("Bạn có muốn bổ sung không?")) {
          const followUp = await createdRecordFollowUp(req, input.conversationId);
          const update = followUp && operationById(followUp.actionId);
          const explicitTarget = update?.fields.some(field => (field.source === "path" || field.key === "id") && provided[field.key] !== undefined);
          const explicitBranch = update?.fields.find(field => field.source === "query" && field.apiKey === "branchId");
          if (followUp && update?.id === interpreted.actionId && !explicitTarget
            && (!explicitBranch || provided[explicitBranch.key] === undefined || provided[explicitBranch.key] === followUp.values[explicitBranch.key])) {
            Object.assign(provided, { ...followUp.values, ...provided });
          }
        }
        reply = await prepare(interpreted.actionId, provided, false, continuing ? pending!.intent : input.text || "");
      }
    }
  } catch (error) {
    const uncertain = error instanceof UncertainExecutionError || (hasDispatched && !(error instanceof AssistantError));
    reply = uncertain ? { ...uncertainReply(), link: pending ? operationById(pending.actionId)?.link : undefined } : { status: "failed", reply: friendlyFailure(error) };
    // Keep pending work when a turn fails before dispatch so a transient
    // interpretation or validation error does not discard the user's draft.
    if (uncertain || (reply.status === "failed" && hasDispatched)) pending = null;
  }
  reply = await completeAssistantOperation(reply, completion, ASSISTANT_OPERATIONS, async operation => {
    await assertOperation(req, operation.id);
    return (await currentWorkflow(req, operation.id)).enabled;
  });
  if (autoMemoryEnabled && input.text && !memoryCommand && !forgetMemoryCommand && reply.status !== "failed" && reply.status !== "uncertain") {
    await autoSaveAssistantMemories(req, input.text);
  }
  const defaultedLabels = completion?.workflow.fields.filter(field => completion?.defaultedKeys?.includes(field.key))
    .flatMap(field => [field.label, localizedAssistantFieldLabel(field.apiKey || field.key, "", completion?.operation.id)]) || [];
  // General conversation already applies account preferences in its own prompt.
  // ERP presentation would strip explanations about workflows and alter code examples.
  if (assistantMode !== "qa") {
    reply = presentAssistantReply(reply, defaultedLabels);
    // Keep uncertainty explicit; stylistic rewriting must not invent a selected operation.
    if (!needsIntentClarification) reply = await applyAssistantResponseRules(reply, responseRules);
    reply = {
      ...reply,
      reply: hideInternalAssistantIds(normalizeAssistantReply(reply.reply, input.text || "")),
      ...(reply.action ? { action: sanitizeActionPreview(reply.action) } : {}),
    };
    reply = presentAssistantReply(reply, defaultedLabels);
  }
  try {
    await AssistantTurnModel.updateOne({ _id: turn._id }, { $set: {
      status: reply.status === "uncertain" ? "uncertain" : "completed", result: reply,
      ...(completion?.followUp ? { "payload.__assistantFollowUp": completion.followUp } : {}),
    } });
    const messagesWithReply = [...history, { role: "assistant", content: reply.reply, createdAt: new Date().toISOString(), ...(reply.files?.length ? { files: reply.files } : {}), ...(reply.sources?.length ? { sources: reply.sources } : {}), ...(reply.illustrations?.length ? { illustrations: reply.illustrations } : {}) }].slice(-40);
    let retainedIllustrations = 0;
    const nextMessages = messagesWithReply.slice().reverse().map((message: any) => {
      if (!Array.isArray(message.illustrations) || !message.illustrations.length) return message;
      retainedIllustrations += 1;
      if (retainedIllustrations <= 6) return message;
      const withoutIllustrations = { ...message };
      delete withoutIllustrations.illustrations;
      return withoutIllustrations;
    }).reverse();
    const nextMessageCount = Math.max(Number(session.messageCount) || 0, session.messages.length) + 2;
    const sessionUpdate: Record<string, unknown> = {
      mode: assistantMode,
      pending,
      pendingDocumentRequest,
      lastReply: reply,
      messages: nextMessages.slice(-40),
      messageCount: nextMessageCount,
      busy: false,
    };
    const lastSessionMemoryCount = Number(session.sessionMemoryMessageCount) || 0;
    const shouldSummarizeSession = nextMessageCount >= 12 && nextMessageCount - lastSessionMemoryCount >= 12;
    const sessionMemoryVersion = Number(session.sessionMemoryVersion) || 0;
    if (shouldSummarizeSession) {
      sessionUpdate.sessionMemoryMessageCount = nextMessageCount;
    }
    await AssistantSessionModel.updateOne(sessionFilter, { $set: sessionUpdate });
    if (shouldSummarizeSession) {
      void summarizeAssistantSession(sessionMemory, nextMessages).then(async nextSessionMemory => {
        if (nextSessionMemory === null) return;
        await AssistantSessionModel.updateOne({
          ...sessionFilter,
          sessionMemoryMessageCount: nextMessageCount,
          ...sessionMemoryVersionFilter(sessionMemoryVersion),
        }, { $set: { sessionMemory: nextSessionMemory }, $inc: { sessionMemoryVersion: 1 } });
      }).catch(error => console.warn("[assistant session memory] Background summary failed", error));
    }
  } catch (error) {
    // A crash after the business API may leave an executing record. Never replay that mutation.
    if (hasDispatched) return { ...uncertainReply(), link: reply.link };
    throw error;
  }
  return reply;
}
