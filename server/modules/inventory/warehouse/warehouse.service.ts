import type { ClientSession } from "mongoose";
import { BranchModel } from "../../../model/branch.model";
import { WarehouseModel } from "../../../model/warehouse.model";

function normalizeCompanyCode(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export async function ensureDefaultWarehouse(companyCode: string, branchId: string, session?: ClientSession) {
  const normalizedCompanyCode = normalizeCompanyCode(companyCode);
  const existingQuery = WarehouseModel.findOne({ companyCode: normalizedCompanyCode, branchId, isDefault: true, isActive: true });
  if (session) existingQuery.session(session);
  const existing = await existingQuery.lean();
  if (existing) return existing;

  const branchQuery = BranchModel.findOne({ _id: branchId, companyCode: normalizedCompanyCode, isActive: true });
  if (session) branchQuery.session(session);
  const branch = await branchQuery.lean();
  const branchCode = normalizeCompanyCode(String(branch?.code || branchId).replace(/[^A-Z0-9_-]/gi, "").slice(0, 24)) || "MAIN";
  const createQuery = WarehouseModel.findOneAndUpdate(
    { companyCode: normalizedCompanyCode, branchId, isDefault: true },
    { $setOnInsert: { companyCode: normalizedCompanyCode, branchId, code: `KHO-${branchCode}`, name: `Kho bán hàng - ${branch?.name || branchId}`, kind: "selling", isDefault: true, isActive: true } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  if (session) createQuery.session(session);
  try {
    return await createQuery.lean();
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    const retryQuery = WarehouseModel.findOne({ companyCode: normalizedCompanyCode, branchId, isDefault: true });
    if (session) retryQuery.session(session);
    return retryQuery.lean();
  }
}

export async function listWarehouses(companyCode: string, branchId?: string) {
  return WarehouseModel.find({ companyCode: normalizeCompanyCode(companyCode), ...(branchId ? { branchId } : {}) }).sort({ branchId: 1, isDefault: -1, name: 1 }).lean();
}

export async function getWarehouse(companyCode: string, branchId: string, warehouseId: string) {
  return WarehouseModel.findOne({ _id: warehouseId, companyCode: normalizeCompanyCode(companyCode), branchId, isActive: true }).lean();
}
