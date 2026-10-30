import type { Request, Response } from "express";
import { Types } from "mongoose";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { InventoryLedgerEntryModel } from "../../../model/inventory-ledger-entry.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { listWarehouses } from "./warehouse.service";

function company(req: Request) { return String((req as any).user?.companyCode || "").trim().toUpperCase(); }
function branch(req: Request) { return String((req as any).user?.branchId || "").trim(); }
function error(res: Response, problem: any) { return res.status(Number(problem?.statusCode) || 400).json({ status: "error", message: problem?.message || "Không thể tải dữ liệu kho." }); }

export const warehouseController = {
  list: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req); const branchId = branch(req);
      if (!companyCode || !branchId) throw Object.assign(new Error("Vui lòng chọn công ty và chi nhánh."), { statusCode: 400 });
      return res.json({ status: "success", data: await listWarehouses(companyCode, branchId) });
    } catch (problem) { return error(res, problem); }
  },
  balances: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req); const branchId = branch(req);
      if (!companyCode || !branchId) throw Object.assign(new Error("Vui lòng chọn công ty và chi nhánh."), { statusCode: 400 });
      const warehouseId = String(req.query.warehouseId || "").trim();
      const physicalWarehouses = await listWarehouses(companyCode, branchId);
      if (warehouseId && !physicalWarehouses.some((warehouse) => String(warehouse._id) === warehouseId)) {
        throw Object.assign(new Error("Không tìm thấy kho trong chi nhánh hiện tại."), { statusCode: 404 });
      }
      const warehouseIds = physicalWarehouses.map((warehouse) => String(warehouse._id)).filter((id) => !warehouseId || id === warehouseId);
      const items = await InventoryBalanceModel.find({ companyCode, branchId, warehouseId: { $in: warehouseIds } }).sort({ sku: 1 }).lean();
      const catalogProducts = await ProductCatalogModel.find({ companyCode, status: "active", productType: { $in: ["physical", "bundle"] } }).select("name mediaIds").lean();
      const activeProductIds = catalogProducts.map((product) => String(product._id));
      const productIds = [...new Set([...items.map((i) => i.productId), ...activeProductIds])];
      const activeVariants = await ProductVariantModel.find({ companyCode, productId: { $in: activeProductIds }, status: "active", trackingMode: { $in: ["quantity", "serial", "unit_barcode", "lot"] } }).select("_id productId sku barcode displayName mediaIds trackingMode").sort({ sku: 1 }).lean();
      const variantIds = [...new Set([...items.map((item) => item.variantId).filter(Boolean), ...activeVariants.map((variant) => String(variant._id))])];
      const [products, variants] = await Promise.all([
        ProductCatalogModel.find({ _id: { $in: productIds }, companyCode }).select("name mediaIds status productType").lean(),
        ProductVariantModel.find({ _id: { $in: variantIds }, companyCode }).select("productId sku barcode mediaIds displayName trackingMode status").lean(),
      ]);
      const ledgerKeys = await InventoryLedgerEntryModel.aggregate([
        { $match: { companyCode, branchId, warehouseId: { $in: warehouseIds }, variantId: { $in: variantIds } } },
        { $group: { _id: { warehouseId: "$warehouseId", variantId: "$variantId" } } },
      ]);
      const moved = new Set(ledgerKeys.map((row: any) => `${row._id.warehouseId}:${row._id.variantId}`));
      const productMap = new Map(products.map((product) => [String(product._id), product] as const));
      const variantMap = new Map(variants.map((variant) => [String(variant._id), variant] as const));
      const enrichedItems: Array<Record<string, unknown>> = items.map((item) => {
        const product = productMap.get(item.productId);
        const variant = item.variantId ? variantMap.get(item.variantId) : undefined;
        return { ...item, hasBalanceRecord: true, hasMovementHistory: Boolean(item.variantId && moved.has(`${item.warehouseId}:${item.variantId}`)), productName: product?.name || "Sản phẩm không xác định", productMediaUrl: product?.mediaIds?.[0], variantMediaUrl: variant?.mediaIds?.[0], variantName: variant?.displayName, trackingMode: variant?.trackingMode };
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
              branchId,
              warehouseId: String(warehouse._id),
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
      const companyCode = company(req); const branchId = branch(req);
      if (!companyCode || !branchId) throw Object.assign(new Error("Vui lòng chọn công ty và chi nhánh."), { statusCode: 400 });
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
        const warehouses = await listWarehouses(companyCode, branchId);
        if (!warehouses.some((warehouse) => String(warehouse._id) === targetWarehouseId) || !Types.ObjectId.isValid(variantId)) {
          throw Object.assign(new Error("SKU hoặc kho không hợp lệ."), { statusCode: 404 });
        }
        const variant = await ProductVariantModel.findOne({ _id: variantId, companyCode, status: "active", trackingMode: { $in: ["quantity", "serial", "unit_barcode", "lot"] } }).lean();
        const product = variant && await ProductCatalogModel.findOne({ _id: variant.productId, companyCode, status: "active", productType: { $in: ["physical", "bundle"] } }).lean();
        if (!variant || !product) throw Object.assign(new Error("Không tìm thấy SKU đang quản lý tồn."), { statusCode: 404 });
        balance = await InventoryBalanceModel.findOneAndUpdate(
          { companyCode, branchId, warehouseId: targetWarehouseId, productId: String(product._id), variantId: String(variant._id) },
          { ...(maxStock === undefined ? { $unset: { maxStock: 1 } } : {}), $set: { minStock, ...(maxStock === undefined ? {} : { maxStock }) }, $setOnInsert: { companyCode, branchId, warehouseId: targetWarehouseId, productId: String(product._id), variantId: String(variant._id), sku: variant.sku, quantity: 0, reservedQuantity: 0, averageCost: 0, version: 0 } },
          { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, runValidators: true },
        ).lean();
      } else {
        balance = await InventoryBalanceModel.findOneAndUpdate(
          { _id: req.params.id, companyCode, branchId },
          maxStock === undefined ? { $set: { minStock }, $unset: { maxStock: 1 } } : { $set: { minStock, maxStock } },
          { returnDocument: "after" },
        ).lean();
      }
      if (!balance) throw Object.assign(new Error("Không tìm thấy SKU trong kho."), { statusCode: 404 });
      return res.json({ status: "success", data: balance });
    } catch (problem) { return error(res, problem); }
  },
};
