import Joi from "joi";
import { executionFingerprint } from "./execution-budget";
import { AssistantError } from "./policy";

export const READ_V2_ACTIONS = ["product.list", "inventory.product.detail"] as const;
export type ReadV2Action = typeof READ_V2_ACTIONS[number];
export const READ_V2_TTL = { context: 5 * 60_000, option: 15 * 60_000, pending: 30 * 60_000, retention: 24 * 60 * 60_000 } as const;
export const isReadV2Action = (id: string): id is ReadV2Action => (READ_V2_ACTIONS as readonly string[]).includes(id);
export function readV2Environment() { return ["test", "development"].includes(process.env.NODE_ENV || ""); }
export function readV2Enabled() { return readV2Environment() && process.env.ASSISTANT_PRODUCT_READ_V2 === "true" && process.env.ASSISTANT_SAFE_EXECUTION === "true"; }

export interface ScreenContextV2 {
  version: 2; route: "/kho-san-pham"; viewInstance: string; revision: number; capturedAt: string;
  pageType: "list" | "detail"; entity?: { type: "product"; id: string };
  selection?: { type: "product"; ids: string[] }; filters?: { search?: string };
}
export interface ClientReadTurnV2 {
  schemaVersion: 2; conversationId: string; requestId: string; mode: "work";
  input: { kind: "text"; text: string; screenContext?: ScreenContextV2 }
    | { kind: "selection"; pendingId: string; pendingVersion: number; optionToken: string }
    | { kind: "decision"; pendingId: string; pendingVersion: number; confirmed: boolean };
}
const uuid = () => Joi.string().guid({ version: ["uuidv4"] });
const recordId = () => Joi.string().pattern(/^[a-f\d]{24}$/i);
const bounded = (max = 100) => Joi.string().min(1).max(max);
const strict = (keys: Joi.SchemaMap) => Joi.object(keys).unknown(false);
export const assistantReadV2Body = strict({
  schemaVersion: Joi.number().valid(2).required(), conversationId: uuid().required(), requestId: uuid().required(), mode: Joi.string().valid("work").required(),
  input: Joi.alternatives().try(
    strict({ kind: Joi.string().valid("text").required(), text: bounded(6000).trim().required(), screenContext: strict({
      version: Joi.number().valid(2).required(), route: Joi.string().valid("/kho-san-pham").required(),
      viewInstance: bounded(100).required(), revision: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER).required(),
      capturedAt: Joi.string().isoDate().required(), pageType: Joi.string().valid("list", "detail").required(),
      entity: strict({ type: Joi.string().valid("product").required(), id: recordId().required() }),
      selection: strict({ type: Joi.string().valid("product").required(), ids: Joi.array().items(recordId()).min(1).max(10).unique((a: string, b: string) => a.toLowerCase() === b.toLowerCase()).required() }),
      filters: strict({ search: bounded() }),
    }).oxor("entity", "selection") }),
    strict({ kind: Joi.string().valid("selection").required(), pendingId: uuid().required(), pendingVersion: Joi.number().integer().min(1).required(), optionToken: Joi.string().pattern(/^opt_[A-Za-z0-9_-]{43}$/).required() }),
    strict({ kind: Joi.string().valid("decision").required(), pendingId: uuid().required(), pendingVersion: Joi.number().integer().min(1).required(), confirmed: Joi.boolean().required() }),
  ).required(),
}).strict();
export function validateReadV2Input(value: unknown): ClientReadTurnV2 {
  const result = assistantReadV2Body.validate(value, { convert: false, abortEarly: false });
  if (result.error) throw new AssistantError("Yêu cầu V2 không đúng định dạng hoặc có trường chưa hỗ trợ.", 400);
  return result.value as ClientReadTurnV2;
}
export const readV2Digest = (input: ClientReadTurnV2) => executionFingerprint("assistant.product-read.v2", input);
export class ReadV2ClarificationError extends AssistantError {
  constructor(public code: string, message = "Bạn nêu rõ tên hoặc mã sản phẩm cần tra cứu nhé.") { super(message, 409); }
}
// IDs/credentials in free text are not a supported way to grant a model access to records.
export function hasPrivateReadV2Value(value: string) {
  return /[a-f\d]{24}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}|opt_[A-Za-z0-9_-]{43}|\bBearer\s+\S+|\b(?:sk-|eyJ)[A-Za-z0-9_-]{12,}/i.test(value);
}
export type EvidenceV2 = { kind: "text_quote"; inputRef: string; quote: string }
  | { kind: "context_field"; contextRef: string; handle: string; field: "name" | "productCode" }
  | { kind: "selected_handle"; contextRef: string; handle: string };
export interface ExtractedV2 { raw: string; source: "utterance" | "screen" | "session"; evidence: EvidenceV2; }
export type ReferenceV2 = { kind: "name_or_code"; extracted: ExtractedV2 } | { kind: "handle"; handle: string; evidence: EvidenceV2 };
export interface InterpretationV2 {
  schemaVersion: 2; intentType: "workflow" | "ambiguous" | "unsupported" | "general_question";
  proposal?: { actionId: ReadV2Action; values: { search?: ExtractedV2; path_id?: ReferenceV2 } };
  cancel: boolean; newRequest: boolean; clarification?: string; remainingRequests?: string[];
}
const evidence = Joi.alternatives().try(
  strict({ kind: Joi.string().valid("text_quote").required(), inputRef: bounded(100).required(), quote: bounded(6000).required() }),
  strict({ kind: Joi.string().valid("context_field").required(), contextRef: bounded(100).required(), handle: bounded(100).required(), field: Joi.string().valid("name", "productCode").required() }),
  strict({ kind: Joi.string().valid("selected_handle").required(), contextRef: bounded(100).required(), handle: bounded(100).required() }),
);
const extracted = strict({ raw: bounded().required(), source: Joi.string().valid("utterance", "screen", "session").required(), evidence: evidence.required() });
const interpretationSchema = strict({
  schemaVersion: Joi.number().valid(2).required(), intentType: Joi.string().valid("workflow", "ambiguous", "unsupported", "general_question").required(),
  proposal: Joi.alternatives().try(
    strict({ actionId: Joi.string().valid("product.list").required(), values: strict({ search: extracted }).required() }),
    strict({ actionId: Joi.string().valid("inventory.product.detail").required(), values: strict({ path_id: Joi.alternatives().try(
      strict({ kind: Joi.string().valid("name_or_code").required(), extracted: extracted.required() }),
      strict({ kind: Joi.string().valid("handle").required(), handle: bounded(100).required(), evidence: evidence.required() }),
    ) }).required() }),
  ),
  cancel: Joi.boolean().required(), newRequest: Joi.boolean().required(), clarification: bounded(500), remainingRequests: Joi.array().items(bounded(2000)).max(40),
}).strict();
export function validateReadV2Interpretation(value: unknown): InterpretationV2 {
  const result = interpretationSchema.validate(value, { convert: false, abortEarly: false });
  if (result.error || hasPrivateReadV2Value(JSON.stringify(value))) throw new AssistantError("Kết quả diễn giải V2 không hợp lệ. Chưa thực hiện tra cứu.", 502);
  const parsed = result.value as InterpretationV2;
  if (parsed.cancel ? Boolean(parsed.proposal) : parsed.intentType === "workflow" ? !parsed.proposal : Boolean(parsed.proposal)) throw new AssistantError("Kết quả diễn giải V2 không nhất quán.", 502);
  if (parsed.intentType === "ambiguous" && !parsed.cancel && !parsed.clarification) throw new AssistantError("Kết quả làm rõ V2 không hợp lệ.", 502);
  return parsed;
}

export interface PublicProductV2 { name: string; productCode?: string; status?: string; }
export interface EntityV2 { handle: string; recordId: string; public: PublicProductV2; origin: "screen" | "session"; }
export interface ContextV2 {
  version: 2; owner: string; contextId: string; contextVersion: number; entities: EntityV2[];
  verifiedAt: number; expiresAt: number; retentionUntil: number; view?: { instance: string; revision: number };
}
export interface ProvenanceV2 { field: "search" | "path_id"; source: "utterance" | "screen" | "session" | "server_default"; inputHash?: string; quote?: string; canonicalStart?: number; canonicalEnd?: number; contextId?: string; handle?: string; }
export interface PendingReadV2 {
  schemaVersion: 2; pendingVersion: number; owner: string; kind: "choose_entity" | "fill_fields" | "confirmation";
  createdAt: number; expiresAt: number; retentionUntil: number; workflowDigest: string;
  context: ContextV2; provenance: ProvenanceV2[];
  options: { tokenHash: string; target: { recordId: string; public: PublicProductV2 }; expiresAt: number }[];
}
export interface ClarificationReadV2 {
  schemaVersion: 2; pendingId: string; pendingVersion: number; kind: PendingReadV2["kind"];
  question: string; options?: { optionToken: string; label: string }[]; allowFreeText: boolean; expiresAt: string;
  fields?: { key: "search" | "path_id"; type: "text"; required: boolean; label: string }[];
}
