import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from "../../src/config/modules";

const RELATED_MODULES: Partial<Record<ModuleKey, ModuleKey[]>> = {
  "labor-partner": ["worker"],
  "student-partner": ["student"],
  "retail-partner": ["retail"],
  "social-marketing": ["marketing"],
};

const MODULE_LABEL_ALIASES: Partial<Record<ModuleKey, string[]>> = {
  quotation: ["Hồ sơ báo giá", "Lập dự toán báo giá"],
  healthcare: ["Hồ sơ bệnh nhân", "Lượt khám", "Lịch khám y tế"],
  "architect-assistant": ["Thiết kế kiến trúc", "Dựng phối cảnh kiến trúc"],
  hr: ["Nhân sự công ty", "Hồ sơ nhân sự", "Dự án cho nhân sự", "Dự án nhân sự", "Dự án nội bộ nhân sự"],
  inventory: ["Kho hàng", "Quản lý tồn kho", "Quản lí tồn kho"],
  resource: ["Quản lý tài nguyên", "Quản lí tài nguyên"],
  chat: ["Trợ lý trò chuyện"],
  student: ["Hồ sơ học viên", "Lớp học viên", "Học phí học viên", "Quản lí học viên"],
  worker: ["Quản lý lao động", "Quản lí lao động", "Dự án lao động", "Quản lý dự án lao động", "Quản lí dự án lao động", "Lao động dự án", "Nhân công dự án"],
  "student-partner": ["Đối tác tuyển sinh", "Đối tác giới thiệu học viên", "Đối tác giới thiệu sinh viên"],
  "labor-partner": ["Đối tác cung ứng lao động", "Đối tác giới thiệu lao động", "Nhà cung ứng lao động", "Đối tác cung cấp nhân công", "Quản lý lao động", "Quản lí lao động"],
  customer: ["Hồ sơ khách hàng", "Quản lý hồ sơ khách hàng", "Quản lí hồ sơ khách hàng"],
  retail: ["Đơn bán lẻ", "Điểm bán hàng"],
  "retail-partner": ["Đối tác bán lẻ", "Cộng tác viên bán lẻ"],
  repair: ["Phiếu sửa chữa", "Sửa chữa bảo hành", "Bảo hành thiết bị"],
  finance: ["Thu chi tài chính", "Công nợ tài chính", "Kế toán doanh nghiệp"],
  marketing: ["Tự động hóa marketing", "Marketing tự động"],
  "social-marketing": ["Chiến dịch nội dung", "Lịch nội dung mạng xã hội", "Bài đăng mạng xã hội"],
  "omni-inbox": ["Hộp thư đa kênh", "Inbox đa kênh", "Hội thoại khách hàng"],
  "company-knowledge": ["Kho tri thức công ty", "Cơ sở tri thức công ty"],
  "legal-reference": ["Văn bản pháp luật", "Tra cứu pháp lý", "Quy định pháp luật"],
  partner: [],
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const CONTEXT_FILLER = new Set(["trong", "vao", "o", "tai", "thuoc", "phan", "he", "module", "khu", "vuc", "muc"]);
const EXPLICIT_CONTEXT_MARKERS = new Set(["trong", "vao", "o", "tai", "thuoc", "phan", "he", "module", "khu", "vuc", "muc"]);

export function assistantModuleContext(module: string) {
  if (!MODULE_KEYS.includes(module as ModuleKey)) return { key: module, label: module, relatedLabels: [], aliases: [] };
  const typedModule = module as ModuleKey;
  const keys = [...new Set([typedModule, ...(RELATED_MODULES[typedModule] || [])])];
  const labels = [...new Set(keys.filter(key => key !== typedModule).map(key => MODULE_LABELS[key]))];
  const label = typedModule === "student-partner" ? "Đối tác tuyển sinh"
    : typedModule === "partner" ? "Đối tác cũ" : MODULE_LABELS[typedModule];
  const aliases = [...new Set(MODULE_LABEL_ALIASES[typedModule] || [])];
  return { key: module, label, relatedLabels: labels, aliases };
}

/** Resolve the two partner catalogs when the request names the partner type. */
export function inferPartnerModule(text: string): ModuleKey | undefined {
  const phrase = normalize(text);
  const mentionsPartner = /(?:^| )(?:doi tac|nha cung ung|nha cung cap)(?: |$)/.test(phrase);
  if (!mentionsPartner) return undefined;

  const mentionsLabor = /(?:^| )(?:lao dong|nguoi lao dong|cong nhan|nhan cong)(?: |$)/.test(phrase);
  const mentionsLearners = /(?:^| )(?:hoc vien|sinh vien|tuyen sinh|lop hoc)(?: |$)/.test(phrase);
  if (mentionsLabor && !mentionsLearners) return "labor-partner";
  if (mentionsLearners && !mentionsLabor) return "student-partner";
  return undefined;
}

export const ASSISTANT_PARTNER_MODULE_GUIDANCE =
  "Tên/mã bản ghi chỉ là dữ liệu, không tự xác định phân hệ. Đối chiếu loại hồ sơ và thuộc tính cần xử lý với resources/inputs của danh mục; không chọn phân hệ chỉ vì tên bản ghi có từ trùng nhãn phân hệ. " +
  "Phân biệt hai phân hệ đối tác: student-partner là cộng tác viên giới thiệu học viên/sinh viên và tuyển sinh; labor-partner là đối tác giới thiệu hoặc cung ứng người lao động, công nhân, nhân công. Cụm 'đối tác giới thiệu' đứng riêng chưa đủ để phân biệt. Khi câu nêu đối tác cùng với lao động/công nhân/nhân công, chọn labor-partner; khi nêu học viên/sinh viên/tuyển sinh, chọn student-partner.";

/** A deduplicated routing dictionary, included once rather than repeated per operation. */
export function assistantModuleContextCatalog(modules: readonly string[]) {
  return [...new Set(modules)].map(assistantModuleContext);
}

export function mentionsCompatibleModule(evidence: string, module: string) {
  const phrase = normalize(evidence);
  const context = assistantModuleContext(module);
  const candidates = [module, context.label, ...context.aliases];
  return candidates.some(candidate => {
    const normalized = normalize(candidate);
    return normalized.length > 1 && phrase.includes(normalized);
  });
}

/** Validate a module evidence span after routing, without making a bare entity
 * name sufficient to select a module globally or swallowing extra conditions. */
export function matchesModuleContextEvidence(evidence: string, module: string, requestText = "") {
  if (isModuleContextClause(evidence, module)) return true;
  const phrase = normalize(evidence).replace(/^(?:cac|nhung)\s+/, "").replace(/^nguoi\s+/, "")
    .replace(/^(?:them|tao|xem|tra cuu|sua|cap nhat|xoa)\s+/, "");
  const context = assistantModuleContext(module);
  const names = [context.label, ...context.aliases].map(normalize);
  const entityNames = names.map(name => name.replace(/^(?:quan l[yi]|ho so)\s+/, ""));
  if (entityNames.includes(phrase)) return true;
  // A clipped noun such as "dự án" is acceptable only when the request itself
  // identifies the compatible module. It never establishes routing authority.
  return mentionsCompatibleModule(requestText, module) && entityNames.some(name =>
    name.startsWith(`${phrase} `) && entityNames.some(moduleName => name === `${phrase} ${moduleName}`));
}

/** A module anchor inside a combined evidence span. This never validates the
 * span's conditions; callers must validate its other mappings separately. */
export function containsModuleContextEvidence(evidence: string, module: string) {
  const phrase = ` ${normalize(evidence)} `;
  const context = assistantModuleContext(module);
  return [context.label, ...context.aliases].map(normalize)
    .map(name => name.replace(/^(?:quan l[yi]|ho so)\s+/, ""))
    .some(name => name.length > 2 && phrase.includes(` ${name} `));
}

/** True when a clause only identifies an ERP area, with no extra condition. */
export function isModuleContextClause(evidence: string, module: string) {
  const phrase = normalize(evidence);
  const context = assistantModuleContext(module);
  const candidates = [module, context.label, ...context.aliases];
  return candidates.some(candidate => {
    const normalized = normalize(candidate);
    if (!normalized || !phrase.includes(normalized)) return false;
    const remainder = phrase.replace(normalized, " ").split(/\s+/).filter(Boolean);
    if (!remainder.every(word => CONTEXT_FILLER.has(word))) return false;
    const specificWords = normalized.split(/\s+/).filter(word => !CONTEXT_FILLER.has(word));
    const hasExplicitContext = phrase.split(/\s+/).some(word => EXPLICIT_CONTEXT_MARKERS.has(word));
    // Generic labels such as "đối tác" or "lao động" are not enough to identify
    // a module on their own. Require a framing word or a more specific label.
    return hasExplicitContext || specificWords.length >= 3;
  });
}

/** True when a clause names any known ERP module, regardless of the selected workflow. */
export function isKnownModuleContextClause(evidence: string) {
  return MODULE_KEYS.some(module => isModuleContextClause(evidence, module));
}
