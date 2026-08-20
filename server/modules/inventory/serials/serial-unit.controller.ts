import type { Request, Response } from "express";
import { getSerialHistory, listSerialUnits, registerSerialBatch, registerSerialUnit, transferSerialUnit, transitionSerialUnit } from "./serial-unit.service";
import { acceptSerialTransfer, cancelSerialTransfer, requestSerialTransfer } from "./serial-transfer.service";

function scope(req: Request) { return { companyCode: String((req as any).user?.companyCode || "").trim().toUpperCase(), branchId: String((req as any).user?.branchId || "").trim(), warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined }; }
function actor(req: Request) { return { id: String((req as any).user?.id || (req as any).user?._id || ""), name: String((req as any).user?.name || (req as any).user?.fullName || "") }; }
function sendError(res: Response, error: any) { return res.status(Number(error?.statusCode) || 400).json({ status: "error", code: error?.code, message: error?.message || "Không thể xử lý IMEI/serial." }); }

export const serialUnitController = {
  list: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await listSerialUnits(scope(req), { serial: String(req.query.serial || ""), sku: String(req.query.sku || ""), productId: String(req.query.productId || ""), variantId: String(req.query.variantId || ""), trackingMode: req.query.trackingMode as any, forSale: String(req.query.forSale || "") === "true", status: req.query.status as any, page: Number(req.query.page), limit: Number(req.query.limit) }) }); } catch (e) { return sendError(res, e); } },
  detail: async (req: Request, res: Response) => { try { const result = await listSerialUnits(scope(req), { serial: req.params.id, limit: 1 }); if (!result.items[0]) return res.status(404).json({ status: "error", message: "Không tìm thấy IMEI/serial." }); return res.json({ status: "success", data: result.items[0] }); } catch (e) { return sendError(res, e); } },
  history: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await getSerialHistory(scope(req), req.params.id) }); } catch (e) { return sendError(res, e); } },
  create: async (req: Request, res: Response) => { try { const data = Array.isArray(req.body?.serialNumbers) ? await registerSerialBatch(scope(req), req.body, actor(req)) : [await registerSerialUnit(scope(req), req.body, actor(req))]; return res.status(201).json({ status: "success", data }); } catch (e) { return sendError(res, e); } },
  transition: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await transitionSerialUnit(scope(req), req.params.id, req.body, actor(req)) }); } catch (e) { return sendError(res, e); } },
  transfer: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await transferSerialUnit(scope(req), req.params.id, req.body, actor(req)) }); } catch (e) { return sendError(res, e); } },
  requestTransfer: async (req: Request, res: Response) => { try { return res.status(201).json({ status: "success", data: await requestSerialTransfer(scope(req), req.params.id, req.body, actor(req)) }); } catch (e) { return sendError(res, e); } },
  acceptTransfer: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await acceptSerialTransfer(scope(req), req.params.id, req.body, actor(req)) }); } catch (e) { return sendError(res, e); } },
  cancelTransfer: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await cancelSerialTransfer(scope(req), req.params.id, String(req.body?.reason || ""), actor(req)) }); } catch (e) { return sendError(res, e); } },
};
