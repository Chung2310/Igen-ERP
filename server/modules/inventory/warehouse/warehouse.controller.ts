import type { Request, Response } from "express";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
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
      const products = await ProductCatalogModel.find({ _id: { $in: productIds }, companyCode }).select("name").lean();
      const productMap = new Map(products.map((p: any) => [String(p._id), p.name]));
      const enrichedItems = items.map((item) => ({ ...item, productName: productMap.get(item.productId) || "Sản phẩm không xác định" }));
      return res.json({ status: "success", data: enrichedItems });
    } catch (problem) { return error(res, problem); }
  },
};
