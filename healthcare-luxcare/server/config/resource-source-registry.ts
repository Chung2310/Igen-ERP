export type ResourceFolderLevel = "module" | "group" | "entity" | "uploader";

export interface ResourceSourceDefinition {
  sourceType: string;
  moduleKey: string;
  moduleLabel: string;
  groupKey: string;
  groupLabel: string;
  requiredPermissions: string[];
  sourceTab?: string;
  sourceSubTab?: string;
}

function defineSource(definition: ResourceSourceDefinition): ResourceSourceDefinition {
  return Object.freeze({
    ...definition,
    requiredPermissions: Object.freeze([...definition.requiredPermissions]) as unknown as string[],
  });
}

const definitions = [
  defineSource({
    sourceType: "hr.contract",
    moduleKey: "hr",
    moduleLabel: "Nhân sự",
    groupKey: "contracts",
    groupLabel: "Hợp đồng",
    requiredPermissions: ["hr:read"],
    sourceTab: "NHÂN SỰ",
    sourceSubTab: "hop-dong",
  }),
  defineSource({
    sourceType: "hr.credential",
    moduleKey: "hr",
    moduleLabel: "Nhân sự",
    groupKey: "credentials",
    groupLabel: "Văn bằng & chứng chỉ",
    requiredPermissions: ["credentials:read"],
    sourceTab: "NHÂN SỰ",
    sourceSubTab: "van-bang-chung-chi",
  }),
  defineSource({
    sourceType: "hr.leave",
    moduleKey: "hr",
    moduleLabel: "Nhân sự",
    groupKey: "leave",
    groupLabel: "Nghỉ phép",
    requiredPermissions: ["hr:read"],
    sourceTab: "NHÂN SỰ",
  }),
  defineSource({
    sourceType: "hr.kanban",
    moduleKey: "hr",
    moduleLabel: "Nhân sự",
    groupKey: "kanban",
    groupLabel: "Công việc",
    requiredPermissions: ["work:read"],
    sourceTab: "NHÂN SỰ",
    sourceSubTab: "kanban",
  }),
  defineSource({
    sourceType: "hr.training",
    moduleKey: "hr",
    moduleLabel: "Nhân sự",
    groupKey: "training",
    groupLabel: "Đào tạo",
    requiredPermissions: ["hr:read"],
    sourceTab: "NHÂN SỰ",
    sourceSubTab: "dao-tao",
  }),
  defineSource({
    sourceType: "hr.recruitment.job",
    moduleKey: "hr",
    moduleLabel: "Nhân sự",
    groupKey: "recruitment-jobs",
    groupLabel: "Tin tuyển dụng",
    requiredPermissions: ["recruitment:manage"],
    sourceTab: "NHÂN SỰ",
    sourceSubTab: "tuyen-dung",
  }),
  defineSource({
    sourceType: "hr.recruitment.applicant",
    moduleKey: "hr",
    moduleLabel: "Nhân sự",
    groupKey: "recruitment-applicants",
    groupLabel: "Ứng viên",
    requiredPermissions: ["recruitment:manage"],
    sourceTab: "NHÂN SỰ",
    sourceSubTab: "tuyen-dung",
  }),
  defineSource({
    sourceType: "hr.employee",
    moduleKey: "hr",
    moduleLabel: "Nhân sự",
    groupKey: "employee-files",
    groupLabel: "Hồ sơ nhân viên",
    requiredPermissions: ["hr:read"],
    sourceTab: "NHÂN SỰ",
  }),
  defineSource({
    sourceType: "hr.celebration",
    moduleKey: "hr",
    moduleLabel: "Nhân sự",
    groupKey: "celebration",
    groupLabel: "Email chúc mừng",
    requiredPermissions: ["settings:manage"],
    sourceTab: "NHÂN SỰ",
    sourceSubTab: "email-chuc-mung",
  }),
  defineSource({
    sourceType: "hr.org-chart",
    moduleKey: "hr",
    moduleLabel: "Nhân sự",
    groupKey: "org-chart",
    groupLabel: "Sơ đồ tổ chức",
    requiredPermissions: ["hr:read"],
    sourceTab: "NHÂN SỰ",
    sourceSubTab: "so-do",
  }),
  defineSource({
    sourceType: "attendance.employee",
    moduleKey: "attendance",
    moduleLabel: "Chấm công",
    groupKey: "employee-evidence",
    groupLabel: "Minh chứng nhân viên",
    requiredPermissions: ["timekeeping:read"],
    sourceTab: "NHÂN SỰ",
  }),
  defineSource({
    sourceType: "inventory.product",
    moduleKey: "inventory",
    moduleLabel: "Kho & Sản phẩm",
    groupKey: "product-images",
    groupLabel: "Hình ảnh sản phẩm",
    requiredPermissions: ["inventory:read"],
    sourceTab: "KHO & SẢN PHẨM",
    sourceSubTab: "danh-muc",
  }),
  defineSource({
    sourceType: "equipment.compliance",
    moduleKey: "equipment",
    moduleLabel: "Quản lý thiết bị",
    groupKey: "compliance",
    groupLabel: "Hồ sơ pháp lý & kiểm định",
    requiredPermissions: ["equipment:read"],
    sourceTab: "QUẢN LÝ THIẾT BỊ",
  }),
  defineSource({
    sourceType: "import.partner",
    moduleKey: "imports",
    moduleLabel: "Dữ liệu nhập",
    groupKey: "partners",
    groupLabel: "Đối tác",
    requiredPermissions: ["relationship:read"],
    sourceTab: "ĐỐI TÁC",
  }),
  defineSource({
    sourceType: "import.inventory-product",
    moduleKey: "imports",
    moduleLabel: "Dữ liệu nhập",
    groupKey: "inventory-products",
    groupLabel: "Sản phẩm kho",
    requiredPermissions: ["inventory:read"],
    sourceTab: "KHO & SẢN PHẨM",
    sourceSubTab: "danh-muc",
  }),
  defineSource({
    sourceType: "import.inventory-stock",
    moduleKey: "imports",
    moduleLabel: "Dữ liệu nhập",
    groupKey: "inventory-stock",
    groupLabel: "Phiếu nhập xuất",
    requiredPermissions: ["inventory:read"],
    sourceTab: "KHO & SẢN PHẨM",
  }),
  defineSource({
    sourceType: "chat.attachment",
    moduleKey: "chat",
    moduleLabel: "Trò chuyện",
    groupKey: "attachments",
    groupLabel: "Tệp đính kèm",
    requiredPermissions: ["chat:read"],
    sourceTab: "TRÒ CHUYỆN",
  }),
  defineSource({
    sourceType: "workflow.attachment",
    moduleKey: "workflow",
    moduleLabel: "Quy trình",
    groupKey: "attachments",
    groupLabel: "Tệp đính kèm",
    requiredPermissions: ["hr:read"],
    sourceTab: "NHÂN SỰ",
    sourceSubTab: "quy-trinh",
  }),
  defineSource({
    sourceType: "settings.profile",
    moduleKey: "settings",
    moduleLabel: "Cài đặt",
    groupKey: "profiles",
    groupLabel: "Hồ sơ cá nhân",
    requiredPermissions: ["access:read"],
    sourceTab: "CÀI ĐẶT",
    sourceSubTab: "ho-so",
  }),
  defineSource({
    sourceType: "company.branding",
    moduleKey: "settings",
    moduleLabel: "Cài đặt",
    groupKey: "branding",
    groupLabel: "Nhận diện doanh nghiệp",
    requiredPermissions: ["access:manage"],
    sourceTab: "CÀI ĐẶT",
    sourceSubTab: "cau-hinh",
  }),
  defineSource({
    sourceType: "resource.direct",
    moduleKey: "resource",
    moduleLabel: "Quản lý tài nguyên",
    groupKey: "direct",
    groupLabel: "Tài liệu tải trực tiếp",
    requiredPermissions: ["resource:read"],
    sourceTab: "QUẢN LÝ TÀI NGUYÊN",
    sourceSubTab: "tai-lieu",
  }),
] as const;

const registry = new Map(definitions.map((definition) => [definition.sourceType, definition]));

function normalizeKeyPart(value: string): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("en-US");
}

export function getResourceSourceDefinition(sourceType: string): ResourceSourceDefinition {
  const normalizedSourceType = normalizeKeyPart(sourceType);
  const definition = registry.get(normalizedSourceType);
  if (!definition) throw new Error(`Nguồn tải lên chưa được đăng ký: ${sourceType}`);
  return definition;
}

export function listResourceSourceDefinitions(): readonly ResourceSourceDefinition[] {
  return definitions;
}

export function buildSystemFolderKey(
  companyCode: string,
  level: ResourceFolderLevel,
  sourceType: string,
  entityId?: string,
  uploaderId?: string,
): string {
  const company = normalizeKeyPart(companyCode);
  const definition = getResourceSourceDefinition(sourceType);

  if (level === "module") return `${company}:module:${definition.moduleKey}`;
  if (level === "group") return `${company}:${definition.moduleKey}:group:${definition.groupKey}`;

  const entity = normalizeKeyPart(entityId || "");
  if (!entity) throw new Error("Mã đối tượng là bắt buộc để tạo khóa thư mục đối tượng.");
  if (level === "entity") return `${company}:${definition.sourceType}:entity:${entity}`;

  const uploader = normalizeKeyPart(uploaderId || "");
  if (!uploader) throw new Error("Mã người tải lên là bắt buộc để tạo khóa thư mục người tải.");
  return `${company}:${definition.sourceType}:entity:${entity}:uploader:${uploader}`;
}

export function buildResourceSourceRoute(definition: ResourceSourceDefinition, entityId: string): string {
  const params = new URLSearchParams();
  if (definition.sourceSubTab) params.set("sub", definition.sourceSubTab);
  params.set("sourceId", entityId);
  return `/?tab=${encodeURIComponent(definition.sourceTab || definition.moduleLabel)}&${params.toString()}`;
}
