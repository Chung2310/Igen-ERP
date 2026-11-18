import type { AssistantReply, AssistantWorkflow } from "../../src/shared/assistant-workflow";
import { isTabHidden, MODULE_LABELS, MODULE_TAB_MAP, type ModuleKey } from "../../src/config/modules";
import { operationById, type AssistantOperation } from "./catalog";
import { buildManualGuide } from "./manual-guides";

export type FallbackReason = "unsupported" | "permission" | "validation" | "technical" | "uncertain";
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
  const destination = hidden ? guide?.reason || "Phân hệ này hiện bị ẩn khỏi điều hướng ứng dụng. Chưa có luồng thủ công được xác minh tại đây." : guide?.status === "procedure" ? guide.steps[0] : moduleLabel
    ? `Mở tab ${moduleLabel} trong menu chính${guide?.screen ? ` → ${guide.screen}` : ""}.`
    : "Mở phân hệ đang quản lý dữ liệu bạn muốn thao tác. Nếu chưa rõ phân hệ, hãy cho biết tên màn hình để mình hướng dẫn đúng.";
  const steps = [destination];
  const uncertain = reply.status === "uncertain" || context.reason === "uncertain";
  if (uncertain) {
    steps.push("Tìm bản ghi và kiểm tra lịch sử theo tên/mã, thời điểm và nội dung vừa yêu cầu.",
      "Nếu dữ liệu đã được ghi, không thực hiện lại. Nếu chưa xác minh được, nhờ quản trị viên kiểm tra trước khi tạo hoặc gửi lại yêu cầu.");
  } else if (context.reason === "permission") {
    steps.push("Nhờ quản trị viên kiểm tra quyền cho chức năng này và chi nhánh đang chọn.",
      "Chỉ tiếp tục sau khi được cấp quyền. Thao tác trên giao diện cũng cần đúng quyền truy cập.");
  } else {
    steps.push("Chọn đúng chi nhánh. Tìm và đối chiếu tên/mã của bản ghi trước khi thao tác.");
    if (context.reason === "validation") steps.push("Sửa thông tin hoặc điều kiện được nêu trong nguyên nhân ở trên. Nếu bản ghi đã thay đổi, tải lại dữ liệu mới trước khi sửa.");
    if (guide?.status === "procedure") {
      steps.push(...guide.steps.slice(1));
    } else if (op && guide) {
      steps.push(guide.reason, "Nhờ người phụ trách phân hệ xác minh cách thực hiện chức năng này. Không dùng thao tác khác để thay thế.");
    } else {
      steps.push("Mở danh sách loại dữ liệu cần tra cứu và tìm đúng hồ sơ. Chỉ thực hiện chức năng tương ứng nếu giao diện có hỗ trợ. Không thấy chức năng thì nhờ quản trị viên kiểm tra.");
    }
  }
  const partial = context.completedSteps ? "Các bước đã hoàn tất vẫn được giữ. Chỉ xử lý phần chưa xong, không làm lại toàn bộ yêu cầu.\n" : "";
  return { ...reply, ...(link ? { link } : { link: undefined }), reply: `${reply.reply}\n\nHướng dẫn dự phòng:\n${partial}${steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}` };
}
