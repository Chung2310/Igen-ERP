import type { ClientSession } from "mongoose";
import { SupplierModel } from "../../model/supplier.model";

type SupplierInput = { companyCode: string; code: string; name: string; status: string; updatedBy: string; roles?: string[] };

/** Catalog brand creation uses ERP's supplier records, preserving receipt/debt IDs. */
export async function saveSupplierPartner(input: SupplierInput, _details: unknown, supplierId?: string, session?: ClientSession) {
  const filter = { companyCode: input.companyCode, ...(supplierId ? { _id: supplierId } : { code: input.code }) };
  const supplier = await SupplierModel.findOneAndUpdate(filter, {
    $set: { name: input.name, status: input.status, updatedBy: input.updatedBy },
    $setOnInsert: { companyCode: input.companyCode, code: input.code, createdBy: input.updatedBy },
  }, { upsert: !supplierId, returnDocument: "after", runValidators: true, session });
  if (!supplier) throw Object.assign(new Error("Không tìm thấy nhà cung cấp."), { statusCode: 404 });
  return { ...supplier.toObject(), supplierId: String(supplier._id) };
}
