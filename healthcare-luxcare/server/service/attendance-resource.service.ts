import type { PrivateImageAsset } from "./cloudinary.service";
import { resourceIndexingService } from "./resource-indexing.service";

interface AcceptedAttendanceEvidenceInput {
  companyCode: string;
  branchId?: string;
  userId: string;
  userLabel: string;
  recordId: string;
  action: "check-in" | "check-out";
  mimeType: string;
  evidence: PrivateImageAsset;
}

export function createAttendanceResourceService(
  indexer: Pick<typeof resourceIndexingService, "registerUploadedResource">,
) {
  return {
    async indexAcceptedEvidence(input: AcceptedAttendanceEvidenceInput) {
      return indexer.registerUploadedResource({
        companyCode: input.companyCode,
        branchId: input.branchId,
        sourceType: "attendance.employee",
        entityType: "employee",
        entityId: input.userId,
        entityLabel: input.userLabel || input.userId,
        sourceRecordId: input.recordId,
        sourceField: `${input.action}.evidence`,
        sourceKey: `attendance.employee:${input.recordId}:${input.action}:${input.evidence.publicId}`,
        fileName: `${input.action}-${input.recordId}.${input.evidence.format || "jpg"}`,
        fileUrl: "",
        mimeType: input.mimeType,
        size: input.evidence.bytes,
        storageProvider: "cloudinary",
        storagePublicId: input.evidence.publicId,
        storageResourceType: input.evidence.resourceType,
        storageAccess: "authenticated",
        uploaderId: input.userId,
        uploaderName: input.userLabel,
      });
    },
  };
}

export const attendanceResourceService = createAttendanceResourceService(resourceIndexingService);
