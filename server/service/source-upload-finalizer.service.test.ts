import { describe, expect, it, vi } from "vitest";
import { createSourceUploadFinalizer } from "./source-upload-finalizer.service";

describe("SourceUploadFinalizer", () => {
  it("finalizes each distinct pending token after a source record exists", async () => {
    const finalizeManagedUpload = vi.fn(async (_token, _actor, source) => ({
      _id: `resource-${source.sourceField}`,
      type: "file" as const,
      name: source.sourceField || "file",
      parentId: "folder",
      companyCode: "ACME",
    }));
    const service = createSourceUploadFinalizer({ finalizeManagedUpload });

    const resources = await service.finalize({ companyCode: "ACME", actorId: "actor-1" }, {
      entityType: "kanban-task",
      entityId: "task-1",
      entityLabel: "Prepare report",
      sourceRecordId: "task-1",
      uploads: [
        { uploadToken: "token-1", sourceField: "attachments.0" },
        { uploadToken: "token-1", sourceField: "attachments.0" },
        { uploadToken: "token-2", sourceField: "attachments.1" },
        { sourceField: "attachments.2" },
      ],
    });

    expect(finalizeManagedUpload).toHaveBeenCalledTimes(2);
    expect(finalizeManagedUpload).toHaveBeenNthCalledWith(1,
      "token-1",
      expect.objectContaining({ companyCode: "ACME", actorId: "actor-1" }),
      expect.objectContaining({ entityId: "task-1", sourceField: "attachments.0" }),
    );
    expect(resources).toHaveLength(2);
  });
});
