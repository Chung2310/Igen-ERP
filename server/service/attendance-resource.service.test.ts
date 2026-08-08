import { describe, expect, it, vi } from "vitest";
import { createAttendanceResourceService } from "./attendance-resource.service";

describe("AttendanceResourceService", () => {
  it("indexes accepted evidence after a timekeeping log is persisted", async () => {
    const registerUploadedResource = vi.fn(async () => ({} as any));
    const service = createAttendanceResourceService({ registerUploadedResource });

    await service.indexAcceptedEvidence({
      companyCode: "ACME",
      branchId: "branch-a",
      userId: "user-1",
      userLabel: "Nguyen A",
      recordId: "log-1",
      action: "check-in",
      mimeType: "image/jpeg",
      evidence: { publicId: "attendance/evidence-1", resourceType: "image", type: "authenticated", format: "jpg", bytes: 20 },
    });

    expect(registerUploadedResource).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: "attendance.worker",
      sourceRecordId: "log-1",
      sourceField: "check-in.evidence",
      storagePublicId: "attendance/evidence-1",
      storageAccess: "authenticated",
    }));
  });

  it("indexes accepted student attendance evidence under the student source", async () => {
    const registerUploadedResource = vi.fn(async () => ({} as any));
    const service = createAttendanceResourceService({ registerUploadedResource });

    await service.indexAcceptedStudentEvidence({
      companyCode: "ACME",
      branchId: "branch-a",
      studentId: "student-1",
      studentLabel: "Nguyen A",
      recordId: "attempt-1",
      mimeType: "image/jpeg",
      evidence: { publicId: "student/evidence-1", resourceType: "image", type: "authenticated", format: "jpg", bytes: 20 },
    });

    expect(registerUploadedResource).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: "attendance.student",
      sourceRecordId: "attempt-1",
      storagePublicId: "student/evidence-1",
    }));
  });
});
