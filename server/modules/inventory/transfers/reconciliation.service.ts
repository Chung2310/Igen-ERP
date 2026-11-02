import { Types } from "mongoose";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { InventoryLedgerEntryModel } from "../../../model/inventory-ledger-entry.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { WarehouseModel } from "../../../model/warehouse.model";
import { SerialUnitModel } from "../serials/serial-unit.model";

export async function reconcileWarehouse(companyCode: string, branchId: string, warehouseId: string) {
  if (!Types.ObjectId.isValid(warehouseId)) throw Object.assign(new Error("Kho không hợp lệ."), { status: 400 });
  const warehouse = await WarehouseModel.findOne({ _id: warehouseId, companyCode, branchId }).lean();
  if (!warehouse) throw Object.assign(new Error("Không tìm thấy kho trong chi nhánh."), { status: 404 });
  const [balances, ledger, serials] = await Promise.all([
    InventoryBalanceModel.find({ companyCode, branchId, warehouseId }).lean(),
    InventoryLedgerEntryModel.aggregate<{ _id: { variantId?: string; productId: string; sku: string }; quantity: number; count: number }>([
      { $match: { companyCode, branchId, warehouseId } },
      { $group: { _id: { variantId: "$variantId", productId: "$productId", sku: "$sku" }, quantity: { $sum: "$quantityDelta" }, count: { $sum: 1 } } },
    ]),
    SerialUnitModel.aggregate<{ _id: { variantId?: string; productId: string; sku: string }; count: number }>([
      { $match: { companyCode, branchId, warehouseId, status: "in_stock" } },
      { $group: { _id: { variantId: "$variantId", productId: "$productId", sku: "$sku" }, count: { $sum: 1 } } },
    ]),
  ]);
  const key = (value: { variantId?: string; productId: string; sku: string }) => `${value.variantId || ""}|${value.productId}|${value.sku}`;
  const ledgerMap = new Map(ledger.map((entry) => [key(entry._id), entry]));
  const serialMap = new Map(serials.map((entry) => [key(entry._id), entry]));
  const balanceMap = new Map(balances.map((entry) => [key(entry), entry]));
  const keys = new Set([...ledgerMap.keys(), ...serialMap.keys(), ...balanceMap.keys()]);
  const variantIds = [...new Set([
    ...balances.map((balance) => String(balance.variantId || "")),
    ...serials.map((entry) => String(entry._id.variantId || "")),
    ...ledger.map((entry) => String(entry._id.variantId || "")),
  ].filter((id) => Types.ObjectId.isValid(id)))];
  const variants = await ProductVariantModel.find({ companyCode, _id: { $in: variantIds } }).select("_id trackingMode").lean();
  const tracking = new Map(variants.map((variant) => [String(variant._id), variant.trackingMode]));
  const differences = [];
  for (const itemKey of keys) {
    const balance = balanceMap.get(itemKey);
    const ledgerEntry = ledgerMap.get(itemKey);
    const serialEntry = serialMap.get(itemKey);
    const quantity = Number(balance?.quantity || 0);
    const ledgerQuantity = Number(ledgerEntry?.quantity || 0);
    const serialCount = Number(serialEntry?.count || 0);
    const mode = tracking.get(String(balance?.variantId || ledgerEntry?._id.variantId || serialEntry?._id.variantId || ""));
    const ledgerDifference = quantity - ledgerQuantity;
    const serialDifference = mode === "serial" || mode === "unit_barcode" ? quantity - serialCount : null;
    if (ledgerDifference || serialDifference || Number(balance?.reservedQuantity || 0) > quantity) {
      differences.push({ sku: balance?.sku || ledgerEntry?._id.sku || serialEntry?._id.sku, productId: balance?.productId || ledgerEntry?._id.productId || serialEntry?._id.productId,
        variantId: balance?.variantId || ledgerEntry?._id.variantId || serialEntry?._id.variantId,
        balanceQuantity: quantity, ledgerQuantity, ledgerDifference, serialCount: serialDifference === null ? undefined : serialCount,
        serialDifference, reservedQuantity: Number(balance?.reservedQuantity || 0), ledgerEntryCount: ledgerEntry?.count || 0 });
    }
  }
  return { warehouseId, checkedAt: new Date(), checkedProducts: keys.size, differenceCount: differences.length, differences };
}
