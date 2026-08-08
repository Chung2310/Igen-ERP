import { Student } from "../models/student.model";
import { StudentFaceEnrollmentAuditModel } from "../models/student-face-enrollment-audit.model";
import { cloudinaryService } from "../../../service/cloudinary.service";
import {
  InsightFaceBusinessError,
  InsightFaceClient,
  InsightFaceUnavailableError,
} from "../../../service/insightface.service";
import { resourceIndexingService } from "../../../service/resource-indexing.service";

export interface StudentFaceDependencies {
  insightFace: Pick<InsightFaceClient, "getRegistrationStatus" | "registerFace" | "deleteRegistration">;
  cloudinary: Pick<typeof cloudinaryService, "uploadPrivateImage" | "deleteAsset">;
  audit: { create(value: Record<string, unknown>): Promise<unknown> };
  indexer: Pick<typeof resourceIndexingService, "registerUploadedResource" | "replaceSourceResource" | "trashSourceRecordResources">;
}

export function buildInsightFaceUserId(ownerId: string, studentId: string): string {
  return `student:${ownerId}:${studentId}`;
}

export function createStudentFaceService(deps: StudentFaceDependencies) {
  const auditBase = (actorId: string, studentId: string, ownerId: string) => ({
    actorId,
    studentId,
    ownerId,
    attemptedAt: new Date(),
  });

  return {
    async getStatus(studentId: string) {
      const student = await Student.findById(studentId);
      if (!student) return null;
      return {
        studentId,
        registered: !!student.faceEnrollment?.registered,
        registeredAt: student.faceEnrollment?.registeredAt ?? null,
      };
    },

    async register(
      actorId: string,
      student: InstanceType<typeof Student>,
      file: { buffer: Buffer; mimetype: string },
      context: { companyCode: string; branchId?: string },
    ) {
      const insightFaceUserId = student.faceEnrollment?.insightFaceUserId || buildInsightFaceUserId(student.ownerId, student.id);
      const previousEvidencePublicId = student.faceEnrollment?.lastEvidencePublicId;
      let evidence: Awaited<ReturnType<typeof deps.cloudinary.uploadPrivateImage>> | undefined;
      const action = student.faceEnrollment?.registered ? "replace" : "register";

      try {
        evidence = await deps.cloudinary.uploadPrivateImage(file.buffer, "student-face-enrollment/evidence");
        const result = await deps.insightFace.registerFace(insightFaceUserId, file.buffer, file.mimetype);

        student.faceEnrollment = {
          registered: true,
          registeredAt: new Date(),
          insightFaceUserId,
          lastEvidencePublicId: evidence.publicId,
        };
        await student.save();

        const resourceInput = {
          companyCode: context.companyCode,
          branchId: context.branchId,
          sourceType: "student.face",
          entityType: "student",
          entityId: student.id,
          entityLabel: student.fullName || student.id,
          sourceRecordId: student.id,
          sourceField: "faceEnrollment.lastEvidencePublicId",
          sourceKey: `student.face:${student.id}:evidence:${evidence.publicId}`,
          fileName: `face-enrollment-${student.id}.${evidence.format || "jpg"}`,
          fileUrl: "",
          mimeType: file.mimetype,
          size: evidence.bytes,
          storageProvider: "cloudinary",
          storagePublicId: evidence.publicId,
          storageResourceType: evidence.resourceType,
          storageAccess: "authenticated",
          uploaderId: actorId,
        } as const;

        if (previousEvidencePublicId && previousEvidencePublicId !== evidence.publicId) {
          await deps.indexer.replaceSourceResource(
            context.companyCode,
            `student.face:${student.id}:evidence:${previousEvidencePublicId}`,
            resourceInput,
          );
        } else {
          await deps.indexer.registerUploadedResource(resourceInput);
        }

        await deps.audit.create({
          ...auditBase(actorId, student.id, student.ownerId),
          action,
          outcome: "success",
          evidence,
        }).catch(() => undefined);

        return result;
      } catch (error) {
        if (evidence) await deps.cloudinary.deleteAsset(evidence.publicId).catch(() => undefined);
        const rejected = error instanceof InsightFaceBusinessError;
        const reasonCode = rejected ? error.reasonCode : "model_unavailable";
        await deps.audit.create({
          ...auditBase(actorId, student.id, student.ownerId),
          action,
          outcome: rejected ? "rejected" : "error",
          reasonCode,
        }).catch(() => undefined);
        throw error;
      }
    },

    async remove(actorId: string, student: InstanceType<typeof Student>, context: { companyCode: string }) {
      const insightFaceUserId = student.faceEnrollment?.insightFaceUserId;
      try {
        if (insightFaceUserId) {
          await deps.insightFace.deleteRegistration(insightFaceUserId);
        }
        student.faceEnrollment = { registered: false };
        await student.save();
        await deps.indexer.trashSourceRecordResources(context.companyCode, "student.face", student.id);
        await deps.audit.create({
          ...auditBase(actorId, student.id, student.ownerId),
          action: "delete",
          outcome: "success",
        }).catch(() => undefined);
      } catch (error) {
        const rejected = error instanceof InsightFaceBusinessError;
        const reasonCode = rejected ? error.reasonCode : "model_unavailable";
        await deps.audit.create({
          ...auditBase(actorId, student.id, student.ownerId),
          action: "delete",
          outcome: rejected ? "rejected" : "error",
          reasonCode,
        }).catch(() => undefined);
        throw error;
      }
    },
  };
}

const lazyInsightFace = {
  getRegistrationStatus: (id: string) => new InsightFaceClient().getRegistrationStatus(id),
  registerFace: (id: string, image: Buffer, mime: string) => new InsightFaceClient().registerFace(id, image, mime),
  deleteRegistration: (id: string) => new InsightFaceClient().deleteRegistration(id),
};

export const studentFaceService = createStudentFaceService({
  insightFace: lazyInsightFace,
  cloudinary: cloudinaryService,
  audit: StudentFaceEnrollmentAuditModel,
  indexer: resourceIndexingService,
});

export { InsightFaceBusinessError, InsightFaceUnavailableError };
