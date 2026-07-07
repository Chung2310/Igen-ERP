import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { workflowLinkService } from "../service/workflow-link.service";

export const workflowLinkController = {
  /**
   * POST /api/v1/crud/workflows/:id/participants/:participantId/advance
   */
  async advanceParticipant(req: AuthenticatedRequest, res: Response) {
    try {
      const { id: workflowId, participantId } = req.params;
      const { nextStepId } = req.body;
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
        nextStepId
      );

      return res.status(200).json({
        status: "success",
        message: "Chuyển bước thành công và đã khởi tạo công việc.",
        data: result,
      });
    } catch (error: any) {
      console.error("[workflowLinkController.advanceParticipant] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi khi chuyển bước cho người tham gia quy trình",
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
