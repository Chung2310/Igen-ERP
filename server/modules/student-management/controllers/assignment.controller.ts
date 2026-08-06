import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { AssignmentService } from "../services/assignment.service";
import { getAllowedOwnerIds, resolveCreateOwnerId } from "../utils/auth.util";

export class AssignmentController {
  static async create(req: AuthRequest, res: Response) {
    try {
      const ownerId = await resolveCreateOwnerId(req.user!);
      const ownerScope = await getAllowedOwnerIds(req.user!);
      const data = await AssignmentService.createAssignment(req.body, req.user!.id, ownerId, ownerScope);
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
      const ownerScope = await getAllowedOwnerIds(req.user!);
      const assignments = await AssignmentService.getAssignments(ownerScope, String(batchId));
      res.json({ success: true, data: assignments });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi lấy danh sách bài tập.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async getSubmissions(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const ownerScope = await getAllowedOwnerIds(req.user!);
      const submissions = await AssignmentService.getSubmissions(ownerScope, id);
      res.json({ success: true, data: submissions });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi lấy danh sách bài nộp.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async grade(req: AuthRequest, res: Response) {
    try {
      const { id, studentId } = req.params;
      const ownerScope = await getAllowedOwnerIds(req.user!);
      const data = await AssignmentService.gradeSubmission(id, studentId, req.body, req.user!.id, ownerScope);
      res.json({ success: true, data });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi chấm điểm bài nộp.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async staffSubmit(req: AuthRequest, res: Response) {
    try {
      const ownerScope = await getAllowedOwnerIds(req.user!);
      const data = await AssignmentService.staffSubmitProof(req.params.id, req.params.studentId, req.body, req.user!.id, ownerScope);
      res.json({ success: true, data });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi lưu bài nộp hộ học viên.";
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
      const { assignment, student, submission } = await AssignmentService.getPublicContext(decoded);

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

  static async uploadProofFile(req: AuthRequest, res: Response) {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).json({ success: false, error: "Thiếu liên kết mã hóa bài tập." });
      }
      const decoded = await AssignmentService.verifySubmissionToken(token);
      const url = await AssignmentService.uploadProofFile(decoded, req.body.file);
      res.json({ success: true, url });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi tải tệp minh chứng lên.";
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
