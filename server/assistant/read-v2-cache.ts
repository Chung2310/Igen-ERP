import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { getJwtAccessSecret } from "../config/env";
import type { AssistantReply } from "../../src/shared/assistant-workflow";
import type { AuthenticatedRequest } from "../middleware/auth";
import { AssistantError } from "./policy";
import { executionFingerprint } from "./execution-budget";
import type { ClarificationReadV2 } from "./read-v2-contract";

type Reply = AssistantReply & { schemaVersion?: number; clarification?: ClarificationReadV2 };
const key = () => Buffer.from(hkdfSync("sha256", getJwtAccessSecret(), "igen-assistant", "product-read-v2-reply", 32));
const aad = (req: AuthenticatedRequest, turn: { conversationId: string; requestId: string; digest: string }) => Buffer.from(executionFingerprint("read-v2-reply", [req.user?.id, req.user?.companyCode, req.user?.branchId || "", turn.conversationId, turn.requestId, turn.digest]));

/** Option lookup stores hashes only. Replay stores the bearer tokens encrypted in a separate private pin. */
export function sealReadV2Reply(req: AuthenticatedRequest, turn: { conversationId: string; requestId: string; digest: string }, reply: Reply) {
  if (reply.schemaVersion !== 2 || !reply.clarification?.options?.length) return { result: reply, replyTokens: undefined };
  const result = structuredClone(reply);
  const tokens = result.clarification!.options!.map(option => option.optionToken);
  for (const option of result.clarification!.options!) delete (option as Partial<typeof option>).optionToken;
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(aad(req, turn));
  const bytes = Buffer.concat([cipher.update(JSON.stringify(tokens), "utf8"), cipher.final()]);
  return { result, replyTokens: Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64") };
}
export function openReadV2Reply(req: AuthenticatedRequest, turn: { conversationId: string; requestId: string; digest: string; result?: unknown; readV2?: { schemaVersion?: number; replyTokens?: string } }): Reply {
  const result = structuredClone(turn.result) as Reply;
  if (result?.schemaVersion !== 2 || !result.clarification?.options?.length) return result;
  if (turn.readV2 && turn.readV2.schemaVersion !== 2) throw new AssistantError("Phiên bản lựa chọn V2 chưa được hỗ trợ. Bạn gửi lại yêu cầu nhé.", 409);
  if (!turn.readV2?.replyTokens) {
    delete result.clarification.options;
    result.reply = "Lựa chọn đã hết hiệu lực. Bạn gửi lại tên hoặc mã sản phẩm để tra cứu nhé.";
    return result;
  }
  try {
    const bytes = Buffer.from(turn.readV2.replyTokens, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
    decipher.setAAD(aad(req, turn));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const tokens = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
    if (!Array.isArray(tokens) || tokens.length !== result.clarification.options.length || tokens.some(token => typeof token !== "string" || !/^opt_[A-Za-z0-9_-]{43}$/.test(token))) throw new Error("Invalid replay tokens");
    result.clarification.options.forEach((option, index) => { option.optionToken = tokens[index]; });
    return result;
  } catch { throw new AssistantError("Chưa khôi phục được lựa chọn V2. Bạn gửi yêu cầu tra cứu mới nhé.", 409); }
}
