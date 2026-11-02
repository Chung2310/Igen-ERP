import { createHash, randomUUID } from "node:crypto";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { AssistantDataShape, AssistantField, AssistantReply, AssistantValue, AssistantWorkflow } from "../../src/shared/assistant-workflow";
import { AssistantSessionModel, AssistantTurnModel, ensureAssistantIndexes } from "./models";
import { actorScope, assertOperation, currentWorkflow, listWorkflows } from "./workflows";
import { AssistantError, collectValues } from "./policy";
import { callOperation, lookupRecords, projectRecords, resolveNamedReferenceSelectors, resolveReferences, suggestReferenceOptions, UncertainExecutionError } from "./executor";
import { getSettings } from "./settings";
import { interpretRequest } from "./interpreter";
import { ASSISTANT_OPERATIONS, operationById, type AssistantOperation } from "./catalog";
import { formatAssistantResult } from "./result-format";
const resultLabel = (op: AssistantOperation, key: string) => key === "branchName" ? "\u0043hi nh\u00e1nh" : key === "warehouseName" ? "\u004bho" : operationById(op.id.replace(/\.list$/, ".create"))?.fields.find(f => f.key === key)?.label || ({ id: "Mã", name: "Tên", title: "Tiêu đề", displayName: "Họ tên", email: "Email", phone: "Điện thoại", sku: "SKU", code: "Mã", status: "Trạng thái", productName: "Sản phẩm", variantName: "Biến thể", variantId: "Mã biến thể", warehouseId: "Mã kho", quantity: "Tồn kho", reservedQuantity: "Đã giữ chỗ", minStock: "Tồn tối thiểu", maxStock: "Tồn tối đa", unitCode: "Đơn vị", assignee: "Người được giao", description: "Mô tả" } as Record<string, string>)[key] || "Thông tin";

export interface TurnInput { conversationId: string; requestId: string; text?: string; decision?: { id: string; confirmed: boolean; password?: string }; }
interface PendingAction { id: string; actionId: string; provided: Record<string, unknown>; intent: string; resolved?: Record<string, AssistantValue>; workflowVersion: number; preview: NonNullable<AssistantReply["action"]>; confirmationDetails?: Record<string, Array<{ label: string; value: string }>>; awaitingReferenceKeys?: string[]; awaitingReferenceLabels?: Record<string, string>; skippedReferenceKeys?: string[]; }
const scopeOf = (req: AuthenticatedRequest) => ({ ...actorScope(req), branchId: req.user?.branchId || "" });
const processingReply = (): AssistantReply => ({ status: "processing", reply: "Yêu cầu này đang được xử lý. Vui lòng chờ; không cần gửi một yêu cầu mới." });
const uncertainReply = (): AssistantReply => ({ status: "uncertain", reply: "Yêu cầu trước chưa có kết quả xác nhận. Hãy kiểm tra dữ liệu trong phân hệ trước khi gửi yêu cầu mới. Hệ thống không tự chạy lại để tránh tạo trùng." });
const hasUpdatePayload = (op: AssistantOperation, values: Record<string, unknown>) => op.adapter === "contract"
  ? op.fields.some(field => field.source === "body" && !/^(?:expectedVersion|idempotencyKey)$/i.test(field.apiKey || field.key) && values[field.key] !== undefined)
  : Object.keys(values).some(key => key !== "id" && !key.startsWith("path_") && !/^(?:expectedVersion|idempotencyKey)$/i.test(key));
function updateDetailsQuestion(op: AssistantOperation, intent: string, values: Record<string, unknown>) {
  if (op.id === "company-knowledge.documents.scopes.update") return "Bạn muốn thay đổi kênh áp dụng, mục đích sử dụng, loại tài liệu hay mở phạm vi áp dụng cho tất cả trang?";
  if (op.path === "/partners/:id" && /(?:thông tin (?:chuyển khoản|tài khoản)|chuyển khoản)/i.test(intent)) {
    const required = [
      ["bankName", "tên ngân hàng"],
      ["bankAccountNo", "số tài khoản"],
      ["bankAccountName", "tên chủ tài khoản"],
    ] as const;
    const missing = required.filter(([key]) => values[key] === undefined || values[key] === null || String(values[key]).trim() === "").map(([, label]) => label);
    if (missing.length) return `Để cập nhật thông tin chuyển khoản của đối tác, vui lòng cung cấp: ${missing.join(", ")}.`;
  }
  if (op.path === "/partners/:id" && /(?:cấu hình hoa hồng|hoa hồng|hoa hong|commission)/i.test(intent)) {
    const required = [
      ["commissionType", "hình thức (phần trăm hoặc số tiền cố định)"],
      ["commissionValue", "mức hoa hồng (số % hoặc số tiền)"],
    ] as const;
    const missing = required.filter(([key]) => values[key] === undefined || values[key] === null || String(values[key]).trim() === "").map(([, label]) => label);
    if (missing.length) return `Để cập nhật hoa hồng đối tác, vui lòng cung cấp: ${missing.join(", ")}.`;
  }
  return "Bạn muốn thay đổi thông tin nào của bản ghi này?";
}
const normalizePartnerIntent = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
const normalizeAssistantText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
const relationMentioned = (intent: string, field: AssistantField) => {
  const text = normalizeAssistantText(intent);
  const stopWords = new Set(["ten", "ma", "hoac", "va", "cua", "cho", "ho", "mot", "cac", "ban", "ghi", "lien", "quan"]);
  const tokens = [field.key, field.apiKey || "", field.label]
    .flatMap(value => normalizeAssistantText(value).split(/[^a-z0-9]+/))
    .filter(token => token.length >= 3 && !stopWords.has(token));
  return tokens.some(token => text.includes(token));
};
const relationChangeRequested = (intent: string, field: AssistantField) => {
  const text = normalizeAssistantText(intent);
  return relationMentioned(intent, field)
    && /(?:^|\s)(?:doi|chuyen|gan|lien ket|thuoc|cap nhat|thay doi|them vao|bo sung vao|dat vao|assign|set)(?:\s|$)/.test(text);
};
const isSkippingReference = (text: string) => /^(?:thoi\s+)?(?:bo qua|khong can|de trong|khong gan|khong lien ket|khong chon)(?:\s|$)/.test(normalizeAssistantText(text));
export async function missingReferencePrompts(
  req: AuthenticatedRequest,
  op: AssistantOperation,
  workflow: AssistantWorkflow,
  values: Record<string, AssistantValue>,
  intent: string,
  skipped: Set<string>,
  suggestOptions: typeof suggestReferenceOptions = suggestReferenceOptions,
) {
  const prompts: string[] = [];
  const awaitingOptional: string[] = [];
  const awaitingLabels: Record<string, string> = {};
  const isCreate = op.method === "POST";
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
        ? `- ${commissionBranchField.label}: ${options.join("; ")}`
        : `- ${commissionBranchField.label}: ch\u01B0a c\u00F3 l\u1EF1a ch\u1ECDn kh\u1EA3 d\u1EE5ng trong ph\u1EA1m vi \u0111\u01B0\u1EE3c c\u1EA5p quy\u1EC1n.`],
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
    if (!field.reference || values[field.key] !== undefined || skipped.has(field.key)) continue;
    const configured = workflow.fields.find(item => item.key === field.key);
    const required = Boolean(field.systemRequired || configured?.required || conditionApplies(field));
    const relationRequested = relationMentioned(intent, field);
    const mustResolve = required || relationChangeRequested(intent, field);
    const shouldPrompt = required || isCreate || (["PATCH", "PUT"].includes(op.method) && relationRequested);
    if (!shouldPrompt) continue;
    let options: string[] = [];
    try { options = await suggestOptions(req, op, field, values); } catch { /* permission or endpoint failures do not expose another scope */ }
    if (!mustResolve && options.length === 0) continue;
    if (!mustResolve) { awaitingOptional.push(field.key); awaitingLabels[field.key] = field.label; }
    const skipHint = mustResolve ? "" : ` (tùy chọn; có thể trả lời “bỏ qua ${field.label.toLocaleLowerCase("vi")}”)`;
    prompts.push(options.length
      ? `- ${field.label}: ${options.join("; ")}${skipHint}`
      : `- ${field.label}: chưa có lựa chọn khả dụng trong phạm vi được cấp quyền.${skipHint}`);
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
    const visit = async (
      shape: AssistantDataShape,
      node: unknown,
      path: string,
      displayPath: string[],
      currentObject?: Record<string, unknown>,
    ): Promise<void> => {
      if (shape.reference) {
        if (node !== undefined && node !== null && String(node).trim()) return;
        const key = nestedReferenceKey(field.key, path);
        if (skipped.has(key)) return;
        const parentValue = shape.referenceParentKey
          ? currentObject?.[shape.referenceParentKey] ?? values[shape.referenceParentKey]
          : undefined;
        const required = Boolean(shape.required);
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
        const shouldPrompt = required || isCreate || (["PATCH", "PUT"].includes(op.method) && relationRequested);
        if (!shouldPrompt) return;
        if (shape.referenceParentKey && !shape.referenceParentOptional && (parentValue === undefined || parentValue === null || parentValue === "")) return;
        const label = [field.label, ...displayPath, shape.label || path.split(".").at(-1) || "Thông tin liên quan"].filter(Boolean).join(" · ");
        referenceField.label = label;
        let options: string[] = [];
        try { options = await suggestOptions(req, op, referenceField, {
          ...values,
          ...(currentObject || {}),
          ...(shape.referenceParentKey && parentValue !== undefined ? { [shape.referenceParentKey]: parentValue as AssistantValue } : {}),
        } as Record<string, AssistantValue>); }
        catch { /* permission or endpoint failures do not expose another scope */ }
        if (!mustResolve && options.length === 0) return;
        if (!mustResolve) { awaitingOptional.push(key); awaitingLabels[key] = label; }
        const skipHint = mustResolve ? "" : ` (tùy chọn; có thể trả lời “bỏ qua ${shape.label || "trường liên kết"}”)`;
        prompts.push(options.length
          ? `- ${label}: ${options.join("; ")}${skipHint}`
          : `- ${label}: chưa có lựa chọn khả dụng trong phạm vi được cấp quyền.${skipHint}`);
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
          const label = [field.label, ...displayPath, itemShape.label].filter(Boolean).join(" · ");
          referenceField.label = label;
          let options: string[] = [];
          try { options = await suggestOptions(req, op, referenceField, {
            ...values,
            ...(currentObject || {}),
            ...(itemShape.referenceParentKey && parentValue !== undefined ? { [itemShape.referenceParentKey]: parentValue as AssistantValue } : {}),
          } as Record<string, AssistantValue>); }
          catch { /* do not expose records outside the granted scope */ }
          if (!mustResolve && options.length === 0) return;
          if (!mustResolve) { awaitingOptional.push(key); awaitingLabels[key] = label; }
          const skipHint = mustResolve ? "" : ` (tùy chọn; có thể trả lời “bỏ qua ${itemShape.label || field.label}”)`;
          prompts.push(options.length
            ? `- ${label}: chọn một hoặc nhiều tên trong danh sách: ${options.join("; ")}${skipHint}`
            : `- ${label}: chưa có lựa chọn khả dụng trong phạm vi được cấp quyền.${skipHint}`);
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
        const childDisplay = [...displayPath, childShape.label || key];
        if (childShape.reference) await visit(childShape, record[key], childPath, displayPath, record);
        else if (childShape.type === "object" || childShape.type === "array") await visit(childShape, record[key], childPath, childDisplay, record);
      }
    };
    await visit(field.structure, data, "", [], undefined);
  }
  return { prompts, awaitingOptional, awaitingLabels };
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
  const scope = { ...scopeOf(req), conversationId };
  const session = await AssistantSessionModel.findOne(scope).lean();
  const turn = await AssistantTurnModel.findOne(scope).sort({ createdAt: -1 }).lean();
  return { messages: session?.messages || [], lastReply: session?.lastReply || null, busy: Boolean(session?.busy), requestId: turn && ["processing", "executing"].includes(turn.status) ? turn.requestId : undefined };
}

const conversationText = (value: unknown, maxLength: number) => {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
};

export async function listConversations(req: AuthenticatedRequest, options: { limit: number; before?: Date; beforeId?: string }) {
  await ensureAssistantIndexes();
  const filter: any = { ...scopeOf(req) };
  if (options.before && options.beforeId) {
    filter.$or = [
      { updatedAt: { $lt: options.before } },
      { updatedAt: options.before, _id: { $lt: options.beforeId } },
    ];
  }
  const rows = await AssistantSessionModel.find(filter)
    .select("_id conversationId messages updatedAt")
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
        title: conversationText(firstUser?.content, 100) || "Cuộc trò chuyện mới",
        preview: conversationText(lastMessage?.content, 180),
        messageCount: messages.length,
        updatedAt: session.updatedAt,
      };
    }),
    nextCursor: hasMore && last ? { before: new Date(last.updatedAt).toISOString(), beforeId: String(last._id) } : null,
  };
}

export async function processTurn(req: AuthenticatedRequest, input: TurnInput): Promise<AssistantReply> {
  const scope = scopeOf(req);
  await ensureAssistantIndexes();
  const digest = createHash("sha256").update(JSON.stringify({ conversationId: input.conversationId, text: input.text || "", decision: input.decision ? { id: input.decision.id, confirmed: input.decision.confirmed } : null })).digest("hex");
  const requestFilter = { ...scope, requestId: input.requestId };
  let turn: any;
  try { turn = await AssistantTurnModel.create({ ...requestFilter, conversationId: input.conversationId, digest }); }
  catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const existing = await AssistantTurnModel.findOne(requestFilter).lean();
    if (!existing || existing.digest !== digest) throw new AssistantError("Mã yêu cầu đã được dùng cho nội dung khác.", 409);
    if (existing.result) return existing.result as AssistantReply;
    return Date.now() - new Date(existing.updatedAt).getTime() > 120_000 ? uncertainReply() : processingReply();
  }
  const sessionFilter = { ...scope, conversationId: input.conversationId };
  try { await AssistantSessionModel.updateOne(sessionFilter, { $setOnInsert: sessionFilter }, { upsert: true }); }
  catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
  const session = await AssistantSessionModel.findOneAndUpdate({ ...sessionFilter, busy: false }, { $set: { busy: true } }, { returnDocument: "after" });
  if (!session) {
    const reply: AssistantReply = { status: "failed", reply: "Cuộc trò chuyện đang xử lý một yêu cầu khác. Hãy đợi yêu cầu đó hoàn tất rồi gửi lại." };
    await AssistantTurnModel.updateOne({ _id: turn._id }, { $set: { status: "completed", result: reply } });
    return reply;
  }
  let pending = session.pending as PendingAction | null;
  let hasDispatched = false;
  let reply: AssistantReply;
  const userContent = input.text || (input.decision?.confirmed ? "Xác nhận thực hiện thao tác đã xem trước." : "Hủy thao tác đã xem trước.");
  const history = [...session.messages, { role: "user", content: userContent }];

  const execute = async (op: AssistantOperation, workflow: AssistantWorkflow, values: Record<string, AssistantValue>, password?: string): Promise<AssistantReply> => {
    if (Date.now() - new Date(turn.createdAt).getTime() > 120_000) throw new AssistantError("Yêu cầu đã hết thời gian xử lý trước khi thực thi. Chưa thay đổi dữ liệu; vui lòng gửi lại yêu cầu.", 408);
    await assertOperation(req, op.id);
    if (op.id === "employee.create" && (!password || password.length < 6 || password.length > 128)) throw new AssistantError("Vui lòng nhập mật khẩu khởi tạo (6–128 ký tự) trong ô bảo mật của bản xem trước.");
    const latest = await currentWorkflow(req, op.id);
    if (latest.version !== workflow.version) throw new AssistantError("Workflow vừa thay đổi. Vui lòng gửi lại nội dung để kiểm tra theo quy tắc mới.", 409);
    if (op.method !== "GET" && !input.decision?.confirmed && (await getSettings(req)).alwaysConfirm) return { status: "confirmation", reply: "Cài đặt yêu cầu xác nhận trước khi thay đổi dữ liệu. Vui lòng kiểm tra bản xem trước.", action: pending!.preview };
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
    const finalValidation = collectValues(latest, validationValues);
    if (finalValidation.missing.length || finalValidation.errors.length) throw new AssistantError([...(finalValidation.missing.length ? [`Cần bổ sung: ${finalValidation.missing.join(", ")}.`] : []), ...finalValidation.errors].join("\n"));
    // Resolve again immediately before writing, including after a confirmation wait.
    const pinnedOperations = op.id.startsWith("recruitment.")
      || ["payroll.period.inputs.bulk", "payroll.period.line-overrides.bulk"].includes(op.id);
    const checked = await resolveReferences(req, op, input.decision?.confirmed && pinnedOperations ? { ...values, __assistantPinnedVersion: true } : values);
    if (checked.errors.length) throw new AssistantError(checked.errors.join("\n"));
    if (input.decision?.confirmed && op.confirmationDetails) {
      for (const key of Object.keys(op.confirmationDetails)) {
        const expectedDetails = pending?.confirmationDetails?.[key] || [];
        const currentDetails = checked.confirmationDetails?.[key] || [];
        if (JSON.stringify(expectedDetails) !== JSON.stringify(currentDetails)) {
          throw new AssistantError("Thông tin người nhận hoặc nội dung đã thay đổi kể từ bản xem trước. Chưa thực hiện; vui lòng kiểm tra và xác nhận lại.", 409);
        }
      }
    }
    if (["PATCH", "PUT"].includes(op.method) && !hasUpdatePayload(op, checked.values)) throw new AssistantError(updateDetailsQuestion(op, input.text || pending?.intent || "", checked.values));
    await AssistantTurnModel.updateOne({ _id: turn._id }, { $set: { status: "executing", actionId: op.id, workflowVersion: workflow.version, payload: checked.values } });
    hasDispatched = op.method !== "GET";
    if (op.method === "GET" && (op.adapter === "contract" || op.rawResponse)) {
      const result = await callOperation(req, op, checked.values);
      pending = null;
      return { status: "completed", reply: formatAssistantResult(op, result?.data ?? result), link: op.link };
    }
    if (op.method === "GET") {
      const rows = await lookupRecords(req, op.id, String(values.search || ""), values);
      pending = null;
      const shown = rows.slice(0, 15);
      return { status: "completed", reply: shown.length ? `${op.title} — ${shown.length} kết quả hiển thị (phạm vi danh sách API trả về):\n${shown.map(row => Object.entries(row).filter(([key]) => key !== "id" && key !== "_id" && key.toLowerCase() !== "uid" && !/(?:Id|Uid|Ids|Uids)$/i.test(key)).map(([key, value]) => `${resultLabel(op, key)}: ${value}`).join(" | ")).join("\n")}` : "Không có kết quả phù hợp trong danh sách được phép truy cập. Bạn có thể cung cấp tên hoặc mã chính xác hơn.", link: op.link };
    }
    const result = await callOperation(req, op, checked.values, password, input.requestId);
    if (op.adapter === "contract" || op.rawResponse) {
      pending = null;
      return { status: "completed", reply: formatAssistantResult(op, result?.data ?? result), link: op.link };
    }
    const records = projectRecords(op, result, req);
    pending = null;
    const createdRecord = records[0];
    const createdKey = createdRecord && ["displayName", "name", "title", "fullName", "customerCode", "code", "ticketCode"].find(key => createdRecord[key] !== undefined);
    const createdLabel = createdKey && createdRecord ? String(createdRecord[createdKey]) : "";
    return { status: "completed", reply: `Đã ${op.title.toLocaleLowerCase("vi")}.${createdLabel ? ` T\u00ean/m\u00e3: ${createdLabel}.` : ""}${op.id === "employee.create" ? " Hồ sơ và tài khoản đăng nhập được tạo với vai trò nhân viên (user)." : ""}`, link: op.link };
  };

  const prepare = async (actionId: string, provided: Record<string, unknown>, forceConfirmation = false, intent = input.text || ""): Promise<AssistantReply> => {
    const requestedOperation = operationById(actionId);
    if (requestedOperation?.method === "PATCH" && requestedOperation.path === "/partners/:id") {
      const normalizedIntent = normalizePartnerIntent(intent);
      if (/(?:thong tin (?:chuyen khoan|tai khoan)|chuyen khoan|bank account|bank details)/.test(normalizedIntent)) actionId = "partner.bank-details.update";
      else if (/(?:cau hinh hoa hong|hoa hong|commission)/.test(normalizedIntent)) actionId = "partner.commission.update";
    }
    const op = await assertOperation(req, actionId);
    const workflow = await currentWorkflow(req, actionId);
    const contextualValues = { ...provided };
    const previousPending = pending?.actionId === actionId ? pending : undefined;
    const skippedReferenceKeys = new Set(previousPending?.skippedReferenceKeys || []);
    for (const key of skippedReferenceTargets(input.text || "", op, previousPending?.awaitingReferenceKeys || [], previousPending?.awaitingReferenceLabels)) {
      skippedReferenceKeys.add(key);
      delete contextualValues[key];
    }
    for (const field of op.fields) if (contextualValues[field.key] !== undefined && String(contextualValues[field.key]).trim()) skippedReferenceKeys.delete(field.key);
    const selectedBranchField = op.fields.find(field => field.source === "query" && field.apiKey === "branchId");
    if (req.user?.branchId && selectedBranchField && contextualValues[selectedBranchField.key] === undefined) contextualValues[selectedBranchField.key] = req.user.branchId;
    const selectedValues = await resolveNamedReferenceSelectors(req, op, contextualValues);
    for (const key of populatedNestedReferenceKeys(op, selectedValues)) skippedReferenceKeys.delete(key);
    const collected = collectValues(workflow, selectedValues);
    const id = randomUUID();
    const preview = { id, requiresPassword: op.id === "employee.create", title: workflow.title, values: workflow.fields.filter(f => collected.values[f.key] !== undefined).map(f => ({ label: f.label, value: collected.values[f.key], defaulted: collected.defaulted.includes(f.key) })) };
    const references = await resolveReferences(req, op, collected.values);
    if (op.id === "access.role-permissions.save" && typeof references.labels.permissions === "string") {
      try {
        const selectedNames = JSON.parse(references.labels.permissions);
        if (Array.isArray(selectedNames)) references.labels.permissions = selectedNames.map(value => String(value)).join("; ") || "Không cấp quyền nào";
      } catch { /* structured validation will keep malformed values from reaching the route */ }
    }
    const confirmationDetails = references.confirmationDetails || {};
    const relationshipPrompts = await missingReferencePrompts(req, op, workflow, references.values, intent, skippedReferenceKeys);
    pending = {
      id,
      actionId,
      provided: Object.fromEntries(Object.entries(selectedValues).filter(([key]) => op.fields.some(field => field.key === key))),
      intent,
      workflowVersion: workflow.version,
      preview,
      confirmationDetails,
      awaitingReferenceKeys: relationshipPrompts.awaitingOptional,
      awaitingReferenceLabels: relationshipPrompts.awaitingLabels,
      skippedReferenceKeys: [...skippedReferenceKeys],
    };
    if (collected.missing.length || collected.errors.length || references.errors.length || relationshipPrompts.prompts.length) {
      const lines = [
        ...(collected.missing.length ? [`Để ${workflow.title.toLocaleLowerCase("vi")}, bạn vui lòng bổ sung: ${collected.missing.join(", ")}.`] : []),
        ...collected.errors,
        ...references.errors,
        ...(relationshipPrompts.prompts.length ? [`Lựa chọn cho thông tin liên kết:\n${relationshipPrompts.prompts.join("\n")}`] : []),
        ...(collected.defaulted.length ? [`Thông tin dùng mặc định: ${workflow.fields.filter(f => collected.defaulted.includes(f.key)).map(f => `${f.label} = ${String(f.defaultValue)}`).join("; ")}.`] : []),
      ];
      return { status: "collecting", reply: lines.join("\n"), action: preview };
    }
    if (["PATCH", "PUT"].includes(op.method) && !hasUpdatePayload(op, references.values)) {
      return { status: "collecting", reply: updateDetailsQuestion(op, intent, references.values), action: preview };
    }
    if (op.path === "/partners/:id" && /(?:thông tin (?:chuyển khoản|tài khoản)|chuyển khoản|cấu hình hoa hồng|hoa hồng|hoa hong|commission)/i.test(intent)) {
      const question = updateDetailsQuestion(op, intent, references.values);
      if (question !== "Bạn muốn thay đổi thông tin nào của bản ghi này?") return { status: "collecting", reply: question, action: preview };
    }
    pending.resolved = references.values;
    preview.values = workflow.fields.filter(f => references.values[f.key] !== undefined).map(f => ({ label: f.label, value: references.labels[f.key] || references.values[f.key], defaulted: collected.defaulted.includes(f.key) }));
    preview.values.push(...Object.values(confirmationDetails).flat().map(detail => ({ label: detail.label, value: detail.value, defaulted: false })));
    if (op.optionalPathFields?.includes("id") && references.labels.path_id) preview.values.push({ label: "Ca POS", value: references.labels.path_id, defaulted: false });
    if (((await getSettings(req)).alwaysConfirm && op.method !== "GET") || workflow.requireConfirmation || forceConfirmation || op.id === "employee.create") return { status: "confirmation", reply: op.id === "employee.create"
      ? "Thông tin hồ sơ đã đủ. Hồ sơ nhân sự gắn với một tài khoản đăng nhập. Nhập mật khẩu khởi tạo trong ô bảo mật bên dưới; không gửi mật khẩu trong tin nhắn."
      : op.id === "access.role-permissions.save"
        ? "Bạn đang thay toàn bộ danh sách quyền của vai trò này; thay đổi sẽ áp dụng cho mọi tài khoản mang vai trò đó. Hãy kiểm tra từng quyền và cấp bậc trong bản xem trước rồi xác nhận."
        : "Thông tin đã đủ. Vui lòng kiểm tra bản xem trước và xác nhận để thực hiện.", action: preview };
    return execute(op, workflow, references.values);
  };

  try {
    if (input.decision) {
      if (!pending || pending.id !== input.decision.id || !pending.resolved) throw new AssistantError("Bản xem trước đã hết hiệu lực. Hãy gửi lại yêu cầu để kiểm tra.", 409);
      if (!input.decision.confirmed) { pending = null; reply = { status: "cancelled", reply: "Đã hủy thao tác. Không thay đổi dữ liệu." }; }
      else {
        const workflow = await currentWorkflow(req, pending.actionId);
        reply = workflow.version !== pending.workflowVersion
          ? await prepare(pending.actionId, pending.provided, true, pending.intent)
          : pending.preview.requiresPassword && !input.decision.password
            ? { status: "confirmation", reply: "Vui lòng nhập lại mật khẩu khởi tạo trong ô bảo mật. Mật khẩu không được lưu khi tải lại trang.", action: pending.preview }
          : await execute(await assertOperation(req, pending.actionId), workflow, pending.resolved, input.decision.password);
      }
    } else {
      const workflows = (await listWorkflows(req)).filter(w => w.enabled);
      const interpreted = await interpretRequest(input.text!, workflows, pending ? { actionId: pending.actionId, values: pending.provided } : null, session.messages as any, (await getSettings(req)).instructions);
      if (interpreted.cancel === true) { pending = null; reply = { status: "cancelled", reply: "Đã hủy yêu cầu đang thu thập. Không thay đổi dữ liệu." }; }
      else if (isPartnerDetailsIntent(input.text || "") || pending?.actionId === ASSISTANT_OPERATIONS.find(op => op.method === "GET" && op.path === "/partners/:id")?.id) {
        const operation = ASSISTANT_OPERATIONS.find(op => op.method === "GET" && op.path === "/partners/:id");
        const workflow = operation && workflows.find(candidate => candidate.actionId === operation.id);
        if (!workflow) {
          reply = { status: "unsupported", reply: "Workflow xem thông tin đối tác chưa khả dụng theo quyền hoặc cài đặt trợ lý của tài khoản này." };
        } else {
          const continuing = pending?.actionId === workflow.actionId && !interpreted.newRequest;
          const provided = { ...(continuing ? pending!.provided : {}), ...interpreted.values };
          const contextualReference = contextualPendingPartnerReference(input.text || "", pending);
          if (contextualReference && !provided.path_id) provided.path_id = contextualReference;
          reply = await prepare(workflow.actionId, provided, false, continuing ? pending!.intent : input.text || "");
        }
      }
      else if (isPartnerBankUpdateIntent(input.text || "")) {
        const actionId = "partner.bank-details.update";
        const workflow = workflows.find(candidate => candidate.actionId === actionId);
        if (!workflow) {
          reply = { status: "unsupported", reply: "Workflow cập nhật thông tin chuyển khoản đối tác chưa khả dụng theo quyền hoặc cài đặt trợ lý của tài khoản này." };
        } else {
          const continuing = pending?.actionId === actionId && !interpreted.newRequest;
          const contextualReference = contextualPendingPartnerReference(input.text || "", pending);
          const interpretedOperation = operationById(interpreted.actionId || "");
          const genericPartnerUpdate = interpretedOperation?.method === "PATCH" && interpretedOperation.path === "/partners/:id";
          const values = interpreted.actionId === actionId || genericPartnerUpdate
            ? interpreted.values
            : (await interpretRequest(input.text!, [workflow], contextualReference ? { actionId, values: { path_id: contextualReference } } : null, session.messages as any, (await getSettings(req)).instructions)).values;
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
          reply = { status: "unsupported", reply: "Workflow tạo cấu hình hoa hồng hiện chưa khả dụng theo quyền hoặc cài đặt trợ lý của tài khoản này." };
        }
      }
      else if (isPartnerCommissionUpdateIntent(input.text || "", Boolean(pendingPartnerReference(pending)))) {
        const operation = ASSISTANT_OPERATIONS.find(op => op.id === "partner.commission.update");
        const workflow = operation && workflows.find(candidate => candidate.actionId === operation.id);
        if (!workflow) {
          reply = { status: "unsupported", reply: "Workflow cập nhật hoa hồng đối tác chưa khả dụng theo quyền hoặc cài đặt trợ lý của tài khoản này." };
        } else {
          const continuing = pending?.actionId === workflow.actionId && !interpreted.newRequest;
          const contextualReference = contextualPendingPartnerReference(input.text || "", pending);
          const interpretedOperation = operationById(interpreted.actionId || "");
          const genericPartnerUpdate = interpretedOperation?.method === "PATCH" && interpretedOperation.path === "/partners/:id";
          const values = interpreted.actionId === workflow.actionId || genericPartnerUpdate
            ? interpreted.values
            : (await interpretRequest(input.text!, [workflow], continuing ? { actionId: pending!.actionId, values: pending!.provided } : contextualReference ? { actionId: workflow.actionId, values: { path_id: contextualReference } } : null, session.messages as any, (await getSettings(req)).instructions)).values;
          const provided = { ...(continuing ? pending!.provided : {}), ...(contextualReference ? { path_id: contextualReference } : {}), ...values };
          reply = await prepare(genericPartnerUpdate ? interpreted.actionId! : workflow.actionId, provided, false, continuing ? pending!.intent : input.text || "");
        }
      }
      else if (!interpreted.actionId) {
        const suggestions = (interpreted.suggestedActionIds || []).map(id => workflows.find(workflow => workflow.actionId === id)).filter((workflow): workflow is AssistantWorkflow => Boolean(workflow)).slice(0, 3);
        const suggestionText = suggestions.length
          ? `Tôi chưa rõ bạn muốn làm thao tác nào. Bạn muốn: ${suggestions.map(workflow => `“${workflow.title}”`).join(", ")}? Hãy nêu rõ thao tác; chưa có dữ liệu nào được thay đổi.`
          : `Tôi hỗ trợ thực hiện các workflow đã tích hợp theo quyền của bạn. Vui lòng yêu cầu một thao tác cụ thể; có thể xem danh sách tại “Workflow của tôi”.`;
        reply = { status: "unsupported", reply: `${suggestionText}${pending ? " Yêu cầu trước vẫn đang được giữ; bạn có thể bổ sung thông tin hoặc yêu cầu hủy." : ""}` };
      }
      else {
        const continuing = pending?.actionId === interpreted.actionId && !interpreted.newRequest;
        const provided = { ...(continuing ? pending!.provided : {}), ...interpreted.values };
        reply = await prepare(interpreted.actionId, provided, false, continuing ? pending!.intent : input.text || "");
      }
    }
  } catch (error) {
    const uncertain = error instanceof UncertainExecutionError || (hasDispatched && !(error instanceof AssistantError));
    reply = uncertain ? { ...uncertainReply(), link: pending ? operationById(pending.actionId)?.link : undefined } : { status: "failed", reply: error instanceof AssistantError ? error.message : "Không thể xử lý yêu cầu lúc này. Chưa xác nhận thao tác nào thành công. Vui lòng thử lại." };
    // Keep a valid preview when the user submits a mismatched confirmation ID;
    // clear pending work after failed requests or dispatched mutations.
    if (uncertain || (reply.status === "failed" && (!input.decision || hasDispatched))) pending = null;
  }
  try {
    await AssistantTurnModel.updateOne({ _id: turn._id }, { $set: { status: reply.status === "uncertain" ? "uncertain" : "completed", result: reply } });
    await AssistantSessionModel.updateOne(sessionFilter, { $set: { pending, lastReply: reply, messages: [...history, { role: "assistant", content: reply.reply }].slice(-40), busy: false } });
  } catch (error) {
    // A crash after the business API may leave an executing record. Never replay that mutation.
    if (hasDispatched) return { ...uncertainReply(), link: reply.link };
    throw error;
  }
  return reply;
}
