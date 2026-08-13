import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "./auth";
import { AttendanceAttemptModel } from "../model/attendance-attempt.model";
import { cloudinaryService } from "../service/cloudinary.service";
import { InsightFaceClient } from "../service/insightface.service";
import { verifyAttendanceFace } from "../service/attendance-face-gate.service";
import { getRequestPublicIp } from "../utils/request-ip";
import { ATTENDANCE_FACE_CHECK_ENABLED } from "../../src/config/attendanceFaceCheck";

type UploadRequest = AuthenticatedRequest & { file?: Express.Multer.File };
export async function attendanceFaceGate(req: UploadRequest, res: Response, next: NextFunction) {
  if (!ATTENDANCE_FACE_CHECK_ENABLED) return next();

  const base = { uid: req.user!.id, companyCode: req.user!.companyCode || "SYSTEM",
    branchId: req.user?.branchId, ipAddress: getRequestPublicIp(req),
    action: req.path.includes("check-out") ? "check-out" : "check-in",
    latitude: Number(req.body.latitude), longitude: Number(req.body.longitude), attemptedAt: new Date() };
  if (!req.file) {
    await AttendanceAttemptModel.create({ ...base, outcome: "rejected", reasonCode: "invalid_image" });
    return res.status(400).json({ reasonCode: "invalid_image" });
  }
  try {
    const result = await verifyAttendanceFace({ uid: req.user!.id, image: req.file.buffer, mimeType: req.file.mimetype }, {
      cloudinary: cloudinaryService, insightFace: new InsightFaceClient(),
    });
    if (!result.accepted) {
      await AttendanceAttemptModel.create({ ...base, outcome: "rejected",
        reasonCode: result.reasonCode, evidence: result.evidence, evidenceDeleteAfter: result.evidenceDeleteAfter });
      return res.status(400).json({ reasonCode: result.reasonCode });
    }
    (req as any).attendanceEvidence = result.evidence;
    (req as any).attendanceEvidenceDeleteAfter = result.evidenceDeleteAfter;
    return next();
  } catch {
    await AttendanceAttemptModel.create({ ...base, outcome: "error", reasonCode: "model_unavailable" });
    return res.status(503).json({ reasonCode: "model_unavailable" });
  }
}
