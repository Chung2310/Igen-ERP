import { Router, type Response, type NextFunction } from "express";
import { startSession, Types, type ClientSession } from "mongoose";
import { getEffectivePermissions, hasAnyPermission, requirePermission, type AuthenticatedRequest } from "../../middleware/auth";
import { getModuleStateForCompany, isServiceSubscriptionBlocked, resolveModuleAccess } from "../../middleware/require-module";
import { resolveRetailScopeFromRequest } from "../retail/contracts";
import { BranchModel } from "../../model/branch.model";
import { healthcareDb, records } from "../healthcare/store";
import { Student } from "../student-management/models/student.model";
import { getAllowedOwnerIds } from "../student-management/utils/auth.util";
import { CustomerError } from "./customer-errors";
import { normalizePhone, phoneLookupVariants } from "./customer-normalization";
import { buildCustomerListFilter, CustomerService } from "./customer.service";
import { CustomerModel } from "./models/customer.model";
import { CustomerSettingsModel } from "./models/customer-settings.model";
import { CustomerModuleLinkModel, customerSourceModules, type CustomerSourceModule } from "./models/customer-module-link.model";

type Scope = { companyCode: string; branchId: string };
type Summary = { id: string; name: string; code?: string; status?: string[]; fee?: string; paidAmount?: number; customerId?: string; phone?: string; dateOfBirth?: string; birthYear?: string };
const configuration = {
  students: { module: "student", permission: "people:read", manage: "people:manage" },
  healthcare: { module: "healthcare", permission: "healthcare:read", manage: "healthcare:manage" },
} as const;

export const customerModuleLinksRouter = Router();

const handle = (action: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try { await action(req, res); }
    catch (error) {
      if (error instanceof CustomerError) {
        res.status(error.status).json({ success: false, code: error.code, message: error.message });
        return;
      }
      next(error);
    }
  };

async function linkScope(req: AuthenticatedRequest) {
  const user = req.user!;
  const scope = await resolveRetailScopeFromRequest(user, { companyCode: req.query.companyCode, branchId: req.query.branchId });
  const [permissions, state] = await Promise.all([
    getEffectivePermissions(user.id, user.role, scope.companyCode),
    getModuleStateForCompany(scope.companyCode),
  ]);
  const access = (module: CustomerSourceModule, write = false) => {
    const config = configuration[module];
    return !isServiceSubscriptionBlocked(state) && resolveModuleAccess(
      { companyCode: scope.companyCode }, config.module, state.modules, state.exists, state.businessType,
    ) && hasAnyPermission(permissions, [write ? config.manage : config.permission]);
  };
  if (scope.branchId && !await BranchModel.exists({ _id: scope.branchId, companyCode: scope.companyCode, isActive: true })) {
    throw new CustomerError("CUSTOMER_BRANCH_FORBIDDEN", "Chi nhánh không thuộc phạm vi công ty.", 403);
  }
  return { scope, user, access, canManage: hasAnyPermission(permissions, ["customer:manage"]) };
}

async function context(req: AuthenticatedRequest) {
  const resolved = await linkScope(req);
  const customerId = String(req.params.id).toLowerCase();
  const customer = await CustomerService.detail({ companyCode: resolved.scope.companyCode }, customerId);
  return { ...resolved, customer, customerId };
}

async function studentOwnerIds(scope: Scope, user: NonNullable<AuthenticatedRequest["user"]>) {
  const owners = await getAllowedOwnerIds({
    uid: user.id, role: user.role === "superadmin" ? "admin" : user.role,
    companyCode: scope.companyCode, centerId: scope.companyCode, branchId: scope.branchId,
  });
  return Array.isArray(owners) ? owners : [owners];
}

async function summaries(module: CustomerSourceModule, scope: Scope, user: NonNullable<AuthenticatedRequest["user"]>, filter: { ids?: string[]; q?: string; customerId?: string; identity?: boolean; offset?: number }): Promise<Summary[]> {
  const pattern = filter.q ? new RegExp(filter.q.normalize("NFC").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : undefined;
  const digits = filter.q && /^[\d\s()+.-]+$/.test(filter.q) ? normalizePhone(filter.q) : "";
  const phonePattern = digits.length >= 3
    ? new RegExp(phoneLookupVariants(digits).map(phone => phone.split("").join("[\\s().+-]*")).join("|"), "i")
    : pattern;
  const identity = filter.identity || Boolean(pattern);
  if (module === "healthcare") {
    const db = await healthcareDb();
    const items = await records(db, "patients").find({
      ...scope,
      ...(filter.customerId ? { $or: [{ customerId: filter.customerId }, { _id: { $in: filter.ids || [] } }] } : filter.ids ? { _id: { $in: filter.ids } } : {}),
      ...(pattern ? { $or: [{ code: pattern }, { name: pattern }, { phone: phonePattern }, { "hospitalProfile.phoneText": phonePattern }] } : {}),
    }).project<{ _id: string; name: string; code: string; customerId?: string; phone?: string; dateOfBirth?: string; hospitalProfile?: { birthYear?: string } }>({ _id: 1, name: 1, code: 1, customerId: 1, ...(identity ? { phone: 1, dateOfBirth: 1, "hospitalProfile.birthYear": 1 } : {}) })
      .sort({ name: 1, _id: 1 }).skip(filter.offset || 0).limit(filter.offset === undefined ? 50 : 51).toArray();
    return items.map(item => ({ id: item._id, name: item.name, code: item.code, customerId: item.customerId, ...(identity ? { phone: item.phone, dateOfBirth: item.dateOfBirth, birthYear: item.hospitalProfile?.birthYear } : {}) }));
  }

  const owners = await studentOwnerIds(scope, user);
  const ids = filter.ids?.filter(id => Types.ObjectId.isValid(id));
  const items = await Student.find({
    branchId: scope.branchId,
    ownerId: { $in: owners },
    ...(filter.customerId ? { $or: [{ customerId: filter.customerId }, { _id: { $in: ids || [] } }] } : ids ? { _id: { $in: ids } } : {}),
    ...(pattern ? { $or: [{ fullName: pattern }, { phone: phonePattern }, { email: pattern }, ...(filter.q && Types.ObjectId.isValid(filter.q) ? [{ _id: filter.q }] : [])] } : {}),
  }).select(`_id fullName status fee paidAmount customerId${identity ? " phone birthday" : ""}`).sort({ fullName: 1, _id: 1 }).skip(filter.offset || 0).limit(filter.offset === undefined ? 50 : 51).lean();
  return items.map(item => ({ id: String(item._id), name: item.fullName, status: item.status, fee: item.fee, paidAmount: item.paidAmount, customerId: item.customerId, ...(identity ? { phone: item.phone, dateOfBirth: item.birthday } : {}) }));
}

function sourceModule(value: string): CustomerSourceModule {
  if (!(customerSourceModules as readonly string[]).includes(value)) {
    throw new CustomerError("CUSTOMER_SOURCE_INVALID", "Phân hệ liên kết không hợp lệ.");
  }
  return value as CustomerSourceModule;
}

function requireBranch(scope: { companyCode: string; branchId?: string }): Scope {
  if (!scope.branchId) throw new CustomerError("CUSTOMER_BRANCH_REQUIRED", "Vui lòng chọn chi nhánh.");
  return { companyCode: scope.companyCode, branchId: scope.branchId };
}

customerModuleLinksRouter.get("/linked-modules", requirePermission("customer:read"), handle(async (req, res) => {
  const { scope, user, access } = await linkScope(req);
  const customerIds = typeof req.query.customerIds === "string" ? [...new Set(req.query.customerIds.split(","))] : [];
  if (customerIds.length < 1 || customerIds.length > 50 || customerIds.some(id => !Types.ObjectId.isValid(id))) {
    throw new CustomerError("CUSTOMER_IDS_INVALID", "Danh sách mã khách hàng không hợp lệ.");
  }
  const branch = requireBranch(scope);
  const modules = customerSourceModules.filter(module => access(module));
  const groups = await Promise.all(modules.map(async module => {
    const links = await CustomerModuleLinkModel.find({ companyCode: branch.companyCode, module, customerId: { $in: customerIds } }).select("customerId sourceId").lean();
    const sourceIds = links.map(link => link.sourceId);
    const results = module === "students"
      ? await Student.find({ branchId: branch.branchId, ownerId: { $in: await studentOwnerIds(branch, user) },
          $or: [{ customerId: { $in: customerIds } }, { _id: { $in: sourceIds.filter(id => Types.ObjectId.isValid(id)) } }],
        }).select("_id customerId").lean()
      : await records(await healthcareDb(), "patients").find({ ...branch,
          $or: [{ customerId: { $in: customerIds } }, { _id: { $in: sourceIds } }],
        }).project<{ _id: string; customerId?: string }>({ _id: 1, customerId: 1 }).toArray();
    const mapped = new Map(links.map(link => [link.sourceId, link.customerId]));
    return { module, linkedCustomers: new Set(results.map(item => item.customerId || mapped.get(String(item._id)))) };
  }));
  const byCustomer = Object.fromEntries(customerIds.map(id => [id, groups.filter(group => group.linkedCustomers.has(id)).map(group => group.module)]));
  res.set("Cache-Control", "no-store");
  return res.json({ success: true, data: byCustomer });
}));

async function sourceContext(req: AuthenticatedRequest) {
  const { scope, user, access } = await linkScope(req);
  const module = sourceModule(req.params.module);
  if (!access(module, true)) throw new CustomerError("CUSTOMER_SOURCE_FORBIDDEN", "Bạn không có quyền liên kết hồ sơ của phân hệ này.", 403);
  return { scope: requireBranch(scope), user, module };
}

async function unlinkedSources(module: CustomerSourceModule, scope: Scope, user: NonNullable<AuthenticatedRequest["user"]>, q: string) {
  if (q.length < 2) return [];
  return excludeLinked(module, scope, await summaries(module, scope, user, { q }));
}

async function excludeLinked(module: CustomerSourceModule, scope: Scope, candidates: Summary[]) {
  const links = await CustomerModuleLinkModel.find({ companyCode: scope.companyCode, module, sourceId: { $in: candidates.map(record => record.id) } }).select("sourceId").lean();
  const linkedIds = new Set(links.map(link => link.sourceId));
  return candidates.filter(record => !record.customerId && !linkedIds.has(record.id)).map(({ customerId: _id, ...record }) => record);
}

customerModuleLinksRouter.get("/source-records/:module/queue", requirePermission("customer:manage"), handle(async (req, res) => {
  const { scope, user, module } = await sourceContext(req);
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : "";
  const page = Math.min(100000, Math.max(1, Math.floor(Number(req.query.page) || 1)));
  const records = await summaries(module, scope, user, { q, identity: true, offset: (page - 1) * 50 });
  res.set("Cache-Control", "no-store");
  return res.json({ success: true, data: { items: await excludeLinked(module, scope, records.slice(0, 50)), hasMore: records.length > 50 } });
}));

customerModuleLinksRouter.get("/source-transfer-settings/:module", requirePermission("customer:manage"), handle(async (req, res) => {
  const { scope, module } = await sourceContext(req);
  const settings = await CustomerSettingsModel.findOne({ companyCode: scope.companyCode }).select("hiddenSourceTransfers").lean();
  res.set("Cache-Control", "no-store");
  return res.json({ success: true, data: { hidden: settings?.hiddenSourceTransfers?.includes(module) ?? false } });
}));

customerModuleLinksRouter.patch("/source-transfer-settings/:module", requirePermission("customer:manage"), handle(async (req, res) => {
  const { scope, user, module } = await sourceContext(req);
  if (user.role !== "admin" && user.role !== "superadmin") throw new CustomerError("CUSTOMER_TRANSFER_SETTING_FORBIDDEN", "Chỉ quản trị viên có thể đổi hiển thị công cụ chuyển hồ sơ.", 403);
  const hidden = req.body?.hidden;
  if (typeof hidden !== "boolean") throw new CustomerError("CUSTOMER_TRANSFER_SETTING_INVALID", "Cài đặt hiển thị không hợp lệ.");
  const company = { companyCode: scope.companyCode };
  if (hidden) {
    const update = { $addToSet: { hiddenSourceTransfers: module } };
    try { await CustomerSettingsModel.updateOne(company, update, { upsert: true }); }
    catch (cause) {
      if ((cause as { code?: number })?.code !== 11000) throw cause;
      await CustomerSettingsModel.updateOne(company, update);
    }
  }
  else await CustomerSettingsModel.updateOne(company, { $pull: { hiddenSourceTransfers: module } });
  return res.json({ success: true, data: { hidden } });
}));

async function readSource(req: AuthenticatedRequest) {
  const { scope, user, module } = await sourceContext(req);
  const sourceId = module === "students" ? req.params.sourceId.toLowerCase() : req.params.sourceId;
  if (!sourceId || sourceId.length > 100) throw new CustomerError("CUSTOMER_SOURCE_INVALID", "Mã hồ sơ nguồn không hợp lệ.");
  const [record] = await summaries(module, scope, user, { ids: [sourceId], identity: true });
  if (!record) throw new CustomerError("CUSTOMER_SOURCE_NOT_FOUND", "Không tìm thấy hồ sơ nguồn ở chi nhánh hiện tại.", 404);
  return { scope: { companyCode: scope.companyCode }, user, record, key: { companyCode: scope.companyCode, module, sourceId } };
}

type SourceKey = { companyCode: string; module: CustomerSourceModule; sourceId: string };
type SourceActor = NonNullable<AuthenticatedRequest["user"]>;
type BatchStatus = "ready" | "shared-customer-phone" | "shared-batch-phone" | "missing-phone" | "linked" | "unavailable" | "transferred" | "failed";
type BatchRow = { module: CustomerSourceModule; sourceId: string; status: BatchStatus; message?: string };

function batchSelection(input: unknown) {
  if (!Array.isArray(input) || !input.length || input.length > 50) {
    throw new CustomerError("CUSTOMER_BATCH_INVALID", "Chọn từ 1 đến 50 hồ sơ để chuyển.");
  }
  const refs = input.map(ref => {
    const module = sourceModule(typeof ref?.module === "string" ? ref.module : "");
    const rawId = typeof ref?.sourceId === "string" ? ref.sourceId.trim() : "";
    const sourceId = module === "students" ? rawId.toLowerCase() : rawId;
    if (!sourceId || sourceId.length > 100) throw new CustomerError("CUSTOMER_SOURCE_INVALID", "Mã hồ sơ nguồn không hợp lệ.");
    return { module, sourceId };
  });
  return [...new Map(refs.map(ref => [`${ref.module}:${ref.sourceId}`, ref])).values()];
}

async function classifyBatch(req: AuthenticatedRequest) {
  const refs = batchSelection(req.body?.records);
  const { scope: requestScope, user, access } = await linkScope(req);
  const scope = requireBranch(requestScope);
  if (refs.some(ref => !access(ref.module, true))) {
    throw new CustomerError("CUSTOMER_SOURCE_FORBIDDEN", "Bạn không có quyền chuyển hồ sơ của phân hệ này.", 403);
  }
  const groups = await Promise.all([...new Set(refs.map(ref => ref.module))].map(async module => {
    const ids = refs.filter(ref => ref.module === module).map(ref => ref.sourceId);
    const [sources, links] = await Promise.all([
      summaries(module, scope, user, { ids, identity: true }),
      CustomerModuleLinkModel.find({ companyCode: scope.companyCode, module, sourceId: { $in: ids } }).select("sourceId").lean(),
    ]);
    return { module, sources, links };
  }));
  const records = new Map(groups.flatMap(group => group.sources.map(record => [`${group.module}:${record.id}`, record] as const)));
  const linked = new Set(groups.flatMap(group => group.links.map(link => `${group.module}:${link.sourceId}`)));
  const counts = new Map<string, number>();
  for (const record of records.values()) {
    const phone = normalizePhone(record.phone);
    if (phone) counts.set(phone, (counts.get(phone) || 0) + 1);
  }
  const phones = [...new Set([...counts.keys()].flatMap(phoneLookupVariants))];
  const customers = await CustomerModel.distinct("normalizedPhone", { companyCode: scope.companyCode, normalizedPhone: { $in: phones } });
  const knownPhones = new Set(customers.map(normalizePhone));
  const rows = refs.map(ref => {
    const id = `${ref.module}:${ref.sourceId}` as const;
    const record = records.get(id);
    const phone = normalizePhone(record?.phone);
    let status: BatchStatus = "ready";
    if (!record) status = "unavailable";
    else if (record.customerId || linked.has(id)) status = "linked";
    else if (!phone) status = "missing-phone";
    else if (knownPhones.has(phone)) status = "shared-customer-phone";
    else if (counts.get(phone) > 1) status = "shared-batch-phone";
    return { ...ref, status, record };
  });
  return { scope, user, rows };
}

customerModuleLinksRouter.post("/source-records/batch/preview", requirePermission("customer:manage"), handle(async (req, res) => {
  const { rows } = await classifyBatch(req);
  res.set("Cache-Control", "no-store");
  return res.json({ success: true, data: rows.map(({ record: _record, ...row }) => row) });
}));

customerModuleLinksRouter.post("/source-records/batch/transfer", requirePermission("customer:manage"), handle(async (req, res) => {
  const approved = new Set(batchSelection(req.body?.approved).map(ref => `${ref.module}:${ref.sourceId}`));
  const { scope, user, rows } = await classifyBatch(req);
  const result: BatchRow[] = [];
  for (const { record, ...row } of rows) {
    if (row.status !== "ready" || !record || !approved.has(`${row.module}:${row.sourceId}`)) {
      result.push(row);
      continue;
    }
    try {
      await createSourceCustomer({ companyCode: scope.companyCode, module: row.module, sourceId: row.sourceId }, record, user, record.phone, false);
      result.push({ ...row, status: "transferred" });
    } catch (cause) {
      if (cause instanceof CustomerError && cause.code === "CUSTOMER_PHONE_EXISTS") result.push({ ...row, status: "shared-customer-phone" });
      else result.push({ ...row, status: "failed", message: cause instanceof CustomerError ? cause.message : "Không chuyển được hồ sơ. Kiểm tra lại rồi thử lại." });
    }
  }
  return res.json({ success: true, data: result });
}));

function sourceBirthDate(value?: string) {
  const date = value?.trim().replace(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/, (_, day: string, month: string, year: string) => `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(+parsed) || parsed.toISOString().slice(0, 10) !== date ? undefined : date;
}

customerModuleLinksRouter.get("/source-records/:module", requirePermission("customer:manage"), handle(async (req, res) => {
  const { scope, user, module } = await sourceContext(req);
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : "";
  res.set("Cache-Control", "no-store");
  return res.json({ success: true, data: await unlinkedSources(module, scope, user, q) });
}));

customerModuleLinksRouter.get("/source-records/:module/:sourceId/customers", requirePermission("customer:manage"), handle(async (req, res) => {
  const { scope, record, key } = await readSource(req);
  if (record.customerId || await CustomerModuleLinkModel.exists(key)) {
    throw new CustomerError("CUSTOMER_SOURCE_ALREADY_LINKED", "Hồ sơ này đã được liên kết. Hãy chọn hồ sơ khác.", 409);
  }
  const normalizedPhone = normalizePhone(record.phone);
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : "";
  const phoneFilter = { normalizedPhone: { $in: phoneLookupVariants(normalizedPhone) } };
  const filter = q.length >= 2 ? buildCustomerListFilter(scope, { q, status: "all" }) : { ...scope, ...phoneFilter };
  const matches = q.length >= 2 || normalizedPhone ? await CustomerModel.find(filter)
    .select("name customerCode phone normalizedPhone dateOfBirth customerKind status")
    .sort({ name: 1, _id: 1 }).limit(51).lean() : [];
  const variants = new Set(phoneLookupVariants(normalizedPhone));
  res.set("Cache-Control", "no-store");
  return res.json({ success: true, data: {
    items: matches.slice(0, 50).map(({ _id, normalizedPhone: phone, dateOfBirth, ...customer }) => ({
      ...customer, customerId: String(_id), dateOfBirth: dateOfBirth?.toISOString().slice(0, 10), samePhone: Boolean(normalizedPhone && variants.has(phone)),
    })),
    truncated: matches.length > 50,
  } });
}));

customerModuleLinksRouter.post("/source-records/:module/:sourceId/customer", requirePermission("customer:manage"), handle(async (req, res) => {
  const { scope, user, record, key } = await readSource(req);
  const customerId = typeof req.body?.customerId === "string" ? req.body.customerId.trim().toLowerCase() : "";
  const create = req.body?.create === true;
  if (create ? customerId : !Types.ObjectId.isValid(customerId)) {
    throw new CustomerError("CUSTOMER_TARGET_INVALID", "Chọn một hồ sơ Khách hàng hoặc xác nhận tạo khách mới.");
  }
  const existing = async (id: string) => {
    if (customerId && id !== customerId) throw new CustomerError("CUSTOMER_SOURCE_ALREADY_LINKED", "Hồ sơ này đã được liên kết với khách hàng khác.", 409);
    return CustomerService.detail(scope, id);
  };
  if (record.customerId) return res.json({ success: true, data: await existing(record.customerId) });

  if (!create) {
    const customer = await CustomerService.detail(scope, customerId);
    validateLinkTarget(customer);
    await linkExistingModuleRecord(key.companyCode, key.module, key.sourceId, customerId, user.id);
    return res.json({ success: true, data: customer });
  }

  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim().slice(0, 40) : record.phone;
  const customer = await createSourceCustomer(key, record, user, phone, req.body?.allowSharedPhone === true);
  return res.json({ success: true, data: customer });
}));

async function createSourceCustomer(key: SourceKey, record: Summary, user: SourceActor, phone: string | undefined, allowSharedPhone: boolean) {
  const scope = { companyCode: key.companyCode };
  const session = await startSession();
  try {
    return await session.withTransaction(async () => {
      const link = await CustomerModuleLinkModel.findOne(key).session(session).lean();
      if (link) return CustomerService.detail(scope, link.customerId);
      const created = await CustomerService.create(scope, {
        name: record.name,
        phone,
        dateOfBirth: sourceBirthDate(record.dateOfBirth),
        source: "import",
        allowSharedPhone,
      }, { id: user.id, name: user.displayName || user.email || user.id }, session);
      await linkExistingModuleRecord(key.companyCode, key.module, key.sourceId, String(created._id), user.id, undefined, session);
      return created;
    });
  } catch (cause) {
    const code = (cause as { code?: string | number })?.code;
    if (code === 20) throw new CustomerError("CUSTOMER_IMPORT_TRANSACTION_REQUIRED", "Môi trường này chưa hỗ trợ tạo và liên kết cùng lúc. Bạn có thể chọn hồ sơ khách hàng có sẵn.", 503);
    if (code !== 11000 && code !== "CUSTOMER_PHONE_EXISTS") throw cause;
    const linked = await CustomerModuleLinkModel.findOne(key).lean();
    if (!linked) throw cause;
    return CustomerService.detail(scope, linked.customerId);
  } finally {
    await session.endSession();
  }
}

function validateLinkTarget(customer: { status: string; customerKind?: string }) {
  if (customer.status !== "active") throw new CustomerError("CUSTOMER_INACTIVE", "Chọn khách hàng đang hoạt động để liên kết hồ sơ.", 409);
  if (customer.customerKind === "business") throw new CustomerError("CUSTOMER_SOURCE_KIND_INVALID", "Chọn hồ sơ Khách hàng cá nhân để liên kết học viên hoặc bệnh nhân.");
}

customerModuleLinksRouter.get("/:id/module-links", requirePermission("customer:read"), handle(async (req, res) => {
  const { scope, user, access, canManage, customerId } = await context(req);
  const modules = customerSourceModules.filter(module => access(module));
  const manageable = modules.filter(module => canManage && access(module, true));
  if (!scope.branchId || !modules.length) return res.json({ success: true, data: { modules, manageable, links: [] } });
  const branchScope = requireBranch(scope);
  const links = await CustomerModuleLinkModel.find({ companyCode: scope.companyCode, customerId, module: { $in: modules } })
    .select("module sourceId").lean();
  const groups = await Promise.all(modules.map(async module => {
    const ids = links.filter(link => link.module === module).map(link => link.sourceId);
    return (await summaries(module, branchScope, user, { ids, customerId }))
      .filter(record => !record.customerId || record.customerId === customerId)
      .map(({ customerId, ...record }) => ({ ...record, module, canUnlink: !customerId && ids.includes(record.id) && manageable.includes(module) }));
  }));
  return res.json({ success: true, data: { modules, manageable, links: groups.flat() } });
}));

customerModuleLinksRouter.get("/:id/module-links/:module/candidates", requirePermission("customer:manage"), handle(async (req, res) => {
  const { scope, user, access } = await context(req);
  const module = sourceModule(req.params.module);
  if (!access(module, true)) throw new CustomerError("CUSTOMER_SOURCE_FORBIDDEN", "Bạn không có quyền liên kết hồ sơ của phân hệ này.", 403);
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : "";
  return res.json({ success: true, data: await unlinkedSources(module, requireBranch(scope), user, q) });
}));

customerModuleLinksRouter.put("/:id/module-links/:module/:sourceId", requirePermission("customer:manage"), handle(async (req, res) => {
  const { scope, user, access, customer, customerId } = await context(req);
  const module = sourceModule(req.params.module);
  if (!access(module, true)) throw new CustomerError("CUSTOMER_SOURCE_FORBIDDEN", "Bạn không có quyền liên kết hồ sơ của phân hệ này.", 403);
  validateLinkTarget(customer);
  const sourceId = module === "students" ? req.params.sourceId.toLowerCase() : req.params.sourceId;
  if (sourceId.length > 100) throw new CustomerError("CUSTOMER_SOURCE_INVALID", "Mã hồ sơ nguồn không hợp lệ.");
  const [record] = await summaries(module, requireBranch(scope), user, { ids: [sourceId] });
  if (!record) throw new CustomerError("CUSTOMER_SOURCE_NOT_FOUND", "Không tìm thấy hồ sơ nguồn ở chi nhánh hiện tại.", 404);
  if (record.customerId && record.customerId !== customerId) throw new CustomerError("CUSTOMER_SOURCE_ALREADY_LINKED", "Hồ sơ này đã được liên kết với khách hàng khác.", 409);
  await linkExistingModuleRecord(scope.companyCode, module, sourceId, customerId, user.id);
  return res.json({ success: true, data: { id: record.id, name: record.name, module } });
}));

customerModuleLinksRouter.delete("/:id/module-links/:module/:sourceId", requirePermission("customer:manage"), handle(async (req, res) => {
  const { scope, user, access, customerId } = await context(req);
  const module = sourceModule(req.params.module);
  if (!access(module, true)) throw new CustomerError("CUSTOMER_SOURCE_FORBIDDEN", "Bạn không có quyền gỡ liên kết của phân hệ này.", 403);
  const sourceId = module === "students" ? req.params.sourceId.toLowerCase() : req.params.sourceId;
  if (sourceId.length > 100) throw new CustomerError("CUSTOMER_SOURCE_INVALID", "Mã hồ sơ nguồn không hợp lệ.");
  const [record] = await summaries(module, requireBranch(scope), user, { ids: [sourceId] });
  if (!record) throw new CustomerError("CUSTOMER_SOURCE_NOT_FOUND", "Không tìm thấy hồ sơ nguồn ở chi nhánh hiện tại.", 404);
  if (record.customerId) throw new CustomerError("CUSTOMER_SOURCE_NATIVE_LINK", "Liên kết này được tạo trong phân hệ gốc.", 409);
  const removed = await CustomerModuleLinkModel.deleteOne({ companyCode: scope.companyCode, module, sourceId, customerId });
  if (!removed.deletedCount) throw new CustomerError("CUSTOMER_LINK_NOT_FOUND", "Không tìm thấy liên kết được tạo từ hồ sơ Khách hàng.", 404);
  return res.json({ success: true });
}));

export async function linkExistingModuleRecord(companyCode: string, module: CustomerSourceModule, sourceId: string, customerId: string, actorId: string, batchId?: string, session?: ClientSession) {
  const key = { companyCode, module, sourceId };
  try {
    const link = await CustomerModuleLinkModel.findOneAndUpdate(key, {
      $setOnInsert: { ...key, customerId, linkedBy: actorId, ...(batchId ? { batchId } : {}) },
    }, { upsert: true, returnDocument: "after", session }).lean();
    if (link.customerId === customerId) return;
  } catch (error) {
    if (session || (error as { code?: number })?.code !== 11000) throw error;
    const existing = await CustomerModuleLinkModel.findOne(key).lean();
    if (existing?.customerId === customerId) return;
  }
  throw new CustomerError("CUSTOMER_SOURCE_ALREADY_LINKED", "Hồ sơ này đã được liên kết với khách hàng khác.", 409);
}
