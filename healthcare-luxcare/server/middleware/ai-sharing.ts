import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth";
import { withAiSharingPermission, AiSharingError } from "../service/ai-sharing.service";
export async function requireCompanyAiSharing(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { await withAiSharingPermission(req.user!.id, "company", async () => next()); }
  catch (error) {
    const known = error instanceof AiSharingError;
    return res.status(known ? error.statusCode : 503).json({ success: false,
      code: known ? error.code : "AI_DISCLOSURE_UNAVAILABLE",
      message: known ? error.message : "Chưa thể xác nhận việc chia sẻ dữ liệu AI. Vui lòng thử lại.",
    });
  }
}
