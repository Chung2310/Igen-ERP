import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { workflowLinkService } from "../service/workflow-link.service";

/** Vai trò được phép vận hành quy trình (khớp isManager ở frontend) */
const MANAGER_ROLES = ["superadmin", "admin", "manager"];

/** Trả về true nếu đã chặn (không đủ quyền); controller nên return ngay sau đó */
function blockIfNotManager(req: AuthenticatedRequest, res: Response): boolean {
  if (!req.user || !MANAGER_ROLES.includes(req.user.role)) {
    res.status(403).json({
      status: "error",
      message: "Bạn không có quyền vận hành quy trình (chỉ dành cho quản lý).",
    });
    return true;
  }
  return false;
}

export const workflowLinkController = {
  /**
   * POST /api/v1/crud/workflows/:id/participants
   * Tạo "công việc" (case) mới chạy theo quy trình
   */
  async createCase(req: AuthenticatedRequest, res: Response) {
    try {
      if (blockIfNotManager(req, res)) return;
      const { id: workflowId } = req.params;
      const companyCode = req.user?.companyCode || "SYSTEM";

      const result = await workflowLinkService.createCase(companyCode, workflowId, req.body || {});

      return res.status(201).json({
        status: "success",
        message: "Đã tạo công việc và khởi tạo task Kanban cho bước đầu tiên.",
        data: result,
      });
    } catch (error: any) {
      console.error("[workflowLinkController.createCase] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi tạo công việc theo quy trình",
      });
    }
  },

  /**
   * POST /api/v1/crud/workflows/:id/participants/:participantId/advance
   */
  async advanceParticipant(req: AuthenticatedRequest, res: Response) {
    try {
      if (blockIfNotManager(req, res)) return;
      const { id: workflowId, participantId } = req.params;
      const { nextStepId, force } = req.body;
      const companyCode = req.user?.companyCode || "SYSTEM";

      if (!nextStepId) {
        return res.status(400).json({
          status: "error",
          message: "Tham số nextStepId là bắt buộc.",
        });
      }

      const result = await workflowLinkService.advanceParticipant(
        companyCode,
        workflowId,
        participantId,
        nextStepId,
        { force: force === true }
      );

      return res.status(200).json({
        status: "success",
        message: "Chuyển bước thành công và đã khởi tạo công việc.",
        data: result,
      });
    } catch (error: any) {
      console.error("[workflowLinkController.advanceParticipant] Error:", error);
      return res.status(error.statusCode || 500).json({
        status: "error",
        message: error.message || "Lỗi khi chuyển bước cho người tham gia quy trình",
      });
    }
  },

  /**
   * DELETE /api/v1/crud/workflows/:id/participants/:participantId
   * Xóa "công việc" (case) khỏi quy trình và lưu trữ các task Kanban chưa xong
   */
  async removeCase(req: AuthenticatedRequest, res: Response) {
    try {
      if (blockIfNotManager(req, res)) return;
      const { id: workflowId, participantId } = req.params;
      const companyCode = req.user?.companyCode || "SYSTEM";

      const result = await workflowLinkService.removeParticipant(companyCode, workflowId, participantId);

      return res.status(200).json({
        status: "success",
        message: `Đã xóa công việc và lưu trữ ${result.tasksArchived} task Kanban chưa hoàn thành.`,
        data: { tasksArchived: result.tasksArchived },
      });
    } catch (error: any) {
      console.error("[workflowLinkController.removeCase] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi xóa công việc khỏi quy trình",
      });
    }
  },

  /**
   * GET /api/v1/crud/workflows/:id/participants/:participantId/tasks
   */
  async getParticipantTasks(req: AuthenticatedRequest, res: Response) {
    try {
      const { id: workflowId, participantId } = req.params;
      const { stepId } = req.query;
      const companyCode = req.user?.companyCode || "SYSTEM";

      const tasks = await workflowLinkService.getParticipantTasks(
        companyCode,
        workflowId,
        participantId,
        stepId as string
      );

      return res.status(200).json({
        status: "success",
        data: tasks,
      });
    } catch (error: any) {
      console.error("[workflowLinkController.getParticipantTasks] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi lấy danh sách công việc của người tham gia",
      });
    }
  },
};
