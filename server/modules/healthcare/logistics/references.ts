import type { Db } from "mongodb";
import { ValidationError } from "../../../errors/app-error";
import type { LogisticsReferences } from "../../../../shared/healthcare-logistics";
import { scope, type Actor } from "./store";

export async function references(db: Db, actor: Actor): Promise<LogisticsReferences> {
  const read = async (name: string, filter: object) =>
    (await db.collection(name).find(filter).project({ name: 1 }).sort({ name: 1 }).limit(1000).toArray()).map(
      (row) => ({ _id: String(row._id), name: String(row.name || "") }),
    );
  const [warehouses, suppliers, departments, rooms, categories] = await Promise.all([
    read("warehouses", { ...scope(actor), isActive: true }),
    read("suppliers", {
      companyCode: actor.companyCode,
      status: "active",
      $or: [{ branchId: actor.branchId }, { branchId: { $exists: false } }, { branchId: "" }],
    }),
    read("hrdepartments", { companyCode: actor.companyCode, isActive: true }),
    read("healthcare_catalog", { ...scope(actor), kind: "room", active: true }),
    read("categories", {
      companyCode: actor.companyCode,
      status: "Đang dùng",
      $or: [{ branchId: actor.branchId }, { branchId: { $exists: false } }, { branchId: "" }],
    }),
  ]);
  return { warehouses, suppliers, departments, rooms, categories };
}
export async function checkReferences(
  db: Db,
  actor: Actor,
  data: { warehouseId?: string; supplierId?: string; departmentId?: string; roomId?: string },
) {
  const refs = await references(db, actor);
  for (const [field, key] of [
    ["warehouseId", "warehouses"],
    ["supplierId", "suppliers"],
    ["departmentId", "departments"],
    ["roomId", "rooms"],
  ] as const) {
    if (data[field] && !refs[key].some((row) => row._id === data[field])) {
      throw new ValidationError("VALIDATION_FAILED", "Danh mục không hoạt động hoặc không thuộc phạm vi được phép.", {
        fields: [field],
      });
    }
  }
}
