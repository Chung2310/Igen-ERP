import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getAllowedOwnerIds } from "../utils/auth.util";
import { Batch } from "../models/batch.model";
import { Student } from "../models/student.model";
import { StudentAttendanceAttemptModel } from "../models/student-attendance-attempt.model";

export class StudentAttendanceAttemptController {
  // Lịch sử các lần xác thực điểm danh (accept/reject) của một lớp, phục vụ phát hiện gian lận (GV/Admin)
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { batchId, date, outcome, studentId } = req.query;
      if (!batchId) {
        return res.status(400).json({ success: false, error: "Vui lòng cung cấp batchId." });
      }

      const allowedOwners = await getAllowedOwnerIds(req.user!);
      const batchQuery: Record<string, any> = { _id: batchId };
      if (allowedOwners !== "ALL") {
        batchQuery.ownerId = Array.isArray(allowedOwners) ? { $in: allowedOwners } : allowedOwners;
      }

      const batch = await Batch.findOne(batchQuery);
      if (!batch) {
        return res.status(404).json({ success: false, error: "Không tìm thấy lớp học hoặc bạn không có quyền." });
      }

      const query: Record<string, any> = { batchId: String(batchId) };
      if (outcome) query.outcome = String(outcome);
      if (studentId) query.studentId = String(studentId);

      let attempts = await StudentAttendanceAttemptModel.find(query).sort({ attemptedAt: -1 }).limit(500).lean();

      if (date) {
        const dayStart = new Date(`${date}T00:00:00`);
        const dayEnd = new Date(`${date}T23:59:59.999`);
        attempts = attempts.filter((a) => a.attemptedAt >= dayStart && a.attemptedAt <= dayEnd);
      }

      const studentIds = [...new Set(attempts.map((a) => a.studentId))];
      const students = await Student.find({ _id: { $in: studentIds } }).select("fullName phone");
      const studentMap = new Map(students.map((s) => [s.id, s]));

      const data = attempts.map((a) => ({
        ...a,
        id: a._id,
        studentName: studentMap.get(a.studentId)?.fullName || "Học viên đã xóa",
        studentPhone: studentMap.get(a.studentId)?.phone || "",
      }));

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
