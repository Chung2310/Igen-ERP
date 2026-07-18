import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { AssignmentService } from "../services/assignment.service";
import { AssignmentModel } from "../models/assignment.model";
import { SubmissionModel } from "../models/submission.model";
import { Student } from "../models/student.model";
import { resolveCreateOwnerId } from "../utils/auth.util";

export class AssignmentController {
  static async create(req: AuthRequest, res: Response) {
    try {
      const ownerId = await resolveCreateOwnerId(req.user!);
      const data = await AssignmentService.createAssignment(req.body, req.user!.id, ownerId);
      res.status(201).json({ success: true, data });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi tạo bài tập.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async getList(req: AuthRequest, res: Response) {
    try {
      const { batchId } = req.query;
      if (!batchId) {
        return res.status(400).json({ success: false, error: "Thiếu mã lớp học batchId." });
      }
      const assignments = await AssignmentModel.find({ batchId: String(batchId) }).sort({ createdAt: -1 });
      res.json({ success: true, data: assignments });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi lấy danh sách bài tập.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async getSubmissions(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const submissions = await SubmissionModel.find({ assignmentId: id });
      res.json({ success: true, data: submissions });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi lấy danh sách bài nộp.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async grade(req: AuthRequest, res: Response) {
    try {
      const { id, studentId } = req.params;
      const data = await AssignmentService.gradeSubmission(id, studentId, req.body, req.user!.id);
      res.json({ success: true, data });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi chấm điểm bài nộp.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async getPublicDetail(req: AuthRequest, res: Response) {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).json({ success: false, error: "Thiếu liên kết mã hóa bài tập." });
      }
      const decoded = await AssignmentService.verifySubmissionToken(token);
      const assignment = await AssignmentModel.findById(decoded.assignmentId);
      if (!assignment) {
        return res.status(404).json({ success: false, error: "Bài tập không tồn tại hoặc đã bị xóa." });
      }
      const student = await Student.findById(decoded.studentId);
      const submission = await SubmissionModel.findOne({
        assignmentId: decoded.assignmentId,
        studentId: decoded.studentId
      });

      res.json({
        success: true,
        data: {
          assignment,
          student,
          submission
        }
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Liên kết nộp bài tập không hợp lệ.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async submitProof(req: AuthRequest, res: Response) {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).json({ success: false, error: "Thiếu liên kết mã hóa bài tập." });
      }
      const decoded = await AssignmentService.verifySubmissionToken(token);
      const data = await AssignmentService.submitProof(decoded, req.body);
      res.json({ success: true, data });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi nộp minh chứng bài tập.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async cancelSubmission(req: AuthRequest, res: Response) {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).json({ success: false, error: "Thiếu liên kết mã hóa bài tập." });
      }
      const decoded = await AssignmentService.verifySubmissionToken(token);
      await AssignmentService.cancelSubmission(decoded);
      res.json({ success: true, message: "Đã hủy nộp minh chứng thành công." });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi hủy nộp minh chứng.";
      res.status(400).json({ success: false, error: msg });
    }
  }
}
