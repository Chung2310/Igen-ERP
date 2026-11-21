import { Router, type RequestHandler } from "express";
import { ObjectId, type Db } from "mongodb";
import Joi from "joi";
import { requirePermission } from "../../../middleware/auth";
import { ForbiddenError, NotFoundError } from "../../../errors/app-error";
import type { DirectoryKind } from "../../../../shared/healthcare-logistics";
import { route } from "./http";
import { scope, conflict, type Actor } from "./store";
import { input, revisionInput } from "./validation";

const text = Joi.string().trim().max(500).allow("").default("");
const schema = Joi.object({
  code: Joi.string().trim().uppercase().max(80).required(),
  name: Joi.string().trim().max(200).required(),
  active: Joi.boolean().default(true),
  phone: text,
  email: Joi.string().email().allow("").default(""),
  address: text,
  taxCode: text,
  contactPerson: text,
  location: text,
  managerName: text,
  managerPhone: text,
  notes: text,
});
type DirectoryInput = {
  code: string;
  name: string;
  active: boolean;
  phone: string;
  email: string;
  address: string;
  taxCode: string;
  contactPerson: string;
  location: string;
  managerName: string;
  managerPhone: string;
  notes: string;
};
export function directoryScope(actor: Actor, kind: DirectoryKind) {
  return kind === "warehouses"
    ? scope(actor)
    : {
        companyCode: actor.companyCode,
        $or: [{ branchId: actor.branchId }, { branchId: { $exists: false } }, { branchId: "" }, { branchId: null }],
      };
}
function present(row: Record<string, any>, kind: DirectoryKind) {
  return {
    _id: String(row._id),
    code: row.code,
    name: row.name,
    revision: row.revision || 1,
    active:
      kind === "suppliers"
        ? row.status === "active"
        : kind === "categories"
          ? row.status === "Đang dùng"
          : row.isActive !== false,
    editable: row.healthcareManaged === true,
    phone: row.phone || "",
    email: row.email || "",
    address: row.address || "",
    taxCode: row.taxCode || "",
    contactPerson: row.healthcareDetails?.contactPerson || "",
    location: row.healthcareDetails?.location || "",
    managerName: row.healthcareDetails?.managerName || "",
    managerPhone: row.healthcareDetails?.managerPhone || "",
    notes: row.notes || row.description || "",
  };
}
export async function saveDirectory(
  db: Db,
  actor: Actor,
  kind: DirectoryKind,
  data: DirectoryInput,
  id?: string,
  revision?: number,
) {
  const coll = db.collection(kind);
  const old = id ? await coll.findOne({ ...directoryScope(actor, kind), _id: new ObjectId(id) }) : null;
  if (id && !old) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy danh mục trong chi nhánh.");
  if (old && old.healthcareManaged !== true)
    throw new ForbiddenError("FORBIDDEN", "Danh mục dùng chung được quản lý tại phân hệ gốc.");
  if (old && (old.revision || 1) !== revision) conflict();
  if (old && !data.active && kind === "warehouses") {
    const inUse = await db
      .collection("healthcare_supply_balances")
      .findOne({ ...scope(actor), warehouseId: id, quantity: { $gt: 0 } });
    const retailUse = await db
      .collection("inventorybalances")
      .findOne({ companyCode: actor.companyCode, warehouseId: id, quantity: { $gt: 0 } });
    if (inUse || retailUse) conflict("Kho còn tồn, không thể ngừng sử dụng.");
  }
  if (
    old &&
    kind === "categories" &&
    data.name !== old.name &&
    (await db.collection("healthcare_supplies").findOne({ ...scope(actor), category: old.name }))
  )
    conflict("Phân loại đã gắn với vật tư. Giữ tên để bảo toàn liên kết.");
  const duplicate = await coll.findOne({
    companyCode: actor.companyCode,
    code: data.code,
    ...(id ? { _id: { $ne: new ObjectId(id) } } : {}),
  });
  if (duplicate) conflict("Mã danh mục đã tồn tại trong doanh nghiệp.");
  const common = {
    code: data.code,
    name: data.name,
    ...scope(actor),
    healthcareManaged: true,
    updatedAt: new Date(),
    updatedBy: actor.actorId,
    revision: (old?.revision || 0) + 1,
    healthcareDetails: {
      contactPerson: data.contactPerson,
      location: data.location,
      managerName: data.managerName,
      managerPhone: data.managerPhone,
    },
  };
  const fields =
    kind === "suppliers"
      ? {
          phone: data.phone,
          email: data.email,
          address: data.address,
          taxCode: data.taxCode,
          notes: data.notes,
          status: data.active ? "active" : "inactive",
        }
      : kind === "categories"
        ? { description: data.notes, status: data.active ? "Đang dùng" : "Tạm khóa" }
        : { kind: "other", isDefault: false, isActive: data.active, notes: data.notes };
  if (old) {
    const result = await coll.findOneAndUpdate(
      { _id: old._id, ...directoryScope(actor, kind), revision },
      { $set: { ...common, ...fields } },
      { returnDocument: "after" },
    );
    if (!result) conflict();
    return present(result, kind);
  }
  const row = { _id: new ObjectId(), ...common, ...fields, createdAt: new Date(), createdBy: actor.actorId };
  await coll.insertOne(row);
  return present(row, kind);
}
export const directoriesRouter = Router();
for (const kind of ["suppliers", "warehouses", "categories"] as const) {
  directoriesRouter.get(
    `/directories/${kind}`,
    requirePermission("healthcare:read") as RequestHandler,
    route(async (req, res, db, actor) => {
      const q = input<{ q: string; page: number; active: string }>(
        Joi.object({
          q: text,
          page: Joi.number().integer().min(1).default(1),
          active: Joi.string().valid("all", "true", "false").default("all"),
        }),
        req.query,
      );
      const filter: Record<string, unknown> = { ...directoryScope(actor, kind) };
      if (q.q) filter.name = { $regex: q.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      if (q.active !== "all")
        Object.assign(
          filter,
          kind === "warehouses"
            ? { isActive: q.active === "true" }
            : {
                status:
                  kind === "suppliers"
                    ? q.active === "true"
                      ? "active"
                      : "inactive"
                    : q.active === "true"
                      ? "Đang dùng"
                      : "Tạm khóa",
              },
        );
      const coll = db.collection(kind);
      const [items, total] = await Promise.all([
        coll
          .find(filter)
          .sort({ name: 1 })
          .skip((q.page - 1) * 25)
          .limit(25)
          .toArray(),
        coll.countDocuments(filter),
      ]);
      res.json({ items: items.map((row) => present(row, kind)), total, page: q.page, pageSize: 25 });
    }),
  );
  directoriesRouter.post(
    `/directories/${kind}`,
    requirePermission("healthcare:manage") as RequestHandler,
    route(async (req, res, db, actor) =>
      res.status(201).json(await saveDirectory(db, actor, kind, input(schema, req.body))),
    ),
  );
  directoriesRouter.patch(
    `/directories/${kind}/:id`,
    requirePermission("healthcare:manage") as RequestHandler,
    route(async (req, res, db, actor) => {
      const id = input<string>(Joi.string().hex().length(24).required(), req.params.id);
      const { revision, ...body } = req.body || {};
      res.json(await saveDirectory(db, actor, kind, input(schema, body), id, input(revisionInput, revision)));
    }),
  );
}
