import { createHash } from "node:crypto";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { AssistantValue, AssistantWorkflow } from "../../src/shared/assistant-workflow";
import type { AssistantOperation } from "./catalog";
import { AssistantError } from "./policy";

// Prototype only. Production and background workers must always use the legacy path.
export function productReadPrototypeEnabled(background = false) {
  return !background && ["test", "development"].includes(process.env.NODE_ENV || "")
    && process.env.ASSISTANT_PRODUCT_DETAIL_EXACT_VERIFY === "true";
}

export interface ProductReadProofV1 {
  version: 1;
  entity: "Product";
  actionId: "inventory.product.detail";
  field: "path_id";
  targetId: string;
  publicLabel: string;
  owner: string;
  pendingId: string;
  workflowDigest: string;
  issuedAt: number;
  expiresAt: number;
}
const PROOF_TTL_MS = 5 * 60_000; // Local prototype limit, not an approved rollout TTL.
const ownerKey = (req: AuthenticatedRequest, conversationId: string) => JSON.stringify([
  req.user?.id, req.user?.companyCode, req.user?.branchId || "", conversationId,
]);
const workflowDigest = (operation: AssistantOperation, workflow: AssistantWorkflow) =>
  createHash("sha256").update(JSON.stringify({ operation, workflow })).digest("hex");
function eligible(operation: AssistantOperation) {
  return operation.id === "inventory.product.detail" && operation.method === "GET"
    && operation.path === "/inventory/catalog/products/:id"
    && operation.fields.filter(field => field.reference).length === 1
    && operation.fields.some(field => field.key === "path_id" && field.source === "path" && field.reference === "product.list");
}

// Called only after prepare's real resolver succeeded. Never deserialize a proof from values/input.
export function pinProductReadProof(
  req: AuthenticatedRequest, conversationId: string, pendingId: string,
  operation: AssistantOperation, workflow: AssistantWorkflow,
  resolved: Record<string, AssistantValue>, labels: Record<string, string>,
): ProductReadProofV1 | undefined {
  if (!eligible(operation) || !/^[a-f\d]{24}$/i.test(String(resolved.path_id || "")) || !labels.path_id) return;
  const issuedAt = Date.now();
  return {
    version: 1, entity: "Product", actionId: "inventory.product.detail", field: "path_id",
    targetId: String(resolved.path_id), publicLabel: labels.path_id,
    owner: ownerKey(req, conversationId), pendingId, workflowDigest: workflowDigest(operation, workflow),
    issuedAt, expiresAt: issuedAt + PROOF_TTL_MS,
  };
}

export function validateProductReadProof(
  proof: ProductReadProofV1, req: AuthenticatedRequest, conversationId: string, pendingId: string,
  operation: AssistantOperation, workflow: AssistantWorkflow, values: Record<string, AssistantValue>,
) {
  const now = Date.now();
  if (!eligible(operation) || proof.version !== 1 || proof.entity !== "Product"
    || proof.actionId !== operation.id || proof.field !== "path_id"
    || proof.targetId !== values.path_id || !/^[a-f\d]{24}$/i.test(proof.targetId)
    || proof.owner !== ownerKey(req, conversationId) || proof.pendingId !== pendingId
    || proof.workflowDigest !== workflowDigest(operation, workflow)
    || !Number.isFinite(proof.issuedAt) || !Number.isFinite(proof.expiresAt)
    || proof.issuedAt > now || proof.expiresAt <= now || proof.expiresAt - proof.issuedAt !== PROOF_TTL_MS) {
    throw new AssistantError("Thông tin sản phẩm đã hết hiệu lực hoặc phạm vi đã thay đổi. Bạn gửi lại yêu cầu để kiểm tra nhé.", 409);
  }
}

export function verifiedProductDetailResult(
  response: any, proof: ProductReadProofV1, operation: AssistantOperation,
  req: AuthenticatedRequest, values: Record<string, AssistantValue>,
) {
  const product = response?.data;
  if (!eligible(operation) || values.path_id !== proof.targetId
    || !product || typeof product !== "object" || Array.isArray(product)
    || String(product._id || product.id || "") !== proof.targetId
    || (product.id && String(product.id) !== proof.targetId)
    || product.companyCode !== req.user?.companyCode || !Array.isArray(product.variants)
    || product.variants.some((variant: any) => !variant || typeof variant !== "object"
      || (variant.productId && String(variant.productId) !== proof.targetId))) {
    throw new AssistantError("Dữ liệu sản phẩm không khớp đối tượng đã chọn. Bạn gửi lại yêu cầu để kiểm tra nhé.", 409);
  }
  // Keep the raw parent envelope for the existing contract formatter/completion.
  // SKU row IDs never become Product IDs; an empty variants array does not erase the parent.
  return response;
}
