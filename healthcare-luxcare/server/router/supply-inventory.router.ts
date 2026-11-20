import { logger } from "../config/logger";
import {
  inventoryCatalog,
  inventoryWarehouses,
  inventoryBalanceView,
  inventoryDocumentView,
} from "../service/supply/inventory-workspace.service";
import { Router, type Request, type Response } from "express";
import { requireAuth, getEffectivePermissions } from "../middleware/auth";
import { requireSupplyScope } from "../middleware/supply-scope";
import { validateRequest } from "../middleware/validation";
import { supplyErrorResponse, SupplyError } from "../service/supply/errors";
import { SupplyInventoryConfigModel } from "../model/supply-inventory.model";
import { backfillLegacySupplyDocuments } from "../service/supply/inventory-backfill.service";
import {
  createInventoryDocument,
  updateInventoryDocument,
  transitionInventoryDocument,
  getInventoryDocument,
  listInventoryDocuments,
} from "../service/supply/inventory-document.service";
import { postInventoryDocument } from "../service/supply/inventory-posting.service";
import { saveInventoryProfile } from "../service/supply/inventory-profile.service";
import { readInventoryBalances, reconcileInventory } from "../service/supply/inventory-read.service";
import { requireInventoryPermission, type InventoryActor } from "../service/supply/inventory-access";
import {
  inventoryIdSchema,
  inventoryActionSchema,
  inventoryDraftSchema,
  inventoryUpdateSchema,
  inventoryProfileSchema,
} from "../validation/supply-inventory.validation";

export const supplyInventoryRouter = Router();
supplyInventoryRouter.use(requireAuth as any, requireSupplyScope as any);
function handler(work: (actor: InventoryActor, req: Request) => Promise<unknown>, statusCode = 200) {
  return async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const actor: InventoryActor = {
        companyCode: user.companyCode,
        branchId: user.branchId,
        uid: user.id,
        name: user.displayName || user.name || user.email || user.id,
        permissions: await getEffectivePermissions(user.id, user.role, user.companyCode),
      };
      requireInventoryPermission(actor, "supply:read");
      res.status(statusCode).json({ status: "success", data: await work(actor, req) });
    } catch (error) {
      const failure = supplyErrorResponse(error);
      res.status(failure.statusCode).json({ status: "error", code: failure.code, message: failure.message });
    }
  };
}
function key(req: Request) {
  const key = req.get("Idempotency-Key");
  if (!key) throw new SupplyError("IDEMPOTENCY_REQUIRED", "Cần mã thao tác chống ghi trùng.");
  return key;
}
supplyInventoryRouter.get(
  "/state",
  handler(async (actor) => {
    let config = await SupplyInventoryConfigModel.findOne({ companyCode: actor.companyCode });
    if (!config || config.mode !== "v2") {
      config = await SupplyInventoryConfigModel.findOneAndUpdate(
        { companyCode: actor.companyCode },
        {
          $set: {
            companyCode: actor.companyCode,
            mode: "v2",
            timeZone: "Asia/Ho_Chi_Minh",
            currency: "VND",
            activatedAt: new Date(),
          },
          $setOnInsert: { writeVersion: 0 },
        },
        { upsert: true, returnDocument: "after" },
      );
    }
    backfillLegacySupplyDocuments(actor.companyCode, actor.branchId).catch((err) =>
      logger.warn("Backfill legacy supply documents failed:", err),
    );
    return { mode: config?.mode || "v2" };
  }),
);
supplyInventoryRouter.get(
  "/documents",
  handler(async (actor, req) => {
    await backfillLegacySupplyDocuments(actor.companyCode, actor.branchId).catch(() => undefined);
    return listInventoryDocuments(actor, Number(req.query.page), Number(req.query.limit));
  }),
);
supplyInventoryRouter.post(
  "/documents",
  validateRequest(inventoryDraftSchema),
  handler((actor, req) => createInventoryDocument(actor, req.body, key(req)), 201),
);
supplyInventoryRouter.get(
  "/documents/:id",
  validateRequest(inventoryIdSchema),
  handler((actor, req) => inventoryDocumentView(actor, req.params.id)),
);
supplyInventoryRouter.patch(
  "/documents/:id",
  validateRequest(inventoryUpdateSchema),
  handler((actor, req) => {
    const { revision, ...input } = req.body;
    return updateInventoryDocument(actor, req.params.id, revision, input, key(req));
  }),
);
for (const action of ["submit", "approve", "reject", "cancel"] as const) {
  supplyInventoryRouter.post(
    `/documents/:id/${action}`,
    validateRequest(inventoryActionSchema),
    handler((actor, req) =>
      transitionInventoryDocument(actor, req.params.id, req.body.revision, action, req.body.reason, key(req)),
    ),
  );
}
supplyInventoryRouter.post(
  "/documents/:id/post",
  validateRequest(inventoryActionSchema),
  handler((actor, req) => postInventoryDocument(actor, req.params.id, req.body.revision, key(req))),
);
supplyInventoryRouter.put(
  "/profiles/:id",
  validateRequest(inventoryProfileSchema),
  handler((actor, req) => {
    const { expectedVersion, ...input } = req.body;
    return saveInventoryProfile(actor, req.params.id, input, expectedVersion);
  }),
);
supplyInventoryRouter.get(
  "/balances",
  handler(async (actor, req) => {
    await backfillLegacySupplyDocuments(actor.companyCode, actor.branchId).catch(() => undefined);
    return inventoryBalanceView(actor, Number(req.query.page), Number(req.query.limit));
  }),
);
supplyInventoryRouter.get(
  "/reconciliation",
  handler((actor) => reconcileInventory(actor)),
);

supplyInventoryRouter.get(
  "/catalog",
  handler((actor, req) =>
    inventoryCatalog(actor, typeof req.query.search === "string" ? req.query.search : "", Number(req.query.page)),
  ),
);
supplyInventoryRouter.get(
  "/warehouses",
  handler((actor) => inventoryWarehouses(actor)),
);
