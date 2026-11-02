import type { Request, Response } from "express";
import { Types } from "mongoose";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { InventoryLedgerEntryModel } from "../../../model/inventory-ledger-entry.model";
import { BranchModel } from "../../../model/branch.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { WarehouseModel } from "../../../model/warehouse.model";
import { listWarehouses } from "./warehouse.service";

function company(req: Request) { return String((req as any).user?.companyCode || "").trim().toUpperCase(); }
function branch(req: Request) { return String((req as any).user?.branchId || "").trim(); }
function canReadCompanyScope(req: Request) { return ["admin", "superadmin"].includes(String((req as any).user?.role || "")); }
async function effectiveBranch(req: Request, companyCode: string, accountBranchId: string) {
  const requestedBranchId = String(req.query.branchId || "").trim();
  if (requestedBranchId && !/^[a-f\d]{24}$/i.test(requestedBranchId)) throw Object.assign(new Error("Chi nhánh được chọn không hợp lệ."), { statusCode: 400 });
  if (accountBranchId && requestedBranchId && requestedBranchId !== accountBranchId) throw Object.assign(new Error("Bạn chỉ được thao tác tại chi nhánh của mình."), { statusCode: 403 });
  if (accountBranchId) return accountBranchId;
  if (!canReadCompanyScope(req)) throw Object.assign(new Error("Tài khoản cần được gán vào chi nhánh."), { statusCode: 400 });
  if (requestedBranchId) {
    const selectedBranch = await BranchModel.findOne({ _id: requestedBranchId, companyCode, isActive: true }).select("_id").lean();
    if (!selectedBranch) throw Object.assign(new Error("Không tìm thấy chi nhánh đang hoạt động trong công ty."), { statusCode: 400 });
  }
  return requestedBranchId;
}
function error(res: Response, problem: any) { return res.status(Number(problem?.statusCode) || 400).json({ status: "error", message: problem?.message || "Không thể tải dữ liệu kho." }); }

export const warehouseController = {
  list: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req); const branchId = branch(req);
      if (!companyCode) throw Object.assign(new Error("Vui lòng chọn công ty."), { statusCode: 400 });
      const effectiveBranchId = await effectiveBranch(req, companyCode, branchId);
      const warehouses = await listWarehouses(companyCode, effectiveBranchId || undefined);
      const branchIds = [...new Set(warehouses.map((warehouse) => String(warehouse.branchId || "")).filter(Boolean))];
      const branches = await BranchModel.find({ companyCode, _id: { $in: branchIds } }).select("_id name").lean();
      const branchNames = new Map(branches.map((item: any) => [String(item._id), item.name]));
      return res.json({ status: "success", data: warehouses.map((warehouse) => ({ ...warehouse, branchName: branchNames.get(String(warehouse.branchId || "")) || "" })) });
    } catch (problem) { return error(res, problem); }
  },
  balances: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req); const accountBranchId = branch(req);
      if (!companyCode) throw Object.assign(new Error("Vui lòng chọn công ty."), { statusCode: 400 });
      const branchId = await effectiveBranch(req, companyCode, accountBranchId);
      const warehouseId = String(req.query.warehouseId || "").trim();
      const physicalWarehouses = await listWarehouses(companyCode, branchId || undefined);
      if (warehouseId && !physicalWarehouses.some((warehouse) => String(warehouse._id) === warehouseId)) {
        throw Object.assign(new Error("Không tìm thấy kho trong chi nhánh hiện tại."), { statusCode: 404 });
      }
      const warehouseIds = physicalWarehouses.map((warehouse) => String(warehouse._id)).filter((id) => !warehouseId || id === warehouseId);
      const branchScope = branchId ? { branchId } : {};
      const items = await InventoryBalanceModel.find({ companyCode, ...branchScope, warehouseId: { $in: warehouseIds } }).sort({ sku: 1 }).lean();
      const catalogProducts = await ProductCatalogModel.find({ companyCode, status: "active", productType: { $in: ["physical", "bundle"] } }).select("name mediaIds").lean();
      const activeProductIds = catalogProducts.map((product) => String(product._id));
      const productIds = [...new Set([...items.map((i) => i.productId), ...activeProductIds])];
      const activeVariants = await ProductVariantModel.find({ companyCode, productId: { $in: activeProductIds }, status: "active", trackingMode: { $in: ["quantity", "serial", "unit_barcode", "lot"] } }).select("_id productId sku barcode displayName mediaIds trackingMode").sort({ sku: 1 }).lean();
      const variantIds = [...new Set([...items.map((item) => item.variantId).filter(Boolean), ...activeVariants.map((variant) => String(variant._id))])];
      const [products, variants] = await Promise.all([
        ProductCatalogModel.find({ _id: { $in: productIds }, companyCode }).select("name mediaIds status productType").lean(),
        ProductVariantModel.find({ _id: { $in: variantIds }, companyCode }).select("productId sku barcode mediaIds displayName trackingMode status").lean(),
      ]);
      const warehouseMap = new Map(physicalWarehouses.map((warehouse: any) => [String(warehouse._id), warehouse] as const));
      const branchIds = [...new Set(physicalWarehouses.map((warehouse: any) => String(warehouse.branchId || "")).filter(Boolean))];
      const branches = await BranchModel.find({ companyCode, _id: { $in: branchIds } }).select("_id name").lean();
      const branchNames = new Map(branches.map((item: any) => [String(item._id), item.name]));
      const ledgerKeys = await InventoryLedgerEntryModel.aggregate([
        { $match: { companyCode, ...branchScope, warehouseId: { $in: warehouseIds }, variantId: { $in: variantIds } } },
        { $group: { _id: { warehouseId: "$warehouseId", variantId: "$variantId" } } },
      ]);
      const moved = new Set(ledgerKeys.map((row: any) => `${row._id.warehouseId}:${row._id.variantId}`));
      const productMap = new Map(products.map((product) => [String(product._id), product] as const));
      const variantMap = new Map(variants.map((variant) => [String(variant._id), variant] as const));
      const enrichedItems: Array<Record<string, unknown>> = items.map((item) => {
        const product = productMap.get(item.productId);
        const variant = item.variantId ? variantMap.get(item.variantId) : undefined;
        const warehouse = warehouseMap.get(String(item.warehouseId || ""));
        return { ...item, hasBalanceRecord: true, hasMovementHistory: Boolean(item.variantId && moved.has(`${item.warehouseId}:${item.variantId}`)), productName: product?.name || "Sản phẩm không xác định", productMediaUrl: product?.mediaIds?.[0], variantMediaUrl: variant?.mediaIds?.[0], variantName: variant?.displayName, trackingMode: variant?.trackingMode, warehouseName: warehouse?.name || "", branchName: branchNames.get(String(item.branchId || warehouse?.branchId || "")) || "" };
      });
      const existing = new Set(items.map((item) => `${item.warehouseId}:${item.variantId || `legacy:${item.sku}`}`));
      if (String(req.query.includeCatalogZeroBalances || "") === "true") {
        const activeProductSet = new Set(activeProductIds);
        for (const warehouse of physicalWarehouses.filter((item) => !warehouseId || String(item._id) === warehouseId)) {
          for (const variant of activeVariants) {
            const productId = String(variant.productId);
            const key = `${String(warehouse._id)}:${String(variant._id)}`;
            if (!activeProductSet.has(productId) || existing.has(key)) continue;
            const product = productMap.get(productId);
            enrichedItems.push({
              _id: `zero:${String(warehouse._id)}:${String(variant._id)}`,
              hasBalanceRecord: false,
              hasMovementHistory: false,
              companyCode,
              branchId: String(warehouse.branchId || branchId),
              warehouseId: String(warehouse._id),
              warehouseName: String(warehouse.name || ""),
              branchName: branchNames.get(String(warehouse.branchId || "")) || "",
              productId,
              variantId: String(variant._id),
              sku: variant.sku,
              productName: product?.name || "Sản phẩm",
              productMediaUrl: product?.mediaIds?.[0],
              variantMediaUrl: variant.mediaIds?.[0],
              variantName: variant.displayName,
              trackingMode: variant.trackingMode,
              quantity: 0,
              reservedQuantity: 0,
              minStock: 0,
              averageCost: 0,
              version: 0,
            });
          }
        }
      }
      enrichedItems.sort((a, b) => String(a.sku).localeCompare(String(b.sku), "vi") || String(a.warehouseId).localeCompare(String(b.warehouseId)));
      return res.json({ status: "success", data: enrichedItems });
    } catch (problem) { return error(res, problem); }
  },
  updateThresholds: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req); const accountBranchId = branch(req);
      if (!companyCode) throw Object.assign(new Error("Vui lòng chọn công ty."), { statusCode: 400 });
      const branchId = await effectiveBranch(req, companyCode, accountBranchId);
      const minStock = Number(req.body?.minStock);
      const maxStockInput = req.body?.maxStock;
      const maxStock = maxStockInput === "" || maxStockInput === null || maxStockInput === undefined ? undefined : Number(maxStockInput);
      if (!Number.isFinite(minStock) || minStock < 0 || (maxStock !== undefined && (!Number.isFinite(maxStock) || maxStock < minStock))) {
        throw Object.assign(new Error("Mức tối thiểu phải từ 0 và mức tối đa phải lớn hơn hoặc bằng mức tối thiểu."), { statusCode: 400 });
      }
      let balance: any;
      const virtual = /^zero:([a-f\d]{24}):([a-f\d]{24})$/i.exec(String(req.params.id));
      if (virtual) {
        const [, targetWarehouseId, variantId] = virtual;
        const warehouses = await listWarehouses(companyCode, branchId || undefined);
        const targetWarehouse = warehouses.find((warehouse) => String(warehouse._id) === targetWarehouseId);
        if (!targetWarehouse || !Types.ObjectId.isValid(variantId)) {
          throw Object.assign(new Error("SKU hoặc kho không hợp lệ."), { statusCode: 404 });
        }
        const targetBranchId = String(targetWarehouse.branchId || branchId || "");
        if (!targetBranchId) throw Object.assign(new Error("Không xác định được chi nhánh của kho."), { statusCode: 400 });
        const variant = await ProductVariantModel.findOne({ _id: variantId, companyCode, status: "active", trackingMode: { $in: ["quantity", "serial", "unit_barcode", "lot"] } }).lean();
        const product = variant && await ProductCatalogModel.findOne({ _id: variant.productId, companyCode, status: "active", productType: { $in: ["physical", "bundle"] } }).lean();
        if (!variant || !product) throw Object.assign(new Error("Không tìm thấy SKU đang quản lý tồn."), { statusCode: 404 });
        balance = await InventoryBalanceModel.findOneAndUpdate(
          { companyCode, branchId: targetBranchId, warehouseId: targetWarehouseId, productId: String(product._id), variantId: String(variant._id) },
          { ...(maxStock === undefined ? { $unset: { maxStock: 1 } } : {}), $set: { minStock, ...(maxStock === undefined ? {} : { maxStock }) }, $setOnInsert: { companyCode, branchId: targetBranchId, warehouseId: targetWarehouseId, productId: String(product._id), variantId: String(variant._id), sku: variant.sku, quantity: 0, reservedQuantity: 0, averageCost: 0, version: 0 } },
          { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, runValidators: true },
        ).lean();
      } else {
        balance = await InventoryBalanceModel.findOneAndUpdate(
          { _id: req.params.id, companyCode, ...(branchId ? { branchId } : {}) },
          maxStock === undefined ? { $set: { minStock }, $unset: { maxStock: 1 } } : { $set: { minStock, maxStock } },
          { returnDocument: "after" },
        ).lean();
      }
      if (!balance) throw Object.assign(new Error("Không tìm thấy SKU trong kho."), { statusCode: 404 });
      return res.json({ status: "success", data: balance });
    } catch (problem) { return error(res, problem); }
  },
};
