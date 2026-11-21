import { randomBytes, randomUUID, createHash } from "node:crypto";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { AssistantReply, AssistantValue, AssistantWorkflow } from "../../src/shared/assistant-workflow";
import type { PendingAction } from "./service";
import { operationById, type AssistantOperation } from "./catalog";
import { assertOperation, currentWorkflow } from "./workflows";
import { callOperation } from "./executor";
import { withBusinessCallOwner, pinBusinessWorkflowVersion } from "./business-call-gate";
import { AssistantError, collectValues } from "./policy";
import { executionFingerprint } from "./execution-budget";
import { pinProductReadProof, verifiedProductDetailResult } from "./product-read-prototype";
import { interpretProductReadV2 } from "./semantic-read-v2";
import {
  READ_V2_TTL, hasPrivateReadV2Value, isReadV2Action, readV2Enabled, ReadV2ClarificationError,
  type ClientReadTurnV2, type ContextV2, type EntityV2, type PublicProductV2, type ExtractedV2,
  type EvidenceV2, type ProvenanceV2, type PendingReadV2, type ClarificationReadV2,
} from "./read-v2-contract";

const opaque = (prefix: string, bytes = 18) => `${prefix}_${randomBytes(bytes).toString("base64url")}`;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const readV2Owner = (req: AuthenticatedRequest, conversationId: string) => JSON.stringify([req.user?.id, req.user?.companyCode, req.user?.branchId || "", conversationId]);
const workflowDigest = (op: AssistantOperation, workflow: AssistantWorkflow) => executionFingerprint("read-v2-workflow", { op, workflow });
const nfc = (value: string) => value.normalize("NFC");
const label = (value: PublicProductV2) => value.productCode ? `${value.name} [mã: ${value.productCode}]` : value.name;
function publicProduct(value: any): PublicProductV2 {
  if (!value || typeof value.name !== "string" || !value.name.trim() || value.name.length > 300
    || hasPrivateReadV2Value(value.name) || (value.productCode && (typeof value.productCode !== "string" || value.productCode.length > 100 || hasPrivateReadV2Value(value.productCode)))) {
    throw new ReadV2ClarificationError("UNSAFE_PUBLIC_PRODUCT", "Thông tin hiển thị của sản phẩm chưa phù hợp để tra cứu V2. Bạn kiểm tra lại sản phẩm nhé.");
  }
  return { name: value.name, ...(value.productCode ? { productCode: value.productCode } : {}),
    ...(typeof value.status === "string" && value.status.length <= 40 && !hasPrivateReadV2Value(value.status) ? { status: value.status } : {}) };
}
async function authority(req: AuthenticatedRequest, actionId: string) {
  if (!isReadV2Action(actionId)) throw new AssistantError("V2 hiện chỉ hỗ trợ tra cứu danh sách và chi tiết sản phẩm.", 409);
  const op = await assertOperation(req, actionId);
  const workflow = await currentWorkflow(req, actionId);
  if (!op || op.method !== "GET" || !workflow.enabled || op.path !== operationById(actionId)?.path) throw new AssistantError("Thao tác chưa nằm trong phạm vi V2 đã kiểm chứng.", 409);
  return { op, workflow };
}
async function exact(req: AuthenticatedRequest, request: ClientReadTurnV2, id: string): Promise<EntityV2> {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new AssistantError("Đối tượng sản phẩm không hợp lệ.", 409);
  id = id.toLowerCase();
  const { op, workflow } = await authority(req, "inventory.product.detail");
  return withBusinessCallOwner(op.id, "prepare", request.requestId, async () => {
    pinBusinessWorkflowVersion(workflow.version);
    const response = await callOperation(req, op, { path_id: id });
    const product = publicProduct(response?.data);
    const proof = pinProductReadProof(req, request.conversationId, randomUUID(), op, workflow, { path_id: id }, { path_id: label(product) });
    if (!proof) throw new AssistantError("Chưa xác thực được đối tượng sản phẩm.", 409);
    verifiedProductDetailResult(response, proof, op, req, { path_id: id });
    return { handle: opaque("h"), recordId: id, public: product, origin: "screen" };
  });
}
export function validatePendingReadV2(req: AuthenticatedRequest, request: ClientReadTurnV2, pending: PendingAction | null) {
  const state = pending?.readV2;
  if (!pending || !state || state.schemaVersion !== 2 || !isReadV2Action(pending.actionId)
    || !Number.isSafeInteger(state.pendingVersion) || state.pendingVersion < 1 || !Array.isArray(state.options)
    || !state.context || state.context.version !== 2 || !Array.isArray(state.context.entities)
    || state.owner !== readV2Owner(req, request.conversationId) || state.context.owner !== state.owner) {
    throw new ReadV2ClarificationError("INVALID_PENDING", "Lựa chọn không còn hợp lệ trong cuộc trò chuyện này. Bạn gửi lại yêu cầu nhé.");
  }
  if (!Number.isFinite(state.createdAt) || !Number.isFinite(state.expiresAt) || state.expiresAt <= Date.now()
    || state.expiresAt - state.createdAt !== READ_V2_TTL.pending) {
    throw new ReadV2ClarificationError("EXPIRED_PENDING", "Yêu cầu đang chờ đã hết hạn. Bạn gửi lại tên hoặc mã sản phẩm để chuẩn bị lại nhé.");
  }
  if (request.input.kind !== "text" && (pending.id !== request.input.pendingId || state.pendingVersion !== request.input.pendingVersion)) {
    throw new ReadV2ClarificationError("STALE_PENDING_VERSION", "Lựa chọn hoặc bản xác nhận đã thay đổi. Bạn dùng lựa chọn mới nhất nhé.");
  }
  return state;
}
function activeEntity(context: ContextV2, evidence: EvidenceV2, text: string) {
  if (context.expiresAt <= Date.now() || evidence.kind === "text_quote" || evidence.contextRef !== context.contextId) throw new ReadV2ClarificationError("STALE_HANDLE");
  const entity = context.entities.find(item => item.handle === evidence.handle);
  if (!entity) throw new ReadV2ClarificationError("UNKNOWN_HANDLE");
  if (evidence.kind === "context_field" && !entity.public[evidence.field]) throw new ReadV2ClarificationError("UNSOURCED_VALUE");
  if (context.entities.length !== 1) {
    const mentioned = context.entities.filter(item => [item.public.productCode, item.public.name].some(value => value && nfc(text).includes(nfc(value))));
    if (mentioned.length !== 1 || mentioned[0].handle !== entity.handle) throw new ReadV2ClarificationError("AMBIGUOUS_CONTEXT", "Bạn đang chọn nhiều sản phẩm. Bạn nêu tên hoặc mã sản phẩm cần xem nhé.");
  }
  return entity;
}
export function verifyReadV2Extraction(claim: ExtractedV2, field: "search" | "path_id", inputRef: string, text: string, context: ContextV2): { value: string; provenance: ProvenanceV2 } {
  const raw = nfc(claim.raw).trim();
  if (!raw || raw.length > 100 || hasPrivateReadV2Value(raw)) throw new ReadV2ClarificationError("UNSOURCED_VALUE");
  const evidence = claim.evidence;
  if (evidence.kind === "text_quote") {
    if (claim.source !== "utterance" || evidence.inputRef !== inputRef) throw new ReadV2ClarificationError("UNSOURCED_VALUE");
    const input = nfc(text), quote = nfc(evidence.quote);
    const first = input.indexOf(quote);
    if (!quote.trim() || first < 0 || input.indexOf(quote, first + 1) >= 0 || raw !== quote.trim()) throw new ReadV2ClarificationError("UNSOURCED_VALUE");
    const canonicalStart = [...input.slice(0, first)].length;
    return { value: raw, provenance: { field, source: "utterance", inputHash: hash(input), quote, canonicalStart, canonicalEnd: canonicalStart + [...quote].length } };
  }
  const entity = activeEntity(context, evidence, text);
  if (evidence.kind !== "context_field" || claim.source !== entity.origin || raw !== nfc(entity.public[evidence.field] || "").trim()) throw new ReadV2ClarificationError("UNSOURCED_VALUE");
  return { value: raw, provenance: { field, source: entity.origin, contextId: context.contextId, handle: entity.handle } };
}
async function buildContext(req: AuthenticatedRequest, request: ClientReadTurnV2, previous?: ContextV2): Promise<ContextV2> {
  const now = Date.now(), owner = readV2Owner(req, request.conversationId);
  const screen = request.input.kind === "text" ? request.input.screenContext : undefined;
  const validPrevious = previous?.version === 2 && previous.owner === owner && Array.isArray(previous.entities) && previous.expiresAt > now ? previous : undefined;
  const context: ContextV2 = { version: 2, owner, contextId: opaque("ctx"), contextVersion: (validPrevious?.contextVersion || 0) + 1,
    entities: [], verifiedAt: now, expiresAt: now + READ_V2_TTL.context, retentionUntil: now + READ_V2_TTL.context + READ_V2_TTL.retention };
  let ids: string[] = [];
  if (screen) {
    const captured = Date.parse(screen.capturedAt);
    if (!Number.isFinite(captured) || captured > now + 30_000 || now - captured >= READ_V2_TTL.context
      || (screen.pageType === "detail" && !screen.entity) || (screen.pageType === "list" && screen.entity)
      || (validPrevious?.view?.instance === screen.viewInstance && screen.revision < validPrevious.view.revision)) {
      throw new ReadV2ClarificationError("STALE_CONTEXT", "Ngữ cảnh trang đã hết hiệu lực hoặc thay đổi. Bạn chọn lại sản phẩm cần xem nhé.");
    }
    ids = screen.entity ? [screen.entity.id] : screen.selection?.ids || [];
    context.view = { instance: screen.viewInstance, revision: screen.revision };
  } else if (validPrevious) ids = validPrevious.entities.map(item => item.recordId);
  // Screen hints are re-read through the exact API before any model DTO is built.
  for (const id of ids) context.entities.push({ ...await exact(req, request, id), origin: screen ? "screen" : "session" });
  return context;
}
export interface PreparedReadV2 {
  pending: PendingAction | null; context: ContextV2; provenance: ProvenanceV2[];
  effectiveSnapshotHash: string; reply?: AssistantReply; clarification?: ClarificationReadV2;
  execute?: { op: AssistantOperation; workflow: AssistantWorkflow; values: Record<string, AssistantValue> };
}
export async function prepareProductReadV2(
  req: AuthenticatedRequest, request: ClientReadTurnV2, previous: PendingAction | null, previousContext?: ContextV2,
): Promise<PreparedReadV2> {
  const now = Date.now(), owner = readV2Owner(req, request.conversationId);
  let context: ContextV2, actionId: "product.list" | "inventory.product.detail", values: Record<string, AssistantValue> = {};
  let target: { recordId: string; public: PublicProductV2 } | undefined;
  let provenance: ProvenanceV2[] = [], forceConfirmation = false;
  let oldState: PendingReadV2 | undefined;
  if (request.input.kind === "text" && previous?.readV2?.schemaVersion === 2 && previous.readV2.owner === owner && previous.readV2.expiresAt <= now) previous = null;
  if (previous) {
    if (!previous.readV2) throw new ReadV2ClarificationError("LEGACY_PENDING", "Bạn hoàn tất hoặc hủy yêu cầu đang chờ trước khi gửi yêu cầu tra cứu mới nhé.");
    oldState = validatePendingReadV2(req, request, previous);
  }
  if (request.input.kind !== "text") {
    if (!previous || !oldState) throw new ReadV2ClarificationError("MISSING_PENDING");
    context = structuredClone(oldState.context);
    actionId = previous.actionId as typeof actionId;
    provenance = structuredClone(oldState.provenance);
    if (request.input.kind === "decision" && oldState.kind === "confirmation" && !request.input.confirmed) {
      return { pending: null, context, provenance, effectiveSnapshotHash: executionFingerprint("read-v2-snapshot", context), reply: { status: "cancelled", reply: "Đã hủy yêu cầu tra cứu đang chờ." } };
    }
    const { op, workflow } = await authority(req, actionId);
    if (request.input.kind === "decision") {
      if (oldState.kind !== "confirmation") throw new ReadV2ClarificationError("NOT_CONFIRMATION");
      values = { ...previous.resolved };
      const binding = context.entities.find(item => item.recordId === values.path_id);
      forceConfirmation = oldState.workflowDigest !== workflowDigest(op, workflow);
      if (actionId === "inventory.product.detail") {
        if (!binding) throw new ReadV2ClarificationError("MISSING_TARGET");
        // An expired snapshot or a changed preview requires fresh data. A valid pin
        // uses the primary exact GET as its revalidation, without reading twice.
        if (context.expiresAt <= now || forceConfirmation) context = await buildContext(req, { ...request, input: { kind: "text", text: "", screenContext: { version: 2, route: "/kho-san-pham", pageType: "detail", entity: { type: "product", id: binding.recordId }, viewInstance: "resume", revision: 0, capturedAt: new Date(now).toISOString() } } });
        target = { recordId: binding.recordId, public: context.entities[0].public };
      }
      if (!forceConfirmation) {
        const refreshed = { ...previous, ...(actionId === "inventory.product.detail" ? { productReadProof: pinProductReadProof(req, request.conversationId, previous.id, op, workflow, values, { path_id: label(target!.public) }) } : {}) };
        return { pending: refreshed, context, provenance, effectiveSnapshotHash: executionFingerprint("read-v2-snapshot", context), execute: { op, workflow, values } };
      }
    } else {
      if (oldState.kind !== "choose_entity") throw new ReadV2ClarificationError("NOT_SELECTION");
      const selected = oldState.options.find(option => option.tokenHash === hash(request.input.kind === "selection" ? request.input.optionToken : ""));
      if (!selected || selected.expiresAt <= now) throw new ReadV2ClarificationError("EXPIRED_OPTION", "Lựa chọn đã hết hạn hoặc không hợp lệ. Bạn gửi lại tên hoặc mã sản phẩm nhé.");
      target = selected.target;
      forceConfirmation = oldState.workflowDigest !== workflowDigest(op, workflow);
      const refresh = context.expiresAt <= now || forceConfirmation;
      if (refresh) {
        const current = await exact(req, request, target.recordId);
        target = { recordId: current.recordId, public: current.public };
      }
      // Option pins its own target for 15min, independently of a 5min model handle.
      context = { ...context, contextId: opaque("ctx"), contextVersion: context.contextVersion + 1,
        ...(refresh ? { verifiedAt: now, expiresAt: now + READ_V2_TTL.context, retentionUntil: now + READ_V2_TTL.context + READ_V2_TTL.retention } : {}),
        entities: [{ handle: opaque("h"), ...target, origin: "session" }] };
      values = { path_id: target.recordId };
    }
  } else {
    if (!readV2Enabled()) throw new AssistantError("V2 chưa được bật để nhận yêu cầu mới. Lựa chọn hoặc xác nhận đang chờ vẫn có thể tiếp tục nếu còn hạn.", 409);
    if (hasPrivateReadV2Value(request.input.text)) throw new ReadV2ClarificationError("PRIVATE_INPUT", "Bạn dùng tên hoặc mã sản phẩm công khai, hoặc chọn sản phẩm trên trang để tra cứu nhé.");
    context = await buildContext(req, request, previousContext || oldState?.context);
    const inputRef = opaque("input");
    const interpreted = await interpretProductReadV2({ schemaVersion: 2, inputRef, text: request.input.text, contextRef: context.contextId,
      entities: context.entities.map(entity => ({ ...entity.public, handle: entity.handle, origin: entity.origin })),
      ...(previous && isReadV2Action(previous.actionId) ? { pending: { actionId: previous.actionId, kind: oldState!.kind } } : {}) });
    if (interpreted.cancel) return { pending: null, context, provenance, effectiveSnapshotHash: executionFingerprint("read-v2-snapshot", context), reply: { status: "cancelled", reply: "Đã hủy yêu cầu tra cứu đang chờ." } };
    if (interpreted.remainingRequests?.length) throw new ReadV2ClarificationError("MULTISTEP_NOT_SUPPORTED", "Hiện mình xử lý từng yêu cầu tra cứu. Bạn gửi từng yêu cầu giúp mình nhé.");
    if (interpreted.intentType !== "workflow" || !interpreted.proposal) return { pending: previous, context, provenance, effectiveSnapshotHash: executionFingerprint("read-v2-snapshot", context), reply: {
      status: interpreted.intentType === "ambiguous" ? "collecting" : "unsupported", reply: "Bạn muốn tìm danh sách hay xem chi tiết sản phẩm nào? Hiện mình chỉ hỗ trợ tra cứu theo tên hoặc mã sản phẩm." } };
    actionId = interpreted.proposal.actionId;
    if (previous && !interpreted.newRequest && actionId !== previous.actionId) throw new ReadV2ClarificationError("ACTION_CHANGED");
    if (actionId === "product.list") {
      const claim = interpreted.proposal.values.search;
      if (claim) { const verified = verifyReadV2Extraction(claim, "search", inputRef, request.input.text, context); values.search = verified.value; provenance.push(verified.provenance); }
      else if (request.input.screenContext?.filters?.search) throw new ReadV2ClarificationError("UNSOURCED_FILTER", "Bạn nêu từ khóa trên trang trong câu yêu cầu để mình tra cứu đúng phạm vi nhé.");
      if (request.input.screenContext?.filters?.search && values.search !== nfc(request.input.screenContext.filters.search).trim()) throw new ReadV2ClarificationError("CONFLICTING_FILTER", "Từ khóa yêu cầu khác bộ lọc trên trang. Bạn xác định lại từ khóa cần tra cứu nhé.");
    } else {
      const reference = interpreted.proposal.values.path_id;
      if (reference?.kind === "handle") {
        if (reference.evidence.kind === "text_quote" || reference.handle !== reference.evidence.handle) throw new ReadV2ClarificationError("UNSOURCED_HANDLE");
        const entity = activeEntity(context, reference.evidence, request.input.text);
        target = { recordId: entity.recordId, public: entity.public }; values.path_id = target.recordId;
        provenance.push({ field: "path_id", source: entity.origin, contextId: context.contextId, handle: entity.handle });
      } else if (reference?.kind === "name_or_code") {
        const verified = verifyReadV2Extraction(reference.extracted, "path_id", inputRef, request.input.text, context);
        values.path_id = verified.value; provenance.push(verified.provenance);
      }
    }
  }
  const { op, workflow } = await authority(req, actionId!);
  const inputValues = { ...values };
  let candidates: { recordId: string; public: PublicProductV2 }[] = [];
  if (actionId === "inventory.product.detail" && !target && typeof values.path_id === "string") {
    const response = await withBusinessCallOwner(op.id, "prepare", request.requestId, async () => {
      pinBusinessWorkflowVersion(workflow.version);
      await assertOperation(req, "product.list");
      return callOperation(req, operationById("product.list")!, { search: values.path_id });
    });
    const items = response?.data?.items, total = response?.data?.total;
    if (!Array.isArray(items) || !Number.isSafeInteger(total) || total < items.length) throw new AssistantError("Chưa đọc được danh sách sản phẩm đầy đủ.", 502);
    if (total > items.length) throw new ReadV2ClarificationError("INCOMPLETE_REFERENCE", "Có quá nhiều sản phẩm phù hợp. Bạn nêu mã sản phẩm cụ thể hơn nhé.");
    candidates = items.map(item => {
      if (!/^[a-f\d]{24}$/i.test(String(item._id || "")) || item.companyCode !== req.user?.companyCode) throw new AssistantError("Dữ liệu tra cứu không đúng phạm vi sản phẩm.", 409);
      return { recordId: String(item._id), public: publicProduct(item) };
    });
    const search = nfc(values.path_id).toLocaleLowerCase("vi-VN");
    const exactMatches = candidates.filter(item => [item.public.name, item.public.productCode].some(value => value && nfc(value).toLocaleLowerCase("vi-VN") === search));
    if (exactMatches.length === 1) target = exactMatches[0];
    else if (exactMatches.length > 1) candidates = exactMatches;
    // Search may match keyword/SKU/partial text. Even one fuzzy hit requires explicit selection.
  }
  if (target) {
    values.path_id = target.recordId;
    context.entities = [{ handle: opaque("h"), ...target, origin: "session" }];
  }
  const collected = collectValues(workflow, values);
  if (collected.errors.length) throw new ReadV2ClarificationError("INVALID_FIELD");
  for (const key of collected.defaulted) {
    if ((key === "search" || key === "path_id") && !provenance.some(item => item.field === key)) provenance.push({ field: key, source: "server_default" });
  }
  const id = randomUUID();
  const options: NonNullable<ClarificationReadV2["options"]> = [];
  const privateOptions: PendingReadV2["options"] = [];
  if (!target && actionId === "inventory.product.detail") {
    for (const item of candidates.slice(0, 8)) {
      const publicLabel = label(item.public);
      if (candidates.filter(candidate => label(candidate.public) === publicLabel).length !== 1) continue;
      const token = opaque("opt", 32);
      options.push({ optionToken: token, label: publicLabel });
      privateOptions.push({ tokenHash: hash(token), target: item, expiresAt: now + READ_V2_TTL.option });
    }
  }
  const needsTarget = actionId === "inventory.product.detail" && !target;
  const needsFields = needsTarget || collected.missing.length > 0;
  const kind = needsFields ? options.length ? "choose_entity" : "fill_fields" : "confirmation";
  const createdAt = oldState?.createdAt ?? now, expiresAt = createdAt + READ_V2_TTL.pending;
  for (const option of privateOptions) option.expiresAt = Math.min(option.expiresAt, expiresAt);
  const state: PendingReadV2 = { schemaVersion: 2, pendingVersion: (oldState?.pendingVersion || 0) + 1, owner, kind,
    createdAt, expiresAt, retentionUntil: expiresAt + READ_V2_TTL.retention, workflowDigest: workflowDigest(op, workflow), context, provenance, options: privateOptions };
  const preview: PendingAction["preview"] = { id, title: workflow.title, values: target ? [{ label: "Sản phẩm", value: label(target.public) }]
    : typeof values.search === "string" ? [{ label: "Từ khóa", value: values.search }] : [] };
  const pending: PendingAction = { id, actionId, provided: actionId === "product.list" ? inputValues : target ? { path_id: label(target.public) } : {},
    intent: request.input.kind === "text" ? request.input.text : previous!.intent, workflowVersion: workflow.version, preview, readV2: state, defaultedKeys: collected.defaulted,
    ...(!needsFields ? { resolved: collected.values } : {}),
    ...(target ? { productReadProof: pinProductReadProof(req, request.conversationId, id, op, workflow, collected.values, { path_id: label(target.public) }) } : {}) };
  const effectiveSnapshotHash = executionFingerprint("read-v2-snapshot", { context, values, provenance, workflowDigest: state.workflowDigest });
  if (needsFields) {
    const question = options.length ? "Bạn chọn sản phẩm theo tên và mã bên dưới nhé." : actionId === "product.list" ? "Bạn nêu từ khóa tìm sản phẩm giúp mình nhé." : "Bạn nêu tên hoặc mã sản phẩm cụ thể cần xem nhé.";
    return { pending, context, provenance, effectiveSnapshotHash, reply: { status: "collecting", reply: question }, clarification: {
      schemaVersion: 2, pendingId: id, pendingVersion: state.pendingVersion, kind, question, ...(options.length ? { options } : {}), allowFreeText: true,
      ...(!options.length ? { fields: [{ key: actionId === "product.list" ? "search" as const : "path_id" as const, type: "text" as const, required: true, label: actionId === "product.list" ? "Từ khóa" : "Sản phẩm" }] } : {}),
      expiresAt: new Date(options.length ? Math.min(...privateOptions.map(option => option.expiresAt)) : expiresAt).toISOString(),
    } };
  }
  if (workflow.requireConfirmation || forceConfirmation) {
    const question = "Bạn kiểm tra thông tin bên dưới rồi xác nhận giúp mình nhé.";
    return { pending, context, provenance, effectiveSnapshotHash, reply: { status: "confirmation", reply: question, action: preview }, clarification: {
      schemaVersion: 2, pendingId: id, pendingVersion: state.pendingVersion, kind: "confirmation", question, allowFreeText: true, expiresAt: new Date(expiresAt).toISOString(),
    } };
  }
  return { pending, context, provenance, effectiveSnapshotHash, execute: { op, workflow, values: collected.values } };
}
