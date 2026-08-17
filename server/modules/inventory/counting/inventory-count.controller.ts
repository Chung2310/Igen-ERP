import type { Request, Response } from "express";
import { approveCount, cancelCount, createCount, getCount, listCounts, startCount, submitCount, updateCountItem } from "./inventory-count.service";
const scope = (req: Request) => ({ companyCode: String((req as any).user?.companyCode || "").trim().toUpperCase(), branchId: String((req as any).user?.branchId || "").trim() });
const actor = (req: Request) => ({ id: (req as any).user?.id, email: (req as any).user?.email });
const sendError = (res: Response, error: any) => res.status(Number(error?.statusCode) || 400).json({ status: "error", message: error?.message || "Không thể xử lý phiếu kiểm kê." });
export const inventoryCountController = {
  list: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await listCounts(scope(req), req.query) }); } catch (error) { return sendError(res, error); } },
  get: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await getCount(scope(req), req.params.id) }); } catch (error) { return sendError(res, error); } },
  create: async (req: Request, res: Response) => { try { return res.status(201).json({ status: "success", data: await createCount(scope(req), String(req.body?.warehouseId || ""), actor(req), req.body?.notes) }); } catch (error) { return sendError(res, error); } },
  updateItem: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await updateCountItem(scope(req), req.params.id, req.params.itemId, req.body || {}) }); } catch (error) { return sendError(res, error); } },
  start: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await startCount(scope(req), req.params.id, actor(req)) }); } catch (error) { return sendError(res, error); } },
  submit: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await submitCount(scope(req), req.params.id, actor(req)) }); } catch (error) { return sendError(res, error); } },
  cancel: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await cancelCount(scope(req), req.params.id, actor(req)) }); } catch (error) { return sendError(res, error); } },
  approve: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await approveCount(scope(req), req.params.id, actor(req)) }); } catch (error) { return sendError(res, error); } },
};
