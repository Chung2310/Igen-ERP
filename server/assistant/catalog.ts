import type { AssistantField, AssistantWorkflow } from "../../src/shared/assistant-workflow";
import expandedCatalog from "./expanded-catalog.generated.json";
import type { ModuleKey } from "../config/module-keys";
import { TRAINING_CATEGORY_VALUES } from "../../src/shared/training-categories";
import { HEALTHCARE_OPERATIONS, healthcareWorkflowInstructions } from "./healthcare-catalog";
import { QUOTATION_OPERATIONS, quotationWorkflowInstructions } from "./quotation-catalog";
import type { AnalysisContract } from "./list-analysis";
import { buildAssistantOperationMetadata, type AssistantOperationMetadata } from "./operation-metadata";
import { publicReadAnalysis } from './public-read-query';
import {normalizeAssistantFieldContract} from './field-contract';
import {registerAssistantBusinessReadViews} from './business-read-views';

export interface AssistantOperation {
  /** Reviewed measures already computed by a summary API, including nested paths. */
  precomputedMeasures?:Record<string,{operation:'count'|'sum'|'avg';label:string;category?:string}>;
  /** A report breakdown made of independently computed public measures. */
  precomputedBreakdowns?:string[][];
  /** Reviewed grouped report rows, not an invitation to aggregate the envelope. */
  precomputedGroups?:Record<string,{dimension:string;measures:Record<string,'count'|'sum'|'avg'>}>;
  unboundedTimeRead?:true;
  /** Truthful, server-owned phrasings of behavior already enforced by the operation. */
  coverageAliases?: string[];
  clearableFields?: string[];
  currentDateDefaults?: string[];
  /** Additional business function views for a cross-cutting read capability. */
  functionAreas?: Array<{ key: string; label: string }>;
  assistantMetadata?: AssistantOperationMetadata;
  unavailableReason?: string;
  analysis?: AnalysisContract;
  /** Reviewed semantics of native numeric query bounds, independent of wording. */
  queryPredicates?: Record<string,{operator:'gte'|'lte';integer?:boolean}>;
  partialUpdate?: boolean;
  partialUpdateArrayKeys?: Record<string, string>;
  partialUpdateArrayBounds?: Record<string, { itemField: string; upperBound: string }>;
  inputArrayLengths?: Record<string,string>;
  id: string; title: string; description: string; module: ModuleKey;
  modules?: ModuleKey[];
  permissions: string[]; method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  adapter?: "contract" | "healthcare" | "quotation";
  rawResponse?: boolean;
  resultSingleton?: boolean;
  /** Fixed predicates enforced by a reviewed command's server implementation. */
  builtinConditions?:string[];
  builtinConditionLogic?:'union';
  /** Reference inputs whose equality is enforced as a native write predicate. */
  predicateInputFields?:string[];
  readOnly?: boolean;
  completionUpdateId?: string;
  contextBody?: string[];
  contextHeaders?: string[];
  contextQuery?: string[];
  assistantOnlyFields?: string[];
  fixedPathValues?: Record<string, string>;
  fixedBodyValues?: Record<string, unknown>;
  /** Server-owned source predicates for reviewed read views; never model inputs. */
  fixedQueryValues?:Record<string,string>;
  /** Scoped read performed through dispatch after required form data and before
   * confirmation. Its opaque token stays only in server pending state. */
  confirmationRead?:{actionId:string;inputFields:string[];contentFields:string[];tokenField:string;details:Array<{key:string;label:string}>};
  /** Explicit command endpoints whose mutation is fully specified by the route. */
  allowEmptyUpdate?: boolean;
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
  /** Explicit collection inside an envelope which also contains totals/meta. */
  resultRowsField?:string;
  resultRowsTotalField?:string;
  resultRowsComplete?:true;
  // Field allow-lists for nested objects shown in a result field. Nested API documents
  // must be projected before display so unrelated personal or internal fields stay hidden.
  resultChildFields?: Record<string, AssistantResultFieldTree>;
}
export interface AssistantResultFieldChildren { [key: string]: AssistantResultFieldTree }
export type AssistantResultFieldTree = string[] | AssistantResultFieldChildren;
const text = (key: string, label: string, required = false): AssistantField => ({ key, label, type: "text", systemRequired: required, required });
const date = (key: string, label: string, required = false): AssistantField => ({ ...text(key, label, required), type: "date" });
const number = (key: string, label: string, defaultValue?: number): AssistantField => ({ key, label, type: "number", min: 0, ...(defaultValue === undefined ? {} : { defaultValue }) });
const structured = (key: string, label: string, structure: NonNullable<AssistantField["structure"]>, required = false): AssistantField => ({ key, label, type: "json", structure, required });
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
entity({ id: "employee", title: "nhân sự", module: "hr", permissions: ["access:manage"], readPermissions: ["access:read", "hr:read"], path: "/auth/users", createPath: "/auth/register-user", link: "/nhan-su", update: true, remove: true,
  fields: [text("displayName", "Họ và tên", true), { ...date("birthDate", "Ngày sinh"), required: true }, { ...email, systemRequired: true, required: true }, phone, { ...ref("department", "Phòng ban", "department.list", false), referenceValueKey: "name" }, text("division", "Bộ phận"), text("jobTitle", "Chức danh"), number("monthlySalary", "Lương tháng", 0), text("qualification", "Trình độ chuyên môn")],
  resultFields: ["displayName", "email", "birthDate", "phone", "department", "division", "monthlySalary", "qualification"],
});
const employeeList = operations.find(op => op.id === "employee.list");
if (employeeList) {
  employeeList.resultFields = ["displayName", "email", "birthDate", "phone", "department", "division", "qualification"];
  employeeList.fields = [
    queryField({ ...text("search", "Tên, email hoặc số điện thoại nhân sự"), max: 100 }),
    queryField(ref("targetBranch", "Chi nhánh nhân sự", "branch.list", false), "branchId"),
  ];
}
if (employeeList) operations.push({
  ...employeeList,
  id: "employee.birthday.next-month",
  title: "Báo cáo sinh nhật nhân sự tháng tới",
  description: "Liệt kê nhân sự có ngày sinh trong tháng dương lịch kế tiếp, theo phạm vi chi nhánh của tài khoản nếu có. Không hiển thị năm sinh.",
  fields: employeeList.fields.filter(field => field.apiKey === "branchId"),
  resultFields: ["birthdays", "total", "month"],
  resultChildFields: { birthdays: ["displayName", "birthday"] },
  readOnly: true,
});
if (employeeList) operations.push({
  ...employeeList,
  id: "employee.count",
  title: "Đếm số nhân sự trong công ty hoặc chi nhánh",
  description: "Đếm nhân sự công ty/chi nhánh. Hỏi nhân sự mới trong tháng/khoảng thời gian: lọc createdFrom và createdTo theo ngày tạo hồ sơ; không phải số ứng viên tuyển dụng. Chỉ trả tổng số hồ sơ trong phạm vi được cấp quyền.",
  path: "/auth/users/count",
  fields: [...employeeList.fields.filter(field => field.apiKey === "branchId"), { ...date("createdFrom", "Hồ sơ tạo từ ngày"), source: "query", apiKey: "createdFrom" }, { ...date("createdTo", "Hồ sơ tạo đến ngày"), source: "query", apiKey: "createdTo" }],
  resultFields: ["count", "branchName", "branchCode", "scope", "createdFrom", "createdTo"],
  readOnly: true,
});
const employeeDelete = operations.find(op => op.id === "employee.delete");
const employeeProfileUpdate = operations.find(op => op.id === "employee.update");
if (employeeProfileUpdate) employeeProfileUpdate.description = "Sửa hồ sơ nhân sự theo tên, xác nhận trước khi ghi. Bổ nhiệm/đổi chức danh dùng jobTitle; khi người dùng yêu cầu hủy chức vụ/chức danh, đặt jobTitle thành chuỗi rỗng (không phải null), giữ nguyên tài khoản. id luôn là tên người cần sửa.";
if (employeeProfileUpdate) employeeProfileUpdate.resultFields = [...new Set([...employeeProfileUpdate.resultFields, "jobTitle"])];
if (employeeDelete) {
  employeeDelete.title = "Xóa tài khoản nhân sự";
  employeeDelete.description = "Xóa tài khoản nhân sự đã chọn khỏi doanh nghiệp. Tài khoản quản trị viên không thể bị xóa; cấp dưới trực thuộc sẽ được chuyển lên cấp quản lý kế tiếp. Cần chọn đúng người và xác nhận trước khi xóa.";
  employeeDelete.resultFields = ["deleted"];
}
operations.push({
  id: "employee.detail",
  title: "Xem thông tin chi tiết nhân sự",
  description: "Tra cứu hồ sơ nhân sự theo tên, email hoặc số điện thoại trong phạm vi được phép. Chỉ hiển thị thông tin hồ sơ cơ bản; không hiển thị lương hoặc dữ liệu đăng nhập.",
  module: "hr",
  permissions: ["access:read", "hr:read"],
  permissionGroups: [["access:read", "hr:read"]],
  method: "GET",
  path: "/auth/users",
  link: "/nhan-su",
  fields: [queryField({ ...text("search", "Tên, email hoặc số điện thoại nhân sự cần xem", true), max: 100 })],
  resultFields: ["displayName", "email", "birthDate", "phone", "department", "division", "qualification"],
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
if (departmentList) operations.push({
  ...departmentList,
  id: "department.lookup",
  title: "Tra cứu thông tin phòng ban",
  description: "Tra cứu số nhân sự và trưởng phòng theo tên phòng ban trong phạm vi công ty hiện tại.",
  fields: [queryField({ ...text("query_department", "Tên phòng ban", true), max: 100 }, "search")],
  assistantOnlyFields: ["query_department"],
  resultFields: ["name", "managerName", "employeeCount"],
});
operations.push({
  id: "department.employees.list",
  title: "Danh sách nhân sự theo phòng ban",
  description: "Liệt kê nhân sự thuộc phòng ban được nêu trong phạm vi công ty và chi nhánh được cấp quyền.",
  module: "hr",
  permissions: ["access:read", "hr:read"],
  permissionGroups: [["access:read", "hr:read"]],
  method: "GET",
  path: "/auth/users",
  link: "/nhan-su?sub=phong-ban",
  adapter: "contract",
  fields: [
    queryField({ ...text("query_department", "Tên phòng ban", true), max: 100 }, "department"),
    queryField(ref("targetBranch", "Chi nhánh nhân sự", "branch.list", false), "branchId"),
  ],
  resultFields: ["displayName", "jobTitle", "department"],
  readOnly: true,
});
if (departmentList) operations.push({
  ...departmentList,
  id: "department.unmanaged.list",
  title: "Danh sách phòng ban chưa có quản lý",
  description: "Liệt kê tên các phòng ban chưa được gán người quản lý trong công ty hiện tại.",
  fields: [],
  resultFields: ["name"],
  readOnly: true,
});
const departmentUpdate = operations.find(op => op.id === "department.update");
if (departmentUpdate) departmentUpdate.description = "Cập nhật phòng ban theo tên; tên hiện tại được giữ nguyên nếu chỉ sửa mã, mô tả, trưởng phòng, thứ tự hoặc trạng thái. Trưởng phòng được chọn theo tên nhân sự cùng công ty.";
const departmentDelete = operations.find(op => op.id === "department.delete");
if (departmentDelete) {
  departmentDelete.description = "Xóa phòng ban đã chọn trong công ty. Các nhân viên đang gắn với phòng ban này sẽ được bỏ gán phòng ban; cần xác nhận trước khi xóa.";
  departmentDelete.resultFields = ["deleted"];
}
entity({ id: "project", title: "dự án", module: "hr", permissions: ["work:manage"], readPermissions: ["work:read"], path: "/kanban/projects", link: "/nhan-su?sub=kanban", update: true, remove: true,
  fields: [text("name", "Tên dự án", true), choice("priority", "Độ ưu tiên", ["low", "medium", "high"], "medium"), date("startAt", "Ngày bắt đầu"), date("dueAt", "Hạn hoàn thành")] });
const projectListOperation = operations.find(op => op.id === "project.list");
if (projectListOperation) {
  projectListOperation.description = "Tra cứu dự án theo tên, trạng thái, độ ưu tiên hoặc khoảng ngày bắt đầu và hạn hoàn thành trong phạm vi được cấp quyền.";
  projectListOperation.fields = [
    queryField({ ...text("search", "Tên dự án"), max: 100 }),
    queryField(choice("status", "Trạng thái", ["not_started", "in_progress", "paused", "completed", "cancelled"])),
    queryField(choice("priority", "Độ ưu tiên", ["low", "medium", "high", "urgent"])),
    queryField(date("startFrom", "Bắt đầu từ ngày")),
    queryField(date("startTo", "Bắt đầu đến ngày")),
    queryField(date("dueFrom", "Hạn hoàn thành từ ngày")),
    queryField(date("dueTo", "Hạn hoàn thành đến ngày")),
  ];
}
entity({ id: "task", title: "công việc", module: "hr", permissions: ["work:manage"], readPermissions: ["work:read"], path: "/kanban/tasks", link: "/nhan-su?sub=kanban", update: true, remove: true,
  fields: [text("title", "Tên công việc", true), ref("assigneeUid", "Người được giao", "employee.list"), date("dueDate", "Hạn hoàn thành", true), choice("priority", "Độ ưu tiên", ["High", "Medium", "Low"], "Medium"), choice("status", "Trạng thái", ["Not Started", "In Progress", "Review/Testing", "Done", "Archived"], "Not Started"), { ...text("category", "Danh mục công việc"), defaultValue: "Onboarding" }, { ...number("salesKpiTarget", "Chỉ tiêu doanh số (VND)"), min: 1, requiredWhen: { field: "category", equals: "Bán hàng" } }, ref("projectId", "Dự án", "project.list", false), { ...date("startTime", "Thời gian bắt đầu"), type: "datetime" }, number("estTime", "Số giờ dự tính"), number("actualTime", "Số giờ thực tế"), text("linkNote", "Ghi chú kết quả")],
  resultFields: ["title", "assignee", "dueDate", "priority", "status", "category", "salesKpiTarget", "startTime", "estTime", "progress"] });
entity({ id: "customer", title: "khách hàng", module: "customer", permissions: ["customer:manage"], readPermissions: ["customer:read"], path: "/customers", link: "/quan-ly-khach-hang",
  fields: [text("name", "Tên khách hàng", true), { ...phone, systemRequired: true, required: true }, email, choice("type", "Phân loại hồ sơ", ["regular", "vat"], "regular"), choice("customerKind", "Loại khách hàng", ["individual", "business"]), text("contactName", "Người liên hệ"), date("dateOfBirth", "Ngày sinh"), choice("gender", "Giới tính", ["male", "female", "other"]), choice("status", "Trạng thái", ["active", "inactive"], "active"), text("address", "Địa chỉ"), text("notes", "Ghi chú")], resultFields: ["customerCode", "name", "phone", "status"] });
const customerList = operations.find(op => op.id === "customer.list");
if (customerList) {
  customerList.title = "Danh sách khách hàng";
  customerList.description = "Xem và lọc danh sách khách hàng trong phạm vi được cấp quyền theo tên, mã, số điện thoại hoặc trạng thái.";
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
const branchListOperation = operations.find(op => op.id === "branch.list");
if (branchListOperation) branchListOperation.fields = [queryField({ ...text("search", "Tên hoặc mã chi nhánh"), max: 100 })];
entity({ id: "category", title: "danh mục kho", module: "inventory", permissions: ["inventory:manage"], readPermissions: ["inventory:read"], path: "/crud/categories", link: "/kho-san-pham", update: true, remove: true,
  fields: [text("name", "Tên danh mục", true), text("code", "Mã danh mục", true), description] });
const categoryListOperation = operations.find(op => op.id === "category.list");
if (categoryListOperation) categoryListOperation.fields = [queryField(text("search", "Tên hoặc mã danh mục"), "search")];
for (const categoryOperation of operations.filter(op => op.id.startsWith("category."))) {
  categoryOperation.description = `${categoryOperation.description} Danh mục áp dụng chung cho toàn doanh nghiệp, không cần chọn chi nhánh.`;
}
entity({ id: "training", title: "khóa đào tạo", module: "hr", permissions: ["hr:manage"], readPermissions: ["hr:read", "hr:manage"], path: "/crud/training-courses", link: "/nhan-su", update: true, remove: true,
  fields: [
    text("title", "Tên khóa học", true),
    description,
    { ...choice("category", "Danh mục đào tạo", TRAINING_CATEGORY_VALUES), systemRequired: true, required: true },
    text("duration", "Thời lượng", true),
    text("instructor", "Giảng viên"),
    structured("lessons", "Danh sách bài giảng (nếu chưa có, nói bỏ qua)", {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        open: false,
        keys: {
          title: { type: "string", required: true, label: "Tên bài giảng" },
          type: { type: "string", required: true, options: ["youtube", "document", "other", "text", "video"], label: "Loại bài giảng" },
          url: { type: "string", label: "Đường dẫn bài giảng" },
          content: { type: "string", label: "Nội dung bài giảng" },
          fileName: { type: "string", label: "Tên tệp" },
        },
      },
    }, true),
    structured("quizzes", "Câu hỏi trắc nghiệm (nếu chưa có, nói bỏ qua)", {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        open: false,
        keys: {
          question: { type: "string", required: true, label: "Nội dung câu hỏi" },
          options: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" }, required: true, label: "Các phương án trả lời" },
          correctOptionIndex: { type: "number", integer: true, min: 0, max: 5, required: true, label: "Vị trí đáp án đúng (bắt đầu từ 0)" },
        },
      },
    }, true),
  ],
  resultFields: ["title", "category", "duration", "instructor"] });
const trainingListOperation = operations.find(op => op.id === "training.list");
if (trainingListOperation) trainingListOperation.fields = [queryField(text("search", "Tên hoặc danh mục khóa đào tạo"), "search")];
const trainingCreateOperation = operations.find(op => op.id === "training.create");
if (trainingCreateOperation) trainingCreateOperation.description = "Tạo khóa đào tạo trong phân hệ nhân sự. Giảng viên mặc định là người tạo. Khi được hỏi, thu thập bài giảng theo tên và đường dẫn hoặc nội dung; thu thập câu hỏi trắc nghiệm theo nội dung, các phương án và đáp án đúng. Nếu người dùng bỏ qua một danh sách, để danh sách đó rỗng.";
for (const trainingOperation of operations.filter(op => op.id === "training.create" || op.id === "training.update")) {
  trainingOperation.resultFields = ["title", "category", "duration", "instructor"];
}
const trainingDeleteOperation = operations.find(op => op.id === "training.delete");
if (trainingDeleteOperation) {
  trainingDeleteOperation.title = "Xóa khóa đào tạo nội bộ";
  trainingDeleteOperation.description = "Xóa khóa đào tạo nội bộ đã được chọn. Luôn hiển thị đúng tên khóa và yêu cầu xác nhận trước khi xóa.";
  trainingDeleteOperation.resultFields = ["title", "category"];
}
entity({ id: "product", title: "sản phẩm", module: "inventory", permissions: ["inventory:read"], path: "/inventory/catalog/products", link: "/kho-san-pham", fields: [], create: false, resultFields: ["name", "productCode", "categoryCode", "productType", "status"] });
const productListOperation = operations.find(op => op.id === "product.list");
if (productListOperation) productListOperation.fields = [queryField({ ...text("search", "Tên, mã sản phẩm hoặc SKU"), max: 100 }, "q")];

operations.push({ id: "repair.list", title: "Tra cứu phiếu sửa chữa", description: "Tìm phiếu theo mã phiếu, tên khách hàng hoặc số sê ri trong chi nhánh đã chọn.", module: "repair", permissions: ["repair:read", "repair:manage"], method: "GET", path: "/repair/tickets", link: "/sua-chua-bao-hanh",
  fields: [
    queryField({ ...text("search", "Mã phiếu, tên khách hàng hoặc số sê ri"), max: 100 }, "q"),
    queryRef("branchId", "Chi nhánh", "branch.list"),
    queryField(choice("status", "Trạng thái phiếu", ["received", "diagnosing", "quoted", "approved", "repairing", "waiting_parts", "waiting_supplier", "done", "delivered", "cancelled", "returned"])),
    queryField(choice("paymentStatus", "Trạng thái thanh toán", ["unpaid", "partial", "paid"])),
    queryRef("customerId", "Khách hàng", "customer.list", false),
    queryRef("technicianId", "Kỹ thuật viên", "employee.list", false),
    queryField(date("from", "Tiếp nhận từ ngày")),
    queryField(date("to", "Tiếp nhận đến ngày")),
    queryField({ ...number("page", "Trang", 1), min: 1, max: 10000, integer: true }),
    queryField({ ...number("limit", "Số kết quả", 25), min: 1, max: 100, integer: true }),
  ], resultFields: ["ticketCode", "customerName", "customerId", "status", "paymentStatus", "technicianName", "totalAmount", "paidAmount", "dueAmount", "receivedAt", "deliveredAt"] });
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
if (employeeUpdate) {
  employeeUpdate.fields = employeeUpdate.fields.filter(field => field.key !== "email");
  if (!employeeUpdate.fields.some(field => field.key === "parentId")) {
    employeeUpdate.fields.push({ ...ref("parentId", "Quản lý trực tiếp", "employee.list", false), referenceValueKey: "id" });
  }
}
const treasuryBranch = () => queryField(ref("targetBranch", "Chi nhánh tài chính", "branch.list"), "branchId");
const treasuryReadPermissions = ["finance-wallet:read", "finance-wallet:manage"];
operations.push(
  { id: "finance.treasury.accounts.list", title: "Tra các quỹ tiền mặt và tài khoản ngân hàng", description: "Xem số dư các quỹ trong chi nhánh đã chọn.", module: "finance", permissions: treasuryReadPermissions, permissionGroups: [["finance-wallet:read"], ["finance-wallet:manage"]], method: "GET", path: "/finance/reporting/treasury", link: "/tai-chinh", fields: [treasuryBranch()], resultFields: ["name", "kind", "openingOn", "openingBalance", "balance"] },
  { id: "finance.treasury.vouchers.list", title: "Tra phiếu thu chi", description: "Xem phiếu thu chi trong chi nhánh đã chọn.", module: "finance", permissions: treasuryReadPermissions, permissionGroups: [["finance-wallet:read"], ["finance-wallet:manage"]], method: "GET", path: "/finance/reporting/treasury", link: "/tai-chinh", fields: [treasuryBranch()], resultFields: ["description", "kind", "amount", "occurredOn", "status", "reference"] },
  { id: "finance.treasury.bank-lines.list", title: "Tra giao dịch ngân hàng chờ đối soát", description: "Xem các giao dịch sao kê chưa ghép với phiếu thu chi trong chi nhánh đã chọn.", module: "finance", permissions: treasuryReadPermissions, permissionGroups: [["finance-wallet:read"], ["finance-wallet:manage"]], method: "GET", path: "/finance/reporting/treasury", link: "/tai-chinh", fields: [treasuryBranch()], resultFields: ["bankKey", "description", "amount", "occurredOn"] },
  { id: "finance.treasury.periods.list", title: "Tra cứu kỳ tài chính", description: "Xem trạng thái các kỳ tài chính trong chi nhánh đã chọn.", module: "finance", permissions: treasuryReadPermissions, permissionGroups: [["finance-wallet:read"], ["finance-wallet:manage"]], method: "GET", path: "/finance/reporting/treasury", link: "/tai-chinh", fields: [treasuryBranch()], resultFields: ["month", "status", "closedAt"] },
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
    resultFields: [...leadResultFields, "moduleSync"],
    resultChildFields: { moduleSync: ["targetModule", "syncedAt"] },
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
const leadLinkTargets: Array<{ suffix: string; title: string; targetModule: string; targetName: string; reference: string; modules: ModuleKey[]; readPermission: string }> = [
  { suffix: "student", title: "Liên kết khách tiềm năng với học viên", targetModule: "students", targetName: "Học viên cần liên kết", reference: "student.list", modules: ["omni-inbox", "student"], readPermission: "people:read" },
  { suffix: "patient", title: "Liên kết khách tiềm năng với bệnh nhân", targetModule: "healthcare", targetName: "Bệnh nhân cần liên kết", reference: "healthcare.patient.list", modules: ["omni-inbox", "healthcare"], readPermission: "healthcare:read" },
  { suffix: "worker", title: "Liên kết khách tiềm năng với người lao động", targetModule: "workers", targetName: "Người lao động cần liên kết", reference: "worker.list", modules: ["omni-inbox", "worker"], readPermission: "people:read" },
];
for (const target of leadLinkTargets) {
  const permissionGroups = [["omni-inbox:manage", target.readPermission]];
  operations.push({
    id: `omni-inbox.leads.link-${target.suffix}`,
    title: target.title,
    description: `Gắn khách tiềm năng đã chọn với một hồ sơ ${target.targetName.toLocaleLowerCase()} đã có. Không tạo hồ sơ mới; cần xác nhận trước khi liên kết.`,
    module: "omni-inbox",
    modules: target.modules,
    permissions: permissionGroups[0],
    permissionGroups,
    method: "POST",
    path: "/omni-inbox/leads/:id/module-sync",
    link: "/omni-inbox",
    confirmation: true,
    adapter: "contract",
    fixedBodyValues: { targetModule: target.targetModule },
    fields: [
      { ...ref("path_id", "Khách tiềm năng cần liên kết", "omni-inbox.leads.list"), source: "path", apiKey: "id", referenceValueKey: "id" },
      { ...ref("targetRecordId", target.targetName, target.reference), source: "body", apiKey: "targetRecordId", referenceValueKey: "id" },
    ],
    resultFields: ["targetModule", "targetRecordName", "syncedAt"],
  });
}
const existingRoutes = new Set(operations.map(op => op.method + " " + op.path));
const expandedOperations = (expandedCatalog as AssistantOperation[]).filter(op =>
  !existingRoutes.has(op.method + " " + op.path)
  // Supplier declarations are managed through the supplier role in Retail Partners.
  && !(op.method === "POST" && op.path === "/inventory/receiving/suppliers"),
);
const readableOperationsByPath = new Map([...operations, ...expandedOperations]
  .filter(op => op.method === "GET")
  .map(op => [op.path, op.id] as const));
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
  "POST /inventory/catalog/resources/:kind": "Tạo thể loại / thư mục, thương hiệu, đơn vị tính hoặc thuộc tính sản phẩm",
  "PATCH /inventory/catalog/resources/:kind/:id": "Cập nhật dữ liệu dùng chung cho sản phẩm",
  "GET /inventory/catalog/templates": "Tra cứu mẫu sản phẩm",
  "POST /inventory/catalog/templates": "Tạo mẫu sản phẩm",
  "PATCH /inventory/catalog/templates/:id": "Cập nhật mẫu sản phẩm",
  "GET /inventory/catalog/prices": "Tra cứu giá bán và giá vốn SKU",
  "PUT /inventory/catalog/prices/:variantId": "Cập nhật giá nhập và giá bán SKU",
  "POST /inventory/catalog/products": "Tạo sản phẩm và SKU",
  "POST /inventory/catalog/products/with-price": "Tạo sản phẩm và SKU kèm giá bán",
  "POST /inventory/catalog/products/bulk-create-with-variants": "Tạo sản phẩm với nhiều SKU",
  "POST /inventory/catalog/products/:id/variants": "Thêm SKU cho sản phẩm",
  "POST /inventory/catalog/products/:id/variants/with-price": "Thêm SKU kèm giá bán",
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
  const workerPartnerCreate = op.method === "POST" && op.path === "/worker-management/partners";
  const workerList = op.method === "GET" && op.path === "/worker-management/workers";
  const workerAttendanceMark = op.method === "POST" && op.path === "/worker-management/attendance/mark";
  const workerAttendanceList = op.method === "GET" && op.path === "/worker-management/attendance";
  const workerAttendanceAdjust = op.method === "PATCH" && op.path === "/worker-management/attendance/:id";
  const workerProfileDelete = op.method === "DELETE" && op.path === "/worker-management/workers/:id";
  const workerProjectDetail = op.method === "GET" && op.path === "/worker-management/projects/:id";
  const workerProjectUpdate = op.method === "PATCH" && op.path === "/worker-management/projects/:id";
  const workerProjectDelete = op.method === "DELETE" && op.path === "/worker-management/projects/:id";
  const workerLaborContractCreate = op.method === "POST" && op.path === "/worker-management/labor-contracts";
  const workerLaborContractDetail = op.method === "GET" && op.path === "/worker-management/labor-contracts/:id";
  const workerLaborContractHistory = op.method === "GET" && op.path === "/worker-management/labor-contracts/:id/history";
  const workerLaborContractUpdate = op.method === "PATCH" && op.path === "/worker-management/labor-contracts/:id";
  const workerLaborContractRenew = op.method === "POST" && op.path === "/worker-management/labor-contracts/:id/renew";
  const workerLaborContractDelete = op.method === "DELETE" && op.path === "/worker-management/labor-contracts/:id";
  const workerNotificationList = op.method === "GET" && op.path === "/worker-management/notifications";
  const workerNotificationCreate = op.method === "POST" && op.path === "/worker-management/notifications";
  const workerDashboard = op.method === "GET" && op.path === "/worker-management/dashboard";
  const workerPartnerReferralCreate = op.method === "POST" && op.path === "/worker-management/partners/:partnerId/referrals";
  const workerPartnerReferralEnd = op.method === "POST" && op.path === "/worker-management/partners/:partnerId/referrals/:referralId/end";
  const chatRoomsList = op.method === "GET" && op.path === "/chat/rooms";
  const chatRoomMembersList = op.method === "GET" && op.path === "/chat/rooms/:roomId";
  const chatRoomMemberRemove = op.method === "DELETE" && op.path === "/chat/rooms/:roomId/members/:userId";
  const chatRoomMemberRoleUpdate = op.method === "POST" && op.path === "/chat/rooms/:roomId/members/:userId/role";
  const chatMessagesList = op.method === "GET" && op.path === "/chat/rooms/:roomId/messages";
  const chatRoomCreate = op.method === "POST" && op.path === "/chat/rooms";
  const chatRoomUpdate = op.method === "PATCH" && op.path === "/chat/rooms/:roomId";
  const chatRoomDelete = op.method === "DELETE" && op.path === "/chat/rooms/:roomId";
  const chatRoomLeave = op.method === "DELETE" && op.path === "/chat/rooms/:roomId/leave";
  const chatMessageSearch = op.method === "GET" && op.path === "/chat/rooms/:roomId/search";
  const chatMessageUpdate = op.method === "PATCH" && op.path === "/chat/rooms/:roomId/messages/:messageId";
  const chatMessageDelete = op.method === "DELETE" && op.path === "/chat/rooms/:roomId/messages/:messageId";
  const workerLaborContractList = op.method === "GET" && op.path === "/worker-management/labor-contracts";
  const workerLaborContractPath = op.path.startsWith("/worker-management/labor-contracts/:id");
  const workerPartnerPath = op.path.startsWith("/worker-management/partners/") && !op.path.startsWith("/worker-management/partners/policies");
  const workerPartnerPolicyList = op.method === "GET" && op.path === "/worker-management/partners/policies";
  const workerPartnerPolicyPath = op.path.startsWith("/worker-management/partners/policies/");
  const inventoryCount = op.path.startsWith("/inventory/counts");
  const inventoryCountApproval = op.method === "POST" && op.path === "/inventory/counts/:id/approve";
  const markInstallmentPaid = op.method === "PATCH" && op.path === "/students/:id/installment/:no/mark-paid";
  const studentList = op.method === "GET" && op.path === "/students";
  const unassignedStudentList = op.method === "GET" && op.path === "/students/unassigned";
  const studentUpdate = op.method === "PATCH" && op.path === "/students/:id";
  const assignStudentBranch = op.method === "PATCH" && op.path === "/students/:id/assign-branch";
  const courseList = op.method === "GET" && op.path === "/courses";
  const courseCreate = op.method === "POST" && op.path === "/courses";
  const courseCategoryList = op.method === "GET" && op.path === "/courses/categories";
  const courseCategoryCreate = op.method === "POST" && op.path === "/courses/categories";
  const batchList = op.method === "GET" && op.path === "/batches";
  const batchDetail = op.method === "GET" && op.path === "/batches/:id";
  const batchUpdate = op.method === "PATCH" && op.path === "/batches/:id";
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
  const retailInvoiceDetail = op.method === "GET" && op.path === "/retail/invoices/:id";
  const retailReportSummary = op.method === "GET" && op.path === "/retail/reports/summary";
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
        ? [queryField(text("search", "Tên hoặc mã khóa học"), "search"), queryField(ref("query_category", "Danh mục khóa học", "course.category.list", false), "category"), queryField(choice("query_status", "Trạng thái khóa học", ["Hoạt động", "Tạm dừng"]), "status"), queryField(number("page", "Trang", 1), "page"), queryField(number("limit", "Số kết quả", 100), "limit")]
      : financeAssetList
        ? [queryField(text("search", "Mã, mã vạch hoặc tên tài sản"), "search"), queryField(choice("status", "Trạng thái", ["in_use", "idle", "repairing", "lost", "damaged"])), queryField(text("group", "Nhóm tài sản"))]
      : financeAssetDepreciationList
        ? [queryField(text("period", "Kỳ khấu hao (YYYY-MM)", true), "period")]
    : op.fields.map(field => {
      if (batchDetail && field.source === "path" && field.apiKey === "id") return { ...field, label: "T\u00EAn ho\u1EB7c m\u00E3 l\u1EDBp", reference: "batch.list", referenceValueKey: "id" };
      if (workerProfileDelete && field.key === "path_id") return { ...field, label: "Người lao động cần xóa", reference: "worker.list", referenceValueKey: "id" };
      if (workerProjectDetail && field.key === "path_id") return { ...field, label: "Tên hoặc mã dự án", reference: "worker.project.list", referenceValueKey: "id" };
      if (workerProjectUpdate && field.key === "path_id") return { ...field, label: "Dự án cần sửa", reference: "worker.project.list", referenceValueKey: "id" };
      if (workerProjectDelete && field.key === "path_id") return { ...field, label: "Dự án cần xóa", reference: "worker.project.list", referenceValueKey: "id" };
      if (workerAttendanceAdjust && field.key === "path_id") return { ...field, label: "Bản ghi chấm công cần sửa", reference: "worker.attendance.list", referenceParentKey: "projectId", referenceValueKey: "id" };
      if (workerLaborContractList && field.apiKey === "search") return { ...field, label: "Mã hợp đồng, đơn vị hoặc người lao động" };
      if (workerLaborContractList && field.apiKey === "alert") return { ...field, label: "Cảnh báo hạn hợp đồng" };
      if (workerLaborContractCreate && field.apiKey === "workerId") return { ...field, label: "Người lao động cần ký hợp đồng", reference: "worker.list", referenceValueKey: "id" };
      if ((workerLaborContractUpdate || workerLaborContractRenew) && field.apiKey === "clientName") return { ...field, label: "Khách hàng hoặc đơn vị sử dụng lao động" };
      if (workerAttendanceMark && field.apiKey === "deviceInfo") return { ...field, label: "Thông tin thiết bị" };
      if (field.apiKey === "idCard" && op.module === "worker") return { ...field, label: "CCCD/CMND" };
      if (field.apiKey === "checkInAt") return { ...field, label: "Giờ vào" };
      if (field.apiKey === "checkOutAt") return { ...field, label: "Giờ ra" };
      if (courseCategoryCreate && field.source === "body" && field.apiKey === "name") return { ...field, label: "Tên phân loại khóa học" };
      if (field.source === "query" && field.apiKey === "branchId" && (financeTaxFromInvoice || inventoryStockLogReverse || financeDebtList || financeManagementDebtList || financeManagementPayableCreate || financeManagementFollowup || (op.method !== "GET" && !op.id.startsWith("recruitment.")))) { const label = financeTaxFromInvoice || financeDebtList || financeManagementDebtList || financeManagementPayableCreate || financeManagementFollowup || op.path.startsWith("/finance/") ? "Chi nhánh tài chính" : inventoryStockLogReverse ? "Chi nhánh kho" : "Chi nhánh áp dụng"; return { ...field, key: "targetBranch", type: "reference" as const, label, reference: "branch.list" }; }
      if (op.path.startsWith("/payroll/periods/") && field.source === "path" && field.apiKey === "periodKey") return { ...field, label: "K\u1EF3 l\u01B0\u01A1ng (YYYY-MM)", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" };
      if (op.id === "payroll.period.input.update" && field.source === "path" && field.apiKey === "employeeId") return { ...field, label: "T\u00EAn nh\u00E2n vi\u00EAn", reference: "employee.list" };
      if (inventoryCount && field.key === "path_id") return { ...field, label: "Mã hoặc tên phiếu kiểm kê", reference: "inventory.count.list", referenceValueKey: "id" };
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
      if (op.method === "POST" && op.path === "/inventory/catalog/products" && field.key === "productType") return { ...field, options: ["physical", "service"] };
      if (inventoryResource && field.key === "path_kind") return { ...field, label: "Loại dữ liệu cần tạo", options: op.method === "DELETE" ? ["categories", "brands"] : ["categories", "brands", "units", "attributes"] };
      if (inventoryResource && field.source === "body" && field.apiKey === "parentCode") return { ...field, label: "Thể loại / thư mục cha" };
      if (inventoryResource && field.key === "path_id") return { ...field, label: "Tên hoặc mã dữ liệu sản phẩm", reference: "inventory.catalog.resource.list" };
      if (inventoryResource && field.source === "body" && field.apiKey === "category" && op.method === "POST") return { ...field, label: "Nhóm đơn vị tính", requiredWhen: { field: "path_kind", equals: "units" } };
      if (inventoryResource && field.source === "body" && field.apiKey === "type" && op.method === "POST") return { ...field, label: "Kiểu thuộc tính", requiredWhen: { field: "path_kind", equals: "attributes" } };
      if (inventoryResource && field.source === "body" && field.apiKey === "options") return { ...field, label: "Danh sách giá trị lựa chọn (JSON)", requiredWhen: { field: "type", equals: ["select", "multi-select"] } };
      if (inventoryResource && field.source === "body" && field.apiKey === "conversionFactor") return { ...field, label: "Hệ số quy đổi", requiredWhen: { field: "baseUnitCode", present: true } };
      if (retailCommission && field.key === "path_id") return { ...field, label: "Tên hoặc mã cộng tác viên", reference: "retail.partner.list" };
      if (op.id === "retail.payment-review.review" && field.key === "path_id") return { ...field, label: "Mã đơn hoặc mã thanh toán cần rà soát", reference: "retail.payment-review.pending" };
      if (op.path === "/retail/partners/:id" && field.key === "path_id") return { ...field, label: "Tên hoặc mã đối tác bán lẻ", reference: "retail.partner.list" };
      if (retailShiftPath && field.key === "path_id") return { ...field, label: "Mã ca POS hoặc tên nhân viên thu ngân", reference: "retail.shift.list" };
      if (retailOrderPath && field.key === "path_id") return { ...field, label: "Mã hoặc tên đơn bán lẻ", reference: "retail.order.list", ...((retailOrderDraftUpdate || retailOrderConfirm) ? { referenceContext: { query_heldOnly: true } } : {}) };
      if (customerBillingProfileOperation && field.key === "path_id") return { ...field, label: "Tên hoặc số điện thoại khách hàng", reference: "customer.list" };
      if (customerBillingProfileCreate && field.source === "body" && billingProfileFieldLabels[field.apiKey || field.key]) return { ...field, label: billingProfileFieldLabels[field.apiKey || field.key] };
      if (financeDebtPayment && field.key === "path_id") return { ...field, label: "Mã chứng từ hoặc đối tượng công nợ", reference: "finance.debt.list" };
      if (financeReceivablePath && field.key === "path_id") return { ...field, label: "Mã khoản phải thu hoặc mã chứng từ", reference: "finance.receivable.list" };
      if ((financeReceivableList || financeReceivableByCustomer) && field.apiKey === "customerId") return { ...field, label: "Tên khách hàng", reference: "customer.list" };
      if (op.path === "/retail/points/customers/:id/adjust" && field.key === "path_id") return { ...field, label: "Tên hoặc mã khách hàng", reference: "customer.list" };
      if (op.path.startsWith("/inventory/catalog/products/") && field.key === "path_id") return { ...field, label: "Tên hoặc mã sản phẩm", reference: "product.list" };
      if (op.method === "PUT" && op.path === "/inventory/catalog/prices/:variantId" && field.key === "path_variantId") return { ...field, label: "SKU hoặc tên biến thể thuộc sản phẩm đã chọn" };
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
      if (workerLaborContractPath && field.key === "path_id") {
        const label = workerLaborContractDelete ? "Hợp đồng cần xóa"
          : workerLaborContractRenew ? "Hợp đồng cần gia hạn"
            : workerLaborContractUpdate ? "Hợp đồng cần sửa"
              : workerLaborContractHistory ? "Hợp đồng cần xem lịch sử gia hạn"
                : "Hợp đồng cần xem";
        return { ...field, label, reference: "worker.labor.contract.list", referenceValueKey: "id" };
      }
      if ((op.id === "payroll.employee.reconciliation.action" || op.id === "payroll.employee.me.payslip.review.request") && field.key === "path_id") return field;
      if (op.path.startsWith("/marketing-campaigns/:id/") && field.source === "path" && field.apiKey === "id") return { ...field, label: "Tên chiến dịch", reference: "marketing.campaign.list", referenceValueKey: "id" };
      if (op.id === "student.detail" && field.key === "path_id") return { ...field, label: "Tên, số điện thoại hoặc email học viên", reference: "student.list" };
      if (op.id === "student.learning-history" && field.key === "path_id") return { ...field, label: "Tên hoặc số điện thoại học viên", reference: "student.list" };
      if (field.source !== "path" || !/^(?:id|uid|[A-Za-z]+(?:Id|Uid|Key))$/.test(field.apiKey || "")) return field;
      const parameter = `:${field.apiKey}`;
      const parameterAt = op.path.indexOf(parameter);
      if (parameterAt < 0) return field;
      const collectionPath = op.path.slice(0, parameterAt).replace(/\/$/, "");
      const referenceOperationId = readableOperationsByPath.get(collectionPath);
      if (!referenceOperationId) return field;
      let label = field.label;
      if (/^Tên hoặc mã Tên,\s*/.test(label)) label = label.replace(/^Tên hoặc mã Tên,\s*/, "Tên, ");
      else if (/^Tên hoặc mã Tên\s+/.test(label)) label = label.replace(/^Tên hoặc mã Tên\s+/, "Tên hoặc mã ");
      else if (/^Tên\s+/.test(label) && !/^Tên,/.test(label)) label = label.replace(/^Tên\s+/, "Tên hoặc mã ");
      else if (/^Mã\s+/.test(label) && !/^Mã (?:hoặc|,)/.test(label)) label = label.replace(/^Mã\s+/, "Tên hoặc mã ");
      else if (!/^(?:Tên hoặc mã|Tên,|Mã (?:hoặc|,))/.test(label)) label = `Tên hoặc mã ${label}`;
      return { ...field, label, reference: field.reference || referenceOperationId };
    });
  return {
    ...op,
    ...(batchDetail ? { id: "student.batch.detail", title: "Xem th\u00F4ng tin l\u1EDBp h\u1ECDc", description: "Tra c\u1EE9u th\u00F4ng tin l\u1EDBp theo t\u00EAn ho\u1EB7c m\u00E3 l\u1EDBp trong chi nh\u00E1nh \u0111ang ch\u1ECDn.", resultFields: ["code", "name", "courseCode", "courseTitle", "location", "instructorName", "startDate", "endDate", "status"] } : {}),
    ...(batchUpdate ? { description: "Cập nhật lịch, giảng viên, địa điểm, khóa học hoặc lộ trình của lớp. Tên và mã lớp không thể đổi sau khi tạo. Tiêu đề hiển thị lấy từ khóa học; có thể đổi khóa học gắn với lớp này mà không đổi tên các khóa học khác. Cần xác nhận trước khi lưu." } : {}),
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
    ...(courseCategoryCreate ? {
      id: "course.category.create",
      title: "Tạo phân loại khóa học",
      description: "Tạo phân loại khóa học trong phân hệ quản lý học viên. Cần tên phân loại và xác nhận trước khi lưu.",
      permissions: ["people:manage"],
      permissionGroups: [["people:manage"]],
      confirmation: true,
      resultFields: ["name"],
    } : {}),
    ...(courseCreate ? { title: "Tạo khóa học cho học viên", description: "Tạo khóa học trong phân hệ quản lý học viên. Chọn một danh mục khóa học đã có trong phạm vi tài khoản." } : {}),
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
    ...(op.method === "POST" && op.path === "/retail/partners" ? { id: "retail.partner.create", title: "Tạo đối tác bán lẻ", description: "Tạo hồ sơ trong phân hệ Đối tác bán lẻ với một vai trò cộng tác viên, đại lý hoặc nhà cung cấp. Khi yêu cầu nêu rõ một vai trò, tự chọn đúng vai trò đó; chỉ hỏi vai trò nếu người dùng nói chung là tạo đối tác. Có thể liên kết nhà cung cấp kho đã có nếu người dùng chọn rõ. Cần xác nhận trước khi lưu.", confirmation: true } : {}),
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
    ...(retailOrderDraftUpdate ? { id: "retail.order.draft.update", title: "Cập nhật đơn nháp bán lẻ", description: "Sửa các thông tin được yêu cầu trên đơn nháp. Đọc bản hiện tại để giữ nguyên dòng hàng và thông tin không sửa. Cần xác nhận trước khi lưu, từ chối nếu đơn thay đổi sau bản xem trước.", contextBody: ["idempotencyKey"], partialUpdate: true, mergeBodyWithReference: true } : {}),
    ...(retailOrderConfirm ? { id: "retail.order.confirm", title: "Xác nhận đơn nháp bán lẻ", contextBody: ["idempotencyKey"] } : {}),
    ...(retailOrderCollect ? { id: "retail.order.collect", title: "Thu thêm tiền đơn bán lẻ", contextBody: ["idempotencyKey"] } : {}),
    ...(retailOrderCancel ? { id: "retail.order.cancel", title: "Hủy đơn bán lẻ", contextBody: ["idempotencyKey"] } : {}),
    ...(retailCashierList ? { id: "retail.shift.cashier.list", title: "Tra cứu nhân viên thu ngân", resultFields: ["id", "name"] } : {}),
    ...(retailDrawerList ? { id: "retail.shift.drawer.list", title: "Tra cứu quầy và két POS", resultFields: ["code", "name", "isActive"] } : {}),
    ...(retailSettlementList ? { id: "retail.shift.settlements.list", title: "Tra cứu khoản thu POS chưa đối soát", resultFields: ["orderCode", "paymentIndex", "paymentMethod", "paymentAmount"] } : {}),
    ...(financeDebtList ? { id: "finance.debt.list", title: "Tra cứu công nợ", resultFields: ["source", "direction", "partyKind", "partyName", "reference", "amount", "balance", "dueOn", "daysOverdue", "daysUntilDue", "bucket", "alert"] } : {}),
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
    ...(op.method === "PATCH" && op.path === "/inventory/counts/:id/items/:itemId" ? { id: "inventory.count.item.update", systemBodyFields: ["expectedVersion"] } : {}),
    ...(inventoryCountApproval ? { id: "inventory.count.approve", title: "Phê duyệt kiểm kê và cập nhật tồn kho", systemBodyFields: ["expectedVersion"], description: "Chỉ phê duyệt phiếu đang chờ duyệt. Tồn kho sẽ thay đổi theo kết quả đếm. Nếu có chênh lệch, cần xác nhận đã kiểm tra và nêu lý do. Mỗi mã ngoài dự kiến cần có kết quả đối chiếu riêng. Cần xác nhận trước khi cập nhật tồn kho." } : {}),
    ...(markInstallmentPaid ? { title: "Đánh dấu đợt học phí đã thu", description: "Đánh dấu một đợt học phí đã thu cho học viên đã xác định. Thao tác cần xác nhận.", allowEmptyUpdate: true } : {}),
    ...(partnerCreate ? { title: "Tạo cộng tác viên giới thiệu học viên", description: "Tạo cộng tác viên giới thiệu học viên; cần tên và số điện thoại. Cần xác nhận trước khi lưu." } : {}),
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
    ...(workerPartnerCreate ? { title: "Tạo cộng tác viên lao động", description: "Tạo đối tác cung ứng lao động; cần mã, tên và số điện thoại. Cần xác nhận trước khi lưu." } : {}),
    ...(workerList ? { id: "worker.list", title: "Tra cứu người lao động" } : {}),
    ...(workerProfileDelete ? { id: "worker.delete", title: "Xóa hồ sơ lao động", description: "Xóa hồ sơ của người lao động đã chọn theo tên. Thao tác này không xóa các bản ghi chấm công hoặc hợp đồng liên quan. Cần xác nhận trước khi xóa." } : {}),
    ...(workerProjectDetail ? { id: "worker.project.detail", title: "Xem thông tin dự án lao động", resultFields: ["code", "name", "quota", "daysOfWeek", "startTime", "endTime", "location", "startDate", "endDate", "status"] } : {}),
    ...(workerProjectDelete ? { id: "worker.project.delete", title: "Xóa dự án lao động", description: "Xóa dự án đã chọn theo tên hoặc mã. Cần xác nhận trước khi xóa." } : {}),
    ...(chatRoomsList ? { id: "chat.rooms.list", title: "Tra cứu phòng trò chuyện", resultFields: ["name", "isGroup", "updatedAt"] } : {}),
    ...(chatRoomMembersList ? { id: "chat.room.members.list", title: "Tra cứu thành viên trong phòng chat", resultFields: ["displayName", "roleLabel"] } : {}),
    ...(chatRoomMemberRemove ? { id: "chat.room.member.remove", title: "Xóa thành viên khỏi phòng chat", description: "Xóa thành viên đã chọn khỏi phòng nhóm. Phòng và người cần xóa được chọn theo tên; chỉ Trưởng nhóm mới nhận được danh sách thành viên. Cần xác nhận trước khi xóa.", resultFields: ["roomName", "removed"] } : {}),
    ...(chatMessagesList ? { id: "chat.room.messages.list", title: "Tra cứu tin nhắn trong phòng", resultFields: ["senderName", "content", "createdAt", "editedAt", "isDeleted"] } : {}),
    ...(workerLaborContractList ? { id: "worker.labor.contract.list", title: "Tra cứu hợp đồng lao động", description: "Tìm hợp đồng theo mã, người lao động hoặc đơn vị; có thể lọc theo trạng thái và hạn hợp đồng trong phạm vi được cấp quyền.", adapter: undefined, resultFields: ["code", "clientName", "workerName", "startDate", "endDate", "status", "alertLevel", "note"] } : {}),
    ...(workerLaborContractDetail ? { id: "worker.labor.contract.detail", title: "Xem chi tiết hợp đồng lao động", resultFields: ["code", "clientName", "workerName", "startDate", "endDate", "status", "note"] } : {}),
    ...(workerLaborContractHistory ? { id: "worker.labor.contract.history", title: "Xem lịch sử gia hạn hợp đồng lao động", resultFields: ["code", "clientName", "workerName", "startDate", "endDate", "status", "previousEndDate", "renewedAt"] } : {}),
    ...(workerLaborContractCreate ? { id: "worker.labor.contract.create", title: "Tạo hợp đồng lao động", description: "Lập hợp đồng cho người lao động đã chọn. Cần mã hợp đồng, đơn vị sử dụng lao động, ngày bắt đầu và ngày kết thúc; cần xác nhận trước khi lưu.", resultFields: ["code", "clientName", "workerName", "startDate", "endDate", "status", "note"] } : {}),
    ...(workerLaborContractUpdate ? { id: "worker.labor.contract.update", title: "Cập nhật hợp đồng lao động", description: "Cập nhật các thông tin được nêu trên hợp đồng đã chọn. Hợp đồng đã khóa sau khi gia hạn không thể sửa điều khoản.", resultFields: ["code", "clientName", "workerName", "startDate", "endDate", "status", "note"] } : {}),
    ...(workerLaborContractRenew ? { id: "worker.labor.contract.renew", title: "Gia hạn hợp đồng lao động", description: "Tạo kỳ hợp đồng mới nối tiếp hợp đồng đã chọn và giữ kỳ cũ trong lịch sử. Cần xác nhận trước khi gia hạn.", resultFields: ["code", "clientName", "workerName", "startDate", "endDate", "status", "note"] } : {}),
    ...(workerLaborContractDelete ? { id: "worker.labor.contract.delete", title: "Xóa hợp đồng lao động", description: "Xóa hợp đồng đã chọn. Cần xác nhận trước khi xóa." } : {}),
    ...(workerAttendanceMark ? { id: "worker.attendance.mark", title: "Ghi nhận chấm công lao động", description: "Ghi nhận giờ vào hoặc giờ ra của người lao động đã chọn tại dự án. Cần xác nhận trước khi ghi.", resultFields: ["workerName", "projectName", "date", "status", "workedMinutes"] } : {}),
    ...(workerAttendanceList ? { id: "worker.attendance.list", title: "Tra cứu bảng chấm công dự án", description: "Xem bảng chấm công của dự án theo một ngày hoặc khoảng ngày.", resultFields: ["workerName", "projectName", "date", "checkInAt", "checkOutAt", "status", "workedMinutes", "note"] } : {}),
    ...(workerAttendanceAdjust ? { id: "worker.attendance.update", title: "Điều chỉnh giờ chấm công", description: "Sửa giờ vào, giờ ra hoặc ghi chú của bản ghi chấm công đã chọn. Cần xác nhận trước khi lưu.", resultFields: ["workerName", "projectName", "date", "checkInAt", "checkOutAt", "status", "workedMinutes", "note"] } : {}),
    ...(workerDashboard ? { id: "worker.dashboard", title: "Xem tổng quan lao động" } : {}),
    ...(workerNotificationList ? { id: "worker.notification.list", title: "Tra cứu thông báo lao động", resultFields: ["title", "content", "recipients", "recipientCount", "channels", "status", "createdAt"] } : {}),
    ...(workerNotificationCreate ? { id: "worker.notification.create", title: "Gửi thông báo lao động", description: "Gửi thông báo trong ứng dụng cho lao động trong phạm vi doanh nghiệp/chi nhánh. Cần tiêu đề và nội dung; cần xác nhận trước khi gửi.", resultFields: ["title", "content", "recipients", "recipientCount", "channels", "status", "createdAt"] } : {}),
    ...(workerPartnerPolicyList ? { id: "worker.partner.policy.list", title: "Tra cứu chính sách hoa hồng đối tác lao động" } : {}),
    ...(learningRoadmapWaitlist ? { id: "student.learning-roadmap.waitlist.list", title: "Tra cứu học viên trong danh sách chờ lộ trình", resultFields: ["studentName", "roadmapName", "sourceBatchCode", "learningFormat", "preferredTimeSlot", "waitingDays"] } : {}),
    ...(op.method === "GET" && op.path === "/worker-management/partners/policies/:policyId" ? { id: "worker.partner.policy.detail" } : {}),
    ...(chatRoomCreate ? { title: "Tạo phòng trò chuyện", description: "Tạo phòng chat mới để trao đổi với đồng nghiệp. Người dùng chọn tên phòng và những người cần mời; hệ thống sẽ hiển thị nội dung để xác nhận trước khi tạo." } : {}),
    ...(chatRoomUpdate ? { title: "Cập nhật thông tin phòng trò chuyện", description: "Đổi tên hoặc cập nhật thông tin của phòng chat đã chọn. Cần chọn đúng phòng theo tên trước khi lưu." } : {}),
    ...(chatRoomDelete ? { title: "Xóa phòng trò chuyện", description: "Xóa phòng chat đã chọn. Nếu chỉ muốn rời khỏi nhóm, hãy dùng chức năng rời phòng. Hệ thống yêu cầu xác nhận trước khi xóa." } : {}),
    ...(chatRoomLeave ? { title: "Rời phòng trò chuyện", description: "Rời khỏi phòng chat đã chọn nhưng không xóa phòng hoặc tin nhắn của những thành viên còn lại." } : {}),
    ...(chatMessageSearch ? { title: "Tìm tin nhắn theo từ khóa trong phòng chat", description: "Tìm các tin nhắn có chứa từ hoặc cụm từ người dùng cung cấp trong phòng chat đã chọn." } : {}),
    ...(chatMessagesList ? { title: "Xem danh sách tin nhắn trong phòng chat", description: "Hiển thị các tin nhắn của phòng chat đã chọn. Dùng chức năng này khi muốn xem danh sách; nếu cần tìm một từ hoặc cụm từ cụ thể, hãy dùng chức năng tìm tin nhắn." } : {}),
    ...(chatRoomMemberRoleUpdate ? { title: "Cập nhật vai trò thành viên trong phòng chat", description: "Thay đổi vai trò của thành viên đã chọn trong phòng chat. Cần chọn đúng người và vai trò mới; hệ thống sẽ yêu cầu xác nhận trước khi lưu." } : {}),
    ...(chatMessageUpdate ? { title: "Sửa nội dung tin nhắn trong phòng chat", description: "Thay đổi nội dung của tin nhắn đã chọn trong phòng chat. Cần xác định đúng tin nhắn và nội dung mới; hệ thống sẽ yêu cầu xác nhận trước khi lưu." } : {}),
    ...(chatMessageDelete ? { title: "Xóa tin nhắn trong phòng chat", description: "Xóa tin nhắn đã chọn khỏi phòng chat. Cần chọn đúng phòng và tin nhắn; hệ thống sẽ yêu cầu xác nhận trước khi xóa." } : {}),
    ...(op.method === "GET" && op.path === "/payroll/periods/:periodKey/audit" ? { title: "Xem nhật ký xử lý của kỳ lương", description: "Xem các bước xử lý của một kỳ lương theo tháng, gồm đồng bộ, tính, duyệt và chốt. Hãy chọn kỳ lương theo tháng, ví dụ 2026-11." } : {}),
    ...(op.method === "GET" && op.path === "/payroll/runs/:id/audit" ? { title: "Xem nhật ký thao tác của một lượt lương", description: "Xem ai đã thao tác, thao tác gì và thời điểm nào trong một lượt lương cụ thể đã chọn." } : {}),
    ...(op.method === "POST" && op.path === "/recruitment/interviews/:id/delete" ? { title: "Xóa lịch phỏng vấn", description: "Đưa lịch phỏng vấn đã chọn ra khỏi danh sách đang hoạt động. Lịch có thể được khôi phục sau đó; cần xác nhận trước khi xóa." } : {}),
    fields: (() => {
      const mapped = fields.filter(field => !(field.apiKey === "centerId" && (op.path === "/partners" || op.path.startsWith("/partners/commission-levels"))));
      if (workerList) return [queryField(text("query_search", "Tên, mã hoặc số điện thoại lao động"), "search"), ...mapped.filter(field => field.apiKey !== "search")];
      if (assignmentList || (op.method === "GET" && op.path === "/assignments/:id/submissions")) {
        return [queryField(ref("query_batchId", "Tên hoặc mã lớp", "batch.list"), "batchId"), ...mapped.filter(field => field.apiKey !== "batchId")];
      }
      if (!inventorySerialOperation && !inventoryCount && !financeReceivableOperation && !financeDebtList && !commissionLevel && !retailSettingsOperation && !retailPosOperation && !retailCashbookOperation && !retailFinanceCommissionOperation && !retailReceivableOperation && !retailAfterSaleOperation) return mapped;
      const label = inventorySerialOperation ? "Chi nhánh" : inventoryCount ? "Chi nhánh kiểm kê" : financeReceivableOperation ? "Chi nhánh hạch toán" : retailSettingsOperation || retailPosOperation || retailCashbookOperation || retailFinanceCommissionOperation || retailReceivableOperation || retailAfterSaleOperation ? "Chi nhánh bán lẻ" : "Chi nhánh áp dụng";
      return [queryField(ref("targetBranch", label, "branch.list", false), "branchId"), ...mapped.filter(field => field.apiKey !== "branchId"), ...(inventoryCountApproval ? [
        { key: "discrepancyConfirmed", apiKey: "discrepancyConfirmed", source: "body" as const, type: "boolean" as const, label: "Xác nhận đã kiểm tra và chấp nhận chênh lệch", required: false },
        { key: "reason", apiKey: "reason", source: "body" as const, type: "text" as const, label: "Lý do chấp nhận chênh lệch", max: 2000, required: false, requiredWhen: { field: "discrepancyConfirmed", equals: true } },
        { key: "unexpectedScanResolutions", apiKey: "unexpectedScanResolutions", source: "body" as const, type: "json" as const, label: "Kết quả đối chiếu từng mã ngoài dự kiến", required: false, structure: { type: "array", maxItems: 100, items: { type: "object", keys: { code: { type: "string", required: true, max: 160 }, reason: { type: "string", required: true, max: 2000 } } } } },
      ] : [])];
    })(),
    resultFields: inventoryResource ? (op.method === "DELETE" ? ["deletedId"] : ["code", "name", "status", "parentCode", "description", "website", "symbol", "category", "decimalPlaces", "baseUnitCode", "conversionFactor", "type", "options", "unitCode"])
      : batchDetail ? ["code", "name", "courseCode", "courseTitle", "location", "instructorName", "startDate", "endDate", "status"]
      : inventoryVariantBulkUpdate ? ["sku", "displayName", "status", "trackingMode", "unitCode"]
      : inventoryVariantBulkDelete ? []
      : workerProjectDetail ? ["code", "name", "quota", "daysOfWeek", "startTime", "endTime", "location", "startDate", "endDate", "status"]
      : workerLaborContractDetail || workerLaborContractCreate || workerLaborContractUpdate || workerLaborContractRenew ? ["code", "clientName", "workerName", "startDate", "endDate", "status", "note"]
      : workerLaborContractHistory ? ["code", "clientName", "workerName", "startDate", "endDate", "status", "previousEndDate", "renewedAt"]
      : workerAttendanceMark ? ["workerName", "projectName", "date", "status", "workedMinutes"]
      : workerAttendanceList || workerAttendanceAdjust ? ["workerName", "projectName", "date", "checkInAt", "checkOutAt", "status", "workedMinutes", "note"]
      : workerLaborContractList ? ["code", "clientName", "workerName", "startDate", "endDate", "status", "alertLevel", "note"]
      : workerNotificationList || workerNotificationCreate ? ["title", "content", "recipients", "recipientCount", "channels", "status", "createdAt"]
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
      : courseList ? ["title", "code", "category", "duration", "fee", "maxLearners", "activeBatches", "status"]
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
      : financeDebtList ? ["source", "direction", "partyKind", "partyName", "reference", "amount", "balance", "dueOn", "daysOverdue", "daysUntilDue", "bucket", "alert"]
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
const taskListOperation = operations.find(op => op.id === "task.list");
if (taskListOperation) {
  taskListOperation.description = "Xem công việc trong phạm vi được cấp quyền. Có thể chọn chi nhánh theo tên; quản trị viên không gắn chi nhánh có thể xem danh sách toàn công ty nếu không lọc chi nhánh.";
  taskListOperation.description += " Có thể lọc theo tên công việc, trạng thái, độ ưu tiên, người được giao, dự án và hạn hoàn thành.";
  taskListOperation.fields = [
    queryField(ref("targetBranch", "Chi nhánh công việc", "branch.list", false), "branchId"),
    queryField({ ...text("search", "Tên hoặc nội dung công việc"), max: 100 }),
    queryField(choice("status", "Trạng thái", ["Not Started", "In Progress", "Review/Testing", "Done", "Archived"])),
    queryField(choice("completionFilter", "Nhóm trạng thái", ["unfinished"])),
    queryField(choice("priority", "Độ ưu tiên", ["High", "Medium", "Low"])),
    queryField({ ...ref("assigneeUid", "Người được giao", "employee.list", false), referenceValueKey: "id" }),
    queryField({ ...ref("projectId", "Dự án", "project.list", false), referenceValueKey: "id" }),
    queryField(date("dueFrom", "Hạn hoàn thành từ ngày")),
    queryField(date("dueTo", "Hạn hoàn thành đến ngày")),
    queryField({ key: "overdue", label: "Chỉ công việc quá hạn", type: "boolean" }),
  ];
  taskListOperation.assistantOnlyFields = ["completionFilter"];
}
const taskActivityUpdateOperation = operations.find(op => op.id === "task.activity.update");
if (taskActivityUpdateOperation) {
  taskActivityUpdateOperation.fields = taskActivityUpdateOperation.fields.map(field => {
    if (field.key !== "note") return field;
    const { requiredWhen: _requiredWhen, ...optionalNote } = field;
    return { ...optionalNote, required: false, systemRequired: false };
  });
  taskActivityUpdateOperation.description = "Báo cáo tiến độ theo tên công việc; có thể kèm ghi chú. Phiên bản hiện tại được lấy tự động và API vẫn kiểm tra quyền cập nhật. Cần xác nhận trước khi ghi.";
}
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
const productUnitCreateBase = operations.find(op => op.method === "POST" && op.path === "/inventory/catalog/resources/:kind");
if (productUnitCreateBase) {
  const unitFieldKeys = new Set(["name", "code", "status", "symbol", "category", "decimalPlaces"]);
  operations.push({
    ...productUnitCreateBase,
    id: "inventory.catalog.unit.create",
    title: "Tạo đơn vị tính",
    description: "Tạo đơn vị tính dùng chung cho sản phẩm. Cần tên và nhóm đo lường; mã tự sinh, ký hiệu tùy chọn, số chữ số thập phân mặc định là 0. Cần xác nhận trước khi tạo.",
    fixedPathValues: { kind: "units" },
    fields: productUnitCreateBase.fields
      .filter(field => field.source === "body" && unitFieldKeys.has(field.apiKey || field.key))
      .map(field => field.apiKey === "category" ? { ...field, required: true, systemRequired: true, requiredWhen: undefined } : field),
    resultFields: ["code", "name", "symbol", "category", "decimalPlaces", "status"],
  });
}
const retailPartnerCreateBase = operations.find(op => op.id === "retail.partner.create");
if (retailPartnerCreateBase) {
  operations.splice(operations.indexOf(retailPartnerCreateBase), 1);
  const relationRoleByApiKey: Record<string, string> = { userId: "collaborator", customerId: "dealer", supplierId: "supplier" };
  const retailPartnerRoles = [
    { role: "collaborator", title: "Tạo cộng tác viên bán lẻ", relation: "userId", relationLabel: "tài khoản cộng tác viên" },
    { role: "dealer", title: "Tạo đại lý bán lẻ", relation: "customerId", relationLabel: "khách hàng liên kết" },
    { role: "supplier", title: "Tạo nhà cung cấp bán lẻ", relation: "supplierId", relationLabel: "nhà cung cấp đã khai báo trong Đối tác bán lẻ" },
  ] as const;
  operations.push(...retailPartnerRoles.map(({ role, title, relation, relationLabel }) => ({
    ...retailPartnerCreateBase,
    id: `retail.partner.create.${role}`,
    title,
    description: `${title}; cần mã và tên. Có thể liên kết ${relationLabel} đã có nếu cần. Trạng thái mặc định là active. Cần xác nhận trước khi lưu.`,
    fixedBodyValues: { ...(retailPartnerCreateBase.fixedBodyValues || {}), role },
    fields: retailPartnerCreateBase.fields.filter(field => {
      if (field.key === "partnerType" || field.apiKey === "role") return false;
      const linkedRole = relationRoleByApiKey[field.apiKey || field.key];
      return !linkedRole || linkedRole === role && (field.apiKey || field.key) === relation;
    }),
  })));
}
operations.push({
  id: "retail.coupon.create",
  title: "Tạo mã ưu đãi",
  description: "Tạo mã ưu đãi bán lẻ tại chi nhánh đã chọn. Cần mã, tên, đối tượng áp dụng, cách giảm, giá trị giảm và ngày giờ áp dụng. Đối tượng áp dụng phải được chọn rõ: tất cả khách hàng hoặc một khách hàng cụ thể; nếu chọn khách hàng cụ thể thì phải chọn hồ sơ theo tên. Có thể giới hạn thêm theo hạng khách hàng. Đơn tối thiểu mặc định là 0, mã được kích hoạt theo mặc định. Mã chỉ được lưu vào hệ thống, không tự gửi cho khách. Số tiền giảm phải là số nguyên VND dương; phần trăm từ 0 đến 100 và tối đa hai chữ số thập phân. Ngày kết thúc phải sau ngày bắt đầu. Xem lại thông tin rồi xác nhận trước khi tạo.",
  module: "retail",
  permissions: ["retail:manage"],
  permissionGroups: [["retail:manage"]],
  method: "POST",
  path: "/retail/coupons",
  assistantOnlyFields: ["targetType"],
  rawResponse: true,
  link: "/ban-le",
  confirmation: true,
  fields: [
    { key: "targetBranch", label: "Chi nhánh áp dụng", type: "reference", reference: "branch.list", required: false, systemRequired: false, source: "query", apiKey: "branchId" },
    { key: "code", label: "Mã ưu đãi (3–32 chữ cái không dấu, số, gạch ngang hoặc gạch dưới)", type: "text", required: true, systemRequired: true, max: 32, pattern: "^[A-Za-z0-9_-]{3,32}$", source: "body", apiKey: "code" },
    { key: "name", label: "Tên chương trình ưu đãi", type: "text", required: true, systemRequired: true, max: 120, source: "body", apiKey: "name" },
    { key: "targetType", label: "Đối tượng áp dụng ưu đãi", type: "text", required: true, systemRequired: true, options: ["all_customers", "specific_customer"] },
    { key: "customerId", label: "Khách hàng nhận mã riêng", type: "reference", reference: "customer.list", referenceValueKey: "id", requiredWhen: { field: "targetType", equals: "specific_customer" }, source: "body", apiKey: "customerId" },
    {
      key: "customerTierCodes",
      label: "Các hạng khách hàng được áp dụng",
      type: "json",
      source: "body",
      apiKey: "customerTierCodes",
      structure: {
        type: "array",
        maxItems: 10,
        items: { type: "string", reference: "retail.coupon.tier.list", referenceParentKey: "targetBranch", referenceValueKey: "code", label: "Hạng khách hàng" },
      },
    },
    { key: "discountType", label: "Cách giảm giá: số tiền hoặc phần trăm", type: "text", required: true, systemRequired: true, options: ["amount", "percent"], source: "body", apiKey: "discountType" },
    { key: "value", label: "Giá trị giảm (VND hoặc %, phần trăm tối đa 100)", type: "number", required: true, systemRequired: true, min: 0, exclusiveMin: true, source: "body", apiKey: "value" },
    { key: "minSubtotal", label: "Giá trị đơn hàng tối thiểu (VND)", type: "number", min: 0, integer: true, defaultValue: 0, source: "body", apiKey: "minSubtotal" },
    { key: "maxDiscount", label: "Mức giảm tối đa (VND, tùy chọn)", type: "number", min: 0, exclusiveMin: true, integer: true, source: "body", apiKey: "maxDiscount" },
    { key: "usageLimit", label: "Số lượt sử dụng tối đa (tùy chọn)", type: "number", min: 0, exclusiveMin: true, integer: true, source: "body", apiKey: "usageLimit" },
    { key: "startsAt", label: "Ngày giờ bắt đầu áp dụng", type: "datetime", required: true, systemRequired: true, source: "body", apiKey: "startsAt" },
    { key: "endsAt", label: "Ngày giờ kết thúc áp dụng", type: "datetime", required: true, systemRequired: true, source: "body", apiKey: "endsAt" },
    { key: "active", label: "Kích hoạt mã ưu đãi", type: "boolean", defaultValue: true, source: "body", apiKey: "active" },
  ],
  resultFields: ["code", "name", "customerName", "customerTierCodes", "discountType", "value", "minSubtotal", "maxDiscount", "startsAt", "endsAt", "usageLimit", "active"],
});
operations.push({
  id: "hr.workflow.list",
  title: "Tra cứu quy trình làm việc",
  description: "Liệt kê hoặc tìm quy trình làm việc trong doanh nghiệp theo tên. Quy trình này thuộc phân hệ Nhân sự, không phải các bước tuyển dụng.",
  module: "hr",
  permissions: ["hr:read", "hr:manage"],
  permissionGroups: [["hr:read", "hr:manage"]],
  method: "GET",
  path: "/crud/workflows",
  adapter: "contract",
  link: "/nhan-su",
  fields: [
    { ...text("search", "Tên quy trình làm việc"), source: "query", apiKey: "search" },
    { ...number("page", "Trang", 1), min: 1, source: "query", apiKey: "page" },
    { ...number("limit", "Số kết quả", 100), min: 1, max: 100, source: "query", apiKey: "limit" },
  ],
  resultFields: ["name", "category", "description", "stepsCount"],
});
operations.push({
  id: "hr.workflow.create",
  title: "Tạo quy trình làm việc",
  description: "Tạo quy trình làm việc trong phân hệ Nhân sự. Cần tên quy trình và ít nhất một bước có tên. Mô tả, nhóm quy trình, số ngày dự kiến, kết quả bàn giao và ghi chú có thể bổ sung nếu người dùng nêu. Người phụ trách có thể gán trong màn hình sau khi tạo. Đây là quy trình phân công công việc, không phải các bước tuyển dụng. Luôn xem trước và xin xác nhận trước khi lưu.",
  module: "hr",
  permissions: ["hr:manage"],
  method: "POST",
  path: "/crud/workflows",
  adapter: "contract",
  link: "/nhan-su",
  confirmation: true,
  fields: [
    { ...text("name", "Tên quy trình làm việc", true), max: 120, source: "body", apiKey: "name" },
    { ...text("category", "Nhóm quy trình"), max: 100, source: "body", apiKey: "category" },
    { ...text("description", "Mô tả quy trình"), max: 2000, source: "body", apiKey: "description" },
    {
      ...structured("steps", "Các bước quy trình", {
        type: "array",
        minItems: 1,
        maxItems: 30,
        items: {
          type: "object",
          keys: {
            title: { type: "string", required: true, label: "Tên bước" },
            description: { type: "string", label: "Mô tả bước" },
            estDays: { type: "number", min: 0, max: 365, label: "Số ngày dự kiến" },
            deliverable: { type: "string", label: "Kết quả bàn giao" },
            note: { type: "string", label: "Ghi chú" },
          },
        },
      }, true),
      source: "body",
      apiKey: "steps",
    },
  ],
  resultFields: ["name", "category", "description"],
});
operations.push({
  id: "hr.workflow.update",
  title: "Cập nhật quy trình làm việc",
  description: "Cập nhật quy trình làm việc đã chọn trong phân hệ Nhân sự. Chỉ đổi những thông tin người dùng yêu cầu. Nếu thay đổi các bước, cần thu thập đầy đủ danh sách bước theo thứ tự để giữ đúng nội dung; luôn xem trước và xin xác nhận trước khi lưu.",
  module: "hr",
  permissions: ["hr:manage"],
  method: "PATCH",
  path: "/crud/workflows/:id",
  adapter: "contract",
  link: "/nhan-su",
  confirmation: true,
  fields: [
    { ...ref("path_id", "Tên hoặc mã quy trình làm việc", "hr.workflow.list"), source: "path", apiKey: "id" },
    { ...text("name", "Tên quy trình mới"), max: 120, source: "body", apiKey: "name" },
    { ...text("category", "Nhóm quy trình"), max: 50, source: "body", apiKey: "category" },
    { ...text("description", "Mô tả quy trình"), max: 2000, source: "body", apiKey: "description" },
    {
      ...structured("steps", "Danh sách đầy đủ các bước mới theo thứ tự", {
        type: "array",
        minItems: 1,
        maxItems: 30,
        items: {
          type: "object",
          keys: {
            existingTitle: { type: "string", label: "Tên bước hiện tại nếu đổi tên hoặc giữ nguyên chi tiết" },
            existingStepNumber: { type: "number", integer: true, min: 1, max: 30, label: "Vị trí bước hiện tại nếu tên bước bị trùng" },
            title: { type: "string", required: true, label: "Tên bước sau cập nhật" },
            description: { type: "string", label: "Mô tả bước" },
            estDays: { type: "number", min: 0, max: 365, label: "Số ngày dự kiến" },
            deliverable: { type: "string", label: "Kết quả bàn giao" },
            note: { type: "string", label: "Ghi chú" },
          },
        },
      }),
      source: "body",
      apiKey: "steps",
    },
    { ...choice("workflowAction", "Thao tác quy trình", ["Thêm bước", "Gỡ bước", "Thêm giai đoạn con"]), source: "query", apiKey: "workflowAction" },
    { ...text("workflowTarget", "Bước hiện có"), source: "query", apiKey: "workflowTarget" },
    { ...text("workflowValue", "Tên bước hoặc giai đoạn con"), source: "query", apiKey: "workflowValue" },
  ],
  assistantOnlyFields: ["workflowAction", "workflowTarget", "workflowValue"],
  resultFields: ["name", "category", "description"],
});
operations.push({
  id: "hr.workflow.delete",
  title: "Xóa quy trình làm việc",
  description: "Xóa quy trình làm việc đã chọn trong phân hệ Nhân sự. Chọn đúng tên quy trình và xác nhận trước khi xóa.",
  module: "hr",
  permissions: ["hr:manage"],
  method: "DELETE",
  path: "/crud/workflows/:id",
  adapter: "contract",
  link: "/nhan-su",
  confirmation: true,
  fields: [
    { ...ref("path_id", "Tên hoặc mã quy trình làm việc cần xóa", "hr.workflow.list"), source: "path", apiKey: "id" },
  ],
  resultFields: ["name"],
});
const retailInvoiceListOperation = operations.find(op => op.method === "GET" && op.path === "/retail/invoices");
if (retailInvoiceListOperation) Object.assign(retailInvoiceListOperation, {
  id: "retail.invoice.list",
  title: "Tra cứu hóa đơn bán lẻ",
  description: "Tìm hóa đơn theo số hóa đơn, mã đơn hoặc tên khách hàng; có thể lọc theo trạng thái và ngày phát hành trong chi nhánh được cấp quyền.",
  permissionGroups: [["retail:read"], ["retail:manage"]],
  rawResponse: true,
  fields: [
    queryField(ref("targetBranch", "Chi nhánh bán lẻ", "branch.list", false), "branchId"),
    queryField({ ...text("search", "Số hóa đơn, mã đơn hoặc tên khách hàng"), max: 100 }, "q"),
    queryField(choice("status", "Trạng thái hóa đơn", ["issued", "void"])),
    queryField(date("from", "Từ ngày phát hành")),
    queryField(date("to", "Đến ngày phát hành")),
    queryField({ ...number("page", "Trang", 1), min: 1, max: 10000 }, "page"),
    queryField({ ...number("limit", "Số kết quả", 100), min: 1, max: 100 }, "limit"),
  ],
  resultFields: ["invoiceNo", "orderCode", "customerName", "status", "issuedAt", "grandTotal", "paymentStatus", "paidAmount", "dueAmount"],
});
const retailReportSummaryOperation = operations.find(op => op.method === "GET" && op.path === "/retail/reports/summary");
if (retailReportSummaryOperation) Object.assign(retailReportSummaryOperation, {
  id: "retail.report.summary",
  title: "Tổng hợp doanh số bán lẻ",
  fields: [
    queryField(ref("targetBranch", "Chi nhánh bán lẻ", "branch.list", false), "branchId"),
    queryField(date("from", "Từ ngày")),
    queryField(date("to", "Đến ngày")),
    queryField(choice("preset", "Khoảng thời gian", ["7d", "30d"])),
  ],
  resultFields: ["range", "summary", "paymentMix", "timeSeries", "products"],
  resultChildFields:{summary:['grossSales','refunds','netSales','orderCount','averageOrderValue','collectedAmount','dueAmount','totalCost','grossProfit','grossMarginPercent']},
  precomputedMeasures:{'summary.orderCount':{operation:'count',label:'Số đơn hàng'},'summary.netSales':{operation:'sum',label:'Doanh thu sau hoàn'},'summary.grossSales':{operation:'sum',label:'Doanh số trước hoàn'}},
});
const retailInvoiceDetailOperation = operations.find(op => op.method === "GET" && op.path === "/retail/invoices/:id");
if (retailInvoiceDetailOperation) Object.assign(retailInvoiceDetailOperation, {
  id: "retail.invoice.detail",
  title: "Xem chi tiết hóa đơn bán lẻ",
  description: "Xem hóa đơn theo số hóa đơn đã chọn, gồm khách hàng, ngày phát hành, sản phẩm, tổng tiền, thanh toán và công nợ còn lại; không hiển thị thông tin định danh nội bộ.",
  rawResponse: true,
  fields: retailInvoiceDetailOperation.fields.map(field => field.source === "path" && field.apiKey === "id"
    ? { ...field, key: "path_id", label: "Số hóa đơn cần xem", reference: "retail.invoice.list", referenceValueKey: "id" }
    : field),
  resultFields: ["invoiceNo", "orderCode", "status", "issuedAt", "snapshot"],
});
const retailOrderListOperation = operations.find(op => op.method === "GET" && op.path === "/retail/orders");
if (retailOrderListOperation) Object.assign(retailOrderListOperation, {
  title: "Tra cứu đơn bán lẻ",
  description: "Tìm đơn hàng theo mã, tên hoặc số điện thoại khách hàng, trạng thái đơn, trạng thái thanh toán hoặc khoảng ngày trong chi nhánh đã chọn.",
  resultFields: ["orderCode", "customerName", "status", "paymentStatus", "grandTotal", "paidAmount", "refundedAmount", "dueAmount", "businessDate", "createdAt"],
});
const retailOrderDetailOperation = operations.find(op => op.method === "GET" && op.path === "/retail/orders/:id");
if (retailOrderDetailOperation) Object.assign(retailOrderDetailOperation, {
  title: "Xem chi tiết đơn bán lẻ",
  description: "Xem sản phẩm, số lượng, giá, thanh toán và công nợ của đơn đã chọn; không hiển thị số điện thoại hay phiên bản kỹ thuật.",
  rawResponse: true,
  resultFields: ["orderCode", "customerName", "status", "paymentStatus", "grandTotal", "paidAmount", "refundedAmount", "dueAmount", "businessDate", "createdAt", "items", "payments"],
});
const studentResourceDetailOperation = operations.find(op => op.method === "GET" && op.path === "/student-resources/:id");
if (studentResourceDetailOperation) operations.push({
  ...studentResourceDetailOperation,
  id: "student.resource.bookings.list",
  title: "Tra cứu lịch đặt phòng học hoặc tài nguyên",
  description: "Liệt kê các lịch đặt của tài nguyên đã chọn theo mục đích, người đăng ký, ngày và giờ để xem hoặc chọn đúng lịch cần hủy.",
  resultFields: ["purpose", "by", "date", "startTime", "endTime"],
  rawResponse: false,
});
operations.push({
  id: "retail.invoice.summary",
  title: "Tổng hợp hóa đơn bán lẻ",
  description: "Tổng hợp số hóa đơn, hóa đơn đang phát hành/đã hủy, giá trị, số đã thanh toán và còn nợ theo khoảng ngày trong chi nhánh đã chọn. Mặc định xem hôm nay; có thể chọn 7 hoặc 30 ngày gần đây, hoặc nêu ngày bắt đầu và kết thúc.",
  module: "retail",
  permissions: ["retail:read", "retail:manage"],
  permissionGroups: [["retail:read"], ["retail:manage"]],
  method: "GET",
  path: "/retail/invoices/summary",
  rawResponse: true,
  confirmation: false,
  link: "/ban-le",
  fields: [
    queryField(ref("targetBranch", "Chi nhánh bán lẻ", "branch.list", false), "branchId"),
    queryField(date("from", "Từ ngày")),
    queryField(date("to", "Đến ngày")),
    queryField(choice("preset", "Khoảng thời gian", ["7d", "30d"])),
    queryField({ ...text("search", "Số hóa đơn, mã đơn hoặc tên khách hàng"), max: 100 }, "q"),
    queryField(choice("status", "Trạng thái hóa đơn", ["issued", "void"])),
  ],
  resultFields: ["range", "invoiceCount", "issuedCount", "voidCount", "issuedAmount", "voidAmount", "paidAmount", "dueAmount"],
});

const hrContractLookup = operations.find(op => op.id === "api.get.0c557a74cbc907f9");
if (hrContractLookup) operations.push({
  ...hrContractLookup,
  id: "hr.contract.missing.list",
  title: "Báo cáo nhân sự chưa có hợp đồng hiệu lực",
  description: "Liệt kê nhân sự trong phạm vi công ty hoặc chi nhánh hiện tại chưa có hợp đồng đang hiệu lực. Báo cáo này không xác minh hồ sơ có thiếu chữ ký, tệp đính kèm hay trường dữ liệu hay không.",
  fields: [],
  resultFields: ["withoutContractCount", "withoutContractEmployees"],
  resultChildFields: { withoutContractEmployees: ["name"] },
  readOnly: true,
});

const attendanceRecordsLookup = operations.find(op => op.id === "timekeeping.records.list");
if (attendanceRecordsLookup) {
  operations.push(
    { ...attendanceRecordsLookup, id: "timekeeping.records.overview", title: "Báo cáo tổng quan chấm công hôm nay" },
    { ...attendanceRecordsLookup, id: "timekeeping.records.late", title: "Báo cáo nhân sự đi muộn hôm nay" },
    { ...attendanceRecordsLookup, id: "timekeeping.records.absent", title: "Báo cáo nhân sự vắng hôm nay" },
    { ...attendanceRecordsLookup, id: "timekeeping.records.unrecorded", title: "Báo cáo nhân sự chưa chấm công hôm nay" },
    { ...attendanceRecordsLookup, id: "timekeeping.records.leave", title: "Báo cáo nhân sự nghỉ phép hôm nay" },
  );
  const monthlyFields = [
    queryField({ ...number("month", "Tháng"), min: 1, max: 12, integer: true }),
    queryField({ ...number("year", "Năm"), min: 2000, max: 2200, integer: true }),
  ];
  const monthlyReport = {
    ...attendanceRecordsLookup,
    path: "/timekeeping/monthly-report",
    fields: monthlyFields,
    resultFields: ["year", "month", "records"],
    resultChildFields: { records: ["employeeName", "workedDays", "absentDays", "leaveDays", "daysOff", "lateDays", "leftEarlyDays", "unrecordedDays"] },
    readOnly: true,
  };
  operations.push(
    { ...monthlyReport, id: "timekeeping.records.monthly.overview", title: "Tổng hợp chấm công theo tháng", description: "Tổng hợp công đã làm, ngày vắng, ngày nghỉ phép và lượt đi muộn/về sớm theo tháng. Phạm vi công ty và chi nhánh luôn lấy từ tài khoản đang đăng nhập." },
    {
      ...monthlyReport,
      id: "timekeeping.records.monthly.under-threshold",
      title: "Nhân sự chưa đủ ngưỡng công trong tháng",
      description: "Liệt kê nhân sự có số công đã làm thấp hơn ngưỡng được hỏi trong tháng. Công nửa ngày tính 0,5; ngày nghỉ phép được tách riêng khỏi công đã làm.",
      fields: [...monthlyFields, queryField({ ...number("thresholdDays", "Ngưỡng ngày công"), max: 31, required: true, systemRequired: true })],
      assistantOnlyFields: ["thresholdDays"],
      resultFields: ["year", "month", "records", "thresholdDays"],
    },
    { ...monthlyReport, id: "timekeeping.records.monthly.most-absent", title: "Nhân sự nghỉ nhiều nhất trong tháng", description: "Tìm nhân sự có tổng ngày vắng và nghỉ phép được ghi nhận cao nhất trong tháng; hiển thị riêng ngày vắng và ngày nghỉ phép." },
    { ...monthlyReport, id: "timekeeping.records.monthly.most-late", title: "Thống kê lượt đi làm trễ trong tháng", description: "Liệt kê nhân sự có ít nhất một ngày đi muộn trong tháng, sắp xếp theo số lượt đi muộn giảm dần." },
    { ...monthlyReport, id: "timekeeping.records.monthly.most-leave", title: "Nhân sự nghỉ phép nhiều nhất trong tháng", description: "Tìm nhân sự có số ngày nghỉ phép được ghi nhận cao nhất trong tháng." },
    { ...monthlyReport, id: "timekeeping.records.monthly.leave-summary", title: "Tổng hợp tất cả nhân sự nghỉ phép trong tháng", description: "Liệt kê mọi nhân sự có ngày nghỉ phép trong tháng cùng số ngày nghỉ; không chỉ lấy người nghỉ nhiều nhất. Dùng cho tổng hợp danh sách nhân sự nghỉ phép tháng này/tháng trước." },
    { ...monthlyReport, id: "timekeeping.records.monthly.unrecorded", title: "Nhân sự chưa chấm công trong tháng", description: "Liệt kê nhân sự có ngày làm việc theo lịch công ty nhưng chưa có bản ghi chấm công trong tháng; chỉ tính đến ngày hiện tại đối với tháng đang diễn ra." },
  );
}

const monthlyKpiLookup = operations.find(op => op.method === "GET" && op.path === "/kanban/kpi/monthly");
if (monthlyKpiLookup) operations.push({
  ...monthlyKpiLookup,
  id: "task.kpi.monthly",
  title: "Báo cáo KPI công việc theo tháng",
  description: "Tổng hợp tỷ lệ hoàn thành KPI theo nhân sự trong tháng được chọn; có thể lọc người dưới 100% hoặc đúng 100%.",
  fields: [
    queryField({ ...text("period", "Tháng KPI theo định dạng YYYY-MM"), max: 7 }),
    queryField(choice("completionFilter", "Lọc theo tỷ lệ hoàn thành", ["below-100", "exactly-100"])),
  ],
  assistantOnlyFields: ["completionFilter"],
  resultFields: ["periodKey", "periodStatus", "rows"],
  resultChildFields: { rows: ["employeeName", "totalTasks", "completedTasks", "pendingTasks", "percent"] },
  readOnly: true,
});

operations.push({
  id: "hr.leave.applications.list",
  title: "Tra cứu đơn nghỉ phép và làm việc từ xa",
  description: "Tra cứu đơn nghỉ phép/làm online giao với khoảng ngày nghỉ (rangeStart/rangeEnd). Đơn mới gửi/nộp trong ngày: dùng createdFrom/createdTo theo ngày Việt Nam, không thay bằng ngày nghỉ. Có đơn nghỉ phép hôm nay không: reportKind=requests, requestKind=leave. Tổng hợp tất cả người nghỉ phép: leave-summary; chỉ khi hỏi ai nghỉ nhiều nhất mới dùng leave-most. Ai làm online/từ xa nhiều nhất: wfh-most và requestKind=wfh. Nhân viên chỉ xem đơn của mình; API kiểm soát quyền xem toàn bộ.",
  module: "hr",
  permissions: ["hr:read", "timekeeping:read"],
  permissionGroups: [["hr:read"], ["timekeeping:read"]],
  method: "GET",
  path: "/crud/hr-leave-applications",
  adapter: "contract",
  link: "/nhan-su",
  fields: [
    queryField(date("rangeStart", "Từ ngày"), "rangeStart"),
    queryField(date("rangeEnd", "Đến ngày"), "rangeEnd"),
    queryField(date("createdFrom", "Gửi đơn từ ngày")),
    queryField(date("createdTo", "Gửi đơn đến ngày")),
    queryField(choice("requestKind", "Loại yêu cầu", ["leave", "wfh", "event", "exception"])),
    queryField(choice("status", "Trạng thái đơn", ["pending", "approved", "rejected"])),
    queryField(choice("reportKind", "Kiểu báo cáo", ["requests", "leave-summary", "leave-most", "wfh-most"], "requests")),
    queryField(text("employeeName", "Tên nhân sự")),
    queryField({ ...number("page", "Trang", 1), min: 1 }),
    queryField({ ...number("limit", "Số kết quả", 100), min: 1, max: 100 }),
  ],
  assistantOnlyFields: ["reportKind"],
  resultFields: ["reportKind", "requests", "maximumDays", "leaders"],
  resultChildFields: {
    requests: ["employeeName", "type", "requestKind", "startDate", "endDate", "createdAt", "reason", "status", "chargeableDays"],
    leaders: ["employeeName", "days", "requests"],
  },
  readOnly: true,
});

operations.push({
  id: "hr.calendar.events.list",
  title: "Tra cứu sự kiện nội bộ và lịch hôm nay",
  description: "Tra cứu sự kiện, cuộc họp và nhắc việc giao với khoảng ngày được chọn trong phạm vi công ty và chi nhánh hiện tại.",
  module: "hr",
  permissions: ["hr:read", "timekeeping:read"],
  permissionGroups: [["hr:read"], ["timekeeping:read"]],
  method: "GET",
  path: "/crud/hr-calendar-events",
  adapter: "contract",
  link: "/nhan-su",
  fields: [
    queryRef("branchId", "Chi nhánh lịch", "branch.list", false),
    queryField(date("rangeStart", "Từ ngày"), "rangeStart"),
    queryField(date("rangeEnd", "Đến ngày"), "rangeEnd"),
    queryField(choice("type", "Loại lịch", ["event", "meeting", "reminder"])),
    queryField({ ...number("page", "Trang", 1), min: 1 }),
    queryField({ ...number("limit", "Số kết quả", 100), min: 1, max: 100 }),
  ],
  resultFields: ["title", "type", "startDate", "endDate", "status", "location", "description", "participantNames"],
  readOnly: true,
});

operations.push({
  id: "hr.calendar.event.create",
  title: "Tạo sự kiện nội bộ",
  description: "Tạo sự kiện, cuộc họp hoặc nhắc việc trong lịch nhân sự. Cần tiêu đề và thời gian; luôn xem trước và xin xác nhận trước khi lưu.",
  module: "hr",
  permissions: ["hr:manage", "timekeeping:manage"],
  permissionGroups: [["hr:manage"], ["timekeeping:manage"]],
  method: "POST",
  path: "/crud/hr-calendar-events",
  adapter: "contract",
  link: "/nhan-su",
  confirmation: true,
  fixedBodyValues: { status: "approved" },
  systemBodyFields: ["creatorId"],
  fields: [
    queryRef("branchId", "Chi nhánh lịch", "branch.list", false),
    { ...text("title", "Tiêu đề sự kiện", true), max: 200, source: "body", apiKey: "title" },
    { ...choice("type", "Loại lịch", ["event", "meeting", "reminder"], "event"), source: "body", apiKey: "type" },
    { ...text("startDate", "Bắt đầu", true), type: "datetime", source: "body", apiKey: "startDate" },
    { ...text("endDate", "Kết thúc", true), type: "datetime", source: "body", apiKey: "endDate" },
    { ...text("description", "Mô tả"), max: 2000, source: "body", apiKey: "description" },
    { ...text("location", "Địa điểm"), max: 300, source: "body", apiKey: "location" },
    { ...text("meetingLink", "Liên kết họp"), max: 1000, source: "body", apiKey: "meetingLink" },
  ],
  resultFields: ["title", "type", "startDate", "endDate", "status", "location"],
  completionUpdateId: "hr.calendar.event.update",
});

operations.push({
  id: "hr.calendar.event.update",
  title: "Cập nhật sự kiện nội bộ",
  description: "Cập nhật thông tin của sự kiện đã chọn; API kiểm tra quyền của người tạo hoặc quản lý. Cần xác nhận trước khi lưu.",
  module: "hr",
  permissions: ["hr:manage", "timekeeping:manage"],
  permissionGroups: [["hr:manage"], ["timekeeping:manage"]],
  method: "PATCH",
  path: "/crud/hr-calendar-events/:id",
  adapter: "contract",
  link: "/nhan-su",
  confirmation: true,
  fields: [
    queryRef("branchId", "Chi nhánh lịch", "branch.list", false),
    { ...ref("id", "Sự kiện cần cập nhật", "hr.calendar.events.list"), source: "path", apiKey: "id" },
    { ...text("title", "Tiêu đề sự kiện"), max: 200, source: "body", apiKey: "title" },
    { ...choice("type", "Loại lịch", ["event", "meeting", "reminder"]), source: "body", apiKey: "type" },
    { ...text("startDate", "Bắt đầu"), type: "datetime", source: "body", apiKey: "startDate" },
    { ...text("endDate", "Kết thúc"), type: "datetime", source: "body", apiKey: "endDate" },
    { ...text("description", "Mô tả"), max: 2000, source: "body", apiKey: "description" },
    { ...text("location", "Địa điểm"), max: 300, source: "body", apiKey: "location" },
    { ...text("meetingLink", "Liên kết họp"), max: 1000, source: "body", apiKey: "meetingLink" },
  ],
  resultFields: ["title", "type", "startDate", "endDate", "status", "location"],
});

const reportYearField = () => queryField({ ...number("year", "Năm"), min: 2000, max: 2200, integer: true });
const leaveBalanceReport = {
  id: "leave.balances.list",
  title: "Thống kê số phép năm còn lại của nhân sự",
  description: "Xem số phép năm được hưởng, đã dùng, đang chờ duyệt và còn lại của nhân sự trong phạm vi công ty hoặc chi nhánh được cấp quyền.",
  module: "hr" as ModuleKey,
  adapter: "contract" as const,
  permissions: ["hr:read", "access:read", "timekeeping:read"],
  permissionGroups: [["hr:read"], ["access:read"], ["timekeeping:read"]],
  method: "GET" as const,
  path: "/leave/balances",
  link: "/nhan-su",
  fields: [reportYearField()],
  resultFields: ["year", "balances"],
  resultChildFields: { balances: ["employeeName", "department", "entitlement", "used", "pending", "unexcused", "remaining"] },
  readOnly: true,
};
operations.push(
  leaveBalanceReport,
  {
    ...leaveBalanceReport,
    id: "leave.balances.minimum",
    title: "Nhân sự còn ít nhất số ngày phép được yêu cầu",
    description: "Liệt kê nhân sự có số phép năm còn lại bằng hoặc cao hơn ngưỡng được yêu cầu trong phạm vi được cấp quyền.",
    fields: [...leaveBalanceReport.fields, queryField({ ...number("thresholdDays", "Ngưỡng ngày phép"), max: 365, required: true, systemRequired: true })],
    assistantOnlyFields: ["thresholdDays"],
    resultFields: ["year", "balances", "thresholdDays"],
  },
  { ...leaveBalanceReport, id: "leave.balances.exhausted", title: "Nhân sự đã hết phép năm", description: "Liệt kê nhân sự có phép năm được hưởng nhưng số ngày còn lại bằng không trong phạm vi công ty hoặc chi nhánh được cấp quyền." },
);

const workCalendarLookup = operations.find(op => op.id === "timekeeping.work-calendar.list");
if (workCalendarLookup) operations.push({
  ...workCalendarLookup,
  id: "timekeeping.work-calendar.month-holidays",
  title: "Ngày nghỉ trong tháng",
  description: "Liệt kê ngày lễ và ngày nghỉ bù đã áp dụng trong tháng được hỏi; không trả cả lịch của năm.",
  fields: [
    queryField({ ...number("year", "Năm"), min: 2000, max: 2200, integer: true }),
    queryField({ ...number("month", "Tháng"), min: 1, max: 12, integer: true }),
    queryField(choice("appliedOnly", "Chỉ ngày đang áp dụng", ["true", "false"])),
    queryField(choice("holidaysOnly", "Chỉ ngày lễ/nghỉ bù", ["true", "false"])),
  ],
  resultFields: ["date", "name", "dayTypeLabel", "isApplied"],
  readOnly: true,
});
if (workCalendarLookup) operations.push({
  ...workCalendarLookup,
  id: "timekeeping.work-calendar.named-holiday",
  title: "Tra cứu ngày nghỉ theo tên",
  description: "Tìm ngày nghỉ hoặc ngày đặc biệt theo tên trong lịch làm việc của công ty; chỉ hiển thị những mục đã được lưu trong lịch công ty.",
  fields: [
    queryField({ ...number("year", "Năm"), min: 2000, max: 2200, integer: true }),
    queryField({ ...text("eventName", "Tên ngày nghỉ cần tra cứu"), max: 200 }),
  ],
  resultFields: ["date", "name", "dayTypeLabel", "isApplied"],
  readOnly: true,
});

const hrContractExpiringLookup = operations.find(op => op.id === "api.get.0c557a74cbc907f9");
if (hrContractExpiringLookup) operations.push({
  ...hrContractExpiringLookup,
  id: "hr.contract.expiring.list",
  title: "Báo cáo hợp đồng nhân sự sắp hết hạn",
  description: "Liệt kê hợp đồng nhân sự sắp hết hạn trong số ngày cảnh báo đã cài cho công ty hoặc khoảng ngày được yêu cầu. Chỉ hiển thị tên nhân sự, loại hợp đồng và ngày hết hạn.",
  resultFields: ["expiryAlerts", "expiryAlertTotal", "expiryAlertDays"],
  resultRowsField:'expiryAlerts',resultRowsTotalField:'expiryAlertTotal',resultRowsComplete:true,
  resultChildFields:{expiryAlerts:['employeeName','contractType','endDate','daysRemaining']},
  fields: [...hrContractExpiringLookup.fields, queryField({ ...text("query_contractType", "Loại hợp đồng cần lọc"), max: 100 }, "contractType")],
  readOnly: true,
});

const hrContractList = operations.find(op => op.id === "api.get.0c557a74cbc907f9");
if (hrContractList) operations.push({
  ...hrContractList,
  id: "hr.contract.list",
  title: "Tra cứu hợp đồng nhân sự để chọn hợp đồng cần gia hạn",
  description: "Tìm hợp đồng theo tên nhân sự để chọn đúng hợp đồng cần gia hạn. Chỉ hiển thị tên nhân sự, loại hợp đồng, ngày bắt đầu, ngày hết hạn và trạng thái.",
  resultFields: ["contracts"],
  resultChildFields: { contracts: ["employeeName", "contractType", "startDate", "endDate", "status"] },
  readOnly: true,
});

const hrContractExtend = operations.find(op => op.id === "api.post.8dad6fff5226b63c");
if (hrContractExtend) operations.push({
  ...hrContractExtend,
  id: "hr.contract.extend",
  currentDateDefaults: ["extensionDate"],
  title: "Gia hạn hợp đồng nhân sự",
  description: "Gia hạn hợp đồng của đúng nhân sự đã chọn tới ngày kết thúc mới. Ngày ghi nhận gia hạn mặc định là hôm nay; luôn xem trước và xác nhận trước khi lưu.",
  fields: hrContractExtend.fields.map(field => field.key === "path_id"
    ? { ...field, label: "Hợp đồng của nhân sự", reference: "hr.contract.list" }
    : field),
  confirmation: true,
  resultFields: ["employeeName", "previousEndDate", "newEndDate", "extensionDate"],
});

operations.push({
  id: "hr.training.incomplete.list",
  coverageAliases: ["Chưa hoàn thành bài học trong đào tạo nội bộ", "Chưa hoàn thành đào tạo nội bộ"],
  title: "Báo cáo tiến độ đào tạo nội bộ chưa hoàn thành",
  description: "Liệt kê nhân sự và khóa đào tạo có tiến độ chưa hoàn thành. Chỉ quản trị viên, quản lý và nhân sự được hệ thống xác định là cấp giám sát mới được xem tiến độ của người khác.",
  module: "hr",
  permissions: ["hr:read"],
  permissionGroups: [["hr:read"]],
  roles: ["superadmin", "admin", "manager"],
  method: "GET",
  path: "/crud/training-enrollments",
  link: "/nhan-su",
  fields: [queryField({ ...number("page", "Trang", 1), min: 1, max: 10000, integer: true }), queryField({ ...number("limit", "Số kết quả", 1000), min: 1, max: 1000, integer: true }), queryField({ ...text("courseName", "Tên khóa đào tạo cần lọc"), max: 160 })],
  resultFields: ["incompleteEnrollments", "incompleteTotal", "fetchedTotal", "overallTotal", "truncated", "courseName"],
  resultChildFields: { incompleteEnrollments: ["employeeName", "courseTitle", "progress", "status"] },
  readOnly: true,
});

const hrContractCreate = operations.find(op => op.id === "api.post.564251c483731a91");
if (hrContractCreate) operations.push({
  ...hrContractCreate,
  id: "hr.contract.create",
  title: "Tạo hợp đồng nhân sự",
  description: "Tạo hợp đồng cho nhân sự đã chọn. Cần loại hợp đồng và ngày bắt đầu, ngày kết thúc; nếu chưa nêu trạng thái thì lưu ở trạng thái bản nháp. Cần xác nhận trước khi lưu.",
  fields: hrContractCreate.fields.map(field => field.key === "employeeId"
    ? { ...field, label: "Nhân sự", reference: "employee.list" }
    : field.key === "status"
      ? { ...field, defaultValue: "draft" }
      : field),
  resultFields: ["employeeName", "contractType", "startDate", "endDate", "status"],
});

operations.push({
  id: "timekeeping.record.update",
  title: "Điều chỉnh dữ liệu chấm công",
  description: "Điều chỉnh giờ chấm công cho đúng nhân sự và ngày đã chọn. Nếu chưa có bản ghi trong ngày, hệ thống sẽ tạo một bản ghi điều chỉnh. Hệ thống lưu lý do, người sửa và lịch sử chỉnh sửa; không thể sửa khi kỳ công đã khóa hoặc đã tính lương. Cần xác nhận trước khi lưu.",
  module: "hr",
  permissions: ["timekeeping:manage", "payroll-period:manage"],
  permissionGroups: [["timekeeping:manage"], ["payroll-period:manage"]],
  method: "PATCH",
  path: "/timekeeping/records/adjust",
  link: "/nhan-su",
  adapter: "contract",
  confirmation: true,
  fields: [
    { ...ref("employeeId", "Nhân sự", "employee.list"), source: "body", apiKey: "employeeId" },
    { ...date("date", "Ngày chấm công", true), source: "body", apiKey: "date", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    { ...text("checkInTime", "Giờ vào mới (HH:MM)"), source: "body", apiKey: "checkInTime", pattern: "^(?:[01]?\\d|2[0-3]):[0-5]\\d$" },
    { ...text("checkOutTime", "Giờ ra mới (HH:MM)"), source: "body", apiKey: "checkOutTime", pattern: "^(?:[01]?\\d|2[0-3]):[0-5]\\d$" },
    { ...text("editReason", "Lý do điều chỉnh", true), source: "body", apiKey: "editReason", max: 500 },
  ],
  resultFields: ["date", "status", "checkInTime", "checkOutTime", "manuallyAdjusted", "adjustmentReason"],
});

const payrollSchedule = operations.find(op => op.id === "payroll.reconciliation.schedule.update");
if (payrollSchedule) {
  payrollSchedule.fields = payrollSchedule.fields.map(field => ({ ...field, required: false, systemRequired: false,
    ...(field.key === "day" ? { label: "Ngày phát hành hằng tháng" } : {}),
  }));
  payrollSchedule.fields.push({ ...choice("recurrence", "Xác nhận lịch lặp hằng tháng", ["monthly"]), required: true, systemRequired: true });
  payrollSchedule.assistantOnlyFields = [...(payrollSchedule.assistantOnlyFields || []), "recurrence"];
}
const payrollAdjustments = operations.find(op => op.id === "payroll.adjustment.list");
if (payrollAdjustments) {
  payrollAdjustments.fields.push(choice("status", "Trạng thái khoản điều chỉnh", ["draft", "pending", "approved", "rejected", "snapshotted"]));
  payrollAdjustments.assistantOnlyFields = [...(payrollAdjustments.assistantOnlyFields || []), "status"];
}
const payrollReconciliation = operations.find(op => op.id === "payroll.run.reconciliation.list");
if (payrollReconciliation) operations.push({
  ...payrollReconciliation,
  id: "payroll.run.complaints.list",
  title: "Tổng hợp khiếu nại bảng lương",
  description: "Tổng hợp khiếu nại lương tạm tính và yêu cầu kiểm tra phiếu lương đã phát hành trong lượt lương được chọn. Ngày gửi lương không thay thế kỳ và lượt lương; nếu chưa rõ thì hỏi người dùng chọn lượt.",
  fields: structuredClone(payrollReconciliation.fields),
  resultFields: ["employeeName", "periodKey", "source", "fieldLabel", "status", "message", "response", "createdAt"],
  resultChildFields: undefined,
});

const dailyAttendance = operations.find(op => op.id === "timekeeping.records.list");
operations.push({id:'worker.project.workers.list',title:'Tra cứu lao động được phân công trong dự án',description:'Danh sách lao động đang được phân công vào dự án/công trình đã chọn theo tên hoặc mã. Đây là danh sách phân công, không phải bằng chứng có mặt hoặc chấm công hôm nay.',module:'worker',permissions:['people:read'],permissionGroups:[['people:read','people:manage']],method:'GET',path:'/worker-management/projects/:id/workers',adapter:'contract',rawResponse:true,readOnly:true,link:'/quan-ly-lao-dong',
  functionAreas:[{key:'project',label:'Dự án và phân công lao động'}],fields:[{...ref('path_id','Tên hoặc mã dự án','worker.project.list'),source:'path',apiKey:'id'}],resultFields:['items'],resultRowsField:'items',resultChildFields:{items:['fullName','phone','laborType','status','projectName','projectCode']}});
const interviewList = operations.find(op => op.id === "recruitment.interview.list");
if (interviewList) interviewList.resultFields = ["applicantName", "jobTitle", "interviewers", ...interviewList.resultFields];
operations.push({
  id: "student.batch.attendance.summary", title: "Báo cáo điểm danh lớp học theo ngày", description: "Kiểm tra lớp/khóa học học viên hôm nay có đi đủ không; đếm có mặt, đi muộn, vắng, có phép và chưa ghi nhận. Cần chọn lớp theo tên hoặc mã; không thay bằng lịch học hoặc đào tạo nội bộ.",
  functionAreas: [{ key: 'attendance', label: 'Điểm danh học viên' }],
  module: "student", permissions: ["people:read"], method: "GET", path: "/batches/:id", adapter: "contract", rawResponse: true, readOnly: true, link: "/quan-ly-hoc-vien",
  fields: [{ ...ref("path_id", "Tên hoặc mã lớp", "batch.list"), source: "path", apiKey: "id" }, queryField(date("date", "Ngày điểm danh"))],
  resultFields: ["className", "courseTitle", "date", "total", "present", "late", "absent", "excused", "unrecorded", "note"],
});
operations.push({
  id: "hr.workflow.category.create", title: "Tạo nhãn phân loại quy trình", description: "Tạo nhãn/nhóm phân loại quy trình dùng chung trong doanh nghiệp. Chỉ cần tên nhãn, không tạo quy trình hoặc bước công việc.",
  module: "hr", permissions: ["hr:manage"], method: "POST", path: "/crud/workflow-categories", adapter: "contract", link: "/nhan-su", confirmation: true,
  fields: [{ ...text("name", "Tên nhãn phân loại", true), max: 50, source: "body", apiKey: "name" }], resultFields: ["name"],
});
if (dailyAttendance) operations.push({ ...dailyAttendance, id: "hr.daily.overview", title: "Báo cáo tình hình nhân sự hôm nay", description: "Tổng quan nhân sự trong ngày: danh sách nhân sự cùng trạng thái vào/ra ca, đi muộn, vắng, nghỉ phép và chưa chấm công trong chi nhánh. Dùng cho báo cáo tình hình nhân sự hoặc chấm công hôm nay; không dùng cho lao động trong dự án.", readOnly: true });
operations.push({
  id: "worker.report", title: "Báo cáo chấm công và thiếu lao động theo dự án", module: "worker", permissions: ["people:read", "people:manage"],
  description: "Báo cáo người lao động của một hoặc mọi dự án, gồm tổng quan chấm công, đi muộn, chưa chấm công/vắng, số ngày chưa chấm công vượt ngưỡng và dự án thiếu lao động so với định biên. Không phải chấm công nhân sự công ty. Không nêu dự án nghĩa là mọi dự án trong chi nhánh. Đếm số buổi cần khoảng ngày; không có bản ghi không đồng nghĩa đã xác nhận vắng.",
  method: "GET", path: "/worker-management/reports/assistant", link: "/quan-ly-lao-dong", adapter: "contract", rawResponse: true, readOnly: true,
  fields: [queryField(choice("mode", "Loại báo cáo", ["all", "late", "absent", "absence-threshold", "shortage"], "all")), queryField(ref("projectId", "Tên hoặc mã dự án", "worker.project.list", false)),
    queryField(date("date", "Ngày báo cáo")), queryField({ ...date("from", "Từ ngày"), requiredWhen: { field: "mode", equals: "absence-threshold" } }), queryField({ ...date("to", "Đến ngày"), requiredWhen: { field: "mode", equals: "absence-threshold" } }), queryField({ ...number("threshold", "Số buổi vượt quá"), integer: true, max: 366 })],
  resultFields: ["projectName", "workerName", "date", "attendanceStatus", "checkIn", "checkOut", "quota", "allocated", "gap", "from", "to", "absentDays", "note"],
});
const trainingIncomplete = operations.find(op => op.id === "hr.training.incomplete.list")!;
for (const operation of operations) {
  if(operation.method==='GET'&&operation.path==='/inventory/receiving/receipts')operation.unboundedTimeRead=true;
  if (operation.path === '/timekeeping/records' && operation.fields.some(field => field.key === 'query_date')) operation.currentDateDefaults = ['query_date'];
  if (operation.method === 'PATCH' && operation.path === '/auth/users/:id') operation.clearableFields = ['jobTitle'];
  if (operation.method === 'POST' && operation.path === '/hr-contracts/:id/extensions') operation.currentDateDefaults = ['extensionDate'];
  if (operation.id === 'department.lookup') operation.coverageAliases = ['Có bao nhiêu nhân sự', 'Số nhân sự của phòng ban'];
  if (operation.id === 'employee.birthday.next-month') operation.coverageAliases = ['Nhân sự có sinh nhật trong tháng tới'];
}
operations.push({ ...trainingIncomplete, coverageAliases: undefined, id: "hr.training.progress", title: "Báo cáo toàn bộ tiến độ đào tạo nội bộ", description: "Tiến độ học của từng nhân sự trong khóa đào tạo nội bộ, gồm cả chưa bắt đầu, đang học và đã hoàn thành. Khác với danh sách chỉ những người chưa hoàn thành. Không phải lịch học hoặc điểm danh học viên.", rawResponse: true, resultFields: ["employeeName", "courseTitle", "progress", "status"], resultChildFields: undefined });
const studentClassDetail = operations.find(op => op.id === 'student.batch.detail');
const legalRepositoryStatus=operations.find(op=>op.id==='legal.repository.status');
if(legalRepositoryStatus) legalRepositoryStatus.rawResponse=true;
const studentLookup=operations.find(op=>op.id==='student.list');
if(studentLookup) studentLookup.description+=' Trạng thái hồ sơ không phản ánh số tiền còn nợ học phí. Khi hỏi còn nợ/đã đóng đủ, dùng phép đối chiếu học phí với danh sách phiếu thu; không chỉ lọc status=Nợ học phí.';
if (studentClassDetail) {
  studentClassDetail.functionAreas = [{key:'schedule',label:'Lịch học'}];
  studentClassDetail.resultFields = [...new Set([...studentClassDetail.resultFields, 'daysOfWeek', 'startTime', 'endTime'])];
  studentClassDetail.description += ' Xem lịch học định kỳ của một lớp/khóa học: ngày trong tuần, giờ bắt đầu/kết thúc và khoảng ngày của lớp. Không phải báo cáo điểm danh hoặc lịch đào tạo nội bộ. Chọn đúng lớp theo tên hoặc mã; nếu nhiều lớp cùng khóa thì hỏi chọn lớp.';
}

operations.push(...HEALTHCARE_OPERATIONS);
operations.push(...QUOTATION_OPERATIONS);
const laborKpi = operations.find(op => op.method === "GET" && op.path === "/worker-management/partners/kpi");
if (laborKpi) {
  laborKpi.title = "Phân tích KPI và số lao động giới thiệu của đối tác";
  // The business validator requires an ISO calendar anchor. Reflect that
  // transport contract and the already documented current-month default.
  for(const field of laborKpi.fields)if((field.apiKey||field.key)==='periodAnchor'||field.key==='query_periodAnchor')field.type='date';
  laborKpi.currentDateDefaults=['query_periodAnchor'];
  laborKpi.analysis = { rowDimensions:["partnerName","partnerCode"], fields: {
    partnerName: { label: "Đối tác", type: "text" },
    partnerCode: { label: "Mã đối tác", type: "text" },
    targetReferrals: { label: "Chỉ tiêu", type: "number" },
    actualReferrals: { label: "Đã giới thiệu", type: "number", measureOperation:"count", aliases: ["lao động được giới thiệu", "số lao động giới thiệu", "số lao động được giới thiệu", "lao động giới thiệu", "lao động", "người được giới thiệu", "số người giới thiệu", "số lượt giới thiệu", "lượt giới thiệu", "giới thiệu"] },
    remainingReferrals: { label: "Còn thiếu", type: "number" },
    completionRate: { label: "Tỷ lệ đạt (%)", type: "number" },
    status: { label: "Trạng thái KPI", type: "text", values: { not_set: "Chưa thiết lập", achieved: "Đã đạt", incomplete: "Chưa đạt" },
      valueAliases: { incomplete:['thiếu KPI','chưa đạt KPI','chưa đủ KPI'], not_set:['chưa thiết lập KPI','chưa đặt KPI','chưa có chỉ tiêu KPI'], achieved:['đã đạt KPI','đạt đủ KPI'] } },
  } };
  laborKpi.fields.push({ key: "analysis", label: "Điều kiện phân tích", type: "json" });
  laborKpi.assistantOnlyFields = ["analysis"];
  laborKpi.description = `Tra cứu số lao động giới thiệu và KPI của TẤT CẢ đối tác trong một tháng, bao gồm đối tác 0 lao động. query_periodAnchor là ngày trong tháng cần xem. Nếu không nêu tháng, dùng tháng hiện tại theo giờ Việt Nam. status=not_set là chưa thiết lập KPI, không phải chưa đạt. analysis là JSON khai báo, không phải mã: filters:[{field,operator:eq|ne|gt|gte|lt|lte,value}], extreme:{field,direction:min|max} giữ tất cả đồng hạng, sort:{field,direction:asc|desc}, limit:1..1000, aggregate:{operation:count|sum|avg,field}, groupBy. Bộ lọc kết hợp AND. Không kết hợp aggregate với sort/extreme/limit. Trường cho phép: ${JSON.stringify(laborKpi.analysis.fields)}. Dùng phép phân tích phù hợp mọi yêu cầu tương tự, không thay bằng tổng quan tiền hoa hồng. Không hỗ trợ khoảng nhiều tháng trong một lần gọi, cần làm rõ kỳ nếu chưa xác định được.`;
}
for (const op of operations.filter(op => op.path === "/worker-management/partners/policies/:policyId" && op.method === "PATCH")) {
  op.partialUpdate = true;
  op.partialUpdateArrayKeys = { "official.milestones": "month" };
  op.partialUpdateArrayBounds = { "official.milestones": { itemField: "month", upperBound: "official.maxMonths" } };
  op.mergeBodyWithReference = true;
  op.description += " Chỉnh sửa từng phần cấu hình chính sách đã chọn. Chỉ trích xuất trường người dùng muốn đổi, kể cả thuộc tính lồng nhau như official.maxMonths (Số mốc tháng). Máy chủ đọc cấu hình hiện tại và giữ phần không đổi. Không điền lại các trường chưa được yêu cầu. official.milestones cập nhật từng mục theo khóa month, chỉ nêu month và thuộc tính cần sửa, giữ các mốc khác. Giảm maxMonths loại bỏ mốc vượt giới hạn, tăng maxMonths cần thu thập tiền và điều kiện cho các mốc mới. Các mảng khác là thay thế toàn bộ và phải có đủ nội dung. Không tự đoán số tiền hoặc điều kiện. Nếu chưa có tên chính sách, để trống path_policyId để người dùng chọn.";
}
const studentPartners = operations.find(op => op.id === "partner.list")!;
const fullyPaidCommissionAliases=['thanh toán đủ 100% hoa hồng','thanh toán 100% hoa hồng','thanh toán đủ hoa hồng','trả đủ hoa hồng'];
operations.push({ ...studentPartners, id: "partner.analysis", title: "Phân tích đối tác học viên", rawResponse: true,
  functionAreas:[{key:'partner-records',label:'Hồ sơ đối tác học viên'},{key:'partner-payouts',label:'Chi trả hoa hồng đối tác học viên'}],
  coverageAliases:['hiện tại có','hiện tại'],
  description: "Phân tích và tra cứu đối tác tuyển sinh: trạng thái hoạt động/tạm dừng, liên hệ, tài khoản ngân hàng, ghi chú, ngày tạo, số học viên giới thiệu, học phí và hoa hồng. createdFrom/createdTo lọc NGÀY TẠO ĐỐI TÁC mới. referralFrom/referralTo chỉ giới hạn số học viên và học phí theo NGÀY ĐĂNG KÝ của học viên được giới thiệu (không phải ngày tạo đối tác). Không có kỳ thì số học viên/học phí là lũy kế. Hoa hồng, đã trả, còn phải trả và cấp bậc luôn là LŨY KẾ, không hỗ trợ phân bổ các khoản này theo kỳ; hỏi lại nếu yêu cầu hoa hồng theo kỳ. Không tự tính hoa hồng; lấy nguyên API. Có thể đếm theo trạng thái bằng groupBy=isActive, aggregate=count; tính nhiều chỉ tiêu bằng aggregates trong một lần. bankConfigured=0 là chưa có số tài khoản, =1 là đã có. notes hỗ trợ contains. Dùng select chọn các cột người dùng cần, giữ name khi liệt kê hồ sơ. Không có KPI nếu chưa có ngưỡng. targetBranch chọn chi nhánh theo quyền, không dùng search để lọc chi nhánh. Tháng/tuần dùng lịch Việt Nam; tuần bắt đầu thứ Hai; truyền đầy đủ hai đầu khoảng ngày.",
  fields: [...studentPartners.fields, queryField(ref('targetBranch', 'Chi nhánh đối tác', 'branch.list', false), 'branchId'),
    ...['createdFrom','createdTo','referralFrom','referralTo'].map((key,index) => queryField(date(key, ['Ngày tạo đối tác từ','Ngày tạo đối tác đến','Ngày đăng ký học viên giới thiệu từ','Ngày đăng ký học viên giới thiệu đến'][index]))),
    queryField({ ...number("page", "Trang"), defaultValue: 1 }), queryField({ ...number("limit", "Số dòng mỗi trang"), defaultValue: 500 })],
  analysis: { scopeLabel: "lũy kế", rowDimensions:["name","code"], replaces:["partner.list"], displayFields:['name','isActive','referredStudentsCount','totalReferredTuition','totalCommission','totalPaid','unpaidBalance'], pagination: { pageField: "page", sizeField: "limit" }, fields: {
    name: { label: "Đối tác", type: "text" }, code:{label:"Mã đối tác",type:"text"}, levelName: { label: "Cấp bậc hoa hồng", type: "text" },
    isActive: {label:'Trạng thái',type:'text',values:{active:'Đang hoạt động',inactive:'Tạm dừng'},valueAliases:{active:['đang hoạt động'],inactive:['đang tạm dừng','tạm dừng','ngưng hoạt động']}},
    phone:{label:'Điện thoại',type:'text'},email:{label:'Email',type:'text'},
    bankName:{label:'Ngân hàng',type:'text'},bankAccountNo:{label:'Số tài khoản',type:'text',format:'bank-account'},bankAccountName:{label:'Chủ tài khoản',type:'text'},
    bankConfigured:{label:'Đã có tài khoản ngân hàng',type:'number',values:{'0':'Chưa cập nhật','1':'Đã cập nhật'},predicates:[{aliases:['chưa cập nhật tài khoản ngân hàng','chưa cập nhật tài khoản ngân hàng nhận hoa hồng','chưa có số tài khoản ngân hàng','chưa có tài khoản ngân hàng'],operator:'eq',value:0}]},
    notes:{label:'Ghi chú',type:'text',contains:true},createdAt:{label:'Ngày tạo đối tác',type:'text',format:'date'},
    referredStudentsCount: { label: "Học viên giới thiệu", type: "number", measureOperation:"count", aliases:['học viên giới thiệu','số học viên','học viên','đã giới thiệu được bao nhiêu học viên'], predicates:[{aliases:['đã giới thiệu học viên'],operator:'gt',value:0}] },
    totalReferredTuition: { label: "Tổng học phí (VND)", type: "number", measureOperation:"sum",aliases:['doanh số học phí','tổng học phí','học phí'],predicates:[{aliases:['chưa phát sinh học phí'],operator:'eq',value:0}] },
    totalCommission: { label: "Hoa hồng lũy kế (VND)", type: "number", measureOperation:"sum",aliases:['hoa hồng phát sinh','tổng hoa hồng','tổng hoa hồng phát sinh'],predicates:[{aliases:fullyPaidCommissionAliases,operator:'gt',value:0}] },
    totalPaid: { label: "Đã thanh toán lũy kế (VND)", type: "number", measureOperation:"sum",aliases:['đã thanh toán','đã trả','đã trả được bao nhiêu'] },
    unpaidBalance: { label: "Còn phải trả lũy kế (VND)", type: "number",aliases:['hoa hồng còn nợ','hoa hồng còn phải trả','số dư còn phải trả','còn nợ','còn phải trả'],predicates:[{aliases:fullyPaidCommissionAliases,operator:'lte',value:0}] },
  } }, resultFields: ["name", "code", "levelName", "isActive","phone","email","bankName","bankAccountNo","bankAccountName","bankConfigured","notes","createdAt","referredStudentsCount", "totalReferredTuition", "totalCommission", "totalPaid", "unpaidBalance"] });
const partnerDetail = operations.find(op => op.path === '/partners/:id' && op.method === 'GET')!;
// partner.service computes unpaidBalance = earned commission - paid amount.
// Completion requires an actual earned obligation; a 0/0 account is not paid.
operations.find(op=>op.id==='partner.analysis')!.analysis!.numericPredicateEquivalences=[{operator:'eq',value:100,
  description:'Hoàn tất 100% nghĩa vụ hoa hồng lũy kế: đã phát sinh hoa hồng dương và không còn số dư phải trả; 0/0 không được coi đã thanh toán.',
  predicates:[{field:'totalCommission',operator:'gt',value:0},{field:'unpaidBalance',operator:'lte',value:0}]}];
operations.push({...studentPartners, id:'partner.payouts.analysis', title:'Tra cứu lịch sử chi trả hoa hồng đối tác tuyển sinh', path:'/partners/payout-history', rawResponse:true, readOnly:true,
  coverageAliases:['trả hoa hồng','chi trả hoa hồng','thanh toán hoa hồng'],
  functionAreas:[{key:'partner-payouts',label:'Chi trả hoa hồng đối tác học viên'},{key:'partner-analysis',label:'Phân tích đối tác học viên'}],
  description:'Đọc đầy đủ lịch sử các khoản hoa hồng ĐÃ CHI TRẢ cho đối tác tuyển sinh trong chi nhánh theo quyền. Trả tên người nhận, ngày chi trả, số tiền thực trả và phương thức. Dùng cho lần gần nhất/cuối cùng, trả cho ai, đã chi tổng bao nhiêu theo tháng/tuần/kỳ. Không dùng tổng lũy kế để thay giao dịch theo kỳ, không dùng nguồn này tính hoa hồng phát sinh hoặc còn nợ. from/to là cặp ngày YYYY-MM-DD bao gồm hai đầu theo lịch Việt Nam; bỏ cả hai nếu xem toàn bộ lịch sử. search tìm tên đối tác. Ngày có độ chính xác theo ngày: extreme max paidOn giữ mọi khoản cùng ngày gần nhất, không tự chọn một khoản trong ngày. analysis là JSON khai báo: extreme:{field,direction:min|max}, sort:{field,direction:asc|desc}, filters:[{field,operator:eq|ne|gt|gte|lt|lte|contains,value}], limit, select:[field], groupBy, aggregate:{operation:count|sum|avg,field} hoặc aggregates. Không kết hợp tổng hợp với xếp hạng trong cùng bước. Các trường đầu ra: partnerName,paidOn,amount,method. Tính tổng chi thực tế bằng aggregate sum amount; ngày mới nhất bằng extreme max paidOn. Không có lịch sử thì chưa có dữ liệu chi trả trong phạm vi, không suy ra thiếu quyền.',
  fields:[queryField(text('search','Tên đối tác')),queryField(date('from','Từ ngày')),queryField(date('to','Đến ngày')),queryField(ref('targetBranch','Chi nhánh đối tác','branch.list',false),'branchId'),{key:'analysis',label:'Điều kiện phân tích',type:'json'}],
  assistantOnlyFields:['analysis'],resultFields:['partnerName','paidOn','amount','method'],
  analysis:{displayFields:['partnerName','paidOn','amount','method'],fields:{
    partnerName:{label:'Đối tác',type:'text',contains:true,answerAliases:['cho ai','ai nhận']},
    paidOn:{label:'Ngày chi trả',type:'text',format:'date',aliases:['lần chi trả','ngày thanh toán','lần thanh toán'],answerAliases:['khi nào','ngày nào']},
    amount:{label:'Số tiền chi trả (VND)',type:'number',aliases:['tiền đã chi','tiền chi trả','tiền đã thanh toán','tiền hoa hồng']},
    method:{label:'Phương thức',type:'text'},
  }},
});
// Keep identity, state and bank presence visible within the shared table's
// compact column budget, even on fully populated partner profiles.
partnerDetail.resultFields=[...new Set(['name','isActive','bankAccountStatus','phone','email','bankName','bankAccountName','bankAccountNo',...partnerDetail.resultFields])];
partnerDetail.coverageAliases=[...(partnerDetail.coverageAliases || []),'đang dùng tài khoản ngân hàng nào để nhận hoa hồng','tài khoản ngân hàng nhận hoa hồng'];
operations.push({...partnerDetail,id:'partner.referrals',title:'Xem học viên do đối tác tuyển sinh giới thiệu',rawResponse:true,readOnly:true,
  coverageAliases:['đã giới thiệu','đã giới thiệu học viên','những học viên nào','tổng học phí bao nhiêu'],
  description:'Xem danh sách và lịch sử học viên do một đối tác tuyển sinh giới thiệu, kèm ngày đăng ký và tổng học phí của đối tác. Nếu chưa có tên đối tác thì để trống trường tham chiếu để người dùng chọn. Ngày đăng ký là ngày trên hồ sơ học viên, không suy ra ngày gắn đối tác. Số học viên và học phí lấy từ API nghiệp vụ.',
  resultFields:['partnerName','fullName','registrationDate','fee','totalReferredTuition']});
const retailPerformance = operations.find(op => op.path === "/retail/finance/commission/kpi" && op.method === "GET")!;
retailPerformance.title = "Phân tích hoa hồng đối tác bán lẻ";
retailPerformance.fields.push(queryField(date("from", "Từ ngày", true)), queryField(date("to", "Đến ngày", true)));
retailPerformance.analysis = { fields: {
  partnerName: { label: "Đối tác", type: "text" }, partnerCode: { label: "Mã đối tác", type: "text" },
  commission: { label: "Hoa hồng ròng (VND)", type: "number" }, sources: { label: "Số bút toán hoa hồng", type: "number" },
} };
retailPerformance.description = "Phân tích hoa hồng ròng và số BÚT TOÁN hoa hồng trong khoảng ngày theo chi nhánh, bao gồm cộng tác viên không phát sinh. commission có thể âm do hoàn/đảo hoa hồng. sources KHÔNG phải số đơn hàng, số khách hoặc lượt giới thiệu. Không có chỉ tiêu KPI đạt/chưa đạt, cần hỏi ngưỡng nếu người dùng chưa nêu. Không đổi yêu cầu về đơn hàng/khách sang số bút toán. Tháng này dùng ngày đầu đến cuối tháng hiện tại theo Việt Nam. Chỉ dùng khoảng ngày API hỗ trợ.";
for (const op of [operations.find(op => op.id === "partner.analysis")!, retailPerformance]) {
  op.fields.push({ key: "analysis", label: "Điều kiện phân tích", type: "json" });
  op.assistantOnlyFields = [...(op.assistantOnlyFields || []), "analysis"];
  op.description += ` Dùng analysis với filters:[{field,operator:eq|ne|gt|gte|lt|lte|contains,value}] (contains chỉ cho trường khai báo hỗ trợ), extreme:{field,direction:min|max}, sort:{field,direction:asc|desc}, limit, select:[tên trường], groupBy, aggregate:{operation:count|sum|avg,field} hoặc aggregates:[{operation,field}] để tính nhiều chỉ tiêu cùng lúc. Không dùng cả aggregate và aggregates. Giữ mọi đồng hạng cho cực trị. Không kết hợp tổng hợp với sort/extreme/limit. Trường cho phép: ${JSON.stringify(op.analysis!.fields)}.`;
}
for (const op of operations.filter(op => op.method === "PATCH" && ["/partners/commission-levels/:id", "/retail/partners/commission-policies/:id"].includes(op.path))) {
  op.partialUpdate = true;
  op.mergeBodyWithReference = true;
  op.description += " Chỉ gửi thuộc tính người dùng muốn sửa. Máy chủ đọc bản hiện tại và giữ các phần không đổi, kể cả thuộc tính lồng trong config. Chọn đúng bản ghi trước khi sửa và xác nhận trước khi lưu. Không tự tạo bản ghi mới khi người dùng yêu cầu sửa.";
}
const retailPolicyList = operations.find(op => op.id === "retail.partner.commission.policy.list")!;
operations.find(op => op.id === "retail.order.list")!.fields.push({ key: "query_heldOnly", apiKey: "heldOnly", source: "query", type: "boolean", label: "Chỉ đơn nháp đang giữ" });
retailPolicyList.resultFields.push("partnerName");
retailPolicyList.description += " Chính sách được phân biệt bằng ngày áp dụng và cộng tác viên (hoặc chính sách chung). Không tự chọn một bản khi chưa xác định được.";
for (const op of operations.filter(op => /\/retail\/partners\/commission-policies/.test(op.path) && ["POST", "PATCH"].includes(op.method))) {
  op.description += " config.phoneAmount là tiền VND (150000–300000). config.accessoryBps và config.repairBps là điểm cơ bản (1000–1500), 1%=100 điểm cơ bản. Đổi 12% thành 1200, không phải 12. Thiếu mức tiền hoặc tỷ lệ khi tạo mới thì hỏi, không tự đặt.";
  const config = op.fields.find(field => field.key === "config");
  if (config) { config.required = true; config.systemRequired = true; config.structure = { type: "object", keys: {
    phoneAmount: { type: "number", label: "Hoa hồng điện thoại (VND)", required: true, min: 150000, max: 300000 },
    accessoryBps: { type: "number", label: "Hoa hồng phụ kiện (điểm cơ bản)", required: true, min: 1000, max: 1500 },
    repairBps: { type: "number", label: "Hoa hồng sửa chữa (điểm cơ bản)", required: true, min: 1000, max: 1500 },
  } }; }
}
const studentIndividualCommission = operations.find(op => op.id === "partner.commission.update");
const retailInvoiceDetail = operations.find(op => op.id === 'retail.invoice.detail');
const retailInvoiceBranch = operations.find(op => op.id === 'retail.invoice.list')?.fields.find(field => field.source === 'query' && field.apiKey === 'branchId');
if (retailInvoiceDetail && retailInvoiceBranch && !retailInvoiceDetail.fields.some(field => field.apiKey === 'branchId')) retailInvoiceDetail.fields.push({ ...retailInvoiceBranch });
if (studentIndividualCommission) {
  studentIndividualCommission.unavailableReason = "Hoa hồng đối tác học viên hiện được tính theo cấp bậc và tổng học phí giới thiệu. Lưu mức riêng trên hồ sơ không thay đổi kết quả tính. Mình chưa lưu. Bạn cần chọn cấp bậc hoa hồng muốn điều chỉnh.";
  studentIndividualCommission.description = studentIndividualCommission.unavailableReason;
}
// Query contracts must expose business filters to both interpretation and execution.
// Keep these keyed by route so changing a generated operation ID cannot lose filters.
const businessOverview = operations.find(operation => operation.id === "dashboard.business-overview");
if (businessOverview) businessOverview.resultFields = [...businessOverview.resultFields, "comparisonRange", "scopeLabel"];
for (const operation of operations.filter(item => ["student.create", "student.update"].includes(item.id))) {
  operation.resultFields = [...new Set([...operation.resultFields, "address", "birthday", "referral"])];
}
operations.push({
  id: "student.payment.reconcile", title: "Tra cứu số nợ và đối chiếu học phí học viên", module: "student", permissions: ["people:read", "people:manage"],
  description: "Tra cứu học phí hiện tại của một học viên theo tên/mã: studentName là tên, totalFee là tổng học phí, recordedPaidAmount là đã đóng, remainingAmount là số còn nợ trên hồ sơ (totalFee trừ recordedPaidAmount). Dùng trực tiếp để hỏi học viên còn nợ bao nhiêu, không cần giả định có tranh chấp thanh toán. Cũng đối chiếu tổng phiếu thu và lịch sử thanh toán để nêu chênh lệch khi cần. Không thay bằng tổng kỳ trả góp amountDue vì khác số nợ hiện tại. Chỉ đọc, không thu thêm hay sửa tiền. Không hỗ trợ giới hạn theo kỳ.",
  method: "GET", path: "/payments/reconciliation/:id", adapter: "contract", readOnly: true,
  fields: [{ ...ref("path_id", "Học viên cần đối chiếu", "student.list"), source: "path", apiKey: "id" }],
  link: "/quan-ly-hoc-vien", resultFields: ["studentName", "totalFee", "recordedPaidAmount", "receiptTotal", "historyTotal", "remainingAmount", "paymentDifference", "receiptCount", "reconciliationStatus", "scopeDescription"],
});
const boundedCount = (key: string, label: string, max: number): AssistantField => ({ ...number(key, label), min: 1, max, integer: true });
const queryChoice = choice;
const reportDates = (): AssistantField[] => [date("from", "Từ ngày", true), date("to", "Đến ngày", true)];
const auditedQueryFields: Record<string, AssistantField[]> = {
  "/repair/reports/revenue": [...reportDates(), queryChoice("groupBy", "Nhóm báo cáo theo", ["branch", "technician", "day"])],
  "/repair/reports/part-usage": reportDates(),
  "/repair/reports/technician-performance": reportDates(),
  "/repair/reports/feedback-summary": reportDates(),
  "/repair/history": [text("imei", "IMEI thiết bị"), text("phone", "Số điện thoại khách hàng"), { ...text("customerId", "Khách hàng"), type: "reference", reference: "customer.list" }],
  "/repair/feedback": [{ ...text("technicianId", "Kỹ thuật viên"), type: "reference", reference: "employee.list" }, boundedCount("limit", "Số đánh giá", 200)],
  "/customers/search": [text("q", "Tên hoặc số điện thoại khách hàng", true), boundedCount("limit", "Số khách hàng", 20)],
  "/inventory/receiving/suppliers": [text("q", "Từ khóa nhà cung cấp"), queryChoice("status", "Trạng thái nhà cung cấp", ["active", "inactive"])],
  "/marketing/runs": [boundedCount("limit", "Số lần chạy", 100)],
  "/marketing/deliveries": [queryChoice("automationType", "Loại tự động hóa", ["thank_you", "birthday", "holiday", "remarketing"]), queryChoice("status", "Trạng thái gửi", ["queued", "sending", "sent", "skipped", "failed"]), boundedCount("limit", "Số lần gửi", 200)],
  "/retail/finance/profit": reportDates(),
  "/retail/finance/commission/me": reportDates(),
  "/retail/finance/commission/partners/:id/statement": reportDates(),
  "/retail/warranty/expiring": [queryChoice("scope", "Loại bảo hành", ["supplier", "customer"]), { ...number("days", "Số ngày tới khi hết bảo hành"), min: 1, integer: true }],
  "/retail/warranty/orders": [text('q','Mã đơn, tên khách, số điện thoại, sản phẩm hoặc SKU'),queryChoice('status','Trạng thái bảo hành',['all','active','expiring','expired','pending','none','unrecorded']),{...number('days','Số ngày dùng phân loại sắp hết bảo hành'),min:1,max:3650,integer:true},{...number('page','Trang'),min:1,integer:true},{...number('limit','Số dòng mỗi trang'),min:1,max:100,integer:true}],
};
for (const op of operations) {
  const fields = op.method === "GET" ? auditedQueryFields[op.path] : undefined;
  if (!fields) continue;
  for (const field of fields) {
    if (!op.fields.some(existing => existing.source === "query" && existing.apiKey === field.key)) op.fields.push(queryField(field));
  }
  op.description += " Giữ đầy đủ bộ lọc người dùng đã nêu. Chọn bản ghi tham chiếu theo tên, không tự đoán mã. Khoảng ngày phải có đủ đầu và cuối kỳ, thiếu kỳ thì hỏi lại. Danh sách bị giới hạn số dòng không đại diện cho toàn bộ dữ liệu.";
}
// These PATCH endpoints express the complete command in the URL, with no editable body.
for (const operation of operations) {
  if(operation.method==='GET'&&operation.path==='/retail/warranty/orders'){
    operation.resultRowsField='items';
    operation.description='Tra cứu bảo hành theo từng dòng sản phẩm đã bán, gồm hàng quản lý số lượng và hàng có serial. Dữ liệu thuộc khách hàng, công ty và chi nhánh được xác thực. Có ngày hết bảo hành, khách hàng và mã đơn. status=all lấy đủ các trạng thái; days chỉ dùng phân loại trạng thái expiring, không giới hạn ngày khi status=all. Lọc khoảng ngày hết bảo hành cụ thể trên warrantyEndAt bằng bộ lọc đọc chung, lấy đủ các trang.';
  }
  if(operation.method==='GET'&&operation.path==='/retail/warranty/expiring'){
    operation.description='Chỉ tra thiết bị quản lý serial trong khoảng từ thời điểm hiện tại đến days ngày tới; scope supplier/customer chọn đồng hồ bảo hành. Không bao gồm hàng quản lý số lượng. Khi cần toàn bộ sản phẩm khách đã mua và khoảng ngày lịch cụ thể, chọn nguồn bảo hành theo dòng đơn bán.';
    operation.resultFields=['productName','sku','serialNumber','soldOrderCode','customerWarranty','supplierWarranty'];
    operation.resultChildFields={customerWarranty:['startAt','endAt','months'],supplierWarranty:['startAt','endAt','months','supplierName']};
  }
  if (["notification.mark-read", "notification.mark-all-read"].includes(operation.id)) operation.allowEmptyUpdate = true;
  if (operation.id === "marketing.lead-intake-profile.activate") {
    const version = operation.fields.find(field => field.apiKey === "version");
    if (version) version.referenceValueKey = "version";
  }
}
// Reviewed read contracts must expose the same filters as their scoped APIs.
for (const operation of operations) {
  const addQuery = (field: AssistantField) => {
    if (!operation.fields.some(existing => existing.apiKey === field.key && existing.source === 'query')) operation.fields.push({ ...field, key: `query_${field.key}`, apiKey: field.key, source: 'query' });
  };
  if (operation.id === 'inventory.prices.list') {
    addQuery(text('sku', 'Mã SKU cần tra giá'));
    operation.description = 'Tra giá bán và giá vốn theo mã SKU chính xác trong chi nhánh đang chọn. query_sku lọc mã SKU; kết quả có sku, sellingPrice, costPrice theo quyền hiện tại. Không cần ghép nhiều nguồn cho hai loại giá.';
  }
  if (operation.id === 'worker.partner.referrals.list') {
    addQuery(date('from', 'Từ ngày giới thiệu'));
    addQuery(date('to', 'Đến ngày giới thiệu'));
    operation.description += ' Lọc theo ngày giới thiệu referredAt bằng query_from và query_to (YYYY-MM-DD, bao gồm hai đầu). Khi hỏi một tháng, lấy ngày đầu đến ngày cuối tháng đó; không dùng ngày hiệu lực hợp đồng thay ngày giới thiệu.';
  }
  if (operation.id === 'finance.receivable.list') {
    addQuery({ ...number('minOverdueDays', 'Số ngày quá hạn tối thiểu'), min: 1, integer: true });
    const key=operation.fields.find(f=>f.source==='query'&&f.apiKey==='minOverdueDays')!.key;
    operation.queryPredicates={...operation.queryPredicates,[key]:{operator:'gte',integer:true}};
    operation.description += ' query_minOverdueDays là ngưỡng số ngày quá hạn bao gồm ngưỡng. Ví dụ quá hạn trên 30 ngày: query_minOverdueDays=31, chỉ một truy vấn; không tách thành ba nguồn agingBucket. Giữ nguyên các bộ lọc khác nếu được yêu cầu.';
  }
  if (['inventory.serial.list', 'inventory.serial.detail'].includes(operation.id)) {
    operation.resultFields = [...new Set([...operation.resultFields, 'warehouseName', 'warehouseCode'])];
    operation.description += ' Tra vị trí kho hiện tại của serial/IMEI bằng warehouseName và warehouseCode cùng trạng thái. Chỉ trả tên kho được API cấp trong phạm vi, không suy vị trí từ chi nhánh bán.';
  }
}
for (const operation of operations) {
  // ProductCatalogService.list supports page/limit (limit <= 100). Expose the
  // real parameters so shared post-filtering can read beyond the first page.
  if(operation.method==='GET' && operation.path==='/inventory/catalog/products')for(const field of [
    {key:'page',label:'Trang',type:'number' as const,min:1,integer:true},
    {key:'limit',label:'Số sản phẩm mỗi trang',type:'number' as const,min:1,max:100,integer:true},
  ])if(!operation.fields.some(f=>(f.apiKey||f.key)===field.key))operation.fields.push(queryField(field));
}
for (const operation of operations) {
  if(operation.id==='retail.shift.current')operation.description='Chỉ đọc ca POS đang mở của CHÍNH TÀI KHOẢN ĐANG ĐĂNG NHẬP. Không phải danh sách ca của mọi nhân viên; cần xem ai/các thu ngân đang mở ca trong chi nhánh thì dùng nguồn danh sách ca. expectedCash là số tiền theo sổ, không phải tiền thực kiểm kê.';
  if(operation.id==='retail.shift.list')operation.description+=' Liệt kê ca của các thu ngân trong chi nhánh theo quyền; status=open để tìm những người đang mở ca. expectedCash là tiền theo sổ; countedCash là số đã kiểm đếm khi có.';
  if(operation.path==='/timekeeping/records')operation.description+=' Nguồn chấm công NHÂN SỰ CÔNG TY. Người lao động/nhân công tham gia dự án thuộc quản lý lao động là loại hồ sơ riêng; nguồn này không trả chấm công của loại hồ sơ đó.';
  if(operation.id==='student.schedule.list'){
    operation.resultFields=[...new Set([...operation.resultFields,'location'])];
    operation.description+=' location là tên phòng/địa điểm có cấu trúc, dùng lọc phòng; không suy địa điểm từ lời mô tả giảng viên hay số học viên.';
  }
  if(operation.id==='student.resource.list')operation.description+=' Loại tài nguyên là danh mục cụ thể (ví dụ máy chiếu), không phải tên chung của màn hình. Màn hình thiết bị của web lấy toàn bộ loại trừ Phòng học bằng excludeType; màn hình phòng học lấy type=Phòng học.';
  if(operation.method==='GET'&&operation.path==='/analytics/pnl'){
    operation.fields=operation.fields.map(field=>field.source==='query'&&['from','to'].includes(field.apiKey||field.key)?{...field,type:'date'}:field);
    operation.precomputedMeasures=Object.fromEntries(['revenue','tuitionRevenue','goodsRevenue','goodsGrossProfit','payrollExpense','commissionExpense','generalOperatingExpense','totalOperatingExpenses','operatingResult'].map(key=>[key,{operation:'sum' as const,label:key}]));
  }
  if(operation.method==='GET'&&operation.path==='/retail/finance/profit')operation.precomputedMeasures=Object.fromEntries(['revenue','knownCost','grossProfit','operatingExpense','commissionExpense','netProfit'].map(key=>['summary.'+key,{operation:'sum' as const,label:key}]));
  if(operation.method==='GET'&&operation.path==='/finance/management/report')operation.precomputedMeasures=Object.fromEntries(['revenue','cost','grossProfit','expense','netProfit','cashIn','cashOut'].map(key=>['summary.'+key,{operation:'sum' as const,label:key}]));
  if(operation.id==='retail.report.summary'){
    // RetailReportModel.paymentMix is already grouped by method and sums paid amounts.
    operation.resultChildFields={...operation.resultChildFields,paymentMix:['method','amount']};
    operation.precomputedGroups={paymentMix:{dimension:'method',measures:{amount:'sum'}}};
    operation.precomputedMeasures={...operation.precomputedMeasures,'paymentMix.amount':{operation:'sum',label:'Số tiền theo phương thức thanh toán'}};
  }
  if(operation.id==='inventory.receipt.list'){
    // listReceipts returns lean GoodsReceipt documents with these declared timestamps.
    operation.resultFields=[...new Set([...operation.resultFields,'receivedAt','confirmedAt','createdAt'])];
  }
  // laborPartnerReportSchema/listSettlementSchema require YYYY-MM-DD, even
  // when the generated catalog labels the boundary as a period rather than a day.
  if(operation.method==='GET'&&['/worker-management/partners/dashboard','/worker-management/partners/reports/commission','/worker-management/partners/settlements'].includes(operation.path))
    operation.fields=operation.fields.map(field=>field.source==='query'&&['periodFrom','periodTo','periodStart','periodEnd'].includes(field.apiKey||field.key)?{...field,type:'date'}:field);
  if(operation.method==='GET'&&operation.path==='/inventory/transfers')operation.description+=' Trạng thái nghiệp vụ: in_transit là đã gửi, đang vận chuyển và bên nhận chưa tiếp nhận; received là bên nhận đã xác nhận nhận; cancelled là đã hủy; reversed là đã đảo phiếu.';
  operation.fields=operation.fields.map(normalizeAssistantFieldContract);
  if(operation.id==='department.lookup'){
    operation.analysis={publicRead:true,rowDimensions:['name'],displayFields:['name','managerName','employeeCount'],fields:{name:{label:'Phòng ban',type:'text'},managerName:{label:'Người quản lý',type:'text'},employeeCount:{label:'Số nhân sự',type:'number',measureOperation:'count'}}};
    if(!operation.fields.some(f=>f.key==='analysis'))operation.fields.push({key:'analysis',label:'Điều kiện lọc và tổng hợp',type:'json'});
    operation.assistantOnlyFields=[...(operation.assistantOnlyFields||[]),'analysis'];
  }
  if(operation.id==='partner.analysis'&&operation.analysis)operation.analysis.additiveCountFields=['referredStudentsCount'];
  if(['POST','PATCH'].includes(operation.method)&&/^\/worker-management\/partners\/policies(?:\/:\w+)?$/.test(operation.path))operation.inputArrayLengths={'official.milestones':'official.maxMonths'};
  const analysis=publicReadAnalysis(operation,operations);
  if (!analysis) continue;
  operation.analysis=analysis;
  if(operation.id==='student.resource.list'&&analysis.fields.status)analysis.fields.status.values={AVAILABLE:'Sẵn sàng sử dụng',OCCUPIED:'Đang sử dụng',MAINTENANCE:'Đang bảo trì'};
  operation.fields.push({key:'analysis',label:'Điều kiện lọc và tổng hợp',type:'json'});
  operation.assistantOnlyFields=[...(operation.assistantOnlyFields||[]),'analysis'];
}
const couponCreateSource=operations.find(operation=>operation.id==='retail.coupon.create')!;
operations.push({id:'retail.coupon.list',title:'Tra cứu danh sách mã giảm giá và thời hạn',module:'retail',
  permissions:['retail:manage'],method:'GET',path:'/retail/coupons',adapter:'contract',link:couponCreateSource.link,
  description:'Danh sách đầy đủ mã ưu đãi trong chi nhánh theo quyền quản lý. active là bật/tắt; startsAt và endsAt là thời điểm hiệu lực. Lọc kết hợp bằng analysis; không dùng assistant-options để thay danh sách quản trị. Còn hạn không đồng nghĩa còn lượt sử dụng: usageLimit và usedCount là hai cột riêng. API cố định 20 dòng/trang, truyền page để đọc tiếp.',
  fields:[queryField(ref('targetBranch','Chi nhánh bán lẻ','branch.list',false),'branchId'),queryField({...number('page','Trang',1),integer:true,min:1}),{key:'analysis',label:'Điều kiện lọc và tổng hợp',type:'json'}],assistantOnlyFields:['analysis'],
  resultFields:['code','name','discountType','value','minSubtotal','maxDiscount','startsAt','endsAt','active','usageLimit','usedCount'],
  analysis:{publicRead:true,fields:{code:{label:'Mã giảm giá',type:'text',contains:true},name:{label:'Tên ưu đãi',type:'text',contains:true},discountType:{label:'Loại giảm giá',type:'text',values:{amount:'Số tiền',percent:'Phần trăm'}},value:{label:'Mức giảm',type:'number'},minSubtotal:{label:'Đơn tối thiểu',type:'number'},maxDiscount:{label:'Giảm tối đa',type:'number'},startsAt:{label:'Bắt đầu hiệu lực',type:'text',format:'date'},endsAt:{label:'Hết hiệu lực',type:'text',format:'date'},active:{label:'Đang bật',type:'boolean'},usageLimit:{label:'Giới hạn lượt dùng',type:'number'},usedCount:{label:'Đã sử dụng',type:'number'}}}});
// Reviewed array sections remain ordinary read operations: same scoped HTTP
// source, permissions and dispatcher, with a typed row contract for the shared
// filter/sort/aggregate engine. No natural-language phrase selects these views.
const retailSummarySource=operations.find(operation=>operation.id==='retail.report.summary')!;
for(const section of [
  {id:'retail.report.payment-methods',title:'Tổng hợp tiền thu theo phương thức thanh toán',key:'paymentMix',
    description:'Toàn bộ số tiền thực thu theo từng phương thức trong khoảng ngày báo cáo bán lẻ. Lọc phương thức, cộng tiền, liệt kê hoặc nhóm bằng analysis. amount là số tiền đã được báo cáo tính sẵn, không đếm bản ghi thành tiền.',
    fields:{method:{label:'Phương thức thanh toán',type:'text',values:{cash:'Tiền mặt',card:'Thẻ',transfer:'Chuyển khoản',ewallet:'Ví điện tử'}},amount:{label:'Số tiền đã thu',type:'number',measureOperation:'sum'}}},
  {id:'retail.report.products',title:'Phân tích và xếp hạng sản phẩm bán lẻ',key:'products',
    description:'Toàn bộ sản phẩm phát sinh bán hàng trong khoảng ngày báo cáo. netQuantity là số lượng bán ròng, netSales là doanh thu ròng. Có thể lọc, xếp hạng và lấy top N bằng analysis; không chỉ lấy thứ tự doanh thu sẵn có. Không có sản phẩm không phát sinh giao dịch. Giá vốn/lợi nhuận chỉ có nếu API cho phép.',
    fields:{sku:{label:'Mã SKU',type:'text'},productName:{label:'Sản phẩm',type:'text'},category:{label:'Danh mục',type:'text'},brand:{label:'Thương hiệu',type:'text'},netQuantity:{label:'Số lượng bán ròng',type:'number',measureOperation:'sum'},netSales:{label:'Doanh thu ròng',type:'number',measureOperation:'sum'},profit:{label:'Lợi nhuận',type:'number',measureOperation:'sum'}}},
] as const){
  const fields=section.fields as AnalysisContract['fields'];
  operations.push({...retailSummarySource,id:section.id,title:section.title,description:section.description,
    fields:structuredClone(retailSummarySource.fields),resultFields:[section.key],resultChildFields:{[section.key]:Object.keys(fields)},
    precomputedGroups:undefined,precomputedMeasures:undefined,
    analysis:{publicRead:true,publicRowsField:section.key,rowDimensions:[Object.keys(fields)[0]],displayFields:Object.keys(fields),fields,
      ...(section.key==='paymentMix'?{completeGroups:{dimension:'method',values:['cash','card','transfer','ewallet'],zeroMeasures:['amount']}}:{})}});
}
registerAssistantBusinessReadViews(operations);
for(const operation of operations){
  if(operation.analysis)for(const [key,definition]of Object.entries(operation.analysis.fields)){
    if(!definition.values||!/(?:^|_)status$/i.test(key))continue;
    const values=Object.keys(definition.values),terminal=values.filter(v=>['completed','cancelled','canceled','closed','ended','terminated','archived'].includes(v));
    const open=values.filter(v=>['draft','pending','confirmed','processing','in_progress','open','active'].includes(v));
    if(terminal.length>1&&open.length)operation.analysis.lifecycleFields={...operation.analysis.lifecycleFields,[key]:{terminal,open}};
  }
  if(operation.id==='inventory.balance.list'&&operation.analysis){
    operation.fields.push(queryRef('productId','Tên hoặc mã sản phẩm','product.list',false));
    operation.analysis.referenceInputs={productName:'productId',warehouseName:'warehouseId'};
    operation.description+=' Nhận diện tên sản phẩm qua productId và tên kho qua warehouseId; không lọc literal nhãn sản phẩm/kho khi đã dùng tham chiếu.';
  }
  if(operation.id==='student.schedule.list'&&operation.analysis){
    operation.fields.push(queryRef('query_batchId','Tên hoặc mã lớp','batch.list',false));
    operation.fields[operation.fields.length-1].apiKey='batchId';
    operation.analysis.referenceInputs={title:'query_batchId'};
    operation.resultFields.push('startAt','endAt');
    for(const key of ['startAt','endAt'])operation.analysis.fields[key]={label:key==='startAt'?'Bắt đầu lúc':'Kết thúc lúc',type:'text',format:'date'};
    operation.description+=' Lọc lớp qua batchId, không so tên lớp với tiêu đề ghép mã lớp/khóa học. startAt/endAt là thời gian cụ thể để lọc một buổi trong ngày.';
  }
  if(operation.id==='hr.daily.overview'&&operation.analysis)operation.analysis.statusCoverage={field:'attendanceStatus',unknownValues:['Chưa ghi nhận','unrecorded']};
}
export const ASSISTANT_OPERATIONS: readonly AssistantOperation[] = operations.map(operation => ({
  ...operation,
  assistantMetadata: buildAssistantOperationMetadata(operation),
}));
export function operationById(id: string) { return ASSISTANT_OPERATIONS.find(op => op.id === id); }
export function defaultWorkflow(op: AssistantOperation): AssistantWorkflow {
  const instructions = op.module === "quotation" ? quotationWorkflowInstructions : op.module === "healthcare" ? healthcareWorkflowInstructions : op.id === "hr.contract.create"
    ? "Khi lập hợp đồng, chọn nhân sự theo tên và thu thập loại hợp đồng, ngày bắt đầu, ngày kết thúc. Nếu người dùng chưa nêu trạng thái, lưu Bản nháp theo mặc định. Luôn xác nhận trước khi tạo. Sau khi tạo, hỏi một lần về ghi chú tùy chọn còn thiếu; cho phép bỏ qua."
    : op.id === "hr.contract.missing.list"
    ? "Báo cáo số nhân sự chưa có hợp đồng đang hiệu lực và liệt kê tên trong phạm vi API trả về. Không diễn giải kết quả thành thiếu chữ ký, tệp hoặc trường thông tin hợp đồng vì nguồn dữ liệu không kiểm tra các mục đó. Chỉ dùng các trường kết quả đã được cho phép."
    : ["retail.report.summary", "retail.invoice.summary"].includes(op.id)
    ? "Nếu đã gắn chi nhánh, dùng chi nhánh đó; nếu là quản trị viên chưa gắn chi nhánh, hỏi người dùng chọn chi nhánh theo tên trước khi tổng hợp. Không tự đoán khoảng ngày: mặc định hôm nay; khi người dùng nói 7 ngày hoặc 30 ngày gần đây, chọn preset tương ứng; nếu nêu ngày bắt đầu/kết thúc thì điền from và to, không đồng thời dùng preset. Chỉ trình bày số liệu tổng hợp cần thiết bằng tiếng Việt, không hiển thị JSON hoặc mã nội bộ."
    : op.id === "customer.create" || (op.method === "PATCH" && op.path === "/customers/:id")
    ? "Điền thông tin khách hàng vào trường tương ứng khi có. Thông tin khách tự cung cấp không có trường riêng như ngân sách, nhu cầu, sở thích hoặc thời gian liên hệ phải được giữ trong notes (Ghi chú), mỗi dữ kiện một dòng có nhãn rõ ràng. Không bỏ thông tin bổ sung, không suy đoán và không đưa chỉ dẫn thao tác, thông tin hệ thống hoặc dữ liệu đăng nhập vào ghi chú. Khi bổ sung ghi chú, giữ những dữ kiện đã thu thập trong yêu cầu đang xử lý; hệ thống sẽ nối ghi chú mới vào hồ sơ đã có."
    : op.id === "training.create"
    ? "Giảng viên mặc định là người tạo khóa; không hỏi người dùng trường này. Khi danh sách bài giảng còn thiếu, hỏi tên bài kèm đường dẫn hoặc nội dung. Khi câu hỏi trắc nghiệm còn thiếu, hỏi nội dung câu hỏi, các phương án và đáp án đúng; chuyển đáp án đúng thành vị trí bắt đầu từ 0 trong danh sách phương án. Nếu người dùng nói bỏ qua hoặc chưa có một danh sách, dùng danh sách rỗng cho riêng danh sách đó. Bài giảng phải có tên, loại và đường dẫn hoặc nội dung. Mỗi câu trắc nghiệm cần ít nhất hai phương án."
      : op.id === "retail.coupon.create"
        ? "Nếu tài khoản đã gắn chi nhánh thì dùng chi nhánh được gán; nếu chưa có, hỏi tên chi nhánh áp dụng. Hỏi người dùng chọn rõ đối tượng áp dụng: tất cả khách hàng hoặc một khách hàng cụ thể. Với tất cả khách hàng, không gắn customerId; với khách hàng cụ thể, bắt buộc chọn đúng khách theo tên và không tự đoán. Chỉ chọn hạng khách hàng nếu người dùng yêu cầu giới hạn theo hạng. Chuẩn hóa mã ưu đãi thành chữ in hoa; chỉ dùng chữ cái không dấu, số, gạch ngang hoặc gạch dưới. discountType phải là amount khi giảm theo số tiền hoặc percent khi giảm theo phần trăm. Nếu thiếu ngày hoặc giờ bắt đầu/kết thúc thì hỏi lại; không tự đoán thời hạn. Luôn xác nhận toàn bộ điều kiện trước khi tạo."
      : op.id === "task.create"
      ? "Nếu người dùng nêu thời gian bắt đầu và số giờ dự tính nhưng không nêu riêng hạn hoàn thành, tính hạn hoàn thành bằng thời gian bắt đầu cộng số giờ dự tính. Ví dụ: bắt đầu 8 giờ ngày 5/11, thời gian 24 giờ thì hạn là 8 giờ ngày 6/11. Không đặt hạn vào đầu ngày bắt đầu."
      : op.id === "api.patch.6bc968347283a069"
        ? "Khi người dùng yêu cầu giờ làm riêng hoặc đưa ra giờ vào, giờ ra, khung nghỉ cụ thể, tự đặt useCustom=true; không hỏi người dùng bật giờ riêng lần nữa. Chuẩn hóa giờ theo HH:MM: 9h30 sáng thành 09:30, 7h tối thành 19:00, 2h chiều thành 14:00 và 3h30 chiều thành 15:30. Nếu chỉ yêu cầu tắt giờ riêng hoặc dùng giờ công ty thì đặt useCustom=false."
      : op.id === "hr.workflow.update"
        ? "Chỉ sửa các thông tin người dùng nêu rõ; các trường bỏ trống sẽ được giữ nguyên. Khi người dùng muốn thay đổi danh sách bước, hỏi và thu thập toàn bộ danh sách bước theo thứ tự trước khi cập nhật. Với bước được giữ hoặc đổi tên, điền tên bước hiện tại vào existingTitle để hệ thống giữ nguyên người phụ trách, nội dung bàn giao, tệp đính kèm và mã bước. Nếu tên bước hiện tại bị trùng, điền thêm existingStepNumber theo thứ tự hiện tại, bắt đầu từ 1. Bước mới không có existingTitle hoặc existingStepNumber. Không tự gán người phụ trách."
      : op.id === "training.update"
      ? "Chỉ thay đổi bài giảng hoặc câu hỏi trắc nghiệm khi người dùng yêu cầu rõ. Giữ nguyên các mục không được yêu cầu sửa. Mỗi bài giảng cần tên, loại và đường dẫn hoặc nội dung; mỗi câu trắc nghiệm cần ít nhất hai phương án và đáp án đúng."
      : op.method === "GET" && op.fields.some(field => field.source === "query")
        ? "Khi tra cứu danh sách, đọc đủ các điều kiện người dùng nêu như từ khóa, trạng thái, chi nhánh, người phụ trách và khoảng ngày; điền mọi trường lọc tương ứng và có thể kết hợp nhiều bộ lọc. Không tự thêm điều kiện người dùng chưa yêu cầu. Khi người dùng nói xem toàn bộ, không tự thêm từ khóa hoặc trạng thái."
      : "";
  return { actionId: op.id, title: op.title, module: op.module, description: op.description,
    fields: structuredClone(op.fields).map(field => field.reference ? { ...field, defaultValue: undefined } : field), enabled: !op.unavailableReason, instructions, requireConfirmation: Boolean(op.confirmation), confirmationLocked: Boolean(op.confirmation), version: 0 };
}
