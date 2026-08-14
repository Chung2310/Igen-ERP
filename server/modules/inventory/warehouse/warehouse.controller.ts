import type { Request, Response } from "express";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
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
      const items = await InventoryBalanceModel.find({ companyCode, branchId, ...(warehouseId ? { warehouseId } : {}) }).sort({ sku: 1 }).lean();
      const productIds = [...new Set(items.map((i) => i.productId))];
      const [products, variants] = await Promise.all([
        ProductCatalogModel.find({ _id: { $in: productIds }, companyCode }).select("name mediaIds").lean(),
        ProductVariantModel.find({ _id: { $in: items.map((item) => item.variantId).filter(Boolean) }, companyCode }).select("mediaIds displayName").lean(),
      ]);
      const productMap = new Map(products.map((product: any) => [String(product._id), product]));
      const variantMap = new Map(variants.map((variant: any) => [String(variant._id), variant]));
      const enrichedItems = items.map((item) => {
        const product: any = productMap.get(item.productId);
        const variant: any = item.variantId ? variantMap.get(item.variantId) : undefined;
        return { ...item, productName: product?.name || "Sản phẩm không xác định", productMediaUrl: product?.mediaIds?.[0], variantMediaUrl: variant?.mediaIds?.[0], variantName: variant?.displayName };
      });
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
      const balance = await InventoryBalanceModel.findOneAndUpdate(
        { _id: req.params.id, companyCode, branchId },
        maxStock === undefined ? { $set: { minStock }, $unset: { maxStock: 1 } } : { $set: { minStock, maxStock } },
        { returnDocument: "after" },
      ).lean();
      if (!balance) throw Object.assign(new Error("Không tìm thấy SKU trong kho."), { statusCode: 404 });
      return res.json({ status: "success", data: balance });
    } catch (problem) { return error(res, problem); }
  },
};
