import type { AssistantField, AssistantWorkflow } from "../../src/shared/assistant-workflow";
import expandedCatalog from "./expanded-catalog.generated.json";
import type { ModuleKey } from "../config/module-keys";

export interface AssistantOperation {
  id: string; title: string; description: string; module: ModuleKey;
  modules?: ModuleKey[];
  permissions: string[]; method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  adapter?: "contract";
  rawResponse?: boolean;
  contextBody?: string[];
  contextHeaders?: string[];
  contextQuery?: string[];
  fixedBodyValues?: Record<string, unknown>;
  optionalPathFields?: string[];
  systemBodyFields?: string[];
  mergeBodyWithReference?: boolean;
  dateOnlyToIsoUtc?: string[];
  permissionGroups?: string[][];
  roles?: string[];
  confirmationDetails?: Record<string, Array<{ key: string; label: string }>>;
  path: string; fields: AssistantField[]; link: string;
  confirmation?: boolean;
  // Only these fields from existing APIs may be used for reference resolution or shown to AI.
  resultFields: string[];
}
const text = (key: string, label: string, required = false): AssistantField => ({ key, label, type: "text", systemRequired: required, required });
const date = (key: string, label: string, required = false): AssistantField => ({ ...text(key, label, required), type: "date" });
const number = (key: string, label: string, defaultValue?: number): AssistantField => ({ key, label, type: "number", min: 0, ...(defaultValue === undefined ? {} : { defaultValue }) });
const ref = (key: string, label: string, reference: string, required = true): AssistantField => ({ ...text(key, label, required), type: "reference", reference });
const queryField = (field: AssistantField, apiKey = field.key): AssistantField => ({ ...field, source: "query", apiKey });
const queryRef = (key: string, label: string, reference: string, required = true): AssistantField => queryField(ref(key, label, reference, required));
const choice = (key: string, label: string, options: string[], defaultValue?: string): AssistantField => ({ ...text(key, label), options, ...(defaultValue ? { defaultValue } : {}) });
const phone: AssistantField = { ...text("phone", "Số điện thoại"), type: "phone" };
const email: AssistantField = { ...text("email", "Email"), type: "email" };
const description = text("description", "Mô tả");

const operations: AssistantOperation[] = [];
function entity(config: { id: string; title: string; module: ModuleKey; permissions: string[]; readPermissions?: string[]; path: string; createPath?: string; link: string; fields: AssistantField[]; resultFields?: string[]; update?: boolean; remove?: boolean; create?: boolean }) {
  const resultFields = config.resultFields || config.fields.map(f => f.key);
  const base = { module: config.module, permissions: config.permissions, link: config.link, resultFields };
  operations.push({ ...base, id: `${config.id}.list`, title: `Tra cứu ${config.title}`, description: `Tìm ${config.title} trong phạm vi được cấp quyền.`, permissions: config.readPermissions || config.permissions, method: "GET", path: config.path, fields: [text("search", "Từ khóa tìm kiếm")] });
  if (config.create !== false) operations.push({ ...base, id: `${config.id}.create`, title: `Tạo ${config.title}`, description: `Tạo ${config.title} bằng API nghiệp vụ hiện có; luôn yêu cầu xác nhận trước khi ghi.`, method: "POST", path: config.createPath || config.path, confirmation: true, fields: config.fields });
  if (config.update) operations.push({ ...base, id: `${config.id}.update`, title: `Cập nhật ${config.title}`, description: `Sửa ${config.title} đã xác định; phải xác nhận trước khi ghi.`, method: "PATCH", path: `${config.path}/:id`, confirmation: true, fields: [ref("id", `Tên hoặc mã ${config.title}`, `${config.id}.list`), ...config.fields.map(f => ({ ...f, systemRequired: false, required: false, defaultValue: undefined }))] });
  if (config.remove) operations.push({ ...base, id: `${config.id}.delete`, title: `Xóa ${config.title}`, description: `Xóa ${config.title} đã xác định; luôn cần xác nhận.`, method: "DELETE", path: `${config.path}/:id`, confirmation: true, fields: [ref("id", `Tên hoặc mã ${config.title}`, `${config.id}.list`)] });
}
entity({ id: "employee", title: "nhân sự", module: "hr", permissions: ["access:manage"], readPermissions: ["access:read", "hr:read"], path: "/auth/users", createPath: "/auth/register-user", link: "/nhan-su", update: true,
  fields: [text("displayName", "Họ và tên", true), { ...date("birthDate", "Ngày sinh"), required: true }, { ...email, systemRequired: true, required: true }, phone, { ...ref("department", "Phòng ban", "department.list", false), referenceValueKey: "name" }, text("division", "Bộ phận"), number("monthlySalary", "Lương tháng", 0), text("qualification", "Trình độ chuyên môn")],
  resultFields: ["displayName", "email", "birthDate", "phone", "department", "division", "monthlySalary", "qualification"],
});
entity({ id: "department", title: "phòng ban", module: "hr", permissions: ["hr:manage", "access:manage"], readPermissions: ["hr:read", "access:read", "hr:manage", "access:manage"], path: "/hr/departments", link: "/nhan-su?sub=phong-ban", update: true, remove: true,
  resultFields: ["name", "code", "description", "managerName", "sortOrder", "isActive", "employeeCount"],
  fields: [text("name", "Tên phòng ban", true), text("code", "Mã phòng ban"), description, ref("managerUid", "Trưởng phòng", "employee.list", false), number("sortOrder", "Thứ tự hiển thị", 0), { key: "isActive", label: "Đang hoạt động", type: "boolean", defaultValue: true }] });
const departmentList = operations.find(op => op.id === "department.list");
if (departmentList) {
  departmentList.fields = [];
  departmentList.permissionGroups = [["hr:read", "access:read", "hr:manage", "access:manage"]];
  departmentList.description = "Tra cứu danh sách phòng ban theo tên; hiển thị trưởng phòng, trạng thái, thứ tự và số nhân sự. Không trả mã người quản lý hoặc công ty.";
}
const departmentUpdate = operations.find(op => op.id === "department.update");
if (departmentUpdate) departmentUpdate.description = "Cập nhật phòng ban theo tên; tên hiện tại được giữ nguyên nếu chỉ sửa mã, mô tả, trưởng phòng, thứ tự hoặc trạng thái. Trưởng phòng được chọn theo tên nhân sự cùng công ty.";
const departmentDelete = operations.find(op => op.id === "department.delete");
if (departmentDelete) {
  departmentDelete.description = "Xóa phòng ban đã chọn trong công ty. Các nhân viên đang gắn với phòng ban này sẽ được bỏ gán phòng ban; cần xác nhận trước khi xóa.";
  departmentDelete.resultFields = ["deleted"];
}
entity({ id: "project", title: "dự án", module: "hr", permissions: ["work:manage"], readPermissions: ["work:read"], path: "/kanban/projects", link: "/nhan-su?sub=kanban", update: true, remove: true,
  fields: [text("name", "Tên dự án", true), choice("priority", "Độ ưu tiên", ["low", "medium", "high"], "medium"), date("startAt", "Ngày bắt đầu"), date("dueAt", "Hạn hoàn thành")] });
entity({ id: "task", title: "công việc", module: "hr", permissions: ["work:manage"], readPermissions: ["work:read"], path: "/kanban/tasks", link: "/nhan-su?sub=kanban", update: true, remove: true,
  fields: [text("title", "Tên công việc", true), description, ref("assigneeUid", "Người được giao", "employee.list"), date("dueDate", "Hạn hoàn thành", true), choice("priority", "Độ ưu tiên", ["High", "Medium", "Low"], "Medium"), choice("status", "Trạng thái", ["Not Started", "In Progress", "Done", "Archived"], "Not Started"), ref("projectId", "Dự án", "project.list", false), { ...date("startTime", "Thời gian bắt đầu"), type: "datetime" }, number("estTime", "Số giờ dự tính")],
  resultFields: ["title", "description", "assigneeUid", "assignee", "dueDate", "priority", "status", "projectId", "startTime", "estTime", "progress", "revision"] });
entity({ id: "customer", title: "khách hàng", module: "customer", permissions: ["customer:manage"], readPermissions: ["customer:read"], path: "/customers", link: "/quan-ly-khach-hang",
  fields: [text("name", "Tên khách hàng", true), { ...phone, systemRequired: true, required: true }, email, choice("type", "Phân loại hồ sơ", ["regular", "vat"], "regular"), choice("customerKind", "Loại khách hàng", ["individual", "business"]), text("contactName", "Người liên hệ"), date("dateOfBirth", "Ngày sinh"), choice("gender", "Giới tính", ["male", "female", "other"]), choice("status", "Trạng thái", ["active", "inactive"], "active"), text("address", "Địa chỉ"), text("notes", "Ghi chú")], resultFields: ["customerCode", "name", "phone", "status"] });
const customerList = operations.find(op => op.id === "customer.list");
if (customerList) {
  customerList.fields = [
    { ...text("query_q", "Tên, mã hoặc số điện thoại khách hàng"), source: "query", apiKey: "q" },
    { ...choice("query_status", "Trạng thái", ["active", "inactive", "all"], "all"), systemRequired: true, required: true, source: "query", apiKey: "status" },
    { ...number("query_page", "Trang", 1), min: 1, source: "query", apiKey: "page" },
    { ...number("query_limit", "Số kết quả", 100), min: 1, max: 100, source: "query", apiKey: "limit" },
  ];
}
operations.push({ id: "customer.transactions", title: "Tra cứu lịch sử giao dịch khách hàng", description: "Tra cứu đơn bán, sửa chữa, hoàn tiền, thu mua và số liệu tổng hợp của khách hàng tại chi nhánh đã chọn.", module: "customer", permissions: ["customer:read"], method: "GET", path: "/customers/:id/transactions", link: "/quan-ly-khach-hang", rawResponse: true,
  fields: [queryRef("branchId", "Chi nhánh", "branch.list"), ref("id", "Tên hoặc mã khách hàng", "customer.list"), queryField(choice("type", "Loại giao dịch", ["all", "sale", "repair", "refund", "buyback"], "all")), queryField(date("from", "Từ ngày")), queryField(date("to", "Đến ngày")), queryField({ ...number("page", "Trang", 1), min: 1, max: 10000 }), queryField({ ...number("limit", "Số giao dịch mỗi trang", 50), min: 1, max: 50 })],
  resultFields: ["kind", "sourceId", "eventId", "code", "parentCode", "occurredAt", "status", "amount", "paidAmount", "dueAmount", "description"] });
operations.push({ id: "customer.transaction.detail", title: "Xem chi tiết giao dịch khách hàng", description: "Tìm giao dịch theo mã hiển thị trong lịch sử của khách hàng rồi xem dòng hàng, thanh toán, hoàn tiền và điều chỉnh. Không yêu cầu người dùng cung cấp mã nội bộ.", module: "customer", permissions: ["customer:read"], method: "GET", path: "/customers/:id/transactions/:kind/:sourceId", link: "/quan-ly-khach-hang", rawResponse: true,
  fields: [queryRef("branchId", "Chi nhánh", "branch.list"), ref("id", "Tên hoặc mã khách hàng", "customer.list"), { ...text("kind", "Loại giao dịch"), options: ["sale", "repair", "sale_refund", "repair_refund", "buyback"], source: "path", apiKey: "kind" }, { ...ref("sourceId", "Mã giao dịch", "customer.transactions", false), source: "path", apiKey: "sourceId" }, queryField(text("eventId", "Mã sự kiện hoàn tiền")), queryField(date("from", "Từ ngày")), queryField(date("to", "Đến ngày")), queryField({ ...number("page", "Trang", 1), min: 1, max: 10000 }), queryField({ ...number("limit", "Số giao dịch mỗi trang", 50), min: 1, max: 50 })],
  resultFields: ["item", "lines", "payments", "refunds", "note", "adjustments", "device", "financeVoucherCode"] });
entity({ id: "branch", title: "chi nhánh", module: "hr", permissions: ["access:manage"], readPermissions: ["access:read", "hr:read"], path: "/auth/branches", link: "/nhan-su?sub=chi-nhanh", fields: [text("name", "Tên chi nhánh", true), text("code", "Mã chi nhánh")], resultFields: ["name", "code", "address", "isActive"], create: false });
entity({ id: "category", title: "danh mục kho", module: "inventory", permissions: ["inventory:manage"], readPermissions: ["inventory:read"], path: "/crud/categories", link: "/kho-san-pham", update: true, remove: true,
  fields: [text("name", "Tên danh mục", true), text("code", "Mã danh mục", true), description, ref("branchId", "Chi nhánh", "branch.list")] });
const categoryUpdate = operations.find(op => op.id === "category.update");
if (categoryUpdate) categoryUpdate.fields = categoryUpdate.fields.filter(field => field.key !== "branchId");
entity({ id: "training", title: "khóa đào tạo", module: "hr", permissions: ["hr:manage"], readPermissions: ["hr:read"], path: "/crud/training-courses", link: "/nhan-su", update: true,
  fields: [text("title", "Tên khóa học", true), description, text("category", "Danh mục đào tạo", true), text("duration", "Thời lượng", true), text("instructor", "Giảng viên", true)] });
entity({ id: "product", title: "sản phẩm", module: "inventory", permissions: ["inventory:read"], path: "/inventory/catalog/products", link: "/kho-san-pham", fields: [], create: false, resultFields: ["name", "productCode", "categoryCode", "productType", "status"] });

operations.push({ id: "repair.list", title: "Tra cứu phiếu sửa chữa", description: "Tìm phiếu theo mã phiếu, tên khách hàng hoặc số sê ri trong chi nhánh đã chọn.", module: "repair", permissions: ["repair:read", "repair:manage"], method: "GET", path: "/repair/tickets", link: "/sua-chua-bao-hanh",
  fields: [text("search", "Mã phiếu, tên khách hàng hoặc số sê ri"), queryRef("branchId", "Chi nhánh", "branch.list")], resultFields: ["ticketCode", "customerName", "customerId", "status", "totalAmount", "paidAmount", "dueAmount", "receivedAt", "deliveredAt"] });
const refundBranch = () => queryRef("branchId", "Chi nhánh", "branch.list");
const refundTicket = () => ref("id", "Mã hoặc tên phiếu sửa chữa", "repair.list");
const refundPermissions = ["repair:manage", "finance-wallet:manage"];
const refundPermissionGroups = [["repair:manage"], ["finance-wallet:manage"]];
operations.push({ id: "repair.refund.summary", title: "Tra cứu số dư hoàn tiền sửa chữa", description: "Xem số đã thu, đã hoàn và số tiền còn có thể hoàn của phiếu đã bàn giao.", module: "repair", permissions: ["repair:read", "repair:manage"], method: "GET", path: "/repair/tickets/:id/refunds", link: "/sua-chua-bao-hanh", rawResponse: true,
  fields: [refundBranch(), refundTicket()], resultFields: ["ticketCode", "status", "totalAmount", "paidAmount", "refundedAmount", "netCollected", "remaining", "remainingLabor", "remainingOther"] });
operations.push({ id: "repair.refund.vouchers", title: "Tìm phiếu chi đủ điều kiện hoàn tiền sửa chữa", description: "Liệt kê phiếu chi đã duyệt, đúng mã phiếu sửa chữa, đúng số tiền và chưa liên kết nghiệp vụ khác.", module: "repair", permissions: refundPermissions, permissionGroups: refundPermissionGroups, method: "GET", path: "/repair/tickets/:id/refunds/vouchers", link: "/sua-chua-bao-hanh", rawResponse: true,
  fields: [refundBranch(), refundTicket()], resultFields: ["key", "amount", "occurredOn", "description"] });
operations.push({ id: "repair.refund.create", title: "Ghi nhận hoàn tiền sửa chữa", description: "Chỉ hoàn cho phiếu đã bàn giao bằng phiếu chi đã duyệt, đúng số tiền và mã phiếu. Phải nhập tổng tiền hoàn, phần tiền công, phiếu chi và lý do; hệ thống kiểm tra số dư, kỳ tài chính và ghi nhận đối soát.", module: "repair", permissions: refundPermissions, permissionGroups: refundPermissionGroups, method: "POST", path: "/repair/tickets/:id/refunds", link: "/sua-chua-bao-hanh", confirmation: true, rawResponse: true, contextBody: ["idempotencyKey"],
  fields: [refundBranch(), refundTicket(), { ...number("amount", "Tổng số tiền hoàn (VND)"), required: true, systemRequired: true }, { ...number("laborAmount", "Số tiền hoàn thuộc tiền công (VND)"), required: true, systemRequired: true }, ref("reference", "Phiếu chi đã duyệt theo mã", "repair.refund.vouchers"), text("reason", "Lý do hoàn tiền", true)], resultFields: ["status", "summary"] });

const employeeCreate = operations.find(op => op.id === "employee.create")!;
employeeCreate.confirmation = true;
employeeCreate.description = "Tạo hồ sơ và tài khoản nhân viên. Mật khẩu phải nhập riêng ở bản xem trước, không cung cấp trong tin nhắn.";
const employeeUpdate = operations.find(op => op.id === "employee.update");
if (employeeUpdate) employeeUpdate.fields = employeeUpdate.fields.filter(field => field.key !== "email");
const treasuryBranch = () => queryField(ref("targetBranch", "Chi nhánh tài chính", "branch.list"), "branchId");
const treasuryReadPermissions = ["finance-wallet:read", "finance-wallet:manage"];
operations.push(
  { id: "finance.treasury.accounts.list", title: "Tra các quỹ tiền mặt và tài khoản ngân hàng", description: "Xem số dư các quỹ trong chi nhánh đã chọn.", module: "finance", permissions: treasuryReadPermissions, permissionGroups: [["finance-wallet:read"], ["finance-wallet:manage"]], method: "GET", path: "/finance/reporting/treasury", link: "/tai-chinh", fields: [treasuryBranch()], resultFields: ["name", "kind", "openingOn", "openingBalance", "balance", "version"] },
  { id: "finance.treasury.vouchers.list", title: "Tra phiếu thu chi", description: "Xem phiếu thu chi trong chi nhánh đã chọn.", module: "finance", permissions: treasuryReadPermissions, permissionGroups: [["finance-wallet:read"], ["finance-wallet:manage"]], method: "GET", path: "/finance/reporting/treasury", link: "/tai-chinh", fields: [treasuryBranch()], resultFields: ["description", "kind", "amount", "occurredOn", "status", "reference", "version"] },
  { id: "finance.treasury.bank-lines.list", title: "Tra giao dịch ngân hàng chờ đối soát", description: "Xem các giao dịch ngân hàng đã nhập trong chi nhánh đã chọn.", module: "finance", permissions: treasuryReadPermissions, permissionGroups: [["finance-wallet:read"], ["finance-wallet:manage"]], method: "GET", path: "/finance/reporting/treasury", link: "/tai-chinh", fields: [treasuryBranch()], resultFields: ["bankKey", "description", "amount", "occurredOn", "voucherId"] },
  { id: "finance.treasury.periods.list", title: "Tra cứu kỳ tài chính", description: "Xem trạng thái các kỳ tài chính trong chi nhánh đã chọn.", module: "finance", permissions: treasuryReadPermissions, permissionGroups: [["finance-wallet:read"], ["finance-wallet:manage"]], method: "GET", path: "/finance/reporting/treasury", link: "/tai-chinh", fields: [treasuryBranch()], resultFields: ["month", "status", "version", "closedAt"] },
);
operations.push({
  id: "omni-inbox.account.list",
  title: "Tra cứu tài khoản nhắn tin",
  description: "Tra cứu tài khoản Facebook, Zalo hoặc TikTok đã kết nối trong phạm vi doanh nghiệp. Hiển thị tên, kênh và trạng thái kết nối; không hiển thị thông tin xác thực.",
  module: "omni-inbox",
  permissions: ["omni-inbox:read", "omni-inbox:manage"],
  permissionGroups: [["omni-inbox:read"], ["omni-inbox:manage"]],
  method: "GET",
  path: "/omni-inbox/accounts",
  link: "/omni-inbox",
  fields: [queryField(choice("platform", "Kênh", ["Facebook", "Zalo", "TikTok"]))],
  resultFields: ["displayName", "platform", "isConnected"],
});
operations.push(
  {
    id: "marketing.account.list",
    title: "Tra cứu tài khoản mạng xã hội cho chiến dịch",
    description: "Xem tên, kênh và trạng thái kết nối của tài khoản Facebook, Zalo hoặc TikTok trong doanh nghiệp để dùng với chức năng chiến dịch. Không hiển thị thông tin xác thực hay mã tài khoản.",
    module: "social-marketing",
    permissions: ["marketing:read"],
    permissionGroups: [["marketing:read"]],
    method: "GET",
    path: "/marketing-campaigns/accounts",
    link: "/chien-dich-noi-dung",
    confirmation: false,
    fields: [queryField(choice("platform", "Kênh", ["Facebook", "Zalo", "TikTok"]))],
    resultFields: ["displayName", "platform", "isConnected"],
  },
  {
    id: "company-knowledge.account.list",
    title: "Tra cứu tài khoản mạng xã hội cho kho tri thức",
    description: "Xem tên, kênh và trạng thái kết nối của tài khoản Facebook, Zalo hoặc TikTok trong doanh nghiệp để dùng với kho tri thức. Không hiển thị thông tin xác thực hay mã tài khoản.",
    module: "company-knowledge",
    permissions: ["company-knowledge:read"],
    permissionGroups: [["company-knowledge:read"]],
    method: "GET",
    path: "/company-knowledge/accounts",
    link: "/kho-tri-thuc",
    confirmation: false,
    fields: [queryField(choice("platform", "Kênh", ["Facebook", "Zalo", "TikTok"]))],
    resultFields: ["displayName", "platform", "isConnected"],
  },
);
operations.push({
  id: "marketing.content.list",
  title: "Tra cứu nội dung marketing đã lưu",
  description: "Tìm bản nháp và nội dung marketing đã lưu theo từ khóa, kênh hoặc trạng thái trong doanh nghiệp hiện tại. Có thể xem nội dung văn bản để tiếp tục công việc; không hiển thị liên kết media, ID bài đăng, mã chiến dịch hoặc thông tin người tạo.",
  module: "social-marketing",
  permissions: ["marketing:read"],
  permissionGroups: [["marketing:read"]],
  method: "GET",
  path: "/marketing-contents",
  link: "/chien-dich-noi-dung",
  confirmation: false,
  fields: [
    queryField({ ...text("search", "Từ khóa trong tiêu đề hoặc nội dung"), max: 200 }),
    queryField(choice("channel", "Kênh", ["Facebook", "TikTok", "LinkedIn", "Instagram", "Zalo"])),
    queryField(choice("status", "Trạng thái", ["draft", "pending", "approved", "scheduled", "published", "processing", "failed"])),
    queryField({ ...number("page", "Trang", 1), min: 1, integer: true }),
    queryField({ ...number("limit", "Số kết quả", 50), min: 1, max: 100, integer: true }),
  ],
  resultFields: ["title", "channel", "contentType", "status", "bodyText", "scheduledDate", "scheduledTime", "generatedAt", "publishedAt"],
});
const leadResultFields = ["customerName", "company", "phone", "email", "value", "productOfChoice", "status", "lastInteraction"];
const leadCreateFields: AssistantField[] = [
  text("customerName", "Tên khách hàng", true),
  text("company", "Công ty"),
  phone,
  email,
  number("value", "Giá trị cơ hội (VND)", 0),
  text("productOfChoice", "Sản phẩm quan tâm"),
  choice("status", "Trạng thái", ["cold", "warm", "hot", "won", "upsell"], "cold"),
  text("lastInteraction", "Tương tác gần nhất"),
];
const leadUpdateFields = leadCreateFields.map(field => ({ ...field, systemRequired: false, required: false, defaultValue: undefined }));
operations.push(
  {
    id: "omni-inbox.leads.list",
    title: "Tra cứu khách tiềm năng",
    description: "Tìm khách tiềm năng theo tên, số điện thoại hoặc trạng thái trong doanh nghiệp hiện tại. Kết quả chỉ gồm thông tin CRM cần thiết; không hiển thị mã nội bộ hoặc ảnh đại diện.",
    module: "omni-inbox",
    permissions: ["omni-inbox:read"],
    permissionGroups: [["omni-inbox:read"]],
    method: "GET",
    path: "/omni-inbox/leads",
    link: "/omni-inbox",
    confirmation: false,
    fields: [
      queryField({ ...text("search", "Tên hoặc số điện thoại", false), max: 200 }),
      queryField(choice("status", "Trạng thái", ["cold", "warm", "hot", "won", "upsell"])),
      queryField({ ...number("page", "Trang", 1), min: 1, integer: true }),
      queryField({ ...number("limit", "Số kết quả", 50), min: 1, max: 100, integer: true }),
    ],
    resultFields: leadResultFields,
  },
  {
    id: "omni-inbox.leads.create",
    title: "Tạo khách tiềm năng",
    description: "Tạo hồ sơ CRM trong doanh nghiệp hiện tại. Cần tên khách hàng; trạng thái mặc định là mới tiếp nhận và giá trị cơ hội mặc định là 0. Kiểm tra thông tin và xác nhận trước khi lưu.",
    module: "omni-inbox",
    permissions: ["omni-inbox:manage"],
    permissionGroups: [["omni-inbox:manage"]],
    method: "POST",
    path: "/omni-inbox/leads",
    link: "/omni-inbox",
    confirmation: true,
    fields: leadCreateFields,
    resultFields: leadResultFields,
  },
  {
    id: "omni-inbox.leads.update",
    title: "Cập nhật khách tiềm năng",
    description: "Cập nhật hồ sơ CRM đã chọn theo tên hoặc số điện thoại. Chỉ thay đổi thông tin được nêu; xác nhận trước khi lưu.",
    module: "omni-inbox",
    permissions: ["omni-inbox:manage"],
    permissionGroups: [["omni-inbox:manage"]],
    method: "PATCH",
    path: "/omni-inbox/leads/:id",
    link: "/omni-inbox",
    confirmation: true,
    fields: [ref("id", "Tên hoặc số điện thoại khách tiềm năng", "omni-inbox.leads.list"), ...leadUpdateFields],
    resultFields: leadResultFields,
  },
);
const existingRoutes = new Set(operations.map(op => op.method + " " + op.path));
const expandedOperations = (expandedCatalog as AssistantOperation[]).filter(op => !existingRoutes.has(op.method + " " + op.path));
const readablePaths = new Set([...operations, ...expandedOperations].filter(op => op.method === "GET").map(op => op.path));
const partnerResultFields = ["name", "phone", "email", "bankName", "bankAccountName", "bankAccountNo", "commissionType", "commissionValue", "isActive"];
const partnerFieldLabels: Record<string, string> = {
  name: "Tên đối tác", phone: "Số điện thoại", email: "Email", commissionType: "Hình thức hoa hồng",
  commissionValue: "Mức hoa hồng", bankName: "Tên ngân hàng", bankAccountNo: "Số tài khoản ngân hàng",
  bankAccountName: "Tên chủ tài khoản", isActive: "Đang hoạt động", notes: "Ghi chú",
};
const billingProfileFieldLabels: Record<string, string> = {
  legalName: "Tên pháp nhân trên hóa đơn", taxId: "Mã số thuế", address: "Địa chỉ xuất hóa đơn",
  invoiceEmail: "Email nhận hóa đơn", contactName: "Người liên hệ", isDefault: "Đặt làm hồ sơ mặc định",
};
const commissionLevelFieldLabels: Record<string, string> = {
  name: "Tên cấp bậc hoa hồng", minTuition: "Doanh số tối thiểu (VND)",
  commissionRate: "Tỷ lệ hoa hồng (%)", centerId: "Mã trung tâm",
};
const commissionLevelTitles: Record<string, string> = {
  GET: "Tra cứu cấu hình hoa hồng", POST: "Tạo cấu hình hoa hồng",
  PATCH: "Cập nhật cấu hình hoa hồng", DELETE: "Xóa cấp bậc hoa hồng",
};
const inventoryCountTitles: Record<string, string> = {
  "GET /inventory/counts": "Tra cứu phiếu kiểm kê kho",
  "GET /inventory/counts/:id": "Xem phiếu kiểm kê kho",
  "POST /inventory/counts": "Tạo phiếu kiểm kê kho",
  "PATCH /inventory/counts/:id/items/:itemId": "Cập nhật dòng kiểm kê kho",
  "POST /inventory/counts/:id/scan": "Quét mã vào phiếu kiểm kê",
  "POST /inventory/counts/:id/start": "Bắt đầu kiểm kê kho",
  "POST /inventory/counts/:id/submit": "Gửi phiếu kiểm kê để duyệt",
  "POST /inventory/counts/:id/cancel": "Hủy phiếu kiểm kê",
  "POST /inventory/counts/:id/approve": "Phê duyệt kiểm kê và cập nhật tồn kho",
};
const inventoryCatalogTitles: Record<string, string> = {
  "GET /inventory/catalog/resources/:kind": "Tra cứu danh mục, thương hiệu, đơn vị tính hoặc thuộc tính sản phẩm",
  "POST /inventory/catalog/resources/:kind": "Tạo dữ liệu dùng chung cho sản phẩm",
  "PATCH /inventory/catalog/resources/:kind/:id": "Cập nhật dữ liệu dùng chung cho sản phẩm",
  "GET /inventory/catalog/templates": "Tra cứu mẫu sản phẩm",
  "POST /inventory/catalog/templates": "Tạo mẫu sản phẩm",
  "PATCH /inventory/catalog/templates/:id": "Cập nhật mẫu sản phẩm",
  "GET /inventory/catalog/prices": "Tra cứu giá bán và giá vốn SKU",
  "PUT /inventory/catalog/prices/:variantId": "Cập nhật giá bán SKU",
  "POST /inventory/catalog/products": "Tạo sản phẩm và SKU",
  "POST /inventory/catalog/products/bulk-create-with-variants": "Tạo sản phẩm với nhiều SKU",
  "POST /inventory/catalog/products/:id/variants": "Thêm SKU cho sản phẩm",
  "POST /inventory/catalog/products/:id/variants/bulk": "Thêm nhiều SKU cho sản phẩm",
  "PATCH /inventory/catalog/variants/:id": "Cập nhật thông tin SKU",
  "GET /inventory/transfers": "Tra cứu phiếu điều chuyển kho",
  "POST /inventory/transfers": "Tạo phiếu điều chuyển kho",
  "GET /inventory/transfers/:id": "Xem chi tiết phiếu điều chuyển kho",
  "POST /inventory/transfers/:id/accept": "Nhận phiếu điều chuyển kho",
  "POST /inventory/transfers/:id/cancel": "Hủy phiếu điều chuyển kho",
};
operations.push(...expandedOperations.map(op => {
  const partnerList = op.method === "GET" && op.path === "/partners";
  const partnerCreate = op.method === "POST" && op.path === "/partners";
  const partnerBulkCreate = op.method === "POST" && op.path === "/partners/bulk";
  const partnerDetail = op.path === "/partners/:id" && ["GET", "PATCH"].includes(op.method);
  const customerBillingProfileList = op.method === "GET" && op.path === "/customers/:id/billing-profiles";
  const customerBillingProfileCreate = op.method === "POST" && op.path === "/customers/:id/billing-profiles";
  const customerBillingProfileOperation = customerBillingProfileList || customerBillingProfileCreate;
  const commissionLevel = op.path === "/partners/commission-levels" || op.path.startsWith("/partners/commission-levels/");
  const commissionLevelList = op.method === "GET" && op.path === "/partners/commission-levels";
  const workerPartnerList = op.method === "GET" && op.path === "/worker-management/partners";
  const workerList = op.method === "GET" && op.path === "/worker-management/workers";
  const workerAttendanceMark = op.method === "POST" && op.path === "/worker-management/attendance/mark";
  const workerAttendanceList = op.method === "GET" && op.path === "/worker-management/attendance";
  const workerAttendanceAdjust = op.method === "PATCH" && op.path === "/worker-management/attendance/:id";
  const workerPartnerReferralCreate = op.method === "POST" && op.path === "/worker-management/partners/:partnerId/referrals";
  const workerPartnerReferralEnd = op.method === "POST" && op.path === "/worker-management/partners/:partnerId/referrals/:referralId/end";
  const chatRoomsList = op.method === "GET" && op.path === "/chat/rooms";
  const chatRoomMembersList = op.method === "GET" && op.path === "/chat/rooms/:roomId";
  const chatRoomMemberRemove = op.method === "DELETE" && op.path === "/chat/rooms/:roomId/members/:userId";
  const chatRoomMemberRoleUpdate = op.method === "POST" && op.path === "/chat/rooms/:roomId/members/:userId/role";
  const chatMessagesList = op.method === "GET" && op.path === "/chat/rooms/:roomId/messages";
  const workerLaborContractList = op.method === "GET" && op.path === "/worker-management/labor-contracts";
  const workerLaborContractPath = op.path.startsWith("/worker-management/labor-contracts/:id");
  const workerPartnerPath = op.path.startsWith("/worker-management/partners/") && !op.path.startsWith("/worker-management/partners/policies");
  const workerPartnerPolicyList = op.method === "GET" && op.path === "/worker-management/partners/policies";
  const workerPartnerPolicyPath = op.path.startsWith("/worker-management/partners/policies/");
  const inventoryCount = op.path.startsWith("/inventory/counts");
  const markInstallmentPaid = op.method === "PATCH" && op.path === "/students/:id/installment/:no/mark-paid";
  const studentList = op.method === "GET" && op.path === "/students";
  const unassignedStudentList = op.method === "GET" && op.path === "/students/unassigned";
  const studentUpdate = op.method === "PATCH" && op.path === "/students/:id";
  const assignStudentBranch = op.method === "PATCH" && op.path === "/students/:id/assign-branch";
  const courseList = op.method === "GET" && op.path === "/courses";
  const courseCategoryList = op.method === "GET" && op.path === "/courses/categories";
  const batchList = op.method === "GET" && op.path === "/batches";
  const assignmentList = op.method === "GET" && op.path === "/assignments";
  const miniTestCreate = op.method === "POST" && op.path === "/student-quality/batches/:batchId/students/:studentId/mini-tests";
  const studentQualityBatchPath = op.path.startsWith("/student-quality/batches/:batchId/students/:studentId");
  const learningRoadmapProgression = op.path.startsWith("/learning-roadmaps/batches/:batchId/");
  const learningRoadmapWaitlist = op.path === "/learning-roadmaps/waitlist";
  const learningRoadmapWaitlistPlace = op.method === "POST" && op.path === "/learning-roadmaps/waitlist/place";
  const paymentsCreate = op.method === "POST" && op.path === "/payments";
  const studentNotificationCreate = op.method === "POST" && op.path === "/student-notifications";
  const studentQualityList = op.method === "GET" && op.path === "/student-quality";
  const warehouseLocations = op.method === "GET" && op.path === "/inventory/warehouses";
  const balanceThresholds = op.method === "PATCH" && op.path === "/inventory/warehouses/balances/:id/thresholds";
  const inventoryResource = op.path === "/inventory/catalog/resources/:kind" || op.path === "/inventory/catalog/resources/:kind/:id";
  const inventoryVariantBulkUpdate = op.method === "PATCH" && op.path === "/inventory/catalog/variants/bulk";
  const inventoryVariantBulkDelete = op.method === "DELETE" && op.path === "/inventory/catalog/variants/bulk";
  const inventoryTemplateList = op.method === "GET" && op.path === "/inventory/catalog/templates";
  const inventoryProductList = op.method === "GET" && op.path === "/inventory/catalog/products";
  const inventoryProductDetail = op.method === "GET" && op.path === "/inventory/catalog/products/:id";
  const inventoryPriceList = op.method === "GET" && op.path === "/inventory/catalog/prices";
  const inventorySupplierList = op.method === "GET" && op.path === "/inventory/receiving/suppliers";
  const inventoryTransferList = op.method === "GET" && op.path === "/inventory/transfers";
  const inventoryTransferCreate = op.method === "POST" && op.path === "/inventory/transfers";
  const inventoryTransferDetail = op.method === "GET" && op.path === "/inventory/transfers/:id";
  const inventoryTransferPath = inventoryTransferDetail || op.path.startsWith("/inventory/transfers/:id/");
  const inventoryStockLogReverse = op.method === "POST" && op.path === "/inventory/stock-logs/:id/reverse";
  const retailPartnerList = op.method === "GET" && op.path === "/retail/partners";
  const retailPartnerSupplierList = op.method === "GET" && op.path === "/retail/partners/suppliers";
  const retailPartnerUserList = op.method === "GET" && op.path === "/retail/partners/users";
  const retailPartnerCustomerList = op.method === "GET" && op.path === "/retail/partners/customers";
  const retailPartnerPolicyList = op.method === "GET" && op.path === "/retail/partners/commission-policies";
  const retailProductCommissionProducts = op.method === "GET" && op.path === "/retail/partners/policy-products";
  const retailProductCommissionUpdate = op.method === "PUT" && op.path === "/retail/partners/product-commissions";
  const retailPointsPolicyList = op.method === "GET" && op.path === "/retail/points/policy";
  const retailShiftList = op.method === "GET" && op.path === "/retail/shifts";
  const retailCashierList = op.method === "GET" && op.path === "/retail/shifts/cashiers";
  const retailDrawerList = op.method === "GET" && op.path === "/retail/shifts/drawers";
  const retailSettlementList = op.method === "GET" && op.path === "/retail/shifts/settlements";
  const retailShiftCurrent = op.method === "GET" && op.path === "/retail/shifts/current";
  const retailOrderProducts = op.method === "GET" && op.path === "/retail/orders/products";
  const retailInvoiceList = op.method === "GET" && op.path === "/retail/invoices";
  const retailOrderList = op.method === "GET" && op.path === "/retail/orders";
  const retailOrderDetail = op.method === "GET" && op.path === "/retail/orders/:id";
  const retailOrderQuote = op.method === "POST" && op.path === "/retail/orders/quote";
  const retailOrderCheckout = op.method === "POST" && op.path === "/retail/orders/checkout";
  const retailOrderDraftCreate = op.method === "POST" && op.path === "/retail/orders";
  const retailOrderDraftUpdate = op.method === "PATCH" && op.path === "/retail/orders/:id";
  const retailOrderConfirm = op.method === "POST" && op.path === "/retail/orders/:id/confirm";
  const retailOrderCollect = op.method === "POST" && op.path === "/retail/orders/:id/payments";
  const retailOrderCancel = op.method === "POST" && op.path === "/retail/orders/:id/cancel";
  const retailOrderPath = op.path.startsWith("/retail/orders/:id");
  const retailPosOperation = op.path.startsWith("/retail/orders") || op.path.startsWith("/retail/shifts");
  const retailCashbookOperation = op.path.startsWith("/retail/finance/cashbook");
  const retailFinanceCommissionOperation = op.path.startsWith("/retail/finance/commission/");
  const retailReceivableOperation = op.path.startsWith("/retail/receivables/");
  const retailAfterSaleOperation = op.path.startsWith("/retail/after-sales");
  const retailShiftPath = op.path.startsWith("/retail/shifts/:id/") || op.path === "/retail/shifts/:id";
  const financeDebtList = op.method === "GET" && op.path === "/finance/reporting/debts";
  const financeManagementDebtList = op.method === "GET" && op.path === "/finance/management/debts";
  const financeManagementPayableCreate = op.method === "POST" && op.path === "/finance/management/payables";
  const financeManagementFollowup = op.method === "POST" && op.path === "/finance/management/followups";
  const financeDebtPayment = op.method === "POST" && op.path === "/finance/reporting/debts/:id/payments";
  const financeReceivableList = op.method === "GET" && op.path === "/finance/receivables";
  const financeReceivableDetail = op.method === "GET" && op.path === "/finance/receivables/:id";
  const financeReceivableEntryReversal = op.method === "POST" && op.path === "/finance/receivables/:id/entries/:entryId/reversal";
  const financeReceivableAging = op.method === "GET" && op.path === "/finance/receivables/aging";
  const financeReceivableByCustomer = op.method === "GET" && op.path === "/finance/receivables/by-customer";
  const financeReceivablePath = op.path.startsWith("/finance/receivables/:id");
  const financeReceivableSuspend = op.method === "POST" && op.path === "/finance/receivables/:id/suspend";
  const financeReceivableExtend = op.method === "POST" && op.path === "/finance/receivables/:id/extend";
  const financeReceivableOperation = op.path.startsWith("/finance/receivables");
  const retailSettingsOperation = op.path === "/retail/settings";
  const financeVatList = op.method === "GET" && op.path === "/finance/reporting/vat";
  const financeTaxFromInvoice = op.method === "POST" && op.path === "/finance/management/tax/from-invoice/:id";
  const financeAssetList = op.method === "GET" && op.path === "/finance/assets";
  const financeAssetDepreciationList = op.method === "GET" && op.path === "/finance/assets/depreciations";
  const financeAssetDetail = op.method === "GET" && op.path === "/finance/assets/:id";
  const financeAssetSchedule = op.method === "GET" && op.path === "/finance/assets/:id/schedule";
  const financeAssetPath = op.path.startsWith("/finance/assets/:id");
  const financeAssetInventoryList = op.method === "GET" && op.path === "/finance/asset-inventories";
  const financeAssetInventoryPath = op.path.startsWith("/finance/asset-inventories/:id");
  const inventorySerialList = op.method === "GET" && op.path === "/inventory/serials";
  const inventorySerialDetail = op.method === "GET" && op.path === "/inventory/serials/:id";
  const inventorySerialHistory = op.method === "GET" && op.path === "/inventory/serials/:id/history";
  const inventorySerialCreate = op.method === "POST" && op.path === "/inventory/serials";
  const inventorySerialTransition = op.method === "POST" && op.path === "/inventory/serials/:id/transition";
  const inventorySerialPath = op.path.startsWith("/inventory/serials/:id");
  const inventorySerialOperation = op.path.startsWith("/inventory/serials");
  const retailCommission = op.path.startsWith("/retail/finance/commission/partners/");
  const fields = financeManagementDebtList || financeManagementPayableCreate || financeManagementFollowup
    ? [queryField(ref("targetBranch", "Chi nhánh tài chính", "branch.list", false), "branchId"), ...op.fields.map(field => {
      if (financeManagementPayableCreate && field.source === "body" && field.apiKey === "receiptId") return { ...field, type: "reference" as const, label: "Phiếu nhập hàng chưa ghi nhận công nợ", reference: "finance.management.debts.list", referenceParentKey: "targetBranch", referenceValueKey: "id" };
      if (financeManagementFollowup && field.source === "body" && field.apiKey === "targetId") return { ...field, type: "reference" as const, label: "Khoản phải thu hoặc phải trả", reference: "finance.management.debts.list", referenceParentKey: "targetBranch", referenceValueKey: "id" };
      if (financeManagementFollowup && field.source === "body" && field.apiKey === "assignee") return { ...field, type: "reference" as const, label: "Nh\u00E2n s\u1EF1 ph\u1EE5 tr\u00E1ch", reference: "employee.list", referenceValueKey: "displayName" };
      return field;
    })]
    : retailInvoiceList
    ? [queryField({ ...text("search", "Số hóa đơn, mã đơn hoặc tên khách hàng"), max: 100 }, "q"), queryField({ ...number("page", "Trang", 1), min: 1, max: 10000 }, "page"), queryField({ ...number("limit", "Số kết quả", 100), min: 1, max: 100 }, "limit"), queryField(ref("targetBranch", "Chi nhánh bán lẻ", "branch.list", false), "branchId")]
    : partnerList
    ? [queryField(text("search", "Tên, số điện thoại hoặc mã đối tác"), "search")]
    : retailPartnerList
      ? [queryField(choice("role", "Vai trò đối tác", ["collaborator", "dealer", "supplier"]))]
    : studentList
      ? [queryField({ ...text("search", "Tên hoặc số điện thoại học viên"), max: 100 }, "search"), queryField(text("status", "Trạng thái"), "status"), queryField(text("rank", "Hạng"), "rank"), queryField({ ...number("page", "Trang", 1), min: 1, max: 10000 }, "page"), queryField({ ...number("limit", "Số kết quả", 100), min: 1, max: 100 }, "limit")]
      : unassignedStudentList
        ? [queryField(text("search", "Tên hoặc số điện thoại học viên chưa có chi nhánh"), "search"), queryField(number("page", "Trang", 1), "page"), queryField(number("limit", "Số kết quả", 100), "limit")]
      : batchList
        ? [queryField({ ...text("search", "Tên hoặc mã lớp"), max: 100 }, "search"), queryField(text("status", "Trạng thái"), "status"), queryField({ ...number("page", "Trang", 1), min: 1, max: 10000 }, "page"), queryField({ ...number("limit", "Số kết quả", 100), min: 1, max: 100 }, "limit")]
      : courseList
        ? [queryField(text("search", "Tên hoặc mã khóa học"), "search"), queryField(number("page", "Trang", 1), "page"), queryField(number("limit", "Số kết quả", 100), "limit")]
      : financeAssetList
        ? [queryField(text("search", "Mã, mã vạch hoặc tên tài sản"), "search"), queryField(choice("status", "Trạng thái", ["in_use", "idle", "repairing", "lost", "damaged"])), queryField(text("group", "Nhóm tài sản"))]
      : financeAssetDepreciationList
        ? [queryField(text("period", "Kỳ khấu hao (YYYY-MM)", true), "period")]
    : op.fields.map(field => {
      if (field.source === "query" && field.apiKey === "branchId" && (financeTaxFromInvoice || inventoryStockLogReverse || financeDebtList || financeManagementDebtList || financeManagementPayableCreate || financeManagementFollowup || (op.method !== "GET" && !op.id.startsWith("recruitment.")))) { const label = financeTaxFromInvoice || financeDebtList || financeManagementDebtList || financeManagementPayableCreate || financeManagementFollowup || op.path.startsWith("/finance/") ? "Chi nhánh tài chính" : inventoryStockLogReverse ? "Chi nhánh kho" : "Chi nhánh áp dụng"; return { ...field, key: "targetBranch", type: "reference" as const, label, reference: "branch.list" }; }
      if (op.path.startsWith("/payroll/periods/") && field.source === "path" && field.apiKey === "periodKey") return { ...field, label: "K\u1EF3 l\u01B0\u01A1ng (YYYY-MM)", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" };
      if (op.id === "payroll.period.input.update" && field.source === "path" && field.apiKey === "employeeId") return { ...field, label: "T\u00EAn nh\u00E2n vi\u00EAn", reference: "employee.list" };
      if (inventoryCount && field.key === "path_id") return { ...field, label: "Mã hoặc tên phiếu kiểm kê" };
      if (op.method === "PATCH" && op.path === "/resources/:id/move" && field.source === "path" && field.apiKey === "id") return { ...field, label: "Tên hoặc mã tệp/thư mục cần di chuyển", reference: "resource.list", referenceValueKey: "id" };
      if (op.method === "PATCH" && op.path === "/resources/:id/move" && field.source === "body" && field.apiKey === "parentId") return { ...field, type: "reference" as const, label: "Thư mục đích", reference: "resource.list", referenceValueKey: "id" };
      if (op.path.startsWith("/chat/rooms/") && field.source === "path" && field.apiKey === "roomId") return { ...field, label: "Phòng trò chuyện", reference: "chat.rooms.list", referenceValueKey: "id" };
      if (chatRoomMemberRoleUpdate && field.source === "path" && field.apiKey === "userId") return { ...field, label: "Thành viên trong phòng đã chọn", reference: "chat.room.members.list", referenceParentKey: "path_roomId", referenceValueKey: "id" };
      if (chatRoomMemberRemove && field.source === "path" && field.apiKey === "userId") return { ...field, label: "Thành viên cần xóa khỏi phòng đã chọn", reference: "chat.room.members.list", referenceParentKey: "path_roomId", referenceValueKey: "id" };
      if ((op.path === "/chat/rooms" || op.path === "/chat/rooms/:roomId/members") && op.method === "POST" && field.source === "body" && field.apiKey === "memberIds" && field.structure?.type === "array") return { ...field, label: "Đồng nghiệp cần thêm", structure: { ...field.structure, items: { ...(field.structure.items || { type: "string" }), reference: "account.colleagues.list", referenceValueKey: "id", label: "Tên đồng nghiệp" } } };
      if (op.path.startsWith("/chat/rooms/") && field.apiKey === "messageId") return { ...field, type: "reference" as const, label: "Tin nhắn trong phòng đã chọn", reference: "chat.room.messages.list", referenceParentKey: "path_roomId", referenceValueKey: "id" };
      if (op.method === "POST" && op.path === "/chat/rooms/:roomId/messages" && field.source === "body" && field.apiKey === "replyTo") return { ...field, type: "reference" as const, label: "Tin nhắn cần trả lời", reference: "chat.room.messages.list", referenceParentKey: "path_roomId", referenceValueKey: "id" };
      if (op.method === "POST" && op.path === "/notifications" && field.source === "body" && field.apiKey === "recipientUid") return { ...field, type: "reference" as const, label: "Đồng nghiệp nhận thông báo", reference: "account.colleagues.list", referenceValueKey: "id" };
      if (inventoryCount && field.key === "code") return { ...field, label: "Mã IMEI hoặc mã nội bộ cần quét" };
      if (inventoryCount && field.key === "notes") return { ...field, label: "Ghi chú kiểm kê" };
      if (inventoryTransferPath && field.key === "path_id") return { ...field, label: "Mã phiếu điều chuyển", reference: "inventory.transfer.list" };
      if (inventoryCount && field.key === "warehouseId") return { ...field, label: "Kho kiểm kê" };
      if (inventoryResource && field.key === "path_kind") return { ...field, label: "Loại dữ liệu sản phẩm", options: op.method === "DELETE" ? ["categories", "brands"] : ["categories", "brands", "units", "attributes"] };
      if (inventoryResource && field.key === "path_id") return { ...field, label: "Tên hoặc mã dữ liệu sản phẩm", reference: "inventory.catalog.resource.list" };
      if (inventoryResource && field.source === "body" && field.apiKey === "category" && op.method === "POST") return { ...field, label: "Nhóm đơn vị tính", requiredWhen: { field: "path_kind", equals: "units" } };
      if (inventoryResource && field.source === "body" && field.apiKey === "type" && op.method === "POST") return { ...field, label: "Kiểu thuộc tính", requiredWhen: { field: "path_kind", equals: "attributes" } };
      if (inventoryResource && field.source === "body" && field.apiKey === "options") return { ...field, label: "Danh sách giá trị lựa chọn (JSON)", requiredWhen: { field: "type", equals: ["select", "multi-select"] } };
      if (inventoryResource && field.source === "body" && field.apiKey === "conversionFactor") return { ...field, label: "Hệ số quy đổi", requiredWhen: { field: "baseUnitCode", present: true } };
      if (retailCommission && field.key === "path_id") return { ...field, label: "Tên hoặc mã cộng tác viên", reference: "retail.partner.list" };
      if (op.id === "retail.payment-review.review" && field.key === "path_id") return { ...field, label: "Mã đơn hoặc mã thanh toán cần rà soát", reference: "retail.payment-review.pending" };
      if (op.path === "/retail/partners/:id" && field.key === "path_id") return { ...field, label: "Tên hoặc mã đối tác bán lẻ", reference: "retail.partner.list" };
      if (retailShiftPath && field.key === "path_id") return { ...field, label: "Mã ca POS hoặc tên nhân viên thu ngân", reference: "retail.shift.list" };
      if (retailOrderPath && field.key === "path_id") return { ...field, label: "Mã hoặc tên đơn bán lẻ", reference: "retail.order.list" };
      if (customerBillingProfileOperation && field.key === "path_id") return { ...field, label: "Tên hoặc số điện thoại khách hàng", reference: "customer.list" };
      if (customerBillingProfileCreate && field.source === "body" && billingProfileFieldLabels[field.apiKey || field.key]) return { ...field, label: billingProfileFieldLabels[field.apiKey || field.key] };
      if (financeDebtPayment && field.key === "path_id") return { ...field, label: "Mã chứng từ hoặc đối tượng công nợ", reference: "finance.debt.list" };
      if (financeReceivablePath && field.key === "path_id") return { ...field, label: "Mã khoản phải thu hoặc mã chứng từ", reference: "finance.receivable.list" };
      if ((financeReceivableList || financeReceivableByCustomer) && field.apiKey === "customerId") return { ...field, label: "Tên khách hàng", reference: "customer.list" };
      if (op.path === "/retail/points/customers/:id/adjust" && field.key === "path_id") return { ...field, label: "Tên hoặc mã khách hàng", reference: "customer.list" };
      if (op.path.startsWith("/inventory/catalog/products/") && field.key === "path_id") return { ...field, label: "Tên hoặc mã sản phẩm", reference: "product.list" };
      if (op.method === "PUT" && op.path === "/inventory/catalog/prices/:variantId" && field.key === "path_variantId") return { ...field, label: "SKU hoặc tên biến thể" };
      if (op.path.startsWith("/inventory/receiving/receipts/") && field.key === "path_id") return { ...field, label: "Mã phiếu nhập" };
      if (field.apiKey === "partnerId" && op.path.includes("commission")) return { ...field, label: "Tên cộng tác viên", reference: "retail.partner.list" };
      if (markInstallmentPaid && field.key === "path_id") return { ...field, label: "Tên, số điện thoại hoặc email học viên", reference: "student.list" };
      if (studentUpdate && field.key === "path_id") return { ...field, label: "Tên, số điện thoại hoặc email học viên", reference: "student.list" };
      if (financeAssetPath && field.key === "path_id") return { ...field, label: "Tên, mã hoặc mã vạch tài sản", reference: "finance.asset.list" };
      if (financeAssetInventoryPath && field.key === "path_id") return { ...field, label: "Mã hoặc tên phiên kiểm kê", reference: "finance.asset.inventory.list" };
      if (assignStudentBranch && field.key === "path_id") return { ...field, label: "Tên hoặc số điện thoại học viên chưa có chi nhánh", reference: "student.unassigned.list" };
      if (miniTestCreate && field.source === "path" && field.apiKey === "batchId") return { ...field, label: "Mã lớp", reference: "batch.list" };
      if (studentQualityBatchPath && field.source === "path" && field.apiKey === "batchId") return { ...field, label: "Tên hoặc mã lớp", reference: "batch.list", referenceValueKey: "id" };
      if (studentQualityBatchPath && field.source === "path" && field.apiKey === "studentId") return { ...field, label: "Tên hoặc số điện thoại học viên trong lớp", reference: "batch.attendance.learners", referenceParentKey: "path_batchId", referenceValueKey: "id" };
      if (studentQualityBatchPath && field.source === "path" && field.apiKey === "assignmentId") return { ...field, label: "Tên bài tập trong lớp", reference: "student.assignment.list", referenceParentKey: "path_batchId", referenceValueKey: "id" };
      if (paymentsCreate && field.source === "body" && field.apiKey === "studentId") return { ...field, type: "reference" as const, label: "Tên hoặc số điện thoại học viên", reference: "student.list", referenceValueKey: "id" };
      if (studentNotificationCreate && field.source === "body" && field.apiKey === "studentIds" && field.structure?.type === "array") return { ...field, label: "Học viên nhận thông báo", structure: { ...field.structure, items: { ...(field.structure.items || { type: "string" }), type: "string", reference: "student.list", referenceValueKey: "id", label: "Tên hoặc số điện thoại học viên" } } };
      if (op.path === "/assignments" && op.method === "POST" && field.source === "body" && field.apiKey === "batchId") return { ...field, type: "reference" as const, label: "Tên hoặc mã lớp", reference: "batch.list", referenceValueKey: "id" };
      if (op.path === "/assignments/:id/submissions" && field.source === "path" && field.apiKey === "id") return { ...field, label: "Tên bài tập trong lớp đã chọn", reference: "student.assignment.list", referenceParentKey: "query_batchId", referenceValueKey: "id" };
      if (learningRoadmapWaitlistPlace && field.source === "body" && field.apiKey === "batchId") return { ...field, type: "reference" as const, label: "Tên hoặc mã lớp đích", reference: "batch.list", referenceValueKey: "id" };
      if (learningRoadmapWaitlistPlace && field.source === "body" && field.apiKey === "entryIds" && field.structure?.type === "array") return { ...field, label: "Học viên cần xếp lớp", structure: { ...field.structure, items: { ...(field.structure.items || { type: "string" }), reference: "student.learning-roadmap.waitlist.list", referenceValueKey: "id", label: "Học viên và lộ trình" } } };
      if (op.path.startsWith("/learning-roadmaps/batches/:batchId/") && field.source === "path" && field.apiKey === "batchId") return { ...field, label: "Tên hoặc mã lớp", reference: "batch.list", referenceValueKey: "id" };
      if (learningRoadmapProgression && field.source === "path" && field.apiKey === "studentId") return { ...field, label: "Tên hoặc số điện thoại học viên trong lớp", reference: "batch.attendance.learners", referenceParentKey: "path_batchId", referenceValueKey: "id" };
      if (learningRoadmapProgression && field.apiKey === "roadmapId") return { ...field, type: "reference" as const, label: "Tên hoặc mã lộ trình", reference: "student.learning-roadmap.list", referenceValueKey: "id" };
      if (learningRoadmapWaitlist && field.apiKey === "roadmapId") return { ...field, type: "reference" as const, label: "Tên hoặc mã lộ trình", reference: "student.learning-roadmap.list", referenceValueKey: "id" };
      if (learningRoadmapWaitlist && field.apiKey === "targetStepId") return { ...field, type: "reference" as const, label: "Chặng học của lộ trình đã chọn", reference: "student.learning-roadmap.steps.list", referenceParentKey: "query_roadmapId", referenceValueKey: "stepId" };
      if (studentQualityList && field.source === "query" && field.apiKey === "batchId") return { ...field, type: "reference" as const, label: "Tên hoặc mã lớp", reference: "batch.list", referenceValueKey: "id" };
      if (studentQualityList && field.source === "query" && field.apiKey === "courseId") return { ...field, type: "reference" as const, label: "Tên hoặc mã khóa học", reference: "course.list", referenceValueKey: "id" };
      if (studentQualityList && field.source === "query" && field.apiKey === "instructorId") return { ...field, type: "reference" as const, label: "Tên giảng viên", reference: "employee.list", referenceValueKey: "id" };
      if (op.method === "GET" && op.path === "/learning-roadmaps/:id/steps" && field.source === "query" && field.apiKey === "courseId") return { ...field, type: "reference" as const, label: "Tên hoặc mã khóa học", reference: "course.list", referenceValueKey: "id" };
      if (op.method === "PATCH" && op.path === "/learning-roadmaps/batches/:batchId/students/:studentId/progression" && field.apiKey === "roadmapId") return { ...field, type: "reference" as const, label: "Tên hoặc mã lộ trình", reference: "student.learning-roadmap.list", referenceValueKey: "id" };
      if ((op.path === "/recruitment/jobs" || op.path === "/recruitment/jobs/:id") && field.source === "body" && field.apiKey === "department") return { ...field, type: "reference" as const, label: "Phòng ban tuyển dụng", reference: "department.list", referenceValueKey: "name" };
      if ((op.path === "/courses" && op.method === "POST" || op.path === "/courses/:id" && op.method === "PATCH") && field.source === "body" && field.apiKey === "category") return { ...field, type: "reference" as const, label: "Danh mục khóa học", reference: "course.category.list", referenceValueKey: "name" };
      if (op.path.startsWith("/finance/assets") && field.source === "body" && field.apiKey === "department") return { ...field, type: "reference" as const, label: "Phòng ban sử dụng tài sản", reference: "department.list", referenceValueKey: "name" };
      if (op.path.startsWith("/finance/assets") && field.source === "body" && field.apiKey === "custodianName") return { ...field, type: "reference" as const, label: "Nhân sự quản lý tài sản", reference: "employee.list", referenceValueKey: "displayName" };
      if (op.path.startsWith("/finance/assets") && field.source === "body" && field.apiKey === "supplierName") return { ...field, type: "reference" as const, label: "Nhà cung cấp tài sản", reference: "inventory.supplier.list", referenceValueKey: "name" };
      if ((workerAttendanceMark || workerAttendanceList || workerAttendanceAdjust) && field.apiKey === "projectId") return { ...field, type: "reference" as const, label: "Tên hoặc mã dự án", reference: "worker.project.list", referenceValueKey: "id" };
      if (workerAttendanceMark && field.source === "body" && field.apiKey === "workerId") return { ...field, type: "reference" as const, label: "Tên người lao động", reference: "worker.list", referenceValueKey: "id" };
      if (workerPartnerReferralCreate && field.source === "body" && field.apiKey === "workerId") return { ...field, type: "reference" as const, label: "Tên người lao động được giới thiệu", reference: "worker.list", referenceValueKey: "id" };
      if (workerPartnerReferralCreate && field.source === "body" && field.apiKey === "policyId") return { ...field, type: "reference" as const, label: "Chính sách hoa hồng", reference: "worker.partner.policy.list", referenceValueKey: "id" };
      if (workerPartnerReferralEnd && field.source === "path" && field.apiKey === "referralId") return { ...field, label: "Người lao động hoặc thời hạn giới thiệu", reference: "worker.partner.referrals.list", referenceParentKey: "path_partnerId", referenceValueKey: "id" };
      if (markInstallmentPaid && field.key === "path_no") return { ...field, label: "Số đợt học phí" };
      if (balanceThresholds && field.key === "path_id") return { ...field, label: "SKU hoặc tên sản phẩm trong kho" };
      if (balanceThresholds && field.key === "minStock") return { ...field, label: "Tồn tối thiểu" };
      if (balanceThresholds && field.key === "maxStock") return { ...field, label: "Tồn tối đa" };
      if (commissionLevel && field.key === "path_id") return { ...field, label: "Tên hoặc mã cấp bậc hoa hồng", reference: "partner.commission.levels.list" };
      if (commissionLevel && field.source === "body" && commissionLevelFieldLabels[field.apiKey || field.key]) return { ...field, label: commissionLevelFieldLabels[field.apiKey || field.key] };
      if (op.path.startsWith("/partners") && field.key === "path_id") return { ...field, label: "Tên hoặc mã đối tác", reference: "partner.list" };
      if (op.path.startsWith("/partners") && field.source === "body") {
        const label = field.key === "path_id" ? "Tên hoặc mã đối tác" : partnerFieldLabels[field.apiKey || field.key];
        if (label) return { ...field, label };
      }
      if (inventorySerialPath && field.key === "path_id") return { ...field, label: "IMEI, serial hoặc mã vạch", reference: "inventory.serial.list" };
      if (workerPartnerPath && field.source === "path" && field.apiKey === "partnerId") return { ...field, label: "Tên hoặc mã đối tác lao động", reference: "worker.partner.list" };
      if (workerPartnerPolicyPath && field.source === "path" && field.apiKey === "policyId") return { ...field, label: "Tên hoặc mã chính sách hoa hồng", reference: "worker.partner.policy.list" };
      if (workerLaborContractPath && field.key === "path_id") return { ...field, label: "Mã hợp đồng hoặc tên người lao động", reference: "worker.labor.contract.list" };
      if ((op.id === "payroll.employee.reconciliation.action" || op.id === "payroll.employee.me.payslip.review.request") && field.key === "path_id") return field;
      if (op.id === "student.detail" && field.key === "path_id") return { ...field, label: "Tên, số điện thoại hoặc email học viên", reference: "student.list" };
      if (op.id === "student.learning-history" && field.key === "path_id") return { ...field, label: "Tên hoặc số điện thoại học viên", reference: "student.list" };
      if (field.source !== "path" || !/^(?:id|uid|[A-Za-z]+(?:Id|Uid|Key))$/.test(field.apiKey || "")) return field;
      const parameter = `:${field.apiKey}`;
      const parameterAt = op.path.indexOf(parameter);
      if (parameterAt < 0) return field;
      const collectionPath = op.path.slice(0, parameterAt).replace(/\/$/, "");
      if (!readablePaths.has(collectionPath)) return field;
      if (/^(?:Tên (?:hoặc|,)|Mã (?:hoặc|,))/.test(field.label)) return field;
      return { ...field, label: field.label.startsWith("Mã ") ? field.label.replace(/^Mã /, "Tên hoặc mã ") : `Tên hoặc mã ${field.label}` };
    });
  return {
    ...op,
    ...(financeTaxFromInvoice ? { id: "finance.tax.from-invoice" } : {}),
    ...(op.method === "POST" && op.path === "/assignments" ? { id: "student.assignment.create", title: "Tạo bài tập cho lớp", description: "Tạo bài tập cho lớp đã chọn theo tên hoặc mã. API gửi email tới học viên trong lớp ở chế độ nền; cần xác nhận trước khi tạo." } : {}),
    ...(assignmentList ? { id: "student.assignment.list", title: "Tra cứu bài tập trong lớp", description: "Liệt kê bài tập của lớp đã chọn theo tên hoặc mã lớp để chọn đúng bài cần xem hoặc xử lý.", resultFields: ["title", "description", "dueDate", "maxScore", "createdAt"] } : {}),
    ...(inventoryStockLogReverse ? { id: "inventory.stock-log.reverse" } : {}),
    ...(warehouseLocations ? { id: "inventory.warehouse.locations.list", title: "Tra cứu kho", description: "Tìm kho đang hoạt động theo tên hoặc mã trong phạm vi công ty và chi nhánh.", resultFields: ["name", "code", "kind", "isActive"] } : {}),
    ...(inventoryResource && op.method === "GET" ? { id: "inventory.catalog.resource.list", title: "Tra cứu dữ liệu dùng chung cho sản phẩm", resultFields: ["code", "name", "status", "parentCode", "description", "website", "symbol", "category", "decimalPlaces", "baseUnitCode", "conversionFactor", "type", "options", "unitCode"] } : {}),
    ...(inventoryVariantBulkUpdate ? { id: "inventory.variant.bulk.update", title: "Cập nhật nhiều SKU" } : {}),
    ...(inventoryVariantBulkDelete ? { id: "inventory.variant.bulk.delete", title: "Xóa nhiều SKU" } : {}),
    ...(inventoryProductList ? { id: "product.list", title: "Tra cứu sản phẩm", description: "Tìm sản phẩm theo tên, mã sản phẩm hoặc SKU trong danh mục công ty.", resultFields: ["name", "productCode", "categoryCode", "productType", "status"] } : {}),
    ...(inventoryTemplateList ? { id: "inventory.catalog.template.list", title: "Tra cứu mẫu sản phẩm", resultFields: ["code", "name", "productType", "status"] } : {}),
    ...(inventoryProductDetail ? { id: "inventory.product.detail", title: "Xem chi tiết sản phẩm và SKU", resultFields: ["name", "productCode", "categoryCode", "productType", "status", "sku", "displayName", "unitCode", "trackingMode", "productId", "productName"] } : {}),
    ...(inventoryPriceList ? { id: "inventory.prices.list", title: "Tra cứu giá bán và giá vốn SKU", resultFields: ["variantId", "sku", "sellingPrice", "costPrice", "status"] } : {}),
    ...(inventorySupplierList ? { id: "inventory.supplier.list", title: "Tra cứu nhà cung cấp", resultFields: ["name", "code", "phone", "email", "status"] } : {}),
    ...(courseCategoryList ? { id: "course.category.list", title: "Tra cứu danh mục khóa học", description: "Liệt kê danh mục khóa học trong phạm vi được phép để người dùng chọn khi tạo hoặc sửa khóa học.", resultFields: ["name"] } : {}),
    ...(inventoryTransferList ? { id: "inventory.transfer.list", title: "Tra cứu phiếu điều chuyển kho", resultFields: ["code", "status", "reason", "items"] } : {}),
    ...(inventoryTransferCreate ? { id: "inventory.transfer.create", title: "Tạo phiếu điều chuyển kho" } : {}),
    ...(inventoryTransferDetail ? { id: "inventory.transfer.detail", title: "Xem chi tiết phiếu điều chuyển kho" } : {}),
    ...(op.method === "POST" && op.path === "/inventory/transfers/:id/accept" ? { id: "inventory.transfer.accept", title: "Nhận phiếu điều chuyển kho" } : {}),
    ...(op.method === "POST" && op.path === "/inventory/transfers/:id/cancel" ? { id: "inventory.transfer.cancel", title: "Hủy phiếu điều chuyển kho" } : {}),
    ...(studentList ? { id: "student.list", title: "Tra cứu học viên", resultFields: ["fullName", "phone", "email", "registrationDate", "fee", "paidAmount", "status"] } : {}),
    ...(unassignedStudentList ? { id: "student.unassigned.list", title: "Tra cứu học viên chưa có chi nhánh", resultFields: ["fullName", "phone", "email", "registrationDate", "status"] } : {}),
    ...(batchList ? { id: "batch.list", title: "Tra cứu lớp học", resultFields: ["code", "name", "courseCode", "courseTitle", "location", "instructorName", "startDate", "endDate", "status"] } : {}),
    ...(courseList ? { id: "course.list", title: "Tra cứu khóa học", resultFields: ["title", "code", "category", "duration", "fee", "status"] } : {}),
    ...(partnerList ? { id: "partner.list", title: "Tra cứu đối tác", resultFields: ["name", "code", "phone", "email", "isActive"] } : {}),
    ...(financeAssetList ? { id: "finance.asset.list", title: "Tra cứu tài sản cố định", resultFields: ["assetCode", "barcode", "name", "group", "originalCost", "accumulatedDepreciation", "netBookValue", "status", "location", "custodianName"] } : {}),
    ...(financeAssetDepreciationList ? { id: "finance.asset.depreciations.list", title: "Tra cứu khấu hao tài sản theo kỳ", resultFields: ["assetCode", "assetName", "period", "amount", "accumulatedAfter", "netBookValueAfter", "status"] } : {}),
    ...(financeAssetDetail ? { id: "finance.asset.detail", title: "Xem tài sản cố định", resultFields: ["assetCode", "barcode", "name", "group", "originalCost", "salvageValue", "accumulatedDepreciation", "netBookValue", "status", "location", "custodianName", "supplierName", "department", "inServiceDate"] } : {}),
    ...(financeAssetSchedule ? { id: "finance.asset.schedule", title: "Xem lịch khấu hao tài sản", resultFields: ["period", "amount", "accumulatedAfter", "netBookValueAfter"] } : {}),
    ...(financeAssetInventoryList ? { id: "finance.asset.inventory.list", title: "Tra cứu phiên kiểm kê tài sản", resultFields: ["sessionCode", "name", "scope", "inventoryDate", "status"] } : {}),
    ...(op.method === "GET" && op.path === "/finance/asset-inventories/:id" ? { id: "finance.asset.inventory.detail", title: "Xem phiên kiểm kê tài sản", resultFields: ["sessionCode", "name", "scope", "inventoryDate", "status"] } : {}),
    ...(op.method === "GET" && op.path === "/finance/asset-inventories/:id/variance" ? { id: "finance.asset.inventory.variance", title: "Xem chênh lệch kiểm kê tài sản", resultFields: ["total", "counts", "variances"] } : {}),
    ...(op.method === "POST" && op.path === "/finance/asset-inventories" ? { id: "finance.asset.inventory.open", title: "Mở phiên kiểm kê tài sản tại chi nhánh" } : {}),
    ...(op.method === "POST" && op.path === "/finance/asset-inventories/:id/counts" ? { id: "finance.asset.inventory.count", title: "Ghi nhận kết quả kiểm kê tài sản" } : {}),
    ...(op.method === "POST" && op.path === "/finance/asset-inventories/:id/finalize" ? { id: "finance.asset.inventory.finalize", title: "Chốt phiên kiểm kê tài sản", resultFields: ["session", "variance"] } : {}),
    ...(op.method === "GET" && op.path === "/inventory/receiving/receipts" ? { resultFields: ["receiptCode", "status", "supplierName", "subtotal", "notes"] } : {}),
    ...(retailPartnerList ? { id: "retail.partner.list", title: "Tra cứu đối tác bán lẻ", adapter: undefined, resultFields: ["code", "name", "role", "phone", "email", "address", "status"] } : {}),
    ...(retailInvoiceList ? { id: "retail.invoice.list", title: "Tra cứu hóa đơn bán lẻ", description: "Tìm hóa đơn đã phát hành theo số hóa đơn, mã đơn hoặc tên khách hàng trong chi nhánh được cấp quyền.", permissionGroups: [["retail:read", "retail:manage"]], resultFields: ["invoiceNo", "orderCode", "customerName", "status"] } : {}),
    ...(retailPartnerSupplierList ? { id: "retail.partner.supplier.list", title: "Tra cứu nhà cung cấp liên kết", resultFields: ["code", "name"] } : {}),
    ...(retailPartnerUserList ? { id: "retail.partner.user.list", title: "Tra cứu tài khoản cộng tác viên", resultFields: ["displayName", "email"] } : {}),
    ...(retailPartnerCustomerList ? { id: "retail.partner.customer.list", title: "Tra cứu khách hàng đại lý", resultFields: ["customerCode", "name", "phone"] } : {}),
    ...(op.method === "POST" && op.path === "/retail/partners" ? { id: "retail.partner.create", title: "Tạo đối tác bán lẻ" } : {}),
    ...(op.method === "PATCH" && op.path === "/retail/partners/:id" ? { id: "retail.partner.update", title: "Cập nhật đối tác bán lẻ" } : {}),
    ...(retailPointsPolicyList ? { id: "retail.points.policy.get", title: "Tra cứu chính sách tích điểm bán lẻ", resultFields: ["enabled", "earnVndPerPoint", "redeemVndPerPoint", "maxRedeemPercent", "version"] } : {}),
    ...(op.method === "PUT" && op.path === "/retail/points/policy" ? { id: "retail.points.policy.update", title: "Cập nhật chính sách tích điểm bán lẻ", resultFields: ["enabled", "earnVndPerPoint", "redeemVndPerPoint", "maxRedeemPercent", "version"] } : {}),
    ...(retailPartnerPolicyList ? { id: "retail.partner.commission.policy.list", title: "Tra cứu cấu hình hoa hồng bán lẻ", resultFields: ["effectiveAt", "config", "partnerId"] } : {}),
    ...(retailProductCommissionProducts ? { id: "retail.partner.product.commission.products", title: "Tra cứu sản phẩm và SKU để cấu hình hoa hồng", resultFields: ["sku", "name", "variantName"] } : {}),
    ...(retailProductCommissionUpdate ? { id: "retail.partner.product.commissions.update", title: "Cấu hình hoa hồng theo sản phẩm", resultFields: ["updated"] } : {}),
    ...(retailShiftList ? { id: "retail.shift.list", title: "Tra cứu ca thu ngân POS", description: "Tìm ca theo mã phiên, nhân viên, ngày hoặc trạng thái trong chi nhánh hiện tại.", resultFields: ["shiftCode", "cashierName", "status", "businessDate", "openedAt", "closedAt", "openingFloat", "grossSales", "expectedCash", "countedCash", "varianceAmount"] } : {}),
    ...(retailShiftCurrent ? { id: "retail.shift.current", title: "Xem ca POS hiện tại", contextQuery: ["terminalId"], resultFields: ["shiftCode", "cashierName", "status", "businessDate", "openedAt", "openingFloat", "grossSales", "expectedCash"] } : {}),
    ...(retailOrderProducts ? { id: "retail.order.products.list", title: "Tra cứu sản phẩm bán lẻ", resultFields: ["name", "sku", "barcode", "variantName", "category", "unit", "stock", "price", "trackingMode"] } : {}),
    ...(retailOrderList ? { id: "retail.order.list", title: "Tra cứu đơn bán lẻ" } : {}),
    ...(retailOrderDetail ? { id: "retail.order.detail", title: "Xem chi tiết đơn bán lẻ" } : {}),
    ...(retailOrderQuote ? { id: "retail.order.quote", title: "Tính thử đơn bán lẻ" } : {}),
    ...(retailOrderCheckout ? { id: "retail.order.checkout", title: "Tạo và thanh toán đơn bán lẻ", contextBody: ["idempotencyKey"] } : {}),
    ...(retailOrderDraftCreate ? { id: "retail.order.draft.create", title: "Tạo đơn nháp bán lẻ", contextBody: ["idempotencyKey"] } : {}),
    ...(retailOrderDraftUpdate ? { id: "retail.order.draft.update", title: "Cập nhật đơn nháp bán lẻ", contextBody: ["idempotencyKey"] } : {}),
    ...(retailOrderConfirm ? { id: "retail.order.confirm", title: "Xác nhận đơn nháp bán lẻ", contextBody: ["idempotencyKey"] } : {}),
    ...(retailOrderCollect ? { id: "retail.order.collect", title: "Thu thêm tiền đơn bán lẻ", contextBody: ["idempotencyKey"] } : {}),
    ...(retailOrderCancel ? { id: "retail.order.cancel", title: "Hủy đơn bán lẻ", contextBody: ["idempotencyKey"] } : {}),
    ...(retailCashierList ? { id: "retail.shift.cashier.list", title: "Tra cứu nhân viên thu ngân", resultFields: ["id", "name"] } : {}),
    ...(retailDrawerList ? { id: "retail.shift.drawer.list", title: "Tra cứu quầy và két POS", resultFields: ["code", "name", "isActive"] } : {}),
    ...(retailSettlementList ? { id: "retail.shift.settlements.list", title: "Tra cứu khoản thu POS chưa đối soát", resultFields: ["orderCode", "paymentIndex", "paymentMethod", "paymentAmount"] } : {}),
    ...(financeDebtList ? { id: "finance.debt.list", title: "Tra cứu công nợ", resultFields: ["source", "direction", "partyKind", "partyName", "reference", "amount", "balance", "dueOn", "daysOverdue", "daysUntilDue", "bucket", "alert", "version"] } : {}),
    ...(financeManagementDebtList ? { id: "finance.management.debts.list", title: "Tra cứu khoản phải thu, phải trả và phiếu nhập chưa ghi công nợ", description: "Tra cứu trong chi nhánh đã chọn; chỉ dùng các thông tin cần thiết để chọn chứng từ hoặc khoản công nợ.", resultFields: ["targetType", "code", "name", "amount", "balance", "dueDate", "status"] } : {}),
    ...(financeReceivableList ? { id: "finance.receivable.list", title: "Tra cứu khoản phải thu", resultFields: ["receivableCode", "customerName", "sourceCode", "sourceType", "occurredAt", "dueDate", "originalAmount", "paidAmount", "adjustedAmount", "balance", "status", "daysOverdue", "reminderCount"] } : {}),
    ...(financeReceivableDetail ? { id: "finance.receivable.detail", title: "Xem khoản phải thu và các bút toán có thể đảo", resultFields: ["receivableCode", "customerName", "balance", "status"] } : {}),
    ...(financeReceivableEntryReversal ? { id: "finance.receivable.entry.reversal", title: "Đảo khoản thu hoặc điều chỉnh phải thu", contextBody: ["idempotencyKey"], confirmation: true, resultFields: ["receivableCode", "customerName", "balance", "status", "type", "amount", "reason"] } : {}),
    ...(financeReceivableSuspend ? { id: "finance.receivable.suspend", title: "Tạm dừng nhắc khoản phải thu" } : {}),
    ...(financeReceivableExtend ? { id: "finance.receivable.extend", title: "Gia hạn khoản phải thu" } : {}),
    ...(financeReceivableAging ? { id: "finance.receivable.aging", title: "Tổng hợp tuổi nợ phải thu", resultFields: ["0-30", "31-60", "61-90", "over90"] } : {}),
    ...(financeReceivableByCustomer ? { id: "finance.receivable.by-customer", title: "Tổng hợp khoản phải thu theo khách hàng", resultFields: ["customerName", "balance", "originalAmount", "count"] } : {}),
    ...(financeVatList ? { id: "finance.vat.list", title: "Tra cứu hóa đơn VAT", resultFields: ["invoiceNumber", "series", "direction", "partyName", "taxId", "issuedOn", "taxableAmount", "vatAmount", "deductibleVat"] } : {}),
    ...(inventoryCatalogTitles[`${op.method} ${op.path}`] ? { title: inventoryCatalogTitles[`${op.method} ${op.path}`] } : {}),
    ...(inventoryCountTitles[`${op.method} ${op.path}`] ? { title: inventoryCountTitles[`${op.method} ${op.path}`] } : {}),
    ...(markInstallmentPaid ? { title: "Đánh dấu đợt học phí đã thu", description: "Đánh dấu một đợt học phí đã thu cho học viên đã xác định. Thao tác cần xác nhận." } : {}),
    ...(partnerCreate ? { title: "Tạo đối tác" } : {}),
    ...(partnerBulkCreate ? {
      id: "partner.bulk.create",
      title: "Tạo nhiều đối tác",
      description: "Tạo từ 1 đến 100 đối tác trong một lượt. Mỗi đối tác cần tên và số điện thoại. Dòng trùng số điện thoại sẽ bị bỏ qua; hoa hồng mặc định là 0 VND. Cần xác nhận danh sách trước khi lưu.",
      confirmation: true,
      resultFields: ["importedCount", "skippedCount", "errors"],
    } : {}),
    ...(commissionLevel ? {
      title: commissionLevelTitles[op.method],
      description: op.method === "GET"
        ? "Tra cứu các cấp bậc hoa hồng đã cấu hình theo doanh số tối thiểu và tỷ lệ hoa hồng. Quản trị viên có thể chọn chi nhánh theo tên; bỏ trống để xem các chi nhánh trong công ty."
        : op.method === "POST"
          ? "Tạo cấp bậc cấu hình hoa hồng tại chi nhánh đã chọn theo tên, với doanh số tối thiểu và tỷ lệ từ 0 đến 100%. Quản trị viên cần chọn chi nhánh; thao tác cần xác nhận."
          : op.method === "PATCH"
            ? "Cập nhật cấp bậc hoa hồng tại chi nhánh đã chọn theo tên hoặc mã. Cần cung cấp tên, doanh số tối thiểu và tỷ lệ từ 0 đến 100%. Quản trị viên cần chọn chi nhánh; thao tác cần xác nhận."
            : "Xóa cấp bậc hoa hồng tại chi nhánh đã chọn theo tên hoặc mã. Quản trị viên cần chọn chi nhánh; thao tác cần xác nhận.",
      permissions: op.method === "GET" ? ["relationship:read"] : ["relationship:manage"],
      permissionGroups: op.method === "GET" ? [["relationship:read"]] : [["relationship:manage"]],
    } : {}),
    ...(op.method === "PATCH" && op.path === "/partners/:id" ? { title: "Cập nhật thông tin và cấu hình hoa hồng đối tác", description: "Cập nhật thông tin đối tác đã có, gồm liên hệ, tài khoản chuyển khoản và cấu hình hoa hồng theo phần trăm hoặc số tiền cố định. Xác định đối tác bằng tên hoặc mã." } : {}),
    ...(customerBillingProfileList ? { id: "customer.billing.profile.list", title: "Tra cứu hồ sơ xuất hóa đơn khách hàng", description: "Xem hồ sơ xuất hóa đơn của khách hàng đã chọn theo tên hoặc số điện thoại.", permissions: ["customer:read", "pos:manage", "repair:manage"], permissionGroups: [["customer:read", "pos:manage", "repair:manage"]], resultFields: ["legalName", "taxId", "address", "invoiceEmail", "contactName", "isDefault", "status"] } : {}),
    ...(customerBillingProfileCreate ? { id: "customer.billing.profile.create", title: "Tạo hồ sơ xuất hóa đơn khách hàng", description: "Tạo hồ sơ xuất hóa đơn cho khách hàng đã chọn. Cần tên pháp nhân, mã số thuế hợp lệ, địa chỉ và email nhận hóa đơn; cần xác nhận trước khi lưu.", permissions: ["customer:manage", "pos:manage"], permissionGroups: [["customer:manage", "pos:manage"]], confirmation: true, resultFields: ["legalName", "taxId", "address", "invoiceEmail", "contactName", "isDefault", "warnings"] } : {}),
    ...(assignStudentBranch ? { title: "Chuyển học viên chưa gán chi nhánh", description: "Gán học viên chưa thuộc chi nhánh vào chi nhánh đã chọn theo tên. Chỉ quản trị viên công ty được sử dụng; cần xác nhận trước khi ghi." } : {}),
    ...(miniTestCreate ? { title: "Tạo bài kiểm tra ngắn cho học viên", description: "Tạo bài kiểm tra ngắn cho học viên trong lớp đã chọn. Điểm phải không lớn hơn thang điểm; cần xác nhận trước khi lưu." } : {}),
    ...(inventorySerialList ? { id: "inventory.serial.list", title: "Tra cứu IMEI, serial và mã đơn vị" } : {}),
    ...(inventorySerialDetail ? { id: "inventory.serial.detail", title: "Xem chi tiết IMEI hoặc serial" } : {}),
    ...(inventorySerialHistory ? { id: "inventory.serial.history", title: "Xem lịch sử IMEI hoặc serial" } : {}),
    ...(inventorySerialCreate ? { id: "inventory.serial.create", title: "Đăng ký IMEI hoặc serial vào tồn kho" } : {}),
    ...(inventorySerialTransition ? { id: "inventory.serial.transition", title: "Cập nhật trạng thái IMEI hoặc serial" } : {}),
    ...(commissionLevelList ? { id: "partner.commission.levels.list", resultFields: ["name", "minTuition", "commissionRate"] } : {}),
    ...(workerPartnerList ? { id: "worker.partner.list", title: "Tra cứu đối tác cung ứng lao động" } : {}),
    ...(workerList ? { id: "worker.list", title: "Tra cứu người lao động" } : {}),
    ...(chatRoomsList ? { id: "chat.rooms.list", title: "Tra cứu phòng trò chuyện", resultFields: ["name", "isGroup", "updatedAt"] } : {}),
    ...(chatRoomMembersList ? { id: "chat.room.members.list", title: "Tra cứu thành viên trong phòng chat", resultFields: ["displayName", "roleLabel"] } : {}),
    ...(chatRoomMemberRemove ? { id: "chat.room.member.remove", title: "Xóa thành viên khỏi phòng chat", description: "Xóa thành viên đã chọn khỏi phòng nhóm. Phòng và người cần xóa được chọn theo tên; chỉ Trưởng nhóm mới nhận được danh sách thành viên. Cần xác nhận trước khi xóa.", resultFields: ["roomName", "removed"] } : {}),
    ...(chatMessagesList ? { id: "chat.room.messages.list", title: "Tra cứu tin nhắn trong phòng", resultFields: ["senderName", "content", "createdAt", "editedAt", "isDeleted"] } : {}),
    ...(workerLaborContractList ? { id: "worker.labor.contract.list", title: "Tra cứu hợp đồng lao động", adapter: undefined } : {}),
    ...(workerPartnerPolicyList ? { id: "worker.partner.policy.list", title: "Tra cứu chính sách hoa hồng đối tác lao động" } : {}),
    ...(learningRoadmapWaitlist ? { id: "student.learning-roadmap.waitlist.list", title: "Tra cứu học viên trong danh sách chờ lộ trình", resultFields: ["studentName", "roadmapName", "sourceBatchCode", "learningFormat", "preferredTimeSlot", "waitingDays"] } : {}),
    ...(op.method === "GET" && op.path === "/worker-management/partners/policies/:policyId" ? { id: "worker.partner.policy.detail" } : {}),
    fields: (() => {
      const mapped = fields.filter(field => !(field.apiKey === "centerId" && (op.path === "/partners" || op.path.startsWith("/partners/commission-levels"))));
      if (assignmentList || (op.method === "GET" && op.path === "/assignments/:id/submissions")) {
        return [queryField(ref("query_batchId", "Tên hoặc mã lớp", "batch.list"), "batchId"), ...mapped.filter(field => field.apiKey !== "batchId")];
      }
      if (!inventorySerialOperation && !inventoryCount && !financeReceivableOperation && !financeDebtList && !commissionLevel && !retailSettingsOperation && !retailPosOperation && !retailCashbookOperation && !retailFinanceCommissionOperation && !retailReceivableOperation && !retailAfterSaleOperation) return mapped;
      const label = inventorySerialOperation ? "Chi nhánh" : inventoryCount ? "Chi nhánh kiểm kê" : financeReceivableOperation ? "Chi nhánh hạch toán" : retailSettingsOperation || retailPosOperation || retailCashbookOperation || retailFinanceCommissionOperation || retailReceivableOperation || retailAfterSaleOperation ? "Chi nhánh bán lẻ" : "Chi nhánh áp dụng";
      return [queryField(ref("targetBranch", label, "branch.list", false), "branchId"), ...mapped.filter(field => field.apiKey !== "branchId")];
    })(),
    resultFields: inventoryResource ? (op.method === "DELETE" ? ["deletedId"] : ["code", "name", "status", "parentCode", "description", "website", "symbol", "category", "decimalPlaces", "baseUnitCode", "conversionFactor", "type", "options", "unitCode"])
      : inventoryVariantBulkUpdate ? ["sku", "displayName", "status", "trackingMode", "unitCode"]
      : inventoryVariantBulkDelete ? []
      : workerLaborContractList ? ["code", "clientName", "workerName", "startDate", "endDate", "status", "alertLevel", "note"]
      : inventoryProductList ? ["name", "productCode", "categoryCode", "productType", "status"]
      : inventoryProductDetail ? ["name", "productCode", "categoryCode", "productType", "status", "sku", "displayName", "unitCode", "trackingMode", "productId", "productName"]
      : inventoryTemplateList ? ["code", "name", "productType", "status"]
      : inventoryPriceList ? ["variantId", "sku", "sellingPrice", "costPrice", "status"]
      : inventorySupplierList ? ["name", "code", "phone", "email", "status"]
      : courseCategoryList ? ["name"]
      : inventorySerialList || inventorySerialDetail || inventorySerialTransition ? ["serialNumber", "internalBarcode", "sku", "productName", "status", "soldOrderCode", "soldAt", "createdAt"]
      : inventorySerialHistory ? ["serialNumber", "eventType", "fromStatus", "toStatus", "reason", "occurredAt", "actorName"]
      : inventoryTransferList || inventoryTransferDetail || inventoryTransferCreate || op.path === "/inventory/transfers/:id/accept" || op.path === "/inventory/transfers/:id/cancel" ? ["code", "status", "reason", "fromWarehouseName", "toWarehouseName", "items"]
      : chatRoomMemberRemove ? ["roomName", "removed"]
      : chatRoomsList ? ["name", "isGroup", "updatedAt"]
      : chatRoomMembersList ? ["displayName", "roleLabel"]
      : chatMessagesList ? ["senderName", "content", "createdAt", "editedAt", "isDeleted"]
      : learningRoadmapWaitlist ? ["studentName", "roadmapName", "sourceBatchCode", "learningFormat", "preferredTimeSlot", "waitingDays"]
      : assignmentList ? ["title", "description", "dueDate", "maxScore", "createdAt"]
      : courseList ? ["title", "code", "category", "duration", "fee", "status"]
      : partnerList ? ["name", "code", "phone", "email", "isActive"]
      : retailInvoiceList ? ["invoiceNo", "orderCode", "customerName", "status"]
      : retailPartnerList ? ["code", "name", "role", "phone", "email", "address", "status"]
      : retailPartnerSupplierList ? ["code", "name"]
      : retailPartnerUserList ? ["displayName", "email"]
      : retailPartnerCustomerList ? ["customerCode", "name", "phone"]
      : retailPointsPolicyList ? ["enabled", "earnVndPerPoint", "redeemVndPerPoint", "maxRedeemPercent", "version"]
      : retailPartnerPolicyList ? ["effectiveAt", "config", "partnerId"]
      : retailProductCommissionProducts ? ["sku", "name", "variantName"]
      : retailProductCommissionUpdate ? ["updated"]
      : retailShiftList ? ["shiftCode", "cashierName", "status", "businessDate", "openedAt", "closedAt", "openingFloat", "grossSales", "expectedCash", "countedCash", "varianceAmount"]
      : retailCashierList ? ["id", "name"]
      : retailDrawerList ? ["code", "name", "isActive"]
      : retailSettlementList ? ["orderCode", "paymentIndex", "paymentMethod", "paymentAmount"]
      : retailOrderProducts ? ["name", "sku", "barcode", "variantName", "category", "unit", "stock", "price", "trackingMode"]
      : retailOrderDraftCreate || retailOrderDraftUpdate ? ["orderCode", "status", "customerName", "grandTotal", "dueAmount", "version", "items"]
      : retailOrderConfirm ? ["orderCode", "status", "paymentStatus", "grandTotal", "paidAmount", "dueAmount", "version"]
      : retailOrderList ? ["orderCode", "customerName", "customerPhone", "status", "paymentStatus", "grandTotal", "paidAmount", "refundedAmount", "dueAmount", "version", "businessDate", "createdAt"]
      : retailOrderDetail ? ["orderCode", "customerName", "customerPhone", "status", "paymentStatus", "grandTotal", "paidAmount", "refundedAmount", "dueAmount", "version", "businessDate", "createdAt", "items", "payments"]
      : financeDebtList ? ["source", "direction", "partyKind", "partyName", "reference", "amount", "balance", "dueOn", "daysOverdue", "daysUntilDue", "bucket", "alert", "version"]
      : financeManagementDebtList ? ["targetType", "code", "name", "amount", "balance", "dueDate", "status"]
      : financeReceivableList ? ["receivableCode", "customerName", "sourceCode", "sourceType", "occurredAt", "dueDate", "originalAmount", "paidAmount", "adjustedAmount", "balance", "status", "daysOverdue", "reminderCount"]
      : financeReceivableDetail ? ["receivableCode", "customerName", "balance", "status"]
      : financeReceivableEntryReversal ? ["receivableCode", "customerName", "balance", "status", "type", "amount", "reason"]
      : financeReceivableSuspend ? ["receivableCode", "status", "reminderSuspendedUntil", "reminderSuspendReason"]
      : financeReceivableExtend ? ["receivableCode", "previousDueDate", "newDueDate", "dueDate", "balance", "status"]
      : financeReceivableAging ? ["0-30", "31-60", "61-90", "over90"]
      : financeReceivableByCustomer ? ["customerName", "balance", "originalAmount", "count"]
      : financeVatList ? ["invoiceNumber", "series", "direction", "partyName", "taxId", "issuedOn", "taxableAmount", "vatAmount", "deductibleVat"]
      : op.method === "GET" && op.path === "/inventory/receiving/receipts" ? ["receiptCode", "status", "supplierName", "subtotal", "notes"]
      : op.method === "GET" && op.path === "/worker-management/workers"
      ? ["fullName", "status", "laborType", "registrationDate"]
      : financeAssetList ? ["assetCode", "barcode", "name", "group", "originalCost", "accumulatedDepreciation", "netBookValue", "status", "location", "custodianName"]
      : financeAssetDepreciationList ? ["assetCode", "assetName", "period", "amount", "accumulatedAfter", "netBookValueAfter", "status"]
      : financeAssetDetail ? ["assetCode", "barcode", "name", "group", "originalCost", "salvageValue", "accumulatedDepreciation", "netBookValue", "status", "location", "custodianName", "supplierName", "department", "inServiceDate"]
      : financeAssetSchedule ? ["period", "amount", "accumulatedAfter", "netBookValueAfter"]
      : financeAssetInventoryList ? ["sessionCode", "name", "scope", "inventoryDate", "status"]
      : op.method === "GET" && op.path === "/finance/asset-inventories/:id" ? ["sessionCode", "name", "scope", "inventoryDate", "status"]
      : op.method === "GET" && op.path === "/finance/asset-inventories/:id/variance" ? ["total", "counts", "variances"]
      : op.method === "POST" && op.path === "/finance/asset-inventories/:id/finalize" ? ["session", "variance"]
      : unassignedStudentList ? ["fullName", "phone", "email", "registrationDate", "status"]
      : batchList ? ["code", "name", "courseCode", "courseTitle", "location", "instructorName", "startDate", "endDate", "status"]
      : studentList ? ["fullName", "phone", "email", "registrationDate", "fee", "paidAmount", "status"]
        : markInstallmentPaid ? ["message"]
          : warehouseLocations ? ["name", "code", "kind", "isActive"]
      : op.path === "/inventory/counts/:id/items/:itemId" ? ["countCode", "status", "updatedItem"]
      : inventoryCount && (op.path === "/inventory/counts" || op.path === "/inventory/counts/:id") ? ["countCode", "status", "notes", "createdAt"]
              : inventoryCount && op.path.endsWith("/scan") ? ["outcome", "sku", "productName"]
                : inventoryCount ? ["countCode", "status"]
                  : balanceThresholds ? ["sku", "minStock", "maxStock"]
        : partnerList
        ? ["name", "code", "phone", "email", "isActive"]
      : commissionLevelList ? ["name", "minTuition", "commissionRate"]
        : commissionLevel ? ["name", "minTuition", "commissionRate"]
          : partnerCreate || partnerDetail ? partnerResultFields : op.resultFields,
  };
}));
operations.push({
  id: "inventory.stock-log.list",
  title: "Tra cứu phiếu nhập xuất kho",
  description: "Tìm phiếu kho theo tiêu đề hoặc SKU trong phạm vi chi nhánh được cấp quyền.",
  module: "inventory",
  permissions: ["inventory:read"],
  permissionGroups: [["inventory:read"]],
  method: "GET",
  path: "/crud/stock-logs",
  fields: [
    { key: "search", label: "Tiêu đề phiếu hoặc SKU", type: "text", source: "query", apiKey: "search" },
    { key: "page", label: "Trang", type: "number", source: "query", apiKey: "page", defaultValue: 1, min: 1 },
    { key: "limit", label: "Số kết quả", type: "number", source: "query", apiKey: "limit", defaultValue: 100, min: 1, max: 100 },
    { key: "targetBranch", label: "Chi nhánh kho", type: "reference", source: "query", apiKey: "branchId", reference: "branch.list", required: false, systemRequired: false },
  ],
  link: "/kho-san-pham",
  confirmation: false,
  resultFields: ["title", "type", "status", "purpose", "productName", "sku", "quantity", "createdAt"],
});
const partnerUpdateOperation = operations.find(op => op.method === "PATCH" && op.path === "/partners/:id");
const partnerDetailOperation = operations.find(op => op.method === "GET" && op.path === "/partners/:id");
const payrollRunLineDetailOperation = operations.find(op => op.id === "payroll.run.line.detail");
if (payrollRunLineDetailOperation) {
  payrollRunLineDetailOperation.fields = payrollRunLineDetailOperation.fields.filter(field => !(field.source === "query" && field.apiKey === "branchId"));
  payrollRunLineDetailOperation.fields.push({
    key: "targetBranch",
    label: "Chi nhánh bảng lương",
    type: "reference",
    source: "query",
    apiKey: "branchId",
    reference: "branch.list",
    required: false,
    systemRequired: false,
  });
}
if (partnerDetailOperation) {
  partnerDetailOperation.title = "Xem thông tin đối tác";
  partnerDetailOperation.description = "Tra cứu hồ sơ đối tác theo tên hoặc số điện thoại, gồm thông tin liên hệ, tài khoản chuyển khoản và cấu hình hoa hồng.";
}
if (partnerUpdateOperation) {
  const pathId = partnerUpdateOperation.fields.find(field => field.source === "path" && field.apiKey === "id");
  const commissionType = partnerUpdateOperation.fields.find(field => field.source === "body" && field.apiKey === "commissionType");
  const commissionValue = partnerUpdateOperation.fields.find(field => field.source === "body" && field.apiKey === "commissionValue");
  const bankFields = ["bankName", "bankAccountNo", "bankAccountName"].map(apiKey => partnerUpdateOperation.fields.find(field => field.source === "body" && field.apiKey === apiKey));
  if (pathId && bankFields.every(Boolean)) operations.push({
    ...partnerUpdateOperation,
    id: "partner.bank-details.update",
    title: "Cập nhật thông tin chuyển khoản đối tác",
    description: "Cập nhật ngân hàng, số tài khoản và tên chủ tài khoản cho một đối tác giới thiệu đã chọn theo tên hoặc số điện thoại. Cần đủ ba thông tin và xác nhận trước khi lưu.",
    fields: [
      { ...pathId, label: "Tên hoặc số điện thoại đối tác", reference: "partner.list" },
      { ...bankFields[0]!, label: "Tên ngân hàng", systemRequired: true, required: true },
      { ...bankFields[1]!, label: "Số tài khoản ngân hàng", systemRequired: true, required: true },
      { ...bankFields[2]!, label: "Tên chủ tài khoản", systemRequired: true, required: true },
    ],
  });
  if (pathId && commissionType && commissionValue) operations.push({
    ...partnerUpdateOperation,
    id: "partner.commission.update",
    title: "Cấu hình hoa hồng cho đối tác",
    description: "Cập nhật mức hoa hồng cho một đối tác giới thiệu đã chọn theo tên hoặc số điện thoại. Chọn tính theo phần trăm (%) hoặc số tiền cố định (VND), rồi nhập mức tương ứng. Thao tác cần xác nhận.",
    fields: [
      { ...pathId, label: "Tên hoặc số điện thoại đối tác", reference: "partner.list" },
      { ...commissionType, label: "Cách tính hoa hồng: phần trăm (%) hoặc số tiền cố định (VND)", options: ["percentage", "fixed"], systemRequired: true, required: true },
      { ...commissionValue, label: "Mức hoa hồng (% hoặc VND theo cách tính đã chọn)", min: 0, systemRequired: true, required: true },
    ],
  });
  partnerUpdateOperation.title = "Cập nhật thông tin liên hệ đối tác";
  partnerUpdateOperation.description = "Cập nhật tên, điện thoại, email, trạng thái, ghi chú hoặc trường bổ sung của đối tác theo tên hoặc số điện thoại. Thông tin chuyển khoản và cấu hình hoa hồng có workflow riêng.";
  partnerUpdateOperation.fields = partnerUpdateOperation.fields.filter(field =>
    !["bankName", "bankAccountNo", "bankAccountName", "commissionType", "commissionValue"].includes(String(field.apiKey || "")),
  );
}
export const ASSISTANT_OPERATIONS: readonly AssistantOperation[] = operations;
export function operationById(id: string) { return ASSISTANT_OPERATIONS.find(op => op.id === id); }
export function defaultWorkflow(op: AssistantOperation): AssistantWorkflow {
  return { actionId: op.id, title: op.title, module: op.module, description: op.description,
    fields: structuredClone(op.fields).map(field => field.reference ? { ...field, defaultValue: undefined } : field), enabled: true, instructions: "", requireConfirmation: Boolean(op.confirmation), confirmationLocked: Boolean(op.confirmation), version: 0 };
}
