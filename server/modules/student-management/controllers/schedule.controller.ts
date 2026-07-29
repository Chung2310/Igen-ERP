import { Response, NextFunction } from "express";
import { Exam } from "../models/exam.model";
import { ResourceService } from "../services/resource.service";
import { BatchService } from "../services/batch.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getAllowedOwnerIds, resolveOwnerFilter } from "../utils/auth.util";

export interface ScheduleEvent {
  id: string;
  title: string;
  type: "class" | "exam" | "resource";
  date: string; // YYYY-MM-DD
  time: string;
  details: string;
}

/** Chuẩn hóa chuỗi ngày DD/MM/YYYY hoặc YYYY-MM-DD về YYYY-MM-DD */
function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split("/");
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export class ScheduleController {
  /** GET /schedule?from=YYYY-MM-DD&to=YYYY-MM-DD — gộp sự kiện kỳ thi + booking tài nguyên */
  static async getEvents(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const from = typeof req.query.from === "string" ? req.query.from : undefined;
      const to = typeof req.query.to === "string" ? req.query.to : undefined;
      const ownerFilter = typeof req.query.ownerFilter === "string" ? req.query.ownerFilter : undefined;

      const resolvedOwnerId = await resolveOwnerFilter(ownerId, ownerFilter);

      const events: ScheduleEvent[] = [];

      // Kỳ thi
      const examQuery: Record<string, unknown> = {};
      if (resolvedOwnerId !== "ALL") {
        examQuery.ownerId = Array.isArray(resolvedOwnerId) ? { $in: resolvedOwnerId } : resolvedOwnerId;
      }
      if (req.user!.branchId) {
        examQuery.branchId = req.user!.branchId;
      }
      const exams = await Exam.find(examQuery);
      for (const exam of exams) {
        if (exam.status === "Đã hủy") continue;
        const date = normalizeDate(exam.officialDate || exam.tentativeDate);
        if (!date) continue;
        if (from && date < from) continue;
        if (to && date > to) continue;
        events.push({
          id: String(exam._id),
          title: exam.name,
          type: "exam",
          date,
          time: exam.officialDate ? "Chính thức" : "Dự kiến",
          details: `${exam.location} • ${exam.studentCount} học viên${exam.rank ? ` • Hạng ${exam.rank}` : ''}`,
        });
      }

      // Booking tài nguyên (phòng, xe, thiết bị)
      const bookings = await ResourceService.getBookingsInRange(resolvedOwnerId, from, to, req.user!.branchId);
      for (const b of bookings) {
        events.push({ ...b, type: "resource" });
      }

      // Lịch học định kỳ của các lớp mở
      const classes = await BatchService.getClassEventsInRange(resolvedOwnerId, from, to, req.user!.branchId);
      for (const c of classes) {
        events.push({ ...c, type: "class" });
      }

      events.sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));

      res.json({ success: true, events });
    } catch (error: unknown) {
      next(error);
    }
  }
}
