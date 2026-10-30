import { inventoryReceivingService } from "../../services/inventoryReceivingService";

export type SupplierPartnerOption = { _id: string; code: string; name: string; supplierId: string };

/** Connect the cloned inventory picker to ERP's existing supplier directory. */
export async function listSupplierPartners(): Promise<SupplierPartnerOption[]> {
  const suppliers = await inventoryReceivingService.listSuppliers({ status: "active" });
  return suppliers.map((supplier) => ({ _id: supplier._id, supplierId: supplier._id, code: supplier.code, name: supplier.name }));
}
