import type { Request, Response } from "express";
import { BranchModel } from "../../../model/branch.model";
import { getSerialHistory, listSerialUnits, registerSerialBatch, registerSerialUnit, transferSerialUnit, transitionSerialUnit } from "./serial-unit.service";
import { acceptSerialTransfer, cancelSerialTransfer, requestSerialTransfer } from "./serial-transfer.service";
import { allocateInternalBarcodes } from "./unit-barcode-allocator";

async function scope(req: Request) {
  const user = (req as any).user || {};
  const companyCode = String(user.companyCode || "").trim().toUpperCase();
  const accountBranchId = String(user.branchId || "").trim();
  const requestedBranchId = String(req.query.branchId || "").trim();
  if (!companyCode) throw Object.assign(new Error("Vui lòng chọn công ty."), { statusCode: 400 });
  if (requestedBranchId && !/^[a-f\d]{24}$/i.test(requestedBranchId)) throw Object.assign(new Error("Chi nhánh được chọn không hợp lệ."), { statusCode: 400 });
  if (accountBranchId && requestedBranchId && requestedBranchId !== accountBranchId) throw Object.assign(new Error("Bạn chỉ được thao tác tại chi nhánh của mình."), { statusCode: 403 });
  let branchId = accountBranchId;
  if (!branchId && ["admin", "superadmin"].includes(String(user.role || ""))) {
    branchId = requestedBranchId;
    if (!branchId) throw Object.assign(new Error("Hãy chọn chi nhánh theo tên trước khi thao tác với IMEI/serial."), { statusCode: 400 });
    const selected = await BranchModel.findOne({ _id: branchId, companyCode, isActive: true }).select("_id").lean();
    if (!selected) throw Object.assign(new Error("Không tìm thấy chi nhánh đang hoạt động trong công ty."), { statusCode: 400 });
  }
  if (!branchId) throw Object.assign(new Error("Vui lòng chọn công ty và chi nhánh."), { statusCode: 400 });
  return { companyCode, branchId, warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined };
}
function actor(req: Request) { return { id: String((req as any).user?.id || (req as any).user?._id || ""), name: String((req as any).user?.displayName || (req as any).user?.name || (req as any).user?.fullName || (req as any).user?.email || (req as any).user?.id || "") }; }
function sendError(res: Response, error: any) { return res.status(Number(error?.statusCode) || 400).json({ status: "error", code: error?.code, message: error?.message || "Không thể xử lý IMEI/serial." }); }

export const serialUnitController = {
  allocateBarcodes: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await allocateInternalBarcodes(Number(req.body?.count)) }); } catch (e) { return sendError(res, e); } },
  list: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await listSerialUnits(await scope(req), { serial: String(req.query.serial || ""), barcodes: String(req.query.barcodes || "").split(",").map((value) => value.trim()).filter(Boolean), sku: String(req.query.sku || ""), productId: String(req.query.productId || ""), variantId: String(req.query.variantId || ""), trackingMode: req.query.trackingMode as any, forSale: String(req.query.forSale || "") === "true", status: req.query.status as any, page: Number(req.query.page), limit: Number(req.query.limit) }) }); } catch (e) { return sendError(res, e); } },
  detail: async (req: Request, res: Response) => { try { const result = await listSerialUnits(await scope(req), { serial: req.params.id, limit: 1 }); if (!result.items[0]) return res.status(404).json({ status: "error", message: "Không tìm thấy IMEI/serial." }); return res.json({ status: "success", data: result.items[0] }); } catch (e) { return sendError(res, e); } },
  history: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await getSerialHistory(await scope(req), req.params.id) }); } catch (e) { return sendError(res, e); } },
  create: async (req: Request, res: Response) => { try { const currentScope = await scope(req); const data = Array.isArray(req.body?.serialNumbers) ? await registerSerialBatch(currentScope, req.body, actor(req)) : [await registerSerialUnit(currentScope, req.body, actor(req))]; return res.status(201).json({ status: "success", data }); } catch (e) { return sendError(res, e); } },
  transition: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await transitionSerialUnit(await scope(req), req.params.id, req.body, actor(req)) }); } catch (e) { return sendError(res, e); } },
  transfer: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await transferSerialUnit(await scope(req), req.params.id, req.body, actor(req)) }); } catch (e) { return sendError(res, e); } },
  requestTransfer: async (req: Request, res: Response) => { try { return res.status(201).json({ status: "success", data: await requestSerialTransfer(await scope(req), req.params.id, req.body, actor(req)) }); } catch (e) { return sendError(res, e); } },
  acceptTransfer: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await acceptSerialTransfer(await scope(req), req.params.id, req.body, actor(req)) }); } catch (e) { return sendError(res, e); } },
  cancelTransfer: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await cancelSerialTransfer(await scope(req), req.params.id, String(req.body?.reason || ""), actor(req), req.body?.transferId) }); } catch (e) { return sendError(res, e); } },
};
