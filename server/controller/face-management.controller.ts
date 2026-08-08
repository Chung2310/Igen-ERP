import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { FaceEnrollmentAuditModel } from "../model/face-enrollment-audit.model";
import { cloudinaryService } from "../service/cloudinary.service";
import {
  InsightFaceBusinessError,
  InsightFaceClient,
  InsightFaceUnavailableError,
} from "../service/insightface.service";

interface FaceManagementDependencies {
  insightFace: Pick<InsightFaceClient, "getRegistrationStatus" | "registerFace" | "deleteRegistration">;
  cloudinary: Pick<typeof cloudinaryService, "uploadPrivateImage" | "deleteAsset">;
  audit: { create(value: Record<string, unknown>): Promise<unknown> };
}

type UploadRequest = AuthenticatedRequest & { file?: Express.Multer.File };

export function createFaceManagementController(deps: FaceManagementDependencies) {
  const auditBase = (req: AuthenticatedRequest) => ({
    actorId: req.user!.id,
    targetUserId: req.params.id,
    companyCode: req.user!.companyCode,
    attemptedAt: new Date(),
  });

  return {
    status: async (req: AuthenticatedRequest, res: Response) => {
      try {
        return res.json(await deps.insightFace.getRegistrationStatus(req.params.id));
      } catch {
        return res.status(503).json({ reasonCode: "model_unavailable" });
      }
    },

    register: async (req: UploadRequest, res: Response) => {
      if (!req.file) return res.status(400).json({ reasonCode: "invalid_image" });
      let evidence: Awaited<ReturnType<typeof deps.cloudinary.uploadPrivateImage>> | undefined;
      let action: "register" | "replace" = "register";
      try {
        const current = await deps.insightFace.getRegistrationStatus(req.params.id);
        action = current.registered ? "replace" : "register";
        evidence = await deps.cloudinary.uploadPrivateImage(req.file.buffer, "face-enrollment/evidence");
        const result = await deps.insightFace.registerFace(req.params.id, req.file.buffer, req.file.mimetype);
        await deps.audit.create({ ...auditBase(req), action, outcome: "success", evidence });
        return res.json(result);
      } catch (error) {
        if (evidence) await deps.cloudinary.deleteAsset(evidence.publicId).catch(() => undefined);
        const rejected = error instanceof InsightFaceBusinessError;
        const reasonCode = rejected ? error.reasonCode : "model_unavailable";
        await deps.audit.create({
          ...auditBase(req), action, outcome: rejected ? "rejected" : "error",
          reasonCode, evidence,
        });
        return res.status(rejected ? 400 : 503).json({ reasonCode });
      }
    },

    remove: async (req: AuthenticatedRequest, res: Response) => {
      try {
        const result = await deps.insightFace.deleteRegistration(req.params.id);
        await deps.audit.create({ ...auditBase(req), action: "delete", outcome: "success" });
        return res.json(result);
      } catch (error) {
        const reasonCode = error instanceof InsightFaceBusinessError
          ? error.reasonCode : "model_unavailable";
        await deps.audit.create({ ...auditBase(req), action: "delete", outcome: "error", reasonCode });
        return res.status(error instanceof InsightFaceUnavailableError ? 503 : 400).json({ reasonCode });
      }
    },
  };
}

const lazyInsightFace = {
  getRegistrationStatus: (id: string) => new InsightFaceClient().getRegistrationStatus(id),
  registerFace: (id: string, image: Buffer, mime: string) => new InsightFaceClient().registerFace(id, image, mime),
  deleteRegistration: (id: string) => new InsightFaceClient().deleteRegistration(id),
};

export const faceManagementController = createFaceManagementController({
  insightFace: lazyInsightFace,
  cloudinary: cloudinaryService,
  audit: FaceEnrollmentAuditModel,
});
