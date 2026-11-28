import { randomUUID } from "node:crypto";
import { normalizeBusinessResult } from "./business-result";
import { AssistantApiRejection } from "./api-rejection";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { AssistantField, AssistantValue } from "../../src/shared/assistant-workflow";
import { formatAssistantTemporalValue } from "../../src/shared/assistant-date";
import { PAYROLL_LINE_OVERRIDE_FIELDS } from "../interface/payroll-line-override.interface";
import { ASSISTANT_OPERATIONS, operationById, type AssistantOperation, type AssistantResultFieldTree } from "./catalog";
import { actorScope, assertOperation } from "./workflows";
import { validateStructuredField } from "./structured-data";
import { applyWorkWorkflowMutation } from "./workflow-mutations";
import { AssistantError } from "./policy";
import { callHealthcareOperation, HealthcareUncertainExecutionError, lookupHealthcareRecords, projectHealthcareRecords, resolveHealthcareReferences, suggestHealthcareReferences } from "./healthcare-executor";
import { callQuotationOperation, lookupQuotationRecords, projectQuotationRecords, QuotationUncertainExecutionError, resolveQuotationReferences, suggestQuotationReferences } from "./quotation-executor";
import { summarizeDailyAttendance } from "./timekeeping-summary";

export class UncertainExecutionError extends Error {}
export type AssistantRecord = Record<string, AssistantValue>;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\u0111\u0110]/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
const retailOrderCodeFromSearch = (value: string) => {
  const normalized = normalize(value);
  return normalized.match(/\b(pos-[a-z0-9][a-z0-9_-]{3,})\b/)?.[1]
    || normalized.match(/\bma\s+([a-z0-9][a-z0-9_-]{3,})\b/)?.[1];
};
const workerProfileStandardFieldKeys = new Set(["fullName", "phone", "email", "idCard", "birthday", "registrationDate", "address", "status", "laborType", "nationality", "workPermitNumber", "workPermitExpiry", "note"]);
const payrollPaymentRequiredStatus: Record<string, string> = {
  "payroll.payment.cancel": "draft",
  "payroll.payment.confirm": "draft",
  "payroll.payment.reverse": "confirmed",
};
function workerPartnerPayoutChoices(settlement: any) {
  const payouts = Array.isArray(settlement?.payouts) ? settlement.payouts.slice(0, 100) : [];
  const reversedPayoutIds = new Set(payouts.map((payout: any) => String(payout?.reversalOfPayoutId || "")).filter(Boolean));
  const partnerName = typeof settlement?.partnerId?.name === "string" ? settlement.partnerId.name.slice(0, 160) : "Đối tác lao động";
  const period = [settlement?.periodStart, settlement?.periodEnd].filter((value: unknown) => typeof value === "string").join(" đến ");
  return payouts.flatMap((payout: any) => {
    const payoutId = String(payout?._id || payout?.id || "");
    const amount = Number(payout?.amount);
    if (!/^[a-f\d]{24}$/i.test(payoutId) || !Number.isSafeInteger(amount) || amount <= 0 || payout?.reversalOfPayoutId) return [];
    if (payouts.some((candidate: any) => String(candidate?.reversalOfPayoutId || "") === payoutId) || reversedPayoutIds.has(payoutId)) return [];
    const paidAt = payout?.paidAt instanceof Date ? payout.paidAt.toISOString() : typeof payout?.paidAt === "string" ? payout.paidAt.slice(0, 40) : "";
    if (!paidAt || Number.isNaN(Date.parse(paidAt))) return [];
    const method = payout?.method === "bank_transfer" ? "Chuyển khoản" : payout?.method === "cash" ? "Tiền mặt" : "";
    if (!method) return [];
    const safe: Record<string, unknown> = {
      label: `${partnerName} · ${period} · ${paidAt} · ${new Intl.NumberFormat("vi-VN").format(amount)} ₫ · ${method}`,
      amount, paidAt, method,
    };
    Object.defineProperties(safe, {
      payoutId: { value: payoutId, enumerable: false },
      __assistantReversible: { value: true, enumerable: false },
    });
    return [safe];
  });
}
const weekdayLabels = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const weekdayNumbers = new Map<string, number>([
  ["chu nhat", 0], ["cn", 0], ["thu 2", 1], ["thu hai", 1], ["thu 3", 2], ["thu ba", 2],
  ["thu 4", 3], ["thu tu", 3], ["thu 5", 4], ["thu nam", 4], ["thu 6", 5], ["thu sau", 5], ["thu 7", 6], ["thu bay", 6],
]);
function formatWeekdays(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value.map((day: unknown) => Number(day)).filter((day: number) => Number.isInteger(day) && day >= 0 && day < weekdayLabels.length).sort((a: number, b: number) => a - b).map((day: number) => weekdayLabels[day]).join(", ");
}
function normalizeWeekdays(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 7) throw new AssistantError(`${label}: cần chọn từ 1 đến 7 ngày trong tuần.`);
  const days = value.map((day: unknown) => {
    if (typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6) return day;
    if (typeof day === "string") {
      const normalized = normalize(day).replace(/[.-]/g, " ").replace(/\s+/g, " ").trim();
      const match = weekdayNumbers.get(normalized);
      if (match !== undefined) return match;
    }
    throw new AssistantError(`${label}: ngày trong tuần không hợp lệ.`);
  });
  if (new Set(days).size !== days.length) throw new AssistantError(`${label}: không chọn lặp ngày trong tuần.`);
  return days.sort((a, b) => a - b);
}
function safeWorkShift(shift: any) {
  const breaks = Array.isArray(shift?.breakPeriods) ? shift.breakPeriods : [];
  const breakSummary = breaks.map((period: any) => [period.name, `${period.startTime || ""}–${period.endTime || ""}`, period.paid === true ? "tính công" : "không tính công"].filter(Boolean).join(" · ")).filter(Boolean).join("; ");
  const safeId = String(shift?._id || shift?.id || "");
  return {
    ...( /^[a-f\d]{24}$/i.test(safeId) ? { __assistantRef: { id: safeId } } : {}),
    name: shift?.name, code: shift?.code, color: shift?.color, startTime: shift?.startTime, endTime: shift?.endTime,
    workingDaysLabel: formatWeekdays(shift?.workingDays), checkInFrom: shift?.checkInFrom, checkInUntil: shift?.checkInUntil,
    checkOutFrom: shift?.checkOutFrom, checkOutUntil: shift?.checkOutUntil, breakPeriodsSummary: breakSummary || undefined,
    allowedLateMinutes: shift?.allowedLateMinutes, allowedEarlyLeaveMinutes: shift?.allowedEarlyLeaveMinutes,
    standardMinutes: shift?.standardMinutes, employeeCount: shift?.employeeCount,
    isDefault: shift?.isDefault, isActive: shift?.isActive,
  };
}
function safeWorkHoursEmployee(employee: any) {
  const config = employee?.workHoursConfig && typeof employee.workHoursConfig === "object" ? employee.workHoursConfig : {};
  const safeId = String(employee?._id || employee?.id || employee?.uid || "");
  const existing = {
    useCustom: config.useCustom === true,
    checkInLimit: config.checkInLimit,
    checkOutLimit: config.checkOutLimit,
    lunchBreakStart: config.lunchBreakStart,
    lunchBreakEnd: config.lunchBreakEnd,
    workingDays: Array.isArray(config.workingDays) ? config.workingDays : undefined,
    annualLeaveDays: config.annualLeaveDays,
    employmentStatus: employee?.employmentStatus ?? config.employmentStatus,
    officialDate: employee?.officialDate ?? config.officialDate,
  };
  const safe: Record<string, any> = {
    ...( /^[a-f\d]{24}$/i.test(safeId) ? { __assistantRef: { id: safeId } } : {}),
    employeeName: employee?.fullName || employee?.displayName,
    email: employee?.email,
    useCustom: existing.useCustom,
    checkInLimit: existing.checkInLimit,
    checkOutLimit: existing.checkOutLimit,
    lunchBreakStart: existing.lunchBreakStart,
    lunchBreakEnd: existing.lunchBreakEnd,
    workingDaysLabel: formatWeekdays(existing.workingDays),
    annualLeaveDays: existing.annualLeaveDays,
  };
  Object.defineProperty(safe, "__assistantExistingRecord", { value: existing, enumerable: false });
  return safe;
}
function safeCompanyLocation(config: any) {
  const safe: Record<string, any> = {
    addressName: config?.addressName,
    allowedRadius: config?.allowedRadius,
    checkInLimit: config?.checkInLimit,
    checkOutLimit: config?.checkOutLimit,
    lunchBreakStart: config?.lunchBreakStart,
    lunchBreakEnd: config?.lunchBreakEnd,
    annualLeaveDays: config?.annualLeaveDays,
    workDays: formatWeekdays(config?.workingDays),
  };
  const existing = {
    latitude: config?.latitude,
    longitude: config?.longitude,
    allowedRadius: config?.allowedRadius,
    addressName: config?.addressName,
    checkInLimit: config?.checkInLimit,
    checkOutLimit: config?.checkOutLimit,
    lunchBreakStart: config?.lunchBreakStart,
    lunchBreakEnd: config?.lunchBreakEnd,
    workingDays: Array.isArray(config?.workingDays) ? config.workingDays : undefined,
    annualLeaveDays: config?.annualLeaveDays,
  };
  Object.defineProperty(safe, "__assistantExistingRecord", { value: existing, enumerable: false });
  return safe;
}
const payrollReconciliationFieldLabels: Record<string, string> = {
  workedMinutes: "Giờ công", baseSalary: "Lương cơ bản", adjustedBase: "Lương theo công", overtime: "Tăng ca",
  commission: "Hoa hồng", bonusTotal: "Thưởng", hiddenIncome: "Phụ cấp và thu nhập khác", penaltyTotal: "Phạt",
  socialInsurance: "BHXH", healthInsurance: "BHYT", unemploymentInsurance: "BHTN", personalIncomeTax: "Thuế TNCN",
  advances: "Tạm ứng", otherDeductions: "Khấu trừ khác", net: "Thực nhận",
};
function safeFaqCandidate(candidate: any) {
  return {
    id: candidate?._id || candidate?.id,
    question: candidate?.question,
    suggestedAnswer: candidate?.suggestedAnswer,
    category: candidate?.category,
    frequency: candidate?.frequency,
    confidenceScore: candidate?.confidenceScore,
    status: candidate?.status,
    lastAskedAt: candidate?.lastAskedAt,
  };
}
function safePageChatFlowFields(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((field: any) => {
    if (!field || typeof field !== "object") return [];
    const key = typeof field.key === "string" ? field.key.trim() : "";
    const label = typeof field.label === "string" ? field.label.trim() : "";
    const question = typeof field.question === "string" ? field.question.trim() : "";
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(key) || !label || label.length > 100 || !question || question.length > 300) return [];
    return [{ key, label, question }];
  });
}
function safePageChatFlow(value: any, includeFields: boolean) {
  const result: Record<string, unknown> = {};
  if (Number.isSafeInteger(value?.version) && value.version > 0) result.version = value.version;
  if (["draft", "active", "archived"].includes(String(value?.status))) result.status = value.status;
  if (typeof value?.goal === "string") result.goal = value.goal.slice(0, 300);
  if (typeof value?.completionMessage === "string") result.completionMessage = value.completionMessage.slice(0, 500);
  if (includeFields) result.fields = safePageChatFlowFields(value?.fields);
  if (typeof value?.createdAt === "string") result.createdAt = value.createdAt.slice(0, 40);
  return result;
}
function safeNotification(value: any, includeBody: boolean) {
  const safe: Record<string, any> = {
    title: typeof value?.title === "string" ? value.title.slice(0, 500) : undefined,
    type: ["kho", "task", "training", "he-thong"].includes(String(value?.type)) ? value.type : undefined,
    read: typeof value?.read === "boolean" ? value.read : undefined,
    createdAt: typeof value?.createdAt === "string" ? value.createdAt : undefined,
  };
  if (includeBody && typeof value?.body === "string") safe.body = value.body.slice(0, 2000);
  const id = String(value?._id || value?.id || "");
  if (/^[a-f\d]{24}$/i.test(id)) Object.defineProperty(safe, "__assistantRef", { value: { id }, enumerable: false });
  return safe;
}
function safeRetailAfterSale(doc: any) {
  const items = Array.isArray(doc?.items) ? doc.items : [];
  const displayed = items.slice(0, 12).map((item: any) => `${Number(item.quantity || 0)} × ${String(item.productName || item.sku || "Sản phẩm")}${item.sku ? ` (${item.sku})` : ""}`);
  if (items.length > displayed.length) displayed.push(`Còn ${items.length - displayed.length} dòng`);
  return {
    __assistantRef: { id: String(doc?._id || doc?.id || "") },
    code: doc?.code, type: doc?.type, status: doc?.status, orderCode: doc?.orderCode, customerName: doc?.customerName,
    totalAmount: doc?.totalAmount, paymentMethod: doc?.paymentMethod, reason: doc?.reason, businessDate: doc?.businessDate,
    itemsSummary: displayed.join("; "), createdAt: doc?.createdAt,
  };
}
function isCommissionLevelOperation(op: AssistantOperation) { return op.path.startsWith("/partners/commission-levels"); }
function isRetailPosOperation(op: AssistantOperation) { return op.path.startsWith("/retail/orders") || op.path.startsWith("/retail/shifts") || op.path.startsWith("/retail/invoices") || ["/retail/reports/summary", "/retail/reports/export"].includes(op.path); }
function isRetailCashbookOperation(op: AssistantOperation) { return op.path.startsWith("/retail/finance/cashbook"); }
function isRetailFinanceCommissionOperation(op: AssistantOperation) {
  return op.path.startsWith("/retail/finance/commission/") && op.path !== "/retail/finance/commission/balances";
}
function isRetailReceivableOperation(op: AssistantOperation) { return op.path.startsWith("/retail/receivables/"); }
function isRetailAfterSaleOperation(op: AssistantOperation) { return op.path.startsWith("/retail/after-sales"); }
function isRecruitmentOperation(op: AssistantOperation) { return op.path.startsWith("/recruitment/"); }
function isInventoryCountOperation(op: AssistantOperation) { return op.path.startsWith("/inventory/counts"); }
function missingRecruitmentJobReadiness(job: Record<string, any>, now = new Date()) {
  const missing: string[] = [];
  if (!String(job.title || "").trim()) missing.push("tiêu đề");
  if (!String(job.description || "").trim()) missing.push("mô tả công việc");
  if (!String(job.requirements || "").trim()) missing.push("yêu cầu ứng viên");
  if (!Number.isFinite(Number(job.headcount)) || Number(job.headcount) <= 0) missing.push("số lượng tuyển");
  if (!String(job.workplaceType || "").trim()) missing.push("hình thức làm việc");
  if (!String(job.location || "").trim()) missing.push("địa điểm");
  const deadline = job.applicationDeadline ? new Date(job.applicationDeadline) : null;
  if (!deadline || Number.isNaN(deadline.getTime()) || deadline <= now) missing.push("hạn nhận hồ sơ trong tương lai");
  return missing;
}
function isBranchScopedAssistantOperation(op: AssistantOperation) {
  return op.id.startsWith("inventory.serial.") || ["inventory.warehouse.locations.list", "inventory.stock-log.list", "inventory.stock-log.analysis", "inventory.receipt.analysis", "inventory.stock.analysis", "inventory.serial.analysis", "inventory.price.analysis", "inventory.stock-log.reverse", "inventory.stock-log.internal.issue.create", "finance.tax.from-invoice", "retail.invoice.list", "retail.warranty.serial.update", "retail.coupon.create", "retail.coupon.tier.list"].includes(op.id) || op.path === "/inventory/transfers" || op.path.startsWith("/inventory/transfers/") || isInventoryCountOperation(op) || op.path.startsWith("/inventory/reconciliation/") || op.path.startsWith("/finance/receivables") || op.path.startsWith("/finance/reporting/") || op.path.startsWith("/finance/reminders/") || op.path === "/finance/management/debts" || op.path === "/finance/management/payables" || op.path === "/finance/management/followups" || op.path.startsWith("/payroll/periods/") || op.path.startsWith("/payroll/runs") || op.id.startsWith("payroll.payment.") || op.path === "/retail/settings" || op.path.startsWith("/retail/debt-reminders/") || isRetailPosOperation(op) || isRetailCashbookOperation(op) || isRetailFinanceCommissionOperation(op) || isRetailReceivableOperation(op) || isRetailAfterSaleOperation(op) || isCommissionLevelOperation(op) || isRecruitmentOperation(op) || op.id === "repair.device.lookup" || op.id === "repair.notification.resend" || op.id === "repair.feedback.link.create";
}
function requiresBranchChoice(op: AssistantOperation) {
  return op.id.startsWith("inventory.serial.") || ["inventory.warehouse.locations.list", "inventory.stock-log.list", "inventory.stock-log.analysis", "inventory.receipt.analysis", "inventory.stock.analysis", "inventory.serial.analysis", "inventory.price.analysis", "inventory.stock-log.reverse", "inventory.stock-log.internal.issue.create", "finance.tax.from-invoice"].includes(op.id) || op.path === "/inventory/transfers" || op.path.startsWith("/inventory/transfers/") || ["retail.invoice.list", "retail.invoice.bulk-pdf", "retail.order.payment-qr", "retail.report.top-products"].includes(op.id) || op.id === "retail.warranty.serial.update" || op.id === "retail.coupon.create" || op.id === "retail.coupon.tier.list" || isInventoryCountOperation(op) || op.path.startsWith("/inventory/reconciliation/") || op.path.startsWith("/finance/receivables") || op.path.startsWith("/finance/reporting/") || op.path.startsWith("/finance/reminders/") || op.path === "/finance/management/debts" || op.path === "/finance/management/payables" || op.path === "/finance/management/followups" || op.path.startsWith("/payroll/periods/") || op.path.startsWith("/payroll/runs") || op.id.startsWith("payroll.payment.") || op.path === "/retail/settings" || op.path.startsWith("/retail/debt-reminders/") || isRetailPosOperation(op) || isRetailCashbookOperation(op) || isRetailFinanceCommissionOperation(op) || isRetailReceivableOperation(op) || isRetailAfterSaleOperation(op) || (isCommissionLevelOperation(op) && op.method !== "GET") || isRecruitmentOperation(op) || op.id === "repair.device.lookup" || op.id === "repair.notification.resend" || op.id === "repair.feedback.link.create";
}

function assertScheduledCampaignInput(input: Record<string, AssistantValue>) {
  const parseArray = (value: unknown, label: string): unknown[] => {
    try {
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      if (!Array.isArray(parsed)) throw new Error("not an array");
      return parsed;
    } catch {
      throw new AssistantError(`${label}: danh sách không hợp lệ.`);
    }
  };
  const validDate = (value: unknown) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  };
  const startDate = String(input.startDate || "");
  const endDate = String(input.endDate || "");
  if (!validDate(startDate) || !validDate(endDate)) throw new AssistantError("Ngày chiến dịch cần đúng định dạng YYYY-MM-DD.");
  const dayCount = Math.floor((Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) / 86_400_000) + 1;
  if (dayCount < 1 || dayCount > 30) throw new AssistantError("Kế hoạch trong chat hỗ trợ khoảng ngày tối đa 30 ngày.");

  const postingTimes = parseArray(input.postingTimes, "Giờ đăng");
  if (postingTimes.length < 1 || postingTimes.length > 3
    || postingTimes.some(time => typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    || new Set(postingTimes).size !== postingTimes.length) {
    throw new AssistantError("Chọn từ 1 đến 3 giờ đăng hợp lệ, không lặp.");
  }
  const postsPerDay = Number(input.postsPerDay);
  if (!Number.isSafeInteger(postsPerDay) || postsPerDay !== postingTimes.length) {
    throw new AssistantError("Số bài mỗi ngày phải khớp với số giờ đăng đã chọn.");
  }
  const channels = parseArray(input.channels, "Kênh đăng");
  if (channels.length < 1 || channels.length > 2
    || channels.some(channel => !["Facebook", "TikTok"].includes(String(channel)))
    || new Set(channels).size !== channels.length) {
    throw new AssistantError("Chọn Facebook, TikTok hoặc cả hai kênh, không chọn lặp.");
  }
  if (dayCount * postingTimes.length > 90) throw new AssistantError("Mỗi kế hoạch trong chat hỗ trợ tối đa 90 lượt đăng.");
}

function assertCampaignCalendarRange(input: Record<string, AssistantValue>) {
  const validDate = (value: unknown) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  };
  const startDate = String(input.query_startDate || "");
  const endDate = String(input.query_endDate || "");
  if (!validDate(startDate) || !validDate(endDate)) throw new AssistantError("Khoảng ngày lịch cần đúng định dạng YYYY-MM-DD.");
  const dayCount = Math.floor((Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) / 86_400_000) + 1;
  if (dayCount < 1 || dayCount > 7) throw new AssistantError("Tra lịch trong chat hỗ trợ tối đa 7 ngày mỗi lần.");
}

/** Only calls a code-owned route on this Express listener. Host, URL and credentials are never model inputs. */
export async function callOperation(req: AuthenticatedRequest, op: AssistantOperation, input: Record<string, AssistantValue>, password?: string, requestId?: string) {
  if (op.unavailableReason) throw new AssistantError(op.unavailableReason, 409);
  const normalizedInput: Record<string, AssistantValue> = { ...input };
  const aliasesFor = (field: AssistantField) => {
    const key = String(field.key || "");
    const apiKey = String(field.apiKey || "");
    const aliases = new Set([apiKey, `query_${apiKey}`, key]);
    if (["branchId", "targetBranch"].includes(apiKey)) { aliases.add("branchId"); aliases.add("targetBranch"); }
    if (apiKey === "from") aliases.add("query_from");
    if (apiKey === "to") aliases.add("query_to");
    if (apiKey === "page") aliases.add("query_page");
    if (apiKey === "limit") aliases.add("query_limit");
    for (const alias of aliases) if (alias && normalizedInput[alias] !== undefined) return normalizedInput[alias];
    return undefined;
  };
  for (const field of op.fields) {
    if (normalizedInput[field.key] !== undefined) continue;
    const value = aliasesFor(field);
    if (value !== undefined) normalizedInput[field.key] = value;
  }
  const branchQueryField = op.fields.find(field => field.source === "query" && field.apiKey === "branchId");
  const branchHeader = req.headers?.["x-branch-id"] || req.headers?.["X-Branch-Id"];
  if (op.module === "inventory" && branchQueryField && normalizedInput[branchQueryField.key] === undefined
    && !req.user?.branchId && typeof branchHeader === "string" && branchHeader) {
    normalizedInput[branchQueryField.key] = branchHeader;
  }
  input = normalizedInput;
  const collectPages = async (actionId: string, base: Record<string, AssistantValue>, pageSize = 100) => {
    const source = ASSISTANT_OPERATIONS.find(candidate => candidate.id === actionId);
    if (!source) throw new AssistantError(`Thiếu nguồn dữ liệu ${actionId}.`, 503);
    const rows: Record<string, any>[] = [];
    let total: number | undefined;
    for (let page = 1; page <= 100; page += 1) {
      const response = await callOperation(req, source, { ...base, query_page: page, query_limit: pageSize }, password, requestId);
      const batch = rawRecords(response);
      rows.push(...batch);
      const data = response?.data && typeof response.data === "object" ? response.data : {};
      const parsedTotal = Number(data.total ?? response?.total);
      if (Number.isSafeInteger(parsedTotal) && parsedTotal >= 0) total = parsedTotal;
      if (batch.length < pageSize || (total !== undefined && rows.length >= total)) return rows;
      if (page === 100) throw new AssistantError("Dữ liệu có quá 10.000 dòng; hãy thu hẹp kỳ tra cứu.");
    }
    return rows;
  };
  if (op.id === "retail.order.cancelled.report") {
    const cancelledFrom = String(input.cancelledFrom || "");
    const cancelledTo = String(input.cancelledTo || "");
    if (!cancelledFrom || !cancelledTo) throw new AssistantError("Cần chọn đủ ngày bắt đầu và kết thúc cần kiểm tra đơn hủy.");
    const items = await collectPages("retail.order.list", {
      ...(input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch }),
      cancelledFrom,
      cancelledTo,
      query_status: "cancelled",
    });
    return { success: true, data: { items, total: items.length, page: 1, limit: items.length, cancelledFrom, cancelledTo } };
  }
  if (op.id === "inventory.export.capability") {
    const report = String(input.reportType || "stock-balance");
    const finding = report === "stock-log"
      ? "Trợ lý hiện chưa có API tạo tệp Excel cho toàn bộ lịch sử giao dịch kho. Tôi có thể lọc và hiển thị giao dịch trong cuộc trò chuyện theo kỳ hoặc loại phiếu."
      : "Trợ lý hiện chưa có API tạo tệp Excel cho bảng tồn kho. Tôi có thể hiển thị số liệu tồn theo sản phẩm trong cuộc trò chuyện để bạn đối chiếu.";
    return { success: true, data: { finding } };
  }
  if (op.id === "inventory.catalog.analysis") {
    const reportType = String(input.reportType || "");
    const source = ASSISTANT_OPERATIONS.find(candidate => candidate.method === "GET" && candidate.path === "/inventory/catalog/prices");
    if (!source) throw new AssistantError("Thiếu danh sách sản phẩm để thống kê danh mục.", 503);
    const branchPrices = await collectPages(source.id, {}, 100);
    const search = normalize(String(input.search ?? input.q ?? ""));
    const matchingPrices = search ? branchPrices.filter(row => normalize(`${row.productName || ""} ${row.categoryCode || ""} ${row.sku || ""}`).includes(search)) : branchPrices;
    const unique = new Map<string, Record<string, any>>();
    for (const row of matchingPrices) {
      const id = String(row.productId || row.productName || row.sku || "");
      if (!unique.has(id)) unique.set(id, { ...row, name: row.productName, productCode: row.sku, status: row.status, productType: "physical" });
    }
    const products = [...unique.values()];
    const resourceSource = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "inventory.catalog.resource.list");
    const categoryNames = new Map<string, string>();
    if (resourceSource) {
      const categoryResponse = await callOperation(req, resourceSource, { path_kind: "categories" }, password, requestId);
      for (const category of rawRecords(categoryResponse)) {
        if (category.code && category.name) categoryNames.set(String(category.code), String(category.name));
      }
    }
    const categories = new Map<string, number>();
    for (const product of products) {
      const categoryCode = String(product.categoryCode || "");
      const categoryName = categoryNames.get(categoryCode) || "Chưa phân nhóm";
      categories.set(categoryName, (categories.get(categoryName) || 0) + 1);
    }
    const categoryRows = [...categories].map(([categoryCode, productCount]) => ({ categoryCode, productCount }))
      .sort((a, b) => b.productCount - a.productCount || a.categoryCode.localeCompare(b.categoryCode, "vi"));
    if (reportType === "product-count") return { success: true, data: { reportType, summary: { productCount: products.length }, products: [], categories: [] } };
    if (reportType === "category-count") return { success: true, data: { reportType, summary: { productCount: products.length }, categories: categoryRows, products: [] } };
    if (reportType === "category-list") return { success: true, data: { reportType, summary: { productCount: products.length }, categories: [], products: products.slice(0, 100).map(product => ({ name: product.name, productCode: product.productCode, categoryCode: categoryNames.get(String(product.categoryCode || "")) || "Chưa phân nhóm", productType: product.productType, status: product.status })) } };
    throw new AssistantError("Chưa xác định được dạng thống kê danh mục.");
  }
  if (op.id === "inventory.price.analysis") {
    const reportType = String(input.reportType || "");
    const source = ASSISTANT_OPERATIONS.find(candidate => candidate.method === "GET" && candidate.path === "/inventory/catalog/prices");
    if (!source) throw new AssistantError("Thiếu danh sách giá bán theo SKU.", 503);
    const response = await callOperation(req, source, { ...(input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch }) }, password, requestId);
    const prices = rawRecords(response).filter(row => typeof row.sku === "string");
    const search = String(input.search ?? input.q ?? "").trim();
    const searchTerms = search.split(/\s*\|\s*/).map(normalize).filter(Boolean);
    const resourceSource = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "inventory.catalog.resource.list");
    const categories = resourceSource && searchTerms.length
      ? rawRecords(await callOperation(req, resourceSource, { path_kind: "categories" }, password, requestId))
      : [];
    const categoryCodes = new Set(searchTerms.flatMap(term => {
      const categoryTerm = term === "phone" ? "dien thoai" : term === "case" ? "tam op nhua" : term;
      return categories.filter(row => normalize(String(row.name || "")).includes(categoryTerm)
        || normalize(String(row.code || "")) === term).map(row => normalize(String(row.code || "")));
    }));
    const exactPriceMatches = new Map(searchTerms.map(term => [term, prices.filter(row => normalize(String(row.productName || "")) === term || normalize(String(row.sku || "")) === term)] as const));
    const matched = searchTerms.length ? prices.filter(row => {
      const productName = normalize(String(row.productName || ""));
      const searchable = normalize(`${row.productName || ""} ${row.categoryCode || ""} ${row.variantName || ""} ${row.sku || ""}`);
      const sku = normalize(String(row.sku || ""));
      if (categoryCodes.has(normalize(String(row.categoryCode || "")))) return true;
      if (categoryCodes.size && searchTerms.every(term => !exactPriceMatches.get(term)?.length
        && !normalize(`${row.productName || ""} ${row.variantName || ""} ${row.sku || ""}`).includes(term))) return false;
      return searchTerms.some(term => exactPriceMatches.get(term)?.length
        ? productName === term || sku === term
        : searchable.includes(term));
    }) : prices;
    let products = matched.map(row => ({ productName: row.productName, categoryCode: row.categoryCode, variantName: row.variantName, sku: row.sku, sellingPrice: Number(row.sellingPrice) || 0, costPrice: Number(row.costPrice) || 0, status: row.status }));
    if (input.includeAvailability === true || input.includeAvailability === "true") {
      const balanceOperation = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "inventory.warehouse.balances.list");
      if (!balanceOperation) throw new AssistantError("Thiếu nguồn tra cứu tồn kho.", 503);
      const balanceResponse = await callOperation(req, balanceOperation, {
        ...(input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch }),
        query_includeCatalogZeroBalances: "true",
      }, password, requestId);
      const availabilityBySku = new Map(rawRecords(balanceResponse).map(row => [normalize(String(row.sku || "")), Number(row.availableQuantity) || 0] as const));
      products = products.map(row => ({ ...row, availableQuantity: availabilityBySku.get(normalize(String(row.sku || ""))) || 0 }));
    }
    if (reportType === "zero-price") products = products.filter(row => row.sellingPrice === 0);
    else if (reportType === "highest-price") {
      products.sort((a, b) => b.sellingPrice - a.sellingPrice);
      const highest = products[0]?.sellingPrice;
      products = highest === undefined ? [] : products.filter(row => row.sellingPrice === highest);
    } else if (reportType !== "product-prices") throw new AssistantError("Chưa xác định được dạng tra cứu giá.");
    return { success: true, data: { reportType, products: products.slice(0, 100), finding: products.length ? undefined : "Không có SKU phù hợp trong danh sách giá của chi nhánh." } };
  }
  if (op.id === "inventory.stock.analysis") {
    const source = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "inventory.warehouse.balances.list");
    if (!source) throw new AssistantError("Thiếu nguồn tra cứu tồn kho.", 503);
    const reportType = String(input.reportType || "");
    const targetBranch = input.targetBranch;
    const balanceResponse = await callOperation(req, source, {
      ...(targetBranch === undefined ? {} : { targetBranch }),
      ...(input.warehouseId === undefined ? {} : { query_warehouseId: input.warehouseId }),
      ...((input.search ?? input.q) === undefined ? {} : { query_q: input.search ?? input.q }),
      query_includeCatalogZeroBalances: "true",
    }, password, requestId);
    const balanceRows = rawRecords(balanceResponse).filter(row => typeof row.productName === "string");
    const byProduct = new Map<string, Record<string, any>>();
    for (const row of balanceRows) {
      const name = String(row.productName || "").trim();
      const key = String(row.productId || "").trim() || normalize(name);
      const current = byProduct.get(key) || { productName: name, sku: [], warehouseName: [], quantity: 0, reservedQuantity: 0, availableQuantity: 0, inventoryValue: 0, minimum: 0, productId: String(row.productId || ""), hasBalanceRecord: false };
      const quantity = Number(row.quantity) || 0;
      const averageCost = Number(row.averageCost) || 0;
      current.quantity += quantity;
      current.reservedQuantity += Number(row.reservedQuantity) || 0;
      current.availableQuantity += Number(row.availableQuantity) || 0;
      current.inventoryValue += quantity * averageCost;
      current.minimum += Number(row.minStock) || 0;
      current.hasBalanceRecord ||= row.hasBalanceRecord === true;
      if (row.sku && !current.sku.includes(String(row.sku))) current.sku.push(String(row.sku));
      if (row.warehouseName && !current.warehouseName.includes(String(row.warehouseName))) current.warehouseName.push(String(row.warehouseName));
      if (quantity > 0) current.averageCost = current.inventoryValue / current.quantity;
      byProduct.set(key, current);
    }
    const products: Array<Record<string, any>> = [...byProduct.values()].map(row => ({
      productName: row.productName,
      sku: row.sku.join(", "),
      warehouseName: row.warehouseName.join(", "),
      quantity: row.quantity,
      reservedQuantity: row.reservedQuantity,
      availableQuantity: row.availableQuantity,
      minStock: row.minimum,
      averageCost: row.quantity > 0 ? Math.round(row.inventoryValue / row.quantity) : 0,
      inventoryValue: row.inventoryValue,
      productId: row.productId,
      hasBalanceRecord: row.hasBalanceRecord,
    }));
    const search = String(input.search ?? input.q ?? "").trim();
    const searchTerms = search.split(/\s*\|\s*/).map(normalize).filter(Boolean);
    let filtered = searchTerms.length ? products.filter(row => {
      const name = normalize(String(row.productName || ""));
      const skus = String(row.sku || "").split(/\s*,\s*/).map(normalize);
      return searchTerms.some(term => name === term || skus.includes(term));
    }) : products;
    if (searchTerms.length && !filtered.length) {
      filtered = products.filter(row => searchTerms.some(term => normalize(String(row.productName || "")).includes(term)));
    }
    const from = String(input.from || "");
    const to = String(input.to || "");
    if (reportType === "count-variance") {
      const physicalCount = Number(input.physicalCount);
      if (!search || !Number.isFinite(physicalCount) || physicalCount < 0) throw new AssistantError("Cần nêu dòng sản phẩm và số lượng kiểm đếm thực tế để đối chiếu.");
      if (!filtered.length) return { success: true, data: { reportType, range: { from, to }, summary: {}, products: [], finding: "Không tìm thấy đúng dòng sản phẩm trong sổ tồn nên chưa thể tính chênh lệch." } };
      if (filtered.length > 1) return { success: true, data: { reportType, range: { from, to }, summary: {}, products: [], finding: "Tên sản phẩm khớp với nhiều dòng hàng; cần chọn đúng phiên bản hoặc SKU trước khi tính chênh lệch." } };
      const bookQuantity = filtered.reduce((sum, row) => sum + row.quantity, 0);
      const variance = physicalCount - bookQuantity;
      const summary = { productCount: filtered.length, stockQuantity: bookQuantity, availableQuantity: filtered.reduce((sum, row) => sum + row.availableQuantity, 0), inventoryValue: filtered.reduce((sum, row) => sum + row.inventoryValue, 0), physicalCount, variance, varianceStatus: variance === 0 ? "Khớp sổ sách" : variance > 0 ? "Thực tế nhiều hơn sổ sách" : "Thực tế ít hơn sổ sách" };
      const products = filtered.map(row => ({ ...row, physicalCount, variance }));
      return { success: true, data: { reportType, range: { from, to }, summary, products: products.slice(0, 100) } };
    }
    const needsSales = ["no-sales-with-stock", "days-cover", "slow-moving", "forecast-30d", "reorder-status", "reorder-within-14", "stability-assessment"].includes(reportType);
    let salesRange = { from, to };
    if (needsSales) {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const toDay = to || today;
      const startDay = new Date(`${toDay}T00:00:00Z`);
      if (!from) startDay.setUTCDate(startDay.getUTCDate() - 29);
      const fromDay = from || startDay.toISOString().slice(0, 10);
      const salesOperation = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "retail.report.summary");
      if (!salesOperation) throw new AssistantError("Thiếu báo cáo bán hàng để tính tốc độ bán.", 503);
      const salesResponse = await callOperation(req, salesOperation, {
        ...(targetBranch === undefined ? {} : { targetBranch }),
        query_from: fromDay,
        query_to: toDay,
      }, password, requestId);
      const salesData = salesResponse?.data && typeof salesResponse.data === "object" ? salesResponse.data : {};
      const salesRows = Array.isArray(salesData.products) ? salesData.products : [];
      const salesByName = new Map<string, number>();
      for (const row of salesRows) {
        const key = normalize(String(row.productName || ""));
        if (!key) continue;
        salesByName.set(key, (salesByName.get(key) || 0) + Math.max(0, Number(row.netQuantity) || 0));
      }
      const days = Math.max(1, Math.floor((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86_400_000) + 1);
      salesRange = { from: fromDay, to: toDay };
      for (const row of filtered) {
        row.soldQuantity = salesByName.get(normalize(row.productName)) || 0;
        row.averageDailySales = row.soldQuantity / days;
        row.estimatedDaysRemaining = row.averageDailySales > 0 ? Math.floor(row.availableQuantity / row.averageDailySales) : null;
        row.forecastSales30d = row.averageDailySales * 30;
        row.projectedRemainingQuantity = row.availableQuantity - row.forecastSales30d;
        row.reorderStatus = row.minStock > 0 && row.quantity <= row.minStock
          ? "Dưới ngưỡng tồn tối thiểu"
          : row.averageDailySales > 0 && row.estimatedDaysRemaining <= 30
            ? "Có thể cần bổ sung trong 30 ngày"
            : row.minStock > 0 || row.averageDailySales > 0 ? "Chưa cần bổ sung theo ngưỡng hiện có" : "Chưa đủ dữ liệu để khuyến nghị";
      }
    }
    let ranked = filtered;
    if (reportType === "no-available-stock") ranked = filtered.filter(row => !row.hasBalanceRecord || row.availableQuantity <= 0);
    else if (reportType === "capital-ranking") ranked = [...filtered].sort((a, b) => b.inventoryValue - a.inventoryValue);
    else if (reportType === "stock-summary" || reportType === "product-summary" || reportType === "stability-assessment") ranked = [...filtered];
    else if (reportType === "product-capital") ranked = [...filtered];
    else if (reportType === "capital-over-threshold") {
      const threshold = Number(input.thresholdAmount);
      if (!Number.isFinite(threshold) || threshold <= 0) throw new AssistantError("Cần nêu ngưỡng tiền vốn tồn để lọc đúng mặt hàng.");
      ranked = filtered.filter(row => row.inventoryValue >= threshold).sort((a, b) => b.inventoryValue - a.inventoryValue);
    } else if (reportType === "highest-stock") ranked = [...filtered].sort((a, b) => b.availableQuantity - a.availableQuantity);
    else if (reportType === "lowest-stock") ranked = [...filtered].filter(row => row.quantity > 0).sort((a, b) => a.quantity - b.quantity);
    else if (reportType === "below-minimum") ranked = filtered.filter(row => row.minStock > 0 && row.quantity <= row.minStock).sort((a, b) => a.quantity - b.quantity);
    else if (reportType === "no-sales-with-stock") ranked = filtered.filter(row => row.quantity > 0 && row.soldQuantity === 0).sort((a, b) => b.quantity - a.quantity);
    else if (reportType === "days-cover") ranked = filtered.filter(row => row.averageDailySales > 0).sort((a, b) => a.estimatedDaysRemaining - b.estimatedDaysRemaining);
    else if (reportType === "slow-moving") ranked = filtered.filter(row => row.quantity > 0).sort((a, b) => (b.estimatedDaysRemaining ?? Number.POSITIVE_INFINITY) - (a.estimatedDaysRemaining ?? Number.POSITIVE_INFINITY));
    else if (reportType === "forecast-30d") ranked = [...filtered].sort((a, b) => b.forecastSales30d - a.forecastSales30d);
    else if (reportType === "reorder-status") ranked = filtered.sort((a, b) => a.estimatedDaysRemaining - b.estimatedDaysRemaining);
    else if (reportType === "reorder-within-14") ranked = filtered.filter(row => row.minStock > 0 && row.quantity <= row.minStock || row.estimatedDaysRemaining !== null && row.estimatedDaysRemaining <= 14).sort((a, b) => (a.estimatedDaysRemaining ?? 0) - (b.estimatedDaysRemaining ?? 0));
    else throw new AssistantError("Chưa xác định được dạng phân tích tồn kho.");
    const firstValue = reportType === "capital-ranking" ? ranked[0]?.inventoryValue
      : reportType === "highest-stock" ? ranked[0]?.availableQuantity
        : reportType === "lowest-stock" ? ranked[0]?.quantity : undefined;
    if (["capital-ranking", "highest-stock", "lowest-stock"].includes(reportType) && firstValue !== undefined) {
      const field = reportType === "capital-ranking" ? "inventoryValue" : reportType === "highest-stock" ? "availableQuantity" : "quantity";
      ranked = ranked.filter(row => row[field] === firstValue);
    }
    const summary = {
      productCount: filtered.length,
      stockQuantity: filtered.reduce((sum, row) => sum + row.quantity, 0),
      availableQuantity: filtered.reduce((sum, row) => sum + row.availableQuantity, 0),
      inventoryValue: filtered.reduce((sum, row) => sum + row.inventoryValue, 0),
      ...(needsSales ? { forecastSales30d: filtered.reduce((sum, row) => sum + row.forecastSales30d, 0) } : {}),
    };
    const finding = reportType === "no-available-stock" && !ranked.length ? "Không có sản phẩm nào thiếu số liệu tồn hoặc đang hết số lượng khả dụng ở chi nhánh này."
      : reportType === "stability-assessment"
      ? "Chưa có lịch sử tồn kho theo ngày để kết luận mặt hàng nào duy trì mức tồn ổn định. Bảng dưới đây thể hiện tồn hiện tại; có thể đối chiếu số tồn với ngưỡng tối thiểu và tốc độ bán."
      : reportType === "no-sales-with-stock" && !ranked.length ? "Không có dòng máy nào vừa còn tồn vừa không ghi nhận bán ròng trong kỳ." : undefined;
    return { success: true, data: { reportType, range: needsSales ? salesRange : { from, to }, summary, products: ranked.slice(0, 100), ...(finding ? { finding } : {}) } };
  }
  if (op.id === "inventory.receipt.analysis") {
    const reportType = String(input.reportType || "");
    const rows = await collectPages("inventory.receipt.list", {
      ...(input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch }),
      ...(input.from === undefined ? {} : { query_from: input.from }),
      ...(input.to === undefined ? {} : { query_to: input.to }),
      ...((input.search ?? input.q) === undefined ? {} : { query_q: input.search ?? input.q }),
    }, 100);
    const confirmed = rows.filter(row => row.status === "confirmed");
    const pending = rows.filter(row => ["draft", "pending", "receiving"].includes(String(row.status || "")));
    const receiptSummary = (row: any) => ({ receiptCode: row.receiptCode, supplierName: row.supplierName, status: row.status, subtotal: row.subtotal, createdAt: row.createdAt, receivedAt: row.receivedAt,
      productsSummary: Array.isArray(row.items) ? row.items.map((item: any) => `${Number(item.quantity) || 0} × ${item.productName || item.sku || "mặt hàng"}`).join("; ") : "" });
    const bySupplier = new Map<string, { supplierName: string; receiptCount: number; totalAmount: number }>();
    for (const row of confirmed) {
      const supplierName = String(row.supplierName || "Nhà cung cấp chưa ghi tên");
      const key = normalize(supplierName);
      const value = bySupplier.get(key) || { supplierName, receiptCount: 0, totalAmount: 0 };
      value.receiptCount += 1;
      value.totalAmount += Number(row.subtotal) || 0;
      bySupplier.set(key, value);
    }
    const suppliers = [...bySupplier.values()].sort((a, b) => b.totalAmount - a.totalAmount || a.supplierName.localeCompare(b.supplierName, "vi"));
    let receipts: any[] = [];
    if (reportType === "period-summary") receipts = confirmed.map(receiptSummary);
    else if (reportType === "supplier-spend") receipts = suppliers as any[];
    else if (reportType === "paid-total") receipts = confirmed.map(receiptSummary);
    else if (reportType === "top-supplier") receipts = suppliers.length ? [suppliers[0]] : [];
    else if (reportType === "largest-receipt") receipts = confirmed.length ? [receiptSummary([...confirmed].sort((a, b) => Number(b.subtotal || 0) - Number(a.subtotal || 0))[0])] : [];
    else if (reportType === "latest-receipt") receipts = confirmed.length ? [receiptSummary([...confirmed].sort((a, b) => String(b.receivedAt || b.createdAt || "").localeCompare(String(a.receivedAt || a.createdAt || "")))[0])] : [];
    else if (reportType === "pending-receipts") receipts = pending.map(receiptSummary);
    else throw new AssistantError("Chưa xác định được dạng thống kê phiếu nhập.");
    const paidRecords = confirmed.filter(row => Number.isFinite(Number(row.financeTerms?.paidAmount)));
    const summary = {
      receiptCount: confirmed.length,
      totalAmount: confirmed.reduce((sum, row) => sum + (Number(row.subtotal) || 0), 0),
      paidAmount: paidRecords.reduce((sum, row) => sum + (Number(row.financeTerms?.paidAmount) || 0), 0),
      paidRecordCount: paidRecords.length,
      unrecordedPaymentCount: confirmed.length - paidRecords.length,
    };
    return { success: true, data: { reportType, range: { from: input.from || "", to: input.to || "" }, summary, receipts: ["supplier-spend", "top-supplier"].includes(reportType) ? [] : receipts, suppliers: ["supplier-spend", "top-supplier"].includes(reportType) ? receipts : [], finding: receipts.length || suppliers.length ? undefined : "Không có phiếu nhập phù hợp trong phạm vi đã chọn." } };
  }
  if (op.id === "inventory.stock-log.analysis") {
    const reportType = String(input.reportType || "");
    if (reportType === "monthly-comparison") {
      const readPeriod = (from: AssistantValue | undefined, to: AssistantValue | undefined) => collectPages("inventory.stock-log.list", {
        ...(input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch }),
        ...(from === undefined ? {} : { createdFrom: from }),
        ...(to === undefined ? {} : { createdTo: to }),
      }, 1000);
      const [current, previous] = await Promise.all([
        readPeriod(input.createdFrom, input.createdTo),
        readPeriod(input.previousFrom, input.previousTo),
      ]);
      const summarizePeriod = (rows: Record<string, any>[], period: string, from: unknown, to: unknown) => {
        const outbound = rows.filter(row => row.type === "xuất");
        return { period, from: String(from || ""), to: String(to || ""), documentCount: outbound.length, totalQuantity: outbound.reduce((sum, row) => sum + (Array.isArray(row.items) ? row.items.reduce((lineTotal: number, item: any) => lineTotal + (Number(item.quantity) || 0), 0) : Number(row.quantity) || 0), 0) };
      };
      return { success: true, data: { reportType, range: { from: input.createdFrom || "", to: input.createdTo || "" }, summary: [summarizePeriod(current, "Kỳ hiện tại", input.createdFrom, input.createdTo), summarizePeriod(previous, "Kỳ trước", input.previousFrom, input.previousTo)], transactions: [], operators: [] } };
    }
    const searchByOperator = ["operator-ranking", "operator-history"].includes(reportType);
    const rows = await collectPages("inventory.stock-log.list", {
      ...(input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch }),
      ...(input.createdFrom === undefined ? {} : { createdFrom: input.createdFrom }),
      ...(input.createdTo === undefined ? {} : { createdTo: input.createdTo }),
    }, 1000);
    const search = normalize(String(input.search ?? input.q ?? ""));
    const eligibleRows = input.purpose ? rows.filter(row => normalize(String(row.purpose || "")) === normalize(String(input.purpose))) : rows;
    const matchesProduct = (row: any) => searchByOperator || !search || normalize(`${row.productName || ""} ${row.sku || ""} ${Array.isArray(row.items) ? row.items.map((item: any) => `${item.productName || ""} ${item.sku || ""}`).join(" ") : ""}`).includes(search);
    const records = eligibleRows.flatMap(row => {
      const lines = Array.isArray(row.items) ? row.items : [];
      const selected = lines.filter(matchesProduct);
      if (search && lines.length && !selected.length && !matchesProduct(row)) return [];
      const quantity = selected.length ? selected.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0) : Number(row.quantity) || 0;
      return [{ title: row.title, type: row.type, purpose: row.purpose, status: row.status, operatorName: row.operatorName, customerName: row.customerName, productName: selected.length ? [...new Set(selected.map((item: any) => String(item.productName || item.sku || "")))].join(", ") : row.productName, sku: selected.length ? [...new Set(selected.map((item: any) => String(item.sku || "")))].join(", ") : row.sku, quantity, createdAt: row.createdAt, notes: row.notes }];
    });
    let transactions = records;
    let operators: Array<{ operatorName: string; documentCount: number; totalQuantity: number }> = [];
    let summary: any[] = [];
    if (reportType === "issue-counts") {
      const issueRows = records.filter(row => row.type === "xuất");
      summary = ["bán", "nội bộ"].map(purpose => ({ documentType: purpose === "bán" ? "Phiếu xuất bán hàng" : "Phiếu xuất dùng nội bộ", documentCount: issueRows.filter(row => row.purpose === purpose).length, totalQuantity: issueRows.filter(row => row.purpose === purpose).reduce((sum, row) => sum + row.quantity, 0) }));
      transactions = [];
    } else if (reportType === "outbound-total") {
      const outbound = records.filter(row => row.type === "xuất");
      summary = [{ documentType: "Tổng phiếu xuất kho", documentCount: outbound.length, totalQuantity: outbound.reduce((sum, row) => sum + row.quantity, 0) }];
      transactions = outbound;
    } else if (reportType === "product-outbound" || reportType === "recipient-history" || reportType === "daily-flow") {
      transactions = reportType === "product-outbound" ? records.filter(row => row.type === "xuất")
      : reportType === "recipient-history" ? records.filter(row => row.type === "xuất")
          : records;
      if (reportType === "daily-flow") summary = [{ documentType: "Phiếu nhập/xuất", documentCount: records.length, totalQuantity: records.reduce((sum, row) => sum + row.quantity, 0) }];
    } else if (reportType === "pending-status") {
      transactions = records.filter(row => /(?:dang cho|cho duyet|chua hoan thanh|dang xuat|xuat do|dang xu ly|pending|draft|processing)/u.test(normalize(String(row.status || ""))));
    } else if (reportType === "operator-ranking" || reportType === "operator-history") {
      const selectedOperators = records.filter(row => String(row.operatorName || "").trim() && (!search || normalize(String(row.operatorName || "")).includes(search)));
      const byOperator = new Map<string, { operatorName: string; documentCount: number; totalQuantity: number }>();
      for (const row of selectedOperators) {
        const operatorName = String(row.operatorName).trim();
        const key = normalize(operatorName);
        const current = byOperator.get(key) || { operatorName, documentCount: 0, totalQuantity: 0 };
        current.documentCount += 1;
        current.totalQuantity += Number(row.quantity) || 0;
        byOperator.set(key, current);
      }
      operators = [...byOperator.values()].sort((a, b) => b.documentCount - a.documentCount || a.operatorName.localeCompare(b.operatorName, "vi"));
      if (reportType === "operator-ranking") {
        const highest = operators[0]?.documentCount;
        operators = highest === undefined ? [] : operators.filter(row => row.documentCount === highest);
        transactions = [];
      } else transactions = selectedOperators;
    } else if (reportType === "flow-reconciliation") {
      const outbound = records.filter(row => row.type === "xuất");
      const receiptRows = await collectPages("inventory.receipt.list", { ...(input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch }), query_status: "confirmed", ...(input.createdFrom === undefined ? {} : { query_from: input.createdFrom }), ...(input.createdTo === undefined ? {} : { query_to: input.createdTo }) }, 100);
      const inboundQuantity = receiptRows.reduce((total, receipt) => total + (Array.isArray(receipt.items) ? receipt.items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0) : 0), 0);
      let sold = 0;
      if (input.createdFrom || input.createdTo) {
        const retailReport = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "retail.report.summary");
        const retailResponse = retailReport ? await callOperation(req, retailReport, { ...(input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch }), ...(input.createdFrom === undefined ? {} : { query_from: input.createdFrom }), ...(input.createdTo === undefined ? {} : { query_to: input.createdTo }) }, password, requestId) : null;
        sold = Array.isArray(retailResponse?.data?.products) ? retailResponse.data.products.reduce((sum: number, item: any) => sum + Math.max(0, Number(item.netQuantity) || 0), 0) : 0;
      } else {
        const orderRows = await collectPages("retail.order.list", { ...(input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch }) }, 100);
        sold = orderRows.filter(row => ["confirmed", "completed"].includes(String(row.status || "")))
          .reduce((sum, row) => sum + (Array.isArray(row.items) ? row.items.reduce((lineTotal: number, item: any) => lineTotal + Math.max(0, Number(item.quantity) || 0), 0) : 0), 0);
      }
      summary = [{ documentType: "Tổng biến động trong kỳ", documentCount: records.length, inboundQuantity, posQuantity: sold, internalQuantity: outbound.filter(row => row.purpose === "nội bộ").reduce((sum, row) => sum + row.quantity, 0), totalQuantity: outbound.reduce((sum, row) => sum + row.quantity, 0) }];
      transactions = [];
    } else throw new AssistantError("Chưa xác định được dạng thống kê giao dịch kho.");
    const finding = reportType.startsWith("operator") && !operators.length && !transactions.some(row => row.operatorName)
      ? "Phiếu kho trong phạm vi hiện tại không có tên người lập để xếp hạng." : undefined;
    return { success: true, data: { reportType, range: { from: input.createdFrom || "", to: input.createdTo || "" }, summary, transactions: transactions.slice(0, 100), operators, ...(finding ? { finding } : {}) } };
  }
  if (op.id === "inventory.transfer.analysis") {
    const reportType = String(input.reportType || "");
    const rows = await collectPages("inventory.transfer.list", {
      ...(input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch }),
      ...(input.status === undefined ? {} : { query_status: input.status }),
      ...(input.from === undefined ? {} : { query_from: input.from }),
      ...(input.to === undefined ? {} : { query_to: input.to }),
    }, 500);
    const fromWarehouse = normalize(String(input.fromWarehouseName || ""));
    const toWarehouse = normalize(String(input.toWarehouseName || ""));
    const product = normalize(String(input.search || ""));
    const filtered = rows.filter(row => (!fromWarehouse || normalize(String(row.fromWarehouseName || "")).includes(fromWarehouse))
      && (!toWarehouse || normalize(String(row.toWarehouseName || "")).includes(toWarehouse))
      && (!product || normalize(Array.isArray(row.items) ? row.items.map((item: any) => `${item.productName || ""} ${item.sku || ""}`).join(" ") : "").includes(product)));
    const ordered = [...filtered].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const summary = {
      transferCount: filtered.length,
      inTransitCount: filtered.filter(row => row.status === "in_transit").length,
      receivedCount: filtered.filter(row => row.status === "received").length,
      cancelledCount: filtered.filter(row => row.status === "cancelled").length,
    };
    const selected = reportType === "latest-to-warehouse" ? ordered.slice(0, 1) : reportType === "period-summary" ? [] : ordered;
    const transfers = selected.slice(0, 100).map(row => ({
      transferCode: row.transferCode || row.code,
      status: row.status,
      reason: row.reason,
      fromWarehouseName: row.fromWarehouseName,
      toWarehouseName: row.toWarehouseName,
      createdAt: row.createdAt,
      items: Array.isArray(row.items) ? row.items.map((item: any) => ({ productName: item.productName, sku: item.sku, quantity: item.quantity })) : [],
    }));
    return { success: true, data: { reportType, range: { from: input.from || "", to: input.to || "" }, summary, transfers, finding: rows.length ? undefined : "Không có phiếu điều chuyển phù hợp trong phạm vi đã chọn." } };
  }
  if (op.id === "inventory.serial.analysis") {
    const reportType = String(input.reportType || "");
    const all = await collectPages("inventory.serial.list", {
      ...(input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch }),
      ...(input.warehouseId === undefined ? {} : { query_warehouseId: input.warehouseId }),
      ...(["identifier-detail", "identifier-history"].includes(reportType) && input.search !== undefined ? { query_serial: input.search } : {}),
      query_trackingMode: "serial",
    }, 100);
    if (["identifier-detail", "identifier-history"].includes(reportType)) {
      const identifier = normalize(String(input.search || ""));
      const serial = all.find(row => normalize(String(row.serialNumber || "")) === identifier || normalize(String(row.internalBarcode || "")) === identifier);
      if (!serial) return { success: true, data: { reportType, serialNumber: String(input.search || ""), finding: `Không tìm thấy IMEI/serial ${String(input.search || "")} trong phạm vi chi nhánh hiện tại.` } };
      const summary = { serialNumber: serial.serialNumber, productName: serial.productName, sku: serial.sku, status: serial.status, warehouseName: serial.warehouseName, soldAt: serial.soldAt };
      if (reportType === "identifier-detail") return { success: true, data: { reportType, ...summary } };
      const historyOperation = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "inventory.serial.history");
      if (!historyOperation) throw new AssistantError("Thiếu nguồn tra cứu lịch sử IMEI/serial.", 503);
      const historyResponse = await callOperation(req, historyOperation, {
        path_id: String(serial._id || serial.id || ""),
        ...(input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch }),
      }, password, requestId);
      const events = rawRecords(historyResponse).map(event => ({ eventType: event.eventType, fromStatus: event.fromStatus, toStatus: event.toStatus, reason: event.reason, occurredAt: event.occurredAt, actorName: event.actorName }));
      return { success: true, data: { reportType, ...summary, events, finding: events.length ? undefined : "Đã tìm thấy máy nhưng hệ thống chưa ghi nhận sự kiện lịch sử." } };
    }
    const search = normalize(String(input.search || ""));
    const selected = search ? all.filter(row => normalize(`${row.productName || ""} ${row.sku || ""}`).includes(search)) : all;
    const statusFields: Record<string, string> = { in_stock: "inStock", sold: "sold", repairing: "repairing", defective: "defective", in_transit: "inTransit", internal_use: "internalUse", returned: "returned", scrapped: "scrapped", lost: "lost" };
    const summarize = (rows: Record<string, any>[]) => {
      const summary: Record<string, number> = { total: rows.length, inStock: 0, sold: 0, repairing: 0, defective: 0, inTransit: 0, internalUse: 0, returned: 0, scrapped: 0, lost: 0 };
      for (const row of rows) { const key = statusFields[String(row.status || "")]; if (key) summary[key] += 1; }
      return summary;
    };
    if (reportType === "product-stock-and-serial") {
      const balanceOperation = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "inventory.warehouse.balances.list");
      if (!balanceOperation) throw new AssistantError("Thiếu nguồn tra cứu tồn kho.", 503);
      const balanceResponse = await callOperation(req, balanceOperation, {
        ...(input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch }),
        ...(input.warehouseId === undefined ? {} : { query_warehouseId: input.warehouseId }),
        ...(input.search === undefined ? {} : { query_q: input.search }),
        query_includeCatalogZeroBalances: "true",
      }, password, requestId);
      const productName = selected[0]?.productName || rawRecords(balanceResponse)[0]?.productName || String(input.search || "");
      const nameKey = normalize(String(productName));
      const availableQuantity = rawRecords(balanceResponse).filter(row => normalize(String(row.productName || "")) === nameKey)
        .reduce((sum, row) => sum + (Number(row.availableQuantity) || 0), 0);
      const serialSummary = summarize(selected);
      return { success: true, data: { reportType, productName, summary: { ...serialSummary, skuAvailableQuantity: availableQuantity }, products: [{ productName, skuAvailableQuantity: availableQuantity, total: serialSummary.total, inStock: serialSummary.inStock, repairing: serialSummary.repairing, defective: serialSummary.defective }], devices: [] } };
    }
    const byProduct = new Map<string, Record<string, any>[]>();
    for (const row of selected) {
      const name = String(row.productName || "").trim();
      if (!name) continue;
      const key = normalize(name);
      byProduct.set(key, [...(byProduct.get(key) || []), row]);
    }
    const products = ([...byProduct.values()].map(rows => ({ productName: String(rows[0]?.productName || ""), ...summarize(rows) })) as Array<Record<string, any>>).sort((a, b) => b.total - a.total || a.productName.localeCompare(b.productName, "vi"));
    if (reportType === "reconciliation") {
      const balanceOperation = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "inventory.warehouse.balances.list");
      if (!balanceOperation) throw new AssistantError("Thiếu dữ liệu tồn kho để đối chiếu số IMEI.", 503);
      const balanceResponse = await callOperation(req, balanceOperation, {
        ...(input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch }),
        ...(input.warehouseId === undefined ? {} : { query_warehouseId: input.warehouseId }),
        ...(input.search === undefined ? {} : { query_q: input.search }),
        query_includeCatalogZeroBalances: "true",
      }, password, requestId);
      const quantities = new Map<string, { productName: string; quantity: number }>();
      for (const row of rawRecords(balanceResponse)) {
        const sku = String(row.sku || "").trim();
        if (!sku) continue;
        const current = quantities.get(sku) || { productName: String(row.productName || ""), quantity: 0 };
        current.quantity += Number(row.quantity) || 0;
        quantities.set(sku, current);
      }
      const serialCounts = new Map<string, { productName: string; total: number; inStock: number; repairing: number; defective: number }>();
      for (const row of selected) {
        const sku = String(row.sku || "").trim();
        if (!sku) continue;
        const current = serialCounts.get(sku) || { productName: String(row.productName || ""), total: 0, inStock: 0, repairing: 0, defective: 0 };
        current.total += 1;
        if (row.status === "in_stock") current.inStock += 1;
        if (row.status === "repairing") current.repairing += 1;
        if (row.status === "defective") current.defective += 1;
        serialCounts.set(sku, current);
      }
      const skuSet = new Set([...quantities.keys(), ...serialCounts.keys()]);
      const reconciled = [...skuSet].map(sku => {
        const quantity = quantities.get(sku);
        const serial = serialCounts.get(sku);
        const physicalQuantity = quantity?.quantity || 0;
        const inStock = serial?.inStock || 0;
        return { productName: quantity?.productName || serial?.productName || "", sku, total: serial?.total || 0, inStock, repairing: serial?.repairing || 0, defective: serial?.defective || 0, physicalQuantity, variance: inStock - physicalQuantity, matches: inStock === physicalQuantity };
      }).sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance) || a.productName.localeCompare(b.productName, "vi") || a.sku.localeCompare(b.sku, "vi"));
      const variance = reconciled.reduce((sum, row) => sum + row.variance, 0);
      const matchedSkuCount = reconciled.filter(row => row.matches).length;
      const mismatchedSkuCount = reconciled.length - matchedSkuCount;
      return { success: true, data: { reportType, summary: { total: selected.length, inStock: selected.filter(row => row.status === "in_stock").length, repairing: selected.filter(row => row.status === "repairing").length, defective: selected.filter(row => row.status === "defective").length, physicalQuantity: reconciled.reduce((sum, row) => sum + row.physicalQuantity, 0), variance, matches: matchedSkuCount, mismatches: mismatchedSkuCount }, products: reconciled } };
    }
    const devices = reportType === "repair-list" ? selected.filter(row => ["repairing", "defective"].includes(String(row.status || "")))
      : reportType === "available-list" ? selected.filter(row => row.status === "in_stock") : [];
    const deviceRows = devices.map(row => ({ productName: row.productName, serialNumber: row.serialNumber, sku: row.sku, status: row.status, createdAt: row.createdAt, warehouseName: row.warehouseName }));
    return { success: true, data: { reportType, summary: summarize(selected), products: ["product-status-counts", "reconciliation"].includes(reportType) ? products : [], devices: deviceRows } };
  }
  const branchFromInput = () => input.targetBranch ?? input.branchId;
  const dateInput = () => ({
    ...(branchFromInput() === undefined ? {} : { targetBranch: branchFromInput() }),
    ...(input.from === undefined ? (input.query_from === undefined ? {} : { query_from: input.query_from }) : { query_from: input.from }),
    ...(input.to === undefined ? (input.query_to === undefined ? {} : { query_to: input.query_to }) : { query_to: input.to }),
  });
  if (op.id === "retail.report.margin-watch") {
    const source = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "retail.report.summary")!;
    const response = await callOperation(req, source, dateInput(), password, requestId);
    const data = response?.data && typeof response.data === "object" ? response.data : {};
    const products = Array.isArray(data.products) ? data.products : [];
    const threshold = Math.max(0, Math.min(100, Number(input.marginThresholdPercent) || 10));
    const belowCost = products.filter((row: any) => Number.isFinite(Number(row.profit)) && Number(row.profit) < 0)
      .map((row: any) => ({ productName: row.productName, sku: row.sku, netSales: row.netSales, profit: row.profit }));
    const lowMargin = products.filter((row: any) => Number.isFinite(Number(row.profit)) && Number(row.profit) >= 0
      && Number(row.netSales) > 0 && Number(row.profit) / Number(row.netSales) * 100 < threshold)
      .map((row: any) => ({ productName: row.productName, sku: row.sku, netSales: row.netSales, profit: row.profit, marginPercent: Number(row.profit) / Number(row.netSales) * 100 }));
    const missingCost = products.filter((row: any) => !Number.isFinite(Number(row.profit))).map((row: any) => ({ productName: row.productName, sku: row.sku }));
    return { success: true, data: { range: data.range, thresholdPercent: threshold, belowCost, lowMargin, missingCost } };
  }
  if (op.id === "retail.shift.variance-report") {
    const shifts = await collectPages("retail.shift.list", {
      ...(branchFromInput() === undefined ? {} : { targetBranch: branchFromInput() }),
      ...(input.query_from === undefined ? {} : { query_from: input.query_from }),
      ...(input.query_to === undefined ? {} : { query_to: input.query_to }),
      query_status: "closed",
    });
    const matched = shifts.filter(row => ["closed", "reconciled"].includes(String(row.status || "").toLowerCase())
      && Number.isFinite(Number(row.varianceAmount)) && Number(row.varianceAmount) !== 0)
      .map(row => ({ shiftCode: row.shiftCode, cashierName: row.cashierName, businessDate: row.businessDate, expectedCash: row.expectedCash, countedCash: row.countedCash, varianceAmount: row.varianceAmount, varianceReason: row.varianceReason }))
      .sort((left, right) => String(right.businessDate || "").localeCompare(String(left.businessDate || "")));
    return { success: true, data: { from: input.query_from, to: input.query_to, shifts: matched } };
  }
  if (op.id === "retail.shift.latest-close-report") {
    const shifts = await collectPages("retail.shift.list", { ...(branchFromInput() === undefined ? {} : { targetBranch: branchFromInput() }), query_status: "closed" });
    const latest = shifts.filter(row => ["closed", "reconciled"].includes(String(row.status || "").toLowerCase()))
      .sort((left, right) => String(right.businessDate || "").localeCompare(String(left.businessDate || ""))
        || String(right.closedAt || right.openedAt || "").localeCompare(String(left.closedAt || left.openedAt || "")))[0];
    if (!latest) return { success: true, data: { shift: null, cashExpenses: [], cashbookEntriesAvailable: true } };
    const shiftId = String(latest._id || latest.id || latest.__assistantRef?.id || "");
    let detail = latest;
    const detailOperation = ASSISTANT_OPERATIONS.find(candidate => candidate.path === "/retail/shifts/:id" && candidate.method === "GET");
    if (shiftId && detailOperation) {
      const detailPath = detailOperation.fields.find(field => field.source === "path");
      if (detailPath) {
        const detailResponse = await callOperation(req, detailOperation, { [detailPath.key]: shiftId }, password, requestId);
        detail = detailResponse?.data?.shift || detailResponse?.data || latest;
      }
    }
    const cashbook = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "retail.finance.cashbook.list")!;
    const cashResponse = await callOperation(req, cashbook, { ...dateInput(), query_from: String(latest.businessDate || ""), query_to: String(latest.businessDate || "") }, password, requestId);
    const entries = Array.isArray(cashResponse?.data?.entries) ? cashResponse.data.entries : [];
    return { success: true, data: {
      shift: { shiftCode: detail.shiftCode, cashierName: detail.cashierName, status: detail.status, businessDate: detail.businessDate,
        openingFloat: detail.openingFloat, grossSales: detail.grossSales, expectedCash: detail.expectedCash, countedCash: detail.countedCash, varianceAmount: detail.varianceAmount },
      cashExpenses: entries.filter((entry: any) => entry.direction === "out" && entry.account === "cash").map((entry: any) => ({ businessDate: entry.businessDate, amount: entry.amount, description: entry.description })),
      cashbookEntriesAvailable: true,
    } };
  }
  if (op.id === "retail.after-sale.customer-return-summary") {
    const rows = await collectPages("retail.after-sale.list", { ...dateInput(), query_type: "return" });
    const returns = rows.filter(row => row.type === "return" && row.status === "completed");
    const customers = new Set(returns.map(row => String(row.customerName || "").trim().toLocaleLowerCase("vi")).filter(Boolean));
    return { success: true, data: { range: { from: input.from, to: input.to }, customerCount: customers.size, returnCount: returns.length,
      refundTotal: returns.reduce((sum, row) => sum + Math.max(0, Number(row.totalAmount) || 0), 0) } };
  }
  if (op.id === "retail.after-sale.return-product-analysis") {
    const rows = await collectPages("retail.after-sale.list", { ...dateInput(), query_type: "return" });
    const returns = rows.filter(row => row.type === "return" && row.status === "completed");
    const products = new Map<string, { productName: string; returnedQuantity: number; returnCount: number }>();
    const reasons = new Map<string, number>();
    for (const row of returns) {
      const reason = String(row.reason || "").trim();
      if (reason) reasons.set(reason, (reasons.get(reason) || 0) + 1);
      const summary = String(row.itemsSummary || "");
      for (const item of summary.split(/;\s*/).filter(Boolean)) {
        const match = item.match(/^\s*(\d+(?:\.\d+)?)\s*[×x]\s*(.+?)(?:\s+\([^)]*\))?\s*$/u);
        if (!match) continue;
        const productName = match[2].trim();
        const aggregate = products.get(productName) || { productName, returnedQuantity: 0, returnCount: 0 };
        aggregate.returnedQuantity += Number(match[1]) || 0;
        aggregate.returnCount += 1;
        products.set(productName, aggregate);
      }
    }
    const ranked = [...products.values()].sort((left, right) => right.returnedQuantity - left.returnedQuantity || left.productName.localeCompare(right.productName));
    return { success: true, data: { range: { from: input.from, to: input.to }, products: ranked.slice(0, 10), reasons: [...reasons].map(([reason, count]) => ({ reason, count })).sort((left, right) => right.count - left.count), returnCount: returns.length } };
  }
  if (op.id === "retail.order.installment-balances") {
    const rows = await collectPages("retail.order.list", { ...dateInput() });
    const orders = rows.filter(row => row.status === "completed" && Number(row.dueAmount) > 0)
      .map(row => ({ orderCode: row.orderCode, customerName: row.customerName, businessDate: row.businessDate, grandTotal: row.grandTotal, paidAmount: row.paidAmount, dueAmount: row.dueAmount }))
      .sort((left, right) => Number(right.dueAmount) - Number(left.dueAmount));
    return { success: true, data: { range: { from: input.query_from, to: input.query_to }, orders, installmentTypeTracked: false } };
  }
  if (op.id === "retail.order.debt-ranking") {
    const source = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "finance.debt.list")!;
    const response = await callOperation(req, source, { ...(branchFromInput() === undefined ? {} : { targetBranch: branchFromInput() }) }, password, requestId);
    const rows = rawRecords(response).filter(row => Number(row.balance) > 0 && (!row.partyKind || /customer|khach/i.test(String(row.partyKind)))
      && (!row.direction || /receivable|phai thu/i.test(String(row.direction))));
    const byCustomer = new Map<string, { customerName: string; balance: number }>();
    for (const row of rows) {
      const name = String(row.partyName || "Khách hàng chưa ghi tên");
      const key = normalize(name);
      const value = byCustomer.get(key) || { customerName: name, balance: 0 };
      value.balance += Number(row.balance) || 0;
      byCustomer.set(key, value);
    }
    const highestBalance = [...byCustomer.values()].sort((left, right) => right.balance - left.balance)[0] || null;
    const overdueRows = rows.filter(row => Number(row.daysOverdue) > 0).sort((left, right) => Number(right.daysOverdue) - Number(left.daysOverdue));
    const oldest = overdueRows[0];
    return { success: true, data: { highestBalance, oldestOverdue: oldest ? { customerName: oldest.partyName, reference: oldest.reference, balance: oldest.balance, daysOverdue: oldest.daysOverdue } : null, overdueAgeAvailable: rows.some(row => Number.isFinite(Number(row.daysOverdue))) } };
  }
  if (op.id === "retail.report.employee-cancelled-cash-variance") {
    const [orders, shifts] = await Promise.all([
      collectPages("retail.order.list", dateInput()),
      collectPages("retail.shift.list", dateInput()),
    ]);
    const cancelled = orders.filter(row => ["cancelled", "canceled"].includes(String(row.status || "").toLowerCase()));
    const cancellationsByEmployee = new Map<string, { employeeName: string; cancelledOrders: number }>();
    for (const order of cancelled) {
      const employeeName = String(order.cancelledByName || order.cancelledByDisplayName || "").trim();
      if (!employeeName) continue;
      const key = normalize(employeeName);
      const value = cancellationsByEmployee.get(key) || { employeeName, cancelledOrders: 0 };
      value.cancelledOrders += 1;
      cancellationsByEmployee.set(key, value);
    }
    const cancellationLeader = [...cancellationsByEmployee.values()]
      .sort((left, right) => right.cancelledOrders - left.cancelledOrders || left.employeeName.localeCompare(right.employeeName))[0] || null;
    const varianceByCashier = new Map<string, { cashierName: string; shiftCount: number; totalAbsoluteVariance: number; netVariance: number }>();
    for (const shift of shifts) {
      if (!["closed", "reconciled"].includes(String(shift.status || "").toLowerCase())) continue;
      const variance = Number(shift.varianceAmount);
      if (!Number.isFinite(variance) || variance === 0) continue;
      const cashierName = String(shift.cashierName || "").trim();
      if (!cashierName) continue;
      const key = normalize(cashierName);
      const value = varianceByCashier.get(key) || { cashierName, shiftCount: 0, totalAbsoluteVariance: 0, netVariance: 0 };
      value.shiftCount += 1;
      value.totalAbsoluteVariance += Math.abs(variance);
      value.netVariance += variance;
      varianceByCashier.set(key, value);
    }
    const varianceLeader = [...varianceByCashier.values()]
      .sort((left, right) => right.totalAbsoluteVariance - left.totalAbsoluteVariance || left.cashierName.localeCompare(right.cashierName))[0] || null;
    return { success: true, data: { range: { from: input.from || input.query_from, to: input.to || input.query_to }, cancellationLeader, varianceLeader,
      unattributedCancelledOrders: cancelled.length - [...cancellationsByEmployee.values()].reduce((sum, row) => sum + row.cancelledOrders, 0) } };
  }
  if (["retail.customer.purchase-warranty-summary", "retail.customer.profile-summary"].includes(op.id)) {
    const customerQuery = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "customer.list")!;
    const queryValue = String(input.path_phone || input.query_q || input.query_search || "").trim();
    const customerResponse = await callOperation(req, customerQuery, { query_q: queryValue, query_status: "active", query_page: 1, query_limit: 100 }, password, requestId);
    const customers = rawRecords(customerResponse);
    const customerName = (row: Record<string, any>) => String(row.name || row.fullName || row.customerName || row.displayName || "");
    const branchHeader = req.headers?.["x-branch-id"] || req.headers?.["X-Branch-Id"];
    const selectedBranch = String(input.targetBranch || input.branchId || req.user?.branchId || branchHeader || "");
    const branchScopedCustomers = selectedBranch && customers.some(row => row.branchId)
      ? customers.filter(row => String(row.branchId || "") === selectedBranch)
      : customers;
    const matched = branchScopedCustomers.filter(row => normalize(String(row.phone || row.normalizedPhone || "")) === normalize(queryValue)
      || normalize(customerName(row)) === normalize(queryValue)
      || (queryValue.replace(/\D/g, "").length >= 8 && String(row.phone || "").replace(/\D/g, "").endsWith(queryValue.replace(/\D/g, ""))));
    if (matched.length !== 1) return { success: true, data: { found: false, matches: matched.slice(0, 5).map(row => ({ customerName: customerName(row), phone: row.phone })), ambiguous: matched.length > 1 } };
    const customer = matched[0];
    const result: Record<string, any> = { found: true, customerName: customerName(customer) };
    if (op.id === "retail.customer.purchase-warranty-summary") {
      const history = ASSISTANT_OPERATIONS.find(candidate => candidate.path === "/customers/:id/purchase-history" && candidate.method === "GET");
      if (history) {
        const pathField = history.fields.find(field => field.source === "path")!;
        const purchase = await callOperation(req, history, { [pathField.key]: String(customer._id || customer.id) }, password, requestId);
        const data = purchase?.data && typeof purchase.data === "object" ? purchase.data : {};
        const summary = data.summary && typeof data.summary === "object" ? data.summary : {};
        result.orderCount = Number(summary.orderCount) || 0;
        result.totalPurchased = Number(summary.totalPurchased) || 0;
        result.currentDebt = Number(summary.currentDebt) || 0;
        result.orders = Array.isArray(data.items) ? data.items.filter((row: any) => !["cancelled", "canceled"].includes(String(row.status || "").toLowerCase()))
          .map((row: any) => ({ orderCode: row.orderCode, status: row.status, businessDate: row.businessDate, grandTotal: row.grandTotal, itemCount: row.itemCount })) : [];
        result.warrantyDevices = Array.isArray(data.devices) ? data.devices.map((row: any) => ({ productName: row.productName, orderCode: row.orderCode, soldAt: row.soldAt, warrantyStartAt: row.warrantyStartAt, warrantyEndAt: row.warrantyEndAt })) : [];
      }
      result.warrantyRequestsAvailable = false;
      return { success: true, data: result };
    }
    const detailOperation = ASSISTANT_OPERATIONS.find(candidate => candidate.path === "/customers/:id" && candidate.method === "GET");
    const historyOperation = ASSISTANT_OPERATIONS.find(candidate => candidate.path === "/customers/:id/purchase-history" && candidate.method === "GET");
    const customerId = String(customer._id || customer.id || "");
    const detailField = detailOperation?.fields.find(field => field.source === "path");
    const historyField = historyOperation?.fields.find(field => field.source === "path");
    const [detail, history] = await Promise.all([
      detailOperation && detailField ? callOperation(req, detailOperation, { [detailField.key]: customerId }, password, requestId) : null,
      historyOperation && historyField ? callOperation(req, historyOperation, { [historyField.key]: customerId }, password, requestId) : null,
    ]);
    const customerDetail = detail?.data || customer;
    result.tier = customerDetail.tierName || customerDetail.tier?.name || customer.tier?.name || customer.tier?.code || "Chưa xếp hạng";
    result.totalSpent = Number(history?.data?.summary?.totalPurchased ?? history?.data?.summary?.totalSpent ?? customer.tierTotalSales ?? 0);
    result.unusedCoupons = [];
    result.couponUsageStatusAvailable = false;
    return { success: true, data: result };
  }
  if (op.id === "retail.partner.supplier-dealer-directory") {
    const source = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "retail.partner.list")!;
    const response = await callOperation(req, source, {}, password, requestId);
    const partners = new Map<string, { name: string; phone?: string; role: string }>();
    for (const row of rawRecords(response)) {
      if (row.status && String(row.status).toLowerCase() !== "active") continue;
      const roles = Array.isArray(row.roles) ? row.roles : [row.role || row.type];
      const role = roles.map((value: unknown) => String(value).toLowerCase()).find((value: string) => ["supplier", "dealer"].includes(value));
      if (!role || typeof row.name !== "string" || !row.name.trim()) continue;
      const phone = typeof row.phone === "string" ? row.phone : undefined;
      const key = `${role}:${normalize(row.name)}:${String(phone || "").replace(/\D/g, "")}`;
      if (!partners.has(key)) partners.set(key, { name: row.name, ...(phone ? { phone } : {}), role });
    }
    return { success: true, data: { partners: [...partners.values()].map(({ role, ...partner }) => ({ ...partner, partnerType: role })) } };
  }
  if (op.id === "retail.finance.cashbook.expense-report") {
    const source = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "retail.finance.cashbook.list")!;
    const response = await callOperation(req, source, { ...dateInput() }, password, requestId);
    const data = response?.data && typeof response.data === "object" ? response.data : {};
    const expenses = (Array.isArray(data.entries) ? data.entries : []).filter((row: any) => row.direction === "out")
      .map((row: any) => ({ businessDate: row.businessDate, amount: row.amount, description: row.description, account: row.account }));
    return { success: true, data: { range: { from: input.from, to: input.to }, expenses, total: expenses.reduce((sum: number, row: any) => sum + Math.max(0, Number(row.amount) || 0), 0) } };
  }
  if (op.id === "retail.report.business-overview") {
    const summaryOperation = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "retail.report.summary")!;
    const orderOperation = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "retail.order.list")!;
    const afterSaleOperation = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "retail.after-sale.list")!;
    const commissionOperation = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "api.get.78da159ec226e07e");
    const summaryResponse = await callOperation(req, summaryOperation, dateInput(), password, requestId);
    const range = { from: String(input.from || input.query_from || ""), to: String(input.to || input.query_to || "") };
    const [orders, returns, commissionResponse] = await Promise.all([
      collectPages(orderOperation.id, { ...dateInput() }),
      collectPages(afterSaleOperation.id, { ...dateInput(), query_type: "return" }),
      commissionOperation ? callOperation(req, commissionOperation, { ...range, ...(branchFromInput() === undefined ? {} : { targetBranch: branchFromInput() }), analysis: JSON.stringify({ aggregate: { operation: "sum", field: "commission" } }) }, password, requestId) : null,
    ]);
    const summary = summaryResponse?.data?.summary || {};
    const commissionRows = rawRecords(commissionResponse);
    const commissionTotal = commissionRows.reduce((sum, row) => sum + Math.max(0, Number(row.commission) || 0), 0);
    const returnRows = returns.filter(row => row.type === "return" && row.status === "completed");
    return { success: true, data: { range, grossSales: summary.grossSales, grossProfit: summary.grossProfit,
      cancelledOrders: orders.filter(row => row.status === "cancelled" || row.status === "canceled").length,
      returns: { count: returnRows.length, amount: returnRows.reduce((sum, row) => sum + Math.max(0, Number(row.totalAmount) || 0), 0) },
      customerDebt: Number(summary.dueAmount ?? summary.debt?.totalDebt ?? 0), collaboratorCommission: commissionTotal } };
  }
  if (op.id === "retail.order.invoice-debt-exceptions") {
    const orders = await collectPages("retail.order.list", { ...dateInput() });
    const invoicesOperation = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "retail.invoice.list")!;
    const invoices = await collectPages(invoicesOperation.id, { ...dateInput() });
    const invoicedOrders = new Set(invoices.filter(row => row.status === "issued").map(row => String(row.orderCode || "")));
    const exceptions = orders.filter(row => row.status === "completed" && (!invoicedOrders.has(String(row.orderCode || "")) || Number(row.dueAmount) > 0))
      .map(row => ({ orderCode: row.orderCode, customerName: row.customerName, grandTotal: row.grandTotal, dueAmount: row.dueAmount, invoiceIssued: invoicedOrders.has(String(row.orderCode || "")), businessDate: row.businessDate }));
    return { success: true, data: { orders: exceptions, total: exceptions.length } };
  }
  if (op.id === "retail.order.warranty-match") {
    const orders = await collectPages("retail.order.list", { ...dateInput() });
    const exactTotal = Number(input.exactTotal) || 0;
    const matches = orders.filter(row => row.status === "completed" && Number(row.grandTotal) === exactTotal);
    const warrantyOperation = ASSISTANT_OPERATIONS.find(candidate => candidate.path === "/retail/warranty/orders" && candidate.method === "GET");
    const warrantyItems = warrantyOperation ? rawRecords(await callOperation(req, warrantyOperation, { ...(branchFromInput() === undefined ? {} : { targetBranch: branchFromInput() }), status: "all", page: 1, limit: 100 }, password, requestId)) : [];
    return { success: true, data: { range: { from: input.query_from, to: input.query_to }, exactTotal,
      matches: matches.map(order => ({ orderCode: order.orderCode, customerName: order.customerName, businessDate: order.businessDate, grandTotal: order.grandTotal,
        warrantyDevices: warrantyItems.filter((device: any) => device.orderCode === order.orderCode).map((device: any) => ({ productName: device.productName, warrantyEndAt: device.warrantyEndAt, status: device.status })) })) } };
  }
  if (op.id === "retail.after-sale.warranty-audit") {
    const range = { from: String(input.from || ""), to: String(input.to || "") };
    const orders = await collectPages("retail.order.list", { targetBranch: branchFromInput() as any, query_from: range.from, query_to: range.to });
    const returns = await collectPages("retail.after-sale.list", { targetBranch: branchFromInput() as any, query_type: "return" });
    const orderCodes = new Set(orders.map(row => String(row.orderCode || "")));
    const matchingReturns = returns.filter(row => row.type === "return" && orderCodes.has(String(row.orderCode || "")));
    const warrantyOperation = ASSISTANT_OPERATIONS.find(candidate => candidate.path === "/retail/warranty/orders" && candidate.method === "GET");
    const warrantyItems = warrantyOperation ? await collectPages(warrantyOperation.id, { ...(branchFromInput() === undefined ? {} : { targetBranch: branchFromInput() }), status: "all" }) : [];
    const matchingDevices = warrantyItems.filter(row => orderCodes.has(String(row.orderCode || ""))).map(row => ({ orderCode: row.orderCode, productName: row.productName, warrantyEndAt: row.warrantyEndAt, status: row.status }));
    return { success: true, data: { range, returns: matchingReturns.map(row => ({ code: row.code, orderCode: row.orderCode, customerName: row.customerName, totalAmount: row.totalAmount, reason: row.reason })), warrantyDevices: matchingDevices, warrantyRequestsAvailable: false } };
  }
  if (op.id === "retail.report.top-products-return-status") {
    const summary = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "retail.report.summary")!;
    const summaryResponse = await callOperation(req, summary, dateInput(), password, requestId);
    const data = summaryResponse?.data && typeof summaryResponse.data === "object" ? summaryResponse.data : {};
    const products = (Array.isArray(data.products) ? data.products : []).map((row: any) => ({ productName: row.productName, netQuantity: row.netQuantity, netSales: row.netSales, profit: row.profit }))
      .sort((left: any, right: any) => Number(right.netQuantity || 0) - Number(left.netQuantity || 0)).slice(0, 3);
    const returns = await collectPages("retail.after-sale.list", { ...dateInput(), query_type: "return" });
    const returnRows = returns.filter(row => row.status === "completed" && row.type === "return").map(row => ({ orderCode: row.orderCode, customerName: row.customerName, itemsSummary: row.itemsSummary, reason: row.reason, totalAmount: row.totalAmount }));
    return { success: true, data: { range: data.range, products, returns: returnRows } };
  }
  if (op.id === "retail.warranty.status-counts") {
    const source = ASSISTANT_OPERATIONS.find(candidate => candidate.path === "/retail/warranty/orders" && candidate.method === "GET");
    if (!source) throw new AssistantError("Thiếu danh sách thiết bị bán ra để thống kê bảo hành.", 503);
    const countStatus = async (status: string) => {
      let quantity = 0;
      let pageTotal = 0;
      for (let page = 1; page <= 100; page += 1) {
        const response = await callOperation(req, source, {
          ...(input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch }),
          query_status: status,
          query_page: page,
          query_limit: 100,
        }, password, requestId);
        const rows = rawRecords(response);
        quantity += rows.reduce((sum, row) => sum + Math.max(0, Number(row.quantity) || 0), 0);
        const data = response?.data && typeof response.data === "object" ? response.data : {};
        const total = Number(data.total ?? response?.total);
        if (Number.isSafeInteger(total) && total >= 0) pageTotal = total;
        if (rows.length < 100 || page * 100 >= pageTotal) return quantity;
      }
      throw new AssistantError("Có quá 10.000 dòng thiết bị bảo hành; chưa thể đếm đầy đủ.");
    };
    const [activeQuantity, expiringQuantity, expiredQuantity, unrecordedQuantity] = await Promise.all([
      countStatus("active"), countStatus("expiring"), countStatus("expired"), countStatus("unrecorded"),
    ]);
    return { success: true, data: {
      asOf: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()),
      activeQuantity, expiringQuantity, inWarrantyQuantity: activeQuantity + expiringQuantity, expiredQuantity, unrecordedQuantity,
    } };
  }
  if (op.id === "retail.report.daily-extremes" || op.id === "retail.report.category-brand-summary") {
    const source = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "retail.report.summary");
    if (!source) throw new AssistantError("Thiếu báo cáo bán lẻ để tổng hợp.", 503);
    const response = await callOperation(req, source, input, password, requestId);
    const data = response?.data && typeof response.data === "object" ? response.data : {};
    const timeSeries = Array.isArray(data.timeSeries) ? data.timeSeries.filter((row: any) => row && typeof row.businessDate === "string") : [];
    if (op.id === "retail.report.daily-extremes") {
      if (!timeSeries.length) throw new AssistantError("Báo cáo chưa trả chuỗi ngày đầy đủ để tìm ngày bán cao nhất và thấp nhất.", 502);
      const byRevenueHigh = [...timeSeries].sort((left: any, right: any) => Number(right.netSales || 0) - Number(left.netSales || 0) || left.businessDate.localeCompare(right.businessDate));
      const byRevenueLow = [...timeSeries].sort((left: any, right: any) => Number(left.netSales || 0) - Number(right.netSales || 0) || left.businessDate.localeCompare(right.businessDate));
      const byFewestOrders = [...timeSeries].sort((left: any, right: any) => Number(left.orderCount || 0) - Number(right.orderCount || 0)
        || Number(left.netSales || 0) - Number(right.netSales || 0) || left.businessDate.localeCompare(right.businessDate));
      const projectDay = (row: any) => ({ businessDate: row.businessDate, netSales: Number(row.netSales || 0), orderCount: Number(row.orderCount || 0) });
      return { success: true, data: { range: data.range, highestRevenueDay: projectDay(byRevenueHigh[0]), lowestRevenueDay: projectDay(byRevenueLow[0]), fewestOrdersDay: projectDay(byFewestOrders[0]) } };
    }
    const products = Array.isArray(data.products) ? data.products : [];
    const summarize = (key: "category" | "brand") => {
      const groups = new Map<string, { name: string; netSales: number; netQuantity: number; products: Set<string> }>();
      for (const item of products) {
        const name = typeof item?.[key] === "string" && item[key].trim() ? item[key].trim() : "Chưa phân loại";
        const group = groups.get(name) || { name, netSales: 0, netQuantity: 0, products: new Set<string>() };
        group.netSales += Number(item?.netSales || 0);
        group.netQuantity += Number(item?.netQuantity || 0);
        group.products.add(String(item?.productId || item?.sku || item?.productName || name));
        groups.set(name, group);
      }
      return [...groups.values()].map(group => ({ name: group.name, netSales: group.netSales, netQuantity: group.netQuantity, productCount: group.products.size }))
        .sort((left, right) => right.netSales - left.netSales || right.netQuantity - left.netQuantity || left.name.localeCompare(right.name))[0] || null;
    };
    return { success: true, data: { range: data.range, categoryLeader: summarize("category"), brandLeader: summarize("brand") } };
  }
  if (["retail.order.top-value", "retail.order.top-customers", "retail.order.top-customers.completed", "retail.order.discount-anomalies"].includes(op.id)) {
    const source = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "retail.order.list");
    if (!source) throw new AssistantError("Thiếu danh sách đơn bán lẻ để xếp hạng.", 503);
    const pageSize = 100;
    const rows: Record<string, any>[] = [];
    let total: number | undefined;
    for (let page = 1; page <= 100; page += 1) {
      const response = await callOperation(req, source, {
        ...(input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch }),
        ...(input.query_from === undefined ? {} : { query_from: input.query_from }),
        ...(input.query_to === undefined ? {} : { query_to: input.query_to }),
        ...(op.id === "retail.order.top-customers.completed" ? { query_status: "completed" } : {}),
        query_page: page,
        query_limit: pageSize,
      }, password, requestId);
      const batch = rawRecords(response);
      rows.push(...batch);
      const data = response?.data && typeof response.data === "object" ? response.data : {};
      const parsedTotal = Number(data.total ?? response?.total);
      if (Number.isSafeInteger(parsedTotal) && parsedTotal >= 0) total = parsedTotal;
      if (batch.length < pageSize || (total !== undefined && rows.length >= total)) break;
      if (page === 100) throw new AssistantError("Có quá 10.000 đơn bán trong kỳ; hãy thu hẹp khoảng thời gian để xếp hạng đầy đủ.");
    }
    const sales = rows.filter(row => !["cancelled", "canceled", "draft", "held"].includes(String(row.status || "").toLowerCase())
      && (op.id !== "retail.order.top-customers.completed" || String(row.status || "").toLowerCase() === "completed"));
    if (op.id === "retail.order.discount-anomalies") {
      const thresholdPercent = Math.min(100, Math.max(1, Number(input.thresholdPercent) || 20));
      const orders = sales.flatMap(order => {
        const subtotal = Number(order.subtotal || 0);
        if (subtotal <= 0) return [];
        const itemDiscount = Array.isArray(order.items) ? order.items.reduce((sum: number, item: any) => sum + Number(item?.discountAmount || 0), 0) : 0;
        const discountAmount = Number(order.orderDiscount || 0) + itemDiscount;
        const discountPercent = discountAmount / subtotal * 100;
        return discountPercent >= thresholdPercent ? [{
          orderCode: String(order.orderCode || ""), customerName: String(order.customerName || ""), businessDate: String(order.businessDate || ""),
          grandTotal: Number(order.grandTotal || 0), discountAmount, discountPercent,
        }] : [];
      }).sort((left, right) => right.discountPercent - left.discountPercent || right.discountAmount - left.discountAmount || left.orderCode.localeCompare(right.orderCode));
      return { success: true, data: { range: { from: String(input.query_from || ""), to: String(input.query_to || "") }, thresholdPercent, orders, total: orders.length } };
    }
    if (op.id === "retail.order.top-value") {
      const highest = sales.sort((left, right) => Number(right.grandTotal || 0) - Number(left.grandTotal || 0)
        || String(left.businessDate || "").localeCompare(String(right.businessDate || ""))
        || String(left.orderCode || "").localeCompare(String(right.orderCode || "")))[0];
      return { success: true, data: highest ? {
        orderCode: highest.orderCode, customerName: highest.customerName, grandTotal: Number(highest.grandTotal || 0),
        businessDate: highest.businessDate, status: highest.status, paymentStatus: highest.paymentStatus,
      } : {} };
    }
    const customers = new Map<string, { customerName: string; totalSpent: number; orderCount: number }>();
    for (const order of sales) {
      const customerName = typeof order.customerName === "string" ? order.customerName.trim() : "";
      if (!customerName) continue;
      const key = normalize(customerName);
      const customer = customers.get(key) || { customerName, totalSpent: 0, orderCount: 0 };
      customer.totalSpent += Math.max(0, Number(order.grandTotal || 0) - Number(order.refundedAmount || 0));
      customer.orderCount += 1;
      customers.set(key, customer);
    }
    const limit = Math.min(50, Math.max(1, Number(input.topN) || 10));
    const ranked = [...customers.values()].sort((left, right) => right.totalSpent - left.totalSpent || left.customerName.localeCompare(right.customerName)).slice(0, limit);
    return { success: true, data: { customers: ranked, total: ranked.length } };
  }
  if (op.id === "retail.report.top-products") {
    const source = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "retail.report.summary");
    if (!source) throw new AssistantError("Thiếu báo cáo bán lẻ để xếp hạng mặt hàng.", 503);
    const response = await callOperation(req, source, input, password, requestId);
    const data = response?.data && typeof response.data === "object" ? response.data : {};
    const products = Array.isArray(data.products) ? data.products.filter((row: any) => row && typeof row === "object"
      && typeof row.productName === "string" && typeof row.netQuantity === "number" && Number.isFinite(row.netQuantity)) : [];
    const limit = Math.min(50, Math.max(1, Number(input.topN) || 10));
    products.sort((left: any, right: any) => right.netQuantity - left.netQuantity
      || Number(right.netSales || 0) - Number(left.netSales || 0)
      || String(left.sku || left.productName).localeCompare(String(right.sku || right.productName)));
    return { ...response, data: { ...data, products: products.slice(0, limit) } };
  }
  if (op.id === "inventory.serial.stock-ranking") {
    const serials = await collectPages("inventory.serial.list", {
      ...(branchFromInput() === undefined ? {} : { targetBranch: branchFromInput() }),
      query_status: "in_stock",
      query_trackingMode: "serial",
    });
    const byProduct = new Map<string, { productName: string; imeiCount: number }>();
    for (const serial of serials) {
      if (serial.status !== "in_stock") continue;
      const productName = typeof serial.productName === "string" ? serial.productName.trim() : "";
      if (!productName) continue;
      const productId = String(serial.productId || "").trim();
      const key = productId || productName.toLocaleLowerCase("vi");
      const current = byProduct.get(key) || { productName, imeiCount: 0 };
      current.imeiCount += 1;
      byProduct.set(key, current);
    }
    const ranked = [...byProduct.values()].sort((left, right) => right.imeiCount - left.imeiCount
      || left.productName.localeCompare(right.productName, "vi"));
    const highestCount = ranked[0]?.imeiCount || 0;
    return { success: true, data: { products: ranked.filter(product => product.imeiCount === highestCount && highestCount > 0) } };
  }
  if (op.id === "retail.report.compare") {
    const summaryOperation = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "retail.report.summary");
    if (!summaryOperation) throw new AssistantError("Thiếu thao tác nguồn để so sánh báo cáo bán lẻ.", 503);
    const readPeriod = async (from: unknown, to: unknown) => {
      const response = await callOperation(req, summaryOperation, {
        ...(input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch }),
        from: String(from || ""),
        to: String(to || ""),
      }, password, requestId);
      const data = response?.data;
      const summary = data?.summary;
      if (!summary || typeof summary !== "object"
        || typeof summary.grossSales !== "number" || !Number.isFinite(summary.grossSales)
        || typeof summary.netSales !== "number" || !Number.isFinite(summary.netSales)
        || typeof summary.orderCount !== "number" || !Number.isFinite(summary.orderCount)) {
        throw new AssistantError("Báo cáo bán lẻ chưa trả đủ doanh thu và số đơn cho hai kỳ; chưa thể so sánh.", 502);
      }
      const row: Record<string, unknown> = {
        from: String(data.range?.from || from || ""),
        to: String(data.range?.to || to || ""),
        grossSales: summary.grossSales,
        netSales: summary.netSales,
        orderCount: summary.orderCount,
      };
      for (const key of ["grossProfit", "grossMarginPercent"] as const) {
        if (typeof summary[key] === "number" && Number.isFinite(summary[key])) row[key] = summary[key];
      }
      return row;
    };
    const current = await readPeriod(input.currentFrom, input.currentTo);
    const previous = await readPeriod(input.previousFrom, input.previousTo);
    return { status: "success", data: { current, previous } };
  }
  if (op.id === "student.batch.attendance.summary") {
    const detail = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "student.batch.detail")!;
    const response = await callOperation(req, detail, { path_id: input.path_id }, password, requestId);
    const date = String(input.date || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()));
    const { studentAttendanceSummary } = await import("./student-attendance-report");
    const batch = response.data?.batch || response.data;
    const summary = studentAttendanceSummary(batch, date);
    const absentStudentIds = new Set<string>((batch.attendanceSessions || [])
      .filter((session: any) => session.date === date)
      .flatMap((session: any) => (session.records || [])
        .filter((record: any) => record.status === "absent")
        .map((record: any) => String(record.studentId))));
    if (absentStudentIds.size) {
      const students = await lookupRecords(req, "student.list");
      const absentStudents = [...new Set(students
        .filter(student => absentStudentIds.has(String(student.id || student._id || "")))
        .map(student => String(student.fullName || "").trim())
        .filter(Boolean))];
      if (absentStudents.length) return { data: { ...summary, absentStudents: absentStudents.join(", ") } };
    }
    return { data: summary };
  }
  if (op.id === "hr.training.progress") {
    const response = await callOperation(req, ASSISTANT_OPERATIONS.find(candidate => candidate.id === "hr.training.incomplete.list")!, input, password, requestId);
    const rows = rawRecords(response);
    const courseName = String(input.courseName || "").trim();
    if (Number(response?.total) > rows.length) throw new AssistantError("Danh sách tiến độ còn trang chưa tải; thu hẹp khóa học để báo cáo đầy đủ.");
    const matching = rows.filter((row: any) => !courseName || normalize(String(row.courseTitle || "")).includes(normalize(courseName)));
    if (!matching.length) throw new AssistantError("Chưa có dữ liệu đăng ký học phù hợp để báo cáo tiến độ; hãy kiểm tra tên khóa đào tạo nội bộ và danh sách đăng ký.");
    return { data: matching.map((row: any) => ({ employeeName: row.userName, courseTitle: row.courseTitle, progress: row.progress, status: row.status })) };
  }
  if (op.module === "quotation") {
    try { return await callQuotationOperation(req, op, input, requestId); }
    catch (error) { if (error instanceof QuotationUncertainExecutionError) throw new UncertainExecutionError(error.message); throw error; }
  }
  if (op.module === "healthcare") {
    try { return await callHealthcareOperation(req, op, input); }
    catch (error) {
      if (error instanceof HealthcareUncertainExecutionError) throw new UncertainExecutionError(error.message);
      throw error;
    }
  }
  if (op.id === "worker.standard-fields.list") {
    if (input.query_moduleKey !== undefined && input.query_moduleKey !== "students") throw new AssistantError("Trợ lý chỉ hỗ trợ cấu hình trường hồ sơ lao động đang dùng trong giao diện.");
    input.query_moduleKey = "students";
  }
  if (op.id === "payroll.adjustment.create" && input.kind === "advance") {
    const amount = Number(input.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new AssistantError("Khoản tạm ứng phải là số nguyên dương.");
  }
  if (op.id === "payroll.period.input.update"
    && !["agreedSalary", "reconciledDays", "reconciledHours", "allowance", "bonus", "deduction"].some(key => input[key] !== undefined)) {
    throw new AssistantError("Hãy nêu ít nhất một khoản lương, ngày công hoặc giờ công cần cập nhật.");
  }
  if (op.id === "payroll.period.inputs.bulk") {
    let rows: any[];
    try { rows = JSON.parse(String(input.rows || "")); } catch { rows = []; }
    const valueFields = ["agreedSalary", "reconciledDays", "reconciledHours", "allowance", "bonus", "deduction"];
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 20) throw new AssistantError("Cập nhật lương hàng loạt cần từ 1 đến 20 nhân sự mỗi lần.");
    const employeeIds = rows.map(row => String(row?.employeeId || ""));
    if (employeeIds.some(id => !/^[a-f\d]{24}$/i.test(id)) || new Set(employeeIds).size !== employeeIds.length) {
      throw new AssistantError("Mỗi nhân sự phải được chọn đúng theo tên và không được lặp trong cùng yêu cầu.");
    }
    if (rows.some(row => !valueFields.some(key => row?.[key] !== undefined))) {
      throw new AssistantError("Mỗi nhân sự cần có ít nhất một khoản lương, ngày công hoặc giờ công cần cập nhật.");
    }
    if (rows.some(row => typeof row?.reason !== "string" || !row.reason.trim() || row.reason.length > 500)) {
      throw new AssistantError("Mỗi dòng cần có lý do đối soát từ 1 đến 500 ký tự.");
    }
    if (rows.some(row => valueFields.some(key => row?.[key] !== undefined && (!Number.isFinite(row[key]) || row[key] < 0)))) {
      throw new AssistantError("Các khoản lương, ngày công và giờ công phải là số không âm hợp lệ.");
    }
  }
  if (op.id === "payroll.period.line-overrides.bulk") {
    let rows: any[];
    try { rows = JSON.parse(String(input.rows || "")); } catch { rows = []; }
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 20) throw new AssistantError("Ghi đè lương cần từ 1 đến 20 nhân viên mỗi lần.");
    const employeeIds = rows.map(row => String(row?.employeeId || ""));
    if (employeeIds.some(id => !/^[a-f\d]{24}$/i.test(id)) || new Set(employeeIds).size !== employeeIds.length) {
      throw new AssistantError("Mỗi nhân viên phải được chọn đúng theo tên và không lặp trong cùng yêu cầu.");
    }
    const reasons = rows.map(row => typeof row?.reason === "string" ? row.reason.trim() : "");
    if (reasons.some(reason => !reason || reason.length > 500) || new Set(reasons).size !== 1) {
      throw new AssistantError("Mọi dòng cần cùng một lý do từ 1 đến 500 ký tự.");
    }
    const allowedFields = new Set<string>(PAYROLL_LINE_OVERRIDE_FIELDS);
    const customCodePattern = /^[A-Za-z][A-Za-z0-9_]*$/;
    for (const row of rows) {
      const values = row?.values && typeof row.values === "object" && !Array.isArray(row.values) ? row.values : {};
      const customValues = row?.customValues && typeof row.customValues === "object" && !Array.isArray(row.customValues) ? row.customValues : {};
      const clearFields = Array.isArray(row?.clearFields) ? row.clearFields.map(String) : [];
      if (row?.values !== undefined && (typeof row.values !== "object" || Array.isArray(row.values))) throw new AssistantError("Các trường lương cần ghi đè không hợp lệ.");
      if (row?.customValues !== undefined && (typeof row.customValues !== "object" || Array.isArray(row.customValues))) throw new AssistantError("Các trường tùy chỉnh cần ghi đè không hợp lệ.");
      const customCodes = Object.keys(customValues);
      const allowedClear = (field: string) => allowedFields.has(field)
        || (field.startsWith("custom.") && customCodePattern.test(field.slice("custom.".length)));
      if (Object.keys(values).some(field => !allowedFields.has(field))
        || customCodes.some(code => !customCodePattern.test(code))
        || clearFields.length > 12 || clearFields.some(field => !allowedClear(field))
        || new Set(clearFields).size !== clearFields.length) {
        throw new AssistantError("Có trường lương không hỗ trợ hoặc danh sách khôi phục không hợp lệ.");
      }
      const changedFields = Object.keys(values).length + customCodes.length + clearFields.length;
      if (!changedFields) throw new AssistantError("Mỗi nhân viên cần có ít nhất một giá trị cần ghi đè hoặc một trường cần khôi phục.");
      if (Object.entries(values).some(([, value]) => typeof value !== "number" || !Number.isFinite(value) || value < 0)
        || Object.entries(customValues).some(([, value]) => typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
        throw new AssistantError("Giá trị ghi đè phải là số không âm hợp lệ.");
      }
      const setFields = new Set([...Object.keys(values), ...customCodes.map(code => `custom.${code}`)]);
      if (clearFields.some(field => setFields.has(field))) throw new AssistantError("Không thể ghi đè và khôi phục cùng một trường trong một dòng.");
    }
  }
  if (op.id === "payroll.run.create" && (typeof input.periodKey !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.periodKey))) {
    throw new AssistantError("Kỳ lương cần có định dạng YYYY-MM, ví dụ 2026-10.");
  }
  if (op.path.startsWith("/payroll/periods/") && typeof input.path_periodKey === "string"
    && !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.path_periodKey)) {
    throw new AssistantError("Kỳ lương cần có định dạng YYYY-MM, ví dụ 2026-10.");
  }
  await assertOperation(req, op.id);
  if (["marketing.campaign.calendar", "marketing.campaign.slot.reject", "marketing.campaign.slot.retry", "marketing.campaign.slot.approve", "marketing.campaign.slot.publish-now", "marketing.campaign.slot.content.update"].includes(op.id)) assertCampaignCalendarRange(input);
  if (op.id === "marketing.campaign.slot.reject" && (typeof input.reason !== "string" || !input.reason.trim() || input.reason.length > 1000)) {
    throw new AssistantError("Lý do từ chối cần có từ 1 đến 1.000 ký tự.");
  }
  if (op.id === "marketing.ai.image.generate") {
    const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
    if (!prompt || prompt.length > 4000) throw new AssistantError("Mô tả ảnh cần có từ 1 đến 4.000 ký tự.");
    const aspectRatios = ["1:1", "16:9", "9:16", "4:3", "3:4"];
    const models = ["gemini-banana-flash", "gemini-banana-pro"];
    const aspectRatio = input.aspectRatio ?? "3:4";
    const modelName = input.modelName ?? "gemini-banana-flash";
    const resolution = input.resolution ?? "1K";
    if (!aspectRatios.includes(String(aspectRatio))) throw new AssistantError("Tỷ lệ ảnh không nằm trong các lựa chọn được hỗ trợ.");
    if (!models.includes(String(modelName))) throw new AssistantError("Mô hình tạo ảnh không nằm trong các lựa chọn được hỗ trợ.");
    if (resolution !== "1K") throw new AssistantError("Độ phân giải ảnh hiện chỉ hỗ trợ 1K.");
    if (input.negativePrompt !== undefined && (typeof input.negativePrompt !== "string" || input.negativePrompt.length > 1000)) {
      throw new AssistantError("Nội dung cần tránh không được vượt quá 1.000 ký tự.");
    }
    Object.assign(input, { prompt, aspectRatio, modelName, resolution });
  }
  if (op.id === "marketing.ai.image.edit") {
    const instruction = typeof input.instruction === "string" ? input.instruction.trim() : "";
    if (instruction.length < 2 || instruction.length > 4000) throw new AssistantError("Mô tả chỉnh sửa cần có từ 2 đến 4.000 ký tự.");
    if (!/^[a-f\d]{24}$/i.test(String(input.sourceMediaId || ""))) throw new AssistantError("Hãy chọn ảnh nguồn trong thư viện media của tài khoản.");
    const aspectRatios = ["1:1", "16:9", "9:16", "4:3", "3:4"];
    const models = ["gemini-banana-flash", "gemini-banana-pro"];
    const modelName = input.modelName ?? "gemini-banana-flash";
    const resolution = input.resolution ?? "1K";
    if (input.aspectRatio !== undefined && !aspectRatios.includes(String(input.aspectRatio))) throw new AssistantError("Tỷ lệ ảnh không nằm trong các lựa chọn được hỗ trợ.");
    if (!models.includes(String(modelName))) throw new AssistantError("Mô hình chỉnh sửa ảnh không nằm trong các lựa chọn được hỗ trợ.");
    if (resolution !== "1K") throw new AssistantError("Độ phân giải ảnh hiện chỉ hỗ trợ 1K.");
    if (input.regionNote !== undefined && (typeof input.regionNote !== "string" || input.regionNote.length > 2000)) throw new AssistantError("Mô tả khu vực chỉnh sửa không được vượt quá 2.000 ký tự.");
    if (!requestId || requestId.length > 100) throw new AssistantError("Thiếu mã yêu cầu ổn định để tránh tạo trùng phiên bản ảnh.");
    Object.assign(input, { instruction, modelName, resolution });
  }
  if (op.id === "marketing.elevenlabs.custom-voice.preview") {
    const options = {
      gender: ["female", "male"],
      age: ["young", "middle_aged", "old"],
      accent: ["american", "british", "african", "australian", "indian"],
    } as const;
    const gender = input.gender ?? "female";
    const age = input.age ?? "young";
    const accent = input.accent ?? "american";
    const accentStrength = Number(input.accentStrength ?? 1);
    const sampleText = typeof input.text === "string" ? input.text.trim() : "";
    const step = (accentStrength - 0.3) / 0.05;
    if (!options.gender.includes(String(gender) as typeof options.gender[number])
      || !options.age.includes(String(age) as typeof options.age[number])
      || !options.accent.includes(String(accent) as typeof options.accent[number])) {
      throw new AssistantError("Chọn giới tính, độ tuổi và giọng vùng miền trong các lựa chọn được hỗ trợ.");
    }
    if (!Number.isFinite(accentStrength) || accentStrength < 0.3 || accentStrength > 2 || Math.abs(step - Math.round(step)) > 1e-8) {
      throw new AssistantError("Mức độ giọng vùng miền phải từ 0,3 đến 2,0, bước 0,05.");
    }
    if (!sampleText || sampleText.length > 1000) throw new AssistantError("Văn bản nghe thử cần có từ 1 đến 1.000 ký tự.");
    Object.assign(input, { gender, age, accent, accentStrength, text: sampleText });
  }
  if (op.id === "marketing.ai.scheduled-campaign") assertScheduledCampaignInput(input);
  if (op.id === "marketing.elevenlabs.voice.delete") {
    const selectedVoiceId = String(input.path_voiceId || "");
    const voices = await lookupRecords(req, "marketing.elevenlabs.voices.list", "");
    const selected = voices.filter(voice => String(voice.voiceId || "") === selectedVoiceId);
    if (selected.length !== 1 || !["cloned", "generated"].includes(String(selected[0]?.category || "").toLowerCase())) {
      throw new AssistantError("Chỉ xóa được một giọng cloned/generated do tài khoản tạo; giọng dựng sẵn hoặc chưa xác định không bị xóa.");
    }
  }
  if (op.id === "marketing.elevenlabs.voice-settings.update"
    && !["stability", "similarity_boost", "style", "use_speaker_boost"].some(key => input[key] !== undefined)) {
    throw new AssistantError("Hãy nêu ít nhất một cài đặt giọng đọc cần thay đổi.");
  }
  if (op.id === "marketing.media-history.list" && !["image", "voice"].includes(String(input.query_type || ""))) {
    throw new AssistantError("Chỉ hỗ trợ xem lịch sử ảnh hoặc giọng đọc; không gọi lịch sử video vì thao tác đọc có thể cập nhật job.");
  }
  if (op.id === "student.email.send") {
    const recipient = String(input.to || "").trim();
    const subject = String(input.subject || "").trim();
    const html = String(input.html || "").trim();
    if (recipient.length > 254 || !/^[^\s@,;<>]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(recipient)) throw new AssistantError("Email chỉ hỗ trợ một địa chỉ hợp lệ mỗi lần gửi.");
    if (!subject || subject.length > 200 || /[\r\n]/.test(subject)) throw new AssistantError("Tiêu đề email phải có từ 1 đến 200 ký tự và không chứa xuống dòng.");
    if (!html || html.length > 10_000) throw new AssistantError("Nội dung email phải có từ 1 đến 10.000 ký tự.");
    input.to = recipient;
    input.subject = subject;
    input.html = html;
  }
  if (op.id === "inventory.count.item.update") {
    const hasQuantity = input.countedQuantity !== undefined;
    const hasNote = input.note !== undefined;
    if (!hasQuantity && !hasNote) throw new AssistantError("Nêu số lượng đếm hoặc ghi chú cần cập nhật.");
    if (hasQuantity && (!Number.isFinite(Number(input.countedQuantity)) || Number(input.countedQuantity) < 0)) throw new AssistantError("Số lượng đếm phải là số không âm hợp lệ.");
    if (hasNote && (typeof input.note !== "string" || input.note.length > 500)) throw new AssistantError("Ghi chú dòng kiểm kê tối đa 500 ký tự.");
    if (hasQuantity) {
      const detailOp = operationById("inventory.count.detail");
      if (!detailOp) throw new AssistantError("Không tìm thấy thao tác đọc phiếu kiểm kê để kiểm tra SKU.");
      const branch = input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch };
      const count = await callOperation(req, detailOp, { path_id: String(input.path_id || ""), ...branch });
      const item = Array.isArray(count?.data?.items) ? count.data.items.find((entry: any) => String(entry?._id || entry?.id || "") === String(input.path_itemId || "")) : undefined;
      if (!item) throw new AssistantError("Không tìm thấy dòng SKU trong phiếu đã chọn; chưa cập nhật.", 404);
      if (["serial", "unit_barcode"].includes(String(item.trackingMode || ""))) throw new AssistantError(`SKU ${String(item.sku || "đã chọn")} phải đếm bằng cách quét mã nội bộ/IMEI từng máy.`);
    }
  }
  if (op.id === "inventory.count.approve") {
    const detailOp = operationById("inventory.count.detail");
    if (!detailOp) throw new AssistantError("Không tìm thấy thao tác đọc phiếu kiểm kê; chưa phê duyệt.");
    const branch = input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch };
    const response = await callOperation(req, detailOp, { path_id: String(input.path_id || ""), ...branch });
    const count = response?.data && typeof response.data === "object" ? response.data : {};
    const items = Array.isArray(count.items) ? count.items : [];
    const missingUnits = items.reduce((total: number, item: any) => {
      if (!["serial", "unit_barcode"].includes(String(item.trackingMode || ""))) return total;
      const scanned = new Set((Array.isArray(item.scannedUnitIds) ? item.scannedUnitIds : []).map(String));
      return total + (Array.isArray(item.expectedUnits) ? item.expectedUnits.filter((unit: any) => !scanned.has(String(unit.serialUnitId))).length : 0);
    }, 0);
    if (items.some((item: any) => !Number.isFinite(Number(item.quantityDelta)))) {
      throw new AssistantError("Không đọc được chênh lệch trên phiếu kiểm kê; chưa phê duyệt để tránh cập nhật sai tồn kho.");
    }
    const hasDiscrepancy = missingUnits > 0 || items.some((item: any) => Number(item.quantityDelta) !== 0);
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (hasDiscrepancy && input.discrepancyConfirmed !== true) {
      const lines = items.filter((item: any) => Number(item.quantityDelta) !== 0)
        .slice(0, 8).map((item: any) => `${String(item.sku || "SKU")} lệch ${Number(item.quantityDelta) > 0 ? "+" : ""}${Number(item.quantityDelta)}`);
      throw new AssistantError(`Phiếu ${String(count.countCode || "đã chọn")} có chênh lệch${lines.length ? `: ${lines.join(", ")}` : ""}${missingUnits ? `; còn ${missingUnits} máy chưa quét thấy` : ""}. Hãy xác nhận đã kiểm tra và nêu lý do trước khi phê duyệt.`);
    }
    if (hasDiscrepancy && !reason) throw new AssistantError("Cần nêu lý do chấp nhận chênh lệch trước khi phê duyệt kiểm kê.");
    const unexpected = Array.isArray(count.unexpectedScans) ? count.unexpectedScans : [];
    let resolutions: any[] = Array.isArray(input.unexpectedScanResolutions) ? input.unexpectedScanResolutions : [];
    if (typeof input.unexpectedScanResolutions === "string") {
      try {
        const parsed = JSON.parse(input.unexpectedScanResolutions);
        if (Array.isArray(parsed)) resolutions = parsed;
      } catch { /* Shared structured-field validation returns the user-facing JSON error below. */ }
    }
    const resolvedCodes = new Set(resolutions.filter((entry: any) => entry && typeof entry.code === "string" && typeof entry.reason === "string" && entry.reason.trim()).map((entry: any) => entry.code));
    const unresolved = unexpected.filter((scan: any) => !resolvedCodes.has(String(scan.code || "")));
    if (unresolved.length) {
      const examples = unresolved.slice(0, 8).map((scan: any) => `${String(scan.code || "mã chưa rõ")}${scan.sku ? ` (${String(scan.sku)})` : ""}`);
      throw new AssistantError(`Cần ghi kết quả đối chiếu cho ${unresolved.length} mã ngoài dự kiến${examples.length ? `: ${examples.join(", ")}` : ""}${unresolved.length > examples.length ? ` và ${unresolved.length - examples.length} mã khác` : ""}. Nêu mã cùng lý do xử lý cho từng mã rồi gửi lại.`);
    }
  }
  if (op.path === "/student-quality/batches/:batchId/students/:studentId/mini-tests" && Number(input.score) > Number(input.maxScore)) {
    throw new AssistantError("Điểm không được lớn hơn thang điểm.");
  }
  if (op.id === "retail.partner.product.commissions.update") {
    let skus: unknown;
    let rule: unknown;
    try { skus = JSON.parse(String(input.skus || "")); rule = JSON.parse(String(input.rule || "")); }
    catch { throw new AssistantError("Danh sách SKU hoặc quy tắc hoa hồng không hợp lệ."); }
    if (!Array.isArray(skus) || skus.length < 1 || skus.length > 100 || skus.some(sku => typeof sku !== "string" || !sku.trim())) {
      throw new AssistantError("Chọn từ 1 đến 100 sản phẩm/SKU hợp lệ.");
    }
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) throw new AssistantError("Cần khai báo quy tắc hoa hồng.");
    const commissionRule = rule as Record<string, unknown>;
    if (commissionRule.kind === "phone") {
      if (Object.keys(commissionRule).some(key => !["kind", "amount"].includes(key)) || !Number.isSafeInteger(commissionRule.amount) || Number(commissionRule.amount) < 1) {
        throw new AssistantError("Hoa hồng điện thoại cần một mức tiền VND là số nguyên dương; không nhập tỷ lệ phụ kiện.");
      }
    } else if (commissionRule.kind === "accessory") {
      if (Object.keys(commissionRule).some(key => !["kind", "rateBps"].includes(key)) || !Number.isSafeInteger(commissionRule.rateBps) || Number(commissionRule.rateBps) < 1 || Number(commissionRule.rateBps) > 10_000) {
        throw new AssistantError("Hoa hồng phụ kiện cần tỷ lệ điểm cơ bản từ 1 đến 10.000; không nhập mức tiền điện thoại.");
      }
    } else throw new AssistantError("Loại hoa hồng sản phẩm phải là phone hoặc accessory.");
  }
  if (op.id === "inventory.serial.create") {
    let serialNumbers: unknown;
    try { serialNumbers = input.serialNumbers === undefined ? undefined : JSON.parse(String(input.serialNumbers)); }
    catch { throw new AssistantError("Danh sách serial không hợp lệ."); }
    const hasBatch = Array.isArray(serialNumbers);
    const hasSingle = typeof input.serialNumber === "string" && input.serialNumber.trim().length > 0;
    if (hasBatch === hasSingle) throw new AssistantError("Cần cung cấp một serial hoặc một danh sách serial, không dùng cả hai.");
    if (hasBatch) {
      let barcodes: unknown;
      try { barcodes = input.internalBarcodes === undefined ? undefined : JSON.parse(String(input.internalBarcodes)); }
      catch { throw new AssistantError("Danh sách mã vạch nội bộ không hợp lệ."); }
      if (!(serialNumbers as unknown[]).length || (serialNumbers as unknown[]).length > 100 || (serialNumbers as unknown[]).some(value => typeof value !== "string" || !value.trim())) {
        throw new AssistantError("Danh sách serial phải có từ 1 đến 100 mã không rỗng.");
      }
      if (barcodes !== undefined && (!Array.isArray(barcodes) || barcodes.length !== (serialNumbers as unknown[]).length || barcodes.some(value => typeof value !== "string" || !value.trim()))) {
        throw new AssistantError("Danh sách mã vạch nội bộ phải có cùng số lượng và không được rỗng.");
      }
    } else if (input.internalBarcodes !== undefined) throw new AssistantError("Mã vạch đơn lẻ dùng trường mã vạch nội bộ.");
  }
  const { companyCode } = actorScope(req);
  const branchScopedOperation = isBranchScopedAssistantOperation(op);
  const queryBranchField = op.fields.find(field => field.source === "query" && field.apiKey === "branchId");
  const branchField = branchScopedOperation ? queryBranchField : undefined;
  const requestedBranch = queryBranchField && input[queryBranchField.key] !== undefined ? String(input[queryBranchField.key]) : "";
  let effectiveBranchId = req.user?.branchId || (op.module === "inventory" && typeof branchHeader === "string" ? branchHeader : "");
  if (branchScopedOperation) {
    if (req.user?.role === "admin" && requestedBranch) effectiveBranchId = requestedBranch;
    if (requestedBranch && effectiveBranchId && requestedBranch !== effectiveBranchId) throw new AssistantError("Tài khoản này chỉ được thao tác trong chi nhánh đã được gán.");
    if (req.user?.role === "admin") effectiveBranchId = requestedBranch || effectiveBranchId;
    if (!effectiveBranchId && requiresBranchChoice(op)) {
      const message = op.id.startsWith("inventory.serial.")
        ? "Cần chọn chi nhánh theo tên trước khi tra cứu hoặc đăng ký IMEI/serial."
        : op.id === "inventory.warehouse.locations.list"
          ? "Cần chọn chi nhánh kho theo tên trước khi tra cứu kho."
        : op.path === "/inventory/transfers" || op.path.startsWith("/inventory/transfers/")
          ? "Cần chọn chi nhánh gửi hoặc nhận theo tên trước khi tra cứu điều chuyển kho."
        : isInventoryCountOperation(op)
          ? "Cần chọn chi nhánh theo tên trước khi tra cứu hoặc cập nhật phiếu kiểm kê."
        : op.path.startsWith("/inventory/reconciliation/")
          ? "Cần chọn chi nhánh theo tên trước khi đối soát dữ liệu tồn kho."
          : op.path.startsWith("/finance/management/")
            ? "Cần chọn chi nhánh tài chính theo tên trước khi tra cứu hoặc ghi nhận công nợ."
          : op.path.startsWith("/finance/receivables")
          ? "Cần chọn chi nhánh hạch toán theo tên trước khi thao tác khoản phải thu."
        : op.path.startsWith("/finance/reporting/")
            ? "Cần chọn chi nhánh tài chính theo tên trước khi tra cứu hoặc cập nhật kế hoạch."
          : op.path.startsWith("/payroll/periods/") || op.path.startsWith("/payroll/runs/")
            ? "C\u1EA7n ch\u1ECDn chi nh\u00E1nh b\u1EA3ng l\u01B0\u01A1ng theo t\u00EAn tr\u01B0\u1EDBc khi xem ho\u1EB7c thao t\u00E1c k\u1EF3 l\u01B0\u01A1ng."
          : op.path === "/retail/settings"
            ? "Cần chọn chi nhánh bán lẻ theo tên trước khi xem hoặc cập nhật cài đặt."
          : op.path.startsWith("/retail/debt-reminders/")
            ? "Cần chọn chi nhánh bán lẻ theo tên trước khi xem hoặc chạy nhắc công nợ."
          : isRetailCashbookOperation(op)
            ? "Cần chọn chi nhánh bán lẻ theo tên trước khi tra cứu hoặc tạo phiếu thu chi."
          : (op.id === "retail.coupon.create" || op.id === "retail.coupon.tier.list")
            ? op.id === "retail.coupon.create" ? "C\u1EA7n ch\u1ECDn chi nh\u00E1nh b\u00E1n l\u1EBB theo t\u00EAn tr\u01B0\u1EDBc khi t\u1EA1o m\u00E3 \u01B0u \u0111\u00E3i." : "C\u1EA7n ch\u1ECDn chi nh\u00E1nh b\u00E1n l\u1EBB theo t\u00EAn tr\u01B0\u1EDBc khi tra c\u1EE9u h\u1EA1ng kh\u00E1ch h\u00E0ng."
          : isRetailFinanceCommissionOperation(op)
            ? "Cần chọn chi nhánh bán lẻ theo tên trước khi xem hoặc cấu hình hoa hồng POS."
          : isRetailReceivableOperation(op)
            ? "Cần chọn chi nhánh bán lẻ theo tên trước khi xem hoặc đối soát công nợ."
          : isRetailAfterSaleOperation(op)
            ? "Cần chọn chi nhánh bán lẻ theo tên trước khi tra cứu chứng từ đổi trả hoặc thu mua."
          : op.id === "repair.device.lookup"
            ? "Cần chọn chi nhánh tiếp nhận sửa chữa theo tên trước khi tra cứu thiết bị."
          : op.id === "repair.feedback.link.create"
            ? "Cần chọn chi nhánh sửa chữa theo tên trước khi tạo liên kết đánh giá cho phiếu."
          : isRetailPosOperation(op)
            ? "Cần chọn chi nhánh bán lẻ theo tên trước khi thao tác đơn hàng hoặc ca POS."
          : isRecruitmentOperation(op)
            ? "Cần chọn chi nhánh tuyển dụng theo tên trước khi tra cứu hoặc cập nhật dữ liệu."
            : "Cần chọn chi nhánh áp dụng theo tên trước khi cấu hình cấp bậc hoa hồng.";
      throw new AssistantError(message);
    }
  }
  let route = op.path;
  if (op.adapter === "contract") {
    route = route.replace(/:([A-Za-z0-9_]+)/g, (_match, key: string) => {
      const field = op.fields.find(f => f.source === "path" && f.apiKey === key);
      const value = field
        ? String(input[field.key] || "")
        : op.fixedPathValues?.[key] || (op.optionalPathFields?.includes(key) ? String(input[`path_${key}`] || "") : "");
      const providerVoiceId = key === "voiceId" && op.id.startsWith("marketing.elevenlabs.voice");
      const personalDriveResourceId = op.id === "resource.google-drive.rename" && key === "id";
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(value) || (/^(?:id|.*Id)$/.test(key) && !providerVoiceId && !personalDriveResourceId && !/^(?:[a-f\d]{24}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}|[0-9]{6,32}(?:_[0-9]{6,32})?)$/i.test(value)) || (personalDriveResourceId && !/^[A-Za-z0-9_-]{10,100}$/.test(value))) throw new AssistantError("Mã bản ghi hoặc tham số đường dẫn không hợp lệ.");
      return encodeURIComponent(value);
    });
  } else if (route.includes(":")) {
    route = route.replace(/:([A-Za-z0-9_]+)/g, (_match, key: string) => {
      const pathField = op.fields.find(field => field.source === "path" && field.apiKey === key);
      const value = String((pathField ? input[pathField.key] : input[key]) || "");
      const identifier = /^(?:id|.*Id)$/.test(key);
      if (identifier ? !/^[a-f\d]{24}$/i.test(value) : !/^[A-Za-z0-9_-]{1,120}$/.test(value)) {
        throw new AssistantError(identifier ? "Chưa xác định được bản ghi cần thao tác." : "Tham số workflow không hợp lệ.");
      }
      return encodeURIComponent(value);
    });
  }
  const localHost = req.socket.localAddress === "::1" ? "[::1]" : "127.0.0.1";
  if (!req.socket.localPort) throw new AssistantError("Không xác định được máy chủ nghiệp vụ.", 503);
  const url = new URL(`/api/v1${route}`, `http://${localHost}:${req.socket.localPort}`);
  if (op.id === "architect.project.delete") {
    const revision = Number(input.revision);
    if (!Number.isSafeInteger(revision) || revision < 1) throw new AssistantError("Không đọc được phiên bản dự án; chưa thể xóa.");
    url.searchParams.set("revision", String(revision));
  }
  const strictPayrollRunList = op.id === "payroll.run.list";
  const studentBranchHeaderOperation = [
    "batch.list",
    "batch.capacity.report",
    "student.learning-roadmap.waitlist.list",
    "student.learning-roadmap.waitlist.count",
  ].includes(op.id);
  // These schemas reject otherwise implicit query scope; auth claims and x-branch-id remain authoritative.
  const rejectsImplicitScopeQuery = op.path === "/student-quality"
    || op.path === "/learning-roadmaps/waitlist"
    || op.path === "/learning-roadmaps/batches/:batchId/progression";
  for (const field of op.fields) if (field.source === "query" && input[field.key] !== undefined && !op.assistantOnlyFields?.includes(field.key)) {
    if ((strictPayrollRunList || studentBranchHeaderOperation) && field.apiKey === "branchId") continue;
    url.searchParams.set(field.apiKey!, String(input[field.key]));
  }
  if (op.contextQuery?.includes("terminalId") && typeof req.headers["x-device-id"] === "string") url.searchParams.set("terminalId", req.headers["x-device-id"]);
  const companyWideWorkflowOperation = op.path === "/crud/workflows" || op.path.startsWith("/crud/workflows/");
  if (op.adapter === "contract") {
    if (!strictPayrollRunList && !rejectsImplicitScopeQuery) {
      if (branchScopedOperation && effectiveBranchId) url.searchParams.set("branchId", effectiveBranchId);
      else if (req.user?.branchId && !companyWideWorkflowOperation) url.searchParams.set("branchId", req.user.branchId);
    }
  }
  if (!strictPayrollRunList && !rejectsImplicitScopeQuery) url.searchParams.set("companyCode", companyCode);
  if (op.id === "employee.count") {
    const branchField = op.fields.find(field => field.source === "query" && field.apiKey === "branchId");
    const selectedBranchId = branchField && typeof input[branchField.key] === "string" ? String(input[branchField.key]) : "";
    if (selectedBranchId) url.searchParams.set("branchId", selectedBranchId);
    else url.searchParams.set("scope", "company");
  } else if (["employee.list", "employee.detail", "employee.birthday.next-month", "department.employees.list"].includes(op.id)) {
    const employeeBranchId = req.user?.branchId || (typeof input.branchId === "string" ? input.branchId : "");
    if (employeeBranchId) url.searchParams.set("branchId", employeeBranchId);
  }
  if (op.adapter !== "contract" && op.method === "GET" && !["employee.list", "employee.detail", "employee.birthday.next-month", "employee.count", "department.list", "department.unmanaged.list"].includes(op.id)) {
    if (!url.searchParams.has("limit")) url.searchParams.set("limit", "100");
    if (!url.searchParams.has("page")) url.searchParams.set("page", "1");
  }
  if (input.search && op.id === "customer.list") url.searchParams.set("q", String(input.search));
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: req.headers.authorization || "" };
  const branchId = branchScopedOperation
    ? effectiveBranchId
    : req.user?.branchId || (studentBranchHeaderOperation ? String(input.targetBranch || "") : typeof input.branchId === "string" ? input.branchId : "");
  if (branchId) headers["x-branch-id"] = branchId;
  if (["employee.count", "employee.list", "employee.birthday.next-month"].includes(op.id)) {
    const target = op.fields.find(field => field.source === "query" && field.apiKey === "branchId");
    if (target && typeof input[target.key] === "string" && input[target.key]) headers["x-branch-id"] = String(input[target.key]);
  }
  if (typeof req.headers["x-device-id"] === "string") headers["x-device-id"] = req.headers["x-device-id"];
  for (const key of op.contextHeaders || []) {
    if (key !== "idempotency-key") throw new AssistantError("Workflow yêu cầu một tiêu đề ngữ cảnh chưa được hỗ trợ.");
    if (!requestId || !/^[A-Za-z0-9._:-]{1,200}$/.test(requestId)) throw new AssistantError("Thiếu mã yêu cầu hợp lệ để bảo vệ thao tác trùng.");
    headers[key] = requestId;
  }
  const body: Record<string, unknown> = {};
  for (const field of op.fields) if (input[field.key] !== undefined && !op.assistantOnlyFields?.includes(field.key)) {
    if (op.adapter === "contract") {
      if (field.source === "body") {
        const rawValue = input[field.key];
        const value = op.dateOnlyToIsoUtc?.includes(field.apiKey!) && typeof rawValue === "string" ? `${rawValue}T00:00:00.000Z` : rawValue;
        let bodyValue: unknown = value;
        if (field.type === "json") {
          if (op.id === "payroll.period.inputs.bulk" && field.apiKey === "rows" && typeof input.__assistantEmployeeNames === "string") {
            const rows = JSON.parse(String(value));
            if (!Array.isArray(rows)) throw new AssistantError("Danh sách nhân sự và dữ liệu cần cập nhật không hợp lệ.");
            const visibleRows = rows.map((row: any) => {
              const { expectedVersion: _expectedVersion, ...visible } = row;
              return visible;
            });
            const checkedRows = JSON.parse(validateStructuredField(field, JSON.stringify(visibleRows)));
            bodyValue = checkedRows.map((row: any, index: number) => {
              const expectedVersion = Number(rows[index]?.expectedVersion);
              if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new AssistantError("Không đọc được phiên bản dữ liệu lương của từng nhân sự; chưa gửi cập nhật.");
              return { ...row, expectedVersion };
            });
          } else if (op.id === "payroll.period.line-overrides.bulk" && field.apiKey === "rows" && typeof input.__assistantEmployeeNames === "string") {
            const rows = JSON.parse(String(value));
            if (!Array.isArray(rows)) throw new AssistantError("Danh sách nhân viên và các khoản cần ghi đè không hợp lệ.");
            const visibleRows = rows.map((row: any) => {
              const { expectedVersion: _expectedVersion, ...visible } = row;
              return visible;
            });
            const checkedRows = JSON.parse(validateStructuredField(field, JSON.stringify(visibleRows)));
            bodyValue = checkedRows.map((row: any, index: number) => {
              const expectedVersion = Number(rows[index]?.expectedVersion);
              if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new AssistantError("Không đọc được phiên bản ghi đè lương của từng nhân viên; chưa gửi cập nhật.");
              return { ...row, expectedVersion };
            });
          } else bodyValue = JSON.parse(validateStructuredField(field, value));
        }
        body[field.apiKey!] = ["workingDays", "daysOfWeek"].includes(field.apiKey!) && [
          "api.post.4e68581113f1ef79", "api.patch.08411917f1ed9b75", "api.post.5511b45cf3a736d1", "api.patch.6bc968347283a069", "worker.project.create", "worker.project.update",
        ].includes(op.id) ? normalizeWeekdays(bodyValue, field.label) : bodyValue;
      }
    } else if (field.key !== "id" && field.source !== "path" && field.source !== "query") {
      body[field.key] = field.type === "json"
        ? JSON.parse(validateStructuredField(field, input[field.key]))
        : input[field.key];
    }
  }
  if (op.method === "PATCH" && op.path === "/customers/:id" && typeof body.notes === "string") {
    // Append assistant facts while preserving the profile's existing notes.
    body.additionalNotes = body.notes;
    delete body.notes;
  }
  if (op.id === "department.update" && typeof body.name !== "string") {
    let departments: AssistantRecord[];
    try { departments = await lookupRecords(req, "department.list"); }
    catch { throw new AssistantError("Không đọc được phòng ban đã chọn; chưa thể cập nhật an toàn."); }
    const current = departments.find(department => String(department.id || "") === String(input.id || ""));
    if (typeof current?.name !== "string" || !current.name.trim()) throw new AssistantError("Không xác định được tên hiện tại của phòng ban; chưa cập nhật.");
    body.name = current.name;
  }
  if (op.id === "omni-inbox.account.ai-config.update") {
    if (!Object.keys(body).length) throw new AssistantError("Hãy nêu ít nhất một cài đặt AI cần thay đổi.");
    const config = { ...body };
    for (const field of op.fields) if (field.source === "body") delete body[field.apiKey || field.key];
    body.aiAutoReplyConfig = config;
  }
  if (op.adapter === "contract" && op.fixedBodyValues) Object.assign(body, op.fixedBodyValues);
  // The project API requires this key but explicitly accepts an empty value.
  if (op.id === "architect.project.create" && body.requirements === undefined) body.requirements = "";
  if (op.id === "hr.calendar.event.create") {
    const creatorId = String(req.user?.id || "");
    if (!/^[a-f\d]{24}$/i.test(creatorId)) throw new AssistantError("Không xác định được tài khoản tạo sự kiện.", 403);
    body.creatorId = creatorId;
  }
  if (op.id === "marketing.ai.image.edit") {
    const sourceMediaId = String(input.sourceMediaId || "");
    let sourceRecords: AssistantRecord[];
    try {
      sourceRecords = await lookupRecords(req, "marketing.media-history.list", "", { query_type: "image" });
    } catch { throw new AssistantError("Không đọc được thư viện ảnh của tài khoản; chưa chỉnh sửa ảnh."); }
    const matches = sourceRecords.filter(record => String(record.id || "") === sourceMediaId && record.mediaType === "image");
    if (matches.length !== 1) throw new AssistantError("Không tìm thấy duy nhất ảnh nguồn đã chọn trong thư viện của tài khoản.", 404);
    let sourceImageUrl = "";
    try {
      const parsed = new URL(String(matches[0].url || ""));
      if (parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com" && !parsed.username && !parsed.password && !parsed.port) sourceImageUrl = parsed.toString();
    } catch { /* reject malformed or untrusted media links */ }
    if (!sourceImageUrl) throw new AssistantError("Ảnh nguồn không có liên kết Cloudinary hợp lệ; chưa chỉnh sửa.");
    body.sourceMediaId = sourceMediaId;
    body.sourceImageUrl = sourceImageUrl;
  }
  if (op.id === "payroll.run.create") {
    const [year, month] = String(input.periodKey).split("-").map(Number);
    body.startDate = `${input.periodKey}-01`;
    body.endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  }
  if (op.adapter === "contract" && op.mergeBodyWithReference) {
    let existing: Record<string, unknown>;
    try {
      const parsed = JSON.parse(String(input.__assistantExistingRecord || ""));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid record");
      existing = parsed as Record<string, unknown>;
    } catch { throw new AssistantError("Không đọc được dữ liệu hiện tại của bản ghi; chưa thể cập nhật an toàn."); }
    for (const field of op.fields) {
      if (field.source !== "body" || op.systemBodyFields?.includes(field.apiKey || field.key)) continue;
      const key = field.apiKey || field.key;
      if (body[key] === undefined && existing[key] !== undefined) body[key] = existing[key];
    }
    if (op.id === "marketing.video-caption.project.update" && body.contextLinks && typeof body.contextLinks === "object" && !Array.isArray(body.contextLinks)) {
      const existingLinks = existing.contextLinks && typeof existing.contextLinks === "object" && !Array.isArray(existing.contextLinks)
        ? existing.contextLinks
        : {};
      body.contextLinks = { ...existingLinks, ...body.contextLinks };
    }
  }
  if (op.id === "student.standard-fields.update") {
    const changeKeys = ["label", "placeholder", "isRequired", "isVisible", "isArchived"];
    if (!changeKeys.some(key => body[key] !== undefined)) throw new AssistantError("Nêu ít nhất một thay đổi cho trường tiêu chuẩn đã chọn.");
    if (body.label !== undefined && (typeof body.label !== "string" || !body.label.trim())) throw new AssistantError("Nhãn trường mới không được để trống.");
    if (body.isVisible === false && body.isRequired === true) throw new AssistantError("Trường đang bị ẩn không thể đồng thời bắt buộc nhập.");
    const moduleKey = String(input.path_moduleKey || "");
    const fieldKey = String(input.selectedField || "");
    const listOperation = operationById("student.standard-fields.list");
    if (!moduleKey || !fieldKey || !listOperation) throw new AssistantError("Chưa xác định được phân hệ và trường tiêu chuẩn cần cập nhật.");
    let currentFields: any[];
    try {
      const current = await callOperation(req, listOperation, { path_moduleKey: moduleKey });
      if (!Array.isArray(current?.data)) throw new Error("missing standard field list");
      currentFields = current.data;
    } catch { throw new AssistantError("Không đọc được cấu hình trường tiêu chuẩn hiện tại; chưa cập nhật."); }
    if (currentFields.length > 200 || currentFields.some(field => !field || typeof field.key !== "string" || !field.key.trim()
      || typeof field.label !== "string" || typeof field.isRequired !== "boolean" || typeof field.isVisible !== "boolean" || typeof field.isArchived !== "boolean")
      || new Set(currentFields.map(field => field.key)).size !== currentFields.length) {
      throw new AssistantError("Danh sách trường tiêu chuẩn hiện tại thiếu, trùng hoặc không hợp lệ; dừng để tránh ghi đè cấu hình.");
    }
    const selected = currentFields.filter(field => field.key === fieldKey);
    if (selected.length !== 1) throw new AssistantError("Không tìm thấy duy nhất một trường tiêu chuẩn theo tên trong phân hệ đã chọn.");
    const mergedFields = currentFields.map(field => {
      const isSelected = field.key === fieldKey;
      const isVisible = isSelected && body.isVisible !== undefined ? Boolean(body.isVisible) : field.isVisible;
      const isRequired = !isVisible ? false : isSelected && body.isRequired !== undefined ? Boolean(body.isRequired) : field.isRequired;
      return {
        key: field.key,
        label: isSelected && body.label !== undefined ? String(body.label).trim() : field.label,
        placeholder: isSelected && body.placeholder !== undefined ? String(body.placeholder) : String(field.placeholder || ""),
        isRequired,
        isVisible,
        isArchived: isSelected && body.isArchived !== undefined ? Boolean(body.isArchived) : field.isArchived,
      };
    });
    for (const key of [...changeKeys, "selectedField"]) delete body[key];
    body.fields = mergedFields;
  }
  if (op.id === "worker.standard-fields.update") {
    const changeKeys = ["label", "isRequired", "isVisible", "isArchived"];
    if (!changeKeys.some(key => body[key] !== undefined)) throw new AssistantError("Nêu ít nhất một thay đổi cho trường hồ sơ lao động đã chọn.");
    if (body.label !== undefined && (typeof body.label !== "string" || !body.label.trim())) throw new AssistantError("Tên hiển thị mới không được để trống.");
    if (["isRequired", "isVisible", "isArchived"].some(key => body[key] !== undefined && typeof body[key] !== "boolean")) throw new AssistantError("Trạng thái trường hồ sơ phải là có hoặc không.");
    const fieldKey = String(input.selectedField || "");
    const listOperation = operationById("worker.standard-fields.list");
    if (!workerProfileStandardFieldKeys.has(fieldKey) || !listOperation) throw new AssistantError("Chưa xác định được trường hồ sơ lao động cần cập nhật.");
    let currentFields: any[];
    try {
      const current = await callOperation(req, listOperation, { query_moduleKey: "students" });
      const rawFields = current?.data?.__assistantExistingFields;
      if (!Array.isArray(rawFields)) throw new Error("missing raw standard fields");
      currentFields = rawFields;
    } catch { throw new AssistantError("Không đọc được cấu hình trường hồ sơ lao động hiện tại; chưa cập nhật."); }
    let serializedFields = "";
    try { serializedFields = JSON.stringify(currentFields); } catch { /* invalid config */ }
    if (!serializedFields || serializedFields.length > 200_000 || currentFields.length > 100
      || currentFields.some(field => !field || typeof field !== "object" || Array.isArray(field)
        || typeof field.key !== "string" || !field.key.trim() || typeof field.label !== "string"
        || typeof field.isRequired !== "boolean" || typeof field.isVisible !== "boolean" || typeof field.isArchived !== "boolean")
      || new Set(currentFields.map(field => field.key)).size !== currentFields.length) {
      throw new AssistantError("Danh sách trường hồ sơ lao động hiện tại thiếu, trùng hoặc không hợp lệ; dừng để tránh ghi đè cấu hình.");
    }
    const selected = currentFields.filter(field => field.key === fieldKey);
    if (selected.length !== 1) throw new AssistantError("Không tìm thấy duy nhất trường hồ sơ lao động theo tên.");
    body.fields = currentFields.map(field => {
      if (field.key !== fieldKey) return field;
      const isVisible = body.isVisible !== undefined ? body.isVisible : field.isVisible;
      const isArchived = body.isArchived !== undefined ? body.isArchived : field.isArchived;
      return {
        ...field,
        ...(body.label !== undefined ? { label: String(body.label).trim() } : {}),
        isRequired: !isVisible || isArchived ? false : body.isRequired !== undefined ? body.isRequired : field.isRequired,
        isVisible,
        isArchived,
      };
    });
    for (const key of [...changeKeys, "selectedField"]) delete body[key];
    body.moduleKey = "students";
  }
  if (op.id === "worker.partner.payout.reverse") {
    const settlementId = String(input.selectedSettlement || "");
    const payoutId = String(input.path_payoutId || "");
    const detailOperation = operationById("worker.partner.settlement.detail");
    if (!/^[a-f\d]{24}$/i.test(settlementId) || !/^[a-f\d]{24}$/i.test(payoutId) || !detailOperation) {
      throw new AssistantError("Chưa xác định được kỳ và khoản chi trả hoa hồng cần đảo.");
    }
    let detail: any;
    try { detail = await callOperation(req, detailOperation, { path_settlementId: settlementId }); }
    catch { throw new AssistantError("Không đọc được kỳ đối soát đã chọn; chưa đảo khoản chi trả."); }
    const matchingPayouts = projectRecords(detailOperation, detail, req).filter(record => String(record.payoutId || "") === payoutId && record.__assistantReversible === true);
    if (matchingPayouts.length !== 1) throw new AssistantError("Khoản chi trả không còn thuộc đúng kỳ đã chọn, đã bị đảo hoặc không thể xác định duy nhất; chưa ghi thay đổi.");
    delete body.settlementId;
  }
  if (op.id === "account.assistant-settings.update") {
    if (!Object.keys(body).length) throw new AssistantError("Hãy nêu ít nhất một cài đặt trợ lý cần thay đổi.");
    const readOperation = operationById("account.assistant-settings.read");
    if (!readOperation) throw new AssistantError("Không tìm thấy thao tác đọc cài đặt trợ lý hiện tại.");
    let existing: Record<string, unknown>;
    try {
      const current = await callOperation(req, readOperation, {} as any);
      const snapshot = current?.data?.__assistantExistingRecord;
      if (!snapshot || typeof snapshot !== "object") throw new Error("missing settings snapshot");
      existing = snapshot as Record<string, unknown>;
    } catch { throw new AssistantError("Không đọc được cài đặt trợ lý hiện tại; chưa thể cập nhật an toàn."); }
    const booleanKeys = ["enterToSend", "showSuggestions", "alwaysConfirm", "speakReplies", "wakeWordEnabled"];
    if (!Number.isSafeInteger(existing.version) || Number(existing.version) < 0
      || !["window", "fullscreen"].includes(String(existing.windowMode))
      || booleanKeys.some(key => typeof existing[key] !== "boolean")
      || typeof existing.instructions !== "string" || existing.instructions.length > 2000) {
      throw new AssistantError("Cài đặt trợ lý hiện tại thiếu hoặc không hợp lệ; chưa ghi thay đổi để tránh mất cấu hình.");
    }
    Object.assign(body, {
      version: Number(existing.version),
      windowMode: body.windowMode ?? existing.windowMode,
      enterToSend: body.enterToSend ?? existing.enterToSend,
      showSuggestions: body.showSuggestions ?? existing.showSuggestions,
      instructions: body.instructions ?? existing.instructions,
      alwaysConfirm: body.alwaysConfirm ?? existing.alwaysConfirm,
      speakReplies: body.speakReplies ?? existing.speakReplies,
      wakeWordEnabled: body.wakeWordEnabled ?? existing.wakeWordEnabled,
    });
  }
  if (op.id === "api.patch.cbf8c2b9d544f837") {
    if (!Object.keys(body).length) throw new AssistantError("Hãy nêu ít nhất một cài đặt địa điểm hoặc giờ làm cần thay đổi.");
    const readOperation = operationById("timekeeping.company.location");
    if (!readOperation) throw new AssistantError("Không tìm thấy thao tác đọc cấu hình địa điểm để giữ các giá trị hiện tại.");
    let existing: Record<string, any>;
    try {
      const current = await callOperation(req, readOperation, {} as any);
      existing = current?.data?.__assistantExistingRecord;
      if (!existing || typeof existing !== "object") throw new Error("missing config");
    } catch { throw new AssistantError("Không đọc được cấu hình địa điểm hiện tại; chưa thể cập nhật an toàn."); }
    for (const key of ["latitude", "longitude", "allowedRadius", "addressName", "checkInLimit", "checkOutLimit", "lunchBreakStart", "lunchBreakEnd", "workingDays", "annualLeaveDays"]) {
      if (body[key] === undefined && existing[key] !== undefined) body[key] = existing[key];
    }
    if (!Number.isFinite(Number(body.latitude)) || Number(body.latitude) < -90 || Number(body.latitude) > 90
      || !Number.isFinite(Number(body.longitude)) || Number(body.longitude) < -180 || Number(body.longitude) > 180
      || !Number.isFinite(Number(body.allowedRadius)) || Number(body.allowedRadius) < 1) {
      throw new AssistantError("Cấu hình vị trí hiện tại thiếu tọa độ hoặc bán kính hợp lệ; chưa thể cập nhật an toàn.");
    }
  }
  if (op.id === "api.patch.6bc968347283a069" && input.__assistantExistingRecord) {
    try {
      const existing = JSON.parse(String(input.__assistantExistingRecord));
      for (const key of ["employmentStatus", "officialDate"]) if (body[key] === undefined && existing[key] !== undefined) body[key] = existing[key];
    } catch { throw new AssistantError("Không đọc được thông tin nhân sự hiện tại; chưa thể cập nhật giờ làm an toàn."); }
  }
  for (const key of op.systemBodyFields || []) {
    const value = input[key];
    if (op.adapter === "contract" && key === "expectedRevision") {
      const expectedRevision = Number(value);
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new AssistantError("Không đọc được phiên bản hiện tại của Order; chưa thể ghi thay đổi an toàn.");
      body.expectedRevision = expectedRevision;
    }
    if (op.adapter === "contract" && key === "expectedVersion") {
      const expectedVersion = Number(value);
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new AssistantError("Không đọc được phiên bản hiện tại của bản ghi; chưa thể ghi thay đổi an toàn.");
      body.expectedVersion = expectedVersion;
    }
    if (op.id === "inventory.serial.transfer.local" && key === "toBranchId") {
      const branchId = String(input.targetBranch || req.user?.branchId || "");
      if (!/^[a-f\d]{24}$/i.test(branchId)) throw new AssistantError("Chọn chi nhánh kho theo tên trước khi chuyển IMEI hoặc serial.");
      body.toBranchId = branchId;
    }
    if (op.adapter === "contract" && key === "version" && !isRecruitmentOperation(op)) {
      const version = Number(value);
      if (!Number.isSafeInteger(version) || version < 0) throw new AssistantError("Không đọc được phiên bản hiện tại của cấu hình; chưa thể lưu thay đổi.");
      body.version = version;
    }
    if (op.adapter === "contract" && key === "revision") {
      const revision = Number(value);
      if (!Number.isSafeInteger(revision) || revision < 0) throw new AssistantError("Không đọc được phiên bản công việc hiện tại; chưa thể ghi thay đổi.");
      body.revision = revision;
    }
    if (key === "version" && isRecruitmentOperation(op)) {
      const version = Number(value);
      if (!Number.isSafeInteger(version) || version < 0) throw new AssistantError("Không đọc được phiên bản hiện tại của dữ liệu tuyển dụng; chưa thể ghi thay đổi.");
      body.version = version;
    }
    if (op.id === "payroll.employee.reconciliation.action" && key === "expectedVersion") {
      const expectedVersion = Number(value);
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new AssistantError("Không đọc được phiên bản đối soát lương hiện tại; chưa thể gửi thao tác.");
      body.expectedVersion = expectedVersion;
    }
    if (op.id === "payroll.employee.reconciliation.action" && key === "issueId" && typeof value === "string" && value) body.issueId = value;
    if (op.id === "payroll.run.reconciliation.action" && key === "issueId" && typeof value === "string" && value) body.issueId = value;
    if (op.adapter === "contract" && key === "cashSessionId" && typeof value === "string" && value) body.cashSessionId = value;
    if (op.adapter === "contract" && ["terminalId", "expectedTerminalId"].includes(key)) {
      const terminalId = String(value ?? "");
      if ((key === "terminalId" && !terminalId) || terminalId.length > 150) throw new AssistantError("Không xác định được thiết bị POS hiện tại; chưa thể thao tác với ca.");
      body[key] = terminalId;
    }
  }
  if ((op.id === "recruitment.job.create" || op.id === "recruitment.job.update") && body.status === "open") {
    const missing = missingRecruitmentJobReadiness(body);
    if (missing.length) throw new AssistantError(`Chưa thể mở tuyển. Cần điền: ${missing.join(", ")}.`);
  }
  if (op.id.startsWith("retail.partner.create.")) {
    if (!["collaborator", "dealer", "supplier"].includes(String(body.role || ""))) throw new AssistantError("Chọn vai trò cộng tác viên, đại lý hoặc nhà cung cấp.");
    body.roles = [body.role];
    delete body.role;
  }
  if (op.id === "retail.partner.update") {
    const partnerId = String(input.path_id || "");
    const existing = (await lookupRecords(req, "retail.partner.list")).find(record => String(record.id || "") === partnerId);
    if (!existing) throw new AssistantError("Không tìm thấy đối tác bán lẻ theo tên hoặc mã trong phạm vi công ty.", 404);
    for (const key of ["code", "name", "role", "phone", "email", "address", "status"]) {
      if (body[key] === undefined) body[key] = existing[key];
    }
    if (!["collaborator", "dealer", "supplier"].includes(String(body.role || ""))) throw new AssistantError("Không xác định được vai trò hiện tại của đối tác.");
    body.roles = [body.role];
    delete body.role;
    for (const key of ["code", "name"]) if (typeof body[key] !== "string" || !String(body[key]).trim()) throw new AssistantError(`Không xác định được ${key === "code" ? "mã" : "tên"} hiện tại của đối tác.`);
  }
  if (op.id === "company-knowledge.documents.scopes.update") {
    const documentId = String(input.path_id || "");
    const existing = (await lookupRecords(req, "company-knowledge.documents.list")).find(record => String(record.id || "") === documentId);
    if (!existing) throw new AssistantError("Không tìm thấy tài liệu theo tên trong kho tri thức của công ty.", 404);
    if (body.channelScope === undefined) body.channelScope = existing.channelScope;
    if (body.purposeScope === undefined) body.purposeScope = existing.purposeScope;
    if (!Array.isArray(body.channelScope) || !body.channelScope.length || !Array.isArray(body.purposeScope) || !body.purposeScope.length) {
      throw new AssistantError("Không đọc được kênh và mục đích hiện tại của tài liệu; chưa thể cập nhật an toàn.");
    }
  }
  if (op.id === "inventory.variant.bulk.update" || op.id === "inventory.variant.bulk.delete") {
    if (!Array.isArray(body.ids) || body.ids.length < 1 || body.ids.length > 20) throw new AssistantError("Chọn từ 1 đến 20 sản phẩm/SKU cần thao tác.");
    const variantIds = body.ids.map((item: any) => {
      if (!item || typeof item !== "object" || Array.isArray(item) || !/^[a-f\d]{24}$/i.test(String(item.productId || "")) || !/^[a-f\d]{24}$/i.test(String(item.variantId || ""))) {
        throw new AssistantError("Mỗi SKU phải được phân giải chính xác từ tên sản phẩm và mã/tên biến thể.");
      }
      return String(item.variantId);
    });
    if (new Set(variantIds).size !== variantIds.length) throw new AssistantError("Danh sách có SKU bị lặp. Hãy chỉ chọn mỗi SKU một lần.");
    body.ids = variantIds;
  }
  if (op.id === "retail.after-sale.create") {
    let preparedItems: unknown;
    try { preparedItems = JSON.parse(String(input.__assistantAfterSaleItems || "")); } catch { preparedItems = undefined; }
    if (!Array.isArray(preparedItems) || !preparedItems.length) throw new AssistantError("Chưa có danh sách sản phẩm đã đối chiếu với đơn gốc; chưa tạo phiếu hậu mãi.");
    if (body.paymentMethod === "cash" && !String(body.cashSessionId || "")) throw new AssistantError("Hoàn/chi tiền mặt cần ca POS đang mở; chưa tạo phiếu hậu mãi.");
    body.items = preparedItems;
    delete body.shiftSelector;
  }
  if (op.contextBody?.includes("idempotencyKey")) { if (!requestId) throw new AssistantError("Thiếu mã yêu cầu để bảo vệ thao tác trùng."); body.idempotencyKey = requestId; }
  if (op.id === "retail.order.quote") {
    // Unlike checkout, the quote endpoint receives order fields at the root.
    const orderInput = body.input;
    if (!orderInput || typeof orderInput !== "object" || Array.isArray(orderInput)) throw new AssistantError("Chưa có thông tin đơn hàng để tính giá.");
    delete body.input;
    Object.assign(body, orderInput);
  }
  for (const key of op.contextBody || []) if (key !== "idempotencyKey") {
    if (!requestId) throw new AssistantError("Thiếu mã yêu cầu để bảo vệ thao tác trùng.");
    body[key] = requestId;
  }
  if (op.id === "hr.workflow.create") {
    if (!req.user?.id) throw new AssistantError("Kh\u00F4ng x\u00E1c \u0111\u1ECBnh \u0111\u01B0\u1EE3c ng\u01B0\u1EDDi t\u1EA1o quy tr\u00ECnh.", 403);
    if (!Array.isArray(body.steps) || body.steps.length < 1 || body.steps.length > 30) {
      throw new AssistantError("Quy tr\u00ECnh l\u00E0m vi\u1EC7c c\u1EA7n t\u1EEB 1 \u0111\u1EBFn 30 b\u01B0\u1EDBc.");
    }
    body.creatorUid = req.user.id;
    body.steps = body.steps.map((step: any, index: number) => {
      if (!step || typeof step !== "object" || Array.isArray(step) || typeof step.title !== "string" || !step.title.trim()) {
        throw new AssistantError(`B\u01B0\u1EDBc ${index + 1}: c\u1EA7n c\u00F3 t\u00EAn b\u01B0\u1EDBc.`);
      }
      return {
        ...step,
        id: randomUUID(),
        assigneeUid: "",
        assignee: "",
        estDays: typeof step.estDays === "number" ? step.estDays : 1,
        position: { x: index * 220, y: 0 },
      };
    });
  }
  if (op.id === "hr.workflow.update") applyWorkWorkflowMutation(body, input);
  if (op.id === "hr.workflow.update" && body.steps !== undefined) {
    let existing: Record<string, any>;
    try {
      const parsed = JSON.parse(String(input.__assistantExistingRecord || ""));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Array.isArray(parsed.steps)) throw new Error("missing workflow snapshot");
      existing = parsed;
    } catch {
      throw new AssistantError("Kh\u00F4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c c\u00E1c b\u01B0\u1EDBc hi\u1EC7n t\u1EA1i; ch\u01B0a c\u1EADp nh\u1EADt \u0111\u1EC3 tr\u00E1nh m\u1EA5t d\u1EEF li\u1EC7u.");
    }
    const existingSteps: any[] = existing.steps;
    if (!Array.isArray(body.steps) || body.steps.length < 1 || body.steps.length > 30) {
      throw new AssistantError("Danh s\u00E1ch b\u01B0\u1EDBc c\u1EADp nh\u1EADt c\u1EA7n t\u1EEB 1 \u0111\u1EBFn 30 m\u1EE5c.");
    }
    const requestedSteps: any[] = body.steps as any[];
    if (Number(existing.stepCount ?? existingSteps.length) > 30 || existingSteps.length !== Number(existing.stepCount ?? existingSteps.length)) {
      throw new AssistantError("Quy tr\u00ECnh c\u00F3 qu\u00E1 30 b\u01B0\u1EDBc ho\u1EB7c danh s\u00E1ch b\u01B0\u1EDBc ch\u01B0a \u0111\u1EA7y \u0111\u1EE7; h\u00E3y c\u1EADp nh\u1EADt trong m\u00E0n h\u00ECnh quy tr\u00ECnh.");
    }
    const usedStepIndexes = new Set<number>();
    const nextSteps = requestedSteps.map((step, index) => {
      if (!step || typeof step !== "object" || Array.isArray(step) || typeof step.title !== "string" || !step.title.trim()) {
        throw new AssistantError(`B\u01B0\u1EDBc ${index + 1}: c\u1EA7n c\u00F3 t\u00EAn b\u01B0\u1EDBc.`);
      }
      const existingTitle = typeof step.existingTitle === "string" ? step.existingTitle.trim() : "";
      let matchedIndex = -1;
      if (step.existingStepNumber !== undefined) {
        const requestedIndex = Number(step.existingStepNumber) - 1;
        if (!Number.isInteger(requestedIndex) || requestedIndex < 0 || requestedIndex >= existingSteps.length) {
          throw new AssistantError(`V\u1ECB tr\u00ED b\u01B0\u1EDBc hi\u1EC7n t\u1EA1i c\u1EE7a "${existingTitle || step.title}" kh\u00F4ng h\u1EE3p l\u1EC7.`);
        }
        const selectedTitle = String(existingSteps[requestedIndex]?.title || "");
        if (existingTitle && normalize(existingTitle) !== normalize(selectedTitle)) {
          throw new AssistantError(`B\u01B0\u1EDBc s\u1ED1 ${requestedIndex + 1} kh\u00F4ng ph\u1EA3i "${existingTitle}"; ch\u01B0a c\u1EADp nh\u1EADt.`);
        }
        matchedIndex = requestedIndex;
      } else {
        const selector = existingTitle || step.title;
        const matches = existingSteps.flatMap((candidate, candidateIndex) => normalize(String(candidate?.title || "")) === normalize(selector) ? [candidateIndex] : []);
        if (matches.length > 1) throw new AssistantError(`T\u00EAn b\u01B0\u1EDBc "${selector}" b\u1ECB tr\u00F9ng; vui l\u00F2ng n\u00EAu th\u00EAm v\u1ECB tr\u00ED b\u01B0\u1EDBc hi\u1EC7n t\u1EA1i.`);
        if (matches.length === 1) matchedIndex = matches[0];
        else if (existingTitle) throw new AssistantError(`Kh\u00F4ng t\u00ECm th\u1EA5y b\u01B0\u1EDBc hi\u1EC7n t\u1EA1i "${existingTitle}"; ch\u01B0a c\u1EADp nh\u1EADt.`);
      }
      if (matchedIndex >= 0 && usedStepIndexes.has(matchedIndex)) {
        throw new AssistantError(`B\u01B0\u1EDBc "${String(existingSteps[matchedIndex]?.title || step.title)}" \u0111ang b\u1ECB d\u00F9ng nhi\u1EC1u l\u1EA7n trong danh s\u00E1ch c\u1EADp nh\u1EADt.`);
      }
      if (matchedIndex >= 0) usedStepIndexes.add(matchedIndex);
      const prior = matchedIndex >= 0 ? existingSteps[matchedIndex] : {};
      const { existingTitle: _existingTitle, existingStepNumber: _existingStepNumber, ...requestedValues } = step;
      return {
        ...prior,
        ...requestedValues,
        id: typeof prior.id === "string" && prior.id ? prior.id : randomUUID(),
        assigneeUid: typeof prior.assigneeUid === "string" ? prior.assigneeUid : "",
        assignee: typeof prior.assignee === "string" ? prior.assignee : "",
        estDays: typeof requestedValues.estDays === "number" ? requestedValues.estDays : typeof prior.estDays === "number" ? prior.estDays : 1,
        type: typeof prior.type === "string" ? prior.type : "task",
        position: { x: index * 220, y: typeof prior.position?.y === "number" ? prior.position.y : 0 },
      };
    });
    const stepIds = new Set(nextSteps.map(step => String(step.id)));
    body.steps = nextSteps;
    body.edges = (Array.isArray(existing.edges) ? existing.edges : []).filter((edge: any) =>
      stepIds.has(String(edge?.source || "")) && stepIds.has(String(edge?.target || "")));
  }
  if (op.method !== "GET" && op.method !== "DELETE") {
    if (op.id.startsWith("employee.")) { body.companyCode = companyCode; if (op.id === "employee.create") { body.role = "user"; body.password = password; body.branchId = req.user?.branchId || ""; } }
    if (op.id === "training.create") {
      body.creatorUid = req.user!.id;
      body.icon = "GraduationCap";
      body.instructor = String(body.instructor || req.user?.displayName || req.user?.email || "iGen Academy");
    }
    if (op.id === "inventory.serial.transition") body.eventType = "assistant_status_change";
    if (op.id === "finance.asset.inventory.open") {
      const branchId = String(req.user?.branchId || "");
      if (!branchId) throw new AssistantError("Mở phiên kiểm kê cần tài khoản gắn với chi nhánh.");
      body.scope = "branch";
      body.branchIds = [branchId];
    }
    if (op.id === "inventory.transfer.create") {
      if (!effectiveBranchId) throw new AssistantError("Tạo phiếu điều chuyển cần chọn chi nhánh gửi theo tên.");
    }
    // APIs already derive company and branch from the authenticated context.
  }
  if (op.id === "finance.receivable.entry.reversal") {
    const entries = await lookupRecords(req, "finance.receivable.detail", "", {
      path_id: String(input.path_id || ""),
      ...(input.targetBranch === undefined ? {} : { targetBranch: input.targetBranch }),
    });
    if (!entries.some(entry => String(entry.id || "") === String(input.path_entryId || ""))) {
      throw new AssistantError("Không tìm thấy khoản thu hoặc điều chỉnh còn hiệu lực trong khoản phải thu đã chọn; chưa đảo bút toán.", 409);
    }
  }
  let response: globalThis.Response;
  try {
    response = await fetch(url, { method: op.method, headers, redirect: "error", signal: AbortSignal.timeout(45_000), ...(op.method === "GET" || (op.method === "DELETE" && !op.fields.some(f => f.source === "body")) ? {} : { body: JSON.stringify(body) }) });
  } catch {
    if (op.method !== "GET" && !op.readOnly) throw new UncertainExecutionError("Chưa xác định được thao tác đã hoàn tất hay chưa. Hãy kiểm tra dữ liệu trước khi tạo yêu cầu mới; hệ thống sẽ không tự chạy lại.");
    throw new AssistantError("Không thể kết nối API nghiệp vụ. Vui lòng thử lại.", 503);
  }
  if (op.assistantFileFormat && response.ok) {
    const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const fileTypes = {
      pdf: { mimeType: "application/pdf", extension: ".pdf", fallback: "hoa-don-ban-le.pdf" },
      xlsx: { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: ".xlsx", fallback: "bao-cao-ban-le.xlsx" },
    } as const;
    const fileType = fileTypes[op.assistantFileFormat];
    if (contentType !== fileType.mimeType) throw new AssistantError(`API xuất tệp không trả đúng định dạng ${op.assistantFileFormat.toUpperCase()}.`, 502);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new AssistantError("Tệp xuất rỗng hoặc vượt quá 20 MB. Hãy thu hẹp khoảng ngày.", 422);
    const header = response.headers.get("content-disposition") || "";
    const matched = header.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
    let fileName = matched?.[1] || matched?.[2] || fileType.fallback;
    try { fileName = decodeURIComponent(fileName); } catch { /* Keep the plain filename. */ }
    fileName = fileName.replace(/[\\/\r\n]/g, "_").replace(/[a-f\d]{24}/gi, "hoa-don").slice(0, 200);
    if (!fileName.toLowerCase().endsWith(fileType.extension)) fileName += fileType.extension;
    return { success: true, data: { fileName, format: op.assistantFileFormat }, __assistantFile: {
      bytes, format: op.assistantFileFormat, fileName, mimeType: fileType.mimeType,
    } };
  }
  const result = await response.json().catch(() => null) as any;
  if (response.ok && result?.success !== false && result?.status !== "error"
    && op.path === "/retail/finance/commission/balances" && op.analysis) {
    const rows = Array.isArray(result?.data) ? result.data : [];
    const data = rows.flatMap((row: any) => typeof row?.partnerName === "string" && typeof row?.partnerCode === "string"
      && typeof row?.balance === "number" && Number.isFinite(row.balance)
      ? [{ partnerName: row.partnerName, partnerCode: row.partnerCode, balance: row.balance }]
      : []);
    if (data.length !== rows.length) throw new AssistantError("Số dư hoa hồng thiếu tên, mã hoặc số tiền hợp lệ để tổng hợp.", 502);
    return { data, analysisComplete: true };
  }
  if (response.ok && result?.success !== false && result?.status !== "error" && op.analysis
    && ["partner.analysis", "api.get.78da159ec226e07e"].includes(op.id)) {
    const rows = op.id === "partner.analysis" ? result.partners : result.data;
    if (!Array.isArray(rows)) throw new AssistantError("Không đọc được danh sách đối tác đầy đủ.", 502);
    const data = rows.map((row: any) => Object.fromEntries(Object.entries(op.analysis!.fields).map(([key, definition]) => {
      let value = row?.[key];
      if (op.id === "partner.analysis" && definition.type === "text" && key !== "name" && value == null) value = "";
      if (op.id === "partner.analysis" && key === "isActive") value = row?.isActive === true ? "active" : "inactive";
      if (op.id === "partner.analysis" && key === "hasBankAccount") value = (row?.hasBankAccount ?? Boolean(String(row?.bankAccountNo || "").trim())) ? "has" : "missing";
      if (op.id === "partner.analysis" && key === "bankAccountNo") {
        const digits = String(row?.bankAccountNo || "").replace(/\D/g, "");
        value = digits ? `•••• ${digits.slice(-4)}` : "";
      }
      if (definition.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) throw new AssistantError(`Thiếu dữ liệu ${definition.label.toLowerCase()} để phân tích.`, 502);
      if (definition.type === "text" && typeof value !== "string") throw new AssistantError(`Thiếu dữ liệu ${definition.label.toLowerCase()} để phân tích.`, 502);
      return [key, value];
    })));
    return op.id === "partner.analysis"
      ? { data, analysisPage: { total: result.total, page: result.page, keys: rows.map((row: any) => String(row._id || "")) } }
      : { data, analysisComplete: true };
  }
  if (response.ok && result?.success !== false && result?.status !== "error" && op.id === "batch.capacity.report" && op.analysis) {
    const batches = Array.isArray(result?.batches) ? result.batches : [];
    const total = Number(result?.total);
    const page = Number(result?.page);
    if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(page) || page < 1) {
      throw new AssistantError("Không đọc được tổng số lớp để kiểm tra sĩ số đầy đủ.", 502);
    }
    const data = batches.map((batch: any) => {
      const remainingSlots = typeof batch.remainingSlots === "number" && Number.isFinite(batch.remainingSlots) ? batch.remainingSlots : null;
      return {
        code: String(batch.code || ""),
        name: String(batch.name || ""),
        courseCode: String(batch.courseCode || ""),
        courseTitle: String(batch.courseTitle || ""),
        instructorName: String(batch.instructorName || ""),
        enrolledCount: Number(batch.enrolledCount) || 0,
        maxLearners: Number(batch.maxLearners) || 0,
        remainingSlots,
        capacityStatus: remainingSlots === null || remainingSlots > 0 ? "available" : "full",
        status: String(batch.status || ""),
      };
    });
    const keys = batches.map((batch: any) => String(batch._id || batch.id || ""));
    if (keys.some((key: string) => !key)) throw new AssistantError("Thiếu khóa đối chiếu phân trang lớp học; chưa lọc dữ liệu.", 502);
    return { data, analysisPage: { total, page, keys } };
  }
  if (response.ok && result?.success !== false && result?.status !== "error" && op.id === "inventory.transfer.list" && op.analysis && input.analysis) {
    const source = result?.data && typeof result.data === "object" ? result.data : {};
    const items = Array.isArray(source.items) ? source.items : [];
    const total = Number(source.total), page = Number(source.page);
    if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(page) || page < 1) {
      throw new AssistantError("Không đọc được tổng số phiếu điều chuyển để thống kê đầy đủ.", 502);
    }
    const data = items.map((item: any) => {
      if (!item || typeof item.status !== "string" || !["in_transit", "received", "cancelled", "reversed"].includes(item.status)) {
        throw new AssistantError("Phiếu điều chuyển thiếu trạng thái hợp lệ để thống kê.", 502);
      }
      return { code: typeof item.transferCode === "string" ? item.transferCode : String(item.code || ""), status: item.status };
    });
    const keys = items.map((item: any) => String(item?._id || item?.id || ""));
    if (keys.some((key: string) => !key)) throw new AssistantError("Thiếu mã đối chiếu phân trang phiếu điều chuyển; chưa tính kết quả.", 502);
    return { data, analysisPage: { total, page, keys } };
  }
  if (response.ok && result?.success !== false && result?.status !== "error"
    && op.id === "retail.order.completed-unpaid.report" && op.analysis) {
    const source = result?.data && typeof result.data === "object" ? result.data : {};
    const items = Array.isArray(source.items) ? source.items : [];
    const total = Number(source.total);
    const page = Number(source.page);
    if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(page) || page < 1) {
      throw new AssistantError("Không đọc được tổng số đơn bán lẻ để kiểm tra công nợ đầy đủ.", 502);
    }
    const data = items.map((item: any) => {
      if (!item || typeof item.orderCode !== "string" || !item.orderCode.trim()
        || typeof item.status !== "string" || typeof item.paymentStatus !== "string"
        || ![item.grandTotal, item.paidAmount, item.dueAmount].every(value => typeof value === "number" && Number.isFinite(value))) {
        throw new AssistantError("Thiếu trạng thái hoặc số tiền của đơn bán lẻ; chưa thể lọc đơn còn nợ.", 502);
      }
      return {
        orderCode: item.orderCode,
        customerName: typeof item.customerName === "string" ? item.customerName : "",
        status: item.status,
        paymentStatus: item.paymentStatus,
        grandTotal: item.grandTotal,
        paidAmount: item.paidAmount,
        dueAmount: item.dueAmount,
        businessDate: typeof item.businessDate === "string" ? item.businessDate : "",
      };
    });
    const keys = items.map((item: any) => String(item?._id || item?.id || ""));
    if (keys.some((key: string) => !key)) throw new AssistantError("Thiếu khóa đối chiếu phân trang đơn bán lẻ; chưa lọc dữ liệu.", 502);
    return { data, analysisPage: { total, page, keys } };
  }
  if (response.ok && result?.success !== false && result?.status !== "error" && op.id === "student.learning-roadmap.waitlist.count" && op.analysis) {
    const total = Number(result?.total);
    if (!Number.isSafeInteger(total) || total < 0) throw new AssistantError("Không đọc được tổng số học viên trong danh sách chờ lớp.", 502);
    return { data: [{ waitingCount: total }], analysisComplete: true };
  }
  if (response.ok && result?.success !== false && result?.status !== "error" && op.analysis && op.path === "/worker-management/partners/kpi") {
    const source = result?.data;
    if (!Array.isArray(source?.items)) throw new AssistantError("Không đọc được dữ liệu KPI đầy đủ.", 502);
    const rows = source.items.map((row: any) => {
      if (!row || typeof row.partner?.name !== "string" || !["achieved", "incomplete", "not_set"].includes(row.status)
        || ![row.targetReferrals, row.actualReferrals].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0)
        || ![row.remainingReferrals, row.completionRate].every(n => n === null || (typeof n === "number" && Number.isFinite(n) && n >= 0))) {
        throw new AssistantError("Dữ liệu KPI chưa đủ hoặc không hợp lệ để tính kết quả.", 502);
      }
      return { partnerName: row.partner.name, partnerCode: row.partner.code || "", targetReferrals: row.targetReferrals,
        actualReferrals: row.actualReferrals, remainingReferrals: row.remainingReferrals, completionRate: row.completionRate, status: row.status };
    });
    // This endpoint returns the complete scoped partner population, without pagination.
    return { data: rows, analysisComplete: true, periodStart: source.periodStart, periodEnd: source.periodEnd };
  }
  if (response.ok && result?.success !== false && result?.status !== "error" && op.id === "worker.partner.settlements.list") {
    if (!Array.isArray(result?.data)) throw new AssistantError("Không đọc được đầy đủ các kỳ đối soát hoa hồng.", 502);
    const rows = result.data.map((row: any) => {
      const partner = row?.partnerId && typeof row.partnerId === "object" ? row.partnerId : {};
      return {
        partnerName: typeof partner.name === "string" ? partner.name : "",
        partnerCode: typeof partner.code === "string" ? partner.code : "",
        periodStart: typeof row.periodStart === "string" ? row.periodStart : "",
        periodEnd: typeof row.periodEnd === "string" ? row.periodEnd : "",
        status: typeof row.status === "string" ? row.status : "",
        totalAmount: typeof row.totalAmount === "number" && Number.isFinite(row.totalAmount) ? row.totalAmount : null,
        paidAmount: typeof row.paidAmount === "number" && Number.isFinite(row.paidAmount) ? row.paidAmount : null,
        balanceAmount: typeof row.balanceAmount === "number" && Number.isFinite(row.balanceAmount) ? row.balanceAmount : null,
      };
    });
    return { data: rows, analysisComplete: true };
  }
  if (response.ok && result?.success !== false && op.id === "student.resource.bookings.list") {
    const resource = result?.data && typeof result.data === "object" ? result.data : {};
    const bookings = Array.isArray(resource.bookings) ? resource.bookings : [];
    return { status: "success", data: bookings.flatMap((booking: any) => {
      const id = String(booking?._id || booking?.id || "");
      if (!/^[a-f\d]{24}$/i.test(id)) return [];
      return [{ id, purpose: booking.purpose, by: booking.by, date: booking.date, startTime: booking.startTime, endTime: booking.endTime }];
    }) };
  }
  if (response.ok && result?.success !== false && op.id === "student.learning-roadmap.progression.list") {
    const progression = result?.data && typeof result.data === "object" ? result.data : {};
    const rows = Array.isArray(progression.rows) ? progression.rows : [];
    return { status: "success", data: rows.flatMap((row: any) => {
      const id = String(row?.studentId || "");
      if (!/^[a-f\d]{24}$/i.test(id) || typeof row?.studentName !== "string") return [];
      return [{
        id,
        studentName: row.studentName,
        studentPhone: typeof row.studentPhone === "string" ? row.studentPhone : "",
        sourceStepName: typeof row.sourceStepName === "string" ? row.sourceStepName : "",
        targetStepName: typeof row.targetStepName === "string" ? row.targetStepName : "",
        attendanceRate: typeof row.attendanceRate === "number" ? row.attendanceRate : null,
        assignmentRate: typeof row.assignmentRate === "number" ? row.assignmentRate : null,
        miniTestRate: typeof row.miniTestRate === "number" ? row.miniTestRate : null,
        examRate: typeof row.examRate === "number" ? row.examRate : null,
        teacherAssessment: typeof row.teacherAssessment === "string" ? row.teacherAssessment : "",
        eligible: row.eligible === true,
        eligibilityReasonSummary: typeof row.eligibilityReasonSummary === "string" ? row.eligibilityReasonSummary : "",
        intent: typeof row.intent === "string" ? row.intent : "pending",
        teacherNote: typeof row.teacherNote === "string" ? row.teacherNote : "",
        overrideEligible: typeof row.overrideEligible === "boolean" ? row.overrideEligible : null,
        overrideReason: typeof row.overrideReason === "string" ? row.overrideReason : "",
      }];
    }) };
  }
  if (response.ok && result?.success !== false && op.id === "student.learning-roadmap.progression.update") {
    const data = result?.data && typeof result.data === "object" ? result.data : {};
    const decision = data.decision && typeof data.decision === "object" ? data.decision : {};
    return { status: "success", data: { queued: data.queued === true, intent: typeof decision.intent === "string" ? decision.intent : "" } };
  }
  if (["company-email.smtp.verify", "company-email.smtp.test"].includes(op.id)
    && (!response.ok || !result || result.success === false || result.status === "error")) {
    if (response.status >= 500 || !result) {
      throw new UncertainExecutionError(op.id === "company-email.smtp.test"
        ? "Chưa xác định được email thử đã gửi hay chưa. Hãy kiểm tra hộp thư của bạn trước khi gửi yêu cầu mới."
        : "Chưa xác định được kết quả kết nối SMTP. Hãy kiểm tra cấu hình trước khi thử lại.");
    }
    throw new AssistantError(op.id === "company-email.smtp.test"
      ? "Không gửi được email thử. Hãy kiểm tra cấu hình SMTP công ty và hộp thư của bạn."
      : "Không xác thực được kết nối SMTP. Hãy kiểm tra cấu hình SMTP công ty.", response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  if (op.id === "company-email.smtp.verify") {
    if (result?.success !== true) throw new AssistantError("Máy chủ SMTP chưa xác nhận kết nối thành công.", 502);
    return { status: "success", data: { verified: true } };
  }
  if (op.id === "company-email.smtp.test") {
    const messageId = result?.messageId ?? result?.data?.messageId;
    if (typeof messageId !== "string" || !messageId.trim()) {
      throw new UncertainExecutionError("API chưa xác nhận email thử đã gửi. Hãy kiểm tra hộp thư của bạn trước khi gửi yêu cầu mới.");
    }
    return { status: "success", data: { sent: true } };
  }
  if (op.id === "company-email.smtp.config" && (!response.ok || !result || result.success === false || result.status === "error")) {
    throw new AssistantError("Không thể đọc tóm tắt cấu hình SMTP công ty. Hãy kiểm tra quyền cài đặt.", response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  if (op.id === "company-email.smtp.config") {
    const smtp = result?.data && typeof result.data === "object" && !Array.isArray(result.data) ? result.data : null;
    if (!smtp) return { status: "success", data: { configured: false } };
    const summary: Record<string, unknown> = { configured: true };
    if (typeof smtp.host === "string") summary.host = smtp.host.trim().slice(0, 200);
    if (Number.isSafeInteger(smtp.port) && smtp.port >= 1 && smtp.port <= 65535) summary.port = smtp.port;
    if (typeof smtp.secure === "boolean") summary.secure = smtp.secure;
    if (typeof smtp.user === "string") summary.user = smtp.user.trim().slice(0, 254);
    if (typeof smtp.fromEmail === "string") summary.fromEmail = smtp.fromEmail.trim().slice(0, 254);
    if (typeof smtp.fromName === "string") summary.fromName = smtp.fromName.trim().slice(0, 120);
    if (typeof smtp.hasPassword === "boolean") summary.hasPassword = smtp.hasPassword;
    return { status: "success", data: summary };
  }
  if (op.id === "payroll.run.payslip.review-requests.list" && response.ok && result?.success !== false && result?.status !== "error") {
    if (!Array.isArray(result?.data)) throw new AssistantError("Không đọc được danh sách yêu cầu kiểm tra phiếu lương hợp lệ.", 502);
    const requests = result.data;
    return { ...result, data: requests.map((request: any) => {
      const safe: Record<string, any> = {
        employeeName: typeof request.employeeName === "string" ? request.employeeName : undefined,
        periodKey: typeof request.periodKey === "string" ? request.periodKey : undefined,
        status: ["open", "resolved"].includes(String(request.status)) ? request.status : undefined,
        message: typeof request.message === "string" ? request.message : undefined,
        response: typeof request.response === "string" ? request.response : undefined,
        createdAt: typeof request.createdAt === "string" ? request.createdAt : undefined,
        resolvedAt: typeof request.resolvedAt === "string" ? request.resolvedAt : undefined,
      };
      Object.defineProperty(safe, "__assistantRef", {
        value: { id: String(request.id || request._id || ""), reviewRequest: true }, enumerable: false,
      });
      return safe;
    }) };
  }
  if (op.id === "student.email.send" && (!response.ok || !result || result.success === false || result.status === "error")) {
    if (response.status >= 500 || !result) throw new UncertainExecutionError("Chưa xác định được email đã gửi hay chưa. Hãy kiểm tra trước khi gửi yêu cầu mới; hệ thống không tự gửi lại.");
    throw new AssistantError("Không gửi được email. Hãy kiểm tra địa chỉ nhận và cấu hình gửi thư của công ty.", response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  if (op.id === "marketing.ai.image.generate" && (!response.ok || !result || result.success === false || result.status === "error")) {
    if (response.status >= 500 || !result) throw new UncertainExecutionError("Chưa xác định được ảnh đã lưu và lượt AI đã trừ hay chưa. Hãy kiểm tra thư viện media và số dư trước khi yêu cầu tạo lại.");
    throw new AssistantError("Không thể tạo ảnh. Hãy kiểm tra mô tả và cấu hình AI của tài khoản.", response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  if (op.id === "marketing.ai.image.edit" && (!response.ok || !result || result.success === false || result.status === "error")) {
    if (response.status >= 500 || !result) throw new UncertainExecutionError("Chưa xác định được ảnh mới đã lưu và lượt AI đã trừ hay chưa. Hãy kiểm tra thư viện media và số dư trước khi chỉnh sửa lại.");
    throw new AssistantError("Không thể chỉnh sửa ảnh. Hãy kiểm tra mô tả và cấu hình AI của tài khoản.", response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  if (op.id === "marketing.elevenlabs.custom-voice.preview" && (!response.ok || !result || result.success === false || result.status === "error")) {
    if (response.status >= 500 || !result) throw new UncertainExecutionError("Chưa xác định được bản nghe thử đã tạo hoặc lượt AI đã trừ hay chưa. Hãy kiểm tra trước khi tạo yêu cầu mới.");
    throw new AssistantError("Không thể tạo bản nghe thử giọng. Hãy kiểm tra cấu hình ElevenLabs và văn bản.", response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  if (op.id === "resource.google-drive.list" && (!response.ok || !result || result.success === false || result.status === "error")) {
    throw new AssistantError("Không thể lấy danh sách Google Drive. Hãy kiểm tra kết nối tài khoản và quyền truy cập.", response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  if (op.id === "student.online-attendance.create-sessions" && (!response.ok || !result || result.success === false || result.status === "error")) {
    if (response.status >= 500 || !result) throw new UncertainExecutionError("Chưa xác định được mã điểm danh đã gửi cho bao nhiêu học viên. Hãy kiểm tra lớp và ngày trước khi yêu cầu gửi lại.");
    throw new AssistantError("Không thể gửi mã điểm danh. Hãy kiểm tra lớp, ngày và quyền truy cập.", response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  if (op.id === "worker.standard-fields.list" && (!response.ok || !result || result.success === false || result.status === "error")) {
    throw new AssistantError("Không thể đọc cấu hình trường hồ sơ lao động.", response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  if (op.id === "worker.standard-fields.update" && (!response.ok || !result || result.success === false || result.status === "error")) {
    if (response.status >= 500 || !result) throw new UncertainExecutionError("Chưa xác định được cấu hình trường hồ sơ lao động đã lưu hay chưa. Hãy đọc lại cấu hình trước khi gửi yêu cầu mới.");
    throw new AssistantError("Không thể cập nhật cấu hình trường hồ sơ lao động.", response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  if (op.id === "payroll.run.payslips.publish" && (!response.ok || !result || result.success === false || result.status === "error")) {
    if (response.status >= 500 || !result) throw new UncertainExecutionError("Chưa xác định được đã công bố bao nhiêu phiếu lương. Hãy kiểm tra trạng thái công bố của lượt lương trước khi gửi yêu cầu mới.");
    if (response.status === 409) throw new AssistantError("Chỉ có thể công bố phiếu lương cho lượt đã chốt hoặc đã thanh toán.", 409);
    throw new AssistantError("Không thể công bố phiếu lương. Hãy kiểm tra quyền thanh toán và trạng thái lượt lương.", response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  if (op.id === "payroll.run.payslips.withdraw" && (!response.ok || !result || result.success === false || result.status === "error")) {
    if (response.status >= 500 || !result) throw new UncertainExecutionError("Chưa xác định được phiếu lương đã thu hồi hay chưa. Hãy kiểm tra trạng thái phiếu trước khi gửi yêu cầu mới.");
    if (response.status === 404) throw new AssistantError("Không tìm thấy phiếu lương đang được công bố cho nhân viên và lượt lương đã chọn.", 404);
    throw new AssistantError("Không thể thu hồi phiếu lương. Hãy kiểm tra quyền thanh toán và thông tin lượt lương.", response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  if (!response.ok || !result || result.success === false || result.status === "error") {
    if (op.method !== "GET" && !op.readOnly && (response.status >= 500 || !result)) throw new UncertainExecutionError("API nghiệp vụ chưa xác nhận kết quả. Hãy kiểm tra dữ liệu trước khi tạo yêu cầu mới; yêu cầu này không được tự chạy lại.");
    throw new AssistantApiRejection(result, response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  if (op.id === "payroll.run.payslip.review-request.resolve") {
    const request = result?.data || {};
    if (request.status !== "resolved") throw new UncertainExecutionError("API chưa xác nhận yêu cầu kiểm tra phiếu lương đã được xử lý. Hãy kiểm tra lại trước khi gửi phản hồi lần nữa.");
    return { ...result, data: {
      employeeName: typeof request.employeeName === "string" ? request.employeeName : undefined,
      periodKey: typeof request.periodKey === "string" ? request.periodKey : undefined,
      status: "resolved",
      response: typeof request.response === "string" ? request.response : undefined,
      resolvedAt: typeof request.resolvedAt === "string" ? request.resolvedAt : undefined,
    } };
  }
  if (op.id === "student.exam.assigned-students.list") {
    const rows = Array.isArray(result?.data) ? result.data : [];
    return { status: "success", data: rows.flatMap((row: any) => {
      const id = String(row?._id || row?.id || "");
      const name = typeof row?.name === "string" ? row.name.trim().slice(0, 160) : "";
      if (!/^[a-f\d]{24}$/i.test(id) || !name) return [];
      const safe: Record<string, unknown> = {
        name,
        ...(typeof row.phone === "string" && row.phone.trim() ? { phone: row.phone.trim().slice(0, 40) } : {}),
      };
      if (typeof row.phone === "string" && row.phone.trim()) {
        Object.defineProperty(safe, "__assistantReferencePhone", { value: row.phone.trim().slice(0, 40), enumerable: false });
      }
      Object.defineProperty(safe, "__assistantRef", { value: { id }, enumerable: false });
      return [safe];
    }) };
  }
  if (op.id === "student.exam.unassign") {
    return { status: "success", data: { unassigned: result?.success === true } };
  }
  if (op.id === "student.exam.grade-roster.list") {
    const rows = Array.isArray(result?.data) ? result.data : [];
    return { status: "success", data: rows.flatMap((row: any) => {
      const id = String(row?._id || row?.id || "");
      const name = typeof row?.name === "string" ? row.name.trim().slice(0, 160) : "";
      if (!/^[a-f\d]{24}$/i.test(id) || !name) return [];
      const safe: Record<string, unknown> = {
        name,
        ...(typeof row.phone === "string" && row.phone.trim() ? { phone: row.phone.trim().slice(0, 40) } : {}),
        ...(typeof row.score === "number" && Number.isFinite(row.score) ? { score: row.score } : {}),
        ...(["Đậu", "Trượt", "Chưa có"].includes(String(row.outcome)) ? { outcome: row.outcome } : {}),
      };
      if (typeof row.phone === "string" && row.phone.trim()) {
        Object.defineProperty(safe, "__assistantReferencePhone", { value: row.phone.trim().slice(0, 40), enumerable: false });
      }
      Object.defineProperty(safe, "__assistantRef", { value: { id }, enumerable: false });
      return [safe];
    }) };
  }
  if (op.id === "student.exam.grade-results.update") {
    const exam = result?.data && typeof result.data === "object" ? result.data : {};
    return { status: "success", data: {
      ...(typeof exam.name === "string" ? { name: exam.name.slice(0, 200) } : {}),
      ...(typeof exam.status === "string" ? { status: exam.status } : {}),
      gradedCount: Array.isArray(body.results) ? body.results.length : 0,
      ...(Number.isSafeInteger(exam.studentCount) ? { studentCount: exam.studentCount } : {}),
      ...(Number.isSafeInteger(exam.passCount) ? { passCount: exam.passCount } : {}),
      ...(Number.isSafeInteger(exam.failCount) ? { failCount: exam.failCount } : {}),
    } };
  }
  if (op.id === "student.exam.result.update") {
    return { status: "success", data: { updated: result?.success === true } };
  }
  if (op.id === "chat.room.members.list") {
    const room = result?.data && typeof result.data === "object" ? result.data : {};
    const members = Array.isArray(room.members) ? room.members : [];
    const caller = members.find((member: any) => String(member?.userId?._id || member?.userId?.id || member?.userId || "") === String(req.user?.id || ""));
    if (room.isGroup !== true || caller?.role !== "admin") return { status: "success", data: [] };
    const candidates = members.flatMap((member: any) => {
      const user = member?.userId && typeof member.userId === "object" ? member.userId : null;
      const id = String(user?._id || user?.id || "");
      const displayName = typeof user?.displayName === "string" ? user.displayName.trim().slice(0, 160) : "";
      if (!/^[a-f\d]{24}$/i.test(id) || id === String(req.user?.id || "") || !displayName) return [];
      const role = ["admin", "deputy", "member"].includes(String(member?.role)) ? String(member.role) : "member";
      const safe: Record<string, unknown> = {
        displayName,
        role,
        roleLabel: role === "admin" ? "Trưởng nhóm" : role === "deputy" ? "Phó nhóm" : "Thành viên",
      };
      Object.defineProperty(safe, "id", { value: id, enumerable: false });
      return [safe];
    }).slice(0, 100);
    return { status: "success", data: candidates };
  }
  if (op.id === "chat.room.transfer-admin") {
    const room = result?.data && typeof result.data === "object" ? result.data : {};
    const newAdminId = String(body.newAdminId || input.newAdminId || "");
    const member = Array.isArray(room.members) ? room.members.find((candidate: any) => String(candidate?.userId?._id || candidate?.userId?.id || candidate?.userId || "") === newAdminId) : undefined;
    const newAdminName = typeof member?.userId?.displayName === "string" ? member.userId.displayName.slice(0, 160) : undefined;
    return { status: "success", data: {
      ...(typeof room.name === "string" ? { roomName: room.name.slice(0, 160) } : {}),
      ...(newAdminName ? { newAdminName } : {}),
      transferred: true,
    } };
  }
  if (op.id === "chat.room.member.role.update") {
    const room = result?.data && typeof result.data === "object" ? result.data : {};
    const userId = String(input.path_userId || "");
    const member = Array.isArray(room.members) ? room.members.find((candidate: any) => String(candidate?.userId?._id || candidate?.userId?.id || candidate?.userId || "") === userId) : undefined;
    const role = String(body.role || "");
    const roleLabel = role === "admin" ? "Trưởng nhóm" : role === "deputy" ? "Phó nhóm" : role === "member" ? "Thành viên" : undefined;
    const memberName = typeof member?.userId?.displayName === "string" ? member.userId.displayName.slice(0, 160) : undefined;
    return { status: "success", data: {
      ...(typeof room.name === "string" ? { roomName: room.name.slice(0, 160) } : {}),
      ...(memberName ? { memberName } : {}),
      ...(roleLabel ? { roleLabel } : {}),
      updated: true,
    } };
  }
  if (op.id === "chat.room.member.remove") {
    const room = result?.data && typeof result.data === "object" ? result.data : {};
    return { status: "success", data: {
      ...(typeof room.name === "string" ? { roomName: room.name.slice(0, 160) } : {}),
      removed: true,
    } };
  }
  if (op.id === "marketing.video-caption.project.cancel") {
    const project = result?.data?.project && typeof result.data.project === "object" ? result.data.project : {};
    return { status: "success", data: {
      ...(typeof project.name === "string" ? { projectName: project.name.slice(0, 150) } : {}),
      ...(typeof project.status === "string" ? { status: project.status } : {}),
      cancelled: project.status === "cancelled",
    } };
  }
  if ([
    "marketing.video-caption.project.retry",
    "marketing.video-caption.project.analyze",
    "marketing.video-caption.project.transcribe",
    "marketing.video-caption.project.generate-context",
    "marketing.video-caption.project.render",
  ].includes(op.id)) {
    const job = result?.data?.job && typeof result.data.job === "object" ? result.data.job : {};
    const operationLabels: Record<string, string> = {
      analyze: "Phân tích video",
      transcribe: "Nhận diện lời thoại",
      generate_context: "Tạo phụ đề ngữ cảnh",
      render_preview: "Kết xuất bản xem trước",
      render_final: "Kết xuất video",
    };
    const operationLabel = operationLabels[String(job.operation)];
    return { status: "success", data: {
      ...(operationLabel ? { operationLabel } : {}),
      ...(typeof job.status === "string" ? { status: job.status } : {}),
      queued: typeof job.status === "string" && ["queued", "awaiting_provider", "retrying"].includes(job.status),
    } };
  }
  if (op.id === "student.quality.mini-tests.list") {
    const miniTests = Array.isArray(result?.data?.miniTests) ? result.data.miniTests : [];
    return { status: "success", data: miniTests.flatMap((test: any) => {
      const id = String(test?.id || test?._id || "");
      if (!/^[a-f\d]{24}$/i.test(id) || typeof test?.title !== "string") return [];
      const safe: Record<string, unknown> = {
        id,
        title: test.title.slice(0, 200),
        ...(typeof test.date === "string" ? { date: test.date.slice(0, 40) } : {}),
        ...(typeof test.score === "number" ? { score: test.score } : {}),
        ...(typeof test.maxScore === "number" ? { maxScore: test.maxScore } : {}),
        ...(typeof test.note === "string" ? { note: test.note.slice(0, 2000) } : {}),
      };
      Object.defineProperty(safe, "__assistantRef", { value: { studentMiniTest: true }, enumerable: false });
      return [safe];
    }) };
  }
  if (op.id === "marketing.campaign.asset-order.ai.preview") {
    const order = result?.data && typeof result.data === "object" ? result.data : {};
    const proposal = order.aiProposal && typeof order.aiProposal === "object" ? order.aiProposal : {};
    const safeText = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : undefined;
    const warnings = Array.isArray(proposal.warnings)
      ? proposal.warnings.filter((warning: unknown): warning is string => typeof warning === "string").slice(0, 5).map((warning: string) => warning.trim().slice(0, 300)).filter(Boolean)
      : [];
    return { status: "success", data: {
      ...(safeText(order.title, 240) ? { title: safeText(order.title, 240) } : {}),
      ...(safeText(proposal.headline, 120) !== undefined ? { headline: safeText(proposal.headline, 120) } : {}),
      ...(safeText(proposal.subheadline, 220) !== undefined ? { subheadline: safeText(proposal.subheadline, 220) } : {}),
      ...(safeText(proposal.cta, 80) !== undefined ? { cta: safeText(proposal.cta, 80) } : {}),
      ...(safeText(proposal.visualBrief, 1000) !== undefined ? { visualBrief: safeText(proposal.visualBrief, 1000) } : {}),
      ...(safeText(proposal.contentGroup, 240) !== undefined ? { contentGroup: safeText(proposal.contentGroup, 240) } : {}),
      ...(safeText(proposal.shootingContent, 1000) !== undefined ? { shootingContent: safeText(proposal.shootingContent, 1000) } : {}),
      ...(safeText(proposal.productionRequirements, 2000) !== undefined ? { productionRequirements: safeText(proposal.productionRequirements, 2000) } : {}),
      ...(safeText(proposal.quantitySuggestion, 120) !== undefined ? { quantitySuggestion: safeText(proposal.quantitySuggestion, 120) } : {}),
      ...(["image", "video"].includes(String(proposal.format)) ? { format: proposal.format } : {}),
      ...(safeText(proposal.videoScript, 4000) !== undefined ? { videoScript: safeText(proposal.videoScript, 4000) } : {}),
      ...(warnings.length ? { warnings } : {}),
    } };
  }
  if ([
    "marketing.campaign.asset-order.create",
    "marketing.campaign.asset-order.update",
    "marketing.campaign.asset-order.archive",
    "marketing.campaign.asset-order.ai.apply",
  ].includes(op.id)) {
    const order = result?.data && typeof result.data === "object" ? result.data : {};
    const safe: Record<string, unknown> = {};
    for (const key of op.resultFields) {
      const value = order[key];
      if (["string", "number", "boolean"].includes(typeof value)) safe[key] = value;
    }
    return { status: "success", data: safe };
  }
  if (["marketing.campaign.sheet.ai.job.cancel", "marketing.campaign.sheet.ai.job.retry", "marketing.campaign.asset-order.ai.job.cancel", "marketing.bulk-create.templates.detail", "marketing.bulk-create.jobs.detail", "marketing.bulk-create.jobs.cancel", "marketing.bulk-create.jobs.retry"].includes(op.id)) {
    const job = result?.data && typeof result.data === "object" ? result.data : {};
    const safe: Record<string, unknown> = {};
    for (const key of op.resultFields) {
      const value = job[key];
      if (["string", "number", "boolean"].includes(typeof value)) safe[key] = value;
    }
    return { status: "success", data: safe };
  }
  if (op.id === "marketing.bulk-create.templates.list") {
    const companyCode = actorScope(req).companyCode;
    const templates = Array.isArray(result?.data) ? result.data.filter((template: any) => !template?.companyCode || template.companyCode === companyCode) : [];
    return { status: "success", data: templates.slice(0, 100).map((template: any) => {
      const safe: AssistantRecord = {};
      for (const key of op.resultFields) {
        const value = template?.[key];
        if (["string", "number", "boolean"].includes(typeof value)) safe[key] = value;
      }
      const id = String(template?._id || template?.id || "");
      if (/^[a-f\d]{24}$/i.test(id)) Object.defineProperty(safe, "__assistantRef", {
        value: { id, bulkTemplate: true, owned: String(template?.createdBy || "") === String(req.user?.id || "") },
        enumerable: false,
      });
      return safe;
    }) };
  }
  if (op.id === "marketing.bulk-create.templates.community.list") {
    const templates = Array.isArray(result?.data) ? result.data : [];
    return { status: "success", data: templates.slice(0, 60).flatMap((template: any) => {
      if (!template || typeof template !== "object" || template.visibility !== "public" || template.status !== "active") return [];
      const safe: AssistantRecord = {};
      for (const key of op.resultFields) {
        const value = template[key];
        if (["string", "number", "boolean"].includes(typeof value)) safe[key] = value;
      }
      const id = String(template._id || template.id || "");
      if (/^[a-f\d]{24}$/i.test(id)) Object.defineProperty(safe, "__assistantRef", { value: { id, communityTemplate: true }, enumerable: false });
      return [safe];
    }) };
  }
  if (["marketing.bulk-create.templates.publish", "marketing.bulk-create.templates.unpublish", "marketing.bulk-create.templates.community.use"].includes(op.id)) {
    const template = result?.data && typeof result.data === "object" ? result.data : {};
    const safe: Record<string, unknown> = {};
    for (const key of op.resultFields) {
      const value = template[key];
      if (["string", "number", "boolean"].includes(typeof value)) safe[key] = value;
    }
    return { status: "success", data: safe };
  }
  if (op.id === "student.detail") {
    const student = result?.data && typeof result.data === "object" ? result.data : {};
    const safe: Record<string, unknown> = {};
    for (const key of op.resultFields) {
      const value = student[key];
      if (["string", "number", "boolean"].includes(typeof value)) safe[key] = value;
    }
    return { status: "success", data: safe };
  }
  if (op.id === "student.learning-history") {
    const history = result?.data && typeof result.data === "object" ? result.data : {};
    const summary = history.summary && typeof history.summary === "object" ? history.summary : {};
    const entries = Array.isArray(history.entries) ? history.entries : [];
    const attendance = entries.reduce((total: { attended: number; sessions: number }, entry: any) => ({
      attended: total.attended + (Number(entry?.attendance?.attended) || 0),
      sessions: total.sessions + (Number(entry?.attendance?.total) || 0),
    }), { attended: 0, sessions: 0 });
    const assignments = entries.reduce((total: { completed: number; count: number }, entry: any) => ({
      completed: total.completed + (Number(entry?.assignments?.completed) || 0),
      count: total.count + (Number(entry?.assignments?.total) || 0),
    }), { completed: 0, count: 0 });
    const courseNames = [...new Set([
      ...entries.map((entry: any) => String(entry?.courseTitle || "").trim()),
      ...(Array.isArray(history.completedCourses) ? history.completedCourses.map((course: any) => String(course?.title || "").trim()) : []),
    ].filter(Boolean))].slice(0, 20);
    const data: Record<string, unknown> = {};
    for (const key of ["totalClasses", "totalCourses", "totalAttendedSessions", "totalMiniTests", "totalExams"]) {
      if (Number.isFinite(Number(summary[key]))) data[key] = Number(summary[key]);
    }
    data.completedAssignments = assignments.completed;
    data.totalAssignments = assignments.count;
    data.attendanceRate = attendance.sessions ? Math.round((attendance.attended / attendance.sessions) * 1000) / 10 : null;
    data.courseNames = courseNames;
    return { status: "success", data };
  }
  if (op.id === "department.delete") {
    if (typeof result?.data?.id !== "string" || !/^[a-f\d]{24}$/i.test(result.data.id)) throw new UncertainExecutionError("API chưa xác nhận phòng ban đã xóa. Hãy tra cứu lại phòng ban trước khi gửi yêu cầu mới.");
    return { status: "success", data: { deleted: true } };
  }
  if (op.id === "payroll.run.payslips.publish") {
    if (!Array.isArray(result?.data)) throw new UncertainExecutionError("API không trả số lượng phiếu đã công bố. Hãy kiểm tra lượt lương trước khi gửi yêu cầu mới.");
    return { status: "success", data: { publishedCount: result.data.length } };
  }
  if (op.id === "payroll.run.payslips.withdraw") {
    if (result?.data?.status !== "withdrawn") throw new UncertainExecutionError("API chưa xác nhận trạng thái phiếu lương đã thu hồi. Hãy kiểm tra lại phiếu trước khi gửi yêu cầu mới.");
    return { status: "success", data: { withdrawn: true } };
  }
  if (op.id === "branch.pending.delete" && (!response.ok || !result || result.success === false || result.status === "error")) {
    if (response.status >= 500 || !result) throw new UncertainExecutionError("Chưa xác định được chi nhánh đã được hủy hay chưa. Hãy kiểm tra danh sách chi nhánh trước khi gửi lại yêu cầu.");
    if (response.status === 404) throw new AssistantError("Chỉ có thể hủy chi nhánh đang chờ thiết lập chủ và chưa được gán người quản lý.", 404);
    throw new AssistantError("Không thể hủy chi nhánh. Hãy kiểm tra quyền admin và trạng thái chi nhánh.", response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  if (op.id === "branch.pending.delete") {
    const branch = result?.data && typeof result.data === "object" ? result.data : {};
    if (typeof branch.name !== "string" || !branch.name.trim()) throw new UncertainExecutionError("API chưa xác nhận tên chi nhánh đã hủy. Hãy kiểm tra danh sách chi nhánh trước khi gửi lại yêu cầu.");
    return { status: "success", data: { deleted: true, name: branch.name } };
  }
  if (op.id === "company-email.celebration.history" && (!response.ok || !result || result.success === false || result.status === "error")) {
    throw new AssistantError("Không thể đọc thống kê email chúc mừng. Hãy kiểm tra quyền cài đặt công ty.", response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  if (op.id === "company-email.celebration.history") {
    if (!Array.isArray(result?.data)) throw new AssistantError("API không trả về danh sách lịch sử email chúc mừng hợp lệ.", 502);
    const events = result.data.slice(0, 200);
    const statuses = events.map((event: any) => String(event?.status || ""));
    return { status: "success", data: {
      totalCount: events.length,
      sentCount: statuses.filter(status => status === "sent").length,
      failedCount: statuses.filter(status => status === "failed").length,
      pendingCount: statuses.filter(status => status === "pending" || status === "sending").length,
      skippedCount: statuses.filter(status => status === "skipped").length,
    } };
  }
  if (op.id === "company-email.celebration.config" && (!response.ok || !result || result.success === false || result.status === "error")) {
    throw new AssistantError("Không thể đọc tóm tắt cài đặt email chúc mừng. Hãy kiểm tra quyền cài đặt công ty.", response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  if (op.id === "company-email.celebration.config") {
    const config = result?.data && typeof result.data === "object" && !Array.isArray(result.data) ? result.data : null;
    if (!config) return { status: "success", data: { configured: false } };
    const summary: Record<string, unknown> = {
      configured: true,
      birthdayEnabled: config.birthdayEnabled === true,
      holidayEnabled: config.holidayEnabled === true,
      holidayOverridesCount: Array.isArray(config.holidayOverrides) ? config.holidayOverrides.length : 0,
    };
    if (typeof config.sendTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(config.sendTime)) summary.sendTime = config.sendTime;
    return { status: "success", data: summary };
  }
  if (op.id === "worker.standard-fields.list") {
    const rawFields = Array.isArray(result?.data) ? result.data : [];
    const safeFields = rawFields.slice(0, 100).flatMap((field: any) => {
      if (!field || typeof field !== "object" || Array.isArray(field) || !workerProfileStandardFieldKeys.has(String(field.key || ""))
        || typeof field.label !== "string" || typeof field.isRequired !== "boolean" || typeof field.isVisible !== "boolean" || typeof field.isArchived !== "boolean") return [];
      const safe: Record<string, unknown> = { label: field.label.slice(0, 120), isRequired: field.isRequired, isVisible: field.isVisible, isArchived: field.isArchived };
      Object.defineProperty(safe, "__assistantRef", { value: { key: field.key }, enumerable: false });
      return [safe];
    });
    Object.defineProperty(safeFields, "__assistantExistingFields", { value: rawFields, enumerable: false });
    return { ...result, data: safeFields };
  }
  if (op.id === "resource.google-drive.list") {
    const files = Array.isArray(result?.data) ? result.data : [];
    return { ...result, data: files.slice(0, 100).map((file: any) => {
      const safe: Record<string, unknown> = {};
      if (typeof file?.name === "string") safe.name = file.name.slice(0, 300);
      if (typeof file?.mimeType === "string") safe.mimeType = file.mimeType.slice(0, 160);
      if (Number.isSafeInteger(Number(file?.size)) && Number(file.size) >= 0) safe.size = Number(file.size);
      if (typeof file?.createdAt === "string") safe.createdAt = file.createdAt;
      const fileId = String(file?.driveFileId || file?._id || file?.id || "");
      if (/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) Object.defineProperty(safe, "__assistantRef", { value: { id: fileId }, enumerable: false });
      return safe;
    }) };
  }
  if (op.id === "student.online-attendance.create-sessions") {
    const source = result?.data && typeof result.data === "object" && !Array.isArray(result.data) ? result.data : result;
    const safe: Record<string, number> = {};
    for (const key of op.resultFields) if (Number.isSafeInteger(Number(source?.[key])) && Number(source[key]) >= 0) safe[key] = Number(source[key]);
    return { status: "success", data: safe };
  }
  if (["account.assistant-settings.read", "account.assistant-settings.update"].includes(op.id)) {
    const settings = result?.data && typeof result.data === "object" && !Array.isArray(result.data) ? result.data : {};
    const safe: Record<string, unknown> = {};
    if (Number.isSafeInteger(settings.version) && settings.version >= 0) safe.version = settings.version;
    if (["window", "fullscreen"].includes(String(settings.windowMode))) safe.windowMode = settings.windowMode;
    for (const key of ["enterToSend", "showSuggestions", "alwaysConfirm", "speakReplies", "wakeWordEnabled"]) {
      if (typeof settings[key] === "boolean") safe[key] = settings[key];
    }
    if (op.id === "account.assistant-settings.read") {
      Object.defineProperty(safe, "__assistantExistingRecord", { value: { ...settings }, enumerable: false });
    }
    return { ...result, data: safe };
  }
  if (op.id === "student.standard-fields.update") {
    const returned = Array.isArray(result?.data) ? result.data : [];
    const selectedFieldKey = String(input.selectedField || "");
    const selected = returned.find((field: any) => String(field?.key || "") === selectedFieldKey)
      || (Array.isArray(body.fields) ? body.fields.find((field: any) => String(field?.key || "") === selectedFieldKey) : undefined);
    return { ...result, data: selected ? {
      label: selected.label, placeholder: selected.placeholder, isRequired: selected.isRequired,
      isVisible: selected.isVisible, isArchived: selected.isArchived,
    } : {} };
  }
  if (op.id === "worker.standard-fields.update") {
    const record = result?.data && typeof result.data === "object" ? result.data : {};
    const returnedFields = Array.isArray(record.fields) ? record.fields : Array.isArray(body.fields) ? body.fields : [];
    const selected = returnedFields.find((field: any) => String(field?.key || "") === String(input.selectedField || ""));
    return { status: result?.status || "success", data: selected ? {
      label: typeof selected.label === "string" ? selected.label : "",
      isRequired: selected.isRequired === true,
      isVisible: selected.isVisible === true,
      isArchived: selected.isArchived === true,
    } : {} };
  }
  if (op.id === "worker.partner.settlement.detail") {
    const source = result?.data && typeof result.data === "object" && !Array.isArray(result.data) ? result.data : {};
    const safe: Record<string, unknown> = {};
    for (const key of op.resultFields) if (source[key] !== undefined) safe[key] = source[key];
    Object.defineProperty(safe, "__assistantPayoutChoices", { value: workerPartnerPayoutChoices(source), enumerable: false });
    return { status: result?.status || "success", data: safe };
  }
  if (op.id === "worker.partner.payout.reverse") {
    const reversal = result?.data?.reversal && typeof result.data.reversal === "object" ? result.data.reversal : {};
    const settlement = result?.data?.settlement && typeof result.data.settlement === "object" ? result.data.settlement : {};
    return { status: result?.status || "success", data: {
      amount: Number.isSafeInteger(Number(reversal.amount)) ? Math.abs(Number(reversal.amount)) : undefined,
      paidAt: typeof reversal.paidAt === "string" ? reversal.paidAt : undefined,
      method: reversal.method === "bank_transfer" ? "Chuyển khoản" : reversal.method === "cash" ? "Tiền mặt" : undefined,
      settlementStatus: typeof settlement.status === "string" ? settlement.status : undefined,
      balanceAmount: Number.isSafeInteger(Number(settlement.balanceAmount)) ? Number(settlement.balanceAmount) : undefined,
    } };
  }
  if (op.id === "marketing.chat-flow.list" && Array.isArray(result?.data)) {
    return { ...result, data: result.data.map((flow: any) => safePageChatFlow(flow, true)) };
  }
  if (["marketing.chat-flow.suggest", "marketing.chat-flow.draft.create"].includes(op.id)) {
    return { ...result, data: safePageChatFlow(result?.data, true) };
  }
  if (op.id === "marketing.chat-flow.activate") {
    return { ...result, data: safePageChatFlow(result?.data, false) };
  }
  if (op.id === "notification.list" && Array.isArray(result?.data)) {
    return { ...result, data: result.data.map((notification: any) => safeNotification(notification, true)) };
  }
  if (op.id === "notification.mark-read") {
    return { ...result, data: safeNotification(result?.data, false) };
  }
  if (op.id === "notification.mark-all-read") {
    return { ...result, data: { success: result?.data?.success === true } };
  }
  if (op.id === "notification.delete") {
    return { ...result, data: { deleted: Boolean(result?.data?._id || result?.data?.id) } };
  }
  if (op.id === "payroll.run.create" && result?.data && typeof result.data === "object") {
    return { ...result, data: {
      periodKey: String(input.periodKey), startDate: body.startDate, endDate: body.endDate,
      type: "regular", status: result.data.status === "draft" ? "draft" : String(result.data.status || ""),
    } };
  }
  if (op.id === "payroll.run.sync-attendance") {
    const job = result?.data?.job || {};
    const jobResult = job.result && typeof job.result === "object" ? job.result : {};
    return { ...result, data: {
      status: String(job.status || ""),
      employeeCount: Number.isFinite(Number(jobResult.employeeCount)) ? Number(jobResult.employeeCount) : undefined,
      blockingIssueCount: Number.isFinite(Number(jobResult.blockingIssueCount)) ? Number(jobResult.blockingIssueCount) : undefined,
    } };
  }
  if (op.id === "payroll.run.lock-attendance") {
    const run = result?.data?.run || {};
    const snapshot = result?.data?.snapshot || {};
    return { ...result, data: {
      periodKey: String(run.periodKey || snapshot.periodKey || ""),
      lockedAt: typeof snapshot.lockedAt === "string" ? snapshot.lockedAt : undefined,
      employeeCount: Array.isArray(snapshot.employees) ? snapshot.employees.length : undefined,
    } };
  }
  if (["payroll.run.calculate", "payroll.run.recalculate"].includes(op.id)) {
    const revision = result?.data?.revision || {};
    const issues = Array.isArray(revision.issues) ? revision.issues : [];
    const employeeIds = new Set((Array.isArray(revision.lines) ? revision.lines : [])
      .map((line: any) => String(line?.employeeId || "").trim()).filter(Boolean));
    return { ...result, data: {
      status: String(revision.status || ""),
      revision: Number.isSafeInteger(Number(revision.revision)) ? Number(revision.revision) : undefined,
      employeeCount: employeeIds.size,
      blockingIssueCount: issues.filter((issue: any) => issue?.severity === "blocking").length,
      warningIssueCount: issues.filter((issue: any) => issue?.severity === "warning").length,
    } };
  }
  if (["payroll.run.review", "payroll.run.close", "payroll.run.reopen", "payroll.run.mark-paid"].includes(op.id)) {
    const run = result?.data || {};
    return { ...result, data: {
      periodKey: String(run.periodKey || ""),
      status: String(run.status || ""),
      closedAt: typeof run.closedAt === "string" ? run.closedAt : undefined,
      paidAt: typeof run.paidAt === "string" ? run.paidAt : undefined,
    } };
  }
  if (op.id === "payroll.run.line.detail") {
    const line = result?.data || {};
    const calculation = line.calculation && typeof line.calculation === "object" ? line.calculation : {};
    const amount = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : undefined;
    return { ...result, data: {
      employeeName: typeof line.employeeName === "string" ? line.employeeName : undefined,
      grossPay: amount(calculation.gross),
      deductions: amount(calculation.deductions),
      netPay: amount(calculation.net),
    } };
  }
  if (op.id === "payroll.run.issues.list" && Array.isArray(result?.data)) {
    return { ...result, data: result.data.slice(0, 100).map((issue: any) => ({
      code: typeof issue?.code === "string" ? issue.code : undefined,
      field: typeof issue?.field === "string" ? issue.field : undefined,
      severity: ["blocking", "warning"].includes(String(issue?.severity)) ? issue.severity : undefined,
      message: typeof issue?.message === "string" ? issue.message : undefined,
      remediation: typeof issue?.remediation === "string" ? issue.remediation : undefined,
    })) };
  }
  if (op.id === "payroll.adjustment.list" && input.status && Array.isArray(result?.data)) {
    return { ...result, data: result.data.filter((row: any) => row?.status === input.status) };
  }
  if (op.id === "payroll.run.complaints.list") {
    if (!Array.isArray(result?.data?.items)) throw new AssistantError("Không đọc được danh sách đối soát lương hợp lệ.", 502);
    const reviewOperation = operationById("payroll.run.payslip.review-requests.list");
    if (!reviewOperation) throw new AssistantError("Chưa thể đọc yêu cầu kiểm tra phiếu lương.");
    const reviews = await callOperation(req, reviewOperation, input);
    const records = result.data.items;
    const complaints = records.flatMap((record: any) => (Array.isArray(record?.issues) ? record.issues : []).map((issue: any) => {
      const messages = Array.isArray(issue?.messages) ? issue.messages : [];
      return {
        employeeName: record.employeeName, periodKey: record.periodKey, source: "Lương tạm tính",
        fieldLabel: payrollReconciliationFieldLabels[String(issue?.field || "")] || "Khoản lương",
        status: issue.status,
        message: messages.filter((message: any) => message.role === "employee").map((message: any) => message.body).join("\n"),
        response: messages.filter((message: any) => message.role === "staff").map((message: any) => message.body).join("\n"),
        createdAt: messages[0]?.at,
      };
    }));
    const published = (Array.isArray(reviews?.data) ? reviews.data : []).map((review: any) => ({
      employeeName: review.employeeName, periodKey: review.periodKey, source: "Phiếu lương đã phát hành",
      status: review.status, message: review.message, response: review.response, createdAt: review.createdAt,
    }));
    return { status: "success", data: [...complaints, ...published] };
  }
  if (op.id === "payroll.run.reconciliation.list") {
    const data = result?.data || {};
    const reconciliationFieldLabels: Record<string, string> = {
      workedMinutes: "Giờ công", baseSalary: "Lương cơ bản", adjustedBase: "Lương theo công", overtime: "Tăng ca",
      commission: "Hoa hồng", bonusTotal: "Thưởng", hiddenIncome: "Phụ cấp / thu nhập khác", penaltyTotal: "Phạt",
      socialInsurance: "BHXH", healthInsurance: "BHYT", unemploymentInsurance: "BHTN", personalIncomeTax: "Thuế TNCN",
      advances: "Tạm ứng", otherDeductions: "Khấu trừ khác", net: "Thực nhận",
    };
    const runStatuses = new Set(["draft", "review", "closed", "paid"]);
    const items = (Array.isArray(data.items) ? data.items : []).slice(0, 100).map((record: any) => {
      const issues = Array.isArray(record?.issues) ? record.issues.filter((issue: any) => issue?.status === "open") : [];
      const openIssueFields = [...new Set(issues.map((issue: any) => reconciliationFieldLabels[String(issue?.field || "")]).filter((label: unknown): label is string => typeof label === "string"))];
      const isConfirmed = record?.stale !== true && typeof record?.confirmedAt === "string"
        && typeof record?.confirmedChecksum === "string" && record.confirmedChecksum === record?.snapshot?.checksum;
      const safeRecord: Record<string, any> = {
        employeeName: typeof record?.employeeName === "string" ? record.employeeName : undefined,
        periodKey: typeof record?.periodKey === "string" ? record.periodKey : undefined,
        runStatus: runStatuses.has(String(record?.runStatus)) ? record.runStatus : undefined,
        isConfirmed,
        stale: record?.stale === true,
        confirmedAt: isConfirmed ? record.confirmedAt : undefined,
        openIssueCount: issues.length,
        openIssueFields,
      };
      Object.defineProperty(safeRecord, "__assistantRef", { value: {
        id: /^[a-f\d]{24}$/i.test(String(record?.employeeId || "")) ? String(record.employeeId) : "",
        version: Number(record?.version),
        issues: issues.filter((issue: any) => typeof issue?.id === "string" && reconciliationFieldLabels[String(issue?.field || "")])
          .map((issue: any) => ({ id: issue.id, field: issue.field })),
      }, enumerable: false });
      return safeRecord;
    });
    return { ...result, data: {
      runStatus: runStatuses.has(String(data.runStatus)) ? data.runStatus : undefined,
      employeeCount: Number.isSafeInteger(Number(data.employeeCount)) && Number(data.employeeCount) >= 0 ? Number(data.employeeCount) : items.length,
      items,
    } };
  }
  if (op.id === "payroll.run.reconciliation.publish") {
    const data = result?.data || {};
    const employeeCount = Number(data.employeeCount);
    return { ...result, data: {
      employeeCount: Number.isSafeInteger(employeeCount) && employeeCount >= 0 ? employeeCount : undefined,
    } };
  }
  if (op.id === "payroll.run.reconciliation.action" && result?.data) {
    const data = result.data;
    return { ...result, data: {
      employeeName: String(input.__assistantEmployeeName || data.employeeName || "Nhân viên"),
      periodKey: typeof data.periodKey === "string" ? data.periodKey : undefined,
      action: input.action,
      openIssueCount: Array.isArray(data.issues) ? data.issues.filter((issue: any) => issue?.status === "open").length : undefined,
    } };
  }
  if (op.id === "payroll.run.list" && Array.isArray(result?.data)) {
    const runTypes = new Set(["regular", "supplemental"]);
    const statuses = new Set(["draft", "review", "closed", "paid"]);
    return { ...result, data: result.data.filter((run: any) => /^[a-f\d]{24}$/i.test(String(run?._id || run?.id || ""))).slice(0, 100).map((run: any) => ({
      __assistantRef: { id: String(run._id || run.id), version: Number(run.version) },
      periodKey: String(run.periodKey || ""),
      startDate: typeof run.startDate === "string" ? run.startDate.slice(0, 10) : undefined,
      endDate: typeof run.endDate === "string" ? run.endDate.slice(0, 10) : undefined,
      type: runTypes.has(String(run.type)) ? run.type : "",
      status: statuses.has(String(run.status)) ? run.status : "",
      createdAt: typeof run.createdAt === "string" ? run.createdAt : undefined,
    })) };
  }
  if (op.id === "payroll.run.payments.list" && Array.isArray(result?.data)) {
    const statuses = new Set(["draft", "confirmed", "cancelled", "reversed"]);
    return { ...result, data: result.data.slice(0, 100).flatMap((payment: any) => {
      const safe: Record<string, unknown> = {
        status: statuses.has(String(payment?.status)) ? String(payment.status) : "unknown",
        employeeCount: Array.isArray(payment?.lines) ? payment.lines.length : 0,
      };
      if (Number.isFinite(Number(payment?.amount)) && Number(payment.amount) >= 0) safe.amount = Number(payment.amount);
      for (const key of ["paymentDate", "createdAt"]) {
        if (payment?.[key] instanceof Date && !Number.isNaN(payment[key].valueOf())) safe[key] = payment[key].toISOString();
        else if (typeof payment?.[key] === "string" && !Number.isNaN(Date.parse(payment[key]))) safe[key] = payment[key].slice(0, 40);
      }
      const id = String(payment?._id || payment?.id || "");
      if (/^[a-f\d]{24}$/i.test(id)) Object.defineProperty(safe, "__assistantRef", { value: { id }, enumerable: false });
      return [safe];
    }) };
  }
  if (op.id === "payroll.run.payment.create") {
    const payment = result?.data && typeof result.data === "object" ? result.data : {};
    const paymentId = String(payment._id || payment.id || "");
    const amount = Number(payment.amount);
    if (!/^[a-f\d]{24}$/i.test(paymentId) || payment.status !== "draft" || !Number.isSafeInteger(amount) || amount !== Number(body.amount)) {
      throw new UncertainExecutionError("API chưa xác nhận được đợt thanh toán lương nháp. Hãy tra cứu danh sách thanh toán của lượt lương trước khi yêu cầu tạo lại.");
    }
    const safe: Record<string, unknown> = {
      amount,
      status: "draft",
      employeeCount: Array.isArray(payment.lines) ? payment.lines.length : 0,
    };
    for (const key of ["paymentDate", "createdAt"]) {
      if (payment[key] instanceof Date && !Number.isNaN(payment[key].valueOf())) safe[key] = payment[key].toISOString();
      else if (typeof payment[key] === "string" && !Number.isNaN(Date.parse(payment[key]))) safe[key] = payment[key].slice(0, 40);
    }
    return { status: "success", data: safe };
  }
  if (Object.hasOwn(payrollPaymentRequiredStatus, op.id)) {
    const expectedResultStatus: Record<string, string> = {
      "payroll.payment.cancel": "cancelled",
      "payroll.payment.confirm": "confirmed",
      "payroll.payment.reverse": "reversed",
    };
    const payment = result?.data && typeof result.data === "object" ? result.data : {};
    const paymentId = String(payment._id || payment.id || "");
    const amount = Number(payment.amount);
    const expectedStatus = expectedResultStatus[op.id];
    const validRunStatuses = op.id === "payroll.payment.cancel" ? ["draft", "review", "closed", "paid"] : ["closed", "paid"];
    if (!/^[a-f\d]{24}$/i.test(paymentId) || payment.status !== expectedStatus || !Number.isSafeInteger(amount) || amount < 1
      || !Array.isArray(payment.lines) || !validRunStatuses.includes(String(result?.runStatus || ""))) {
      throw new UncertainExecutionError("API chưa xác nhận được trạng thái đợt thanh toán lương. Hãy tra cứu lại danh sách thanh toán của lượt trước khi gửi yêu cầu mới.");
    }
    const safe: Record<string, unknown> = {
      status: expectedStatus,
      amount,
      employeeCount: payment.lines.length,
      runStatus: String(result.runStatus),
    };
    if (typeof payment.paymentDate === "string" && !Number.isNaN(Date.parse(payment.paymentDate))) safe.paymentDate = payment.paymentDate.slice(0, 40);
    return { status: "success", data: safe };
  }
  if (op.id === "payroll.period.line-overrides.list" && Array.isArray(result?.data)) {
    if (!result.data.length) return { ...result, data: [] };
    let employees: AssistantRecord[] = [];
    if (typeof input.__assistantEmployeeNames === "string") {
      try {
        const names = JSON.parse(input.__assistantEmployeeNames);
        if (names && typeof names === "object" && !Array.isArray(names)) employees = Object.entries(names).map(([id, displayName]) => ({ id, displayName: String(displayName) }));
      } catch { /* resolve names through the branch-scoped employee list below */ }
    }
    if (!employees.length) {
      try {
        employees = await lookupRecords(req, "employee.list", "", {
          branchId: String(input.targetBranch || req.user?.branchId || ""),
        } as any);
      } catch { /* omit unverified names rather than expose employee identifiers */ }
    }
    const customCodes = new Set(result.data.flatMap((row: any) => (
      row?.customValues && typeof row.customValues === "object" && !Array.isArray(row.customValues)
        ? Object.keys(row.customValues).filter((code: string) => /^[A-Za-z][A-Za-z0-9_]*$/.test(code))
        : []
    )));
    const customNameByCode = new Map<string, string>();
    if (customCodes.size) {
      try {
        const variableOperation = operationById("payroll.period.variables.list");
        if (variableOperation) {
          const variables = await callOperation(req, variableOperation, {});
          for (const item of Array.isArray(variables?.data) ? variables.data : []) {
            if (typeof item?.code === "string" && typeof item?.name === "string" && customCodes.has(item.code)) {
              customNameByCode.set(item.code, item.name);
            }
          }
        }
      } catch { /* retain the field code only if its configured name cannot be read */ }
    }
    const employeeById = new Map(employees.map(employee => [String(employee.id || ""), employee]));
    const valueFields = [...PAYROLL_LINE_OVERRIDE_FIELDS];
    const safeRows = result.data.slice(0, 500).flatMap((row: any) => {
      const employeeId = String(row?.employeeId || "");
      if (!/^[a-f\d]{24}$/i.test(employeeId)) return [];
      const employee = employeeById.get(employeeId);
      const employeeName = String(employee?.displayName || employee?.fullName || "").trim();
      if (!employeeName) return [];
      const safe: Record<string, any> = {
        employeeName,
        periodKey: typeof row.periodKey === "string" ? row.periodKey : String(input.path_periodKey || ""),
        reason: typeof row.reason === "string" ? row.reason.slice(0, 500) : "",
        updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : undefined,
      };
      for (const key of valueFields) if (Number.isFinite(row?.[key])) safe[key] = row[key];
      if (row?.customValues && typeof row.customValues === "object" && !Array.isArray(row.customValues)) {
        const customValues: Record<string, number> = {};
        const usedLabels = new Set<string>();
        for (const [code, value] of Object.entries(row.customValues)) {
          if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(code) || typeof value !== "number" || !Number.isFinite(value)) continue;
          const configuredName = customNameByCode.get(code) || code;
          const label = usedLabels.has(configuredName) ? `${configuredName} (${code})` : configuredName;
          usedLabels.add(configuredName);
          customValues[label] = value;
        }
        if (Object.keys(customValues).length) safe.customValues = customValues;
      }
      Object.defineProperty(safe, "__assistantRef", {
        value: { id: employeeId, version: Number.isSafeInteger(row.version) && row.version >= 0 ? row.version : 0 },
        enumerable: false,
      });
      return [safe];
    });
    const search = typeof input.search === "string" ? normalize(input.search) : "";
    return { ...result, data: search ? safeRows.filter((row: any) => normalize(row.employeeName).includes(search)) : safeRows };
  }
  if (op.id === "api.get.79f4d36088c00b86" && result?.data && typeof result.data === "object" && !Array.isArray(result.data)) {
    const data = result.data;
    let employees: AssistantRecord[] = [];
    if (typeof input.__assistantEmployeeNames === "string") {
      try {
        const names = JSON.parse(input.__assistantEmployeeNames);
        if (names && typeof names === "object" && !Array.isArray(names)) employees = Object.entries(names).map(([id, displayName]) => ({ id, displayName: String(displayName) }));
      } catch { /* keep the safe fallback when the private name map is malformed */ }
    } else if (typeof input.__assistantEmployeeName === "string" && typeof input.__assistantEmployeeId === "string") {
      employees = [{ id: input.__assistantEmployeeId, displayName: input.__assistantEmployeeName }];
    } else {
      try { employees = await lookupRecords(req, "employee.list"); } catch { /* names are required for safe display and updates */ }
    }
    const employeeById = new Map(employees.map(employee => [String(employee.id || ""), employee]));
    const allowedValues = ["agreedSalary", "reconciledDays", "reconciledHours", "allowance", "bonus", "deduction"];
    const items = (Array.isArray(data.items) ? data.items : []).slice(0, 500).map((item: any) => {
      const employeeId = String(item?.employeeId || "");
      const safe: Record<string, any> = {
        employeeName: String(employeeById.get(employeeId)?.displayName || employeeById.get(employeeId)?.fullName || "Nhân viên"),
        periodKey: String(item?.periodKey || ""),
        editable: data.editable === true,
        needsRefresh: data.needsRefresh === true,
      };
      for (const key of allowedValues) if (Number.isFinite(item?.[key])) safe[key] = item[key];
      if (/^[a-f\d]{24}$/i.test(employeeId)) {
        Object.defineProperty(safe, "__assistantRef", { value: { id: employeeId, version: Number(item?.version) }, enumerable: true });
      }
      return safe;
    });
    const safeResult = { ...result, data: items };
    Object.defineProperty(safeResult, "__assistantPeriodEditable", { value: data.editable === true, enumerable: false });
    return safeResult;
  }
  if (op.id === "payroll.period.input.update" && result?.data && typeof result.data === "object") {
    const data = result.data;
    const safe: Record<string, any> = {
      periodKey: String(input.path_periodKey || data.periodKey || ""),
      employeeName: String(input.__assistantEmployeeName || "Nhân viên"),
    };
    for (const key of ["agreedSalary", "reconciledDays", "reconciledHours", "allowance", "bonus", "deduction"]) {
      if (Number.isFinite(data[key])) safe[key] = data[key];
    }
    return { ...result, data: safe };
  }
  if (op.id === "payroll.period.inputs.bulk") {
    let names: Record<string, string> = {};
    let requestedRows: any[] = [];
    try { names = JSON.parse(String(input.__assistantEmployeeNames || "{}")); } catch { names = {}; }
    try { requestedRows = JSON.parse(String(input.rows || "[]")); } catch { requestedRows = []; }
    const fieldLabels: Record<string, string> = {
      agreedSalary: "Lương thỏa thuận", reconciledDays: "Ngày công đối soát", reconciledHours: "Giờ công đối soát",
      allowance: "Phụ cấp", bonus: "Thưởng", deduction: "Khấu trừ",
    };
    const errorMessages: Record<string, string> = {
      PAYROLL_PERIOD_INPUT_LOCKED: "Kỳ lương đã khóa.",
      PAYROLL_PERIOD_INPUT_VERSION_CONFLICT: "Dữ liệu vừa thay đổi; cần tra cứu lại trước khi cập nhật.",
      PAYROLL_PERIOD_INPUT_REASON_REQUIRED: "Thiếu lý do đối soát.",
      PAYROLL_PERIOD_INPUT_VALUE_INVALID: "Một giá trị đầu vào không hợp lệ.",
    };
    const rows = Array.isArray(result?.data) ? result.data.slice(0, 20) : [];
    const safeItems = rows.map((row: any) => {
      const employeeId = String(row?.employeeId || "");
      const employeeName = String(names[employeeId] || "Nhân viên");
      if (row?.status === "success") {
        const request = requestedRows.find((item: any) => String(item?.employeeId || "") === employeeId) || {};
        return { employeeName, status: "Đã cập nhật", updatedFields: Object.keys(fieldLabels).filter(key => request[key] !== undefined).map(key => fieldLabels[key]) };
      }
      return { employeeName, status: "Chưa cập nhật", detail: errorMessages[String(row?.code || "")] || "API chưa lưu dòng này; hãy kiểm tra dữ liệu rồi thử lại." };
    });
    const updatedCount = safeItems.filter(item => item.status === "Đã cập nhật").length;
    return { status: "success", data: { updatedCount, failedCount: safeItems.length - updatedCount, items: safeItems } };
  }
  if (op.id === "payroll.period.line-overrides.bulk") {
    let names: Record<string, string> = {};
    let customNames: Record<string, string> = {};
    let requestedRows: any[] = [];
    try { names = JSON.parse(String(input.__assistantEmployeeNames || "{}")); } catch { names = {}; }
    try { customNames = JSON.parse(String(input.__assistantCustomFieldNames || "{}")); } catch { customNames = {}; }
    try { requestedRows = JSON.parse(String(input.rows || "[]")); } catch { requestedRows = []; }
    const fieldLabels: Record<string, string> = {
      baseSalary: "Lương cơ bản", adjustedBase: "Lương theo công", overtime: "Tăng ca", bonusTotal: "Tổng thưởng",
      penaltyTotal: "Tổng phạt", socialInsurance: "BHXH", healthInsurance: "BHYT", unemploymentInsurance: "BHTN",
      personalIncomeTax: "Thuế TNCN", otherDeductions: "Khấu trừ khác", advances: "Tạm ứng",
    };
    const errorMessages: Record<string, string> = {
      PAYROLL_LINE_OVERRIDE_LOCKED: "Chỉ có thể ghi đè khi kỳ còn lượt lương thường ở trạng thái nháp.",
      PAYROLL_LINE_OVERRIDE_VERSION_CONFLICT: "Dữ liệu vừa thay đổi; cần tra cứu lại trước khi cập nhật.",
      PAYROLL_LINE_OVERRIDE_EMPLOYEE_NOT_IN_RUN: "Nhân viên không thuộc lượt lương hiện hành của kỳ này.",
      PAYROLL_LINE_OVERRIDE_FIELD_INVALID: "Trường không hợp lệ hoặc biến bổ sung chưa được kích hoạt.",
      PAYROLL_LINE_OVERRIDE_VALUE_INVALID: "Giá trị phải là số không âm hợp lệ.",
    };
    const rows = Array.isArray(result?.data) ? result.data.slice(0, 20) : [];
    const items = rows.map((row: any) => {
      const employeeId = String(row?.employeeId || "");
      const employeeName = String(names[employeeId] || "Nhân viên");
      const request = requestedRows.find((item: any) => String(item?.employeeId || "") === employeeId) || {};
      if (row?.status === "success") {
        const values = request.values && typeof request.values === "object" ? Object.keys(request.values) : [];
        const custom = request.customValues && typeof request.customValues === "object"
          ? Object.keys(request.customValues).map((code: string) => `Trường tùy chỉnh ${customNames[code] || code}`) : [];
        const cleared = Array.isArray(request.clearFields) ? request.clearFields.map((field: string) => {
          const customCode = field.startsWith("custom.") ? field.slice("custom.".length) : "";
          return `Khôi phục ${customCode ? customNames[customCode] || customCode : fieldLabels[field] || field}`;
        }) : [];
        return { employeeName, status: "Đã cập nhật", updatedFields: [...values.map((key: string) => fieldLabels[key] || key), ...custom, ...cleared] };
      }
      return {
        employeeName,
        status: "Chưa cập nhật",
        detail: errorMessages[String(row?.code || "")] || "API chưa lưu dòng này; hãy kiểm tra dữ liệu rồi thử lại.",
      };
    });
    const updatedCount = items.filter(item => item.status === "Đã cập nhật").length;
    return { status: "success", data: { updatedCount, failedCount: items.length - updatedCount, items } };
  }
  if (op.id === "omni-inbox.ai-reply-logs.list") {
    const channelValues = new Set(["facebook", "facebook_comment", "zalo", "tiktok", "test"]);
    const statusValues = new Set(["sent", "failed", "preview"]);
    const feedbackValues = new Set(["good", "bad", "needs_fix"]);
    const logs = Array.isArray(result.logs) ? result.logs.slice(0, 100) : [];
    return { status: "success", data: logs.filter((log: any) => log && /^[a-f\d]{24}$/i.test(String(log._id || ""))).map((log: any) => ({
      __assistantRef: { id: String(log._id) },
      ...(channelValues.has(String(log.channel)) ? { channel: String(log.channel) } : {}),
      ...(statusValues.has(String(log.status)) ? { status: String(log.status) } : {}),
      ...(feedbackValues.has(String(log.feedback)) ? { feedback: String(log.feedback) } : {}),
      ...(typeof log.createdAt === "string" ? { createdAt: log.createdAt } : {}),
    })) };
  }
  if (["omni-inbox.facebook-conversations.list", "omni-inbox.zalo-conversations.list", "omni-inbox.tiktok-conversations.list"].includes(op.id)) {
    const channels: Record<string, string> = {
      "omni-inbox.facebook-conversations.list": "Facebook",
      "omni-inbox.zalo-conversations.list": "Zalo",
      "omni-inbox.tiktok-conversations.list": "TikTok",
    };
    const conversations = Array.isArray(result.data) ? result.data.slice(0, 100) : [];
    return { status: "success", data: conversations.filter((conversation: any) => conversation && /^[a-f\d]{24}$/i.test(String(conversation._id || conversation.id || ""))).map((conversation: any) => ({
      __assistantRef: { id: String(conversation._id || conversation.id) },
      channel: channels[op.id],
      ...(typeof conversation.senderName === "string" ? { senderName: conversation.senderName.slice(0, 120) } : {}),
      ...(typeof conversation.lastMessageAt === "string" ? { lastMessageAt: conversation.lastMessageAt } : {}),
      ...(Number.isSafeInteger(conversation.unreadCount) && conversation.unreadCount >= 0 ? { unreadCount: conversation.unreadCount } : {}),
      ...(["open", "closed"].includes(String(conversation.status)) ? { status: String(conversation.status) } : {}),
      ...(typeof conversation.isVip === "boolean" ? { isVip: conversation.isVip } : {}),
    })) };
  }
  if (op.id === "marketing.media-history.list") {
    const histories = Array.isArray(result.history) ? result.history.slice(0, 50) : [];
    const mediaType = String(input.query_type || "");
    const data = histories.filter((item: any) => item && item.mediaType === mediaType && /^[a-f\d]{24}$/i.test(String(item._id || ""))).map((item: any) => {
      const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
      let safeUrl = "";
      try {
        const parsed = new URL(String(item.url || ""));
        if (parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com") safeUrl = parsed.toString();
      } catch { /* reject malformed or untrusted media links */ }
      if (!safeUrl) return null;
      return {
        __assistantRef: { id: String(item._id) },
        mediaType,
        ...(typeof metadata.title === "string" ? { title: metadata.title.slice(0, 200) } : {}),
        ...(typeof metadata.voiceName === "string" ? { voiceName: metadata.voiceName.slice(0, 120) } : {}),
        ...(typeof metadata.duration === "string" || typeof metadata.duration === "number" ? { duration: metadata.duration } : {}),
        ...(typeof item.createdAt === "string" ? { createdAt: item.createdAt } : {}),
        ...(safeUrl ? { url: safeUrl } : {}),
      };
    }).filter(Boolean);
    return { status: "success", data };
  }
  if (op.id === "marketing.media-history.delete") {
    return { status: "success", data: { deleted: result?.status === "success" } };
  }
  if (op.id === "marketing.elevenlabs.voices.list") {
    const voices = Array.isArray(result.voices) ? result.voices.slice(0, 100) : [];
    return { status: "success", data: voices.filter((voice: any) => voice && typeof voice.voice_id === "string" && voice.voice_id.length > 0 && typeof voice.name === "string").map((voice: any) => ({
      __assistantRef: { id: voice.voice_id.slice(0, 200) },
      name: voice.name.slice(0, 120),
      ...(typeof voice.category === "string" ? { category: voice.category.slice(0, 80) } : {}),
    })) };
  }
  if (op.id === "marketing.elevenlabs.models.list") {
    const models = Array.isArray(result.models) ? result.models.slice(0, 100) : [];
    return { status: "success", data: models.filter((model: any) => model && model.can_do_text_to_speech === true && typeof model.model_id === "string" && model.model_id.length > 0 && typeof model.name === "string").map((model: any) => ({
      __assistantRef: { id: model.model_id.slice(0, 200) },
      name: model.name.slice(0, 120),
      ...(typeof model.description === "string" ? { description: model.description.slice(0, 300) } : {}),
    })) };
  }
  if (op.id === "marketing.elevenlabs.voice.generate") {
    const record = result?.record && typeof result.record === "object" ? result.record : {};
    let url = "";
    try {
      const parsed = new URL(String(record.url || ""));
      if (parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com") url = parsed.toString();
    } catch { /* reject malformed or untrusted media links */ }
    if (!url) throw new AssistantError("ElevenLabs không trả về liên kết âm thanh Cloudinary hợp lệ.");
    const metadata = record.metadata && typeof record.metadata === "object" ? record.metadata : {};
    return { status: "success", data: {
      characters: String(input.textToSpeak || "").length,
      ...(typeof metadata.duration === "string" || typeof metadata.duration === "number" ? { duration: metadata.duration } : {}),
      url,
    } };
  }
  if (op.id === "marketing.elevenlabs.custom-voice.preview") {
    let url = "";
    try {
      const parsed = new URL(String(result?.url || result?.data?.url || ""));
      if (parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com" && !parsed.username && !parsed.password && !parsed.port) url = parsed.toString();
    } catch { /* reject malformed or untrusted media links */ }
    if (!url) throw new UncertainExecutionError("Bản nghe thử có thể đã được tạo nhưng API không trả liên kết Cloudinary hợp lệ. Hãy kiểm tra cấu hình và số dư trước khi thử lại.");
    return { status: "success", data: { url } };
  }
  if (op.id === "marketing.ai.image.generate") {
    const source = result?.data && typeof result.data === "object" ? result.data : result;
    let url = "";
    try {
      const parsed = new URL(String(source?.url || ""));
      if (parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com" && !parsed.username && !parsed.password && !parsed.port) url = parsed.toString();
    } catch { /* reject malformed or untrusted media links */ }
    if (!url) throw new UncertainExecutionError("Ảnh có thể đã được tạo nhưng API không trả liên kết Cloudinary hợp lệ. Hãy kiểm tra thư viện media và số dư trước khi tạo lại.");
    return { status: "success", data: {
      url,
      aspectRatio: String(input.aspectRatio),
      resolution: "1K",
      modelName: String(input.modelName),
    } };
  }
  if (op.id === "marketing.campaign.calendar") {
    const source = Array.isArray(result?.data?.slots) ? result.data.slots.slice(0, 100) : [];
    const statuses = ["planned", "queued", "pending_approval", "ready_to_publish", "needs_attention", "publishing", "published", "failed", "cancelled", "skipped"];
    const mediaTypes = ["text", "image", "video", "human-video"];
    const data = source.filter((slot: any) => slot && typeof slot === "object").map((slot: any) => {
      const scheduledAt = typeof slot.scheduledAt === "string" ? new Date(slot.scheduledAt) : null;
      if (!scheduledAt || Number.isNaN(scheduledAt.valueOf())) return null;
      const safe: Record<string, unknown> = {
        ...(typeof slot.campaignTitle === "string" ? { campaignTitle: slot.campaignTitle.slice(0, 200) } : {}),
        ...(slot.campaignType === "single" || slot.campaignType === "campaign" ? { campaignType: slot.campaignType } : {}),
        scheduledAt: scheduledAt.toISOString(),
        ...(slot.platform === "Facebook" || slot.platform === "TikTok" ? { platform: slot.platform } : {}),
        ...(statuses.includes(String(slot.status)) ? { status: slot.status } : {}),
        ...(mediaTypes.includes(String(slot.mediaType)) ? { mediaType: slot.mediaType } : {}),
        ...(typeof slot.topicBrief === "string" ? { topicBrief: slot.topicBrief.slice(0, 400) } : {}),
      };
      const campaignId = String(slot.campaignId || "");
      const slotId = String(slot._id || "");
      if (/^[a-f\d]{24}$/i.test(campaignId) && /^[a-f\d]{24}$/i.test(slotId)) {
        Object.defineProperty(safe, "__assistantRef", { value: { id: campaignId, campaignId, slotId }, enumerable: false });
      }
      return safe;
    }).filter(Boolean);
    return { status: "success", data };
  }
  if (["marketing.campaign.slot.reject", "marketing.campaign.slot.retry", "marketing.campaign.slot.approve", "marketing.campaign.slot.publish-now"].includes(op.id)) {
    const slot = result?.data && typeof result.data === "object" ? result.data : {};
    const validPlatforms = ["Facebook", "TikTok"];
    const validMediaTypes = ["text", "image", "video", "human-video"];
    return { status: "success", data: {
      status: op.id === "marketing.campaign.slot.reject"
        ? slot.status === "needs_attention" ? "needs_attention" : undefined
        : op.id === "marketing.campaign.slot.retry"
          ? slot.status === "planned" ? "planned" : undefined
          : op.id === "marketing.campaign.slot.approve"
            ? slot.status === "ready_to_publish" ? "ready_to_publish" : undefined
            : slot.status === "publishing" ? "publishing" : undefined,
      ...(typeof slot.scheduledAt === "string" && !Number.isNaN(new Date(slot.scheduledAt).valueOf()) ? { scheduledAt: new Date(slot.scheduledAt).toISOString() } : {}),
      ...(validPlatforms.includes(String(slot.platform)) ? { platform: slot.platform } : {}),
      ...(validMediaTypes.includes(String(slot.mediaType)) ? { mediaType: slot.mediaType } : {}),
    } };
  }
  if (op.id === "marketing.ai.image.edit") {
    let url = "";
    try {
      const parsed = new URL(String(result?.url || result?.data?.url || ""));
      if (parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com" && !parsed.username && !parsed.password && !parsed.port) url = parsed.toString();
    } catch { /* reject malformed or untrusted media links */ }
    if (!url) throw new UncertainExecutionError("Ảnh có thể đã được tạo nhưng API không trả liên kết Cloudinary hợp lệ. Hãy kiểm tra thư viện media và số dư trước khi chỉnh sửa lại.");
    const metadata = result?.record?.metadata && typeof result.record.metadata === "object" ? result.record.metadata : {};
    return { status: "success", data: {
      url,
      ...(Number.isSafeInteger(metadata.revision) && metadata.revision > 0 ? { revision: metadata.revision } : {}),
      replayed: result?.replayed === true,
    } };
  }
  if (op.id === "omni-inbox.ai-reply-log.feedback.update") {
    const log = result.log && typeof result.log === "object" ? result.log : {};
    return { status: "success", data: {
      feedback: input.feedback,
      ...(typeof log.channel === "string" ? { channel: log.channel } : {}),
      ...(typeof log.status === "string" ? { status: log.status } : {}),
      ...(typeof log.createdAt === "string" ? { createdAt: log.createdAt } : {}),
    } };
  }
  if (op.id === "student.email.send") return { status: "success", data: { sent: true, recipient: input.to, subject: input.subject } };
  if (op.id === "marketing.ai.draft-posts") {
    const posts = Array.isArray(result?.posts) ? result.posts.slice(0, 8) : [];
    return { status: result?.status || "success", data: {
      posts: posts.map((post: any, index: number) => [
        `${index + 1}. ${typeof post?.channel === "string" ? post.channel.slice(0, 40) : "Bài đăng"}`,
        typeof post?.contentType === "string" ? `Loại nội dung: ${post.contentType.slice(0, 80)}` : "",
        typeof post?.outline === "string" ? `Dàn ý: ${post.outline.slice(0, 500)}` : "",
        typeof post?.bodyText === "string" ? `Bản nháp: ${post.bodyText.slice(0, 1200)}` : "",
      ].filter(Boolean).join("\n")).join("\n\n"),
      count: posts.length,
      generatedByAi: result?.isMock !== true,
    } };
  }
  if (op.id === "repair.feedback.link.create") {
    const data = result?.data && typeof result.data === "object" ? result.data : {};
    const feedbackUrl = typeof data.url === "string" && data.url.startsWith("/repair/feedback/")
      ? data.url.slice(0, 500)
      : "";
    return { status: result?.status || "success", data: {
      ticketCode: typeof data.ticketCode === "string" ? data.ticketCode.slice(0, 100) : "",
      feedbackUrl,
    } };
  }
  if (op.id === "repair.device.lookup") {
    const data = result?.data && typeof result.data === "object" ? result.data : {};
    const unit = data.serialUnit && typeof data.serialUnit === "object" ? data.serialUnit : {};
    const sold = data.sold && typeof data.sold === "object" ? data.sold : {};
    const customerCoverage = data.coverage?.customer && typeof data.coverage.customer === "object" ? data.coverage.customer : {};
    const supplierCoverage = data.coverage?.supplier && typeof data.coverage.supplier === "object" ? data.coverage.supplier : {};
    return { status: result?.status || "success", data: {
      found: data.found === true,
      ...(data.found === true ? {
        serialNumber: typeof unit.serialNumber === "string" ? unit.serialNumber.slice(0, 120) : "",
        sku: typeof unit.sku === "string" ? unit.sku.slice(0, 100) : "",
        productName: typeof unit.productName === "string" ? unit.productName.slice(0, 200) : "",
        soldAt: typeof sold.soldAt === "string" || sold.soldAt instanceof Date ? new Date(sold.soldAt).toISOString() : "",
        orderCode: typeof sold.orderCode === "string" ? sold.orderCode.slice(0, 100) : "",
        customerCode: typeof sold.customerCode === "string" ? sold.customerCode.slice(0, 100) : "",
        customerName: typeof sold.customerName === "string" ? sold.customerName.slice(0, 160) : "",
        customerCovered: customerCoverage.covered === true,
        customerWarrantyEndAt: typeof customerCoverage.endAt === "string" || customerCoverage.endAt instanceof Date ? new Date(customerCoverage.endAt).toISOString() : "",
        customerWarrantyDaysLeft: Number.isFinite(Number(customerCoverage.daysLeft)) ? Number(customerCoverage.daysLeft) : undefined,
        supplierCovered: supplierCoverage.covered === true,
        supplierWarrantyEndAt: typeof supplierCoverage.endAt === "string" || supplierCoverage.endAt instanceof Date ? new Date(supplierCoverage.endAt).toISOString() : "",
        supplierWarrantyDaysLeft: Number.isFinite(Number(supplierCoverage.daysLeft)) ? Number(supplierCoverage.daysLeft) : undefined,
        costBearer: ["supplier", "shop", "customer"].includes(String(data.coverage?.costBearer)) ? data.coverage.costBearer : "",
      } : {}),
    } };
  }
  if (op.id === "marketing.ai.topic-suggestions") {
    const suggestions = Array.isArray(result?.suggestions) ? result.suggestions
      .filter((item: unknown) => typeof item === "string")
      .slice(0, 5)
      .map((item: string) => item.trim().slice(0, 300))
      .filter(Boolean) : [];
    return { status: "success", data: { suggestions: suggestions.map((item: string, index: number) => `${index + 1}. ${item}`).join("\n"), count: suggestions.length } };
  }
  if (op.id === "marketing.ai.content-pillars") {
    const pillars = Array.isArray(result?.pillars) ? result.pillars.slice(0, 6) : [];
    return { status: result?.status || "success", data: {
      campaignTopic: String(input.campaignTopic || "").slice(0, 2000),
      pillars: pillars.map((pillar: any) => [
        typeof pillar?.title === "string" ? pillar.title.slice(0, 180) : "",
        typeof pillar?.ratio === "string" ? pillar.ratio.slice(0, 60) : "",
        typeof pillar?.description === "string" ? pillar.description.slice(0, 1000) : "",
      ].filter(Boolean).join(" — ")).filter(Boolean).join("\n"),
      count: pillars.length,
      generatedByAi: result?.isMock !== true,
    } };
  }
  if (op.id === "marketing.ai.campaign-ideas") {
    const concepts = Array.isArray(result?.concepts) ? result.concepts.slice(0, 3) : [];
    return { status: result?.status || "success", data: {
      campaignTopic: String(input.campaignTopic || "").slice(0, 2000),
      concepts: concepts.map((concept: any, index: number) => [
        `${index + 1}. ${typeof concept?.title === "string" ? concept.title.slice(0, 180) : "Ý tưởng"}`,
        typeof concept?.summary === "string" ? `Tóm tắt: ${concept.summary.slice(0, 700)}` : "",
        Array.isArray(concept?.channels) ? `Kênh: ${concept.channels.filter((channel: unknown) => typeof channel === "string").slice(0, 8).map((channel: string) => channel.slice(0, 40)).join(", ")}` : "",
        typeof concept?.suggestedContent === "string" ? `Nội dung gợi ý: ${concept.suggestedContent.slice(0, 1000)}` : "",
        Array.isArray(concept?.hashtags) ? `Hashtag: ${concept.hashtags.filter((tag: unknown) => typeof tag === "string").slice(0, 8).map((tag: string) => tag.slice(0, 60)).join(" ")}` : "",
      ].filter(Boolean).join("\n")).join("\n\n"),
      count: concepts.length,
      generatedByAi: result?.isMock !== true,
    } };
  }
  if (op.id === "marketing.ai.optimize-script") {
    const source = result?.data && typeof result.data === "object" ? result.data : result;
    return { status: result?.status || "success", data: {
      optimizedText: typeof source?.optimizedText === "string" ? source.optimizedText.slice(0, 12_000) : "",
    } };
  }
  if (op.id === "marketing.ai.optimize-image-prompt") {
    const source = result?.data && typeof result.data === "object" ? result.data : result;
    return { status: result?.status || "success", data: {
      subject: typeof source?.subject === "string" ? source.subject.slice(0, 500) : "",
      optimizedPrompt: typeof source?.optimized_english_prompt === "string" ? source.optimized_english_prompt.slice(0, 6_000) : "",
      negativePrompt: typeof source?.negative_prompt === "string" ? source.negative_prompt.slice(0, 1_000) : "",
      generatedByAi: source?.isLocalFallback !== true,
    } };
  }
  if (op.id === "company-knowledge.clear-all") return { status: result?.status || "success", data: { cleared: true } };
  if (op.id === "company-knowledge.health") {
    const topics = Array.isArray(result?.detectedTopics) ? result.detectedTopics : [];
    const warnings = Array.isArray(result?.warnings) ? result.warnings : [];
    return { status: result?.status || "success", data: {
      mode: result?.mode === "trained" ? "trained" : "default",
      documentsCount: Math.max(0, Number(result?.documentsCount) || 0),
      chunksCount: Math.max(0, Number(result?.chunksCount) || 0),
      detectedTopics: topics.slice(0, 8).map((topic: any) => typeof topic?.label === "string" ? topic.label.slice(0, 120) : "").filter(Boolean).join(", "),
      warnings: warnings.slice(0, 8).map((warning: unknown) => typeof warning === "string" ? warning.slice(0, 300) : "").filter(Boolean).join("; "),
      latestSyncAt: result?.latestSyncAt ?? null,
    } };
  }
  if (["marketing.account.telegram-link.status", "marketing.account.telegram-link.create", "marketing.account.telegram-link.unlink"].includes(op.id)) {
    const data = result?.data && typeof result.data === "object" ? result.data : {};
    const safe: Record<string, unknown> = {
      linked: data.linked === true,
      linkedAt: data.linkedAt ?? null,
      botUsername: typeof data.botUsername === "string" ? data.botUsername : "",
    };
    if (op.id !== "marketing.account.telegram-link.status") {
      safe.pendingCode = typeof data.pendingCode === "string" ? data.pendingCode : null;
      safe.pendingCodeExpiresAt = data.pendingCodeExpiresAt ?? null;
    }
    return { status: result.status || "success", data: safe };
  }
  if (op.id === "finance.receivable.detail") {
    const data = result?.data && typeof result.data === "object" ? result.data : {};
    const receivable = data.receivable && typeof data.receivable === "object" ? data.receivable : {};
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const reversedIds = new Set(entries.map((entry: any) => String(entry?.reversalOfEntryId || "")).filter(Boolean));
    const safeEntries = entries.filter((entry: any) => ["payment", "adjustment"].includes(String(entry?.type || ""))
      && !entry.reversalOfEntryId && !reversedIds.has(String(entry?._id || entry?.id || ""))
      && /^[a-f\d]{24}$/i.test(String(entry?._id || entry?.id || ""))).map((entry: any) => {
      const safe: Record<string, unknown> = {
        entryType: entry.type,
        amount: entry.amount,
        reason: entry.reason,
        createdAt: entry.createdAt,
      };
      Object.defineProperty(safe, "__assistantRef", { value: { id: String(entry._id || entry.id) }, enumerable: false });
      return safe;
    });
    return { status: result.status || "success", data: {
      receivableCode: receivable.receivableCode,
      customerName: receivable.customerName,
      balance: receivable.balance,
      status: receivable.status,
      entries: safeEntries,
    } };
  }
  if (op.id === "finance.receivable.entry.reversal") {
    const data = result?.data && typeof result.data === "object" ? result.data : {};
    const receivable = data.receivable && typeof data.receivable === "object" ? data.receivable : {};
    const entry = data.entry && typeof data.entry === "object" ? data.entry : {};
    return { status: result.status || "success", data: {
      receivableCode: receivable.receivableCode,
      customerName: receivable.customerName,
      balance: receivable.balance,
      status: receivable.status,
      type: entry.type === "reversal" ? "Đã đảo" : entry.type,
      amount: entry.amount,
      reason: entry.reason,
    } };
  }
  if (op.id === "finance.reminders.run") {
    const data = result?.data && typeof result.data === "object" ? result.data : {};
    const count = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
    return { status: "success", data: {
      eligibleCount: count(data.eligible),
      queuedCount: count(data.queued),
      skippedCount: count(data.skipped),
      failedCount: count(data.failed),
      duplicateCount: count(data.duplicates),
    } };
  }
  if (op.id === "finance.reminders.runs.list" || op.id === "finance.reminders.runs.detail") {
    const safeRun = (run: any, includeDeliveryCounts: boolean) => {
      const count = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
      const safe: Record<string, unknown> = {
        ...(typeof run?.businessDate === "string" ? { date: run.businessDate.slice(0, 10) } : {}),
        ...(run?.trigger === "manual" || run?.trigger === "scheduled" ? { trigger: run.trigger } : {}),
        ...(run?.status === "running" || run?.status === "completed" || run?.status === "failed" ? { status: run.status } : {}),
        eligibleCount: count(run?.eligible),
        queuedCount: count(run?.queued),
        skippedCount: count(run?.skipped),
        failedCount: count(run?.failed),
        duplicateCount: count(run?.duplicates),
        ...(typeof run?.startedAt === "string" ? { startedAt: run.startedAt } : {}),
        ...(typeof run?.completedAt === "string" ? { completedAt: run.completedAt } : {}),
      };
      if (includeDeliveryCounts) {
        const deliveries = Array.isArray(run?.deliveries) ? run.deliveries : [];
        safe.deliveryQueuedCount = deliveries.filter((delivery: any) => ["queued", "sending"].includes(String(delivery?.status))).length;
        safe.deliverySentCount = deliveries.filter((delivery: any) => delivery?.status === "sent").length;
        safe.deliverySkippedCount = deliveries.filter((delivery: any) => delivery?.status === "skipped").length;
        safe.deliveryFailedCount = deliveries.filter((delivery: any) => delivery?.status === "failed").length;
      } else {
        const id = String(run?._id || run?.id || "");
        if (/^[a-f\d]{24}$/i.test(id)) Object.defineProperty(safe, "__assistantRef", { value: { id }, enumerable: false });
      }
      return safe;
    };
    if (op.id === "finance.reminders.runs.list") {
      const records = Array.isArray(result?.data) ? result.data.slice(0, 100) : [];
      return { status: "success", data: records.filter((run: any) => run && typeof run === "object").map((run: any) => safeRun(run, false)) };
    }
    return { status: "success", data: safeRun(result?.data, true) };
  }
  if (["retail.debt-reminders.run", "retail.debt-reminders.runs.list", "retail.debt-reminders.runs.detail"].includes(op.id)) {
    const count = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
    const safeRun = (run: any) => {
      const safe: Record<string, unknown> = {
        ...(typeof run?.businessDate === "string" ? { businessDate: run.businessDate.slice(0, 10) } : {}),
        ...(run?.status === "running" || run?.status === "completed" || run?.status === "failed" ? { status: run.status } : {}),
        overdueOrders: count(run?.overdueOrders),
        recipients: count(run?.recipients),
        total: count(run?.total),
        queued: count(run?.queued),
        sent: count(run?.sent),
        failed: count(run?.failed),
        duplicates: count(run?.duplicates),
        ...(typeof run?.startedAt === "string" ? { startedAt: run.startedAt } : {}),
        ...(typeof run?.completedAt === "string" ? { completedAt: run.completedAt } : {}),
      };
      const id = String(run?._id || run?.id || "");
      if (/^[a-f\d]{24}$/i.test(id)) Object.defineProperty(safe, "__assistantRef", { value: { id }, enumerable: false });
      return safe;
    };
    if (op.id === "retail.debt-reminders.run") {
      const data = result?.data && typeof result.data === "object" ? result.data : {};
      return { success: true, data: {
        ...(typeof data.businessDate === "string" ? { businessDate: data.businessDate.slice(0, 10) } : {}),
        skipped: data.skipped === true,
        overdueOrders: count(data.overdueOrders),
        recipients: count(data.recipients),
        created: count(data.created),
        duplicates: count(data.duplicates),
      } };
    }
    if (op.id === "retail.debt-reminders.runs.list") {
      const data = result?.data && typeof result.data === "object" ? result.data : {};
      const items = Array.isArray(data.items) ? data.items.slice(0, 100) : [];
      return { success: true, data: {
        items: items.filter((item: any) => item && typeof item === "object").map(safeRun),
        total: count(data.total),
        page: Math.max(1, count(data.page)),
        limit: Math.min(100, count(data.limit)),
      } };
    }
    const data = result?.data && typeof result.data === "object" ? result.data : {};
    const run = data.run && typeof data.run === "object" ? data.run : {};
    const deliveries = Array.isArray(data.deliveries) ? data.deliveries : [];
    const safe = safeRun(run);
    safe.deliveryQueuedCount = deliveries.filter((delivery: any) => ["queued", "sending"].includes(String(delivery?.status))).length;
    safe.deliverySentCount = deliveries.filter((delivery: any) => delivery?.status === "sent").length;
    safe.deliveryFailedCount = deliveries.filter((delivery: any) => delivery?.status === "failed").length;
    safe.deliveryDuplicateCount = deliveries.filter((delivery: any) => delivery?.status === "duplicate").length;
    return { success: true, data: safe };
  }
  if (op.id === "omni-inbox.account.ai-config.update") return {
    displayName: result?.data?.displayName,
    platform: result?.data?.platform,
    updated: true,
  };
  if (op.id === "worker.bulk.create") return {
    importedCount: Math.max(0, Number(result?.importedCount) || 0),
    skippedCount: Math.max(0, Number(result?.skippedCount) || 0),
    errors: Array.isArray(result?.errors) ? result.errors.slice(0, 20).map((error: any) => ({
      row: Math.max(1, Number(error?.row) || 1),
      name: typeof error?.name === "string" ? error.name.slice(0, 160) : "",
      reason: typeof error?.reason === "string" ? error.reason.slice(0, 240) : "Dòng dữ liệu không hợp lệ.",
    })) : [],
  };
  if (op.id === "worker.update" && result?.worker && typeof result.worker === "object") {
    const worker = result.worker;
    return Object.fromEntries(op.resultFields.filter(key => Object.hasOwn(worker, key)).map(key => [key, worker[key]]));
  }
  if (op.id.startsWith("inventory.serial.transfer.")) {
    const safeSerial = (serial: any) => serial && typeof serial === "object" ? {
      serialNumber: serial.serialNumber,
      sku: serial.sku,
      productName: serial.productName,
      status: serial.status,
    } : serial;
    return { ...result, data: Array.isArray(result.data) ? result.data.map(safeSerial) : safeSerial(result.data) };
  }
  if (op.id === "inventory.count.item.update") {
    const count = result?.data && typeof result.data === "object" ? result.data : {};
    const item = Array.isArray(count.items) ? count.items.find((entry: any) => String(entry?._id || entry?.id || "") === String(input.path_itemId || "")) : undefined;
    return { ...result, data: {
      countCode: count.countCode,
      status: count.status,
      updatedItem: item ? { sku: item.sku, productName: item.productName, countedQuantity: item.countedQuantity, quantityDelta: item.quantityDelta, note: item.note } : undefined,
    } };
  }
  if (op.id === "retail.finance.cashbook.voucher.create") {
    const voucher = result?.data && typeof result.data === "object" ? result.data : {};
    return { ...result, data: {
      businessDate: voucher.businessDate, account: voucher.account, direction: voucher.direction,
      profitCategory: voucher.profitCategory, amount: voucher.amount, reason: voucher.reason, reference: voucher.reference,
    } };
  }
  if (op.id === "retail.finance.cashbook.close") {
    const period = result?.data && typeof result.data === "object" ? result.data : {};
    return { ...result, data: {
      from: period.from, to: period.to, count: period.count, cashNet: period.cashNet,
      bankNet: period.bankNet, closedAt: period.closedAt,
    } };
  }
  if (op.id === "retail.receivable.customer.history") {
    const source = result?.data && typeof result.data === "object" ? result.data : {};
    const entries = Array.isArray(source.items) ? source.items : [];
    return { ...result, data: entries.map((entry: any) => ({
      type: entry.type, amount: entry.amount, signedAmount: entry.signedAmount, runningBalance: entry.runningBalance,
      reason: entry.reason, paymentMethod: entry.paymentMethod, reference: entry.reference, createdAt: entry.createdAt,
    })) };
  }
  if (op.id === "retail.after-sale.list") {
    const source = result?.data && typeof result.data === "object" ? result.data : {};
    return { ...result, data: {
      items: Array.isArray(source.items) ? source.items.map(safeRetailAfterSale) : [],
      total: source.total, page: source.page, limit: source.limit,
    } };
  }
  if (op.id === "retail.after-sale.detail") return { ...result, data: safeRetailAfterSale(result?.data) };
  if (op.id === "retail.after-sale.create") return { ...result, data: safeRetailAfterSale(result?.data) };
  if (op.id === "retail.receivable.reconciliation.latest" || op.id === "retail.receivable.reconciliation.run") {
    const source = result?.data && typeof result.data === "object" ? result.data : {};
    return { ...result, data: {
      differenceCount: Array.isArray(source.differences) ? source.differences.length : 0,
      orderTotal: source.orderTotal,
      ledgerTotal: source.ledgerTotal,
      differenceTotal: source.differenceTotal,
      createdAt: source.createdAt,
    } };
  }
  if (op.id === "retail.finance.cashbook.list" || op.id === "retail.finance.cashbook.reconcile") {
    const source = result?.data && typeof result.data === "object" ? result.data : {};
    const numberValue = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : undefined;
    const entries = Array.isArray(source.entries) ? source.entries.map((entry: any) => ({
      businessDate: entry.businessDate, account: entry.account, direction: entry.direction, amount: entry.amount,
      description: entry.description, reference: entry.reference,
    })) : [];
    const summary = source.summary && typeof source.summary === "object" ? {
      count: numberValue(source.summary.count), cashNet: numberValue(source.summary.cashNet), bankNet: numberValue(source.summary.bankNet),
    } : undefined;
    const shiftsReconciliation = Array.isArray(source.shiftsReconciliation) ? source.shiftsReconciliation.map((shift: any) => ({
      shiftCode: shift.shiftCode, businessDate: shift.businessDate, status: shift.status,
      expectedCash: numberValue(shift.expectedCash), countedCash: shift.countedCash === null ? null : numberValue(shift.countedCash),
      varianceAmount: shift.varianceAmount === null ? null : numberValue(shift.varianceAmount),
    })) : [];
    if (op.id === "retail.finance.cashbook.list") return { ...result, data: { entries, summary, shiftsReconciliation } };
    const rawPeriod = source.period && typeof source.period === "object" ? source.period : null;
    const period = rawPeriod ? {
      from: rawPeriod.from, to: rawPeriod.to, count: numberValue(rawPeriod.count),
      cashNet: numberValue(rawPeriod.cashNet), bankNet: numberValue(rawPeriod.bankNet),
    } : null;
    return { ...result, data: { entries, summary, shiftsReconciliation, period, balanced: typeof source.balanced === "boolean" ? source.balanced : null } };
  }
  if (op.id === "retail.payment-review.pending" || op.id === "retail.payment-review.review") {
    const source = result?.data;
    const safe = (item: any) => ({
      __assistantRef: { id: String(item?._id || item?.id || "") },
      ...(typeof item?.paymentCode === "string" && item.paymentCode ? { code: item.paymentCode } : typeof item?.orderCode === "string" && item.orderCode ? { code: item.orderCode } : typeof item?.referenceCode === "string" && item.referenceCode ? { code: item.referenceCode } : {}),
      orderCode: item?.orderCode, paymentCode: item?.paymentCode, receivedAmount: item?.receivedAmount,
      appliedAmount: item?.appliedAmount, reviewReason: item?.reviewReason, reviewNote: item?.reviewNote,
      transactionDate: item?.transactionDate, reviewedAt: item?.reviewedAt, status: item?.status,
    });
    if (Array.isArray(source)) return { ...result, data: source.map(safe) };
    return { ...result, data: source && typeof source === "object" ? safe(source) : null };
  }
  if (op.id === "student.bulk.delete.preview") {
    const items = Array.isArray(result.items) ? result.items.slice(0, 20) : [];
    const impactSummary = items.map((item: any) => {
      const reasons = Array.isArray(item?.reasons) ? item.reasons.slice(0, 8).map((reason: any) => {
        const details = Array.isArray(reason?.details) ? reason.details.filter((detail: unknown) => typeof detail === "string" && !/^[a-f\d]{24}$/i.test(detail)).slice(0, 2) : [];
        return `${typeof reason?.label === "string" ? reason.label.slice(0, 80) : "Dữ liệu liên quan"} (${Math.max(0, Number(reason?.count) || 0)})${details.length ? `: ${details.join(", ")}` : ""}`;
      }) : [];
      return `${typeof item?.name === "string" ? item.name.slice(0, 120) : "Học viên"}: ${reasons.length ? reasons.join("; ") : "Không có dữ liệu vận hành liên quan được liệt kê"}`;
    }).join("\n").slice(0, 1800);
    return { success: result.success, data: {
      deletableCount: Math.max(0, Number(result.deletableCount) || 0),
      blockedCount: Math.max(0, Number(result.blockedCount) || 0),
      impactSummary: impactSummary || "Không có hồ sơ phù hợp để xem trước.",
    } };
  }
  if (op.id === "student.bulk.delete") {
    return { success: result.success, data: {
      deletedCount: Math.max(0, Number(result.deletedCount) || 0),
      blockedCount: Array.isArray(result.blocked) ? result.blocked.length : 0,
    } };
  }
  if (op.id === "recruitment.applicant.create" && result?.data?.duplicateWarning) {
    const matches = Array.isArray(result.data.matches) ? result.data.matches.map((item: any) => ({ fullName: item.fullName, email: item.email, phone: item.phone, createdAt: item.createdAt })) : [];
    return { ...result, data: { created: false, duplicateWarning: true, matches, message: "Tìm thấy hồ sơ trùng email hoặc số điện thoại. Chưa tạo ứng viên; hãy kiểm tra kết quả và xác nhận rõ nếu vẫn muốn tạo." } };
  }
  if (op.id === "payroll.employee.me.reconciliation" && Array.isArray(result?.data)) {
    return { ...result, data: result.data.map((record: any) => {
      const openIssues = Array.isArray(record.issues) ? record.issues.filter((issue: any) => issue?.status === "open") : [];
      return {
        periodKey: record.periodKey,
        runStatus: record.runStatus,
        stale: record.stale,
        confirmedAt: record.confirmedAt,
        netPay: record.snapshot?.values?.net,
        openIssueCount: openIssues.length,
        openIssueFields: openIssues.map((issue: any) => payrollReconciliationFieldLabels[issue.field] || "Khoản lương").join(", "),
        __assistantRef: {
          runId: String(record.runId || ""),
          version: record.version,
          issues: openIssues.map((issue: any) => ({ id: issue.id, field: issue.field })),
        },
      };
    }) };
  }
  if (op.id === "payroll.employee.reconciliation.action" && result?.data) {
    const record = result.data;
    return { ...result, data: {
      action: input.action,
      periodKey: record.periodKey,
      confirmedAt: record.confirmedAt,
      issues: Array.isArray(record.issues) ? record.issues.map((issue: any) => {
        const latestMessage = Array.isArray(issue.messages) ? issue.messages[issue.messages.length - 1] : undefined;
        return {
          fieldLabel: payrollReconciliationFieldLabels[issue.field] || "Khoản lương",
          status: issue.status === "open" ? "Đang chờ phản hồi" : "Đã xử lý",
          message: typeof latestMessage?.body === "string" ? latestMessage.body : undefined,
          updatedAt: latestMessage?.at,
        };
      }) : [],
    } };
  }
  if (op.id === "account.profile.me" && result?.user) {
    const { user, ...safeResult } = result;
    return { ...safeResult, data: { displayName: user.displayName, email: user.email } };
  }
  if (op.id === "account.profile.update" && result?.user) {
    const { user, ...safeResult } = result;
    return { ...safeResult, data: { displayName: user.displayName } };
  }
  if (op.id === "account.business-settings.update") {
    const businessType = result?.data?.user?.businessType;
    return { status: result?.status || "success", data: { businessType: ["driving", "language", "general"].includes(businessType) ? businessType : "" } };
  }
  if (op.id === "marketing.canva.status" && result?.data) {
    return { ...result, data: { connected: result.data.connected === true, connectedAt: result.data.connectedAt } };
  }
  if (["marketing.telegram-order.config-status", "marketing.telegram-order.config.update"].includes(op.id) && result?.data) {
    const config = result.data;
    return { ...result, data: {
      enabled: config.enabled === true,
      notifyNewOrder: config.notifyNewOrder !== false,
      botConfigured: config.hasBotToken === true,
      botUsername: typeof config.botUsername === "string" ? config.botUsername : "",
      lastTestedAt: config.lastTestedAt,
      lastTestStatus: typeof config.lastTestStatus === "string" ? config.lastTestStatus : "untested",
    } };
  }
  if (["marketing.product-catalog.config", "marketing.product-catalog.config.update"].includes(op.id) && result?.data) {
    const config = result.data;
    return { ...result, data: {
      enabled: config.enabled === true,
      maxImagesPerReply: Number.isFinite(Number(config.maxImagesPerReply)) ? Number(config.maxImagesPerReply) : 5,
      catalogName: typeof config.catalogName === "string" ? config.catalogName.slice(0, 100) : "",
      itemLabel: typeof config.itemLabel === "string" ? config.itemLabel.slice(0, 80) : "",
      selectionMessage: typeof config.selectionMessage === "string" ? config.selectionMessage.slice(0, 500) : "",
      businessDescription: typeof config.businessDescription === "string" ? config.businessDescription.slice(0, 1000) : "",
    } };
  }
  if (op.id === "marketing.product-catalog.config.test" && result?.data) {
    const test = result.data;
    return { ...result, data: {
      categoryCount: Number.isFinite(Number(test.categoryCount)) ? Number(test.categoryCount) : 0,
      imageCount: Number.isFinite(Number(test.imageCount)) ? Number(test.imageCount) : 0,
      categories: Array.isArray(test.categories) ? test.categories.slice(0, 20).map((category: any) => ({
        name: typeof category?.name === "string" ? category.name.slice(0, 100) : "",
        imageCount: Number.isFinite(Number(category?.imageCount)) ? Number(category.imageCount) : 0,
      })) : [],
    } };
  }
  if (["marketing.sepay.config", "marketing.sepay.config.update"].includes(op.id) && result?.data) {
    const config = result.data;
    return { ...result, data: {
      enabled: config.enabled === true,
      webhookConfigured: config.hasWebhookSecret === true,
      depositEnabled: config.depositEnabled === true,
      depositPercent: Number.isFinite(Number(config.depositPercent)) ? Number(config.depositPercent) : 0,
      paymentCodePrefix: typeof config.paymentCodePrefix === "string" ? config.paymentCodePrefix.slice(0, 5) : "",
      lastWebhookAt: config.lastWebhookAt,
      lastWebhookStatus: typeof config.lastWebhookStatus === "string" ? config.lastWebhookStatus : "untested",
      accountCount: Array.isArray(config.accountNumbers) ? config.accountNumbers.length : 0,
    } };
  }
  if (op.id === "marketing.order-sheet.orders.list" && Array.isArray(result?.data)) {
    return { ...result, data: result.data.filter((order: any) => order?.isSimulation !== true).map((order: any) => ({
      customerName: typeof order.customerName === "string" ? order.customerName : "",
      itemsSummary: Array.isArray(order.items) ? order.items.slice(0, 4).map((item: any) => `${Math.max(0, Number(item.quantity) || 0)} × ${[item.productName, item.variantSummary].filter((part: unknown) => typeof part === "string" && part.trim()).join(" · ")}`).join(", ") : "",
      totalAmount: typeof order.totalAmount === "number" ? order.totalAmount : undefined,
      orderStatus: order.status,
      createdAt: order.createdAt,
      depositStatus: order.depositStatus,
      paymentMethod: order.paymentMethod,
    })) };
  }
  if (op.id === "marketing.ai-subscription.plans" && Array.isArray(result?.data?.plans)) {
    return { ...result, data: { plans: result.data.plans.map((plan: any) => ({
      code: plan.code, name: plan.name, description: plan.description, durationDays: plan.durationDays,
      aiLimit: plan.aiLimit, priceVnd: plan.priceVnd,
    })) } };
  }
  if (op.id === "marketing.ai-subscription.summary" && result?.data) {
    const subscription = result.data.subscription;
    const usage = Array.isArray(result.data.usage) ? result.data.usage.map((entry: any) => ({
      kind: entry.kind, model: entry.model, units: entry.units, status: entry.status,
      createdAt: entry.createdAt, completedAt: entry.completedAt,
    })) : [];
    return { ...result, data: {
      planName: subscription?.planName || "Chưa có gói AI còn hiệu lực",
      subscriptionStatus: subscription?.status || "none",
      billingScope: subscription?.scope || "",
      aiLimit: subscription?.aiLimit ?? 0,
      used: subscription?.used ?? 0,
      remaining: subscription?.remaining ?? 0,
      expiresAt: subscription?.expiresAt,
      usage,
    } };
  }
  if (op.id === "marketing.author.integration-status" && result?.data) {
    const author = result.data;
    const facebook = author.facebookIntegration || {};
    const tiktok = author.tiktokIntegration || {};
    const zalo = author.zaloIntegration || {};
    return { ...result, data: {
      facebookConnected: facebook.isConnected === true,
      ...(typeof facebook.pageName === "string" && facebook.pageName ? { facebookPageName: facebook.pageName } : {}),
      tiktokConnected: tiktok.isConnected === true,
      ...(typeof tiktok.username === "string" && tiktok.username ? { tiktokUsername: tiktok.username } : {}),
      zaloConnected: zalo.isConnected === true,
      ...(typeof zalo.oaName === "string" && zalo.oaName ? { zaloName: zalo.oaName } : {}),
    } };
  }
  if (op.id === "department.lookup") {
    const departments = Array.isArray(result?.data) ? result.data : [];
    const query = normalize(String(input.query_department || ""));
    const exact = departments.filter((department: any) => normalize(String(department?.name || "")) === query);
    const withoutDepartmentPrefix = (value: string) => normalize(value).replace(/^phong(?:\s+ban)?\s+/, "").trim();
    const comparableQuery = withoutDepartmentPrefix(query);
    const prefixNormalizedExact = departments.filter((department: any) => withoutDepartmentPrefix(String(department?.name || "")) === comparableQuery);
    const matches = exact.length
      ? exact
      : prefixNormalizedExact.length
        ? prefixNormalizedExact
        : departments.filter((department: any) => withoutDepartmentPrefix(String(department?.name || "")).includes(comparableQuery));
    return { ...result, data: matches };
  }
  if (op.id === "hr.contract.extend" && result?.data && typeof result.data === "object") {
    const extension = result.data.extension && typeof result.data.extension === "object" ? result.data.extension : {};
    const contract = result.data.contract && typeof result.data.contract === "object" ? result.data.contract : {};
    return { ...result, data: {
      id: extension.contractId || contract._id,
      employeeName: extension.employeeName || contract.employeeName,
      previousEndDate: extension.previousEndDate,
      newEndDate: extension.newEndDate,
      extensionDate: extension.extensionDate,
    } };
  }
  if (op.id === "account.colleagues.list" && Array.isArray(result?.data)) {
    return { ...result, data: result.data.map((colleague: any) => ({
      // Keep the identifier only for internal name resolution; resultFields omit this property from chat.
      ...(typeof colleague._id === "string" && /^[a-f\d]{24}$/i.test(colleague._id) ? { __assistantRef: { id: colleague._id } } : {}),
      displayName: colleague.displayName,
      email: colleague.email,
      department: colleague.department,
      jobTitle: colleague.jobTitle,
      qualification: colleague.qualification,
      ...(typeof colleague.branchName === "string" && colleague.branchName ? { branchName: colleague.branchName } : {}),
      isActive: colleague.isActive !== false,
    })) };
  }
  if (op.id === "company-knowledge.documents.list" && Array.isArray(result?.documents)) {
    return { status: result.status || "success", data: result.documents.map((document: any) => ({
      id: document.id,
      title: document.title,
      sourceType: document.sourceType,
      status: document.status,
      documentType: document.documentType,
      channelScope: document.channelScope,
      purposeScope: document.purposeScope,
      pageScope: document.pageScope,
      chunksCount: document.chunksCount,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    })) };
  }
  if (op.id === "company-knowledge.documents.delete" && result?.document) {
    return { status: result.status || "success", data: { message: result.message, document: { title: result.document.title } } };
  }
  if (op.id === "company-knowledge.documents.scopes.update" && result?.document) {
    return { status: result.status || "success", data: {
      documentType: result.document.documentType,
      channelScope: result.document.channelScope,
      purposeScope: result.document.purposeScope,
      pageScope: result.document.pageScope,
      updatedAt: result.document.updatedAt,
    } };
  }
  if (op.id === "company-knowledge.conflicts.list" && Array.isArray(result?.conflicts)) {
    return { status: result.status || "success", data: result.conflicts.map((conflict: any) => ({
      type: conflict.type,
      severity: conflict.severity,
      title: conflict.title,
      documentA: conflict.documentA ? { title: conflict.documentA.title, documentType: conflict.documentA.documentType } : undefined,
      documentB: conflict.documentB ? { title: conflict.documentB.title, documentType: conflict.documentB.documentType } : undefined,
    })) };
  }
  if (op.id === "company-knowledge.faq-candidates.list" && Array.isArray(result?.candidates)) {
    return { status: result.status || "success", data: result.candidates.map(safeFaqCandidate) };
  }
  if (op.id === "company-knowledge.faq-candidates.analyze" && Array.isArray(result?.candidates)) {
    return { status: result.status || "success", data: {
      extractedCount: result.extractedCount,
      message: result.message,
      candidates: result.candidates.map(safeFaqCandidate),
    } };
  }
  if ((op.id === "company-knowledge.faq-candidate.approve" || op.id === "company-knowledge.faq-candidate.reject") && result?.candidate) {
    return { status: result.status || "success", data: { message: result.message, candidate: safeFaqCandidate(result.candidate) } };
  }
  if (op.id === "company-knowledge.faq-candidate.delete") {
    return { status: result.status || "success", data: { message: result.message } };
  }
  if (op.id === "timekeeping.today.me" && result?.data) {
    const log = result.data.log && typeof result.data.log === "object" ? result.data.log : null;
    const calendar = result.data.workCalendar && typeof result.data.workCalendar === "object" ? result.data.workCalendar : {};
    return { ...result, data: {
      date: calendar.date,
      isWorkingDay: calendar.isWorkingDay,
      dayLabel: calendar.label,
      attendanceStatus: !log ? "Chưa ghi nhận chấm công hôm nay" : log.checkIn && log.checkOut ? "Đã vào và ra ca" : log.checkIn ? "Đã vào ca" : "Chưa ghi nhận giờ vào",
      checkIn: log?.checkIn,
      checkOut: log?.checkOut,
    } };
  }
  if (op.id === "timekeeping.records.list" && Array.isArray(result?.data)) {
    return { ...result, data: result.data.map((record: any) => ({
      date: record?.date,
      employeeName: record?.employeeName,
      attendanceStatus: record?.attendanceStatus,
      checkIn: record?.checkIn,
      checkOut: record?.checkOut,
    })) };
  }
  if (op.id === "timekeeping.record.update" && result?.data && typeof result.data === "object") {
    const row = result.data;
    const clock = (value: unknown) => {
      if (!(typeof value === "string" || value instanceof Date)) return undefined;
      const date = new Date(value);
      return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
    };
    return { ...result, data: {
      date: row.date,
      status: row.status,
      checkInTime: clock(row.checkIn?.time),
      checkOutTime: clock(row.checkOut?.time),
      manuallyAdjusted: row.manuallyAdjusted === true,
      adjustmentReason: typeof row.adjustmentReason === "string" ? row.adjustmentReason : undefined,
    } };
  }
  if (op.id === "timekeeping.company.location" && result?.data) {
    return { ...result, data: safeCompanyLocation(result.data) };
  }
  if (op.id === "api.patch.cbf8c2b9d544f837" && result?.data) {
    return { ...result, data: safeCompanyLocation({ ...result.data, annualLeaveDays: body.annualLeaveDays }) };
  }
  if (op.id === "api.get.d2e63aaeb8682c88" && Array.isArray(result?.data)) {
    const reasons: Record<string, string> = {
      branch_missing: "Tài khoản chưa được gán chi nhánh", outside_radius: "Ngoài bán kính chấm công", network_not_allowed: "Chưa kết nối đúng mạng chi nhánh",
      branch_attendance_not_configured: "Chi nhánh chưa cấu hình vị trí chấm công", already_checked_in: "Đã ghi nhận giờ vào ca", missing_check_in: "Chưa có giờ vào ca",
      already_checked_out: "Đã ghi nhận giờ ra ca", invalid_image: "Ảnh khuôn mặt không hợp lệ", not_registered: "Chưa đăng ký khuôn mặt",
      no_face: "Không nhận diện được khuôn mặt", multiple_faces: "Ảnh có nhiều khuôn mặt", spoof_detected: "Không vượt qua kiểm tra ảnh thật",
      face_mismatch: "Khuôn mặt không khớp hồ sơ", model_unavailable: "Dịch vụ xác thực khuôn mặt gián đoạn",
    };
    return { ...result, data: result.data.map((attempt: any) => ({
      employeeName: attempt.displayName,
      actionLabel: attempt.action === "check-in" ? "Vào ca" : attempt.action === "check-out" ? "Ra ca" : "Chấm công",
      outcomeLabel: attempt.outcome === "error" ? "Lỗi hệ thống" : "Bị từ chối",
      reasonLabel: reasons[String(attempt.reasonCode)] || "Cần kiểm tra thêm",
      attemptedAt: attempt.attemptedAt,
      distanceMeters: typeof attempt.distance === "number" && Number.isFinite(attempt.distance) ? attempt.distance : undefined,
    })) };
  }
  if (op.id === "api.get.d632a938b9c72492" && Array.isArray(result?.data)) {
    return { ...result, data: result.data.map(safeWorkShift) };
  }
  if (["api.post.4e68581113f1ef79", "api.patch.08411917f1ed9b75"].includes(op.id)) {
    return { ...result, data: safeWorkShift(result?.data) };
  }
  if (op.id === "api.delete.39330ed93a819149") {
    return { status: result?.status || "success", data: { deleted: true } };
  }
  if (op.id === "api.get.efd26957a4dbe889" && Array.isArray(result?.data)) {
    const shiftOperation = operationById("api.get.d632a938b9c72492");
    let shiftNames = new Map<string, string>();
    if (shiftOperation) {
      try {
        const shifts = await callOperation(req, shiftOperation, {} as any);
        shiftNames = new Map((Array.isArray(shifts?.data) ? shifts.data : []).map((shift: any) => [String(shift?.__assistantRef?.id || ""), String(shift?.name || shift?.code || "")]).filter(([id, name]) => id && name));
      } catch { /* names are supplemental; assignment rows remain safe without them */ }
    }
    return { ...result, data: result.data.map((employee: any) => {
      const assignment = employee?.assignment && typeof employee.assignment === "object" ? employee.assignment : null;
      const safeId = String(employee?._id || employee?.id || "");
      return {
        ...( /^[a-f\d]{24}$/i.test(safeId) ? { __assistantRef: { id: safeId } } : {}),
        employeeName: employee?.displayName || employee?.fullName,
        department: employee?.department,
        shiftName: assignment ? shiftNames.get(String(assignment.shiftId || "")) || "Ca chưa xác định" : "Chưa phân ca",
        effectiveFrom: assignment?.effectiveFrom,
        effectiveTo: assignment?.effectiveTo,
        daysOfWeekLabel: formatWeekdays(assignment?.daysOfWeek),
      };
    }) };
  }
  if (op.id === "api.post.5511b45cf3a736d1") {
    const assignments = Array.isArray(result?.data) ? result.data : [];
    return { ...result, data: {
      assignedCount: assignments.length,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo || undefined,
      daysOfWeekLabel: formatWeekdays(body.daysOfWeek),
    } };
  }
  if (op.id === "api.get.5d0d3ea4fc0d9efb" && Array.isArray(result?.data)) {
    return { ...result, data: result.data.map(safeWorkHoursEmployee) };
  }
  if (op.id === "api.patch.6bc968347283a069" && result?.data) {
    const user = result.data;
    return { ...result, data: {
      ...safeWorkHoursEmployee(user),
      employmentStatus: user?.employmentStatus ?? user?.workHoursConfig?.employmentStatus,
      officialDate: user?.officialDate ?? user?.workHoursConfig?.officialDate,
    } };
  }
  if (op.id === "employee.count" && result?.data && typeof result.data === "object") {
    const rawCount = result.data.count ?? result.data.total ?? result.total;
    const count = typeof rawCount === "number" || (typeof rawCount === "string" && rawCount.trim()) ? Number(rawCount) : NaN;
    if (Number.isSafeInteger(count) && count >= 0) return { ...result, data: {
      count,
      ...(input.createdFrom ? { createdFrom: input.createdFrom } : {}),
      ...(input.createdTo ? { createdTo: input.createdTo } : {}),
      ...(typeof result.data.branchName === "string" ? { branchName: result.data.branchName } : {}),
      ...(typeof result.data.branchCode === "string" ? { branchCode: result.data.branchCode } : {}),
      ...(result.data.scope === "company" || result.data.scope === "branch" ? { scope: result.data.scope } : {}),
    } };
  }
  if (op.id === "department.unmanaged.list" && Array.isArray(result?.data)) {
    return { ...result, data: result.data
      .filter((department: any) => department?.isActive !== false)
      .filter((department: any) => !String(department?.managerUid || department?.managerName || "").trim())
      .map((department: any) => ({ name: typeof department?.name === "string" ? department.name : "" })) };
  }
  const workCalendarRows = Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : null;
  if (["timekeeping.work-calendar.list", "timekeeping.work-calendar.month-holidays", "timekeeping.work-calendar.named-holiday"].includes(op.id) && workCalendarRows) {
    const dayTypes: Record<string, string> = { holiday: "Ngày nghỉ lễ", substitute_holiday: "Nghỉ bù", working_override: "Ngày làm việc bù" };
    const normalizedEventName = String(input.eventName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const days = op.id === "timekeeping.work-calendar.named-holiday"
      ? workCalendarRows.filter((day: any) => {
        const normalizedDayName = String(day?.name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        return normalizedEventName.length >= 2 && normalizedDayName.includes(normalizedEventName);
      })
      : workCalendarRows;
    const normalizedDays = days.map((day: any) => ({
      __assistantRef: { id: String(day._id || day.id || ""), source: day.source },
      date: day.date,
      name: day.name,
      dayTypeLabel: dayTypes[day.dayType] || "Ngày đặc biệt",
      isApplied: day.isApplied,
    }));
    return Array.isArray(result) ? normalizedDays : { ...result, data: normalizedDays };
  }
  if (op.id === "timekeeping.work-calendar.sync" && Array.isArray(result?.data)) {
    return { ...result, data: { calendarDaysCount: result.data.length } };
  }
  if (["timekeeping.work-calendar.create", "timekeeping.work-calendar.update"].includes(op.id) && result?.data && typeof result.data === "object") {
    const dayTypes: Record<string, string> = { holiday: "Ngày nghỉ lễ", substitute_holiday: "Nghỉ bù", working_override: "Ngày làm việc bù" };
    const day = result.data;
    return { ...result, data: { date: day.date, name: day.name, dayTypeLabel: dayTypes[day.dayType] || "Ngày đặc biệt", isApplied: day.isApplied } };
  }
  if (op.id === "finance.receivable.extend") {
    const receivable = result?.data?.receivable || {};
    const entry = result?.data?.entry || {};
    return { ...result, data: {
      receivableCode: receivable.receivableCode, previousDueDate: entry.previousDueDate, newDueDate: entry.newDueDate,
      dueDate: receivable.dueDate, balance: receivable.balance, status: receivable.status,
    } };
  }
  if (op.id === "customer.billing.profile.create" && result?.data?.profile) {
    return { ...result, data: { ...result.data.profile, warnings: result.data.warnings || [] } };
  }
  if (op.id === "retail.order.confirm" && result?.data?.order) return { ...result, data: result.data.order };
  if (op.id === "retail.order.checkout" && result?.data?.order) return { ...result, data: result.data.order };
  if (op.id === "marketing.canva.designs.list") {
    const designs = Array.isArray(result?.data) ? result.data.slice(0, 30) : [];
    return { ...result, data: designs.filter((design: any) => design && typeof design === "object").map((design: any) => ({
      ...(typeof design.title === "string" ? { title: design.title.slice(0, 200) } : { title: "Thiết kế chưa đặt tên" }),
      ...(typeof design.updated_at === "string" ? { updatedAt: design.updated_at.slice(0, 40) } : {}),
    })) };
  }
  if (op.id === "omni-inbox.leads.detail" && result?.data && typeof result.data === "object" && !Array.isArray(result.data)) {
    const lead = result.data;
    const safe: Record<string, unknown> = {};
    for (const key of ["customerName", "company", "phone", "email", "productOfChoice", "lastInteraction"]) {
      if (typeof lead[key] === "string") safe[key] = lead[key].slice(0, key === "lastInteraction" ? 1000 : 300);
    }
    if (Number.isFinite(lead.value) && lead.value >= 0) safe.value = lead.value;
    if (["cold", "warm", "hot", "won", "upsell"].includes(String(lead.status))) safe.status = lead.status;
    return { ...result, data: safe };
  }
  if (op.id === "marketing.elevenlabs.voice.delete") return { status: "success", data: { deleted: result?.success === true } };
  if (op.id === "marketing.campaign.sheet.revisions.revert") {
    const data = result?.data && typeof result.data === "object" ? result.data : {};
    return { status: "success", data: {
      revertedRows: Number.isSafeInteger(data.revertedRows) && data.revertedRows >= 0 ? data.revertedRows : 0,
      conflictCount: Array.isArray(data.conflicts) ? data.conflicts.length : 0,
    } };
  }
  return normalizeBusinessResult(op.module, op.id, result);
}
function projectApprovedReportValue(value: unknown, schema: AssistantResultFieldTree): unknown {
  if (Array.isArray(schema)) {
    const projectRecord = (candidate: unknown) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return undefined;
      const source = candidate as Record<string, unknown>;
      const safe: Record<string, unknown> = {};
      for (const key of schema) {
        if (!Object.hasOwn(source, key)) continue;
        const child = source[key];
        if (typeof child === "string" || typeof child === "number" || typeof child === "boolean") safe[key] = child;
        else if (child instanceof Date && Number.isFinite(child.valueOf())) safe[key] = child.toISOString();
      }
      return Object.keys(safe).length ? safe : undefined;
    };
    if (Array.isArray(value)) return value.flatMap(candidate => {
      const projected = projectRecord(candidate);
      return projected ? [projected] : [];
    });
    return projectRecord(value);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  for (const [key, childSchema] of Object.entries(schema)) {
    if (!Object.hasOwn(source, key)) continue;
    const projected = projectApprovedReportValue(source[key], childSchema);
    if (projected !== undefined) safe[key] = projected;
  }
  return Object.keys(safe).length ? safe : undefined;
}

function projectApprovedReportRecord(source: unknown, op: AssistantOperation): AssistantRecord {
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  const record = source as Record<string, unknown>;
  const safe: AssistantRecord = {};
  for (const key of op.resultFields) {
    if (!Object.hasOwn(record, key)) continue;
    const value = record[key];
    const schema = op.resultChildFields?.[key];
    if (schema) {
      const projected = projectApprovedReportValue(value, schema);
      if (projected !== undefined) safe[key] = projected as AssistantValue;
    } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
    } else if (value instanceof Date && Number.isFinite(value.valueOf())) {
      safe[key] = value.toISOString();
    }
  }
  return safe;
}

export function projectRecords(op: AssistantOperation, response: any, req: AuthenticatedRequest, input: Record<string, AssistantValue> = {}): AssistantRecord[] {
  if (op.module === "quotation") return projectQuotationRecords(op, response);
  if (op.module === "healthcare") return projectHealthcareRecords(op, response);
  const responseData = response?.data ?? response?.user ?? response?.worker ?? response;
  if (op.id === "retail.partner.overview") {
    const summary = responseData && typeof responseData === "object" ? responseData as Record<string, unknown> : {};
    const fields = ["total", "collaborators", "dealers", "suppliers", "active", "inactive", "missingPhone", "missingEmail", "missingAddress"];
    const projected: AssistantRecord = {};
    for (const field of fields) {
      const value = Number(summary[field]);
      if (Number.isSafeInteger(value) && value >= 0) projected[field] = value;
    }
    return Object.keys(projected).length ? [projected] : [];
  }
  if (op.id === "retail.partner.commission.policy.list") {
    const items = Array.isArray(responseData?.assistantItems) ? responseData.assistantItems : [];
    return items.flatMap((item: any) => {
      if (!item || typeof item !== "object") return [];
      const projected: AssistantRecord = {};
      const policyId = String(item._policyId || item._id || item.id || "");
      if (/^[a-f\d]{24}$/i.test(policyId)) Object.defineProperty(projected, "id", { value: policyId, enumerable: false });
      for (const key of ["partnerName", "scope", "kind", "sku", "status"]) {
        if (typeof item[key] === "string") projected[key] = item[key];
      }
      for (const key of ["ratePercent"]) {
        const value = Number(item[key]);
        if (Number.isFinite(value)) projected[key] = value;
      }
      for (const key of ["effectiveAt", "effectiveFrom"]) {
        const value = item[key];
        if (value instanceof Date && Number.isFinite(value.valueOf())) projected[key] = value.toISOString();
        else if (typeof value === "string" && value.length <= 40) projected[key] = value;
      }
      if (item.config && typeof item.config === "object") {
        for (const key of ["phoneAmount", "accessoryBps", "repairBps"]) {
          const value = Number(item.config[key]);
          if (Number.isFinite(value)) projected[key] = value;
        }
      }
      return Object.keys(projected).length ? [projected] : [];
    });
  }
  if (op.id === "student.batch.attendance.summary") {
    const projected = projectApprovedReportRecord(responseData, op);
    return Object.keys(projected).length ? [projected] : [];
  }
  if (["retail.report.summary", "retail.report.daily.summary", "retail.report.compare", "retail.report.cashier-ranking"].includes(op.id) || op.path === "/retail/finance/profit") {
    const projected = projectApprovedReportRecord(responseData, op);
    return Object.keys(projected).length ? [projected] : [];
  }
  if (op.method === "GET" && /^\/retail\/finance\/commission\/partners\/[^/]+\/statement$/.test(op.path)) {
    const projected = projectApprovedReportRecord(responseData, op);
    return Object.keys(projected).length ? [projected] : [];
  }
  if (op.id === "recruitment.report") {
    const projected = projectApprovedReportRecord(responseData, op);
    return Object.keys(projected).length ? [projected] : [];
  }
  if (op.id === "timekeeping.records.overview") {
    const summary = summarizeDailyAttendance(rawRecords(responseData));
    return [{ ...summary, ...(summary.date || typeof input.query_date !== "string" ? {} : { date: input.query_date }) }];
  }
  if (op.id === "partner.payout.history.list") {
    const history = rawRecords(responseData).flatMap((partner: any) => {
      const name = typeof partner?.name === "string" ? partner.name.trim().slice(0, 160) : "";
      if (!name || !Array.isArray(partner.payoutHistory)) return [];
      return partner.payoutHistory.flatMap((payout: any) => {
        if (!payout || typeof payout !== "object") return [];
        const amount = typeof payout.amount === "number" ? payout.amount : NaN;
        const date = payout.date instanceof Date && Number.isFinite(payout.date.valueOf())
          ? payout.date.toISOString()
          : typeof payout.date === "string" && payout.date.length <= 40 ? payout.date : "";
        return date && Number.isFinite(amount) && amount >= 0 ? [{ name, date, amount }] : [];
      });
    }).sort((left: any, right: any) => String(right.date).localeCompare(String(left.date)) || left.name.localeCompare(right.name, "vi"));
    const limit = Number(input.query_limit);
    return Number.isInteger(limit) && limit > 0 ? history.slice(0, Math.min(limit, 1000)) : history;
  }
  // This endpoint is optimized for the retail settings screen and returns
  // several sibling collections. Generic rawRecords() prefers `variants`,
  // which discards the commission configuration and legacy partner rules.
  // Consume the explicit assistant projection instead.
  if (op.method === "GET" && op.path === "/retail/partners/product-commissions") {
    const items = Array.isArray(responseData?.assistantItems) ? responseData.assistantItems : [];
    const quantity = Number(input.query_quantity);
    const summary: AssistantRecord = {
      productCategoryCount: Array.isArray(responseData?.categories) ? responseData.categories.length : 0,
      productCount: Array.isArray(responseData?.products) ? responseData.products.length : 0,
      variantCount: Array.isArray(responseData?.variants) ? responseData.variants.length : 0,
      configuredSkuCount: items.filter((item: any) => item?.status === "configured").length,
    };
    const projectedItems = items.flatMap((item: any) => {
      if (!item || typeof item !== "object") return [];
      const safe: AssistantRecord = {};
      for (const key of op.resultFields) {
        const value = item[key];
        if (["string", "boolean", "number"].includes(typeof value)) safe[key] = value;
        else if (value instanceof Date && !Number.isNaN(value.valueOf())) safe[key] = value.toISOString();
      }
      if (Number.isSafeInteger(quantity) && quantity > 0 && item?.commissionType === "fixed"
        && Number.isSafeInteger(Number(item?.commissionValue)) && Number(item.commissionValue) >= 0) {
        safe.commissionTotal = quantity * Number(item.commissionValue);
      }
      return Object.keys(safe).length ? [safe] : [];
    });
    return op.resultFields.includes("productCategoryCount") && !String(input.query_q || "").trim() ? [summary, ...projectedItems] : projectedItems;
  }
  if (op.id === "employee.count") {
    const candidates = [responseData, responseData?.data, responseData?.result, response?.data?.data, response?.result, response];
    const countRecord = candidates.find(candidate => candidate && typeof candidate === "object"
      && (typeof candidate.count === "number" || (typeof candidate.count === "string" && candidate.count.trim())));
    const rawCount = countRecord?.count ?? countRecord?.total;
    const count = typeof rawCount === "number" || (typeof rawCount === "string" && rawCount.trim()) ? Number(rawCount) : NaN;
    return [{
      ...(Number.isSafeInteger(count) && count >= 0 ? { count } : {}),
      ...(input.createdFrom || countRecord?.createdFrom ? { createdFrom: input.createdFrom || countRecord.createdFrom } : {}),
      ...(input.createdTo || countRecord?.createdTo ? { createdTo: input.createdTo || countRecord.createdTo } : {}),
      ...(typeof countRecord?.branchName === "string" ? { branchName: countRecord.branchName } : {}),
      ...(typeof countRecord?.branchCode === "string" ? { branchCode: countRecord.branchCode } : {}),
      ...(countRecord?.scope === "company" || countRecord?.scope === "branch" ? { scope: countRecord.scope } : {}),
    }];
  }
  if (op.id === "employee.birthday.next-month") {
    const nowParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", month: "2-digit" }).formatToParts(new Date());
    const currentMonth = Number(nowParts.find(part => part.type === "month")?.value || 1);
    const targetMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const birthdays = rawRecords(responseData).flatMap((employee: any) => {
      const birthDate = typeof employee?.birthDate === "string" ? employee.birthDate : "";
      const match = birthDate.match(/^(?:\d{4}[-/])?(\d{1,2})[-/](\d{1,2})/);
      if (!match || Number(match[1]) !== targetMonth || typeof employee.displayName !== "string" || !employee.displayName.trim()) return [];
      return [{ displayName: employee.displayName.trim().slice(0, 160), birthday: `${String(Number(match[2])).padStart(2, "0")}/${String(targetMonth).padStart(2, "0")}` }];
    });
    birthdays.sort((a, b) => a.birthday.localeCompare(b.birthday) || a.displayName.localeCompare(b.displayName, "vi"));
    return [{ birthdays, total: birthdays.length, month: targetMonth } as unknown as AssistantRecord];
  }
  if (["timekeeping.records.monthly.under-threshold", "timekeeping.records.monthly.overview", "timekeeping.records.monthly.most-absent", "timekeeping.records.monthly.most-late", "timekeeping.records.monthly.most-leave", "timekeeping.records.monthly.leave-summary", "timekeeping.records.monthly.unrecorded"].includes(op.id)) {
    const thresholdDays = Number(input.thresholdDays);
    const records = Array.isArray(responseData?.records) ? responseData.records.flatMap((record: any) => typeof record?.employeeName === "string" && record.employeeName.trim() ? [{
      employeeName: record.employeeName.trim().slice(0, 160),
      workedDays: Number(record.workedDays) || 0,
      absentDays: Number(record.absentDays) || 0,
      leaveDays: Number(record.leaveDays) || 0,
      daysOff: Number(record.daysOff) || 0,
      lateDays: Number(record.lateDays) || 0,
      leftEarlyDays: Number(record.leftEarlyDays) || 0,
      ...(Number.isFinite(Number(record.unrecordedDays)) ? { unrecordedDays: Number(record.unrecordedDays) } : {}),
    }] : []) : [];
    return [{ year: Number(responseData?.year), month: Number(responseData?.month), ...(op.id === "timekeeping.records.monthly.under-threshold" ? { thresholdDays } : {}), records } as unknown as AssistantRecord];
  }
  if (op.id === "task.kpi.monthly") {
    const periodKey = typeof responseData?.periodKey === "string" ? responseData.periodKey.slice(0, 7) : String(input.period || "");
    const completionFilter = String(input.completionFilter || "below-100");
    const rows = Array.isArray(responseData?.rows) ? responseData.rows.flatMap((row: any) => {
      if (typeof row?.employeeName !== "string" || !row.employeeName.trim()) return [];
      if (row.percent === null || row.percent === undefined || row.percent === "") return [];
      const percent = Number(row.percent);
      if (!Number.isFinite(percent)) return [];
      if (completionFilter === "exactly-100" ? percent !== 100 : percent >= 100) return [];
      return [{ employeeName: row.employeeName.trim().slice(0, 160), totalTasks: Number(row.totalTasks) || 0,
        completedTasks: Number(row.completedTasks) || 0, pendingTasks: Number(row.pendingTasks) || 0, percent }];
    }) : [];
    return [{ periodKey, periodStatus: typeof responseData?.periodStatus === "string" ? responseData.periodStatus : "", completionFilter, rows } as unknown as AssistantRecord];
  }
  if (op.id === "hr.leave.applications.list" || op.id === "hr.calendar.events.list") {
    const rows = rawRecords(responseData).flatMap((record: any) => {
      if (op.id === "hr.leave.applications.list") {
        const requestedKind = String(input.requestKind || "");
        const recordKind = String(record?.requestKind || record?.type || "");
        const requestedStatus = String(input.status || "");
        if (requestedKind && recordKind !== requestedKind) return [];
        if (requestedStatus && String(record?.status || "") !== requestedStatus) return [];
      }
      const name = String(record?.employeeName || record?.userName || "").trim();
      const title = String(record?.title || "").trim();
      const safe: AssistantRecord = {};
      if (op.id === "hr.leave.applications.list" && !name) return [];
      if (op.id === "hr.calendar.events.list" && !title) return [];
      if (name) safe.employeeName = name.slice(0, 160);
      for (const key of ["type", "requestKind", "reason", "status", "location", "description"]) {
        if (typeof record?.[key] === "string") safe[key] = record[key].slice(0, key === "description" ? 500 : 200);
      }
      for (const key of ["startDate", "endDate"]) {
        const value = record?.[key];
        if (value instanceof Date && Number.isFinite(value.valueOf())) safe[key] = value.toISOString();
        else if (typeof value === "string" && value.length <= 40) safe[key] = value;
      }
      if (typeof record?.chargeableDays === "number" && Number.isFinite(record.chargeableDays)) safe.chargeableDays = record.chargeableDays;
      if (typeof record?.chargeableDays === "string" && Number.isFinite(Number(record.chargeableDays))) safe.chargeableDays = Number(record.chargeableDays);
      if (title) safe.title = title.slice(0, 200);
      if (Array.isArray(record?.participantNames)) safe.participantNames = record.participantNames.filter((value: unknown) => typeof value === "string").slice(0, 30).map((value: string) => value.slice(0, 120));
      if (op.id === "hr.calendar.events.list") {
        const id = String(record?._id || record?.id || "");
        if (/^[a-f\d]{24}$/i.test(id)) safe.id = id;
      }
      if (op.id === "hr.leave.applications.list") Object.defineProperty(safe, "__assistantGroupKey", { value: String(record?.employeeId || record?.uid || name), enumerable: false });
      return [safe];
    });
    if (op.id === "hr.leave.applications.list") {
      const reportKind = String(input.reportKind || "requests");
      if (["leave-most", "wfh-most"].includes(reportKind)) {
        const aggregates = new Map<string, { employeeName: string; days: number; requests: number }>();
        for (const row of rows) {
          const start = typeof row.startDate === "string" ? Date.parse(row.startDate) : NaN;
          const end = typeof row.endDate === "string" ? Date.parse(row.endDate) : NaN;
          const rangeDays = Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.floor((end - start) / 86_400_000) + 1) : 0;
          const days = reportKind === "leave-most" && Number.isFinite(Number(row.chargeableDays)) ? Number(row.chargeableDays) : rangeDays;
          const key = String((row as any).__assistantGroupKey || normalize(String(row.employeeName)));
          const aggregate = aggregates.get(key) || { employeeName: String(row.employeeName), days: 0, requests: 0 };
          aggregate.days += days;
          aggregate.requests += 1;
          aggregates.set(key, aggregate);
        }
        const values = [...aggregates.values()];
        const maximum = values.reduce((max, row) => Math.max(max, row.days), 0);
        const leaders = maximum > 0 ? values.filter(row => row.days === maximum) : [];
        return [{ reportKind, maximumDays: maximum, leaders } as unknown as AssistantRecord];
      }
      return [{ reportKind, requests: rows } as unknown as AssistantRecord];
    }
    return rows;
  }
  if (op.id.startsWith("leave.balances.")) {
    const employeeSearch = typeof input.query_search === "string"
      ? input.query_search.split(/\s*[|;]\s*/).map(value => normalize(value)).filter(Boolean)
      : [];
    const sourceBalances = Array.isArray(responseData?.balances) ? responseData.balances : [];
    const balances = sourceBalances.flatMap((record: any) => typeof record?.employeeName === "string" && record.employeeName.trim()
      && (!employeeSearch.length || employeeSearch.some(search => normalize(record.employeeName).includes(search))) ? [{
      employeeName: record.employeeName.trim().slice(0, 160),
      ...(typeof record.department === "string" ? { department: record.department.slice(0, 100) } : {}),
      entitlement: Number(record.entitlement) || 0,
      used: Number(record.used) || 0,
      pending: Number(record.pending) || 0,
      unexcused: Number(record.unexcused) || 0,
      remaining: Number(record.remaining) || 0,
    }] : []);
    return [{ year: Number(responseData?.year), ...(op.id === "leave.balances.minimum" ? { thresholdDays: Number(input.thresholdDays) } : {}), balances } as unknown as AssistantRecord];
  }
  if (op.id === "hr.training.incomplete.list") {
    const enrollments = rawRecords(responseData);
    const courseName = typeof input.courseName === "string" ? input.courseName.trim().slice(0, 160) : "";
    const incomplete = enrollments.flatMap((enrollment: any) => {
      const status = String(enrollment?.status || "").toLowerCase();
      if (status === "completed" || typeof enrollment?.userName !== "string" || !enrollment.userName.trim()) return [];
      if (courseName && (typeof enrollment?.courseTitle !== "string" || !normalize(enrollment.courseTitle).includes(normalize(courseName)))) return [];
      return [{
        employeeName: enrollment.userName.trim().slice(0, 160),
        ...(typeof enrollment.courseTitle === "string" && enrollment.courseTitle.trim() ? { courseTitle: enrollment.courseTitle.trim().slice(0, 160) } : {}),
        ...(Number.isFinite(Number(enrollment.progress)) ? { progress: Math.max(0, Math.min(100, Number(enrollment.progress))) } : {}),
        status,
      }];
    });
    const fetchedTotal = enrollments.length;
    const totalValue = responseData?.total ?? response?.total;
    const overallTotal = Number.isSafeInteger(Number(totalValue)) && Number(totalValue) >= 0 ? Number(totalValue) : fetchedTotal;
    return [{ incompleteEnrollments: incomplete, incompleteTotal: incomplete.length, fetchedTotal, overallTotal, truncated: overallTotal > fetchedTotal, ...(courseName ? { courseName } : {}) } as unknown as AssistantRecord];
  }
  if (op.id === "hr.contract.list") {
    return rawRecords(responseData).flatMap((contract: any) => {
      const id = String(contract?._id || contract?.id || "");
      if (!/^[a-f\d]{24}$/i.test(id) || typeof contract?.employeeName !== "string" || !contract.employeeName.trim()) return [];
      return [{
        id,
        employeeName: contract.employeeName.trim().slice(0, 160),
        ...(typeof contract.contractType === "string" ? { contractType: contract.contractType.slice(0, 100) } : {}),
        ...(typeof contract.startDate === "string" || contract.startDate instanceof Date ? { startDate: contract.startDate } : {}),
        ...(typeof contract.endDate === "string" || contract.endDate instanceof Date ? { endDate: contract.endDate } : {}),
        ...(typeof contract.status === "string" ? { status: contract.status.slice(0, 30) } : {}),
      }];
    });
  }
  if (op.id === "hr.contract.missing.list") {
    const employees = Array.isArray(responseData?.withoutContractEmployees) ? responseData.withoutContractEmployees : [];
    const names = employees.flatMap((employee: any) => typeof employee?.name === "string" && employee.name.trim()
      ? [{ name: employee.name.trim().slice(0, 160) }]
      : []);
    return [{ withoutContractCount: employees.length, withoutContractEmployees: names }];
  }
  if (["student.batch.progress-colors.list", "student.batch.progress-colors.update"].includes(op.id)) {
    const colors: AssistantRecord = {};
    for (const key of ["green", "yellow", "red", "black"]) if (typeof responseData?.[key] === "string") colors[key] = responseData[key];
    return Object.keys(colors).length ? [colors] : [];
  }
  if (op.id === "student.learning-roadmap.progression.update") {
    return [{ queued: responseData?.queued === true, intent: typeof responseData?.intent === "string" ? responseData.intent : "" }];
  }
  if (op.id === "marketing.lead-intake-profile.list") {
    const versions = new Map<number, AssistantRecord>();
    for (const key of ["profiles", "fallbackProfiles", "activeProfiles"]) {
      const profiles = Array.isArray(responseData?.[key]) ? responseData[key] : [];
      for (const profile of profiles) {
        if (!profile || typeof profile !== "object" || !Number.isSafeInteger(profile.version)) continue;
        const row: AssistantRecord = { version: profile.version };
        for (const field of ["platform", "status", "goal", "updatedAt"] as const) {
          if (typeof profile[field] === "string") row[field] = profile[field];
        }
        if (Array.isArray(profile.fields)) {
          row.fields = profile.fields.flatMap((field: any) => field && typeof field.label === "string" && typeof field.question === "string"
            ? [{ label: field.label, question: field.question, ...(typeof field.type === "string" ? { type: field.type } : {}), ...(typeof field.required === "boolean" ? { required: field.required } : {}) }]
            : []);
        }
        versions.set(profile.version, row);
      }
    }
    return [...versions.values()];
  }
  if (["student.learning-roadmap.promote", "student.learning-roadmap.waitlist.place"].includes(op.id)) {
    const safe: AssistantRecord = {};
    for (const key of op.resultFields) if (["string", "number", "boolean"].includes(typeof responseData?.[key])) safe[key] = responseData[key];
    return [safe];
  }
  if (op.id === "hr.workflow.list") {
    const stepKeys = ["id", "title", "description", "assigneeUid", "assignee", "assigneeUids", "relatedUids", "domain", "priority", "deadlineType", "deadlineDays", "deadlineTime", "subTasks", "type", "estDays", "deliverable", "note", "docLinks", "attachments", "position"];
    return rawRecords(responseData).flatMap((item: any) => {
      const id = String(item?._id || item?.id || "");
      const name = typeof item?.name === "string" ? item.name.trim().slice(0, 120) : "";
      if (!/^[a-f\d]{24}$/i.test(id) || !name || (item.companyCode && item.companyCode !== req.user?.companyCode)) return [];
      const category = typeof item.category === "string" ? item.category.slice(0, 50) : "";
      const description = typeof item.description === "string" ? item.description.slice(0, 2000) : "";
      const rawSteps = Array.isArray(item.steps) ? item.steps : [];
      const steps = rawSteps.slice(0, 100).flatMap((step: any) => {
        if (!step || typeof step !== "object" || Array.isArray(step)) return [];
        const safeStep: Record<string, unknown> = {};
        for (const key of stepKeys) if (step[key] !== undefined) safeStep[key] = step[key];
        return [safeStep];
      });
      const edges = Array.isArray(item.edges) ? item.edges.slice(0, 300).flatMap((edge: any) => {
        if (!edge || typeof edge !== "object" || Array.isArray(edge)) return [];
        const safeEdge: Record<string, unknown> = {};
        for (const key of ["id", "source", "target", "label"]) if (typeof edge[key] === "string") safeEdge[key] = edge[key];
        return [safeEdge];
      }) : [];
      const safe: AssistantRecord = { id, name, stepsCount: rawSteps.length, ...(category ? { category } : {}), ...(description ? { description } : {}) };
      if (category) safe.displayName = `${name} — ${category}`;
      else safe.displayName = name;
      Object.defineProperty(safe, "__assistantExistingRecord", {
        value: { name, category, description, steps, stepCount: rawSteps.length, edges, autoAdvance: item.autoAdvance === true },
        enumerable: false,
      });
      return [safe];
    });
  }
  if (op.id === "finance.management.debts.list") {
    const receivables = Array.isArray(responseData?.receivables) ? responseData.receivables.map((item: any) => ({ item, targetType: "receivable", code: item.receivableCode, name: item.customerName, amount: item.originalAmount, balance: item.balance, dueDate: item.dueDate, status: item.status })) : [];
    const payables = Array.isArray(responseData?.payables) ? responseData.payables.map((item: any) => ({ item, targetType: "payable", code: item.payableCode || item.receiptCode, name: item.supplierName, amount: item.originalAmount, balance: item.balance, dueDate: item.dueDate, status: item.status })) : [];
    const receipts = Array.isArray(responseData?.unregisteredReceipts) ? responseData.unregisteredReceipts.map((item: any) => ({ item, targetType: "unregisteredReceipt", code: item.receiptCode, name: item.supplierName, amount: item.subtotal, balance: item.subtotal, dueDate: item.receivedAt, status: "Chưa ghi công nợ" })) : [];
    return [...receivables, ...payables, ...receipts].map(({ item, ...row }: any) => ({
      id: String(item._id || item.id || ""),
      branchId: String(item.branchId || input.targetBranch || req?.user?.branchId || ''),
      ...row,
    })).filter((item: any) => /^[a-f\d]{24}$/i.test(item.id));
  }
  const sourceData = op.id === "marketing.video-caption.project.list"
    ? responseData?.projects
    : ["marketing.video-caption.project.detail", "marketing.video-caption.project.create", "marketing.video-caption.project.update"].includes(op.id)
      ? responseData?.project
      : responseData;
  if (op.id === "worker.partner.settlement.detail") {
    const choices = Array.isArray(responseData?.__assistantPayoutChoices) ? responseData.__assistantPayoutChoices : [];
    return choices.map((choice: any) => {
      const safe: AssistantRecord = { label: choice.label, amount: choice.amount, paidAt: choice.paidAt, method: choice.method };
      Object.defineProperties(safe, {
        payoutId: { value: choice.payoutId, enumerable: false },
        __assistantReversible: { value: choice.__assistantReversible === true, enumerable: false },
      });
      return safe;
    });
  }
  if (op.id === "marketing.campaign.calendar") {
    return rawRecords(responseData).flatMap((slot: any) => {
      const campaignId = String(slot?.__assistantRef?.campaignId || slot?.__assistantRef?.id || "");
      const slotId = String(slot?.__assistantRef?.slotId || "");
      if (!/^[a-f\d]{24}$/i.test(campaignId) || !/^[a-f\d]{24}$/i.test(slotId)) return [];
      return [{
        id: campaignId,
        campaignId,
        slotId,
        ...(typeof slot.campaignTitle === "string" ? { campaignTitle: slot.campaignTitle } : {}),
        ...(typeof slot.scheduledAt === "string" ? { scheduledAt: slot.scheduledAt } : {}),
        ...(typeof slot.platform === "string" ? { platform: slot.platform } : {}),
        ...(typeof slot.status === "string" ? { status: slot.status } : {}),
        ...(typeof slot.mediaType === "string" ? { mediaType: slot.mediaType } : {}),
        ...(typeof slot.topicBrief === "string" ? { topicBrief: slot.topicBrief } : {}),
      }];
    });
  }
  if (op.id === "finance.receivable.detail") {
    const receivableStatus = String(responseData?.status || "");
    if (["settled", "void", "written_off"].includes(receivableStatus)) return [];
    return (Array.isArray(responseData?.entries) ? responseData.entries : []).map((item: any) => ({
      id: String(item?.__assistantRef?.id || ""),
      entryType: item?.entryType,
      amount: item?.amount,
      reason: item?.reason,
      createdAt: item?.createdAt,
    })).filter((item: any) => /^[a-f\d]{24}$/i.test(String(item.id || "")));
  }
  const treasuryCollectionByOperation: Record<string, string> = {
    "finance.treasury.accounts.list": "accounts",
    "finance.treasury.vouchers.list": "vouchers",
    "finance.treasury.bank-lines.list": "bankLines",
    "finance.treasury.periods.list": "periods",
  };
  const treasuryCollection = treasuryCollectionByOperation[op.id];
  const treasuryItems = treasuryCollection && Array.isArray(responseData?.[treasuryCollection])
    ? responseData[treasuryCollection].filter((item: any) => item && typeof item === "object")
    : rawRecords(sourceData);
  const items = op.id === "finance.treasury.bank-lines.list"
    ? treasuryItems.filter((item: any) => !item.voucherId)
    : treasuryItems;
  const companyWideCategoryOperation = op.id.startsWith("category.") || op.id === "hr.workflow.list";
  const branchHeader = req.headers?.["x-branch-id"] || req.headers?.["X-Branch-Id"];
  const selectedBranchId = isBranchScopedAssistantOperation(op)
    ? String(input.targetBranch || input.branchId || (op.module === "inventory" && typeof branchHeader === "string" ? branchHeader : req.user?.branchId || ""))
    : String(req.user?.branchId || "");
  const partnerBankFilter = op.id === "partner.list" ? String(input.query_bankAccountFilter || "") : "";
  const partnerUnpaidOnly = op.id === "partner.list" && (input.query_unpaidOnly === true || input.query_unpaidOnly === "true");
  return items.filter((item: any) => (!item.companyCode || item.companyCode === req.user?.companyCode)
    && (companyWideCategoryOperation || !selectedBranchId || !item.branchId || String(item.branchId) === selectedBranchId
      || (op.id === "inventory.serial.list" && item.status === "in_transit" && String(item.transferToBranchId || "") === selectedBranchId))
    && (op.id !== "partner.list" || !partnerBankFilter
      || (partnerBankFilter === "has" ? Boolean(String(item.bankAccountNo || "").trim()) : !String(item.bankAccountNo || "").trim()))
    && (!partnerUnpaidOnly || Number(item.unpaidBalance) > 0)).map((item: any) => {
    const safe: AssistantRecord = {};
    const id = String(item._id || item.id || item.uid || item.__assistantRef?.id || ((op.id === "payroll.employee.me.reconciliation" || op.id === "payroll.employee.me.payslips") ? item.__assistantRef?.runId || item.runId : "") || "");
    if (op.module === "architect-assistant" && Number.isSafeInteger(item.revision) && item.revision > 0) Object.defineProperty(safe, "revision", { value: item.revision, enumerable: false });
    if (/^[a-f\d]{24}$/i.test(id) || (op.module === "architect-assistant" && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)) || (op.id === "resource.google-drive.list" && /^[A-Za-z0-9_-]{10,200}$/.test(id))) safe.id = id;
    // Contracts may refer to Mongo's _id while projection exposes id for lookup.
    // Preserve the alias privately so selecting the displayed option can resolve it.
    if (safe.id) Object.defineProperty(safe, "_id", { value: safe.id, enumerable: false });
    if (op.module === "finance" && Number.isSafeInteger(item.version) && item.version >= 0) {
      Object.defineProperty(safe, "version", { value: item.version, enumerable: false });
    }
    if (op.id === "chat.room.members.list" && ["admin", "deputy", "member"].includes(String(item.role))) {
      Object.defineProperty(safe, "role", { value: item.role, enumerable: false });
    }
    if (op.id === "worker.standard-fields.list" && typeof item.__assistantRef?.key === "string") safe.key = item.__assistantRef.key;
    if (op.id === "omni-inbox.account.list" && typeof item.username === "string" && item.username.trim()) {
      Object.defineProperty(safe, "pageId", { value: item.username.trim(), enumerable: false });
    }
    if (op.id === "retail.invoice.list") {
      if (typeof item.invoiceNo === "string") safe.code = item.invoiceNo;
      if (typeof item.invoiceNo === "string") safe.invoiceNo = item.invoiceNo;
      if (typeof item.orderCode === "string") safe.orderCode = item.orderCode;
      if (typeof item.snapshot?.customerName === "string") safe.customerName = item.snapshot.customerName;
      if (typeof item.status === "string") safe.status = item.status;
      if (typeof item.issuedAt === "string") safe.issuedAt = item.issuedAt;
      else if (item.issuedAt instanceof Date && !Number.isNaN(item.issuedAt.valueOf())) safe.issuedAt = item.issuedAt.toISOString();
      for (const key of ["grandTotal", "paymentStatus", "paidAmount", "dueAmount"]) {
        if (item.snapshot?.[key] !== undefined && ["string", "boolean", "number"].includes(typeof item.snapshot[key])) safe[key] = item.snapshot[key];
      }
    }
    if (["batch.attendance.learners", "student.list"].includes(op.id) && typeof item.phone === "string" && item.phone.trim()) {
      Object.defineProperty(safe, "__assistantReferencePhone", { value: item.phone.trim(), enumerable: false });
    }
    if (op.id === "inventory.stock-log.list") {
      const lines = Array.isArray(item.items) ? item.items : [];
      if (!safe.productName) {
        const names = [...new Set(lines.map((line: any) => String(line?.productName || "").trim()).filter(Boolean))].slice(0, 5);
        if (names.length) safe.productName = names.join(", ");
      }
      if (!safe.sku) {
        const skus = [...new Set(lines.map((line: any) => String(line?.sku || "").trim()).filter(Boolean))].slice(0, 5);
        if (skus.length) safe.sku = skus.join(", ");
      }
      if (safe.quantity === undefined && lines.length) safe.quantity = lines.reduce((sum: number, line: any) => sum + (Number(line?.quantity) || 0), 0);
      safe.__assistantReversible = item.type === "xuất" && ["Hoàn thành", "Thành công"].includes(String(item.status || ""))
        && ["nội bộ", "hủy"].includes(String(item.purpose || ""))
        && !item.refType && !item.refId && !item.reversalOf && !item.reversalId;
    }
    if (op.id === "worker.partner.settlements.list" && item.partnerId && typeof item.partnerId === "object") {
      if (typeof item.partnerId.name === "string") safe.partnerName = item.partnerId.name;
      if (typeof item.partnerId.code === "string") safe.partnerCode = item.partnerId.code;
    }
    if (op.id === "worker.partner.worker-referral.list" && item.partnerId && typeof item.partnerId === "object") {
      if (typeof item.partnerId.name === "string") safe.partnerName = item.partnerId.name;
      if (typeof item.partnerId.code === "string") safe.partnerCode = item.partnerId.code;
    }
    if (op.id === "retail.payment-review.pending" && typeof item.paymentCode === "string" && item.paymentCode) safe.code = item.paymentCode;
    else if (op.id === "retail.payment-review.pending" && typeof item.orderCode === "string" && item.orderCode) safe.code = item.orderCode;
    else if (op.id === "retail.payment-review.pending" && typeof item.referenceCode === "string" && item.referenceCode) safe.code = item.referenceCode;
    if (op.id === "student.list" && Array.isArray(item.status)) {
      const statuses = item.status.filter((value: unknown): value is string => typeof value === "string" && Boolean(value.trim()));
      if (statuses.length) safe.status = statuses.join(", ");
    }
    for (const field of op.resultFields) {
      if (op.id === "partner.list" && field === "hasBankAccount") {
        safe.hasBankAccount = typeof item.bankAccountNo === "string" && Boolean(item.bankAccountNo.trim());
        continue;
      }
      const value = item[field];
      const childSchema = op.resultChildFields?.[field];
      if (childSchema) {
        const projected = projectApprovedReportValue(value, childSchema);
        if (projected !== undefined) safe[field] = projected as AssistantValue;
      } else if (["string", "boolean", "number"].includes(typeof value)) safe[field] = value;
      else if (value instanceof Date && !Number.isNaN(value.valueOf())) safe[field] = value.toISOString();
    }
    if (op.id === "inventory.count.list" && Number.isSafeInteger(item.version) && item.version >= 0) {
      Object.defineProperty(safe, "__assistantRefVersion", { value: item.version, enumerable: false });
    }
    if (op.id === "student.assignment.submissions.list" && typeof item.studentId === "string") {
      Object.defineProperty(safe, "studentId", { value: item.studentId, enumerable: false });
    }
    if (op.id === "student.batch.enrollments.list" && typeof item.studentId === "string") {
      Object.defineProperty(safe, "studentId", { value: item.studentId, enumerable: false });
    }
    if (op.id.startsWith("student.notification.") && Array.isArray(item.channels)) {
      const channels = item.channels.filter((value: unknown): value is string => typeof value === "string" && Boolean(value.trim())).slice(0, 3);
      if (channels.length) safe.channelSummary = channels.join(", ");
    }
    if (op.id === "student.resource.booking.create" && Array.isArray(item.bookings)) {
      const booking = item.bookings.at(-1);
      if (booking && typeof booking === "object") {
        if (typeof booking.purpose === "string") safe.bookingPurpose = booking.purpose;
        if (typeof booking.by === "string") safe.bookingBy = booking.by;
        if (typeof booking.date === "string") safe.bookingDate = booking.date;
        if (typeof booking.startTime === "string") safe.bookingStartTime = booking.startTime;
        if (typeof booking.endTime === "string") safe.bookingEndTime = booking.endTime;
      }
    }
    if (op.id === "student.learning-roadmap.steps.list") {
      Object.defineProperties(safe, {
        stepId: { value: typeof item.stepId === "string" ? item.stepId : undefined, enumerable: false },
        courseId: { value: typeof item.courseId === "string" ? item.courseId : undefined, enumerable: false },
      });
    }
    // Batch instructor eligibility depends on account status; keep it private for reference filtering.
    if (op.id === "employee.list" && typeof item.isActive === "boolean") {
      Object.defineProperty(safe, "__assistantActive", { value: item.isActive, enumerable: false });
    }
    if (["student.list", "student.exam.grade-roster.list", "student.exam.assigned-students.list"].includes(op.id) && typeof item.phone === "string" && item.phone.trim()) {
      Object.defineProperty(safe, "__assistantReferencePhone", { value: item.phone.trim(), enumerable: false });
    }
    if (op.id === "marketing.bulk-create.templates.list" && item.__assistantRef?.bulkTemplate === true) {
      Object.defineProperty(safe, "__assistantRef", { value: { bulkTemplate: true, owned: item.__assistantRef.owned === true }, enumerable: false });
    }
    if (op.id === "marketing.bulk-create.templates.community.list" && item.__assistantRef?.communityTemplate === true) {
      Object.defineProperty(safe, "__assistantRef", { value: { communityTemplate: true }, enumerable: false });
    }
    if (op.id === "marketing.video-caption.project.list") {
      const links = item.contextLinks && typeof item.contextLinks === "object" && !Array.isArray(item.contextLinks)
        ? { ...item.contextLinks }
        : {};
      Object.defineProperty(safe, "__assistantExistingRecord", { value: { contextLinks: links }, enumerable: false });
    }
    if (op.id === "company-knowledge.documents.list") for (const key of ["channelScope", "purposeScope"]) {
      if (Array.isArray(item[key]) && item[key].every((value: unknown) => typeof value === "string")) safe[key] = item[key] as any;
    }
    if (op.id === "payroll.employee.me.reconciliation") {
      if (Number.isSafeInteger(item.__assistantRef?.version)) safe.version = item.__assistantRef.version as any;
      if (Array.isArray(item.__assistantRef?.issues)) (safe as any).__assistantIssues = item.__assistantRef.issues;
    }
    if (op.id === "payroll.run.list" && Number.isSafeInteger(item.__assistantRef?.version) && item.__assistantRef.version >= 0) safe.version = item.__assistantRef.version as any;
    if (op.id === "marketing.campaign.sheet.revisions.list") {
      const revisionActions: Record<string, string> = {
        add_column: "Thêm cột",
        apply_ai_proposal: "Áp dụng gợi ý AI",
        update_column: "Sửa cột",
        update_row: "Sửa dòng",
      };
      const rawRevisionAction = String(item.operation || "");
      Object.defineProperties(safe, {
        __assistantRevertible: {
          value: Array.isArray(item.changes) && item.changes.length > 0 && !rawRevisionAction.startsWith("revert:"),
          enumerable: false,
        },
        __assistantRevisionAction: {
          value: rawRevisionAction.startsWith("revert:") ? "Hoàn tác" : revisionActions[rawRevisionAction] || "Cập nhật Content Sheet",
          enumerable: false,
        },
        __assistantChangeCount: {
          value: Array.isArray(item.changes) ? item.changes.length : 0,
          enumerable: false,
        },
      });
    }
    if (op.id === "payroll.run.payslip.review-requests.list" && /^[a-f\d]{24}$/i.test(String(safe.id || ""))) {
      Object.defineProperty(safe, "__assistantRef", { value: { id: safe.id, reviewRequest: true }, enumerable: false });
    }
    if (op.id === "student.quality.mini-tests.list" && /^[a-f\d]{24}$/i.test(String(safe.id || ""))) {
      Object.defineProperty(safe, "__assistantRef", { value: { studentMiniTest: true }, enumerable: false });
    }
    if (op.id === "marketing.elevenlabs.voices.list" && typeof item.__assistantRef?.id === "string") safe.voiceId = item.__assistantRef.id;
    if (op.id === "marketing.elevenlabs.models.list" && typeof item.__assistantRef?.id === "string") safe.modelId = item.__assistantRef.id;
    if (op.id === "timekeeping.work-calendar.list" && typeof item.__assistantRef?.source === "string") safe.calendarSource = item.__assistantRef.source;
    if (op.id === "inventory.count.detail") {
      for (const key of ["sku", "productName", "barcode", "trackingMode", "systemQuantity", "countedQuantity", "quantityDelta", "note"]) {
        if (["string", "number"].includes(typeof item[key])) safe[key] = item[key] as any;
      }
    }
    if (op.id === "recruitment.pipeline.get" && typeof item.id === "string") safe.id = item.id;
    if (op.id === "retail.partner.list" && Array.isArray(item.roles) && typeof item.roles[0] === "string") safe.role = item.roles[0];
    if (op.id === "retail.order.list" && item.status === "draft" && Number.isInteger(item.heldSlot) && item.heldSlot > 0) {
      Object.defineProperty(safe, "__assistantHeldSlot", { value: item.heldSlot, enumerable: false });
      // Held slots are unique per creator, not per branch. Use the public
      // creator name to distinguish cashiers without exposing their IDs.
      if (typeof item.createdByName === "string" && item.createdByName.trim()) {
        Object.defineProperty(safe, "__assistantDraftCreatorName", { value: item.createdByName.trim(), enumerable: false });
      }
    }
    // Keep branch scope internally so name resolution can disambiguate records;
    // response redaction and list rendering remove this internal field.
    if (!companyWideCategoryOperation && typeof item.branchId === "string") safe.branchId = item.branchId;
    // Transfers belong to both endpoint branches, unlike single-branch records.
    // Preserve the selected, verified endpoint for the shared parent filter.
    if (op.path === "/inventory/transfers") {
      const branch = String(input.targetBranch || req.user?.branchId || "");
      if (branch && [String(item.fromBranchId || ""), String(item.toBranchId || "")].includes(branch)) safe.branchId = branch;
    }
    if (op.id === "inventory.serial.list" && typeof item.transferToBranchId === "string") safe.transferToBranchId = item.transferToBranchId;
    if (Number.isSafeInteger(item.__v) && item.__v >= 0) {
      Object.defineProperty(safe, "__assistantRefVersion", { value: item.__v, enumerable: false });
    }
    return safe;
  });
}
const referenceLabelKeys = ["displayName", "fullName", "studentName", "variantName", "sessionCode", "countCode", "name", "label", "legalName", "taxId", "title", "question", "purpose", "by", "startTime", "endTime", "roadmapName", "sourceBatchCode", "templateName", "assetName", "assetCode", "barcode", "internalBarcode", "serialNumber", "courseTitle", "location", "instructorName", "customerName", "recipientName", "recipientEmail", "senderName", "productName", "warehouseName", "branchName", "partnerName", "workerName", "employeeName", "cashierName", "partyName", "invoiceNo", "description", "bankKey", "reference", "referenceCode", "paymentCode", "code", "receivableCode", "sourceCode", "customerCode", "sku", "email", "phone", "ticketCode", "shiftCode", "orderCode", "sourceId", "periodKey", "baseRevision", "key", "channel", "date", "businessDate", "createdAt", "paymentDate", "lastMessageAt", "campaignTitle", "scheduledAt", "platform", "topicBrief"];
function referenceValues(record: Record<string, any>) {
  return [record.id, record._id, record.uid, record.studentId, record.installmentNo, record.tentativeDate, record.officialDate, record.rank, ...referenceLabelKeys.map(key => record[key]), record.kind, record.amount, record.amountDue, record.reason].filter((value): value is string | number => typeof value === "string" || typeof value === "number").map(String);
}
function referenceLabel(record: Record<string, any>) {
  if (record.status === "draft" && !record.orderCode && typeof record.grandTotal === "number") {
    return `Đơn nháp · ${new Intl.NumberFormat("vi-VN").format(record.grandTotal)} ₫${record.customerName ? ` · ${record.customerName}` : ""}`;
  }
  if ((record.config || record.partnerId !== undefined || (record.scope && typeof record.partnerName === "string"))
    && record.effectiveAt && typeof record.effectiveAt === "string") {
    return `${record.partnerName || (record.partnerId ? "Chính sách đối tác" : "Chính sách chung")} — áp dụng ${formatAssistantTemporalValue(record.effectiveAt) || record.effectiveAt}`;
  }
  if (typeof record.employeeName === "string" && typeof record.date === "string" && typeof record.status === "string"
    && (record.checkInTime !== undefined || record.checkOutTime !== undefined)) {
    const time = (value: unknown) => typeof value === "string" ? formatAssistantTemporalValue(value) || value : "";
    return [record.employeeName, formatAssistantTemporalValue(record.date) || record.date,
      record.checkInTime ? `vào ${time(record.checkInTime)}` : "chưa có giờ vào",
      record.checkOutTime ? `ra ${time(record.checkOutTime)}` : "chưa có giờ ra",
    ].filter(Boolean).join(" · ");
  }
  if (Number.isSafeInteger(record.installmentNo) && Number.isFinite(Number(record.amountDue))) {
    const amount = `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(record.amountDue))} ₫`;
    return [`Đợt ${record.installmentNo}`, amount, record.status, record.dueDate ? `hạn ${formatAssistantTemporalValue(String(record.dueDate)) || record.dueDate}` : ""]
      .filter(value => typeof value === "string" && value.trim()).join(" · ");
  }
  if (typeof record.studentName === "string" && Number.isFinite(Number(record.amount)) && typeof record.date === "string") {
    const amount = `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(record.amount))} ₫`;
    const date = formatAssistantTemporalValue(record.date) || record.date;
    return [record.studentName, amount, record.method, `ngày ${date}`].filter(value => typeof value === "string" && value.trim()).join(" — ");
  }
  if (typeof record.sku === "string" && record.sku.trim() && record.productId) {
    const variantName = [record.displayName, record.variantName, record.productName].find(value => typeof value === "string" && value.trim());
    return [variantName || "SKU", `mã ${record.sku.trim()}`].join(" — ");
  }
  if (typeof record.name === "string" && typeof record.customerCode === "string") {
    return [record.name, record.customerCode, record.phone, record.branchName ? `Chi nhánh ${record.branchName}` : ""]
      .filter((value): value is string => typeof value === "string" && Boolean(value.trim())).join(" — ");
  }
  if (typeof record.question === "string" && typeof record.suggestedAnswer === "string") {
    const question = record.question.replace(/\s+/g, " ").trim();
    const category = typeof record.category === "string" ? record.category.trim() : "";
    const status = ({ pending: "đang chờ duyệt", approved: "đã duyệt", rejected: "đã bỏ qua" } as Record<string, string>)[String(record.status)] || "";
    return [`FAQ: ${question.slice(0, 160)}${question.length > 160 ? "…" : ""}`, category, status].filter(Boolean).join(" · ");
  }
  if (Number.isSafeInteger(record.baseRevision) && ["user", "ai"].includes(String(record.actorType)) && typeof record.createdAt === "string") {
    const revisionActions: Record<string, string> = {
      add_column: "Thêm cột",
      apply_ai_proposal: "Áp dụng gợi ý AI",
      update_column: "Sửa cột",
      update_row: "Sửa dòng",
    };
    const createdAt = new Date(record.createdAt);
    const timestamp = Number.isNaN(createdAt.valueOf())
      ? record.createdAt
      : `${new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" }).format(createdAt)}.${String(createdAt.getMilliseconds()).padStart(3, "0")}`;
    const actor = record.actorType === "ai" ? "AI" : "người dùng";
    const changeCount = Number.isSafeInteger(record.__assistantChangeCount)
      ? record.__assistantChangeCount
      : Array.isArray(record.changes) ? record.changes.length : undefined;
    const changes = Number.isSafeInteger(changeCount) ? ` · ${changeCount} ô thay đổi` : "";
    const action = record.__assistantRevisionAction || revisionActions[String(record.operation)] || "Cập nhật";
    return [`Content Sheet · phiên nền ${record.baseRevision}`, action, actor, timestamp].join(" · ") + changes;
  }
  if (typeof record.role === "string" && Number.isSafeInteger(record.level)) {
    const roleNames: Record<string, string> = { admin: "Quản trị viên", branch_owner: "Chủ chi nhánh", manager: "Quản lý", user: "Nhân viên", teacher: "Giáo viên", pos_cashier: "Thu ngân" };
    return [record.displayName || roleNames[record.role] || record.role, record.role, `cấp ${record.level}`].join(" · ");
  }
  if (typeof record.customerName === "string" && typeof record.receivableCode === "string" && typeof record.notificationTitle === "string") {
    return [record.customerName, record.receivableCode, record.sourceCode, `lượt ${Number(record.attempt) || 0}/${Number(record.maxAttempts) || 0}`]
      .filter(Boolean).join(" — ");
  }
  if (typeof record.recipientName === "string" && typeof record.recipientEmail === "string" && typeof record.orderCode === "string") {
    return [record.recipientName, record.recipientEmail, record.orderCode, `lượt ${Number(record.attempt) || 0}/${Number(record.maxAttempts) || 0}`].join(" — ");
  }
  if (record.__assistantRef?.studentMiniTest === true && typeof record.title === "string") {
    const date = typeof record.date === "string" ? record.date.slice(0, 10) : "";
    const score = typeof record.score === "number" && typeof record.maxScore === "number"
      ? `${record.score}/${record.maxScore} điểm`
      : "chưa có điểm";
    return [record.title, date, score].filter(Boolean).join(" · ");
  }
  if (["receivable", "payable", "unregisteredReceipt"].includes(String(record.targetType)) && typeof record.code === "string" && typeof record.name === "string") {
    const type = record.targetType === "receivable" ? "Phải thu" : record.targetType === "payable" ? "Phải trả" : "Phiếu nhập chưa ghi công nợ";
    const amountValue = Number(record.balance ?? record.amount);
    const amount = Number.isFinite(amountValue) ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amountValue) + " ₫" : "";
    return [type, record.code, record.name, amount].filter(Boolean).join(" — ");
  }
  if (typeof record.senderName === "string" && typeof record.content === "string" && typeof record.createdAt === "string") {
    const timestamp = new Date(record.createdAt);
    const time = Number.isNaN(timestamp.valueOf()) ? "" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(timestamp);
    const excerpt = record.content.replace(/\s+/g, " ").trim().slice(0, 100);
    return [`${record.senderName}: ${excerpt}${record.content.trim().length > 100 ? "…" : ""}`, time].filter(Boolean).join(" — ");
  }
  if (typeof record.studentName === "string" && typeof record.roadmapName === "string") {
    return [record.studentName, `lộ trình ${record.roadmapName}`, record.sourceBatchCode ? `từ lớp ${record.sourceBatchCode}` : ""].filter(Boolean).join(" — ");
  }
  if (typeof record.studentName === "string" && record.studentName.trim()) {
    return [record.studentName.trim(), typeof record.studentPhone === "string" ? record.studentPhone.trim() : ""]
      .filter(Boolean).join(" — ");
  }
  if (typeof record.workerName === "string" && typeof record.effectiveFrom === "string") {
    return [record.workerName, `hiệu lực ${record.effectiveFrom}${record.effectiveTo ? ` đến ${record.effectiveTo}` : ""}`, record.status].filter(Boolean).join(" — ");
  }
  if (typeof record.tentativeDate === "string" && ["Sắp diễn ra", "Đã xác nhận", "Đã hoàn thành", "Đã hủy"].includes(String(record.status))) {
    return [record.name, record.rank, record.tentativeDate, record.status].filter(value => typeof value === "string" && value.trim()).join(" · ");
  }
  if (record.__assistantRef?.bulkTemplate === true && typeof record.name === "string") {
    const updatedAt = typeof record.updatedAt === "string" ? new Date(record.updatedAt) : null;
    const updatedLabel = updatedAt && !Number.isNaN(updatedAt.valueOf())
      ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(updatedAt)
      : "";
    return [record.name, `phiên bản ${Number(record.version) || 1}`, record.visibility === "public" ? "đang chia sẻ" : "riêng tư", updatedLabel].filter(Boolean).join(" · ");
  }
  if (typeof record.__assistantReferencePhone === "string" && (typeof record.name === "string" || typeof record.fullName === "string")) {
    return `${record.name || record.fullName} — ${record.__assistantReferencePhone}`;
  }
  if (typeof record.name === "string" && typeof record.mimeType === "string" && typeof record.createdAt === "string") {
    const createdAt = new Date(record.createdAt);
    const date = Number.isNaN(createdAt.valueOf()) ? "" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(createdAt);
    const type = record.mimeType === "application/vnd.google-apps.folder" ? "thư mục" : "tệp";
    return [record.name, type, date].filter(Boolean).join(" · ");
  }
  if (["draft", "confirmed", "cancelled", "reversed"].includes(String(record.status)) && Number.isFinite(Number(record.amount)) && Number(record.amount) > 0 && (record.paymentDate || record.createdAt)) {
    const status = ({ draft: "nháp", confirmed: "đã xác nhận", cancelled: "đã hủy", reversed: "đã đảo" } as Record<string, string>)[String(record.status)];
    const dateValue = typeof record.paymentDate === "string" ? record.paymentDate : record.createdAt;
    const date = typeof dateValue === "string" ? new Date(dateValue) : null;
    const dateLabel = date && !Number.isNaN(date.valueOf())
      ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(date)
      : "";
    const amount = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(record.amount));
    return [`Đợt lương ${amount} ₫`, status, dateLabel].filter(Boolean).join(" · ");
  }
  if (["cell", "row", "column", "selection", "fill_all"].includes(String(record.operation)) && typeof record.status === "string" && Number.isFinite(Number(record.progress))) {
    const operation = ({ cell: "Ô dữ liệu", row: "Dòng", column: "Cột", selection: "Vùng dữ liệu", fill_all: "Điền hàng loạt Order" } as Record<string, string>)[String(record.operation)];
    const status = ({ queued: "Đang chờ", processing: "Đang xử lý", awaiting_review: "Chờ duyệt", applying: "Đang áp dụng", completed: "Hoàn tất", partial: "Một phần", failed: "Thất bại", cancelled: "Đã hủy" } as Record<string, string>)[record.status] || record.status;
    const createdAt = typeof record.createdAt === "string" ? new Date(record.createdAt) : null;
    const createdLabel = createdAt && !Number.isNaN(createdAt.valueOf())
      ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(createdAt)
      : "";
    const workflow = record.operation === "fill_all" ? "AI điền Order" : "AI Content Sheet";
    return [`${workflow} · ${operation}`, status, `${Number(record.progress)}%`, createdLabel].filter(Boolean).join(" · ");
  }
  if (typeof record.templateName === "string" && Number.isFinite(Number(record.totalItems)) && typeof record.status === "string") {
    const status = ({ queued: "Đang chờ", processing: "Đang xử lý", completed: "Hoàn tất", partial: "Một phần", failed: "Thất bại", cancelled: "Đã hủy" } as Record<string, string>)[record.status] || record.status;
    const createdAt = typeof record.createdAt === "string" ? new Date(record.createdAt) : null;
    const createdLabel = createdAt && !Number.isNaN(createdAt.valueOf())
      ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" }).format(createdAt)
      : "";
    const progress = `${Number(record.completedItems) || 0}/${Number(record.totalItems) || 0} ảnh`;
    const failed = Number(record.failedItems) > 0 ? `${Number(record.failedItems)} ảnh lỗi` : "không có ảnh lỗi";
    return [record.templateName, status, progress, failed, createdLabel].filter(Boolean).join(" · ");
  }
  if (typeof record.title === "string" && typeof record.contentGroup === "string" && Number.isSafeInteger(record.revision)) {
    const status = ({ draft: "Bản nháp", needs_assets: "Thiếu tài sản", ready: "Sẵn sàng", bulk_queued: "Đang xử lý", completed: "Đã hoàn tất", cancelled: "Đã hủy" } as Record<string, string>)[String(record.status)] || String(record.status || "");
    return [record.title, record.contentGroup, status, `lần sửa ${record.revision}`].filter(Boolean).join(" · ");
  }
  if (typeof record.businessDate === "string" && ["running", "completed", "failed"].includes(String(record.status))) {
    const status = ({ running: "đang chạy", completed: "đã hoàn tất", failed: "lỗi" } as Record<string, string>)[record.status];
    return [record.businessDate, status, String(Number(record.overdueOrders) || 0) + " đơn quá hạn"].join(" · ");
  }
  if (typeof record.campaignTitle === "string" && typeof record.scheduledAt === "string" && typeof record.platform === "string") {
    const timestamp = new Date(record.scheduledAt);
    const time = Number.isNaN(timestamp.valueOf()) ? record.scheduledAt : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(timestamp);
    const topic = typeof record.topicBrief === "string" ? record.topicBrief.trim().slice(0, 120) : "";
    return [record.campaignTitle, time, record.platform, topic].filter(Boolean).join(" · ");
  }
  if (typeof record.title === "string" && ["kho", "task", "training", "he-thong"].includes(String(record.type)) && typeof record.createdAt === "string") {
    const timestamp = new Date(record.createdAt);
    const time = Number.isNaN(timestamp.valueOf()) ? record.createdAt : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(timestamp);
    const type = ({ kho: "Kho", task: "Công việc", training: "Đào tạo", "he-thong": "Hệ thống" } as Record<string, string>)[record.type];
    return [record.title, type, time, record.read === true ? "đã đọc" : "chưa đọc"].join(" · ");
  }
  if (typeof record.goal === "string" && Number.isSafeInteger(record.version) && typeof record.status === "string") {
    const status = ({ draft: "Bản nháp", active: "Đang hoạt động", archived: "Đã lưu" } as Record<string, string>)[record.status] || record.status;
    return `${record.goal} — phiên bản ${record.version} — ${status}`;
  }
  if (record.__assistantRef?.reviewRequest === true && typeof record.employeeName === "string") {
    const status = record.status === "open" ? "đang chờ xử lý" : record.status === "resolved" ? "đã xử lý" : "";
    const createdAt = typeof record.createdAt === "string" ? new Date(record.createdAt) : null;
    const createdLabel = createdAt && !Number.isNaN(createdAt.valueOf())
      ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(createdAt)
      : "";
    return [record.employeeName, record.periodKey ? `kỳ ${record.periodKey}` : "", status, createdLabel].filter(Boolean).join(" · ");
  }
  if (typeof record.periodKey === "string" && ["regular", "supplemental"].includes(String(record.type)) && ["draft", "review", "closed", "paid"].includes(String(record.status))) {
    const runType: Record<string, string> = { regular: "Định kỳ", supplemental: "Bổ sung" };
    const runStatus: Record<string, string> = { draft: "Bản nháp", review: "Chờ duyệt", closed: "Đã chốt", paid: "Đã thanh toán" };
    const createdAt = typeof record.createdAt === "string" ? new Date(record.createdAt) : null;
    const createdLabel = createdAt && !Number.isNaN(createdAt.valueOf())
      ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(createdAt)
      : "";
    return [`Kỳ ${record.periodKey}`, runType[String(record.type)], runStatus[String(record.status)], createdLabel ? `tạo ${createdLabel}` : ""].filter(Boolean).join(" · ");
  }
  if (typeof record.calendarSource === "string" && typeof record.date === "string" && typeof record.name === "string") {
    return [record.date, record.name].join(" · ");
  }
  if (typeof record.voiceId === "string" && typeof record.name === "string") {
    return [record.name, record.category].filter(value => typeof value === "string" && value.trim()).join(" · ");
  }
  if (typeof record.modelId === "string" && typeof record.name === "string") {
    return [record.name, record.description].filter(value => typeof value === "string" && value.trim()).join(" · ");
  }
  if (["image", "voice"].includes(String(record.mediaType || ""))) {
    const date = typeof record.createdAt === "string" ? new Date(record.createdAt) : null;
    const time = date && !Number.isNaN(date.valueOf()) ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(date) : "";
    const type = record.mediaType === "voice" ? "Giọng đọc" : "Ảnh";
    return [type, record.title || record.voiceName || "Tệp đã tạo", time].filter(Boolean).join(" · ");
  }
  if (typeof record.senderName === "string") {
    const date = typeof record.lastMessageAt === "string" ? new Date(record.lastMessageAt) : null;
    const time = date && !Number.isNaN(date.valueOf()) ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(date) : "";
    return [record.channel || "Hội thoại", record.senderName, time, record.status === "closed" ? "đã đóng" : record.status === "open" ? "đang mở" : ""].filter(Boolean).join(" · ");
  }
  const replyChannels: Record<string, string> = { facebook: "Facebook", facebook_comment: "bình luận Facebook", zalo: "Zalo", tiktok: "TikTok", test: "bản kiểm thử" };
  if (replyChannels[String(record.channel)] && typeof record.createdAt === "string") {
    const createdAt = new Date(record.createdAt);
    const time = Number.isNaN(createdAt.valueOf()) ? record.createdAt : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(createdAt);
    const feedback: Record<string, string> = { good: "đạt", bad: "không đạt", needs_fix: "cần sửa" };
    const status: Record<string, string> = { sent: "đã gửi", failed: "gửi lỗi", preview: "bản xem trước" };
    return ["Phản hồi AI", replyChannels[String(record.channel)], time, feedback[String(record.feedback)] || "chưa đánh giá", status[String(record.status)]].filter(Boolean).join(" · ");
  }
  if (["payment", "adjustment"].includes(String(record.entryType || "")) && typeof record.amount === "number") {
    const label = record.entryType === "payment" ? "Khoản thu" : record.amount < 0 ? "Điều chỉnh giảm" : "Điều chỉnh tăng";
    const amount = `${new Intl.NumberFormat("vi-VN").format(Math.abs(record.amount))} ₫`;
    const date = typeof record.createdAt === "string" ? record.createdAt.slice(0, 10) : "";
    return [label, amount, date, record.reason].filter(value => typeof value === "string" && value.trim()).join(" · ");
  }
  if (["Facebook", "Zalo", "TikTok"].includes(String(record.platform || "")) && typeof record.displayName === "string") {
    return [record.displayName, record.platform].filter(Boolean).join(" · ");
  }
  if (typeof record.paymentCode === "string" || typeof record.referenceCode === "string") {
    return [record.orderCode, record.paymentCode || record.referenceCode].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" · ") || "Giao dịch chờ rà soát";
  }
  if (typeof record.partnerName === "string" && typeof record.periodStart === "string") {
    return [record.partnerName, `${record.periodStart} – ${record.periodEnd || record.periodStart}`, record.status].filter(Boolean).join(" · ");
  }
  if (typeof record.workerName === "string" && typeof record.effectiveFrom === "string") {
    return [record.workerName, `${record.effectiveFrom} – ${record.effectiveTo || "đang hiệu lực"}`, record.status].filter(Boolean).join(" · ");
  }
  const payrollAdjustmentKinds: Record<string, string> = { allowance: "Ph\u1EE5 c\u1EA5p", bonus: "Th\u01B0\u1EDFng", deduction: "Kh\u1EA5u tr\u1EEB", correction: "\u0110i\u1EC1u ch\u1EC9nh", advance: "T\u1EA1m \u1EE9ng" };
  if (typeof record.employeeName === "string" && typeof record.amount === "number" && payrollAdjustmentKinds[record.kind]) {
    const amount = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(record.amount);
    return [record.employeeName, payrollAdjustmentKinds[record.kind], `${amount} \u20AB`, record.reason].filter(value => typeof value === "string" && value.trim()).join(" \u00B7 ");
  }
  const primary = ["displayName", "fullName", "variantName", "serialNumber", "internalBarcode", "name", "label", "legalName", "title", "assetName", "courseTitle", "periodKey", "location", "instructorName", "customerName", "productName", "warehouseName", "branchName", "workerName", "employeeName", "cashierName", "partyName", "invoiceNo", "description", "sessionCode", "countCode", "orderCode", "code", "assetCode", "barcode", "customerCode", "ticketCode", "shiftCode", "bankKey", "sku", "email", "key"].map(key => record[key]).find(value => typeof value === "string" && value.trim());
  const parts = [primary ? String(primary) : "Bản ghi"];
  const businessCode = record.sessionCode || record.invoiceNo || record.code || record.assetCode || record.barcode || record.reference || record.receivableCode || record.sourceCode || record.ticketCode || record.shiftCode || record.orderCode || record.bankKey || record.key || record.sku || record.taxId;
  if (record.paymentIndex !== undefined) parts.push(`Khoản thu ${Number(record.paymentIndex) + 1}${record.paymentMethod ? ` (${record.paymentMethod})` : ""}`);
  if (businessCode && normalize(String(businessCode)) !== normalize(String(primary || ""))) parts.push(record.taxId && String(businessCode) === String(record.taxId) ? `MST ${businessCode}` : `mã ${businessCode}`);
  if (record.branchName && normalize(String(record.branchName)) !== normalize(String(primary || ""))) {
    const branchName = String(record.branchName).replace(/^chi nhánh\s+/i, "").trim();
    parts.push(`Chi nhánh ${branchName}`);
  }
  return parts.join(" — ");
}
const referenceOptionDisambiguators = [
  { label: "m\u00e3 SP", keys: ["productCode"] },
  { label: "ô giữ đơn", keys: ["__assistantHeldSlot"] },
  { label: "người tạo", keys: ["__assistantDraftCreatorName"] },
  { label: "mã", keys: ["code", "employeeCode", "customerCode", "sku", "assetCode", "barcode", "ticketCode", "shiftCode", "orderCode"] },
  { label: "SĐT", keys: ["__assistantReferencePhone", "phone", "studentPhone"] },
  { label: "email", keys: ["email"] },
  { label: "phòng ban", keys: ["departmentName", "department"] },
  { label: "chi nhánh", keys: ["branchName"] },
  { label: "vai trò", keys: ["role"] },
  { label: "trạng thái", keys: ["status"] },
] as const;
function referenceDisambiguatorValues(record: Record<string, any>) {
  const values: { label: string; value: string }[] = referenceOptionDisambiguators.flatMap(({ label, keys }) => {
    const value = keys.map(key => record[key]).find(candidate => typeof candidate === "string" && candidate.trim());
    return typeof value === "string" ? [{ label, value: value.trim() }] : [];
  });
  if (record.status === "draft" && Number.isInteger(record.__assistantHeldSlot)) {
    values.push({ label: "ô giữ đơn", value: String(record.__assistantHeldSlot) });
  }
  return values;
}
function referenceOptionLabel(record: Record<string, any>, records: Record<string, any>[]) {
  const label = referenceLabel(record);
  const duplicates = records.filter(candidate => normalize(referenceLabel(candidate)) === normalize(label));
  if (duplicates.length < 2) return label;

  const differentiators = referenceDisambiguatorValues(record).filter(({ label: key, value }) => {
    const values = new Set(duplicates.map(candidate => {
      const item = referenceDisambiguatorValues(candidate).find(disambiguator => disambiguator.label === key);
      return normalize(item?.value || "");
    }));
    return value && values.size > 1;
  });
  if (!differentiators.length) return `${label} [trùng tên, cần thêm thông tin]`;
  return `${label} [${differentiators.map(({ label: key, value }) => `${key}: ${value}`).join("; ")}]`;
}
export function matchesReference(record: Record<string, any>, search: string) {
  const query = normalize(search);
  const partialNameMatch = query.length >= 3 && [
    record.name, record.fullName, record.displayName, record.courseTitle, record.productName, record.customerName,
    record.supplierName, record.warehouseName, record.employeeName, record.workerName,
    record.title, record.legalName,
  ].some(value => typeof value === "string" && normalize(value).includes(query));
  const backendQueryMatch = typeof record.__assistantQueryMatch === "string"
    && Boolean(query)
    && normalize(record.__assistantQueryMatch) === query;
  const displayedParts = search.split(/\s+[—–]\s+/u);
  const branchSuffix = displayedParts[1]?.replace(/^chi nhánh\s+/i, "").trim();
  const matchesDisplayedBranch = displayedParts.length === 2
    && /^chi nhánh\s+/i.test(displayedParts[1] || "")
    && normalize(referenceLabel(record).split(/\s+[—–]\s+/u)[0] || "") === normalize(displayedParts[0])
    && normalize(String(record.branchName || "").replace(/^chi nhánh\s+/i, "").trim()) === normalize(branchSuffix || "");
  const matchesDisplayedPhone = displayedParts.length === 2
    && typeof (record.__assistantReferencePhone || record.phone || record.studentPhone) === "string"
    && normalize(referenceLabel(record).split(/\s+[—–]\s+/u)[0] || "") === normalize(displayedParts[0])
    && normalize(String(record.__assistantReferencePhone || record.phone || record.studentPhone)) === normalize(displayedParts[1]);
  const matchesDisplayedCustomer = typeof record.name === "string" && typeof record.customerCode === "string"
    && displayedParts.length >= 2
    && normalize(displayedParts[0]) === normalize(record.name)
    && normalize(displayedParts[1]) === normalize(record.customerCode)
    && (displayedParts.length < 3 || normalize(displayedParts[2]) === normalize(String(record.phone || "")))
    && displayedParts.slice(3).every(part => normalize(part).startsWith("chi nhanh "));
  const disambiguated = search.match(/^(.*) \[([^\]]+)\]$/u);
  const matchesDisambiguators = Boolean(disambiguated)
    && normalize(referenceLabel(record)) === normalize(disambiguated?.[1] || "")
    && String(disambiguated?.[2] || "").split("; ").every(part => {
      const separator = part.indexOf(": ");
      if (separator < 0) return false;
      const label = normalize(part.slice(0, separator));
      const value = normalize(part.slice(separator + 2));
      const allowed = referenceOptionDisambiguators.find(candidate => normalize(candidate.label) === label);
      return Boolean(allowed && referenceDisambiguatorValues(record)
        .some(candidate => normalize(candidate.label) === label && normalize(candidate.value) === value));
    });
  return referenceValues(record).some(value => normalize(value) === query)
    || normalize(referenceLabel(record)) === query
    || matchesDisambiguators
    || matchesDisplayedBranch
    || matchesDisplayedPhone
    || matchesDisplayedCustomer
    || partialNameMatch
    || backendQueryMatch
    || (typeof record.employeeName === "string" && typeof record.amount === "number" && normalize(referenceLabel(record)).includes(query));
}
function rawRecords(response: any): Record<string, any>[] {
  const data = response?.data ?? response;
  if (Array.isArray(data)) return data.filter(item => item && typeof item === "object");
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data.variants)) return data.variants.filter((item: any) => item && typeof item === "object").map((item: any) => ({ ...item, productId: item.productId || data._id || data.id, productName: data.name }));
  if (data.shift && typeof data.shift === "object" && !Array.isArray(data.shift)) return [data.shift];
  for (const key of ["items", "records", "results", "rows", "events", "products", "courses", "contracts", "batches", "enrollments", "exams", "payments", "notifications", "resources", "warehouses", "balances", "accounts", "vouchers", "bankLines", "users", "customers", "students", "partners", "workers", "branches", "campaigns", "stages", "data"]) {
    if (Array.isArray(data[key])) return data[key].filter((item: any) => item && typeof item === "object").map((item: any) => item.payment && typeof item.payment === "object" ? { ...item, paymentMethod: item.payment.method, paymentAmount: item.payment.amount } : item);
  }
  return data._id || data.id || data.uid ? [data] : [];
}
function collectionPathFor(op: AssistantOperation, field: AssistantField) {
  if (!field.apiKey || !/^(?:id|uid|[A-Za-z]+(?:Id|Uid|Key))$/.test(field.apiKey)) return "";
  const index = op.path.indexOf(`:${field.apiKey}`);
  return index < 0 ? "" : op.path.slice(0, index).replace(/\/$/, "");
}
function isRecordIdentifier(value: string) {
  return /^(?:[a-f\d]{24}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}|[0-9]{6,32}(?:_[0-9]{6,32})?)$/i.test(value);
}
function isReferenceSearchField(field: AssistantField) {
  return /(?:search|keyword|term)/i.test(field.key)
    || /^(?:q|search|keyword|term)$/i.test(String(field.apiKey || ""));
}
async function loadPathReferenceRows(req: AuthenticatedRequest, op: AssistantOperation, field: AssistantField, values: Record<string, AssistantValue>) {
  const path = collectionPathFor(op, field);
  const referencedList = field.reference && ASSISTANT_OPERATIONS.find(candidate => candidate.id === field.reference && candidate.method === "GET");
  const list = referencedList || ASSISTANT_OPERATIONS.find(candidate => candidate.method === "GET" && candidate.path === path);
  if (!list) return null;
  if (list.id === "recruitment.interview.list") {
    const context: Record<string, AssistantValue> = {};
    const branch = list.fields.find(candidate => candidate.source === "query" && candidate.apiKey === "branchId");
    if (branch) context[branch.key] = String(values.branchId || req.user?.branchId || "");
    return { list, rows: await lookupReferenceCandidates(req, op, field, String(values[field.key] || ""), context) };
  }
  if (list.id === "worker.labor.contract.list") return { list, rows: await lookupRecords(req, list.id, String(values[field.key] || "")) };
  if (list.id === "inventory.count.detail") {
    const listPathField = list.fields.find(candidate => candidate.source === "path");
    const parentPathField = listPathField && op.fields.find(candidate => candidate.source === "path" && candidate.apiKey === listPathField.apiKey);
    if (!listPathField || !parentPathField || values[parentPathField.key] === undefined) return { list, rows: [] as Record<string, any>[] };
    const input: Record<string, AssistantValue> = { [listPathField.key]: values[parentPathField.key] };
    for (const listField of list.fields.filter(candidate => candidate.source === "query")) {
      const parentQueryField = op.fields.find(candidate => candidate.source === "query" && candidate.apiKey === listField.apiKey);
      if (parentQueryField && values[parentQueryField.key] !== undefined) input[listField.key] = values[parentQueryField.key];
      else if (listField.apiKey === "branchId" && req.user?.branchId) input[listField.key] = req.user.branchId;
    }
    const detail = await callOperation(req, list, input);
    return { list, rows: Array.isArray(detail?.data?.items) ? detail.data.items.filter((item: any) => item && typeof item === "object") : [] as Record<string, any>[] };
  }
  if (list.id === "inventory.serial.list") {
    const branchField = op.fields.find(candidate => candidate.source === "query" && candidate.apiKey === "branchId");
    const branchValues = branchField && values[branchField.key] !== undefined ? { [branchField.key]: values[branchField.key] } : {};
    return { list, rows: await lookupRecords(req, list.id, String(values[field.key] || ""), branchValues) };
  }
  const input: Record<string, AssistantValue> = {};
  const searchField = list.id === "inventory.serial.list"
    ? list.fields.find(candidate => candidate.source === "query" && candidate.apiKey === "serial")
    : list.fields.find(candidate => isReferenceSearchField(candidate))
    || list.fields.find(candidate => /(?:^|_)(?:name|code|sku)$/i.test(`${candidate.key} ${candidate.apiKey || ""}`));
  for (const listField of list.fields) {
    if (listField.source === "path") {
      const selectedParentField = field.referenceParentKey ? op.fields.find(candidate => candidate.key === field.referenceParentKey
        && (candidate.apiKey === listField.apiKey || list.fields.filter(item => item.source === "path").length === 1)) : undefined;
      const parentField = op.fields.find(candidate => candidate.key !== field.key && candidate.source === "path" && candidate.apiKey === listField.apiKey);
      if (selectedParentField && values[selectedParentField.key] !== undefined) input[listField.key] = values[selectedParentField.key];
      else if (parentField && values[parentField.key] !== undefined) input[listField.key] = values[parentField.key];
      else if (listField.required) return { list, rows: [] as Record<string, any>[] };
      continue;
    }
    const apiKey = String(listField.apiKey || listField.key).toLowerCase();
    if (searchField?.key === listField.key) {
      const selectedReference = String(values[field.key] || "");
      input[listField.key] = isRecordIdentifier(selectedReference) ? "" : selectedReference;
    }
    else if (listField.source === "query") {
      const referenceContextValue = field.referenceContext?.[`query_${listField.apiKey || listField.key}`]
        ?? field.referenceContext?.[listField.key];
      const parentQueryField = (field.referenceParentKey
        ? op.fields.find(candidate => candidate.key === field.referenceParentKey && candidate.apiKey === listField.apiKey)
        : undefined)
        || op.fields.find(candidate => candidate.source === "query" && candidate.apiKey === listField.apiKey);
      if (referenceContextValue !== undefined) input[listField.key] = referenceContextValue;
      else if (parentQueryField && values[parentQueryField.key] !== undefined) input[listField.key] = values[parentQueryField.key];
      else if (listField.apiKey === "branchId" && req.user?.branchId) input[listField.key] = req.user.branchId;
      else if (listField.required && listField.defaultValue !== undefined) input[listField.key] = listField.defaultValue;
      else if (listField.required) return { list, rows: [] as Record<string, any>[] };
    }
    else if (/limit$/.test(apiKey)) input[listField.key] = 100;
    else if (/page$/.test(apiKey)) input[listField.key] = 1;
    else if (listField.required && listField.defaultValue !== undefined) input[listField.key] = listField.defaultValue;
    else if (listField.required) return { list, rows: [] as Record<string, any>[] };
  }
  if (list.id === "payroll.run.list" && op.id === "payroll.run.reconciliation.publish") {
    input.query_status = "draft";
    const requestedPeriod = String(values[field.key] || values[`__assistantReferenceSearch_${field.key}`] || "");
    if (/^\d{4}-(?:0[1-9]|1[0-2])$/.test(requestedPeriod)) input.query_periodKey = requestedPeriod;
  }
  if (op.id.endsWith(".restore")) {
    const deletedField = list.fields.find(candidate => candidate.source === "query" && candidate.apiKey === "deleted");
    if (deletedField) input[deletedField.key] = true;
    if (op.id === "student.custom-field.restore") {
      const archivedField = list.fields.find(candidate => candidate.source === "query" && candidate.apiKey === "includeArchived");
      if (archivedField) input[archivedField.key] = true;
    }
  }
  try {
    let result = await callOperation(req, list, input);
    const requiresRecordProjection = list.id.startsWith("finance.treasury.")
      || list.id === "finance.management.debts.list"
      || list.id === "hr.contract.list"
      || list.id === "hr.workflow.list"
      || list.id === "worker.partner.settlements.list"
      || list.id === "worker.partner.settlement.detail"
      || list.id === "finance.receivable.detail"
      || list.id === "marketing.video-caption.project.list";
    let rows = requiresRecordProjection ? projectRecords(list, result, req, input) : rawRecords(result);
    rows = rows.map(row => !row.id && row._id ? { ...row, id: String(row._id) } : row);
    if (list.id === "payroll.employee.me.reconciliation" || list.id === "payroll.employee.me.payslips") {
      rows = rows.map(row => ({ ...row, id: row.__assistantRef?.runId || row.runId || row.id }));
    }
    // Admins may see same-name records from several branches. If a selected
    // label includes " — chi nhánh ...", search again using its visible name.
    const selectedLabel = String(values[field.key] || "");
    const namePrefix = selectedLabel.split(" — ", 1)[0]?.trim();
    if (!rows.length && searchField && namePrefix && namePrefix !== selectedLabel) {
      input[searchField.key] = namePrefix;
      result = await callOperation(req, list, input);
      rows = requiresRecordProjection ? projectRecords(list, result, req) : rawRecords(result);
    }
    const branchIds = [...new Set(rows.map(row => String(row.branchId || "")).filter(Boolean))];
    if (branchIds.length && op.id !== "branch.list" && !isRecruitmentOperation(op)) {
      try {
        const branches = await lookupRecords(req, "branch.list");
        const branchNames = new Map(branches.map(row => [String(row.id), String(row.name || row.code || "")]));
        for (const row of rows) if (row.branchId) row.branchName = branchNames.get(String(row.branchId)) || "";
      } catch { /* keep matching usable when branch labels are not readable */ }
    }
    return { list, rows };
  } catch {
    return { list, rows: [] as Record<string, any>[] };
  }
}

export async function lookupRecords(req: AuthenticatedRequest, operationId: string, search = "", extraValues: Record<string, AssistantValue> = {}) {
  const op = await assertOperation(req, operationId);
  if (op.module === "quotation") return lookupQuotationRecords(req, op, search, extraValues);
  if (op.module === "healthcare") return lookupHealthcareRecords(req, op, search, extraValues);
  // Some list APIs search business labels, not internal ObjectIds. When a
  // confirmed action rechecks a pinned ID, fetch the scoped page and match it
  // locally instead of sending the ID through a name/code search filter.
  const searchByInternalId = (isRecruitmentOperation(op) || op.id.endsWith(".list")) && isRecordIdentifier(search);
  const input: Record<string, AssistantValue> = { ...extraValues, search: searchByInternalId ? "" : search };
  const searchField = op.id === "inventory.serial.list"
    ? op.fields.find(field => field.source === "query" && field.apiKey === "serial")
    : ["category.list", "training.list"].includes(op.id)
      ? op.fields.find(field => field.key === "search")
    : op.fields.find(field => field.source === "query" && isReferenceSearchField(field));
  if (searchField && input[searchField.key] === undefined) input[searchField.key] = searchByInternalId ? "" : search;
  for (const field of op.fields) if (field.source === "query" && input[field.key] === undefined) {
    const apiKey = String(field.apiKey || field.key).toLowerCase();
    if (/page$/.test(apiKey)) input[field.key] = 1;
    else if (/limit$/.test(apiKey)) input[field.key] = 100;
    else if (op.id === "batch.list" && field.apiKey === "branchId" && req.user?.branchId) input[field.key] = req.user.branchId;
    else if (field.required && field.defaultValue !== undefined) input[field.key] = field.defaultValue;
  }
  let result = await callOperation(req, op, input);
  let records = projectRecords(op, result, req, input);
  // Draft labels are composed locally (amount and held slot), not searchable
  // order codes. Preserve the scope and let reference matching resolve them.
  if (op.id === "retail.order.list" && !records.length && search && !searchByInternalId && searchField) {
    const retryInput = { ...input, search: "", [searchField.key]: "" };
    result = await callOperation(req, op, retryInput);
    records = projectRecords(op, result, req, retryInput);
  }
  if (["department.list", "hr.workflow.list"].includes(op.id) && !records.some(record => matchesReference(record, search))) {
    const prefix = op.id === "department.list" ? /^(?:phòng ban|phong ban|phòng|phong|ban)\s+/iu : /^(?:quy trình|quy trinh)\s+/iu;
    const shortName = search.replace(prefix, "").trim();
    if (shortName && shortName !== search) {
      const retryInput = { ...input, search: shortName, [searchField?.key || "search"]: shortName };
      const retry = projectRecords(op, await callOperation(req, op, retryInput), req, retryInput);
      records = retry.filter(record => matchesReference(record, shortName));
      for (const record of records) Object.defineProperty(record, "__assistantQueryMatch", {value: search, enumerable: false});
    }
  }
  if (operationId === "inventory.serial.list" && !records.length && search) {
    const barcodeField = op.fields.find(field => field.source === "query" && field.apiKey === "barcodes");
    const serialField = op.fields.find(field => field.source === "query" && field.apiKey === "serial");
    if (barcodeField) {
      const barcodeInput = { ...input, ...(serialField ? { [serialField.key]: undefined } : {}), [barcodeField.key]: search };
      result = await callOperation(req, op, barcodeInput);
      records = projectRecords(op, result, req, barcodeInput);
    }
  }
  const selectedLabel = String(search || "");
  const namePrefix = selectedLabel.split(" — ", 1)[0]?.trim();
  if (!records.length && searchField && namePrefix && namePrefix !== selectedLabel) {
    const retryInput = { ...input, search: namePrefix, [searchField.key]: namePrefix };
    result = await callOperation(req, op, retryInput);
    records = projectRecords(op, result, req, retryInput);
  }
  if (operationId === "task.list" && extraValues.completionFilter === "unfinished") {
    const unfinishedStatuses = new Set(["Not Started", "In Progress", "Review/Testing"]);
    records = records.filter(record => unfinishedStatuses.has(String(record.status || "")));
  }
  if (operationId === "product.list" && search && !searchByInternalId) {
    for (const record of records) {
      Object.defineProperty(record, "__assistantQueryMatch", { value: search, enumerable: false, configurable: true });
    }
  }
  if (operationId === "worker.labor.contract.list" && records.length) {
    const sourceById = new Map(rawRecords(result).map(row => [String(row._id || row.id || ""), row]));
    const workers = await lookupRecords(req, "worker.list");
    const workerNames = new Map(workers.map(worker => [String(worker.id || ""), String(worker.fullName || "")]));
    for (const record of records) {
      const source = sourceById.get(String(record.id || ""));
      const workerName = source?.workerId ? workerNames.get(String(source.workerId)) : undefined;
      if (workerName) record.workerName = workerName;
    }
  }
  if (operationId === "worker.attendance.list" && records.length) {
    const sourceById = new Map(rawRecords(result).map(row => [String(row._id || row.id || ""), row]));
    const [workers, projects] = await Promise.all([
      lookupRecords(req, "worker.list"),
      lookupRecords(req, "worker.project.list"),
    ]);
    const workerNames = new Map(workers.map(worker => [String(worker.id || ""), String(worker.fullName || "")]));
    const projectNames = new Map(projects.map(project => [String(project.id || ""), String(project.name || project.code || "")]));
    for (const record of records) {
      const source = sourceById.get(String(record.id || ""));
      const workerId = String(source?.workerId?._id || source?.workerId || "");
      const projectId = String(source?.projectId?._id || source?.projectId || "");
      const workerName = workerNames.get(workerId);
      const projectName = projectNames.get(projectId);
      if (workerName) record.workerName = workerName;
      if (projectName) record.projectName = projectName;
      const checkInAt = source?.checkIn?.time;
      const checkOutAt = source?.checkOut?.time;
      if (checkInAt instanceof Date) record.checkInAt = checkInAt.toISOString();
      else if (typeof checkInAt === "string") record.checkInAt = checkInAt;
      if (checkOutAt instanceof Date) record.checkOutAt = checkOutAt.toISOString();
      else if (typeof checkOutAt === "string") record.checkOutAt = checkOutAt;
    }
  }
  const branchIds = [...new Set(records.map(row => row.branchId).filter((value): value is string => typeof value === "string" && value.length > 0))];
  if (branchIds.length && operationId !== "branch.list" && !operationId.startsWith("recruitment.")) {
    try {
      const branches = await lookupRecords(req, "branch.list");
      const branchNames = new Map(branches.map(row => [String(row.id), String(row.name || row.code || "")]));
      for (const record of records) if (typeof record.branchId === "string") record.branchName = branchNames.get(record.branchId) || "";
    } catch { /* keep the reference usable when branch labels are not readable */ }
  }
  const query = normalize(search);
  return query ? records.filter(row => Object.values(row).some(value => normalize(String(value)).includes(query)) || normalize(referenceLabel(row)).includes(query) || matchesReference(row, search)) : records;
}

export async function resolveNamedReferenceSelectors(req: AuthenticatedRequest, op: AssistantOperation, values: Record<string, unknown>) {
  // Healthcare update fields describe new values, never an implicit target to overwrite.
  if (op.module === "healthcare" || op.module === "quotation") return { ...values };
  const resolved = { ...values };
  const selectors = op.fields.filter(field => ["name", "title", "displayName", "fullName", "code", "email", "phone", "sku"].includes(field.key) && typeof values[field.key] === "string" && String(values[field.key]).trim());
  for (const field of op.fields) {
    if (!field.reference || !["id", "path_id"].includes(field.key) || resolved[field.key] !== undefined) continue;
    for (const selector of selectors) {
      const search = String(values[selector.key]);
      const candidates = await lookupRecords(req, field.reference, search);
      const exact = candidates.filter(row => matchesReference(row, search));
      if (exact.length === 1 && exact[0].id) {
        resolved[field.key] = exact[0].id;
        break;
      }
    }
  }
  return resolved;
}

async function resolveReferenceValue(
  req: AuthenticatedRequest,
  referenceId: string,
  search: string,
  context: Record<string, AssistantValue>,
  valueKey?: string,
  fieldKey?: string,
) {
  const candidates = await lookupRecords(req, referenceId, search, context);
  const exact = candidates.filter(row => matchesReference(row, search));
  const record = exact.length === 1 ? exact[0] : undefined;
  const value = record && (valueKey ? record[valueKey] : record.id || record._id || (fieldKey ? record[fieldKey] : undefined));
  return { candidates, exact, record, value };
}

async function workerIdsForAttendanceProject(req: AuthenticatedRequest, projectId: string): Promise<Set<string> | null> {
  const detail = ASSISTANT_OPERATIONS.find(operation => operation.method === "GET" && operation.path === "/worker-management/projects/:id");
  const pathField = detail?.fields.find(field => field.source === "path");
  if (!detail || !pathField) return null;
  try {
    const response = await callOperation(req, detail, { [pathField.key]: projectId });
    const data = response?.data?.project ?? response?.data ?? response?.project ?? response;
    if (!Array.isArray(data?.workerIds)) return null;
    return new Set(data.workerIds.map((id: unknown) => String(id)).filter(Boolean));
  } catch {
    return null;
  }
}

function nestedShapeByKey(op: AssistantOperation, key: string) {
  let found: any;
  const visit = (shape: AssistantField["structure"]) => {
    if (!shape || found) return;
    if (shape.type === "object" && shape.keys) {
      if (Object.prototype.hasOwnProperty.call(shape.keys, key)) {
        found = shape.keys[key];
        return;
      }
      for (const child of Object.values(shape.keys)) visit(child);
    } else if (shape.type === "array") visit(shape.items);
  };
  for (const field of op.fields) visit(field.structure);
  return found as AssistantField["structure"] | undefined;
}

function campaignSlotReferenceCandidates(op: AssistantOperation, field: AssistantField, candidates: Record<string, any>[]) {
  if (![
    "marketing.campaign.slot.reject",
    "marketing.campaign.slot.retry",
    "marketing.campaign.slot.approve",
    "marketing.campaign.slot.publish-now",
    "marketing.campaign.slot.content.update",
  ].includes(op.id) || field.reference !== "marketing.campaign.calendar") return candidates;

  const allowedStatuses = op.id === "marketing.campaign.slot.reject"
    ? ["pending_approval"]
    : op.id === "marketing.campaign.slot.retry"
      ? ["needs_attention", "failed"]
      : op.id === "marketing.campaign.slot.publish-now"
        ? ["pending_approval", "ready_to_publish", "needs_attention", "failed"]
        : op.id === "marketing.campaign.slot.content.update"
          ? ["pending_approval", "needs_attention", "failed"]
          : ["pending_approval", "needs_attention", "failed"];
  candidates = candidates.filter(candidate => allowedStatuses.includes(String(candidate.status)));

  if (["marketing.campaign.slot.approve", "marketing.campaign.slot.publish-now"].includes(op.id)) {
    candidates = candidates.filter(candidate => candidate.platform === "Facebook");
  }
  if (field.referenceValueKey === "campaignId") {
    const campaigns = new Map<string, Record<string, any>>();
    for (const candidate of candidates) {
      const campaignId = String(candidate.campaignId || candidate.id || "");
      if (campaignId && !campaigns.has(campaignId)) campaigns.set(campaignId, candidate);
    }
    return [...campaigns.values()];
  }
  return candidates;
}

function filterRelationshipCandidates(op: AssistantOperation, field: AssistantField, candidates: Record<string, any>[], values: Record<string, AssistantValue> = {}) {
  const selectingWriteRelationship = ["POST", "PATCH", "PUT"].includes(op.method) && field.source !== "path";
  if (op.id === "recruitment.applicant.create" && field.apiKey === "jobId" && field.reference === "recruitment.job.list") {
    candidates = candidates.filter(candidate => candidate.status === "open" && candidate.isDeleted !== true);
  }
  if (op.id === "company-knowledge.faq-candidate.reject" && field.reference === "company-knowledge.faq-candidates.list") {
    candidates = candidates.filter(candidate => candidate.status === "pending");
  }
  if ((op.id === "marketing.chat-flow.activate" && field.apiKey === "version")
    || (op.id === "marketing.lead-intake-profile.activate" && field.apiKey === "version")) {
    candidates = candidates.filter(candidate => candidate.status === "draft");
  }
  if (field.reference === "marketing.campaign.sheet.revisions.list" && /revisionId$/i.test(String(field.apiKey || field.key))) {
    candidates = candidates.filter(candidate => candidate.__assistantRevertible === true);
  }
  if (selectingWriteRelationship && field.reference === "department.list") {
    candidates = candidates.filter(candidate => candidate.isActive !== false);
  }
  if (selectingWriteRelationship && field.reference === "inventory.catalog.resource.list" && field.referenceContext?.path_kind === "categories") {
    candidates = candidates.filter(candidate => candidate.status !== "inactive" && candidate.isActive !== false);
  }
  if (op.id === "chat.room.transfer-admin" && field.apiKey === "newAdminId") candidates = candidates.filter(candidate => candidate.role !== "admin");
  if (op.id === "marketing.video-caption.project.cancel" && field.apiKey === "id") candidates = candidates.filter(candidate => !["completed", "cancelled"].includes(String(candidate.status)));
  if (op.id === "marketing.video-caption.project.retry" && field.apiKey === "id") candidates = candidates.filter(candidate => ["failed", "cancelled"].includes(String(candidate.status)));
  if (["marketing.bulk-create.templates.publish", "marketing.bulk-create.templates.unpublish"].includes(op.id) && field.apiKey === "id") candidates = candidates.filter(candidate => candidate.__assistantRef?.owned === true);
  if (op.id === "marketing.bulk-create.templates.community.use" && field.apiKey === "id") candidates = candidates.filter(candidate => candidate.__assistantRef?.communityTemplate === true);
  if (field.reference === "resource.list" && field.apiKey === "parentId") candidates = candidates.filter(candidate => candidate.type === "folder");
  if (field.reference === "resource.list" && op.path.startsWith("/inventory/catalog/products")) {
    candidates = candidates.filter(candidate => {
      if (candidate.type !== "file") return false;
      const mimeType = String(candidate.mimeType || "");
      return field.referenceContext?.resourceKind === "media" ? /^(?:image|video)\//i.test(mimeType) : !/^(?:image|video)\//i.test(mimeType);
    });
  }
  if (op.id === "finance.voucher.create" && field.apiKey === "payableId") {
    candidates = candidates.filter(candidate => candidate.direction === "payable" && candidate.partyKind === "supplier" && Number(candidate.balance) > 0);
  }
  if (op.id === "finance.tax.create" && field.apiKey === "sourceOrderId") {
    candidates = candidates.filter(candidate => ["confirmed", "completed"].includes(String(candidate.status)));
  }
  if (field.reference === "marketing.account.list") {
    const platform = String(field.referenceContext?.platform || field.referenceContext?.query_platform
      || (field.referenceParentKey ? values[field.referenceParentKey] : "") || "");
    candidates = candidates.filter(candidate => candidate.isConnected === true
      && (!platform || String(candidate.platform || "") === platform));
  }
  if (field.reference === "marketing.content.list") {
    const channel = String(field.referenceContext?.channel || field.referenceContext?.query_channel
      || (field.referenceParentKey ? values[field.referenceParentKey] : "") || "");
    if (channel) candidates = candidates.filter(candidate => String(candidate.channel || "") === channel);
  }
  if (op.path === "/finance/management/payables" && field.apiKey === "receiptId") candidates = candidates.filter(candidate => candidate.targetType === "unregisteredReceipt");
  if (op.path === "/finance/management/followups" && field.apiKey === "targetId" && values.targetType !== undefined) candidates = candidates.filter(candidate => candidate.targetType === String(values.targetType));
  return campaignSlotReferenceCandidates(op, field, candidates);
}

async function resolveOperationReference(
  req: AuthenticatedRequest,
  ownerOperation: AssistantOperation,
  field: AssistantField,
  search: string,
  context: Record<string, AssistantValue>,
  fieldKey?: string,
) {
  const selectedRetailOrderCode = ownerOperation.id === "retail.order.payment-qr" && field.reference === "retail.order.list"
    ? retailOrderCodeFromSearch(search)
    : undefined;
  const referenceSearch = selectedRetailOrderCode || search;
  const candidates = filterRelationshipCandidates(ownerOperation, field,
    await lookupReferenceCandidates(req, ownerOperation, field, referenceSearch, context), context);
  const exact = candidates.filter(row => matchesReference(row, referenceSearch));
  const record = exact.length === 1 ? exact[0] : undefined;
  const value = record && (field.referenceValueKey ? record[field.referenceValueKey] : record.id || record._id || (fieldKey ? record[fieldKey] : undefined));
  return { candidates, exact, record, value };
}

function normalizeBatchClassSearch(search: string) {
  const trimmed = search.trim();
  return trimmed.replace(/^(?:(?:xem|tra c\u1EE9u|tra cuu|th\u00F4ng tin|thong tin|cho t\u00F4i bi\u1EBFt|cho toi biet)\s+)+(?:th\u00F4ng tin\s+)?/iu, "").trim() || trimmed;
}

async function lookupReferenceCandidates(
  req: AuthenticatedRequest,
  ownerOperation: AssistantOperation,
  field: AssistantField,
  search: string,
  context: Record<string, AssistantValue>,
) {
  if (ownerOperation.id === "retail.order.payment-qr" && field.reference === "retail.order.list") {
    const orderCode = retailOrderCodeFromSearch(search);
    if (orderCode) {
      const candidates = await lookupRecords(req, field.reference, orderCode, context);
      if (candidates.some(candidate => matchesReference(candidate, orderCode))) return candidates;
    }
  }
  const normalizedSearch = field.reference === "batch.list" ? normalizeBatchClassSearch(search) : search.trim();
  if (ownerOperation.id === "retail.order.cancel" && field.reference === "retail.order.list") {
    // The retail list separates held drafts from posted sales. Cancellation
    // supports both, so search both within the same authorized branch.
    const groups = await Promise.all([false, true].map(query_heldOnly =>
      lookupRecords(req, field.reference!, normalizedSearch, { ...context, query_heldOnly })));
    return [...new Map(groups.flat().map(record => [String(record.id || record._id), record])).values()];
  }
  if (ownerOperation.id.startsWith("recruitment.interview.") && field.source === "path"
    && field.reference === "recruitment.interview.list" && normalizedSearch && !isRecordIdentifier(normalizedSearch)) {
    const applicantList = operationById("recruitment.applicant.list");
    if (applicantList) {
      const applicantSearch = normalizedSearch.split(/\s+[—–]\s+/u, 1)[0]?.trim() || normalizedSearch;
      const applicants = await lookupRecords(req, applicantList.id, applicantSearch, context);
      const namedApplicants = applicants.filter(candidate => matchesReference(candidate, applicantSearch));
      if (namedApplicants.length) {
        const groups = await Promise.all(namedApplicants.slice(0, 8).map(async applicant => {
          const applicantId = String(applicant.id || applicant._id || "");
          if (!applicantId) return [];
          const interviews = await lookupRecords(req, "recruitment.interview.list", "", { ...context, query_applicantId: applicantId });
          return interviews.map(interview => {
            const date = interview.scheduledStart ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(String(interview.scheduledStart))) : "Thời gian chưa xác định";
            return { ...interview, fullName: `${String(applicant.fullName || applicant.displayName || "Ứng viên")} — ${date}` };
          });
        }));
        return groups.flat() as Record<string, any>[];
      }
    }
  }
  const lookupContext = ownerOperation.id === "payroll.run.reconciliation.publish" && field.reference === "payroll.run.list"
    ? {
      ...context,
      query_status: "draft",
      ...( /^\d{4}-(?:0[1-9]|1[0-2])$/.test(normalizedSearch) ? { query_periodKey: normalizedSearch } : {}),
    }
    : context;
  // Private selector keys (e.g. payoutId) are intentionally non-enumerable.
  // Let the caller match that declared key instead of losing it in text search.
  let candidates = await lookupRecords(req, field.reference!, field.referenceValueKey && isRecordIdentifier(normalizedSearch) ? '' : normalizedSearch, lookupContext);
  if (field.reference === "batch.list" && !candidates.length && normalizedSearch.split(/\s+/).length >= 2) {
    const broaderClassSearch = normalizedSearch.split(/\s+/).slice(0, -1).join(" ");
    candidates = await lookupRecords(req, field.reference, broaderClassSearch, lookupContext);
  }
  if (field.reference === "batch.list" && normalizedSearch
    && !candidates.some(row => matchesReference(row, normalizedSearch))) {
    const scopedBatches = await lookupRecords(req, field.reference, "", lookupContext);
    const query = normalize(normalizedSearch);
    const partialMatches = scopedBatches.filter(row => [row.name, row.code, row.courseTitle]
      .some(value => typeof value === "string" && normalize(value).includes(query)));
    if (partialMatches.length) candidates = partialMatches;
  }
  if (["student.batch.create", "student.batch.update"].includes(ownerOperation.id)
    && field.apiKey === "instructorId" && field.reference === "employee.list") {
    const branchId = String(req.user?.branchId || "");
    candidates = branchId
      ? candidates.filter(candidate => candidate.__assistantActive === true && String(candidate.branchId || "") === branchId)
      : [];
  }
  // Product search endpoints can omit a valid exact name from `q` results.
  // Retry against the scoped first page and match the displayed name locally.
  if (field.reference === "product.list" && search.trim() && !candidates.some(row => matchesReference(row, search))) {
    const unfiltered = await lookupRecords(req, field.reference, "", context);
    if (unfiltered.some(row => matchesReference(row, search))) candidates = unfiltered;
  }
  if (field.reference === "training.list" && search.trim() && !candidates.some(row => matchesReference(row, search))) {
    const unfiltered = await lookupRecords(req, field.reference, "", context);
    const nameMatches = unfiltered.filter(row => matchesReference(row, search));
    if (nameMatches.length) candidates = nameMatches;
  }
  if (field.reference === "worker.project.list" && search.trim() && !candidates.some(row => matchesReference(row, search))) {
    const unfiltered = await lookupRecords(req, field.reference, "", context);
    const nameMatches = unfiltered.filter(row => matchesReference(row, search));
    if (nameMatches.length) candidates = nameMatches;
  }
  return candidates;
}

async function lookupReceiptProductCandidates(
  req: AuthenticatedRequest,
  search: string,
  context: Record<string, AssistantValue>,
) {
  const combinations = ["physical", "bundle"].flatMap(productType => ["active", "draft"].map(status => ({
    ...context,
    query_productType: productType,
    query_status: status,
    query_page: 1,
    query_limit: 100,
  })));
  const groups = await Promise.all(combinations.map(filters => lookupRecords(req, "product.list", search, filters)));
  const unique = new Map<string, Record<string, any>>();
  for (const row of groups.flat()) {
    const id = String(row.id || row._id || "");
    if (id) unique.set(id, row);
  }
  const candidates = [...unique.values()];
  const exactNameMatches = candidates.filter(row => normalize(String(row.name || row.productName || "")) === normalize(search));
  return exactNameMatches.length ? exactNameMatches : candidates;
}

async function lookupReceiptSkuCandidates(req: AuthenticatedRequest, productId: string) {
  const detail = operationById("inventory.product.detail");
  const pathField = detail?.fields.find(field => field.source === "path");
  if (!detail || !pathField || !isRecordIdentifier(productId)) return [];
  const response = await callOperation(req, detail, { [pathField.key]: productId });
  return projectRecords(detail, response, req).filter(variant => variant.status === "active");
}

export async function suggestReferenceOptions(
  req: AuthenticatedRequest,
  op: AssistantOperation,
  field: AssistantField,
  values: Record<string, AssistantValue>,
) {
  if (!field.reference) return [];
  if (field.referenceParentKey
    && (values[field.referenceParentKey] === undefined || values[field.referenceParentKey] === null || String(values[field.referenceParentKey]).trim() === "")) return [];
  if (op.module === "quotation") return suggestQuotationReferences(req, op, field, values, lookupRecords);
  if (op.module === "healthcare") return suggestHealthcareReferences(req, op, field, values, lookupRecords, matchesReference);
  const referenceOperation = operationById(field.reference);
  const context: Record<string, AssistantValue> = {};
  for (const candidate of referenceOperation?.fields || []) {
    if (!(candidate.key === "id" || candidate.source === "path" || candidate.source === "query")) continue;
    const parent = op.fields.find(item => item.source === candidate.source
      && (item.key === candidate.key || Boolean(candidate.apiKey) && item.apiKey === candidate.apiKey));
    if (parent && values[parent.key] !== undefined) context[candidate.key] = values[parent.key];
  }
  if (field.reference === "omni-inbox.account.list" && field.referenceParentKey && values[field.referenceParentKey] !== undefined) {
    context.query_platform = String(values[field.referenceParentKey]);
  }
  Object.assign(context, field.referenceContext || {});
  if (field.reference === "student.quality.mini-tests.list") {
    const batchSearch = String(values.path_batchId || "").trim();
    const studentSearch = String(values.path_studentId || "").trim();
    if (!batchSearch || !studentSearch) return [];
    const batches = (await lookupRecords(req, "batch.list", batchSearch)).filter(row => matchesReference(row, batchSearch));
    if (batches.length !== 1 || !batches[0].id) return [];
    const batchId = String(batches[0].id);
    const students = (await lookupRecords(req, "batch.attendance.learners", studentSearch, { path_id: batchId })).filter(row => matchesReference(row, studentSearch));
    if (students.length !== 1 || !students[0].id) return [];
    context.path_batchId = batchId;
    context.path_studentId = String(students[0].id);
  }
  const selectingAttendanceWorker = op.method === "POST" && op.path === "/worker-management/attendance/mark" && field.apiKey === "workerId";
  if (selectingAttendanceWorker) {
    const projectSearch = String(values.projectId || "").trim();
    if (!projectSearch) return [];
    const projects = (await lookupRecords(req, "worker.project.list", projectSearch)).filter(row => matchesReference(row, projectSearch));
    if (projects.length !== 1 || !projects[0].id) return [];
    const workerIds = await workerIdsForAttendanceProject(req, String(projects[0].id));
    if (!workerIds?.size) return [];
    const workers = await lookupRecords(req, field.reference, "", context);
    return workers.filter(worker => workerIds.has(String(worker.id || worker._id || ""))).map(referenceLabel).filter(Boolean).slice(0, 8);
  }
  const isBatchWorkflow = ["student.batch.create", "student.batch.update"].includes(op.id);
  if (isBatchWorkflow && field.apiKey === "roadmapStepId") {
    const courseSearch = String(values.courseId || "").trim();
    if (!courseSearch) return [];
    const courses = (await lookupRecords(req, "course.list", courseSearch)).filter(row => matchesReference(row, courseSearch));
    if (courses.length !== 1 || !courses[0].id) return [];
    context.query_courseId = String(courses[0].id);
  }
  let parentValue = field.referenceParentKey ? context[field.referenceParentKey] ?? values[field.referenceParentKey] : undefined;
  const parentField = field.referenceParentKey ? op.fields.find(item => item.key === field.referenceParentKey) : undefined;
  const nestedParent = field.referenceParentKey && !parentField ? nestedShapeByKey(op, field.referenceParentKey) : undefined;
  if (parentValue !== undefined && parentField?.reference) {
    const parentSearch = String(parentValue);
    if (!isRecordIdentifier(parentSearch)) {
      const exactParents = (await lookupRecords(req, parentField.reference, parentSearch)).filter(row => matchesReference(row, parentSearch));
      if (exactParents.length !== 1) return [];
      const parentRecord = exactParents[0];
      const resolvedParent = parentField.referenceValueKey ? parentRecord[parentField.referenceValueKey] : parentRecord.id || parentRecord._id || parentRecord.uid;
      if (resolvedParent === undefined || resolvedParent === null || resolvedParent === "") return [];
      parentValue = String(resolvedParent);
    }
    context[parentField.key] = parentValue;
  } else if (parentValue !== undefined && nestedParent?.reference && !isRecordIdentifier(String(parentValue))) {
    const parentSearch = String(parentValue);
    const exactParents = (await lookupRecords(req, nestedParent.reference, parentSearch)).filter(row => matchesReference(row, parentSearch));
    if (exactParents.length !== 1) return [];
    const parentRecord = exactParents[0];
    const resolvedParent = nestedParent.referenceValueKey ? parentRecord[nestedParent.referenceValueKey] : parentRecord.id || parentRecord._id || parentRecord.uid;
    if (resolvedParent === undefined || resolvedParent === null || resolvedParent === "") return [];
    parentValue = String(resolvedParent);
  }
  const parentApiKey = parentField?.apiKey || field.referenceParentKey;
  const pathFields = (referenceOperation?.fields || []).filter(item => item.source === "path");
  const queryFields = (referenceOperation?.fields || []).filter(item => item.source === "query");
  const parentPathField = parentValue === undefined ? undefined
    : pathFields.find(item => parentApiKey && item.apiKey === parentApiKey) || (pathFields.length === 1 ? pathFields[0] : undefined);
  const parentQueryField = parentValue === undefined || parentPathField ? undefined
    : queryFields.find(item => parentApiKey && item.apiKey === parentApiKey)
      || (parentField?.key === "targetBranch" ? queryFields.find(item => item.apiKey === "branchId") : undefined)
      || (queryFields.length === 1 ? queryFields[0] : undefined);
  if (parentPathField) context[parentPathField.key] = String(parentValue);
  else if (parentQueryField) context[parentQueryField.key] = String(parentValue);

  const payrollPeriodSearch = op.id === "payroll.run.reconciliation.publish" && field.key === "path_id"
    && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(String(values.path_id || "")) ? String(values.path_id) : "";
  const referenceSearch = String(values[`__assistantReferenceSearch_${field.key}`] || payrollPeriodSearch).trim();
  const isReceiptProductSelector = ["inventory.receipt.create", "inventory.receipt.update"].includes(op.id)
    && field.reference === "product.list" && /^items\[\d+\]\.productId$/.test(field.key);
  const isProductSkuSelector = field.reference === "inventory.product.detail"
    && Boolean(field.referenceParentKey)
    && /^items\[\d+\]\.(?:sku|variantId)$/.test(field.key);
  let candidates = isProductSkuSelector && parentValue !== undefined
    ? await lookupReceiptSkuCandidates(req, String(parentValue))
    : isReceiptProductSelector
      ? await lookupReceiptProductCandidates(req, referenceSearch, context)
      : await lookupReferenceCandidates(req, op, field, referenceSearch, context);
  if (isBatchWorkflow && field.apiKey === "roadmapId") candidates = candidates.filter(candidate => candidate.status === "active");
  candidates = filterRelationshipCandidates(op, field, candidates, values);
  if (["inventory.receipt.create", "inventory.receipt.update"].includes(op.id)
    && field.reference === "product.list" && /^items\[\d+\]\.productId$/.test(field.key)) {
    candidates = candidates.filter(candidate => ["physical", "bundle"].includes(String(candidate.productType || ""))
      && ["active", "draft"].includes(String(candidate.status || "")));
  }
  if (op.id === "finance.treasury.bank-lines.create" && field.key === "accountId") {
    candidates = candidates.filter(candidate => candidate.kind === "bank");
  }
  if (parentValue !== undefined && !parentPathField && !parentQueryField) {
    candidates = candidates.filter(candidate => String(candidate.branchId || "") === String(parentValue));
  }
  if (field.reference === "omni-inbox.account.list") {
    const platform = String(field.referenceContext?.platform || field.referenceContext?.query_platform || context.query_platform || "");
    if (platform) candidates = candidates.filter(candidate => String(candidate.platform || "").toLocaleLowerCase() === platform.toLocaleLowerCase()
      && candidate.isConnected === true && typeof candidate.pageId === "string");
  }
  if (op.id === "resource.google-drive.move" && field.apiKey === "fileId") candidates = candidates.filter(candidate => candidate.mimeType !== "application/vnd.google-apps.folder");
  if (op.id === "resource.google-drive.move" && field.apiKey === "newParentId") candidates = candidates.filter(candidate => candidate.mimeType === "application/vnd.google-apps.folder");
  if (["marketing.bulk-create.jobs.cancel", "marketing.bulk-create.jobs.retry"].includes(op.id) && field.reference === "marketing.bulk-create.jobs.list") {
    const eligibleStatuses = op.id === "marketing.bulk-create.jobs.cancel" ? ["queued", "processing"] : ["partial", "failed"];
    candidates = candidates.filter(candidate => eligibleStatuses.includes(String(candidate.status))
      && (op.id !== "marketing.bulk-create.jobs.retry" || Number(candidate.failedItems) > 0));
  }
  const maximum = op.module === "student" || ["access.permission-catalog.list", "course.category.list"].includes(field.reference) ? 100 : 8;
  return [...new Set(candidates.map(candidate => referenceOptionLabel(candidate, candidates)).filter(label => label && label !== "Bản ghi"))].slice(0, maximum);
}

function nestedReferenceLabel(shape: NonNullable<AssistantField["structure"]>, key: string) {
  return shape.label || ({ productId: "Sản phẩm", variantId: "SKU", unitCode: "Đơn vị tính", categoryCode: "Thể loại / thư mục", templateCode: "Mẫu sản phẩm", brandCode: "Thương hiệu" } as Record<string, string>)[key] || key;
}

async function validateInventoryUnitIdentifiers(
  req: AuthenticatedRequest,
  op: AssistantOperation,
  items: any[],
  values: Record<string, AssistantValue>,
  errors: string[],
) {
  const stockLogIssue = op.id === "inventory.stock-log.internal.issue.create";
  const transfer = op.id === "inventory.transfer.create";
  if ((!stockLogIssue && !transfer) || !Array.isArray(items)) return;
  const warehouseId = String(values[stockLogIssue ? "warehouseId" : "fromWarehouseId"] || "");
  const sourceBranch = String(values.targetBranch || req.user?.branchId || "");
  const serialOperation = operationById("inventory.serial.list");

  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const line = index + 1;
    const productId = String(item.productId || "");
    const variantId = String(stockLogIssue ? item.sku || "" : item.variantId || "");
    if (!productId || !variantId) continue;
    const variants = await lookupReceiptSkuCandidates(req, productId);
    const matches = variants.filter(variant => String(variant.id || variant._id || "") === variantId
      || stockLogIssue && String(variant.sku || "") === variantId);
    if (matches.length !== 1) {
      errors.push(`Mục ${line}: chưa xác định được chế độ theo dõi của SKU đã chọn; vui lòng chọn lại SKU.`);
      continue;
    }
    const variant = matches[0];
    const trackingMode = String(variant.trackingMode || "");
    const identifiers = Array.isArray(item.unitIdentifiers) ? item.unitIdentifiers.map((value: unknown) => String(value).trim()) : [];
    item.unitIdentifiers = identifiers;

    if (transfer && trackingMode === "lot") {
      errors.push(`Mục ${line}: SKU ${variant.sku || "đã chọn"} đang quản lý theo lô; phiếu điều chuyển này chưa hỗ trợ hàng theo lô.`);
      continue;
    }
    if (!["serial", "unit_barcode"].includes(trackingMode)) {
      if (identifiers.length) errors.push(`Mục ${line}: SKU ${variant.sku || "đã chọn"} không theo dõi từng máy nên không cần mã IMEI/serial.`);
      item.unitIdentifiers = [];
      continue;
    }

    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 500 || identifiers.length !== quantity || identifiers.some((identifier: string) => !identifier)) {
      errors.push(`Mục ${line}: SKU ${variant.sku || "đã chọn"} cần đủ mã IMEI/serial cho ${Number.isFinite(quantity) ? quantity : "số lượng"} máy.`);
      continue;
    }
    if (new Set(identifiers.map((identifier: string) => identifier.toLocaleUpperCase())).size !== identifiers.length) {
      errors.push(`Mục ${line}: danh sách IMEI/serial có mã trùng nhau.`);
      continue;
    }
    if (!warehouseId || !sourceBranch || !serialOperation) {
      errors.push(`Mục ${line}: chưa xác định được kho gửi để kiểm tra tình trạng IMEI/serial.`);
      continue;
    }

    for (const identifier of identifiers) {
      const records = await lookupRecords(req, "inventory.serial.list", identifier, {
        targetBranch: sourceBranch,
        warehouseId,
        query_sku: String(variant.sku || ""),
        query_status: "in_stock",
        query_limit: 100,
      });
      if (records.length !== 1 || String(records[0].status || "") !== "in_stock") {
        errors.push(`Mục ${line}: mã ${identifier} không còn trong kho gửi với trạng thái sẵn sàng cho SKU ${variant.sku || "đã chọn"}. Hãy kiểm tra hoặc nhập mã khác.`);
      }
    }
  }
}

export async function resolveReferences(req: AuthenticatedRequest, op: AssistantOperation, values: Record<string, AssistantValue>) {
  if (op.module === "quotation") return resolveQuotationReferences(req, op, values, lookupRecords, matchesReference);
  if (op.module === "healthcare") return resolveHealthcareReferences(req, op, values, lookupRecords, matchesReference);
  const resolved = { ...values };
  const branchHeader = req.headers?.["x-branch-id"] || req.headers?.["X-Branch-Id"];
  const inventoryBranchField = op.module === "inventory"
    ? op.fields.find(field => field.source === "query" && ["branchId", "targetBranch"].includes(String(field.apiKey || "")))
    : undefined;
  const selectedInventoryBranch = req.user?.branchId || (typeof branchHeader === "string" ? branchHeader : "");
  if (inventoryBranchField && resolved[inventoryBranchField.key] === undefined && selectedInventoryBranch) {
    resolved[inventoryBranchField.key] = selectedInventoryBranch;
  }
  const labels: Record<string, string> = {};
  const errors: string[] = [];
  const unresolvedReferenceKeys = new Set<string>();
  const unresolvedReferenceErrors = new Map<string, string>();
  const selectionPath = (path: string) => path.replace(/\[(\d+)\]/g, (_match, index: string) => `[${Number(index) + 1}]`);
  const addUnresolvedReferenceError = (key: string, error: string) => {
    errors.push(error);
    unresolvedReferenceKeys.add(key);
    unresolvedReferenceErrors.set(key, error);
  };
  const resolvedReferences: Record<string, Record<string, any>> = {};
  const confirmationDetails: Record<string, Array<{ label: string; value: string }>> = {};
  const isReferenceParent = (field: AssistantField) => op.fields.some(candidate => candidate.referenceParentKey === field.key);
  const referenceFields = [...op.fields].sort((left, right) =>
    Number(right.source === "query" && right.apiKey === "branchId") - Number(left.source === "query" && left.apiKey === "branchId")
    || Number(isReferenceParent(right)) - Number(isReferenceParent(left)));
  for (const field of referenceFields) {
    if (!field.reference || values[field.key] === undefined) continue;
    if (op.adapter === "contract" && op.id.startsWith("customer.") && field.source === "path") continue;
    if (op.id === "student.custom-field.restore" && field.source === "path") continue;
    const collectionPath = field.source === "path" ? collectionPathFor(op, field) : "";
    if (isRecruitmentOperation(op) && collectionPath && ASSISTANT_OPERATIONS.some(candidate => candidate.method === "GET" && candidate.path === collectionPath)) continue;
    if (field.source === "query" && field.apiKey === "branchId" && req.user?.branchId && String(values[field.key]) === req.user.branchId) {
      labels[field.key] = "Chi nhánh của bạn";
      continue;
    }
    const rawSearch = String(values[field.key]);
    const search = field.reference === "batch.list" ? normalizeBatchClassSearch(rawSearch) : rawSearch;
    const referenceOperation = operationById(field.reference);
    const context: Record<string, AssistantValue> = {};
    for (const candidate of referenceOperation?.fields || []) {
      if (!(candidate.key === "id" || candidate.source === "path" || candidate.source === "query")) continue;
      const parent = op.fields.find(field => field.source === candidate.source
        && (field.key === candidate.key || Boolean(candidate.apiKey) && field.apiKey === candidate.apiKey));
      if (parent && resolved[parent.key] !== undefined) context[candidate.key] = resolved[parent.key];
    }
    Object.assign(context, field.referenceContext || {});
    if (isRecruitmentOperation(op) && field.reference === "employee.list" && resolved.branchId !== undefined) context.branchId = String(resolved.branchId);
    if ((op.path.startsWith("/payroll/periods/") || op.path.startsWith("/payroll/runs/")) && field.reference === "employee.list" && resolved.targetBranch !== undefined) context.branchId = String(resolved.targetBranch);
    const parentValue = field.referenceParentKey
      ? resolved[field.referenceParentKey] ?? (field.referenceParentKey === "targetBranch" ? req.user?.branchId : undefined)
      : undefined;
    // A child reference with a named parent cannot be searched safely until
    // that parent is selected. Keep the user's search text pending and ask for
    // the parent first instead of turning the missing context into an API error.
    if (field.referenceParentKey && (parentValue === undefined || parentValue === null || parentValue === "")) continue;
    const selectedRetailOrderCode = op.id === "retail.order.payment-qr" && field.reference === "retail.order.list"
      ? retailOrderCodeFromSearch(search)
      : undefined;
    const referenceSearch = selectedRetailOrderCode || search;
    const parentField = field.referenceParentKey ? op.fields.find(candidate => candidate.key === field.referenceParentKey) : undefined;
    const parentApiKey = parentField?.apiKey;
    const referencePathFields = (referenceOperation?.fields || []).filter(candidate => candidate.source === "path");
    const referenceQueryFields = (referenceOperation?.fields || []).filter(candidate => candidate.source === "query");
    const parentPathField = parentValue === undefined ? undefined
      : referencePathFields.find(candidate => parentApiKey && candidate.apiKey === parentApiKey)
        || (referencePathFields.length === 1 ? referencePathFields[0] : undefined);
    const parentQueryField = parentValue === undefined || parentPathField ? undefined
      : referenceQueryFields.find(candidate => parentApiKey && candidate.apiKey === parentApiKey)
        || (parentField?.key === "targetBranch" ? referenceQueryFields.find(candidate => candidate.apiKey === "branchId") : undefined)
        || (referenceQueryFields.length === 1 ? referenceQueryFields[0] : undefined);
    if (parentPathField) context[parentPathField.key] = String(parentValue);
    else if (parentQueryField) context[parentQueryField.key] = String(parentValue);
    const allCandidates = await lookupReferenceCandidates(req, op, field, referenceSearch, context);
    let candidates = parentValue === undefined || parentPathField || parentQueryField
      ? allCandidates
      : parentValue === undefined ? allCandidates : allCandidates.filter(candidate => String(candidate.branchId || "") === String(parentValue));
    if (["student.batch.create", "student.batch.update"].includes(op.id) && field.apiKey === "roadmapId") {
      candidates = candidates.filter(candidate => candidate.status === "active");
    }
    if (field.reference === "omni-inbox.account.list" && field.apiKey === "pageId"
      && op.id.startsWith("marketing.lead-intake-profile.") && resolved.platform !== undefined) {
      const expectedPlatform = String(resolved.platform).toLocaleLowerCase();
      candidates = candidates.filter(candidate => String(candidate.platform || "").toLocaleLowerCase() === expectedPlatform);
    }
    candidates = filterRelationshipCandidates(op, field, candidates, resolved);
    if (op.method === "POST" && op.path === "/worker-management/attendance/mark" && field.apiKey === "workerId") {
      const workerIds = resolved.projectId === undefined ? null : await workerIdsForAttendanceProject(req, String(resolved.projectId));
      candidates = workerIds ? candidates.filter(candidate => workerIds.has(String(candidate.id || candidate._id || ""))) : [];
    }
    if (["student.batch.create", "student.batch.update"].includes(op.id) && field.apiKey === "roadmapStepId" && resolved.courseId !== undefined) {
      candidates = candidates.filter(candidate => String(candidate.courseId || "") === String(resolved.courseId));
    }
    if (field.reference === "omni-inbox.account.list") {
      const expectedPlatform = String(field.referenceContext?.platform || field.referenceContext?.query_platform || (op.id.startsWith("marketing.chat-flow.") ? "Facebook" : ""));
      if (expectedPlatform) candidates = candidates.filter(candidate => candidate.platform === expectedPlatform && candidate.isConnected === true && typeof candidate.pageId === "string");
    }
    const importingInvoiceTax = op.id === "finance.tax.from-invoice" && field.source === "path" && field.apiKey === "id";
    if (importingInvoiceTax) candidates = candidates.filter(row => row.status === "issued");
    const reversingStockLog = op.id === "inventory.stock-log.reverse" && field.source === "path" && field.apiKey === "id";
    if (reversingStockLog) candidates = candidates.filter(row => row.__assistantReversible === true);
    const reversingWorkerPartnerPayout = op.id === "worker.partner.payout.reverse" && field.source === "path" && field.apiKey === "payoutId";
    if (reversingWorkerPartnerPayout) candidates = candidates.filter(row => row.__assistantReversible === true);
    const publishingPayrollPayslips = op.id === "payroll.run.payslips.publish" && field.source === "path" && field.apiKey === "id";
    if (publishingPayrollPayslips) candidates = candidates.filter(row => ["closed", "paid"].includes(String(row.status)));
    const selectingPayrollPaymentTransition = Boolean(payrollPaymentRequiredStatus[op.id])
      && field.source === "path" && field.apiKey === "id" && field.reference === "payroll.run.payments.list";
    if (selectingPayrollPaymentTransition) candidates = candidates.filter(row => String(row.status) === payrollPaymentRequiredStatus[op.id]);
    if (op.id === "inventory.serial.transfer.local" && field.key === "toWarehouseId") {
      candidates = candidates.filter(row => row.isActive === true && row.kind !== "transit");
    }
    if (op.id === "inventory.count.approve" && field.apiKey === "id") candidates = candidates.filter(row => row.status === "pending_approval");
    if (op.id === "inventory.count.recreate" && field.apiKey === "id") candidates = candidates.filter(row => row.status === "conflict");
    if (op.id === "resource.google-drive.move" && field.apiKey === "fileId") candidates = candidates.filter(candidate => candidate.mimeType !== "application/vnd.google-apps.folder");
    if (op.id === "resource.google-drive.move" && field.apiKey === "newParentId") candidates = candidates.filter(candidate => candidate.mimeType === "application/vnd.google-apps.folder");
    const confirmingReferral = op.method === "POST" && op.path.endsWith("/referrals/:referralId/confirm") && field.source === "path" && field.apiKey === "referralId";
    if (confirmingReferral) candidates = candidates.filter(candidate => candidate.status === "pending");
  if (["marketing.campaign.sheet.ai.job.cancel", "marketing.campaign.sheet.ai.job.retry", "marketing.campaign.asset-order.ai.job.cancel"].includes(op.id)
      && field.apiKey === "jobId") {
      const eligibleStatuses = op.id === "marketing.campaign.sheet.ai.job.cancel" || op.id === "marketing.campaign.asset-order.ai.job.cancel"
        ? ["queued", "processing", "applying"]
        : ["failed", "partial", "cancelled"];
      candidates = candidates.filter(candidate => eligibleStatuses.includes(String(candidate.status)));
    }
    if (["marketing.bulk-create.jobs.cancel", "marketing.bulk-create.jobs.retry"].includes(op.id)
      && field.source === "path" && field.apiKey === "id" && field.reference === "marketing.bulk-create.jobs.list") {
      const eligibleStatuses = op.id === "marketing.bulk-create.jobs.cancel" ? ["queued", "processing"] : ["partial", "failed"];
      candidates = candidates.filter(candidate => eligibleStatuses.includes(String(candidate.status))
        && (op.id !== "marketing.bulk-create.jobs.retry" || Number(candidate.failedItems) > 0));
    }
  const selectingCampaignSlot = ["marketing.campaign.slot.reject", "marketing.campaign.slot.retry", "marketing.campaign.slot.approve", "marketing.campaign.slot.publish-now", "marketing.campaign.slot.content.update"].includes(op.id)
      && field.reference === "marketing.campaign.calendar";
    const exact = candidates.filter(row => matchesReference(row, referenceSearch)
      || Boolean(field.referenceValueKey && String(row[field.referenceValueKey] || "") === referenceSearch));
    const record = exact.length === 1 ? exact[0] : undefined;
    const value = record && (field.referenceValueKey ? record[field.referenceValueKey] : record.id || record._id || record[field.key]);
    if (exact.length !== 1 || !record || !value) {
      const choices = candidates.slice(0, 8).map(referenceLabel).join("; ");
      const payrollDraftPeriod = op.id === "payroll.run.reconciliation.publish" && field.key === "path_id"
        && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(search) ? `kỳ ${search}` : "";
      if (payrollDraftPeriod && exact.length === 0) {
        addUnresolvedReferenceError(field.key,
          `Không tìm thấy lượt lương nháp cho ${payrollDraftPeriod} trong phạm vi hiện tại. Chỉ lượt nháp có dữ liệu mới nhất và không còn lỗi chặn mới phát hành được.`);
        continue;
      }
      const explanation = confirmingReferral && !candidates.length
        ? "chỉ có thể xác nhận referral đang chờ"
        : importingInvoiceTax && !candidates.length ? "chỉ có thể ghi nhận VAT từ hóa đơn đã phát hành trong chi nhánh đã chọn"
        : reversingStockLog && !candidates.length ? "chỉ có thể đảo phiếu xuất thủ công nội bộ hoặc hủy hàng chưa bị đảo"
        : exact.length > 1 ? "có nhiều bản ghi trùng tên" : "chưa tìm thấy bản ghi theo tên hoặc mã";
      addUnresolvedReferenceError(field.key, `${field.label}: ${explanation}. Vui lòng nêu tên chính xác${choices ? `; có thể chọn ${choices}` : ""}.`);
      continue;
    }
    if (op.id === "finance.treasury.bank-lines.create" && field.key === "accountId" && record.kind !== "bank") {
      addUnresolvedReferenceError(field.key, `${field.label}: hãy chọn một tài khoản ngân hàng, không phải quỹ tiền mặt.`);
      continue;
    }
    if (op.id === "timekeeping.work-calendar.update" && field.key === "path_id") {
      const editsAdminManagedFields = ["date", "name", "dayType"].some(key => values[key] !== undefined);
      if (editsAdminManagedFields && record.calendarSource !== "admin") {
        errors.push("Ngày lễ do hệ thống tạo chỉ cho phép bật hoặc tắt áp dụng; không thể đổi ngày, tên hoặc loại.");
        continue;
      }
      if (values.isApplied === false && !String(values.adminReason || "").trim()) {
        errors.push("Khi tắt áp dụng một ngày trong lịch, vui lòng nêu lý do.");
        continue;
      }
    }
    resolved[field.key] = String(value);
    labels[field.key] = selectingCampaignSlot && field.referenceValueKey === "campaignId"
      ? String(record.campaignTitle || "Chiến dịch")
      : referenceLabel(record);
    resolvedReferences[field.key] = record;
    if (field.reference === "omni-inbox.account.list" && field.apiKey === "pageId"
      && op.id.startsWith("marketing.lead-intake-profile.") && typeof record.platform === "string") {
      const platformField = op.fields.find(candidate => candidate.apiKey === "platform");
      if (platformField) {
        const normalizedPlatform = record.platform.toLocaleLowerCase();
        const requestedPlatform = values[platformField.key];
        if (requestedPlatform !== undefined && String(requestedPlatform).toLocaleLowerCase() !== normalizedPlatform) {
          addUnresolvedReferenceError(field.key, `${field.label}: kênh đã chọn không khớp tài khoản mạng xã hội. Hãy chọn tài khoản thuộc đúng kênh.`);
          delete resolved[field.key];
          delete resolvedReferences[field.key];
          continue;
        }
        resolved[platformField.key] = normalizedPlatform;
        labels[platformField.key] = record.platform;
      }
    }
    const configuredConfirmationDetails = op.confirmationDetails?.[field.key] || [];
    if (configuredConfirmationDetails.length) {
      confirmationDetails[field.key] = configuredConfirmationDetails.flatMap(detail => {
        if (!referenceOperation?.resultFields.includes(detail.key)) return [];
        const value = record[detail.key];
        if (!["string", "number", "boolean"].includes(typeof value)) return [];
        return [{ label: detail.label, value: String(value) }];
      });
    }
    if (op.path === "/payments" && field.apiKey === "studentId" && typeof record.fullName === "string") {
      resolved.studentName = record.fullName;
      labels.studentName = record.fullName;
    }
    if (op.id === "worker.update" && field.key === "path_id") {
      for (const key of ["fullName", "status"] as const) {
        if (values[key] === undefined && typeof record[key] === "string") {
          resolved[key] = record[key];
          labels[key] = key === "fullName" ? "Tên hiện tại (giữ nguyên)" : "Trạng thái hiện tại (giữ nguyên)";
        }
      }
    }
    if (op.id === "payroll.employee.reconciliation.action" && field.key === "path_id") {
      if (Number.isSafeInteger(record.version) && Number(record.version) >= 0) {
        resolved.expectedVersion = Number(record.version);
        labels.expectedVersion = "Phiên bản đối soát hiện tại (tự lấy từ hồ sơ)";
      } else errors.push("Không đọc được phiên bản đối soát lương của kỳ đã chọn; chưa thể xác nhận hoặc gửi trao đổi.");
      if (values.action === "reply") {
        const requestedField = normalize(String(values.field || ""));
        const issueMatches = ((record as any).__assistantIssues || []).filter((issue: any) => {
          const field = String(issue.field || "");
          return normalize(field) === requestedField || normalize(payrollReconciliationFieldLabels[field] || "") === requestedField;
        });
        if (issueMatches.length === 1) resolved.issueId = String(issueMatches[0].id);
        else errors.push(`Không tìm thấy một khiếu nại đang mở cho khoản lương đã chọn${record.openIssueFields ? ` (${record.openIssueFields})` : ""}. Hãy chọn đúng khoản lương đang trao đổi.`);
      }
    }
    if (op.id === "inventory.serial.create" && field.key === "productId" && typeof record.name === "string") resolved.productName = record.name;
    if (op.path === "/finance/reporting/debts/:id/payments" && field.key === "path_id" && values.version === undefined && typeof record.version === "number") resolved.version = record.version;
    if (op.id === "customer.transaction.detail" && field.key === "sourceId") {
      if (typeof record.kind === "string") resolved.kind = record.kind;
      if (typeof record.eventId === "string" && record.eventId) resolved.eventId = record.eventId;
    }
    if (op.id === "department.update" && field.key === "id" && !resolved.name && record.name) resolved.name = record.name;
  }
  if (op.id === "inventory.serial.transfer.local" && resolvedReferences.path_id && resolvedReferences.path_id.status !== "in_stock") {
    errors.push("Chỉ chuyển được IMEI hoặc serial đang ở trạng thái trong kho; chưa tạo chứng từ điều chuyển.");
  }
  const selectedPayrollPaymentRun = resolvedReferences.query_id;
  if (op.id === "payroll.payment.confirm" && selectedPayrollPaymentRun && selectedPayrollPaymentRun.status !== "closed") {
    errors.push("Chỉ xác nhận thanh toán trong lượt lương đang ở trạng thái đã chốt; chưa gửi yêu cầu thay đổi.");
  }
  if (op.id === "payroll.payment.reverse" && selectedPayrollPaymentRun && !["closed", "paid"].includes(String(selectedPayrollPaymentRun.status))) {
    errors.push("Chỉ đảo thanh toán trong lượt lương đang chốt hoặc đã thanh toán; chưa gửi yêu cầu thay đổi.");
  }
  if (["marketing.campaign.slot.reject", "marketing.campaign.slot.retry", "marketing.campaign.slot.approve"].includes(op.id)
    && resolvedReferences.path_id && resolvedReferences.path_slotId) {
    const campaignId = String(resolvedReferences.path_id.campaignId || resolvedReferences.path_id.id || "");
    const slotCampaignId = String(resolvedReferences.path_slotId.campaignId || "");
    if (!campaignId || campaignId !== slotCampaignId) {
      errors.push(op.id === "marketing.campaign.slot.reject"
        ? "Chiến dịch và slot đã chọn không khớp; chưa từ chối nội dung nào."
        : op.id === "marketing.campaign.slot.retry"
          ? "Chiến dịch và slot đã chọn không khớp; chưa đưa nội dung vào hàng đợi thử lại."
          : "Chiến dịch và slot đã chọn không khớp; chưa duyệt nội dung nào.");
    }
  }
  const branchScopedOperation = isBranchScopedAssistantOperation(op);
  if (branchScopedOperation) {
    const branchField = op.fields.find(field => field.source === "query" && ["branchId", "targetBranch"].includes(String(field.apiKey || field.key)));
    const selectedBranch = branchField ? String(resolved[branchField.key] || "") : "";
    if (!selectedBranch && req.user?.branchId && branchField) resolved[branchField.key] = req.user.branchId;
    else if (!selectedBranch && req.user?.role === "admin" && requiresBranchChoice(op) && isRetailAfterSaleOperation(op)) errors.push(op.method === "POST" ? "Chi nhánh bán lẻ: hãy nêu tên chi nhánh cần lập phiếu đổi trả hoặc thu mua." : "Chi nhánh bán lẻ: hãy nêu tên chi nhánh cần tra cứu chứng từ đổi trả hoặc thu mua.");
    else if (!selectedBranch && req.user?.role === "admin" && requiresBranchChoice(op) && isRetailReceivableOperation(op)) errors.push("Chi nhánh bán lẻ: hãy nêu tên chi nhánh cần xem hoặc đối soát công nợ.");
    else if (!selectedBranch && req.user?.role === "admin" && requiresBranchChoice(op) && (op.id === "retail.coupon.create" || op.id === "retail.coupon.tier.list")) errors.push(op.id === "retail.coupon.create" ? "Chi nh\u00E1nh b\u00E1n l\u1EBB: h\u00E3y n\u00EAu t\u00EAn chi nh\u00E1nh c\u1EA7n t\u1EA1o m\u00E3 \u01B0u \u0111\u00E3i." : "Chi nh\u00E1nh b\u00E1n l\u1EBB: h\u00E3y n\u00EAu t\u00EAn chi nh\u00E1nh c\u1EA7n tra c\u1EE9u h\u1EA1ng kh\u00E1ch h\u00E0ng.");
    else if (!selectedBranch && req.user?.role === "admin" && requiresBranchChoice(op)) errors.push(isRecruitmentOperation(op) ? "Chi nhánh tuyển dụng: hãy nêu tên chi nhánh cần tra cứu hoặc cập nhật." : op.id.startsWith("inventory.serial.") ? "Chi nhánh: hãy nêu tên chi nhánh cần tra cứu hoặc đăng ký IMEI/serial." : op.id === "inventory.warehouse.locations.list" ? "Chi nhánh kho: hãy nêu tên chi nhánh cần tra cứu kho." : op.path.startsWith("/inventory/transfers") ? "Chi nhánh điều chuyển: hãy nêu tên chi nhánh gửi hoặc nhận." : isInventoryCountOperation(op) ? "Chi nhánh kiểm kê: hãy nêu tên chi nhánh cần tra cứu hoặc cập nhật phiếu." : op.path.startsWith("/inventory/reconciliation/") ? "Chi nhánh kiểm kho: hãy nêu tên chi nhánh cần đối soát." : op.path.startsWith("/finance/reminders/") ? "Chi nhánh tài chính: hãy nêu tên chi nhánh cần rà soát công nợ quá hạn." : op.path.startsWith("/finance/management/") || op.path.startsWith("/finance/receivables") || op.path.startsWith("/finance/reporting/") ? "Chi nhánh tài chính: hãy nêu tên chi nhánh cần tra cứu hoặc thao tác." : op.path.startsWith("/payroll/periods/") ? "Chi nhánh bảng lương: hãy nêu tên chi nhánh cần xem hoặc thao tác kỳ lương." : op.path.startsWith("/retail/debt-reminders/") ? "Chi nhánh bán lẻ: hãy nêu tên chi nhánh cần xem hoặc chạy nhắc công nợ." : isRetailFinanceCommissionOperation(op) ? "Chi nhánh bán lẻ: hãy nêu tên chi nhánh cần xem hoặc cấu hình hoa hồng POS." : op.path === "/retail/settings" || isRetailPosOperation(op) ? "Chi nhánh bán lẻ: hãy nêu tên chi nhánh cần thao tác." : "Chi nhánh áp dụng: hãy nêu tên chi nhánh cần cấu hình cấp bậc hoa hồng.");
    else if (!selectedBranch && requiresBranchChoice(op)) errors.push("Tài khoản cần được gán vào một chi nhánh trước khi thực hiện thao tác này.");
    else if (req.user?.branchId && selectedBranch !== req.user.branchId) errors.push("Chi nhánh được chọn không khớp với chi nhánh của tài khoản.");
  }
  if (["retail.shift.pause", "retail.shift.resume"].includes(op.id) && !errors.length) {
    const currentShiftOp = operationById("retail.shift.current");
    const deviceId = typeof req.headers["x-device-id"] === "string" ? req.headers["x-device-id"].trim() : "";
    if (!deviceId || deviceId.length > 150) errors.push("Không xác định được thiết bị POS hiện tại. Hãy mở trợ lý trên thiết bị POS đang đăng nhập rồi thử lại.");
    else if (!currentShiftOp) errors.push("Thiếu thao tác tra cứu ca POS hiện tại.");
    else {
      const branchField = op.fields.find(field => field.source === "query" && field.apiKey === "branchId");
      const branchValues = branchField && resolved[branchField.key] !== undefined ? { [branchField.key]: resolved[branchField.key] as AssistantValue } : {};
      try {
        const shift = (await callOperation(req, currentShiftOp, branchValues))?.data;
        const shiftId = String(shift?._id || shift?.id || "");
        if (!shift || shift.status !== "open" || !/^[a-f\d]{24}$/i.test(shiftId)) errors.push("Không tìm thấy ca POS đang mở của bạn trong chi nhánh đã chọn.");
        else if (op.id === "retail.shift.pause" && !shift.terminalId) errors.push("Ca POS của bạn hiện đã được tạm dừng.");
        else if (op.id === "retail.shift.pause" && String(shift.terminalId) !== deviceId) errors.push("Ca POS của bạn đang hoạt động trên thiết bị khác. Hãy mở trợ lý trên thiết bị đó để tạm dừng ca.");
        else if (op.id === "retail.shift.resume" && String(shift.terminalId || "") === deviceId) errors.push("Ca POS của bạn đang hoạt động trên thiết bị hiện tại.");
        else {
          resolved.path_id = shiftId;
          labels.path_id = String(shift.shiftCode || "Ca POS đang mở của bạn");
          if (op.id === "retail.shift.resume") {
            resolved.terminalId = deviceId;
            resolved.expectedTerminalId = String(shift.terminalId || "");
          }
        }
      } catch {
        errors.push("Không thể xác minh ca POS hiện tại của bạn; chưa thực hiện thay đổi.");
      }
    }
  }
  if (op.id === "recruitment.interview.create" && resolved.applicantId && !resolved.jobId && !errors.length) {
    const applicantDetail = operationById("recruitment.applicant.detail");
    if (!applicantDetail) errors.push("Thiếu thao tác đọc hồ sơ ứng viên để xác định vị trí tuyển dụng.");
    else {
      try {
        const branchField = op.fields.find(field => field.source === "query" && field.apiKey === "branchId");
        const branchValues = branchField && resolved[branchField.key] !== undefined ? { [branchField.key]: resolved[branchField.key] as AssistantValue } : {};
        const applicant = (await callOperation(req, applicantDetail, { ...branchValues, path_id: String(resolved.applicantId) }))?.data;
        const jobId = applicant?.jobId ? String(applicant.jobId) : "";
        if (!jobId) errors.push("Không xác định được vị trí tuyển dụng gắn với ứng viên đã chọn.");
        else {
          resolved.jobId = jobId;
          const jobDetail = operationById("recruitment.job.detail");
          const job = jobDetail ? (await callOperation(req, jobDetail, { ...branchValues, path_id: jobId }))?.data : undefined;
          labels.jobId = String(job?.title || job?.code || "Vị trí từ hồ sơ ứng viên");
        }
      } catch { errors.push("Không thể đọc hồ sơ ứng viên để xác định vị trí tuyển dụng; chưa tạo lịch phỏng vấn."); }
    }
  }
  if (op.id === "retail.points.policy.update") {
    const editableKeys = ["enabled", "earnVndPerPoint", "redeemVndPerPoint", "maxRedeemPercent"];
    if (!editableKeys.some(key => values[key] !== undefined)) errors.push("Nêu ít nhất một trường chính sách tích điểm cần thay đổi.");
    const policyList = operationById("retail.points.policy.get");
    if (!policyList) errors.push("Không tìm thấy thao tác đọc chính sách tích điểm hiện tại.");
    else {
      try {
        const current = await callOperation(req, policyList, {});
        const policy = current?.data;
        for (const key of editableKeys) if (resolved[key] === undefined && policy?.[key] !== undefined) resolved[key] = policy[key];
        if (Number.isSafeInteger(policy?.version) && policy.version >= 0) resolved.version = policy.version;
        else errors.push("Không đọc được phiên bản chính sách tích điểm hiện tại; chưa thể cập nhật an toàn.");
      } catch { errors.push("Không thể đọc chính sách tích điểm hiện tại; chưa thể cập nhật an toàn."); }
    }
  }
  if (op.path === "/finance/reporting/vat/period" && values.version === undefined && typeof values.period === "string") {
    const list = operationById("finance.vat.list");
    if (!list) errors.push("Không tìm thấy workflow tra cứu kỳ VAT để lấy phiên bản hiện tại.");
    else {
      const current = await callOperation(req, list, { query_period: values.period });
      const version = current?.data?.settings?.version;
      if (Number.isSafeInteger(version) && version >= 0) resolved.version = version;
      else errors.push("Không lấy được phiên bản hiện tại của kỳ VAT; chưa thể cập nhật.");
    }
  }
  for (const field of op.fields) {
    if (field.type !== "json" || field.source !== "body" || values[field.key] === undefined || !field.structure) continue;
    let parsed: any;
    let display: any;
    try { parsed = JSON.parse(String(values[field.key])); display = JSON.parse(String(values[field.key])); }
    catch { continue; } // Structured validation reports malformed JSON before execution.
    const resolveNode = async (node: any, displayNode: any, shape: NonNullable<AssistantField["structure"]>, parents: Record<string, any>, path: string): Promise<any> => {
      if (Array.isArray(node)) {
        for (let index = 0; index < node.length; index++) node[index] = await resolveNode(node[index], displayNode?.[index], shape.items || { type: "unknown" }, parents, `${path}[${index}]`);
        return node;
      }
      if (typeof node === "string" && shape.reference && node.trim()) {
        const search = node.trim();
        const context: Record<string, AssistantValue> = { ...(shape.referenceContext || {}) };
        const referenceOperation = operationById(shape.reference);
        if (isRecruitmentOperation(op) && shape.reference === "employee.list" && resolved.branchId !== undefined) context.branchId = String(resolved.branchId);
        else {
          const selectedBranch = op.fields.find(candidate => candidate.source === "query" && candidate.apiKey === "branchId");
          const referenceBranch = referenceOperation?.fields.find(candidate => candidate.source === "query" && candidate.apiKey === "branchId");
          if (selectedBranch && referenceBranch && resolved[selectedBranch.key] !== undefined) context[referenceBranch.key] = String(resolved[selectedBranch.key]);
        }
        let parentValue = shape.referenceParentKey ? parents[shape.referenceParentKey] ?? resolved[shape.referenceParentKey] : undefined;
        const parentField = shape.referenceParentKey ? op.fields.find(candidate => candidate.key === shape.referenceParentKey) : undefined;
        if (parentValue !== undefined && parentField?.reference && !isRecordIdentifier(String(parentValue))) {
          const parentSearch = String(parentValue);
          const parentCandidates = (await lookupRecords(req, parentField.reference, parentSearch)).filter(row => matchesReference(row, parentSearch));
          if (parentCandidates.length !== 1) {
            errors.push(`${nestedReferenceLabel(shape, path)}: trước hết cần chọn đúng bản ghi liên quan.`);
            return node;
          }
          const parentRecord = parentCandidates[0];
          parentValue = parentField.referenceValueKey ? parentRecord[parentField.referenceValueKey] : parentRecord.id || parentRecord._id || parentRecord.uid;
        }
        const parentApiKey = parentField?.apiKey;
        const pathFields = (referenceOperation?.fields || []).filter(candidate => candidate.source === "path");
        const queryFields = (referenceOperation?.fields || []).filter(candidate => candidate.source === "query");
        const parentPathField = parentValue === undefined ? undefined
          : pathFields.find(candidate => parentApiKey && candidate.apiKey === parentApiKey)
            || (pathFields.length === 1 ? pathFields[0] : undefined);
        const parentQueryField = parentValue === undefined || parentPathField ? undefined
          : queryFields.find(candidate => parentApiKey && candidate.apiKey === parentApiKey)
            || (parentField?.key === "targetBranch" ? queryFields.find(candidate => candidate.apiKey === "branchId") : undefined)
            || (queryFields.length === 1 ? queryFields[0] : undefined);
        if (parentPathField) context[parentPathField.key] = String(parentValue);
        else if (parentQueryField) context[parentQueryField.key] = String(parentValue);
        const referenceField: AssistantField = { key: path, label: shape.label || path, type: "reference", reference: shape.reference, ...(shape.referenceValueKey ? { referenceValueKey: shape.referenceValueKey } : {}), ...(shape.referenceContext ? { referenceContext: shape.referenceContext } : {}) };
        const { candidates, exact, record, value } = await resolveOperationReference(req, op, referenceField, search, context, path);
        const label = nestedReferenceLabel(shape, path);
        if (exact.length !== 1 || !record || value === undefined || value === null || value === "") {
          const choices = candidates.slice(0, 8).map(referenceLabel).join("; ");
          addUnresolvedReferenceError(selectionPath(path), `${label}: ${exact.length > 1 ? "có nhiều bản ghi trùng tên" : "chưa tìm thấy bản ghi theo tên hoặc mã"}. Vui lòng nêu tên chính xác${choices ? `; có thể chọn ${choices}` : ""}.`);
          return node;
        }
        return String(value);
      }
      if (!node || typeof node !== "object" || shape.type !== "object") return node;
      for (const [key, childShape] of Object.entries(shape.keys || {})) {
        if (node[key] === undefined) continue;
        if (childShape.reference && typeof node[key] === "string" && String(node[key]).trim()) {
          const referenceOperation = operationById(childShape.reference);
          const context: Record<string, AssistantValue> = { ...(childShape.referenceContext || {}) };
          const selectedBranch = op.fields.find(candidate => candidate.source === "query" && candidate.apiKey === "branchId");
          const referenceBranch = referenceOperation?.fields.find(candidate => candidate.source === "query" && candidate.apiKey === "branchId");
          if (selectedBranch && referenceBranch && resolved[selectedBranch.key] !== undefined) context[referenceBranch.key] = String(resolved[selectedBranch.key]);
          if (isRecruitmentOperation(op) && childShape.reference === "employee.list" && resolved.branchId !== undefined) context.branchId = String(resolved.branchId);
          const parentValue = childShape.referenceParentKey ? node[childShape.referenceParentKey] ?? parents[childShape.referenceParentKey] ?? resolved[childShape.referenceParentKey] : undefined;
          if (childShape.referenceParentKey && parentValue === undefined) {
            if (!childShape.referenceParentOptional) {
              errors.push(`${nestedReferenceLabel(childShape, key)}: trước hết cần chọn ${childShape.referenceParentKey === "customerId" ? "khách hàng" : "bản ghi liên quan"}.`);
              continue;
            }
          }
          let resolvedParentValue = parentValue;
          const parentShape = childShape.referenceParentKey ? nestedShapeByKey(op, childShape.referenceParentKey) : undefined;
          if (resolvedParentValue !== undefined && parentShape?.reference && !isRecordIdentifier(String(resolvedParentValue))) {
            const parentSearch = String(resolvedParentValue);
            const exactParents = (await lookupRecords(req, parentShape.reference, parentSearch)).filter(row => matchesReference(row, parentSearch));
            const parentRecord = exactParents.length === 1 ? exactParents[0] : undefined;
            resolvedParentValue = parentRecord && (parentShape.referenceValueKey ? parentRecord[parentShape.referenceValueKey] : parentRecord.id || parentRecord._id || parentRecord.uid);
            if (resolvedParentValue === undefined || resolvedParentValue === null || resolvedParentValue === "") {
              errors.push(`${nestedReferenceLabel(childShape, key)}: trước hết cần chọn đúng bản ghi liên quan.`);
              continue;
            }
          }
          const pathParameters = referenceOperation?.fields.filter(candidate => candidate.source === "path") || [];
          const queryParameters = referenceOperation?.fields.filter(candidate => candidate.source === "query") || [];
          const parentPathParameter = resolvedParentValue === undefined ? undefined
            : pathParameters.find(candidate => candidate.apiKey === childShape.referenceParentKey) || (pathParameters.length === 1 ? pathParameters[0] : undefined);
          const parentQueryParameter = resolvedParentValue === undefined || parentPathParameter ? undefined
            : queryParameters.find(candidate => candidate.apiKey === childShape.referenceParentKey)
              || (queryParameters.length === 1 ? queryParameters[0] : undefined);
          if (parentPathParameter) context[parentPathParameter.key] = String(resolvedParentValue);
          else if (parentQueryParameter) context[parentQueryParameter.key] = String(resolvedParentValue);
          const search = String(node[key]);
          const referenceField: AssistantField = { key, label: childShape.label || key, type: "reference", reference: childShape.reference, ...(childShape.referenceValueKey ? { referenceValueKey: childShape.referenceValueKey } : {}), ...(childShape.referenceContext ? { referenceContext: childShape.referenceContext } : {}) };
          const { candidates, exact, record, value } = await resolveOperationReference(req, op, referenceField, search, context, key);
          const label = nestedReferenceLabel(childShape, key);
          if (exact.length !== 1 || !record || value === undefined || value === null || value === "") {
            const choices = candidates.slice(0, 8).map(referenceLabel).join("; ");
            addUnresolvedReferenceError(selectionPath(`${path}.${key}`), `${label}: ${exact.length > 1 ? "có nhiều bản ghi trùng tên" : "chưa tìm thấy bản ghi theo tên hoặc mã"}. Vui lòng nêu tên chính xác${choices ? `; có thể chọn ${choices}` : ""}.`);
          } else {
            node[key] = String(value);
            if (displayNode && typeof displayNode === "object") displayNode[key] = referenceLabel(record);
          }
        } else if (childShape.type === "object" || childShape.type === "array") {
          node[key] = await resolveNode(node[key], displayNode?.[key], childShape, { ...parents, ...node }, `${path}.${key}`);
        }
      }
      return node;
    };
    parsed = await resolveNode(parsed, display, field.structure, {}, field.key);
    if (field.key === "items" && Array.isArray(parsed)) await validateInventoryUnitIdentifiers(req, op, parsed, resolved, errors);
    resolved[field.key] = JSON.stringify(parsed);
    if (!(op.id === "hr.workflow.update" && field.key === "steps")) labels[field.key] = JSON.stringify(display, null, 2);
    if (["payroll.period.inputs.bulk", "payroll.period.line-overrides.bulk"].includes(op.id) && field.apiKey === "rows" && Array.isArray(parsed) && Array.isArray(display)) {
      const employeeNames: Record<string, string> = {};
      for (let index = 0; index < parsed.length; index++) {
        const employeeId = String(parsed[index]?.employeeId || "");
        const employeeName = String(display[index]?.employeeId || "").trim();
        if (employeeId && employeeName) employeeNames[employeeId] = employeeName;
      }
      resolved.__assistantEmployeeNames = JSON.stringify(employeeNames);
    }
  }
  if (op.id === "retail.after-sale.create" && !errors.length) {
    try {
      const detailOp = operationById("retail.order.detail");
      if (!detailOp) throw new Error("missing retail order detail");
      const branchField = op.fields.find(field => field.source === "query" && field.apiKey === "branchId");
      const branchValues = branchField && resolved[branchField.key] !== undefined ? { [branchField.key]: resolved[branchField.key] as AssistantValue } : {};
      const order = (await callOperation(req, detailOp, { ...branchValues, path_id: String(resolved.orderId || "") }))?.data;
      const orderVersion = Number(order?.version);
      if (!order || order.status !== "completed" || !["paid", "refunded"].includes(String(order.paymentStatus || ""))) {
        errors.push("Chỉ có thể đổi trả hoặc thu mua từ đơn đã hoàn tất và thanh toán đủ.");
      } else if (!Number.isSafeInteger(orderVersion) || orderVersion < 0) {
        errors.push("Không đọc được phiên bản đơn bán hiện tại; chưa thể chuẩn bị phiếu hậu mãi an toàn.");
      } else {
        let requested: any[] = [];
        try { requested = JSON.parse(String(resolved.items || "[]")); } catch { requested = []; }
        const history = Array.isArray(order.afterSales) ? order.afterSales : [];
        const lineIndexes = new Set<number>();
        const mapped: any[] = [];
        const summary: string[] = [];
        const kind = String(resolved.type || "");
        let totalAmount = 0;
        if (!Array.isArray(order.items) || !Array.isArray(requested) || !requested.length) errors.push("Không đọc được các dòng sản phẩm của đơn bán hoặc danh sách sản phẩm cần xử lý.");
        for (const row of requested) {
          if (!row || typeof row !== "object" || typeof row.sku !== "string") { errors.push("Mỗi sản phẩm cần được chọn theo tên hoặc SKU trong đơn bán gốc."); continue; }
          const matches = order.items.map((item: any, index: number) => ({ item, index })).filter(({ item }: any) => String(item.sku || "") === String(row.sku));
          if (matches.length !== 1) { errors.push(`${String(row.sku)}: không xác định được duy nhất một dòng sản phẩm trong đơn bán gốc.`); continue; }
          const { item: source, index } = matches[0];
          if (lineIndexes.has(index)) { errors.push(`${String(source.productName || source.sku)}: sản phẩm bị lặp trong danh sách.`); continue; }
          lineIndexes.add(index);
          const quantity = Number(row.quantity);
          const prior = history.flatMap((document: any) => Array.isArray(document?.items) ? document.items : []).filter((entry: any) => Number(entry.orderLineIndex) === index);
          const usedQuantity = prior.reduce((sum: number, entry: any) => sum + Number(entry.quantity || 0), 0);
          const remainingQuantity = Math.max(0, Number(source.quantity || 0) - usedQuantity);
          if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > remainingQuantity) {
            errors.push(`${String(source.productName || source.sku)}: còn ${remainingQuantity} sản phẩm có thể đổi trả hoặc thu mua; số lượng yêu cầu chưa hợp lệ.`);
            continue;
          }
          const processedSerials = new Set(prior.flatMap((entry: any) => Array.isArray(entry.serialNumbers) ? entry.serialNumbers.map((value: unknown) => normalize(String(value))) : []));
          const processedBarcodes = new Set(prior.flatMap((entry: any) => Array.isArray(entry.internalBarcodes) ? entry.internalBarcodes.map((value: unknown) => normalize(String(value))) : []));
          const availableSerials = (Array.isArray(source.serialNumbers) ? source.serialNumbers : []).map(String).filter((value: string) => !processedSerials.has(normalize(value)));
          const availableBarcodes = (Array.isArray(source.internalBarcodes) ? source.internalBarcodes : []).map(String).filter((value: string) => !processedBarcodes.has(normalize(value)));
          let serialNumbers = Array.isArray(row.serialNumbers) ? [...new Set(row.serialNumbers.map(String))] : [];
          let internalBarcodes = Array.isArray(row.internalBarcodes) ? [...new Set(row.internalBarcodes.map(String))] : [];
          if (source.trackingMode === "serial") {
            if (!serialNumbers.length && quantity === remainingQuantity && availableSerials.length === remainingQuantity) serialNumbers = availableSerials;
            if (serialNumbers.length !== quantity || serialNumbers.some((value: string) => !availableSerials.some((candidate: string) => normalize(candidate) === normalize(value)))) {
              errors.push(`${String(source.productName || source.sku)}: cần chọn đúng ${quantity} IMEI/serial còn trong đơn (${availableSerials.join(", ") || "không đọc được mã còn khả dụng"}).`);
              continue;
            }
          } else if (source.trackingMode === "unit_barcode") {
            if (!internalBarcodes.length && quantity === remainingQuantity && availableBarcodes.length === remainingQuantity) internalBarcodes = availableBarcodes;
            if (internalBarcodes.length !== quantity || internalBarcodes.some((value: string) => !availableBarcodes.some((candidate: string) => normalize(candidate) === normalize(value)))) {
              errors.push(`${String(source.productName || source.sku)}: cần chọn đúng ${quantity} mã nội bộ còn trong đơn (${availableBarcodes.join(", ") || "không đọc được mã còn khả dụng"}).`);
              continue;
            }
          } else if (serialNumbers.length || internalBarcodes.length) {
            errors.push(`${String(source.productName || source.sku)} không quản lý IMEI hoặc mã nội bộ; hãy bỏ danh sách mã máy.`);
            continue;
          }
          const originalUnitPrice = Number(source.lineTotal) / Number(source.quantity);
          const merchandiseRefundPool = Math.min(Number(order.subtotal), Math.max(0, Number(order.grandTotal) - Number(order.shippingFee || 0)));
          const unitAmount = kind === "return"
            ? Math.floor(originalUnitPrice * (Number(order.subtotal) > 0 ? merchandiseRefundPool / Number(order.subtotal) : 0))
            : Number(row.unitAmount);
          if (!Number.isSafeInteger(unitAmount) || unitAmount < 0 || (kind === "buyback" && row.unitAmount === undefined)) {
            errors.push(`${String(source.productName || source.sku)}: ${kind === "buyback" ? "cần nêu giá thu mua mỗi sản phẩm bằng VND nguyên không âm" : "không tính được giá hoàn từ đơn gốc"}.`);
            continue;
          }
          const lineAmount = unitAmount * quantity;
          totalAmount += lineAmount;
          mapped.push({ orderLineIndex: index, quantity, unitAmount, serialNumbers, internalBarcodes, condition: String(row.condition || "good"), ...(row.note ? { note: String(row.note) } : {}) });
          const ids = serialNumbers.length ? `; IMEI ${serialNumbers.join(", ")}` : internalBarcodes.length ? `; mã ${internalBarcodes.join(", ")}` : "";
          summary.push(`${quantity} × ${String(source.productName || source.sku)} (${source.sku}) — ${new Intl.NumberFormat("vi-VN").format(unitAmount)} ₫/sp, thành tiền ${new Intl.NumberFormat("vi-VN").format(lineAmount)} ₫${ids}`);
        }
        if (!errors.length && totalAmount <= 0) errors.push("Tổng tiền hoàn/thu mua phải lớn hơn 0.");
        if (!errors.length) {
          resolved.expectedVersion = orderVersion;
          resolved.__assistantAfterSaleItems = JSON.stringify(mapped);
          labels.expectedVersion = `Phiên bản hiện tại của đơn ${String(order.orderCode || "đơn bán")}`;
          labels.items = `${summary.join("\n")}\nTổng tiền hoàn/thu mua: ${new Intl.NumberFormat("vi-VN").format(totalAmount)} ₫`;
          labels.orderId = `${String(order.orderCode || "Đơn bán")} · ${String(order.customerName || "Khách lẻ")}`;
          if (resolved.paymentMethod === "cash") {
            const selectorKey = "shiftSelector";
            const selectedShift = resolvedReferences[selectorKey];
            if (selectedShift && selectedShift.status !== "open") errors.push("Ca POS đã chọn không còn mở. Hãy chọn một ca đang mở.");
            else if (selectedShift) {
              resolved.cashSessionId = String(selectedShift.id || "");
              labels.shiftSelector = referenceLabel(selectedShift);
            } else {
              const currentShiftOp = operationById("retail.shift.current");
              const currentShift = currentShiftOp ? (await callOperation(req, currentShiftOp, branchValues))?.data : undefined;
              if (currentShift?.status === "open" && /^[a-f\d]{24}$/i.test(String(currentShift._id || currentShift.id || ""))) {
                resolved.cashSessionId = String(currentShift._id || currentShift.id);
                resolved.shiftSelector = resolved.cashSessionId;
                labels.shiftSelector = `${String(currentShift.shiftCode || "Ca POS đang mở")} · ${String(currentShift.cashierName || "thu ngân hiện tại")}`;
              } else {
                const choices = (await lookupRecords(req, "retail.shift.list", "", { ...branchValues, query_status: "open" })).slice(0, 8).map(referenceLabel).join("; ");
                errors.push(choices
                  ? `Hoàn/chi tiền mặt cần chọn ca POS đang mở theo mã ca hoặc thu ngân: ${choices}.`
                  : "Hoàn/chi tiền mặt cần ca POS đang mở trong chi nhánh đã chọn; hiện không đọc được ca nào đang mở.");
              }
            }
            if (resolved.cashSessionId === undefined && !errors.length) errors.push("Chưa xác định được ca POS để ghi nhận hoàn/chi tiền mặt.");
          }
        }
      }
    } catch {
      errors.push("Không thể kiểm tra đơn bán, sản phẩm còn được xử lý hoặc ca POS; chưa chuẩn bị phiếu hậu mãi.");
    }
  }
  if (op.id === "finance.treasury.bank-lines.create" && Number(resolved.amount) === 0) errors.push("Số tiền giao dịch ngân hàng không được bằng 0; tiền vào ghi số dương, tiền ra ghi số âm.");
  if (op.id === "finance.treasury.reconciliation.create" && resolved.version === undefined && !errors.length) {
    const account = resolvedReferences.accountId;
    const version = Number(account?.version);
    if (Number.isSafeInteger(version) && version >= 0) {
      resolved.version = version;
      labels.version = "Phiên bản số dư hiện tại (được lấy tự động)";
    } else errors.push("Không đọc được phiên bản số dư của tài khoản đã chọn; chưa thể ghi nhận đối soát an toàn.");
  }
  if (op.id === "finance.treasury.period.update" && resolved.version === undefined && !errors.length) {
    try {
      const branchField = op.fields.find(field => field.source === "query" && field.apiKey === "branchId");
      const branchValues = branchField && resolved[branchField.key] !== undefined ? { [branchField.key]: resolved[branchField.key] as AssistantValue } : {};
      const periods = await lookupRecords(req, "finance.treasury.periods.list", String(resolved.month || ""), branchValues);
      const period = periods.find(record => String(record.month || "") === String(resolved.month || ""));
      if (resolved.action === "reopen" && period?.status !== "closed") errors.push("Chỉ có thể mở lại kỳ đang ở trạng thái đã chốt.");
      else if (!period && resolved.action === "reopen") errors.push("Không tìm thấy kỳ đã chốt theo tháng đã nêu.");
      else {
        const version = period ? Number(period.version) : 0;
        if (!Number.isSafeInteger(version) || version < 0) throw new Error("invalid period version");
        resolved.version = version;
        labels.version = "Phiên bản kỳ hiện tại (được lấy tự động)";
      }
    } catch {
      errors.push("Không đọc được kỳ tài chính hiện tại; chưa thể chốt hoặc mở lại kỳ an toàn.");
    }
  }
  if (op.adapter === "contract") for (const field of op.fields) {
    if (op.id.startsWith("marketing.chat-flow.")) continue;
    if (field.source !== "path" || values[field.key] === undefined || (!field.reference && !collectionPathFor(op, field))) continue;
    if (["marketing.campaign.slot.reject", "marketing.campaign.slot.retry", "marketing.campaign.slot.approve", "marketing.campaign.slot.publish-now", "marketing.campaign.slot.content.update"].includes(op.id)
      && field.reference === "marketing.campaign.calendar") continue;
    const branchScopedOperation = isBranchScopedAssistantOperation(op);
    const branchField = branchScopedOperation ? op.fields.find(candidate => candidate.source === "query" && candidate.apiKey === "branchId") : undefined;
    if (branchField && !resolved[branchField.key]) continue;
    const search = String(values[field.key]);
    const needsExpectedVersion = Boolean(op.systemBodyFields?.includes("expectedVersion")) && op.id !== "payroll.period.input.update";
    const needsExpectedRevision = Boolean(op.systemBodyFields?.includes("expectedRevision"))
      && field.reference === "marketing.campaign.asset-orders.list";
    const needsVersion = Boolean(op.systemBodyFields?.includes("version") && !isRecruitmentOperation(op));
    const needsRevision = Boolean(op.systemBodyFields?.includes("revision"));
    const needsReferenceRecord = needsExpectedVersion || needsExpectedRevision || needsVersion || needsRevision || Boolean(op.mergeBodyWithReference) || op.id === "hr.workflow.update";
    // A declared reference may resolve to a version, code or other non-ObjectId.
    // Do not re-resolve it as a generic collection ID after the scoped lookup succeeded.
    if ((isRecordIdentifier(search) || resolvedReferences[field.key]) && !needsReferenceRecord) continue;
    const reference = await loadPathReferenceRows(req, op, field, resolved);
    if (!reference) continue;
    const acceptingIncomingSerial = op.id === "inventory.serial.transfer.accept";
    const receiveBranchId = String(resolved.targetBranch || req.user?.branchId || "");
    let eligible = reference.rows.filter(row => (!row.companyCode || row.companyCode === req.user?.companyCode)
      && (!req.user?.branchId || !row.branchId || String(row.branchId) === req.user.branchId
        || (acceptingIncomingSerial && row.status === "in_transit" && String(row.transferToBranchId || "") === req.user.branchId))
      && (!acceptingIncomingSerial || (row.status === "in_transit" && receiveBranchId && String(row.transferToBranchId || "") === receiveBranchId)));
    if (op.path.startsWith("/payroll/periods/") && field.reference === "employee.list") {
      const payrollBranchId = String(resolved.targetBranch || req.user?.branchId || "");
      if (payrollBranchId) eligible = eligible.filter(row => String(row.branchId || "") === payrollBranchId);
    }
    if (op.id === "payroll.run.payslips.publish" && field.apiKey === "id") {
      eligible = eligible.filter(row => ["closed", "paid"].includes(String(row.status)));
    }
    if (op.id === "payroll.run.reconciliation.publish" && field.apiKey === "id") {
      eligible = eligible.filter(row => String(row.status) === "draft");
    }
    if (payrollPaymentRequiredStatus[op.id] && field.apiKey === "id") {
      eligible = eligible.filter(row => String(row.status) === payrollPaymentRequiredStatus[op.id]);
    }
    if (op.method === "POST" && op.path.endsWith("/referrals/:referralId/confirm") && field.apiKey === "referralId") {
      eligible = eligible.filter(row => row.status === "pending");
    }
    if (op.id === "marketing.campaign.sheet.revisions.revert" && field.apiKey === "revisionId") {
      eligible = eligible.filter(row => Array.isArray(row.changes) && row.changes.length > 0 && !String(row.operation || "").startsWith("revert:"));
    }
    const exact = eligible.filter(row => isRecordIdentifier(search)
      ? String(row[field.apiKey!] || row._id || row.id || row.uid || row.__assistantRef?.id || "") === search
      : matchesReference(row, search));
    if (exact.length !== 1) {
      const choices = eligible.slice(0, 8).map(referenceLabel).join("; ");
      errors.push(`${field.label}: ${exact.length > 1 ? "có nhiều bản ghi trùng tên" : "chưa tìm thấy bản ghi theo tên hoặc mã"}. Vui lòng nêu tên chính xác${choices ? `; có thể chọn ${choices}` : ""}.`);
      continue;
    }
    const record = exact[0];
    const id = String(record[field.apiKey!] || record._id || record.id || record.uid || record.__assistantRef?.id || "");
    if (!id) {
      errors.push(`${field.label}: bản ghi không có mã nội bộ để thực hiện thao tác. Vui lòng kiểm tra dữ liệu bản ghi.`);
      continue;
    }
    resolved[field.key] = id;
    labels[field.key] = referenceLabel(record);
    if (op.id === "payroll.period.input.update" && field.apiKey === "employeeId") resolved.__assistantEmployeeName = referenceLabel(record);
    if (op.mergeBodyWithReference) resolved.__assistantExistingRecord = JSON.stringify(record.__assistantExistingRecord || record);
    if (op.id === "hr.workflow.update") {
      const existing = record.__assistantExistingRecord;
      if (!existing || typeof existing !== "object" || !Array.isArray(existing.steps)) {
        errors.push("Không đọc được các bước hiện tại của quy trình đã chọn; chưa cập nhật để tránh làm mất nội dung.");
      } else resolved.__assistantExistingRecord = JSON.stringify(existing);
    }
    if (needsExpectedVersion && resolved.expectedVersion === undefined) {
      const version = Number(record.version ?? record.__assistantRef?.version ?? record.__assistantRefVersion ?? record.__v);
      if (Number.isSafeInteger(version) && version >= 0) {
        resolved.expectedVersion = version;
        labels.expectedVersion = "Phiên bản hiện tại (được lấy tự động)";
      } else errors.push(`${field.label}: không đọc được phiên bản hiện tại; chưa thể ghi thay đổi an toàn.`);
    } else if (needsExpectedVersion && values.__assistantPinnedVersion === true) {
      const version = Number(record.version ?? record.__assistantRef?.version ?? record.__assistantRefVersion ?? record.__v);
      if (!Number.isSafeInteger(version) || version < 0) errors.push(`${field.label}: không đọc được phiên bản hiện tại; chưa thể ghi thay đổi an toàn.`);
      else if (Number(values.expectedVersion) !== version) errors.push("Phiếu kiểm kê đã thay đổi sau khi bạn xem bản xác nhận. Hãy gửi lại yêu cầu để kiểm tra chênh lệch mới.");
    }
    if (needsExpectedRevision && resolved.expectedRevision === undefined) {
      const revision = Number(record.revision ?? record.__assistantRef?.revision);
      if (Number.isSafeInteger(revision) && revision >= 0) {
        resolved.expectedRevision = revision;
        labels.expectedRevision = "Phiên bản Order hiện tại (tự lấy)";
      } else errors.push(`${field.label}: không đọc được phiên bản Order hiện tại; chưa thể ghi thay đổi an toàn.`);
    }
    if (needsVersion && resolved.version === undefined) {
      const version = Number(record.version ?? record.__assistantRef?.version ?? record.__v);
      if (Number.isSafeInteger(version) && version >= 0) {
        resolved.version = version;
        labels.version = "Phiên bản hiện tại (được lấy tự động)";
      } else errors.push(`${field.label}: không đọc được phiên bản hiện tại; chưa thể ghi thay đổi an toàn.`);
    }
    if (needsRevision && resolved.revision === undefined) {
      const revision = Number(record.revision ?? 0);
      if (Number.isSafeInteger(revision) && revision >= 0) {
        resolved.revision = revision;
        labels.revision = "Phiên bản công việc hiện tại (tự lấy)";
      } else errors.push(`${field.label}: không đọc được phiên bản hiện tại; chưa thể ghi thay đổi an toàn.`);
    }
  }
  if (op.id === "payroll.period.input.update" && !errors.length) {
    const readOperation = ASSISTANT_OPERATIONS.find(candidate => candidate.method === "GET" && candidate.path === "/payroll/periods/:periodKey/inputs");
    if (!readOperation) errors.push("Không tìm thấy thao tác đọc dữ liệu đầu vào của kỳ lương để kiểm tra phiên bản.");
    else {
      const readValues: Record<string, AssistantValue> = {};
      for (const field of readOperation.fields) {
        if (field.source === "path" && field.apiKey === "periodKey") {
          const periodField = op.fields.find(candidate => candidate.source === "path" && candidate.apiKey === "periodKey");
          if (periodField && resolved[periodField.key] !== undefined) readValues[field.key] = resolved[periodField.key];
        } else if (field.source === "query" && field.apiKey === "branchId") {
          const branchValue = resolved.targetBranch || req.user?.branchId;
          if (branchValue) readValues[field.key] = String(branchValue);
        }
      }
      const employeeId = String(resolved.path_employeeId || "");
      if (employeeId) readValues.__assistantEmployeeId = employeeId;
      if (typeof resolved.__assistantEmployeeName === "string") readValues.__assistantEmployeeName = resolved.__assistantEmployeeName;
      try {
        const current = await callOperation(req, readOperation, readValues);
        const currentRows = Array.isArray(current?.data) ? current.data : Array.isArray(current?.data?.items) ? current.data.items : [];
        const employeeInput = currentRows
          .find((item: any) => String(item?.__assistantRef?.id || "") === employeeId);
        const version = employeeInput ? Number(employeeInput.__assistantRef?.version) : 0;
        if (!Number.isSafeInteger(version) || version < 0) throw new Error("invalid payroll input version");
        resolved.expectedVersion = version;
        labels.expectedVersion = "Phiên bản dữ liệu lương hiện tại (tự lấy)";
      } catch {
        errors.push("Không đọc được dữ liệu lương hiện tại của nhân viên trong kỳ đã chọn; chưa thể cập nhật an toàn.");
      }
    }
  }
  if (op.id === "payroll.period.inputs.bulk" && !errors.length) {
    const readOperation = operationById("api.get.79f4d36088c00b86");
    let rows: any[] = [];
    try { rows = JSON.parse(String(resolved.rows || "[]")); } catch { rows = []; }
    if (!readOperation) errors.push("Không tìm thấy thao tác đọc dữ liệu đầu vào kỳ lương để kiểm tra phiên bản.");
    else if (!Array.isArray(rows) || rows.length < 1 || rows.length > 20) errors.push("Cập nhật lương hàng loạt cần từ 1 đến 20 nhân sự mỗi lần.");
    else {
      const employeeIds = rows.map(row => String(row?.employeeId || ""));
      if (employeeIds.some(id => !/^[a-f\d]{24}$/i.test(id)) || new Set(employeeIds).size !== employeeIds.length) {
        errors.push("Mỗi nhân sự phải được chọn đúng theo tên và không được lặp trong cùng yêu cầu.");
      } else if (rows.some(row => !["agreedSalary", "reconciledDays", "reconciledHours", "allowance", "bonus", "deduction"].some(key => row?.[key] !== undefined))) {
        errors.push("Mỗi nhân sự cần có ít nhất một khoản lương, ngày công hoặc giờ công cần cập nhật.");
      } else {
        const readValues: Record<string, AssistantValue> = {};
        for (const field of readOperation.fields) {
          if (field.source === "path" && field.apiKey === "periodKey") {
            const periodField = op.fields.find(candidate => candidate.source === "path" && candidate.apiKey === "periodKey");
            if (periodField && resolved[periodField.key] !== undefined) readValues[field.key] = resolved[periodField.key];
          } else if (field.source === "query" && field.apiKey === "branchId") {
            const branchValue = resolved.targetBranch || req.user?.branchId;
            if (branchValue) readValues[field.key] = String(branchValue);
          }
        }
        if (typeof resolved.__assistantEmployeeNames === "string") readValues.__assistantEmployeeNames = resolved.__assistantEmployeeNames;
        try {
          const current = await callOperation(req, readOperation, readValues);
          const currentRows = Array.isArray(current?.data) ? current.data : [];
          if (current?.__assistantPeriodEditable !== true) throw new Error("payroll period is locked");
          for (const row of rows) {
            const employeeInput = currentRows.find((item: any) => String(item?.__assistantRef?.id || "") === String(row.employeeId));
            const version = employeeInput ? Number(employeeInput.__assistantRef?.version) : 0;
            if (!Number.isSafeInteger(version) || version < 0) throw new Error("invalid payroll input version");
            if (values.__assistantPinnedVersion === true && Number(row.expectedVersion) !== version) {
              errors.push("Dữ liệu lương đã thay đổi sau khi bạn xem bản xác nhận. Hãy gửi lại yêu cầu để kiểm tra thông tin mới.");
            }
            row.expectedVersion = version;
          }
          resolved.rows = JSON.stringify(rows);
          labels.expectedVersion = "Phiên bản dữ liệu lương hiện tại của từng nhân sự (tự lấy)";
        } catch {
          errors.push("Kỳ lương đã khóa hoặc không đọc được dữ liệu đầu vào hiện tại trong chi nhánh đã chọn; chưa gửi cập nhật.");
        }
      }
    }
  }
  if (op.id === "payroll.period.line-overrides.bulk" && !errors.length) {
    let rows: any[] = [];
    try { rows = JSON.parse(String(resolved.rows || "[]")); } catch { rows = []; }
    const customRows = rows.some(row => (
      (row?.customValues && Object.keys(row.customValues).length > 0)
      || (Array.isArray(row?.clearFields) && row.clearFields.some((field: unknown) => String(field).startsWith("custom.")))
    ));
    if (customRows) {
      try {
        const variableOperation = operationById("payroll.period.variables.list");
        if (!variableOperation) throw new Error("missing payroll custom-variable list");
        const variables = await callOperation(req, variableOperation, {});
        const activeVariables = (Array.isArray(variables?.data) ? variables.data : []).filter((item: any) => (
          item?.status === "active"
          && typeof item?.code === "string"
          && /^[A-Za-z][A-Za-z0-9_]*$/.test(item.code)
          && typeof item?.name === "string"
          && item.name.trim()
        ));
        const displayNameByCode = new Map(activeVariables.map((item: any) => [String(item.code), String(item.name)]));
        const resolveCustomCode = (selector: string) => {
          const requested = selector.trim();
          const byCode = activeVariables.filter((item: any) => item.code === requested);
          if (byCode.length === 1) return String(byCode[0].code);
          if (byCode.length > 1) return "";
          const byName = activeVariables.filter((item: any) => normalize(item.name) === normalize(requested));
          return byName.length === 1 ? String(byName[0].code) : "";
        };
        for (const row of rows) {
          const currentCustomValues = row.customValues && typeof row.customValues === "object" && !Array.isArray(row.customValues) ? row.customValues : {};
          const mappedValues: Record<string, number> = {};
          for (const [selector, value] of Object.entries(currentCustomValues)) {
            const code = resolveCustomCode(selector);
            if (!code || Object.hasOwn(mappedValues, code)) throw new Error("custom variable is not uniquely active");
            mappedValues[code] = value as number;
          }
          if (Object.keys(mappedValues).length) row.customValues = mappedValues;
          const clearFields = Array.isArray(row.clearFields) ? row.clearFields.map(String) : [];
          row.clearFields = clearFields.map(field => {
            if (!field.startsWith("custom.")) return field;
            const code = resolveCustomCode(field.slice("custom.".length));
            if (!code) throw new Error("custom variable is not uniquely active");
            return `custom.${code}`;
          });
          if (!row.clearFields.length) delete row.clearFields;
        }
        resolved.__assistantCustomFieldNames = JSON.stringify(Object.fromEntries(displayNameByCode));
        resolved.rows = JSON.stringify(rows);
      } catch {
        errors.push("Không tìm được duy nhất biến lương tùy chỉnh đang hoạt động theo tên hoặc mã; chưa gửi cập nhật.");
      }
    }
  }
  if (op.id === "payroll.period.line-overrides.bulk" && !errors.length) {
    const readOperation = operationById("payroll.period.line-overrides.list");
    let rows: any[] = [];
    try { rows = JSON.parse(String(resolved.rows || "[]")); } catch { rows = []; }
    if (!readOperation) errors.push("Không tìm thấy thao tác tra cứu ghi đè lương để kiểm tra phiên bản.");
    else if (!Array.isArray(rows) || rows.length < 1 || rows.length > 20) errors.push("Ghi đè lương cần từ 1 đến 20 nhân viên mỗi lần.");
    else {
      const employeeIds = rows.map(row => String(row?.employeeId || ""));
      if (employeeIds.some(id => !/^[a-f\d]{24}$/i.test(id)) || new Set(employeeIds).size !== employeeIds.length) {
        errors.push("Mỗi nhân viên phải được chọn đúng theo tên và không lặp trong cùng yêu cầu.");
      } else {
        const readValues: Record<string, AssistantValue> = {};
        for (const field of readOperation.fields) {
          if (field.source === "path" && field.apiKey === "periodKey") {
            const periodField = op.fields.find(candidate => candidate.source === "path" && candidate.apiKey === "periodKey");
            if (periodField && resolved[periodField.key] !== undefined) readValues[field.key] = resolved[periodField.key];
          } else if (field.source === "query" && field.apiKey === "branchId") {
            const branchValue = resolved.targetBranch || req.user?.branchId;
            if (branchValue) readValues[field.key] = String(branchValue);
          } else if (field.source === "query" && field.apiKey === "search") {
            readValues[field.key] = "";
          }
        }
        if (typeof resolved.__assistantEmployeeNames === "string") readValues.__assistantEmployeeNames = resolved.__assistantEmployeeNames;
        try {
          const current = await callOperation(req, readOperation, readValues);
          const currentRows = Array.isArray(current?.data) ? current.data : [];
          for (const row of rows) {
            const employee = currentRows.find((item: any) => String(item?.__assistantRef?.id || "") === String(row.employeeId));
            const version = employee ? Number(employee.__assistantRef?.version) : 0;
            if (!Number.isSafeInteger(version) || version < 0) throw new Error("invalid line override version");
            if (values.__assistantPinnedVersion === true && Number(row.expectedVersion) !== version) {
              errors.push("Khoản lương đã thay đổi sau khi bạn xem bản xác nhận. Hãy gửi lại yêu cầu để kiểm tra thông tin mới.");
            }
            row.expectedVersion = version;
          }
          resolved.rows = JSON.stringify(rows);
        } catch {
          errors.push("Không đọc được các khoản ghi đè hiện tại trong chi nhánh đã chọn; chưa gửi cập nhật.");
        }
      }
    }
  }
  if (op.id === "payroll.run.reconciliation.action" && !errors.length) {
    try {
      const readOperation = operationById("payroll.run.reconciliation.list");
      if (!readOperation) throw new Error("missing reconciliation read operation");
      const branchId = String(resolved.targetBranch || req.user?.branchId || "");
      const current = await callOperation(req, readOperation, {
        path_id: String(resolved.path_id || ""),
        targetBranch: branchId,
      });
      const rows = Array.isArray(current?.data?.items) ? current.data.items : [];
      const employeeId = String(resolved.path_employeeId || "");
      const employee = rows.find((row: any) => String(row?.__assistantRef?.id || "") === employeeId);
      const version = Number(employee?.__assistantRef?.version);
      if (!employee || !Number.isSafeInteger(version) || version < 0) throw new Error("employee reconciliation missing or stale");
      const requestedField = normalize(String(resolved.field || ""));
      const issues = Array.isArray(employee.__assistantRef.issues) ? employee.__assistantRef.issues : [];
      const matches = issues.filter((issue: any) => normalize(String(issue?.field || "")) === requestedField
        || normalize(payrollReconciliationFieldLabels[String(issue?.field || "")] || "") === requestedField);
      if (matches.length !== 1 || !matches[0]?.id) throw new Error("one matching open issue is required");
      resolved.expectedVersion = version;
      resolved.issueId = String(matches[0].id);
      resolved.__assistantEmployeeName = String(employee.employeeName || "Nhân viên");
      labels.expectedVersion = "Phiên bản đối soát hiện tại (tự lấy)";
      labels.issueId = "Mã khiếu nại đang mở (tự lấy)";
    } catch {
      errors.push("Không tìm thấy đúng một khiếu nại đang mở cho nhân viên và khoản lương đã chọn; chưa ghi phản hồi hoặc trạng thái xử lý.");
    }
  }
  if (op.id === "payroll.reconciliation.schedule.update" && !errors.length) {
    try {
      const readOperation = operationById("payroll.reconciliation.schedule.get");
      if (!readOperation) throw new Error("missing schedule read");
      const current = (await callOperation(req, readOperation, {}))?.data;
      const version = Number(current?.version);
      if (!Number.isSafeInteger(version) || version < 0) throw new Error("schedule version unavailable");
      for (const key of ["enabled", "day", "hour", "minute", "periodOffset"]) {
        if (resolved[key] === undefined) resolved[key] = current[key];
      }
      resolved.version = version;
      labels.version = "Phiên bản cài đặt hiện tại (được lấy tự động)";
    } catch {
      errors.push("Không đọc được lịch đối soát hiện tại; chưa thể lưu cài đặt an toàn.");
    }
  }
  if (op.id === "finance.reporting.plan.update" && !errors.length) {
    try {
      const readOperation = operationById("finance.reporting.breakeven");
      if (!readOperation) throw new Error("missing plan read");
      const month = String(resolved.month || "");
      const branch = op.fields.find(field => field.source === "query" && field.apiKey === "branchId");
      const current = (await callOperation(req, readOperation, {
        query_month: month,
        ...(branch && resolved[branch.key] !== undefined ? { [branch.key]: resolved[branch.key] as AssistantValue } : {}),
      }))?.data;
      const plan = current?.plan;
      const version = Number(plan?.version ?? 0);
      if (!plan || !Number.isSafeInteger(version) || version < 0) throw new Error("plan version unavailable");
      resolved.version = version;
      resolved.__assistantExistingRecord = JSON.stringify(plan);
      labels.version = "Phiên bản kế hoạch hiện tại (được lấy tự động)";
    } catch {
      errors.push("Không đọc được kế hoạch tài chính hiện tại cho tháng đã chọn; chưa thể lưu an toàn.");
    }
  }
  if (isRecruitmentOperation(op) && op.systemBodyFields?.includes("version") && resolved.path_id && !errors.length) {
    const branchField = op.fields.find(field => field.source === "query" && field.apiKey === "branchId");
    const branchValues = branchField && resolved[branchField.key] !== undefined ? { [branchField.key]: resolved[branchField.key] as AssistantValue } : {};
    try {
      let current: any;
      if (op.id.endsWith(".restore")) {
        const list = operationById(op.id.startsWith("recruitment.job.") ? "recruitment.job.list" : op.id.startsWith("recruitment.applicant.") ? "recruitment.applicant.list" : "recruitment.interview.list");
        if (!list) throw new Error("missing list");
        const deletedField = list.fields.find(field => field.source === "query" && field.apiKey === "deleted");
        const rows = rawRecords(await callOperation(req, list, { ...branchValues, ...(deletedField ? { [deletedField.key]: true } : {}) }));
        current = rows.find(row => String(row._id || row.id || "") === String(resolved.path_id));
      } else {
        const detailId = op.id.startsWith("recruitment.job.") ? "recruitment.job.detail" : op.id.startsWith("recruitment.applicant.") ? "recruitment.applicant.detail" : "recruitment.interview.detail";
        const detail = operationById(detailId);
        if (!detail) throw new Error("missing detail");
        current = (await callOperation(req, detail, { ...branchValues, path_id: String(resolved.path_id || "") }))?.data;
      }
      const currentVersion = Number(current?.version);
      if (!current || !Number.isSafeInteger(currentVersion) || currentVersion < 0) throw new Error("current version unavailable");
      if (op.id === "recruitment.interview.update" && (resolved.requestedStartDate !== undefined || resolved.requestedStartTime !== undefined)) {
        const currentStart = new Date(current.scheduledStart);
        const currentEnd = new Date(current.scheduledEnd);
        if (!Number.isFinite(currentStart.getTime()) || !Number.isFinite(currentEnd.getTime()) || currentEnd <= currentStart) {
          errors.push("Không đọc được thời lượng lịch phỏng vấn hiện tại; chưa thể đổi ngày hoặc giờ an toàn.");
        } else {
          const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(currentStart);
          const part = (key: string) => parts.find(item => item.type === key)?.value || "00";
          const currentDate = `${part("year")}-${part("month")}-${part("day")}`;
          const currentTime = `${part("hour")}:${part("minute")}`;
          const date = String(resolved.requestedStartDate || currentDate);
          const time = String(resolved.requestedStartTime || currentTime);
          const nextStart = new Date(`${date}T${time}:00+07:00`);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !Number.isFinite(nextStart.getTime())) {
            errors.push("Ngày hoặc giờ phỏng vấn mới không hợp lệ; chưa cập nhật lịch.");
          } else {
            const duration = currentEnd.getTime() - currentStart.getTime();
            resolved.scheduledStart = nextStart.toISOString();
            resolved.scheduledEnd = new Date(nextStart.getTime() + duration).toISOString();
          }
        }
        delete resolved.requestedStartDate;
        delete resolved.requestedStartTime;
      }
      if (op.id === "recruitment.job.status" && resolved.status === "open") {
        const missing = missingRecruitmentJobReadiness(current);
        if (missing.length) errors.push(`Chưa thể mở tuyển. Vị trí hiện thiếu: ${missing.join(", ")}. Hãy cập nhật vị trí trước.`);
      }
      const pinned = values.__assistantPinnedVersion === true;
      if (pinned && Number(values.version) !== currentVersion) errors.push("Dữ liệu tuyển dụng đã thay đổi sau khi bạn xem bản xác nhận. Hãy gửi lại yêu cầu để kiểm tra thông tin mới.");
      else {
        resolved.version = currentVersion;
        labels.version = "Phiên bản hiện tại (được lấy tự động)";
      }
      delete resolved.__assistantPinnedVersion;
    } catch { errors.push("Không đọc được bản ghi hoặc phiên bản tuyển dụng hiện tại; chưa thể ghi thay đổi an toàn."); }
  }
  if (op.id === "retail.order.checkout" && !errors.length) {
    const quoteOp = operationById("retail.order.quote");
    const shiftOp = operationById("retail.shift.current");
    if (!quoteOp || !shiftOp) errors.push("Thiếu thao tác báo giá hoặc tra cứu ca POS hiện tại.");
    else {
      const branchField = op.fields.find(field => field.source === "query" && field.apiKey === "branchId");
      const branchValues = branchField && resolved[branchField.key] !== undefined ? { [branchField.key]: resolved[branchField.key] as AssistantValue } : {};
      try {
        const [quoteResult, shiftResult] = await Promise.all([
          callOperation(req, quoteOp, { ...branchValues, input: String(resolved.input) }),
          callOperation(req, shiftOp, branchValues),
        ]);
        const quote = quoteResult?.data;
        const shift = shiftResult?.data;
        const total = Number(quote?.grandTotal);
        const posSessionId = String(shift?._id || shift?.id || "");
        if (!Number.isSafeInteger(total) || total < 0) errors.push("Chưa tính được tổng tiền đơn từ giá bán hiện tại; chưa thể tạo đơn.");
        else {
          resolved.expectedGrandTotal = total;
          labels.expectedGrandTotal = `${new Intl.NumberFormat("vi-VN").format(total)} ₫`;
        }
        if (!shift || shift.status !== "open" || !/^[a-f\d]{24}$/i.test(posSessionId)) errors.push("Bạn cần mở ca POS trong chi nhánh đã chọn trước khi tạo đơn.");
        else {
          resolved.posSessionId = posSessionId;
          resolved.terminalId = String(shift.terminalId || "default");
          labels.posSessionId = String(shift.shiftCode || "Ca POS đang mở");
          labels.terminalId = "Thiết bị POS hiện tại";
        }
        if (!errors.length) {
          const orderInput = JSON.parse(String(resolved.input || "{}"));
          const payments = JSON.parse(String(resolved.payments || "[]"));
          const paid = Array.isArray(payments) ? payments.reduce((sum, payment) => sum + Number(payment?.amount || 0), 0) : 0;
          if (total > paid && (!orderInput.customerId || !orderInput.dueDate)) errors.push("Đơn còn nợ. Hãy nêu khách hàng và ngày đến hạn thanh toán, hoặc bổ sung khoản thanh toán đủ tổng tiền.");
        }
      } catch {
        errors.push("Không thể xác minh ca POS và báo giá hiện tại; chưa tạo đơn.");
      }
    }
  }
  if ((op.id === "retail.order.draft.update" || op.id === "retail.order.confirm") && resolved.path_id && !errors.length) {
    const detailOp = operationById("retail.order.detail");
    if (!detailOp) errors.push("Thiếu thao tác tra cứu đơn bán lẻ để kiểm tra bản nháp hiện tại.");
    else {
      const branchField = op.fields.find(field => field.source === "query" && field.apiKey === "branchId");
      const branchValues = branchField && resolved[branchField.key] !== undefined ? { [branchField.key]: resolved[branchField.key] as AssistantValue } : {};
      try {
        const detailResult = await callOperation(req, detailOp, { ...branchValues, path_id: String(resolved.path_id) });
        const order = detailResult?.data;
        if (!order || order.status !== "draft") errors.push("Chỉ có thể thao tác với đơn đang ở trạng thái nháp.");
        else if (!Number.isSafeInteger(Number(order.version)) || Number(order.version) < 0) errors.push("Không đọc được phiên bản đơn nháp hiện tại.");
        else {
          const version = Number(order.version);
          if (op.id === "retail.order.draft.update") {
            // A partial edit still uses the API's full replacement contract.
            // Hydrate from current persisted input fields, not calculated line totals.
            resolved.__assistantExistingRecord = JSON.stringify({
              ...order,
              items: (Array.isArray(order.items) ? order.items : []).map((item: any) => ({
                productId: item.productId || item.variantId, quantity: item.quantity,
                discount: item.discount || { type: "amount", value: Number(item.discountAmount || 0) },
                ...(item.serialNumbers ? { serialNumbers: item.serialNumbers } : {}),
                ...(item.internalBarcodes ? { internalBarcodes: item.internalBarcodes } : {}),
                ...(item.note ? { note: item.note } : {}),
              })),
              orderDiscount: typeof order.orderDiscount === "object" && order.orderDiscount
                ? order.orderDiscount : { type: "amount", value: Number(order.manualOrderDiscount ?? order.orderDiscount ?? 0) },
              manualOrderDiscount: typeof order.manualOrderDiscount === "object" && order.manualOrderDiscount
                ? order.manualOrderDiscount : { type: "amount", value: Number(order.manualOrderDiscount || 0) },
            });
            resolved.version = version;
            labels.version = `Phiên bản hiện tại của ${String(order.orderCode || "đơn nháp")}`;
          } else {
            const quoteOp = operationById("retail.order.quote");
            const shiftOp = operationById("retail.shift.current");
            if (!quoteOp || !shiftOp) errors.push("Thiếu thao tác báo giá hoặc tra cứu ca POS hiện tại.");
            else {
              const storedDiscount = order.manualOrderDiscount;
              const manualOrderDiscount = storedDiscount && typeof storedDiscount === "object"
                ? storedDiscount
                : { type: "amount", value: Number(storedDiscount || 0) };
              const orderInput = {
                items: (Array.isArray(order.items) ? order.items : []).map((item: any) => ({
                  productId: item.productId || item.variantId, quantity: item.quantity,
                  discount: item.discount || { type: "amount", value: Number(item.discountAmount || 0) },
                  serialNumbers: item.serialNumbers, internalBarcodes: item.internalBarcodes, note: item.note,
                })),
                customerId: order.customerId, billingProfileId: order.billingProfileId, taxRate: order.taxRate,
                shippingFee: order.shippingFee, manualOrderDiscount, couponCode: order.couponCode,
                pointsToRedeem: order.pointsToRedeem, dueDate: order.dueDate, installment: order.installment,
              };
              const [quoteResult, shiftResult] = await Promise.all([
                callOperation(req, quoteOp, { ...branchValues, input: JSON.stringify(orderInput, (_key, value) => value === null ? undefined : value) }),
                callOperation(req, shiftOp, branchValues),
              ]);
              const total = Number(quoteResult?.data?.grandTotal);
              const shift = shiftResult?.data;
              const sessionId = String(shift?._id || shift?.id || "");
              if (!Number.isSafeInteger(total) || total < 0) errors.push("Chưa tính được tổng tiền hiện tại của đơn nháp.");
              else {
                resolved.expectedVersion = version;
                resolved.expectedGrandTotal = total;
                labels.expectedVersion = `Phiên bản hiện tại của ${String(order.orderCode || "đơn nháp")}`;
                labels.expectedGrandTotal = `${new Intl.NumberFormat("vi-VN").format(total)} ₫`;
              }
              if (!shift || shift.status !== "open" || !/^[a-f\d]{24}$/i.test(sessionId)) errors.push("Bạn cần mở ca POS trong chi nhánh đã chọn trước khi xác nhận đơn nháp.");
              else {
                resolved.posSessionId = sessionId;
                resolved.terminalId = String(shift.terminalId || "default");
                labels.posSessionId = String(shift.shiftCode || "Ca POS đang mở");
                labels.terminalId = "Thiết bị POS hiện tại";
              }
              if (!errors.length) {
                const payments = JSON.parse(String(resolved.payments || "[]"));
                const paid = Array.isArray(payments) ? payments.reduce((sum, payment) => sum + Number(payment?.amount || 0), 0) : 0;
                if (total > paid && (!order.customerId || !order.dueDate)) errors.push("Đơn nháp còn nợ. Cần có khách hàng và ngày đến hạn, hoặc nêu các khoản thanh toán đủ tổng tiền.");
              }
            }
          }
        }
      } catch (error) {
        errors.push(error instanceof AssistantError ? error.message : "Không thể kiểm tra đơn nháp, giá hiện tại và ca POS; chưa xác nhận đơn.");
      }
    }
  }
  if ((op.id === "retail.order.collect" || op.id === "retail.order.cancel") && resolved.path_id && !errors.length) {
    const detailOp = operationById("retail.order.detail");
    if (!detailOp) errors.push("Thiếu thao tác tra cứu đơn bán lẻ để kiểm tra phiên bản hiện tại.");
    else {
      const branchField = op.fields.find(field => field.source === "query" && field.apiKey === "branchId");
      const branchValues = branchField && resolved[branchField.key] !== undefined ? { [branchField.key]: resolved[branchField.key] as AssistantValue } : {};
      try {
        const detail = await callOperation(req, detailOp, { ...branchValues, path_id: String(resolved.path_id) });
        const order = detail?.data;
        if (!order || !Number.isSafeInteger(Number(order.version)) || Number(order.version) < 0) errors.push("Không đọc được phiên bản hiện tại của đơn; chưa thể ghi thao tác.");
        else {
          resolved.expectedVersion = Number(order.version);
          labels.expectedVersion = `Phiên bản hiện tại của ${String(order.orderCode || "đơn hàng")}`;
          let needsCashSession = false;
          if (op.id === "retail.order.collect") {
            const payments = JSON.parse(String(resolved.payments || "[]"));
            needsCashSession = Array.isArray(payments) && payments.some(payment => payment?.method === "cash");
          } else {
            const refunds = JSON.parse(String(resolved.refunds || "[]"));
            const remainingRefund = Math.max(0, Number(order.paidAmount || 0) - Number(order.refundedAmount || 0));
            const refundTotal = Array.isArray(refunds) ? refunds.reduce((sum, payment) => sum + Number(payment?.amount || 0), 0) : 0;
            if (remainingRefund > 0 && (!Array.isArray(refunds) || refunds.length === 0)) errors.push(`Đơn còn ${new Intl.NumberFormat("vi-VN").format(remainingRefund)} ₫ cần hoàn. Hãy nêu phương thức và số tiền từng khoản hoàn.`);
            else if (refundTotal !== remainingRefund) errors.push(`Tổng tiền hoàn phải đúng ${new Intl.NumberFormat("vi-VN").format(remainingRefund)} ₫ còn phải hoàn.`);
            needsCashSession = Array.isArray(refunds) && refunds.some(payment => payment?.method === "cash");
          }
          if (!errors.length && needsCashSession) {
            const shiftOp = operationById("retail.shift.current");
            if (!shiftOp) errors.push("Thiếu thao tác tra cứu ca POS hiện tại.");
            else {
              const shiftResult = await callOperation(req, shiftOp, branchValues);
              const shift = shiftResult?.data;
              const sessionId = String(shift?._id || shift?.id || "");
              if (!shift || shift.status !== "open" || !/^[a-f\d]{24}$/i.test(sessionId)) errors.push("Hoàn tiền mặt hoặc thu tiền mặt cần ca POS đang mở trong chi nhánh đã chọn.");
              else {
                resolved.cashSessionId = sessionId;
                resolved.terminalId = String(shift.terminalId || "default");
                labels.cashSessionId = String(shift.shiftCode || "Ca POS đang mở");
                labels.terminalId = "Thiết bị POS hiện tại";
              }
            }
          }
        }
      } catch {
        errors.push("Không thể kiểm tra đơn và phiên bản hiện tại; chưa ghi thao tác.");
      }
    }
  }
  const installmentStudent = resolvedReferences.path_id;
  if ((op.id === "student.installment.create" || op.id === "student.installment.update") && installmentStudent) {
    const currentFee = Number.parseInt(String(installmentStudent.fee || "").replace(/\D/g, ""), 10) || 0;
    const installmentRecord = resolvedReferences.path_no;
    const currentInstallment = Number(installmentRecord?.amountDue) || 0;
    const requestedInstallment = op.id === "student.installment.create"
      ? Number(resolved.amountDue)
      : Number(resolved.amountDue ?? currentInstallment);
    const updatedFee = op.id === "student.installment.create"
      ? currentFee + requestedInstallment
      : currentFee + requestedInstallment - currentInstallment;
    if (Number.isFinite(requestedInstallment) && updatedFee >= 0) {
      const amountLabel = (amount: number) => `${new Intl.NumberFormat("vi-VN").format(amount)} ₫`;
      confirmationDetails.path_id = [
        { label: "Tổng học phí hiện tại", value: amountLabel(currentFee) },
        { label: "Tổng học phí sau thao tác", value: amountLabel(updatedFee) },
      ];
    }
  }
  if (op.id === "omni-inbox.account.ai-config.update"
    && !op.fields.some(field => field.source === "body" && resolved[field.key] !== undefined)) {
    errors.push("Hãy nêu ít nhất một cài đặt AI cần thay đổi cho tài khoản đã chọn.");
  }
  return { values: resolved, labels, errors: [...new Set(errors)], confirmationDetails, unresolvedReferenceKeys: [...unresolvedReferenceKeys], unresolvedReferenceErrors: Object.fromEntries(unresolvedReferenceErrors) };
}
