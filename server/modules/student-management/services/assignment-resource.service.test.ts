import { describe, expect, it, vi } from "vitest";
import { createAssignmentResourceService } from "./assignment-resource.service";

describe("AssignmentResourceService", () => {
  it("finalizes assignment attachment tokens under the persisted assignment", async () => {
    const finalize = vi.fn(async () => []);
    const service = createAssignmentResourceService({ finalize });

    await service.finalizeAssignment({ companyCode: "ACME", actorId: "teacher-1" }, {
      _id: "assignment-1",
      title: "Bai tap so 1",
      attachments: [{ uploadToken: "token-assignment" }],
    }, { _id: "batch-1", code: "LOP-A" });

    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({ companyCode: "ACME", actorId: "teacher-1" }),
      expect.objectContaining({
        entityType: "batch",
        entityId: "batch-1",
        entityLabel: "LOP-A",
        sourceRecordId: "assignment-1",
        uploads: [{ uploadToken: "token-assignment", sourceField: "attachments.0" }],
      }),
    );
  });

  it("finalizes proof tokens only after receiving the persisted submission id", async () => {
    const finalize = vi.fn(async () => []);
    const service = createAssignmentResourceService({ finalize });

    await service.finalizeSubmission({ companyCode: "ACME", actorId: "student-1", trusted: true }, {
      _id: "submission-1",
      attachments: [{ uploadToken: "token-1" }],
    }, { _id: "student-1", fullName: "Nguyen A" });

    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({ companyCode: "ACME", actorId: "student-1" }),
      expect.objectContaining({
        entityType: "student",
        entityId: "student-1",
        entityLabel: "Nguyen A",
        sourceRecordId: "submission-1",
        uploads: [{ uploadToken: "token-1", sourceField: "attachments.0" }],
      }),
    );
  });
});
