import { ResourceImportRunModel } from "../model/resource-import-run.model";
import type { ManagedUploadActor } from "./managed-upload.service";
import {
  sourceUploadFinalizer,
  type FinalizeSourceUploadsInput,
} from "./source-upload-finalizer.service";

export interface RecordSuccessfulImportInput {
  sourceType: string;
  uploadToken: string;
  fileName: string;
  importedCount: number;
  skippedCount?: number;
}

interface ImportRunRepository {
  create(input: Record<string, unknown>): Promise<any>;
}

interface SourceFinalizer {
  finalize(actor: ManagedUploadActor, input: FinalizeSourceUploadsInput): Promise<unknown[]>;
}

export function createImportResourceService(repository: ImportRunRepository, finalizer: SourceFinalizer) {
  return {
    async recordSuccessfulImport(actor: ManagedUploadActor, input: RecordSuccessfulImportInput) {
      const run = await repository.create({
        companyCode: actor.companyCode,
        branchId: actor.branchId,
        sourceType: input.sourceType,
        fileName: input.fileName,
        importedCount: input.importedCount,
        skippedCount: input.skippedCount || 0,
        actorId: actor.actorId,
      });
      const runId = String(run._id || run.id);
      await finalizer.finalize(actor, {
        entityType: "import-run",
        entityId: runId,
        entityLabel: input.fileName,
        sourceRecordId: runId,
        expectedSourceType: input.sourceType,
        uploads: [{ uploadToken: input.uploadToken, sourceField: "sourceFile" }],
      });
      return run;
    },
  };
}

export const importResourceService = createImportResourceService(ResourceImportRunModel, sourceUploadFinalizer);
