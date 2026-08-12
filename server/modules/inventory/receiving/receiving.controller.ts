import type { Request, Response } from "express";
import { cancelReceipt, confirmReceipt, createReceipt, createSupplier, deleteSupplier, listReceipts, listSuppliers, updateSupplier } from "./receiving.service";

function actor(req: Request) { const user = (req as any).user || {}; return { id: user.id, email: user.email }; }
function company(req: Request) { return String((req as any).user?.companyCode || "").trim().toUpperCase(); }
function scope(req: Request) { const branchId = String((req as any).user?.branchId || "").trim(); if (!company(req) || !branchId) throw Object.assign(new Error("Vui lòng chọn công ty và chi nhánh."), { statusCode: 400 }); return { companyCode: company(req), branchId }; }
function sendError(res: Response, error: any) { return res.status(Number(error?.statusCode) || 400).json({ status: "error", message: error?.message || "Không thể xử lý dữ liệu nhập hàng." }); }

export const receivingController = {
  listSuppliers: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await listSuppliers({ companyCode: company(req), q: req.query.q, status: req.query.status }) }); } catch (error) { return sendError(res, error); } },
  createSupplier: async (req: Request, res: Response) => { try { return res.status(201).json({ status: "success", data: await createSupplier({ companyCode: company(req) }, req.body, actor(req)) }); } catch (error) { return sendError(res, error); } },
  updateSupplier: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await updateSupplier({ companyCode: company(req) }, req.params.id, req.body, actor(req)) }); } catch (error) { return sendError(res, error); } },
  deleteSupplier: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await deleteSupplier({ companyCode: company(req) }, req.params.id) }); } catch (error) { return sendError(res, error); } },
  listReceipts: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await listReceipts(scope(req), req.query) }); } catch (error) { return sendError(res, error); } },
  createReceipt: async (req: Request, res: Response) => { try { return res.status(201).json({ status: "success", data: await createReceipt(scope(req), req.body, actor(req)) }); } catch (error) { return sendError(res, error); } },
  confirmReceipt: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await confirmReceipt(scope(req), req.params.id, actor(req)) }); } catch (error) { return sendError(res, error); } },
  cancelReceipt: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await cancelReceipt(scope(req), req.params.id, req.body?.reason, actor(req)) }); } catch (error) { return sendError(res, error); } },
};
