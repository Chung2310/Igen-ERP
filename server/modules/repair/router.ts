import { Router } from "express";
import { requirePermission } from "../../middleware/auth";
import { retailScopeFromRequest } from "../retail/contracts";
import { RepairTicketModel } from "./repair-ticket.model";
import { approveRepairQuote, cancelRepairTicket, createFeedbackQr, createRepairTicket, deliverRepairTicket, quoteRepairTicket, recordRepairPayment, transitionRepairTicket } from "./repair-ticket.service";
import { lookupSoldDevice } from "../retail/contracts";
import { issueRepairPart, listRepairParts, returnRepairPart } from "./repair-part.service";
import { lookupRepairHistory } from "./services/repair-history.service";
import { assignRepairTechnician, listRepairFeedback, submitStaffFeedback } from "./services/repair-feedback.service";
import { dispatchRepairNotification, listRepairChannels } from "./services/repair-notify.service";
import { RepairNotificationModel } from "./repair-notification.model";
import { DEFAULT_REPAIR_TEMPLATES, RepairSettingsModel } from "./repair-settings.model";
import { repairFeedbackSummaryReport, repairPartUsageReport, repairRevenueReport, repairTechnicianPerformanceReport, type RepairRevenueGroupBy } from "./services/repair-report.service";
import { REPAIR_COST_READ_PERMISSION, REPAIR_MANAGE_PERMISSION, REPAIR_NOTIFICATION_EVENTS, REPAIR_PART_ISSUE_PERMISSION, REPAIR_QUOTE_PERMISSION, REPAIR_READ_PERMISSION, REPAIR_TECHNICIAN_ASSIGN_PERMISSION, type RepairNotificationEvent } from "./permissions";

export const repairRouter = Router();
const manage = requirePermission(REPAIR_MANAGE_PERMISSION) as any;
const read = requirePermission([REPAIR_READ_PERMISSION, REPAIR_MANAGE_PERMISSION]) as any;
// Các quyền chuyên biệt luôn chấp nhận repair:manage để không khoá mất người đang dùng.
const quote = requirePermission([REPAIR_QUOTE_PERMISSION, REPAIR_MANAGE_PERMISSION]) as any;
const partIssue = requirePermission([REPAIR_PART_ISSUE_PERMISSION, REPAIR_MANAGE_PERMISSION]) as any;
const assign = requirePermission([REPAIR_TECHNICIAN_ASSIGN_PERMISSION, REPAIR_MANAGE_PERMISSION]) as any;
const costRead = requirePermission(REPAIR_COST_READ_PERMISSION) as any;
const scope = (req: any) => {
  const companyCode = req.query.companyCode || req.headers["x-company-code"] || req.user?.companyCode;
  const branchId = req.query.branchId || req.headers["x-branch-id"] || req.user?.branchId;
  const value = retailScopeFromRequest(req.user || {}, { companyCode, branchId });
  if (!value.branchId) throw Object.assign(new Error("Chi nhánh là bắt buộc."), { statusCode: 400 });
  return value as { companyCode: string; branchId: string };
};
/** Báo cáo cần gộp nhiều chi nhánh nên không ép branchId như scope() của luồng phiếu. */
const reportScope = (req: any) => {
  const companyCode = req.query.companyCode || req.headers["x-company-code"] || req.user?.companyCode;
  const branchId = req.query.branchId || req.headers["x-branch-id"];
  return retailScopeFromRequest(req.user || {}, { companyCode, ...(branchId ? { branchId } : {}) }) as { companyCode: string; branchId?: string };
};
const reportRange = (req: any) => {
  const from = String(req.query.from || "").trim();
  const to = String(req.query.to || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw Object.assign(new Error("Cần truyền from và to dạng YYYY-MM-DD."), { statusCode: 400 });
  return { from, to };
};
/** Người thiếu repair:cost:read vẫn xem được báo cáo, chỉ là không có cột giá vốn/lãi. */
const canReadCost = (req: any) => new Promise<boolean>((resolve) => costRead(req, { status: () => ({ json: () => resolve(false) }) }, () => resolve(true)));
const actor = (req: any) => ({ id: String(req.user?.id || req.user?.uid || ""), name: String(req.user?.email || req.user?.displayName || "") });

repairRouter.post("/tickets/lookup-device", manage, async (req, res, next) => { try { return res.json({ success: true, data: await lookupSoldDevice(scope(req), String(req.body?.serialNumber || "")) }); } catch (error) { next(error); } });
repairRouter.get("/tickets/by-serial/:serialNumber", read, async (req, res, next) => { try { const data = await RepairTicketModel.find({ ...scope(req), "device.serialNumber": String(req.params.serialNumber).trim().toUpperCase() }).sort({ receivedAt: -1 }).lean(); return res.json({ success: true, data }); } catch (error) { next(error); } });
repairRouter.get("/tickets", read, async (req, res, next) => { try { const filter: any = { ...scope(req) }; if (req.query.status) filter.status = String(req.query.status); if (req.query.customerId) filter.customerId = String(req.query.customerId); if (req.query.technicianId) filter.technicianId = String(req.query.technicianId); if (req.query.q) filter.$or = [{ ticketCode: { $regex: String(req.query.q), $options: "i" } }, { customerName: { $regex: String(req.query.q), $options: "i" } }, { "device.serialNumber": { $regex: String(req.query.q), $options: "i" } }]; const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25)); const [items, total] = await Promise.all([RepairTicketModel.find(filter).sort({ receivedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), RepairTicketModel.countDocuments(filter)]); return res.json({ success: true, data: { items, total, page, limit } }); } catch (error) { next(error); } });
repairRouter.get("/tickets/board", read, async (req, res, next) => { try { const items: any[] = await RepairTicketModel.find(scope(req)).sort({ receivedAt: -1 }).lean(); const board = items.reduce<Record<string, any[]>>((result, ticket) => { (result[ticket.status] ||= []).push(ticket); return result; }, {}); return res.json({ success: true, data: board }); } catch (error) { next(error); } });
repairRouter.get("/tickets/:id", read, async (req, res, next) => { try { const data = await RepairTicketModel.findOne({ _id: req.params.id, ...scope(req) }).lean(); if (!data) return res.status(404).json({ success: false, message: "Không tìm thấy phiếu sửa chữa." }); return res.json({ success: true, data }); } catch (error) { next(error); } });
repairRouter.post("/tickets", manage, async (req, res, next) => { try { const data = await createRepairTicket(scope(req), req.body, actor(req)); return res.status(201).json({ success: true, data }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/status", manage, async (req, res, next) => { try { const data = await transitionRepairTicket(scope(req), req.params.id, req.body?.to, actor(req), req.body?.note, Boolean(req.body?.notifyCustomer), undefined, req.body?.technicianId); return res.json({ success: true, data }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/quote", quote, async (req, res, next) => { try { const data = await quoteRepairTicket(scope(req), req.params.id, Number(req.body?.amount), actor(req), req.body?.note); return res.json({ success: true, data }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/approve-quote", manage, async (req, res, next) => { try { const data = await approveRepairQuote(scope(req), req.params.id, actor(req)); return res.json({ success: true, data }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/deliver", manage, async (req, res, next) => { try { const user = (req as any).user || {}; const allowDebt = user.role === "admin" || user.role === "superadmin" || (Array.isArray(user.permissions) && user.permissions.includes("repair:deliver-with-debt")); const data = await deliverRepairTicket(scope(req), req.params.id, actor(req), allowDebt); return res.json({ success: true, data }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/payments", manage, async (req, res, next) => { try { const data = await recordRepairPayment(scope(req), req.params.id, Number(req.body?.amount), actor(req)); return res.json({ success: true, data }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/cancel", manage, async (req, res, next) => { try { const data = await cancelRepairTicket(scope(req), req.params.id, String(req.body?.reason || ""), actor(req)); return res.json({ success: true, data }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/feedback-qr", manage, async (req, res, next) => { try { return res.json({ success: true, data: await createFeedbackQr(scope(req), req.params.id) }); } catch (error) { next(error); } });
repairRouter.get("/tickets/:id/parts", read, async (req, res, next) => { try { return res.json({ success: true, data: await listRepairParts(scope(req), req.params.id) }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/parts", partIssue, async (req, res, next) => { try { return res.json({ success: true, data: await issueRepairPart(scope(req), req.params.id, req.body || {}, actor(req)) }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/parts/:partId/return", partIssue, async (req, res, next) => { try { return res.json({ success: true, data: await returnRepairPart(scope(req), req.params.id, req.params.partId, String(req.body?.reason || ""), actor(req)) }); } catch (error) { next(error); } });

// --- Lịch sử thiết bị theo IMEI / SĐT khách ---
repairRouter.get("/history", read, async (req, res, next) => { try { return res.json({ success: true, data: await lookupRepairHistory({ companyCode: reportScope(req).companyCode }, { imei: req.query.imei ? String(req.query.imei) : undefined, phone: req.query.phone ? String(req.query.phone) : undefined }) }); } catch (error) { next(error); } });

// --- Kỹ thuật viên & đánh giá ---
repairRouter.post("/tickets/:id/assign", assign, async (req, res, next) => { try { return res.json({ success: true, data: await assignRepairTechnician(scope(req), req.params.id, String(req.body?.technicianId || ""), actor(req)) }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/feedback", manage, async (req, res, next) => { try { return res.status(201).json({ success: true, data: await submitStaffFeedback(scope(req), req.params.id, req.body || {}, actor(req)) }); } catch (error) { next(error); } });
repairRouter.get("/feedback", read, async (req, res, next) => { try { return res.json({ success: true, data: await listRepairFeedback(reportScope(req), { technicianId: req.query.technicianId ? String(req.query.technicianId) : undefined, limit: Number(req.query.limit) }) }); } catch (error) { next(error); } });

// --- Thông báo gửi khách ---
repairRouter.get("/tickets/:id/notifications", read, async (req, res, next) => { try { const data = await RepairNotificationModel.find({ companyCode: reportScope(req).companyCode, ticketId: req.params.id }).sort({ sentAt: -1 }).lean(); return res.json({ success: true, data }); } catch (error) { next(error); } });
repairRouter.post("/tickets/:id/notifications/resend", manage, async (req, res, next) => { try {
  const event = String(req.body?.event || "") as RepairNotificationEvent;
  if (!(REPAIR_NOTIFICATION_EVENTS as readonly string[]).includes(event)) return res.status(400).json({ success: false, message: "Loại thông báo không hợp lệ." });
  const ticket: any = await RepairTicketModel.findOne({ _id: req.params.id, ...scope(req) }).lean();
  if (!ticket) return res.status(404).json({ success: false, message: "Không tìm thấy phiếu sửa chữa." });
  await RepairNotificationModel.deleteOne({ companyCode: ticket.companyCode, idempotencyKey: `repair:${req.params.id}:${event}` });
  return res.json({ success: true, data: await dispatchRepairNotification(ticket, event) });
} catch (error) { next(error); } });
repairRouter.get("/settings/notifications", read, async (req, res, next) => { try {
  const companyCode = reportScope(req).companyCode;
  const settings: any = await RepairSettingsModel.findOne({ companyCode }).lean();
  return res.json({ success: true, data: { notifyChannels: settings?.notifyChannels || ["email", "zalo", "sms"], templates: { ...DEFAULT_REPAIR_TEMPLATES, ...(settings?.templates || {}) }, channels: listRepairChannels() } });
} catch (error) { next(error); } });
repairRouter.put("/settings/notifications", manage, async (req, res, next) => { try {
  const companyCode = reportScope(req).companyCode;
  const templates = Object.fromEntries(REPAIR_NOTIFICATION_EVENTS.filter((event) => req.body?.templates?.[event]).map((event) => {
    const value = req.body.templates[event];
    return [event, { enabled: value.enabled !== false, subject: String(value.subject || ""), html: String(value.html || "") }];
  }));
  const notifyChannels = Array.isArray(req.body?.notifyChannels) ? req.body.notifyChannels.map(String) : undefined;
  const data = await RepairSettingsModel.findOneAndUpdate({ companyCode }, { $set: { companyCode, ...(notifyChannels ? { notifyChannels } : {}), ...(Object.keys(templates).length ? { templates } : {}), updatedBy: actor(req).id } }, { new: true, upsert: true }).lean();
  return res.json({ success: true, data });
} catch (error) { next(error); } });

// --- Báo cáo ---
repairRouter.get("/reports/revenue", read, async (req, res, next) => { try {
  const groupBy = (["branch", "technician", "day"].includes(String(req.query.groupBy)) ? String(req.query.groupBy) : "branch") as RepairRevenueGroupBy;
  return res.json({ success: true, data: await repairRevenueReport(reportScope(req), reportRange(req), { groupBy, includeCost: await canReadCost(req) }) });
} catch (error) { next(error); } });
repairRouter.get("/reports/part-usage", costRead, async (req, res, next) => { try { return res.json({ success: true, data: await repairPartUsageReport(reportScope(req), reportRange(req)) }); } catch (error) { next(error); } });
repairRouter.get("/reports/technician-performance", read, async (req, res, next) => { try { return res.json({ success: true, data: await repairTechnicianPerformanceReport(reportScope(req), reportRange(req)) }); } catch (error) { next(error); } });
repairRouter.get("/reports/feedback-summary", read, async (req, res, next) => { try { return res.json({ success: true, data: await repairFeedbackSummaryReport(reportScope(req), reportRange(req)) }); } catch (error) { next(error); } });
