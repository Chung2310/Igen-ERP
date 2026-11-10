import type { AssistantWorkflow } from "../../src/shared/assistant-workflow";

type ExampleKind = "read" | "create" | "update";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function exampleFor(kind: ExampleKind, entity: string) {
  if (kind === "read") return `Xem danh sách ${entity}`;
  if (kind === "create") return `Thêm ${entity}: [thông tin đã có]`;
  return `Cập nhật ${entity} [tên hoặc mã]: [thông tin cần sửa]`;
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
