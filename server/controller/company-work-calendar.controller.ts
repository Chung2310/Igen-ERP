import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import {
  CalendarConflictError,
  CalendarNotFoundError,
  CalendarValidationError,
  createAdminDay,
  listAudit,
  listCalendarDays,
  syncYear,
  updateDay,
} from "../service/company-work-calendar.service";
import { UnsupportedHolidayYearError } from "../service/vietnam-holiday-provider";

export class CalendarAuthorizationError extends Error {}

export function assertCalendarAdmin(user?: { id?: string; companyCode?: string; role?: string }) {
  if (!user?.id || !user.companyCode || !["admin", "superadmin"].includes(user.role || "")) {
    throw new CalendarAuthorizationError("Chỉ Admin và Superadmin được quản lý lịch làm việc.");
  }
  return { actorId: user.id, companyCode: user.companyCode };
}

function respondError(res: Response, error: unknown) {
  if (error instanceof CalendarAuthorizationError) return res.status(403).json({ status: "error", message: error.message });
  if (error instanceof CalendarNotFoundError) return res.status(404).json({ status: "error", message: error.message });
  if (error instanceof CalendarConflictError) return res.status(409).json({ status: "error", message: error.message });
  if (error instanceof CalendarValidationError || error instanceof UnsupportedHolidayYearError) {
    return res.status(400).json({ status: "error", message: error.message });
  }
  console.error("[companyWorkCalendarController]", error);
  return res.status(500).json({ status: "error", message: "Không thể xử lý lịch làm việc lúc này." });
}

export const companyWorkCalendarController = {
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const { companyCode } = assertCalendarAdmin(req.user);
      const year = Number(req.query.year);
      const data = await listCalendarDays(companyCode, year, req.query.appliedOnly === "true");
      return res.json({ status: "success", data });
    } catch (error) { return respondError(res, error); }
  },

  async sync(req: AuthenticatedRequest, res: Response) {
    try {
      const { companyCode, actorId } = assertCalendarAdmin(req.user);
      const data = await syncYear(companyCode, Number(req.body.year), actorId);
      return res.json({ status: "success", data });
    } catch (error) { return respondError(res, error); }
  },

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const { companyCode, actorId } = assertCalendarAdmin(req.user);
      const data = await createAdminDay(companyCode, actorId, req.body);
      return res.status(201).json({ status: "success", data });
    } catch (error) { return respondError(res, error); }
  },

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { companyCode, actorId } = assertCalendarAdmin(req.user);
      const data = await updateDay(companyCode, req.params.id, actorId, req.body);
      return res.json({ status: "success", data });
    } catch (error) { return respondError(res, error); }
  },

  async audit(req: AuthenticatedRequest, res: Response) {
    try {
      const { companyCode } = assertCalendarAdmin(req.user);
      const data = await listAudit(companyCode, req.params.id);
      return res.json({ status: "success", data });
    } catch (error) { return respondError(res, error); }
  },
};
