import type { AssistantReply, AssistantWorkflow } from "../../src/shared/assistant-workflow";
import { isTabHidden, MODULE_LABELS, MODULE_TAB_MAP, type ModuleKey } from "../../src/config/modules";
import { operationById, type AssistantOperation } from "./catalog";
import { buildManualGuide } from "./manual-guides";

export type FallbackReason = "unsupported" | "permission" | "validation" | "technical" | "uncertain" | "provider";
type Context = { operation?: AssistantOperation; module?: string; workflows: readonly AssistantWorkflow[]; reason: FallbackReason; completedSteps?: number };

function localLink(value?: string) {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\s]/.test(value)) return undefined;
  try {
    const url = new URL(value, "https://erp.invalid");
    if (url.origin !== "https://erp.invalid" || url.pathname.startsWith("/api/")) return undefined;
    // Never propagate record IDs, credentials or arbitrary query values.
    const sub = url.searchParams.get("sub");
    return url.pathname + (sub && /^[a-z0-9-]+$/i.test(sub) ? `?sub=${sub}` : "");
  } catch { return undefined; }
}

/** Deterministic fallback: no LLM call, guessed UI buttons, or user payload values. */
export function appendAssistantFallback(reply: AssistantReply, context: Context): AssistantReply {
  // No business action was identified: navigation instructions would misstate
  // an infrastructure failure as a missing capability or a permission issue.
  if (context.reason === 'provider') return reply;
  if (!["failed", "unsupported", "uncertain"].includes(reply.status)) return reply;
  const op = context.operation;
  const guide = op ? buildManualGuide(op) : undefined;
  const module = (op?.module || context.module) as ModuleKey | undefined;
  const knownModule = module && context.workflows.some(w => w.module === module) ? module : undefined;
  const moduleLabel = knownModule ? MODULE_TAB_MAP[knownModule] || MODULE_LABELS[knownModule] : undefined;
  const hidden = guide?.status === "ui-unavailable" || Boolean(knownModule && MODULE_TAB_MAP[knownModule] && isTabHidden(MODULE_TAB_MAP[knownModule]!));
  const moduleLink = !op && knownModule ? context.workflows.filter(w => w.module === knownModule && w.enabled)
    .map(w => localLink(operationById(w.actionId)?.link)).find(Boolean)?.split("?")[0] : undefined;
  const link = knownModule && context.reason !== "permission" && !hidden
    ? localLink(guide?.link || moduleLink) : undefined;
  const destination = hidden ? 'Phân hệ này hiện chưa có trong menu của bạn.' : guide?.status === "procedure" ? guide.steps[0] : moduleLabel
    ? `Mở tab ${moduleLabel} trong menu chính${guide?.screen ? ` → ${guide.screen}` : ""}.`
    : 'Bạn cho mình biết tên màn hình đang thao tác để mình hướng dẫn tiếp nhé.';
  const steps = [destination];
  const uncertain = reply.status === "uncertain" || context.reason === "uncertain";
  if (uncertain) {
    steps.push('Kiểm tra đúng hồ sơ và lịch sử vừa thao tác. Nếu dữ liệu đã được ghi, không thực hiện lại. Chưa xác minh được thì nhờ người phụ trách kiểm tra trước khi thử lại.');
  } else if (context.reason === "permission") {
    steps.push('Bạn nhờ quản trị viên kiểm tra quyền ở chi nhánh đang chọn. Chỉ tiếp tục sau khi được cấp quyền.');
  } else {
    if (context.reason === 'validation') steps.push('Bạn sửa thông tin hoặc điều kiện được nêu ở trên rồi thử lại. Nếu hồ sơ đã thay đổi, tải lại thông tin mới trước khi sửa.');
    else if (guide?.status === 'procedure' && guide.steps.length > 1) steps.push(guide.steps[1]);
    else if (op && guide && !hidden) steps.push('Nếu chưa thấy chức năng cần dùng, bạn nhờ người phụ trách phân hệ kiểm tra nhé.');
  }
  const partial = context.completedSteps ? "Các bước đã hoàn tất vẫn được giữ. Chỉ xử lý phần chưa xong, không làm lại toàn bộ yêu cầu.\n" : "";
  return { ...reply, ...(link ? { link } : { link: undefined }), reply: `${reply.reply}\n\n${partial}${steps.join('\n')}` };
}
