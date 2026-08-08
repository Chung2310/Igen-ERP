import { describe, expect, it, vi } from "vitest";
import { createImportResourceService } from "./import-resource.service";

describe("ImportResourceService", () => {
  it("persists an import run before finalizing its uploaded spreadsheet", async () => {
    const create = vi.fn(async () => ({ _id: "run-1" }));
    const finalize = vi.fn(async () => []);
    const service = createImportResourceService({ create }, { finalize });

    await service.recordSuccessfulImport(
      { companyCode: "ACME", branchId: "branch-1", actorId: "user-1" },
      {
        sourceType: "import.worker",
        uploadToken: "token-1",
        fileName: "workers.xlsx",
        importedCount: 12,
      },
    );

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: "import.worker",
      fileName: "workers.xlsx",
      importedCount: 12,
      companyCode: "ACME",
    }));
    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({ companyCode: "ACME", actorId: "user-1" }),
      {
        entityType: "import-run",
        entityId: "run-1",
        entityLabel: "workers.xlsx",
        sourceRecordId: "run-1",
        expectedSourceType: "import.worker",
        uploads: [{ uploadToken: "token-1", sourceField: "sourceFile" }],
      },
    );
  });
});
