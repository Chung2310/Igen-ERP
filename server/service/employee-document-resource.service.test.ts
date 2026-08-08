import { describe, expect, it, vi } from "vitest";
import { createEmployeeDocumentResourceService } from "./employee-document-resource.service";

describe("EmployeeDocumentResourceService", () => {
  it("finalizes a job description against the persisted employee", async () => {
    const finalize = vi.fn(async () => []);
    const service = createEmployeeDocumentResourceService({ finalize });

    await service.finalizeJobDescription(
      { companyCode: "ACME", actorId: "admin-1" },
      { _id: "employee-1", displayName: "Nguyen A" },
      "token-1",
    );

    expect(finalize).toHaveBeenCalledWith(expect.anything(), {
      entityType: "employee",
      entityId: "employee-1",
      entityLabel: "Nguyen A",
      sourceRecordId: "employee-1",
      uploads: [{ uploadToken: "token-1", sourceField: "jobDescriptionLink" }],
    });
  });
});
