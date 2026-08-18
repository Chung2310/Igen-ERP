import { Router } from "express";
import { requirePermission } from "../../middleware/auth";
import { retailScopeFromRequest } from "../retail/contracts";
import { RepairTicketModel } from "./repair-ticket.model";
import { approveRepairQuote, cancelRepairTicket, createFeedbackQr, createRepairTicket, deliverRepairTicket, quoteRepairTicket, recordRepairPayment, transitionRepairTicket } from "./repair-ticket.service";
import { lookupSoldDevice } from "../retail/contracts";
import { issueRepairPart, listRepairParts, returnRepairPart } from "./repair-part.service";

export const repairRouter = Router();
const manage = requirePermission("repair:manage") as any;
const read = requirePermission("repair:read") as any;
const scope = (req: any) => {
  const companyCode = req.query.companyCode || req.headers["x-company-code"] || req.user?.companyCode;
  const branchId = req.query.branchId || req.headers["x-branch-id"] || req.user?.branchId;
  const value = retailScopeFromRequest(req.user || {}, { companyCode, branchId });
  if (!value.branchId) throw Object.assign(new Error("Chi nhánh là bắt buộc."), { statusCode: 400 });
  return value as { companyCode: string; branchId: string };
};
const actor = (req: any) => ({ id: String(req.user?.id || req.user?.uid || ""), name: String(req.user?.email || req.user?.displayName || "") });

repairRouter.post("/tickets/lookup-device", manage, async (req, res, next) => { try { return res.json({ success: true, data: await lookupSoldDevice(scope(req), String(req.body?.serialNumber || "")) }); } catch (error) { next(error); } });
repairRouter.get("/tickets/by-serial/:serialNumber", read, async (req, res, next) => { try { const data = await RepairTicketModel.find({ ...scope(req), "device.serialNumber": String(req.params.serialNumber).trim().toUpperCase() }).sort({ receivedAt: -1 }).lean(); return res.json({ success: true, data }); } catch (error) { next(error); } });
repairRouter.get("/tickets", read, async (req, res, next) => { try { const filter: any = { ...scope(req) }; if (req.query.status) filter.status = String(req.query.status); if (req.query.customerId) filter.customerId = String(req.query.customerId); if (req.query.technicianId) filter.technicianId = String(req.query.technicianId); if (req.query.q) filter.$or = [{ ticketCode: { $regex: String(req.query.q), $options: "i" } }, { customerName: { $regex: String(req.query.q), $options: "i" } }, { "device.serialNumber": { $regex: String(req.query.q), $options: "i" } }]; const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25)); const [items, total] = await Promise.all([RepairTicketModel.find(filter).sort({ receivedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), RepairTicketModel.countDocuments(filter)]); return res.json({ success: true, data: { items, total, page, limit } }); } catch (error) { next(error); } });
repairRouter.get("/tickets/board", read, async (req, res, next) => { try { const items: any[] = await RepairTicketModel.find(scope(req)).sort({ receivedAt: -1 }).lean(); const board = items.reduce<Record<string, any[]>>((result, ticket) => { (result[ticket.status] ||= []).push(ticket); return result; }, {}); return res.json({ success: true, data: board }); } catch (error) { next(error); } });
repairRouter.get("/tickets/:id", read, async (req, res, next) => { try { const data = await RepairTicketModel.findOne({ _id: req.params.id, ...scope(req) }).lean(); if (!data) return res.status(404).json({ success: false, message: "Không tìm thấy phiếu sửa chữa." }); return res.json({ success: true, data }); } catch (error) { next(error); } });
repairRouter.post("/tickets", manage, async (req, res, next) => { try { const data = await createRepairTicket(scope(req), req.body, actor(req)); return res.status(201).json({ success: true, data }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/status", manage, async (req, res, next) => { try { const data = await transitionRepairTicket(scope(req), req.params.id, req.body?.to, actor(req), req.body?.note, Boolean(req.body?.notifyCustomer)); return res.json({ success: true, data }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/quote", manage, async (req, res, next) => { try { const data = await quoteRepairTicket(scope(req), req.params.id, Number(req.body?.amount), actor(req)); return res.json({ success: true, data }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/approve-quote", manage, async (req, res, next) => { try { const data = await approveRepairQuote(scope(req), req.params.id, actor(req)); return res.json({ success: true, data }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/deliver", manage, async (req, res, next) => { try { const user = (req as any).user || {}; const allowDebt = user.role === "admin" || user.role === "superadmin" || (Array.isArray(user.permissions) && user.permissions.includes("repair:deliver-with-debt")); const data = await deliverRepairTicket(scope(req), req.params.id, actor(req), allowDebt); return res.json({ success: true, data }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/payments", manage, async (req, res, next) => { try { const data = await recordRepairPayment(scope(req), req.params.id, Number(req.body?.amount), actor(req)); return res.json({ success: true, data }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/cancel", manage, async (req, res, next) => { try { const data = await cancelRepairTicket(scope(req), req.params.id, String(req.body?.reason || ""), actor(req)); return res.json({ success: true, data }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/feedback-qr", manage, async (req, res, next) => { try { return res.json({ success: true, data: await createFeedbackQr(scope(req), req.params.id) }); } catch (error) { next(error); } });
repairRouter.get("/tickets/:id/parts", read, async (req, res, next) => { try { return res.json({ success: true, data: await listRepairParts(scope(req), req.params.id) }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/parts", manage, async (req, res, next) => { try { return res.json({ success: true, data: await issueRepairPart(scope(req), req.params.id, req.body || {}, actor(req)) }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/parts/:partId/return", manage, async (req, res, next) => { try { return res.json({ success: true, data: await returnRepairPart(scope(req), req.params.id, req.params.partId, String(req.body?.reason || ""), actor(req)) }); } catch (error) { next(error); } });
