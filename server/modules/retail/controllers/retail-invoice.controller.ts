import type { Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { RetailInvoiceModel } from "../models/retail-invoice.model";
const scope = (req: Request) => requireRetailBranch(retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }));
export const retailInvoiceController = {
  list: async (req: Request, res: Response) => { const filter = { ...scope(req), ...(req.query.orderId ? { orderId: String(req.query.orderId) } : {}) }; res.json({ success: true, data: await RetailInvoiceModel.find(filter).sort({ issuedAt: -1 }).lean() }); },
  detail: async (req: Request, res: Response) => { const invoice = await RetailInvoiceModel.findOne({ _id: req.params.id, ...scope(req) }).lean(); if (!invoice) throw new Error("Không tìm thấy hóa đơn."); res.json({ success: true, data: invoice }); },
};
