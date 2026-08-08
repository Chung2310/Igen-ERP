import { describe, expect, it, vi } from "vitest";
import { createCustomFieldResourceService } from "./custom-field-resource.service";

describe("CustomFieldResourceService", () => {
  it("collects file and multi-image tokens after an entity is persisted", async () => {
    const finalize = vi.fn(async () => []);
    const service = createCustomFieldResourceService({ finalize });

    await service.finalizeEntity({ tenantId: "ACME", moduleKey: "students", actorId: "actor-1" }, {
      _id: "student-1",
      fullName: "Nguyen A",
      customFields: {
        cv: { uploadToken: "token-cv", url: "https://cdn/cv" },
        photos: [{ uploadToken: "token-photo", url: "https://cdn/photo" }],
        note: "text",
      },
    });

    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({ companyCode: "ACME", actorId: "actor-1" }),
      expect.objectContaining({
        entityType: "students",
        entityId: "student-1",
        entityLabel: "Nguyen A",
        sourceRecordId: "student-1",
        uploads: [
          { uploadToken: "token-cv", sourceField: "customFields.cv" },
          { uploadToken: "token-photo", sourceField: "customFields.photos.0" },
        ],
      }),
    );
  });
});
