import type { AssistantWorkflow } from "../../src/shared/assistant-workflow";
import { MODULE_LABELS, MODULE_TAB_MAP, type ModuleKey } from "../../src/config/modules";

type ExampleKind = "read" | "create" | "update";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function exampleFor(kind: ExampleKind, entity: string) {
  if (kind === "read") return `Xem danh sách ${entity}`;
  if (kind === "create") return `Thêm ${entity}: [thông tin đã có]`;
  return `Cập nhật ${entity} [tên hoặc mã]: [thông tin cần sửa]`;
}

/** Only offer the two course types when both operations are available to this user. */
export function assistantCourseChoiceGuidance(workflows: readonly AssistantWorkflow[], suggestedActionIds: readonly string[] = []): string {
  const pair = [["training.create", "course.create"], ["training.delete", "course.delete"]]
    .find(ids => ids.every(id => suggestedActionIds.includes(id)));
  if (!pair) return "";
  const options = pair.map(id => workflows.find(workflow => workflow.enabled && workflow.actionId === id));
  if (options.some(option => !option)) return "";
  return `Bạn đang muốn chọn loại khóa học nào? Mình có thể “${options[0]!.title}” (đào tạo nội bộ cho nhân sự) hoặc “${options[1]!.title}” (cho học viên).`;
}

/** Receives only workflows already scoped to the user's permissions and modules. */
export function assistantRequestGuidance(text: string, workflows: readonly AssistantWorkflow[], hasAttachment = false): string {
  if (hasAttachment) return "Ví dụ cách viết: “Dùng tệp này để [việc cần làm] cho [đối tượng]”.";
  const candidates = workflows.flatMap(workflow => {
    if (!workflow.enabled) return [];
    const title = workflow.title.replace(/\s+/g, " ").trim();
    const match = title.match(/^(Tra cứu|Tìm kiếm|Tìm|Xem danh sách|Tạo|Thêm mới|Thêm|Cập nhật|Sửa)\s+(.+)$/iu);
    if (!match || match[2].length > 80) return [];
    const verb = normalize(match[1]);
    const kind: ExampleKind = ["tao", "them", "them moi"].includes(verb) ? "create"
      : ["cap nhat", "sua"].includes(verb) ? "update" : "read";
    return [{ kind, entity: match[2] }];
  });
  const request = ` ${normalize(text)} `;
  // An AI shortlist is not evidence of what the user meant. Use a concrete
  // entity only when the user actually named it; otherwise retain placeholders.
  const contextual = candidates.filter(candidate => request.includes(` ${normalize(candidate.entity)} `));
  const source = contextual.length ? contextual : candidates.map(candidate => ({ ...candidate, entity: "[đối tượng]" }));
  const priority: ExampleKind[] = /\b(?:cap nhat|sua|doi)\b/.test(request) ? ["update", "read", "create"]
    : /\b(?:tao|them)\b/.test(request) ? ["create", "read", "update"] : ["read", "create", "update"];
  const examples = [...new Set([...source].sort((a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind))
    .map(candidate => exampleFor(candidate.kind, candidate.entity)))].slice(0, 2);
  if (!examples.length) return "Bạn có thể viết: “Tôi muốn [việc cần làm] với [đối tượng], [thông tin cụ thể]”.";
  return `Ví dụ cách viết (thay phần trong ngoặc bằng thông tin của bạn):\n${examples.map(example => `- “${example}”`).join("\n")}`;
}

type ManualActionKind = "read" | "create" | "update" | "delete" | "other";

function manualActionKind(text: string): ManualActionKind {
  const request = normalize(text);
  const verbs: Array<[RegExp, ManualActionKind]> = [
    [/\b(?:xoa|huy|go bo)\b/g, "delete"],
    [/\b(?:sua|cap nhat|bo sung|doi|thay doi|chinh sua)\b/g, "update"],
    [/\b(?:tao|them|lap|dang ky|khoi tao)\b/g, "create"],
    [/\b(?:xem|tra cuu|tim(?: kiem)?|kiem tra|danh sach|liet ke|bao cao|thong ke)\b/g, "read"],
  ];
  const first = verbs.flatMap(([pattern, kind]) => {
    const match = pattern.exec(request);
    return match ? [{ index: match.index, kind }] : [];
  }).sort((left, right) => left.index - right.index)[0];
  return first?.kind || "other";
}

/** Gives a safe manual path when the assistant understands a request but has no usable workflow for it. */
export function assistantUnsupportedGuidance(text: string, workflows: readonly AssistantWorkflow[], requestedModule?: string): string {
  const module = workflows.find(workflow => workflow.module === requestedModule)?.module as ModuleKey | undefined;
  const moduleName = module ? MODULE_LABELS[module] : undefined;
  const tabName = module ? MODULE_TAB_MAP[module] : undefined;
  const action = manualActionKind(text);
  const steps = action === "create"
    ? ["Mở màn hình có loại dữ liệu cần tạo và chọn Thêm/Tạo mới.", "Điền thông tin theo biểu mẫu, rà soát lại rồi lưu."]
    : action === "update"
      ? ["Tìm đúng hồ sơ theo tên hoặc mã, mở hồ sơ và chọn Sửa/Cập nhật.", "Chỉ đổi nội dung cần thiết, rà soát lại rồi lưu."]
      : action === "delete"
        ? ["Tìm đúng hồ sơ theo tên hoặc mã rồi mở chức năng Xóa.", "Đọc kỹ cảnh báo và dữ liệu liên quan; chỉ xác nhận nếu đúng hồ sơ cần xóa."]
        : action === "read"
          ? ["Mở danh sách loại dữ liệu cần tra cứu.", "Tìm theo tên, mã hoặc bộ lọc phù hợp rồi mở kết quả để xem chi tiết."]
          : ["Mở màn hình có dữ liệu liên quan đến yêu cầu.", "Làm theo biểu mẫu trên màn hình và kiểm tra lại trước khi lưu hoặc xác nhận."];
  const destination = moduleName
    ? `1. Mở tab ${tabName || moduleName} trong menu chính.`
    : "1. Mở phân hệ đang quản lý dữ liệu bạn muốn thao tác.";
  const boundary = moduleName
    ? "Nếu không thấy chức năng đó hoặc bị chặn, nhờ quản trị viên kiểm tra phân hệ và quyền truy cập."
    : "Mình chưa xác định chắc chắn phân hệ trong tài khoản của bạn. Nếu bạn cho biết tên phân hệ, mình có thể chỉ đúng màn hình hơn; nếu không thấy chức năng, hãy nhờ quản trị viên kiểm tra quyền truy cập.";

  return [
    "Mình hiểu bạn muốn thực hiện yêu cầu này. Hiện trợ lý chưa thể làm việc đó trong khung chat, nên chưa có dữ liệu nào được thay đổi.",
    "Bạn có thể tự thao tác trong ERP:",
    [destination, ...steps.map((step, index) => `${index + 2}. ${step}`)].join("\n"),
    boundary,
  ].join("\n\n");
}
