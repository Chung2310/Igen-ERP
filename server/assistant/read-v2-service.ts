import type { AuthenticatedRequest } from "../middleware/auth";
import { AssistantError } from "./policy";
import { actorScope } from "./workflows";
import { AssistantTurnModel } from "./models";
import { processTurn, type TurnExecutionControl, type TurnInput } from "./service";
import { readV2Enabled, readV2Environment, validateReadV2Input, hasPrivateReadV2Value } from "./read-v2-contract";

export async function processProductReadV2Turn(req: AuthenticatedRequest, value: unknown, control: Omit<TurnExecutionControl, "readV2" | "background"> = {}) {
  const input = validateReadV2Input(value);
  if (!readV2Environment() || process.env.ASSISTANT_SAFE_EXECUTION !== "true") throw new AssistantError("V2 chỉ được mở sau cờ thử nghiệm cục bộ và cổng gọi an toàn.", 409);
  if (!readV2Enabled() && input.input.kind === "text") {
    // Completed/processing retries keep the existing claim/digest lifecycle, even with ingress off.
    const scope = { ...actorScope(req), branchId: req.user?.branchId || "", requestId: input.requestId };
    if (!await AssistantTurnModel.findOne(scope).select("digest").lean()) throw new AssistantError("V2 đang tắt nhận yêu cầu mới.", 409);
  }
  const core: TurnInput = { conversationId: input.conversationId, requestId: input.requestId, mode: "work",
    ...(input.input.kind === "text" ? { text: hasPrivateReadV2Value(input.input.text) ? "Yêu cầu tra cứu chứa dữ liệu riêng tư chưa được chấp nhận." : input.input.text }
      : input.input.kind === "decision" ? { decision: { id: input.input.pendingId, confirmed: input.input.confirmed } } : { text: "Đã chọn sản phẩm V2" }) };
  return { ...await processTurn(req, core, { ...control, readV2: input }), schemaVersion: 2 as const };
}
