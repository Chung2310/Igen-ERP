import { equipmentExtraRouter } from "./equipment-extra";
import { Router, type RequestHandler } from "express";
import Joi from "joi";
import { requirePermission, getEffectivePermissions, hasAnyPermission, type AuthenticatedRequest } from "../../../middleware/auth";
import { find, publicRecord, scope, atomic, collection, conflict, replace } from "./store";
import { route } from "./http";
import {
  actionInput,
  equipmentInput,
  id,
  input,
  inspectionInput,
  requestInput,
  revisionInput,
  stockInput,
  supplyInput,
} from "./validation";
import { decideEquipment, inspectEquipment, requestEquipment, saveEquipment } from "./equipment";
import { saveSupply } from "./supplies";
import { saveDocument, transitionDocument } from "./supply-documents";
import { postDocument } from "./supply-posting";
import { references } from "./references";
import { filesRouter } from "./files";
import { directoriesRouter } from "./directories";
import { saveProfile } from "./supply-units";
import { listSupplies, supplyStats, type SupplyQuery } from "./supply-read";
import { batchStock } from "./supply-batch";

export const logisticsRouter = Router();
const permission = (mode = "read") => requirePermission(`healthcare:${mode}`) as RequestHandler;
const recordId = (req: AuthenticatedRequest) => input<string>(id, req.params.id);
const queryInput = Joi.object({
  page: Joi.number().integer().min(1).max(100000).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(25),
  q: Joi.string().trim().max(120).allow("").default(""),
  equipmentId: id.optional(),
  supplyId: id.optional(),
  status: Joi.string().max(40),
  warehouseId: Joi.string().max(80),
  active: Joi.string().valid("all", "true", "false"),
  category: Joi.string().max(200),
  supplierId: Joi.string().max(80),
  stockStatus: Joi.string().valid("in-stock", "low-stock", "out-of-stock"),
  expiry: Joi.string().valid("expired", "soon"),
  riskClassification: Joi.string().valid("A", "B", "C", "D"),
  inspectionStatus: Joi.string().valid("overdue", "soon", "valid", "none"),
  departmentId: Joi.string().max(80),
  roomId: Joi.string().max(80),
  returnable: Joi.string().valid("true"),
});
for (const [path, kind, feature] of [
  ["equipment", "equipment", "equipment"],
  ["requests", "equipment_requests", "equipment"],
  ["inspections", "equipment_inspections", "equipment"],
  ["supplies", "supplies", "supplies"],
  ["documents", "supply_documents", "supplies"],
  ["balances", "supply_balances", "supplies"],
  ["ledger", "supply_ledger", "supplies"],
] as const) {
  logisticsRouter.get(
    `/${path}`,
    permission(),
    route(async (req, res, db, actor) => {
      const query = input<
        {
          page: number;
          pageSize: number;
          q: string;
          equipmentId?: string;
          supplyId?: string;
          status?: string;
          warehouseId?: string;
          category?: string;
          departmentId?: string;
          roomId?: string;
          riskClassification?: string;
          inspectionStatus?: string;
        } & SupplyQuery
      >(queryInput, req.query);
      if (kind === "supplies") return res.json(await listSupplies(db, actor, query));
      const filter: Record<string, unknown> = { ...scope(actor) };
      if (kind === "equipment") {
        if (req.query.returnable === "true") {
          const permissions = await getEffectivePermissions(actor.actorId, req.user!.role, actor.companyCode);
          filter.status = "in-use";
          if (!hasAnyPermission(permissions, ["healthcare:manage"])) filter.currentBorrowerId = actor.actorId;
        }
        filter.deletedAt = { $exists: false };
        if (query.riskClassification) filter.riskClassification = query.riskClassification;
        const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
        const soon = new Date(Date.now() + 30 * 86400000 + 7 * 3600000).toISOString().slice(0, 10);
        if (query.inspectionStatus)
          filter.nextInspectionDay = {
            overdue: { $gt: "", $lt: today },
            soon: { $gte: today, $lte: soon },
            valid: { $gt: soon },
            none: "",
          }[query.inspectionStatus];
      }
      if (query.q) {
        const regex = { $regex: query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
        filter.$or = [{ name: regex }, { code: regex }, { voucherCode: regex }, { equipmentName: regex }, { reason: regex }];
        if (kind === "supply_balances" || kind === "supply_ledger") {
          const supplies = await collection(db, "supplies")
            .find({ ...scope(actor), $or: [{ name: regex }, { code: regex }] })
            .project({ _id: 1 })
            .toArray();
          filter.$or = [{ lot: regex }, { supplyId: { $in: supplies.map((x) => x._id) } }];
        }
      }
      for (const field of [
        "equipmentId",
        "supplyId",
        "status",
        "warehouseId",
        "category",
        "departmentId",
        "roomId",
      ] as const)
        if (query[field]) filter[field] = query[field];
      const coll = db.collection(`healthcare_${kind}`);
      const [items, total] = await Promise.all([
        coll
          .find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((query.page - 1) * query.pageSize)
          .limit(query.pageSize)
          .toArray(),
        coll.countDocuments(filter),
      ]);
      res.json({ items: items.map(publicRecord), total, page: query.page, pageSize: query.pageSize });
    }),
  );
  logisticsRouter.get(
    `/${path}/:id`,
    permission(),
    route(async (req, res, db, actor) => res.json(publicRecord(await find(db, kind, actor, recordId(req))))),
  );
}
for (const feature of ["equipment", "supplies"] as const) {
  logisticsRouter.get(
    `/${feature}-references`,
    permission(),
    route(async (_req, res, db, actor) => res.json(await references(db, actor))),
  );
  const schema = feature === "equipment" ? equipmentInput : supplyInput;
  const save = feature === "equipment" ? saveEquipment : saveSupply;
  logisticsRouter.post(
    `/${feature}`,
    permission("manage"),
    route(async (req, res, db, actor) =>
      res.status(201).json(publicRecord(await save(db, actor, input(schema, req.body)))),
    ),
  );
  logisticsRouter.patch(
    `/${feature}/:id`,
    permission("manage"),
    route(async (req, res, db, actor) => {
      const { revision, ...body } = req.body || {};
      res.json(publicRecord(await save(db, actor, input(schema, body), recordId(req), input(revisionInput, revision))));
    }),
  );
}
logisticsRouter.post(
  "/equipment/:id/requests",
  permission(),
  route(async (req, res, db, actor) =>
    { const permissions = await getEffectivePermissions(actor.actorId, req.user!.role, actor.companyCode);
      res.status(201).json(publicRecord(await requestEquipment(db, actor, recordId(req), input(requestInput, req.body), hasAnyPermission(permissions, ["healthcare:manage"])))); }),
);
logisticsRouter.post(
  "/requests/:id/action",
  (req, res, next) => permission(req.body?.action === "cancel" ? "read" : "manage")(req, res, next),
  route(async (req, res, db, actor) => {
    const data = input<{ revision: number; action: string; reason: string }>(actionInput, req.body);
    res.json(publicRecord(await decideEquipment(db, actor, recordId(req), data.revision, data.action, data.reason)));
  }),
);
logisticsRouter.post(
  "/equipment/:id/inspections",
  permission("manage"),
  route(async (req, res, db, actor) =>
    res
      .status(201)
      .json(publicRecord(await inspectEquipment(db, actor, recordId(req), input(inspectionInput, req.body)))),
  ),
);
logisticsRouter.post(
  "/documents",
  permission("manage"),
  route(async (req, res, db, actor) =>
    res.status(201).json(publicRecord(await saveDocument(db, actor, input(stockInput, req.body)))),
  ),
);
logisticsRouter.patch(
  "/documents/:id",
  permission("manage"),
  route(async (req, res, db, actor) => {
    const { revision, ...body } = req.body || {};
    res.json(
      publicRecord(
        await saveDocument(db, actor, input(stockInput, body), recordId(req), input(revisionInput, revision)),
      ),
    );
  }),
);
logisticsRouter.post(
  "/documents/:id/action",
  permission("manage"),
  route(async (req, res, db, actor) => {
    const data = input<{ revision: number; action: string; reason: string }>(actionInput, req.body);
    const result =
      data.action === "post"
        ? await postDocument(
            db,
            actor,
            recordId(req),
            data.revision,
            input<string>(Joi.string().guid().required(), req.get("Idempotency-Key")),
          )
        : await transitionDocument(db, actor, recordId(req), data.revision, data.action, data.reason);
    res.json(publicRecord(result as object));
  }),
);
logisticsRouter.use(filesRouter);
logisticsRouter.use(equipmentExtraRouter);
logisticsRouter.post(
  "/supplies/:id/active",
  permission("manage"),
  route(async (req, res, db, actor) => {
    const data = input<{ revision: number; active: boolean }>(
      Joi.object({ revision: revisionInput, active: Joi.boolean().required() }),
      req.body,
    );
    const result = await atomic(async (session) => {
      const row = await find(db, "supplies", actor, recordId(req), session);
      if (
        !data.active &&
        (await collection(db, "supply_balances").findOne(
          { ...scope(actor), supplyId: row._id, quantity: { $gt: 0 } },
          { session },
        ))
      )
        conflict("Vật tư còn tồn kho, chưa thể ngừng sử dụng.");
      return replace(db, "supplies", actor, { ...row, active: data.active }, data.revision, session);
    });
    res.json(publicRecord(result));
  }),
);
logisticsRouter.use(directoriesRouter);
logisticsRouter.get(
  "/overview/supplies",
  permission(),
  route(async (_req, res, db, actor) => res.json(await supplyStats(db, actor))),
);
logisticsRouter.put(
  "/profiles/:id",
  permission("manage"),
  route(async (req, res, db, actor) => {
    const data = input<{
      revision: number;
      precision: number;
      trackingMode: "none" | "lot";
      requiresExpiry: boolean;
      conversions: { unit: string; factor: string }[];
    }>(
      Joi.object({
        revision: revisionInput,
        precision: Joi.number().integer().min(0).max(6).required(),
        trackingMode: Joi.string().valid("none", "lot").required(),
        requiresExpiry: Joi.boolean().required(),
        conversions: Joi.array()
          .max(20)
          .items(
            Joi.object({
              unit: Joi.string().trim().max(40).required(),
              factor: Joi.string().trim().max(30).required(),
            }),
          )
          .required(),
      }),
      req.body,
    );
    const { revision, ...profile } = data;
    res.json(publicRecord(await saveProfile(db, actor, recordId(req), revision, profile)));
  }),
);
logisticsRouter.post(
  "/batch-stock",
  permission("manage"),
  route(async (req, res, db, actor) => {
    res
      .status(201)
      .json(
        publicRecord(
          (await batchStock(
            db,
            actor,
            input(stockInput, req.body),
            input<string>(Joi.string().guid().required(), req.get("Idempotency-Key")),
          )) as object,
        ),
      );
  }),
);
