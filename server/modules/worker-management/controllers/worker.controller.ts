import type { Request, Response } from "express";
import {
  WorkerScopeError,
  workerScopeFromRequest,
} from "../contracts";
import { WorkerService, type WorkerBulkImportReferralError } from "../services/worker.service";
import { importResourceService } from "../../../service/import-resource.service";
import { WorkerReferralService } from "../labor-partners/services/worker-referral.service";

/** Guard against a runaway spreadsheet blocking the event loop on insertMany. */
const MAX_BULK_ROWS = 2000;

function scopeFromRequest(req: Request) {
  return workerScopeFromRequest((req as any).user || {}, {
    companyCode: req.query.companyCode,
    branchId: req.query.branchId,
  });
}

async function handle(
  res: Response,
  action: () => Promise<unknown>,
) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof WorkerScopeError) {
      return res.status(error.status).json({ message: error.message });
    }
    throw error;
  }
}

export const workerController = {
  list: async (req: Request, res: Response) =>
    handle(res, async () =>
      res.json({
        workers: await WorkerService.list(scopeFromRequest(req)),
      }),
    ),

  create: async (req: Request, res: Response) =>
    handle(res, async () =>
      res.status(201).json({
        worker: await WorkerService.create(
          scopeFromRequest(req),
          req.body || {},
        ),
      }),
    ),

  bulkCreate: async (req: Request, res: Response) =>
    handle(res, async () => {
      const body = req.body || {};
      const rows = Array.isArray(body.workers) ? body.workers : null;
      if (!rows) {
        return res.status(400).json({ message: "Danh sách lao động không hợp lệ." });
      }
      if (rows.length > MAX_BULK_ROWS) {
        return res.status(400).json({
          message: `Chỉ nhập tối đa ${MAX_BULK_ROWS} lao động mỗi lần. File hiện có ${rows.length} dòng.`,
        });
      }
      const scope = scopeFromRequest(req);
      const result = await WorkerService.bulkCreate(
        scope,
        rows,
        typeof body.projectId === "string" ? body.projectId : undefined,
      );
      const referralErrors: WorkerBulkImportReferralError[] = [];
      const actor = (req as any).user || {};
      for (const importedWorker of result.importedWorkers || []) {
        try {
          await WorkerReferralService.createForImportedWorker(scope, importedWorker, actor);
        } catch (error) {
          referralErrors.push({
            workerId: importedWorker.workerId,
            partnerCode: importedWorker.partnerCode,
            scheme: importedWorker.commissionScheme || (importedWorker.laborType === "seasonal" ? "seasonal_hourly" : "official_monthly"),
            reason: error instanceof Error ? error.message : "Không thể gắn đối tác cho lao động.",
          });
        }
      }
      if (body.importUpload?.uploadToken && body.importUpload?.fileName) {
        await importResourceService.recordSuccessfulImport({
          companyCode: scope.companyCode,
          branchId: scope.branchId,
          actorId: String(actor.id || actor._id || ""),
          actorName: actor.email,
        }, {
          sourceType: "import.worker",
          uploadToken: String(body.importUpload.uploadToken),
          fileName: String(body.importUpload.fileName),
          importedCount: result.importedCount,
          skippedCount: result.skippedCount,
        });
      }
      return res.status(201).json({
        ...result,
        ...(referralErrors.length ? { referralErrors } : {}),
      });
    }),

  bulkDelete: async (req: Request, res: Response) =>
    handle(res, async () => {
      const ids = Array.isArray(req.body?.ids)
        ? req.body.ids.filter((id: unknown): id is string => typeof id === "string")
        : null;
      if (!ids) {
        return res.status(400).json({ message: "Danh sách lao động cần xóa không hợp lệ." });
      }
      if (ids.length > MAX_BULK_ROWS) {
        return res.status(400).json({ message: `Chỉ xóa tối đa ${MAX_BULK_ROWS} lao động mỗi lần.` });
      }
      return res.json({ deletedCount: (await WorkerService.bulkDelete(scopeFromRequest(req), ids)).deletedCount });
    }),

  update: async (req: Request, res: Response) =>
    handle(res, async () => {
      const worker = await WorkerService.update(
        scopeFromRequest(req),
        req.params.id,
        req.body || {},
      );
      return worker
        ? res.json({ worker })
        : res.status(404).json({ message: "Worker not found" });
    }),

  delete: async (req: Request, res: Response) =>
    handle(res, async () => {
      const worker = await WorkerService.delete(
        scopeFromRequest(req),
        req.params.id,
      );
      return worker
        ? res.json({ worker })
        : res.status(404).json({ message: "Worker not found" });
    }),
};
