import { randomUUID } from "node:crypto";
import { Router, type RequestHandler, type Response } from "express";
import Joi from "joi";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../errors/app-error";
import { requirePermission, type AuthenticatedRequest } from "../../middleware/auth";
import { healthcareScope } from "./operations";
import { healthcareDb, scopeFilter, type HealthcareActor } from "./store";

type ResourceDb = { collection: (name: string) => any };
type Handler = (req: AuthenticatedRequest, res: Response, db: ResourceDb, actor: HealthcareActor) => Promise<void>;

function route(handler: Handler): RequestHandler {
  return (request, response, next) => {
    const req = request as AuthenticatedRequest;
    void healthcareScope(req)
      .then(async actor => handler(req, response, await healthcareDb(), actor))
      .catch(next);
  };
}

function parse<T>(schema: Joi.Schema<T>, value: unknown): T {
  const result = schema.validate(value, { abortEarly: false, allowUnknown: false });
  if (result.error) {
    const fields = [...new Set(result.error.details.map(detail => String(detail.path[0] || "")))].filter(Boolean);
    throw new ValidationError("VALIDATION_FAILED", "Kiểm tra các trường bắt buộc hoặc định dạng dữ liệu.", { fields });
  }
  return result.value as T;
}

const code = Joi.string().trim().uppercase().pattern(/^[A-Z0-9][A-Z0-9._/-]{0,49}$/).required();
const requiredText = (max: number) => Joi.string().trim().min(1).max(max).required();
const optionalText = (max: number) => Joi.string().trim().max(max).allow("").default("");
const positiveQuantity = Joi.number().positive().precision(3).max(1_000_000_000).required();
const nonNegativeQuantity = Joi.number().min(0).precision(3).max(1_000_000_000).default(0);
const localDate = Joi.string().allow("").default("").custom((value, helpers) => {
  if (!value) return value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return helpers.error("date.format");
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : helpers.error("date.format");
});
const recordId = Joi.string().guid({ version: "uuidv4" }).required();
const revision = Joi.number().integer().min(1).max(Number.MAX_SAFE_INTEGER).required();

const materialFields = {
  code,
  name: requiredText(180),
  category: requiredText(100),
  unit: requiredText(40),
  lotCode: optionalText(80),
  expiryDate: localDate,
  minimumQuantity: nonNegativeQuantity,
  unitCost: Joi.number().min(0).precision(2).max(1_000_000_000).default(0),
  supplier: optionalText(180),
  notes: optionalText(1000),
  status: Joi.string().valid("active", "inactive").default("active"),
};
const materialCreateInput = Joi.object({ ...materialFields }).required();
const materialUpdateInput = Joi.object({ ...materialFields, revision }).required();
const materialListInput = Joi.object({
  page: Joi.number().integer().min(1).max(5000).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(25),
  q: optionalText(100),
  status: Joi.string().valid("active", "inactive", "all", "low-stock", "expiring").default("active"),
}).required();
const movementInput = Joi.object({
  type: Joi.string().valid("receipt", "issue").required(),
  quantity: positiveQuantity,
  unitCost: Joi.number().min(0).precision(2).max(1_000_000_000).default(0),
  note: optionalText(500),
}).required();
const movementListInput = Joi.object({ limit: Joi.number().integer().min(1).max(100).default(50) }).required();

const equipmentFields = {
  code,
  name: requiredText(180),
  category: requiredText(100),
  location: optionalText(180),
  purchaseDate: localDate,
  notes: optionalText(1000),
};
const manageableEquipmentStatus = Joi.string().valid("available", "maintenance", "retired");
const equipmentCreateInput = Joi.object({ ...equipmentFields, status: manageableEquipmentStatus.default("available") }).required();
const equipmentUpdateInput = Joi.object({ ...equipmentFields, status: manageableEquipmentStatus.required(), revision }).required();
const equipmentListInput = Joi.object({
  page: Joi.number().integer().min(1).max(5000).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(25),
  q: optionalText(100),
  status: Joi.string().valid("available", "requested", "in-use", "maintenance", "retired", "all").default("all"),
  category: optionalText(100),
}).required();
const borrowRequestInput = Joi.object({
  reason: requiredText(500),
  expectedReturnAt: Joi.string().isoDate().allow("").default(""),
}).required();
const returnRequestInput = Joi.object({ note: optionalText(500) }).required();
const requestListInput = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(50),
  status: Joi.string().valid("pending", "approved", "rejected", "cancelled", "all").default("pending"),
}).required();
const decisionInput = Joi.object({
  decision: Joi.string().valid("approved", "rejected").required(),
  rejectionReason: optionalText(500),
}).required();

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const scoped = (actor: HealthcareActor) => scopeFilter(actor);
const now = () => new Date().toISOString();

function publicDocument<T extends Record<string, any>>(document: T) {
  const { companyCode, branchId, createdBy, updatedBy, ...visible } = document;
  return visible;
}

type MaterialListQuery = { page: number; pageSize: number; q: string; status: "active" | "inactive" | "all" | "low-stock" | "expiring" };
function materialFilter(actor: HealthcareActor, query: MaterialListQuery) {
  const filter: Record<string, any> = { ...scoped(actor) };
  if (query.status === "active" || query.status === "inactive") filter.status = query.status;
  if (query.status === "low-stock") filter.$expr = { $lte: ["$quantity", "$minimumQuantity"] };
  if (query.status === "expiring") {
    const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 7 * 60 * 60 * 1000 + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    filter.expiryDate = { $gte: today, $lte: soon };
    filter.status = "active";
  }
  if (query.q) {
    const expression = new RegExp(escapeRegex(query.q), "i");
    filter.$or = ["code", "name", "category", "lotCode", "supplier"].map(field => ({ [field]: expression }));
  }
  return filter;
}

export const healthcareMaterialsRouter = Router();
healthcareMaterialsRouter.get("/", route(async (req, res, db, actor) => {
  const query = parse(materialListInput, req.query);
  const filter = materialFilter(actor, query);
  const collection = db.collection("healthcare_materials");
  const [items, total, activeCount, lowStockCount] = await Promise.all([
    collection.find(filter).sort({ name: 1, lotCode: 1, _id: 1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize).toArray(),
    collection.countDocuments(filter),
    collection.countDocuments({ ...scoped(actor), status: "active" }),
    collection.countDocuments({ ...scoped(actor), status: "active", $expr: { $lte: ["$quantity", "$minimumQuantity"] } }),
  ]);
  res.json({ items: items.map(publicDocument), total, page: query.page, pageSize: query.pageSize, summary: { activeCount, lowStockCount } });
}));

healthcareMaterialsRouter.get("/:id/movements", route(async (req, res, db, actor) => {
  const id = parse(recordId, req.params.id);
  const { limit } = parse(movementListInput, req.query);
  const material = await db.collection("healthcare_materials").findOne({ ...scoped(actor), _id: id }, { projection: { _id: 1 } });
  if (!material) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy vật tư trong chi nhánh hiện tại.");
  const rows = await db.collection("healthcare_material_movements").find({ ...scoped(actor), materialId: id })
    .sort({ createdAt: -1, _id: -1 }).limit(limit).toArray();
  res.json({ items: rows.map(publicDocument) });
}));

healthcareMaterialsRouter.post("/", requirePermission("healthcare:manage") as RequestHandler, route(async (req, res, db, actor) => {
  const value = parse(materialCreateInput, req.body);
  const timestamp = now();
  const material = {
    _id: randomUUID(), ...scoped(actor), ...value, quantity: 0, revision: 1,
    createdAt: timestamp, updatedAt: timestamp, createdBy: actor.actorId, updatedBy: actor.actorId,
  };
  try {
    await db.collection("healthcare_materials").insertOne(material);
  } catch (error: any) {
    if (error?.code === 11000) throw new ConflictError("CONFLICT", "Mã vật tư và số lô đã được sử dụng trong chi nhánh.");
    throw error;
  }
  res.status(201).json(publicDocument(material));
}));

healthcareMaterialsRouter.patch("/:id", requirePermission("healthcare:manage") as RequestHandler, route(async (req, res, db, actor) => {
  const id = parse(recordId, req.params.id);
  const { revision: expectedRevision, ...value } = parse(materialUpdateInput, req.body);
  const result = await db.collection("healthcare_materials").findOneAndUpdate(
    { ...scoped(actor), _id: id, revision: expectedRevision },
    { $set: { ...value, updatedAt: now(), updatedBy: actor.actorId }, $inc: { revision: 1 } },
    { returnDocument: "after" },
  );
  if (!result) {
    const exists = await db.collection("healthcare_materials").findOne({ ...scoped(actor), _id: id }, { projection: { _id: 1 } });
    if (!exists) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy vật tư trong chi nhánh hiện tại.");
    throw new ConflictError("RESOURCE_VERSION_CONFLICT", "Vật tư đã được cập nhật ở nơi khác. Hãy tải lại danh sách.");
  }
  res.json(publicDocument(result));
}));

healthcareMaterialsRouter.post("/:id/movements", requirePermission("healthcare:manage") as RequestHandler, route(async (req, res, db, actor) => {
  const id = parse(recordId, req.params.id);
  const value = parse(movementInput, req.body);
  const materials = db.collection("healthcare_materials");
  const material = await materials.findOne({ ...scoped(actor), _id: id, status: "active" });
  if (!material) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy vật tư đang sử dụng trong chi nhánh hiện tại.");
  const timestamp = now();
  const update = value.type === "receipt"
    ? { $inc: { quantity: value.quantity, revision: 1 }, $set: { updatedAt: timestamp, updatedBy: actor.actorId, unitCost: value.unitCost || material.unitCost } }
    : { $inc: { quantity: -value.quantity, revision: 1 }, $set: { updatedAt: timestamp, updatedBy: actor.actorId } };
  const updated = await materials.findOneAndUpdate(
    { ...scoped(actor), _id: id, status: "active", revision: material.revision, ...(value.type === "issue" ? { quantity: { $gte: value.quantity } } : {}) },
    update,
    { returnDocument: "after" },
  );
  if (!updated) {
    const latest = await materials.findOne({ ...scoped(actor), _id: id }, { projection: { quantity: 1 } });
    if (latest && value.type === "issue" && latest.quantity < value.quantity) {
      throw new ValidationError("INSUFFICIENT_STOCK", "Số lượng xuất vượt quá tồn kho hiện tại.", { fields: ["quantity"] });
    }
    throw new ConflictError("RESOURCE_VERSION_CONFLICT", "Tồn kho vừa thay đổi. Hãy tải lại trước khi ghi phiếu.");
  }
  const movement = {
    _id: randomUUID(), ...scoped(actor), materialId: id, materialCode: material.code, materialName: material.name,
    type: value.type, quantity: value.quantity, unitCost: value.unitCost || material.unitCost, note: value.note,
    createdAt: timestamp, updatedAt: timestamp, revision: 1, createdBy: actor.actorId,
    createdByName: String((req.user as any)?.displayName || "Nhân viên"), updatedBy: actor.actorId,
  };
  await db.collection("healthcare_material_movements").insertOne(movement);
  res.status(201).json({ material: publicDocument(updated), movement: publicDocument(movement) });
}));

healthcareMaterialsRouter.get("/:id", route(async (req, res, db, actor) => {
  const id = parse(recordId, req.params.id);
  const material = await db.collection("healthcare_materials").findOne({ ...scoped(actor), _id: id });
  if (!material) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy vật tư trong chi nhánh hiện tại.");
  res.json(publicDocument(material));
}));

export const healthcareEquipmentRouter = Router();
healthcareEquipmentRouter.get("/", route(async (req, res, db, actor) => {
  const query = parse(equipmentListInput, req.query);
  const filter: Record<string, any> = { ...scoped(actor) };
  if (query.status !== "all") filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.q) {
    const expression = new RegExp(escapeRegex(query.q), "i");
    filter.$or = ["code", "name", "category", "location", "currentBorrowerName"].map(field => ({ [field]: expression }));
  }
  const collection = db.collection("healthcare_equipment");
  const [items, total, statusCounts] = await Promise.all([
    collection.find(filter).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize).toArray(),
    collection.countDocuments(filter),
    collection.aggregate([
      { $match: scoped(actor) }, { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).toArray() as Promise<Array<{ _id: string; count: number }>>,
  ]);
  res.json({ items: items.map(publicDocument), total, page: query.page, pageSize: query.pageSize,
    summary: Object.fromEntries(statusCounts.map(item => [item._id, item.count])) });
}));

healthcareEquipmentRouter.get("/requests", route(async (req, res, db, actor) => {
  const query = parse(requestListInput, req.query);
  const filter: Record<string, any> = { ...scoped(actor) };
  if (query.status !== "all") filter.status = query.status;
  const collection = db.collection("healthcare_equipment_requests");
  const [items, total] = await Promise.all([
    collection.find(filter).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize).toArray(),
    collection.countDocuments(filter),
  ]);
  res.json({ items: items.map(publicDocument), total, page: query.page, pageSize: query.pageSize });
}));

healthcareEquipmentRouter.get("/:id/history", route(async (req, res, db, actor) => {
  const id = parse(recordId, req.params.id);
  const equipment = await db.collection("healthcare_equipment").findOne({ ...scoped(actor), _id: id }, { projection: { _id: 1 } });
  if (!equipment) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy thiết bị trong chi nhánh hiện tại.");
  const items = await db.collection("healthcare_equipment_requests").find({ ...scoped(actor), equipmentId: id })
    .sort({ createdAt: -1, _id: -1 }).limit(100).toArray();
  res.json({ items: items.map(publicDocument) });
}));

healthcareEquipmentRouter.get("/:id", route(async (req, res, db, actor) => {
  const id = parse(recordId, req.params.id);
  const equipment = await db.collection("healthcare_equipment").findOne({ ...scoped(actor), _id: id });
  if (!equipment) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy thiết bị trong chi nhánh hiện tại.");
  res.json(publicDocument(equipment));
}));

healthcareEquipmentRouter.post("/", requirePermission("healthcare:manage") as RequestHandler, route(async (req, res, db, actor) => {
  const value = parse(equipmentCreateInput, req.body);
  const timestamp = now();
  const equipment = {
    _id: randomUUID(), ...scoped(actor), ...value, revision: 1,
    createdAt: timestamp, updatedAt: timestamp, createdBy: actor.actorId, updatedBy: actor.actorId,
  };
  try {
    await db.collection("healthcare_equipment").insertOne(equipment);
  } catch (error: any) {
    if (error?.code === 11000) throw new ConflictError("CONFLICT", "Mã thiết bị đã được sử dụng trong chi nhánh.");
    throw error;
  }
  res.status(201).json(publicDocument(equipment));
}));

healthcareEquipmentRouter.patch("/:id", requirePermission("healthcare:manage") as RequestHandler, route(async (req, res, db, actor) => {
  const id = parse(recordId, req.params.id);
  const { revision: expectedRevision, ...value } = parse(equipmentUpdateInput, req.body);
  const collection = db.collection("healthcare_equipment");
  const current = await collection.findOne({ ...scoped(actor), _id: id });
  if (!current) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy thiết bị trong chi nhánh hiện tại.");
  if (["requested", "in-use"].includes(current.status)) throw new ConflictError("CONFLICT", "Thiết bị đang trong quy trình mượn/trả nên chưa thể sửa trạng thái.");
  if (value.status === "retired" && current.status !== "retired") throw new ValidationError("VALIDATION_FAILED", "Dùng thao tác ngừng sử dụng để xác nhận thanh lý thiết bị.", { fields: ["status"] });
  const result = await collection.findOneAndUpdate(
    { ...scoped(actor), _id: id, revision: expectedRevision },
    { $set: { ...value, updatedAt: now(), updatedBy: actor.actorId }, $inc: { revision: 1 } },
    { returnDocument: "after" },
  );
  if (!result) throw new ConflictError("RESOURCE_VERSION_CONFLICT", "Thiết bị đã được cập nhật ở nơi khác. Hãy tải lại danh sách.");
  res.json(publicDocument(result));
}));

healthcareEquipmentRouter.delete("/:id", requirePermission("healthcare:manage") as RequestHandler, route(async (req, res, db, actor) => {
  const id = parse(recordId, req.params.id);
  const result = await db.collection("healthcare_equipment").findOneAndUpdate(
    { ...scoped(actor), _id: id, status: { $in: ["available", "maintenance", "retired"] } },
    { $set: { status: "retired", updatedAt: now(), updatedBy: actor.actorId }, $inc: { revision: 1 } },
    { returnDocument: "after" },
  );
  if (!result) {
    const exists = await db.collection("healthcare_equipment").findOne({ ...scoped(actor), _id: id }, { projection: { status: 1 } });
    if (!exists) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy thiết bị trong chi nhánh hiện tại.");
    throw new ConflictError("CONFLICT", "Không thể ngừng sử dụng thiết bị đang có người mượn hoặc yêu cầu chờ duyệt.");
  }
  res.json(publicDocument(result));
}));

healthcareEquipmentRouter.post("/:id/borrow-requests", route(async (req, res, db, actor) => {
  const id = parse(recordId, req.params.id);
  const value = parse(borrowRequestInput, req.body);
  const equipmentCollection = db.collection("healthcare_equipment");
  const equipment = await equipmentCollection.findOne({ ...scoped(actor), _id: id, status: "available" });
  if (!equipment) throw new ConflictError("CONFLICT", "Thiết bị không còn sẵn sàng để mượn.");
  const timestamp = now();
  const requestId = randomUUID();
  const request = {
    _id: requestId, ...scoped(actor), equipmentId: id, equipmentCode: equipment.code, equipmentName: equipment.name,
    employeeId: actor.actorId, employeeName: String((req.user as any)?.displayName || "Nhân viên"),
    requestType: "borrow", status: "pending", reason: value.reason, expectedReturnAt: value.expectedReturnAt,
    rejectionReason: "", revision: 1, createdAt: timestamp, updatedAt: timestamp,
    createdBy: actor.actorId, updatedBy: actor.actorId,
  };
  await db.collection("healthcare_equipment_requests").insertOne(request);
  const reserved = await equipmentCollection.findOneAndUpdate(
    { ...scoped(actor), _id: id, status: "available", revision: equipment.revision },
    { $set: { status: "requested", updatedAt: timestamp, updatedBy: actor.actorId }, $inc: { revision: 1 } },
    { returnDocument: "after" },
  );
  if (!reserved) {
    await db.collection("healthcare_equipment_requests").deleteOne({ ...scoped(actor), _id: requestId });
    throw new ConflictError("CONFLICT", "Thiết bị vừa được người khác yêu cầu mượn.");
  }
  res.status(201).json(publicDocument(request));
}));

healthcareEquipmentRouter.post("/:id/return-requests", route(async (req, res, db, actor) => {
  const id = parse(recordId, req.params.id);
  const value = parse(returnRequestInput, req.body);
  const equipment = await db.collection("healthcare_equipment").findOne({ ...scoped(actor), _id: id, status: "in-use", currentBorrowerId: actor.actorId });
  if (!equipment) throw new ForbiddenError("FORBIDDEN", "Chỉ người đang mượn thiết bị mới được gửi yêu cầu trả.");
  const pending = await db.collection("healthcare_equipment_requests").findOne({ ...scoped(actor), equipmentId: id, requestType: "return", status: "pending" });
  if (pending) throw new ConflictError("CONFLICT", "Thiết bị đã có yêu cầu trả đang chờ duyệt.");
  const timestamp = now();
  const request = {
    _id: randomUUID(), ...scoped(actor), equipmentId: id, equipmentCode: equipment.code, equipmentName: equipment.name,
    employeeId: actor.actorId, employeeName: String((req.user as any)?.displayName || "Nhân viên"),
    requestType: "return", status: "pending", reason: value.note, expectedReturnAt: "", rejectionReason: "",
    revision: 1, createdAt: timestamp, updatedAt: timestamp, createdBy: actor.actorId, updatedBy: actor.actorId,
  };
  await db.collection("healthcare_equipment_requests").insertOne(request);
  res.status(201).json(publicDocument(request));
}));

healthcareEquipmentRouter.delete("/requests/:requestId", route(async (req, res, db, actor) => {
  const id = parse(recordId, req.params.requestId);
  const requests = db.collection("healthcare_equipment_requests");
  const request = await requests.findOne({ ...scoped(actor), _id: id, employeeId: actor.actorId, status: "pending" });
  if (!request) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy yêu cầu đang chờ của bạn.");
  if (request.requestType === "borrow") {
    const restored = await db.collection("healthcare_equipment").findOneAndUpdate(
      { ...scoped(actor), _id: request.equipmentId, status: "requested" },
      { $set: { status: "available", updatedAt: now(), updatedBy: actor.actorId }, $inc: { revision: 1 } },
      { returnDocument: "after" },
    );
    if (!restored) throw new ConflictError("CONFLICT", "Trạng thái thiết bị đã thay đổi; yêu cầu chưa được hủy.");
  }
  const updated = await requests.findOneAndUpdate(
    { ...scoped(actor), _id: id, status: "pending" },
    { $set: { status: "cancelled", updatedAt: now(), updatedBy: actor.actorId }, $inc: { revision: 1 } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ConflictError("CONFLICT", "Yêu cầu đã được xử lý.");
  res.json(publicDocument(updated));
}));

healthcareEquipmentRouter.patch("/requests/:requestId", requirePermission("healthcare:manage") as RequestHandler, route(async (req, res, db, actor) => {
  const id = parse(recordId, req.params.requestId);
  const { decision, rejectionReason } = parse(decisionInput, req.body);
  const requests = db.collection("healthcare_equipment_requests");
  const current = await requests.findOne({ ...scoped(actor), _id: id, status: "pending" });
  if (!current) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy yêu cầu đang chờ duyệt.");
  const equipmentCollection = db.collection("healthcare_equipment");
  if (current.requestType === "borrow") {
    const equipmentPatch = decision === "approved"
      ? { status: "in-use", currentBorrowerId: current.employeeId, currentBorrowerName: current.employeeName, expectedReturnAt: current.expectedReturnAt }
      : { status: "available" };
    const equipment = await equipmentCollection.findOneAndUpdate(
      { ...scoped(actor), _id: current.equipmentId, status: "requested" },
      { $set: { ...equipmentPatch, updatedAt: now(), updatedBy: actor.actorId }, $inc: { revision: 1 } },
      { returnDocument: "after" },
    );
    if (!equipment) throw new ConflictError("CONFLICT", "Trạng thái thiết bị đã thay đổi. Hãy tải lại danh sách.");
  } else if (decision === "approved") {
    const equipment = await equipmentCollection.findOneAndUpdate(
      { ...scoped(actor), _id: current.equipmentId, status: "in-use" },
      { $set: { status: "available", updatedAt: now(), updatedBy: actor.actorId }, $unset: { currentBorrowerId: "", currentBorrowerName: "", expectedReturnAt: "" }, $inc: { revision: 1 } },
      { returnDocument: "after" },
    );
    if (!equipment) throw new ConflictError("CONFLICT", "Trạng thái thiết bị đã thay đổi. Hãy tải lại danh sách.");
  }
  const updated = await requests.findOneAndUpdate(
    { ...scoped(actor), _id: id, status: "pending" },
    { $set: { status: decision, rejectionReason: decision === "rejected" ? rejectionReason : "", updatedAt: now(), updatedBy: actor.actorId }, $inc: { revision: 1 } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ConflictError("CONFLICT", "Yêu cầu đã được xử lý.");
  res.json(publicDocument(updated));
}));
